-- =====================================================================
--  POS MINIMARKET — SCRIPT COMPLETO PARA COPIAR LA BASE DE DATOS
--  Pegar TODO este archivo en el SQL Editor de tu Supabase nueva.
--  Es idempotente: se puede ejecutar varias veces sin perder datos.
--  Incluye: extensiones, tablas, funciones, triggers, vistas, GRANTs,
--           RLS, datos demo y el usuario administrador maestro.
--
--  IMPORTANTE SOBRE TUS DATOS REALES (ventas, productos, clientes...):
--  Este script crea toda la ESTRUCTURA. Para llevar también los DATOS
--  de la base actual, exporta la información desde el panel de la base
--  actual (Table Editor → selecciona tabla → Export CSV, tabla por
--  tabla) e impórtalos en la nueva (Import CSV sobre cada tabla), en
--  este orden: tiendas, terminales, categorias, proveedores, productos,
--  clientes, lotes, ventas, venta_items, ventas_items, venta_pagos,
--  compras, compra_items, cajas, movimientos_caja, gastos, combos,
--  combo_items, etiquetas, configuracion, licencia, kardex,
--  ajustes_inventario, descuentos_auditoria, configuracion_alertas,
--  notificaciones_gestion, perfiles, roles_usuario, permisos_usuario,
--  log_auditoria.
--  (Los usuarios/contraseñas de Authentication NO se copian por SQL:
--   recrea los usuarios en Authentication → Users de la nueva base con
--   el mismo correo; el trigger de abajo les asigna rol y permisos
--   automáticamente, y el admin maestro kevincoorporativa@gmail.com
--   recibe todos los módulos solo.)
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";
do $$ begin create extension if not exists "pg_trgm"; exception when others then null; end $$;

-- =====================================================================
-- 1. ROL / SEGURIDAD
-- =====================================================================
do $$ begin
  create type public.app_role as enum ('administrador','gerente','supervisor','cajero','almacenero','vendedor','contador');
exception when duplicate_object then null; end $$;

alter type public.app_role add value if not exists 'gerente';
alter type public.app_role add value if not exists 'vendedor';
alter type public.app_role add value if not exists 'contador';

-- =====================================================================
-- 2. PERFILES, ROLES Y PERMISOS
-- =====================================================================
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  correo text,
  creado_en timestamptz not null default now()
);

create table if not exists public.roles_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol        public.app_role not null default 'cajero',
  nombre     text,
  activo     boolean default true,
  creado_en  timestamptz default now()
);

create table if not exists public.permisos_usuario (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,
  creado_en timestamptz default now(),
  primary key (usuario_id, modulo)
);

create or replace function public.has_role(_uid uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles_usuario
                 where usuario_id = _uid and rol = _role and coalesce(activo,true));
$$;

create or replace function public.es_admin(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_uid,'administrador');
$$;

create or replace function public.puede_vender(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_uid,'administrador')
      or public.has_role(_uid,'supervisor')
      or public.has_role(_uid,'cajero')
      or public.has_role(_uid,'vendedor');
$$;

-- Trigger: al crear un usuario, crear perfil + rol + permisos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  es_admin boolean; m text;
  modulos text[] := ARRAY[
    'dashboard','pos','productos','categorias','combos','inventario','lotes',
    'kardex','etiquetas','compras','proveedores','clientes','caja','gastos',
    'tickets','reportes','usuarios','ajustes','configuracion','guia'
  ];
BEGIN
  es_admin := lower(NEW.email) = 'kevincoorporativa@gmail.com';
  INSERT INTO public.perfiles (id, nombre, correo)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), NEW.email)
  ON CONFLICT (id) DO UPDATE SET correo = EXCLUDED.correo;
  INSERT INTO public.roles_usuario (usuario_id, rol)
  VALUES (NEW.id, CASE WHEN es_admin THEN 'administrador' ELSE 'cajero' END)
  ON CONFLICT (usuario_id) DO NOTHING;
  IF es_admin THEN
    FOREACH m IN ARRAY modulos LOOP
      INSERT INTO public.permisos_usuario (usuario_id, modulo) VALUES (NEW.id, m)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Proteger al admin maestro
CREATE OR REPLACE FUNCTION public.protege_admin_maestro() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE correo text;
BEGIN
  SELECT email INTO correo FROM auth.users WHERE id = COALESCE(OLD.usuario_id, NEW.usuario_id);
  IF lower(correo) = 'kevincoorporativa@gmail.com' THEN
    RAISE EXCEPTION 'No se puede modificar los permisos/rol del administrador maestro';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS tr_protege_admin_roles ON public.roles_usuario;
CREATE TRIGGER tr_protege_admin_roles BEFORE UPDATE OR DELETE ON public.roles_usuario
  FOR EACH ROW EXECUTE FUNCTION public.protege_admin_maestro();
DROP TRIGGER IF EXISTS tr_protege_admin_permisos ON public.permisos_usuario;
CREATE TRIGGER tr_protege_admin_permisos BEFORE DELETE ON public.permisos_usuario
  FOR EACH ROW EXECUTE FUNCTION public.protege_admin_maestro();

-- =====================================================================
-- 3. TIENDAS / TERMINALES
-- =====================================================================
create table if not exists public.tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text, ruc text, telefono text, email text, logo_url text,
  moneda text default 'PEN',
  igv numeric(5,2) default 18.00,
  activa boolean default true,
  creada_en timestamptz default now()
);

create table if not exists public.terminales (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references public.tiendas(id) on delete cascade,
  nombre text not null,
  serie_boleta  text default 'B001',
  serie_factura text default 'F001',
  serie_ticket  text default 'T001',
  activa boolean default true
);

-- =====================================================================
-- 4. CATÁLOGO
-- =====================================================================
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  icono text, color text,
  orden int default 0,
  activa boolean default true,
  creada_en timestamptz default now()
);

create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  ruc text unique,
  razon_social text not null,
  nombre_comercial text,
  contacto text, telefono text,
  email text, correo text,
  direccion text,
  dias_credito int,
  activo boolean default true,
  creado_en timestamptz default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  codigo_barras text unique,
  sku text unique,
  nombre text not null,
  descripcion text,
  categoria_id uuid references public.categorias(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  unidad text default 'unidad',
  precio_compra numeric(12,2) default 0,
  precio_venta  numeric(12,2) not null default 0,
  stock         numeric(12,3) default 0,
  stock_minimo  numeric(12,3) default 5,
  afecto_igv    boolean default true,
  es_servicio   boolean not null default false,
  imagen_url    text,
  ubicacion     text,
  activo        boolean default true,
  creado_en     timestamptz default now(),
  actualizado_en timestamptz default now()
);
create index if not exists idx_productos_categoria on public.productos(categoria_id);
create index if not exists idx_productos_codigo    on public.productos(codigo_barras);
create index if not exists idx_productos_activo    on public.productos(activo) where activo;
create index if not exists idx_productos_nombre_trgm on public.productos using gin (nombre gin_trgm_ops);

-- =====================================================================
-- 5. LOTES / KARDEX / AJUSTES
-- =====================================================================
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  codigo_lote text,
  numero_lote text,
  fecha_produccion date,
  fecha_vencimiento date,
  cantidad numeric(12,3) not null default 0,
  cantidad_inicial numeric(12,3) default 0,
  cantidad_actual numeric(12,3) default 0,
  costo_unitario numeric(12,2) default 0,
  ubicacion text,
  bloqueado boolean default false,
  creado_en timestamptz default now(),
  unique (producto_id, numero_lote)
);
create index if not exists idx_lotes_producto on public.lotes(producto_id);
create index if not exists idx_lotes_vence    on public.lotes(fecha_vencimiento);

create table if not exists public.kardex (
  id bigserial primary key,
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo text not null check (tipo in ('ENTRADA','SALIDA','AJUSTE','VENTA','COMPRA','DEVOLUCION','ANULACION')),
  cantidad numeric(12,3) not null,
  saldo    numeric(12,3),
  costo_unitario numeric(12,2),
  documento text, motivo text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz default now()
);
create index if not exists idx_kardex_producto on public.kardex(producto_id, creado_en desc);

create table if not exists public.ajustes_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  cantidad numeric(12,3) not null,
  motivo text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz default now()
);

-- =====================================================================
-- 6. CLIENTES
-- =====================================================================
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo_doc text default 'DNI' check (tipo_doc in ('DNI','RUC','CE','PASAPORTE','OTRO')),
  documento text,
  nombre text not null,
  email text, telefono text, direccion text,
  puntos int default 0,
  activo boolean default true,
  creado_en timestamptz default now()
);
create unique index if not exists uq_clientes_doc on public.clientes(tipo_doc, documento) where documento is not null;
create index if not exists idx_clientes_nombre_trgm on public.clientes using gin (nombre gin_trgm_ops);

-- =====================================================================
-- 7. VENTAS
-- =====================================================================
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id   uuid references public.tiendas(id) on delete set null,
  terminal_id uuid references public.terminales(id) on delete set null,
  serie text not null,
  correlativo bigint not null,
  tipo_comprobante text not null check (tipo_comprobante in ('BOLETA','FACTURA','TICKET','NOTA_CREDITO')),
  cliente_id uuid references public.clientes(id) on delete set null,
  cajero_id  uuid references auth.users(id),
  subtotal   numeric(12,2) not null default 0,
  igv        numeric(12,2) not null default 0,
  descuento  numeric(12,2) not null default 0,
  total      numeric(12,2) not null default 0,
  metodo_pago text not null default 'EFECTIVO',
  estado text not null default 'EMITIDA' check (estado in ('EMITIDA','ANULADA','PENDIENTE')),
  observacion text,
  creada_en timestamptz default now(),
  unique (serie, correlativo, tipo_comprobante)
);
create index if not exists idx_ventas_fecha   on public.ventas(creada_en desc);
create index if not exists idx_ventas_estado  on public.ventas(estado);
create index if not exists idx_ventas_cliente on public.ventas(cliente_id);
create index if not exists idx_ventas_cajero  on public.ventas(cajero_id);

create table if not exists public.venta_items (
  id bigserial primary key,
  venta_id    uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  cantidad numeric(12,3) not null,
  precio_unitario numeric(12,2) not null,
  descuento numeric(12,2) default 0,
  subtotal  numeric(12,2) not null,
  igv       numeric(12,2) default 0,
  total     numeric(12,2) not null
);
create index if not exists idx_venta_items_venta    on public.venta_items(venta_id);
create index if not exists idx_venta_items_producto on public.venta_items(producto_id);

create table if not exists public.ventas_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references public.ventas(id) on delete cascade not null,
  producto_id uuid references public.productos(id) not null,
  cantidad numeric(12,2) not null default 0,
  precio_unitario numeric(12,2) not null default 0,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  creada_en timestamptz default now()
);

create table if not exists public.venta_pagos (
  id bigserial primary key,
  venta_id uuid not null references public.ventas(id) on delete cascade,
  metodo text not null,
  monto  numeric(12,2) not null,
  referencia text,
  creado_en timestamptz default now()
);

create or replace function public.siguiente_correlativo(_serie text, _tipo text)
returns bigint language sql as $$
  select coalesce(max(correlativo),0) + 1
  from public.ventas where serie = _serie and tipo_comprobante = _tipo;
$$;

-- =====================================================================
-- 8. COMPRAS
-- =====================================================================
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references public.proveedores(id) on delete set null,
  tipo_comprobante text default 'FACTURA',
  numero_documento text,
  documento text,
  fecha_emision date,
  metodo_pago text default 'CREDITO',
  subtotal numeric(12,2) default 0,
  igv      numeric(12,2) default 0,
  total    numeric(12,2) default 0,
  estado text default 'RECIBIDA' check (estado in ('PENDIENTE','RECIBIDA','ANULADA')),
  usuario_id uuid references auth.users(id),
  creada_en timestamptz default now()
);
create index if not exists idx_compras_fecha on public.compras(creada_en desc);

create table if not exists public.compra_items (
  id bigserial primary key,
  compra_id   uuid not null references public.compras(id) on delete cascade,
  producto_id uuid references public.productos(id) on delete set null,
  nombre text not null,
  cantidad numeric(12,3) not null,
  costo_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null
);
create index if not exists idx_compra_items_compra on public.compra_items(compra_id);

-- =====================================================================
-- 9. CAJA / GASTOS
-- =====================================================================
create sequence if not exists public.cajas_numero_seq;

create table if not exists public.cajas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('public.cajas_numero_seq'),
  cajero_id uuid references auth.users(id) on delete set null,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA','CERRADA')),
  monto_apertura numeric(12,2) not null default 0,
  monto_cierre numeric(12,2),
  monto_esperado numeric(12,2),
  diferencia numeric(12,2),
  arqueo jsonb,
  sucursal text default 'Principal',
  turno text,
  equipo text,
  ip text,
  observacion_apertura text,
  observacion_cierre text,
  total_ventas  numeric(12,2) not null default 0,
  total_ingresos numeric(12,2) not null default 0,
  total_egresos  numeric(12,2) not null default 0,
  total_retiros  numeric(12,2) not null default 0,
  abierta_en timestamptz not null default now(),
  cerrada_en timestamptz
);
alter sequence public.cajas_numero_seq owned by public.cajas.numero;
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'cajas_turno_check') then
    alter table public.cajas drop constraint cajas_turno_check;
  end if;
end $$;
alter table public.cajas add constraint cajas_turno_check
  check (turno is null or turno in ('DIA','MANANA','TARDE','NOCHE'));
create index if not exists idx_cajas_cajero_estado on public.cajas(cajero_id, estado);
create index if not exists idx_cajas_abierta_en on public.cajas(abierta_en desc);

create table if not exists public.movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas(id) on delete cascade,
  tipo text not null check (tipo in ('APERTURA','INGRESO','EGRESO','VENTA','RETIRO','GASTO','ANULACION','DEVOLUCION','AJUSTE','CIERRE')),
  metodo_pago text,
  monto numeric(12,2) not null,
  saldo numeric(12,2),
  concepto text not null default '',
  documento text,
  referencia text,
  usuario_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists idx_mov_caja on public.movimientos_caja(caja_id, creado_en desc);
create index if not exists idx_mov_caja_tipo on public.movimientos_caja(caja_id, tipo);
create index if not exists idx_mov_caja_metodo on public.movimientos_caja(caja_id, metodo_pago);

-- Saldo corrido + totales por caja
create or replace function public.fn_caja_movimiento() returns trigger language plpgsql as $$
declare v_prev numeric(12,2); v_sign int;
begin
  select saldo into v_prev from public.movimientos_caja
    where caja_id = new.caja_id order by creado_en desc, id desc limit 1;
  if v_prev is null then
    select coalesce(monto_apertura,0) into v_prev from public.cajas where id = new.caja_id;
  end if;
  v_sign := case
    when new.tipo in ('INGRESO','VENTA','DEVOLUCION','APERTURA') then 1
    when new.tipo in ('EGRESO','GASTO','RETIRO','ANULACION') then -1
    else 0 end;
  new.saldo := coalesce(v_prev,0) + (v_sign * coalesce(new.monto,0));
  return new;
end $$;
drop trigger if exists trg_caja_saldo on public.movimientos_caja;
create trigger trg_caja_saldo before insert on public.movimientos_caja
  for each row execute function public.fn_caja_movimiento();

create or replace function public.fn_caja_acumula() returns trigger language plpgsql as $$
begin
  if new.tipo = 'VENTA' then
    update public.cajas set total_ventas   = coalesce(total_ventas,0)   + new.monto where id = new.caja_id;
  elsif new.tipo = 'INGRESO' then
    update public.cajas set total_ingresos = coalesce(total_ingresos,0) + new.monto where id = new.caja_id;
  elsif new.tipo in ('EGRESO','GASTO') then
    update public.cajas set total_egresos  = coalesce(total_egresos,0)  + new.monto where id = new.caja_id;
  elsif new.tipo = 'RETIRO' then
    update public.cajas set total_retiros  = coalesce(total_retiros,0)  + new.monto where id = new.caja_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_caja_acumula on public.movimientos_caja;
create trigger trg_caja_acumula after insert on public.movimientos_caja
  for each row execute function public.fn_caja_acumula();

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  categoria text not null default 'OTROS',
  concepto text not null,
  monto numeric(12,2) not null,
  metodo_pago text not null default 'EFECTIVO',
  numero_documento text,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists idx_gastos_fecha on public.gastos(fecha desc);

-- =====================================================================
-- 10. COMBOS / ETIQUETAS / CONFIG / LICENCIA / AUDITORÍA
-- =====================================================================
create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric(12,2) not null,
  activo boolean default true,
  creado_en timestamptz default now()
);
create table if not exists public.combo_items (
  id bigserial primary key,
  combo_id   uuid not null references public.combos(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete cascade,
  cantidad numeric(12,3) not null default 1
);

create table if not exists public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references public.productos(id) on delete cascade,
  formato text default '50x30',
  cantidad int default 1,
  impreso boolean default false,
  creado_en timestamptz default now()
);

create table if not exists public.configuracion (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  actualizada_en timestamptz default now()
);

create table if not exists public.licencia (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave          text unique,
  tipo           text NOT NULL DEFAULT 'demo',
  estado         text NOT NULL DEFAULT 'activa',
  plan           text default 'free',
  duracion_dias  integer NOT NULL DEFAULT 30,
  fecha_inicio   date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  expira_en      date,
  notas          text,
  activo         boolean default true,
  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.trg_licencia_upd() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizada_en := now();
  IF NEW.fecha_vencimiento < CURRENT_DATE THEN NEW.estado := 'vencida'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS tr_licencia_upd ON public.licencia;
CREATE TRIGGER tr_licencia_upd BEFORE UPDATE ON public.licencia
  FOR EACH ROW EXECUTE FUNCTION public.trg_licencia_upd();

create table if not exists public.log_auditoria (
  id bigserial primary key,
  usuario_id uuid references auth.users(id),
  accion text not null,
  entidad text, entidad_id text,
  detalle jsonb, ip text,
  creado_en timestamptz default now()
);
create index if not exists idx_log_fecha on public.log_auditoria(creado_en desc);

-- Auditoría de descuentos
create table if not exists public.descuentos_auditoria (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references public.ventas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  autorizado_por text,
  tipo text check (tipo in ('porcentaje','monto')),
  aplicado_a text check (aplicado_a in ('total','producto','item')),
  producto_id uuid references public.productos(id) on delete set null,
  valor numeric(12,2),
  monto_descuento numeric(12,2),
  motivo text,
  motivo_texto text,
  creado_en timestamptz not null default now()
);
create index if not exists idx_descuentos_auditoria_venta   on public.descuentos_auditoria(venta_id);
create index if not exists idx_descuentos_auditoria_fecha   on public.descuentos_auditoria(creado_en desc);
create index if not exists idx_descuentos_auditoria_usuario on public.descuentos_auditoria(usuario_id);

-- Configuración de alertas (notificaciones)
create table if not exists public.configuracion_alertas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade,
  sucursal_id uuid,
  dias_advertencia integer default 15,
  dias_critico integer default 7,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique(usuario_id)
);

-- Gestión de notificaciones resueltas
create table if not exists public.notificaciones_gestion (
  id uuid primary key default gen_random_uuid(),
  notificacion_id text not null,
  gestionado_por uuid references auth.users(id),
  gestionado_en timestamptz default now(),
  comentario text,
  unique(notificacion_id)
);

-- =====================================================================
-- 11. FUNCIONES DE STOCK (RPC usadas por el POS)
-- =====================================================================
-- Descuento de stock FIFO por vencimiento
create or replace function public.descontar_stock_venta(p_producto uuid, p_cantidad numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_restante numeric := p_cantidad; v_nuevo numeric; r record; v_tomar numeric;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    select stock into v_nuevo from public.productos where id = p_producto; return v_nuevo;
  end if;
  for r in
    select id, cantidad_actual from public.lotes
    where producto_id = p_producto and coalesce(bloqueado,false) = false
      and coalesce(cantidad_actual,0) > 0
    order by fecha_vencimiento asc nulls last, creado_en asc for update
  loop
    exit when v_restante <= 0;
    v_tomar := least(r.cantidad_actual, v_restante);
    update public.lotes set cantidad_actual = cantidad_actual - v_tomar where id = r.id;
    v_restante := v_restante - v_tomar;
  end loop;
  update public.productos
     set stock = greatest(0, coalesce(stock,0) - p_cantidad), actualizado_en = now()
   where id = p_producto
  returning stock into v_nuevo;
  return v_nuevo;
end $$;
revoke all on function public.descontar_stock_venta(uuid, numeric) from public;
grant execute on function public.descontar_stock_venta(uuid, numeric) to authenticated, service_role;

-- Aumento de stock por compra
create or replace function public.aumentar_stock_compra(
  p_producto uuid, p_cantidad numeric, p_costo numeric default null,
  p_documento text default null, p_motivo text default 'Ingreso por compra'
) returns numeric language plpgsql security definer set search_path = public as $$
declare v_nuevo numeric;
begin
  if p_producto is null or p_cantidad is null or p_cantidad <= 0 then
    select stock into v_nuevo from public.productos where id = p_producto; return v_nuevo;
  end if;
  update public.productos
     set stock = coalesce(stock,0) + p_cantidad,
         precio_compra = case when coalesce(p_costo,0) > 0 then p_costo else precio_compra end,
         actualizado_en = now()
   where id = p_producto
  returning stock into v_nuevo;
  if v_nuevo is null then raise exception 'Producto % no existe', p_producto; end if;
  insert into public.kardex(producto_id, tipo, cantidad, saldo, costo_unitario, documento, motivo, usuario_id)
  values (p_producto, 'COMPRA', p_cantidad, v_nuevo, p_costo, p_documento, p_motivo, auth.uid());
  return v_nuevo;
end $$;
revoke all on function public.aumentar_stock_compra(uuid, numeric, numeric, text, text) from public;
grant execute on function public.aumentar_stock_compra(uuid, numeric, numeric, text, text) to authenticated, service_role;

-- Reversión de stock al anular venta
create or replace function public.trg_venta_anulada() returns trigger language plpgsql as $$
declare r record; _saldo numeric(12,3);
begin
  if new.estado = 'ANULADA' and old.estado <> 'ANULADA' then
    for r in select producto_id, cantidad from public.venta_items where venta_id = new.id and producto_id is not null loop
      update public.productos set stock = coalesce(stock,0) + r.cantidad where id = r.producto_id
      returning stock into _saldo;
      insert into public.kardex(producto_id, tipo, cantidad, saldo, documento, motivo, usuario_id)
      values (r.producto_id,'ANULACION', r.cantidad, _saldo, new.id::text, 'Anulación de venta', auth.uid());
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists tr_venta_anulada on public.ventas;
create trigger tr_venta_anulada after update of estado on public.ventas
  for each row execute function public.trg_venta_anulada();

-- Ajuste de inventario actualiza stock
create or replace function public.trg_ajuste_stock() returns trigger language plpgsql as $$
declare _saldo numeric(12,3);
begin
  update public.productos set stock = coalesce(stock,0) + new.cantidad where id = new.producto_id
  returning stock into _saldo;
  insert into public.kardex(producto_id, tipo, cantidad, saldo, documento, motivo, usuario_id)
  values (new.producto_id, 'AJUSTE', new.cantidad, _saldo, new.id::text, coalesce(new.motivo,'Ajuste manual'), auth.uid());
  return new;
end $$;
drop trigger if exists tr_ajuste_stock on public.ajustes_inventario;
create trigger tr_ajuste_stock after insert on public.ajustes_inventario
  for each row execute function public.trg_ajuste_stock();

-- updated_at en productos
create or replace function public.trg_actualizado_en() returns trigger
language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;
drop trigger if exists tr_productos_upd on public.productos;
create trigger tr_productos_upd before update on public.productos
  for each row execute function public.trg_actualizado_en();

-- =====================================================================
-- 12. VISTAS / KPIs
-- =====================================================================
drop view if exists public.v_stock_bajo cascade;
create view public.v_stock_bajo as
  select p.*, coalesce(c.nombre,'Sin categoría') as categoria
  from public.productos p left join public.categorias c on c.id = p.categoria_id
  where p.activo and coalesce(p.stock,0) <= coalesce(p.stock_minimo,0);

drop view if exists public.v_ventas_dia cascade;
create view public.v_ventas_dia as
  select date(creada_en) as dia, count(*) as transacciones,
         sum(total) as total_ventas, sum(igv) as total_igv, sum(descuento) as total_descuento
  from public.ventas where estado <> 'ANULADA'
  group by date(creada_en) order by dia desc;

drop view if exists public.v_top_productos cascade;
create view public.v_top_productos as
  select vi.producto_id, vi.nombre, sum(vi.cantidad) as unidades, sum(vi.total) as monto
  from public.venta_items vi join public.ventas v on v.id = vi.venta_id
  where v.estado <> 'ANULADA'
  group by vi.producto_id, vi.nombre order by unidades desc;

drop view if exists public.v_kpi_hoy cascade;
create view public.v_kpi_hoy as
  select
    coalesce(sum(total) filter (where date(creada_en)=current_date and estado<>'ANULADA'),0) as ventas_hoy,
    coalesce(count(*)   filter (where date(creada_en)=current_date and estado<>'ANULADA'),0) as tickets_hoy,
    coalesce(avg(total) filter (where date(creada_en)=current_date and estado<>'ANULADA'),0) as ticket_promedio,
    coalesce(sum(total) filter (where date(creada_en)=current_date-1 and estado<>'ANULADA'),0) as ventas_ayer
  from public.ventas;

drop view if exists public.v_lotes_por_vencer cascade;
create view public.v_lotes_por_vencer as
  select l.*, p.nombre as producto
  from public.lotes l join public.productos p on p.id = l.producto_id
  where l.fecha_vencimiento is not null
    and l.fecha_vencimiento <= current_date + interval '30 days'
  order by l.fecha_vencimiento asc;

drop view if exists public.v_caja_resumen cascade;
create view public.v_caja_resumen as
  select c.id as caja_id, c.numero, c.cajero_id, c.estado, c.monto_apertura,
         c.total_ventas, c.total_ingresos, c.total_egresos, c.total_retiros,
         c.abierta_en, c.cerrada_en,
         c.monto_apertura + c.total_ingresos + c.total_ventas
           - c.total_egresos - c.total_retiros as saldo
  from public.cajas c;

-- =====================================================================
-- 13. GRANTS
-- =====================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'perfiles','roles_usuario','permisos_usuario','tiendas','terminales','categorias','proveedores',
    'productos','lotes','kardex','ajustes_inventario','clientes','ventas','venta_items','ventas_items',
    'venta_pagos','compras','compra_items','cajas','movimientos_caja','gastos','combos','combo_items',
    'etiquetas','configuracion','licencia','log_auditoria','descuentos_auditoria',
    'configuracion_alertas','notificaciones_gestion'
  ]) loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;
grant usage, select on sequence public.cajas_numero_seq to authenticated;
grant all on sequence public.cajas_numero_seq to service_role;
grant select on public.v_stock_bajo, public.v_ventas_dia, public.v_top_productos,
               public.v_kpi_hoy, public.v_lotes_por_vencer, public.v_caja_resumen
  to authenticated;

-- =====================================================================
-- 14. RLS (row level security)
-- =====================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'perfiles','roles_usuario','permisos_usuario','tiendas','terminales','categorias','proveedores',
    'productos','lotes','kardex','ajustes_inventario','clientes','ventas','venta_items','ventas_items',
    'venta_pagos','compras','compra_items','cajas','movimientos_caja','gastos','combos','combo_items',
    'etiquetas','configuracion','licencia','log_auditoria','descuentos_auditoria',
    'configuracion_alertas','notificaciones_gestion'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Lectura para cualquier autenticado
do $$
declare t text;
begin
  for t in select unnest(array[
    'tiendas','terminales','categorias','proveedores','productos','lotes','kardex',
    'clientes','ventas','venta_items','ventas_items','venta_pagos','compras','compra_items',
    'cajas','movimientos_caja','gastos','combos','combo_items','etiquetas',
    'configuracion','licencia','descuentos_auditoria'
  ]) loop
    execute format('drop policy if exists "auth_read_%1$s" on public.%1$I', t);
    execute format('create policy "auth_read_%1$s" on public.%1$I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Lectura/escritura general (perfiles, permisos, alertas, notificaciones)
do $$
declare t text;
begin
  for t in select unnest(array['perfiles','permisos_usuario','configuracion_alertas','notificaciones_gestion']) loop
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$I', t);
    execute format('create policy "auth_all_%1$s" on public.%1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Escritura: ventas / caja / clientes para quien pueda vender
create policy "vender_ventas"      on public.ventas       for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_venta_items" on public.venta_items  for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_venta_pagos" on public.venta_pagos  for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_clientes"    on public.clientes     for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "cajas_select" on public.cajas for select to authenticated using (true);
create policy "cajas_insert" on public.cajas for insert to authenticated with check (auth.uid() = cajero_id);
create policy "cajas_update" on public.cajas for update to authenticated using (true) with check (true);
create policy "mov_caja_all" on public.movimientos_caja for all to authenticated using (true) with check (true);

-- Inventario para admin/supervisor/almacenero
do $$
declare t text;
begin
  for t in select unnest(array['productos','categorias','proveedores','lotes','ajustes_inventario','compras','compra_items','etiquetas']) loop
    execute format('drop policy if exists "alm_%1$s" on public.%1$I', t);
    execute format('create policy "alm_%1$s" on public.%1$I for all to authenticated using (public.has_role(auth.uid(),''administrador'') or public.has_role(auth.uid(),''supervisor'') or public.has_role(auth.uid(),''almacenero'')) with check (true)', t);
  end loop;
end $$;
create policy "alm_kardex_ins" on public.kardex for insert to authenticated with check (true);
create policy "alm_kardex_upd" on public.kardex for update to authenticated using (public.es_admin());
create policy "alm_kardex_del" on public.kardex for delete to authenticated using (public.es_admin());

-- Solo admin: tiendas, terminales, config, licencia, auditoría, roles
create policy "adm_tiendas"    on public.tiendas    for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "adm_terminales" on public.terminales for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "adm_config"     on public.configuracion for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "licencia_todos" on public.licencia for all to authenticated using (true) with check (true);
create policy "adm_log_read"   on public.log_auditoria for select to authenticated using (public.es_admin());
create policy "adm_log_ins"    on public.log_auditoria for insert to authenticated with check (true);
create policy "adm_roles_all"  on public.roles_usuario for all to authenticated using (true) with check (true);

-- =====================================================================
-- 15. DATOS INICIALES
-- =====================================================================
insert into public.tiendas(nombre, direccion, ruc, telefono)
select 'Mi Minimarket','Av. Principal 123','20123456789','+51 999 999 999'
where not exists (select 1 from public.tiendas);

insert into public.terminales(tienda_id, nombre)
select id, 'Caja 1' from public.tiendas
where not exists (select 1 from public.terminales);

insert into public.categorias(nombre, icono, color, orden) values
  ('Abarrotes','ShoppingBasket','#10b981',1),
  ('Bebidas','CupSoda','#0ea5e9',2),
  ('Lácteos','Milk','#f59e0b',3),
  ('Panadería','Croissant','#a855f7',4),
  ('Limpieza','SprayCan','#06b6d4',5),
  ('Snacks','Cookie','#ef4444',6),
  ('Carnes','Beef','#dc2626',7),
  ('Frutas','Apple','#22c55e',8)
on conflict (nombre) do nothing;

insert into public.configuracion(clave, valor) values
  ('empresa',   '{"nombre":"Mi Minimarket","ruc":"20123456789","direccion":"Av. Principal 123","telefono":"+51 999 999 999","email":"contacto@minimarket.pe"}'::jsonb),
  ('ticket',    '{"alto":"80mm","mensaje":"¡Gracias por su compra!","mostrar_logo":true,"copias":2}'::jsonb),
  ('apariencia','{"tema":"claro","color":"emerald"}'::jsonb),
  ('impuestos', '{"igv":18.0,"incluido":true}'::jsonb),
  ('seguridad', '{"bloqueo_inactividad_min":15,"requerir_2fa":false}'::jsonb)
on conflict (clave) do nothing;

insert into public.licencia (tipo, estado, duracion_dias, fecha_inicio, fecha_vencimiento, notas)
select 'demo', 'activa', 30, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'Licencia inicial de prueba'
where not exists (select 1 from public.licencia);

-- Productos "virtuales" de servicios del POS
insert into public.productos (codigo_barras, nombre, unidad, precio_venta, precio_compra, stock, stock_minimo, afecto_igv, activo, es_servicio)
values
  ('SERV-RECARGA', 'Recarga Celular',  'UND', 0,   0, 999999, 0, false, false, true),
  ('SERV-PAGO',    'Pago de Servicio', 'UND', 0,   0, 999999, 0, false, false, true),
  ('SERV-BOLSA',   'Bolsa Plástica',   'UND', 0.30,0, 999999, 0, true,  false, true)
on conflict (codigo_barras) do update
  set nombre = excluded.nombre, es_servicio = true, stock = 999999, activo = false;

-- =====================================================================
-- 16. ADMINISTRADOR MAESTRO
--   1) Authentication → Users → Add user, con el correo
--      kevincoorporativa@gmail.com (y tu contraseña).
--   El trigger on_auth_user_created le asigna automáticamente el rol
--   'administrador' y TODOS los módulos. Cualquier otro usuario que
--   crees quedará como 'cajero' y le asignas permisos desde la app.
-- =====================================================================

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- LISTO. Verifica:
--   SELECT COUNT(*) FROM public.productos;
--   SELECT COUNT(*) FROM public.categorias;   -- 8
--   SELECT rol, usuario_id FROM public.roles_usuario;
-- =====================================================================

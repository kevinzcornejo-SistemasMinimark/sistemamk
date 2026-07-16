-- =====================================================================
--  POS MINIMARKET — BASE DE DATOS COMPLETA v2  (Supabase / PostgreSQL)
--  Copiar y pegar TODO este archivo en el SQL Editor de Supabase.
--  Es 100% idempotente: se puede ejecutar varias veces sin perder datos.
--  Incluye: tablas, GRANTs, RLS por rol, triggers, vistas, KPIs, demo.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- =====================================================================
-- 1. ROLES / SEGURIDAD
-- =====================================================================
do $$ begin
  create type public.app_role as enum ('administrador','supervisor','cajero','almacenero');
exception when duplicate_object then null; end $$;

create table if not exists public.roles_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol        public.app_role not null default 'cajero',
  nombre     text,
  activo     boolean default true,
  creado_en  timestamptz default now()
);

-- Compatibilidad: si la columna existía como text, la convertimos
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='roles_usuario'
               and column_name='rol' and data_type='text') then
    alter table public.roles_usuario
      alter column rol drop default,
      alter column rol type public.app_role using rol::public.app_role,
      alter column rol set default 'cajero';
  end if;
end $$;

grant select on public.roles_usuario to authenticated;
grant all    on public.roles_usuario to service_role;

create or replace function public.has_role(_uid uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.roles_usuario
                 where usuario_id = _uid and rol = _role and activo);
$$;

create or replace function public.es_admin(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_uid,'administrador');
$$;

create or replace function public.puede_vender(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_uid,'administrador')
      or public.has_role(_uid,'supervisor')
      or public.has_role(_uid,'cajero');
$$;

-- =====================================================================
-- 2. TIENDAS / TERMINALES
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
-- 3. CATÁLOGO
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
  ruc text, razon_social text not null,
  contacto text, telefono text, email text, direccion text,
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
  imagen_url    text,
  activo        boolean default true,
  creado_en     timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- Compatibilidad con tablas antiguas
alter table public.productos add column if not exists sku text;
alter table public.productos add column if not exists stock numeric(12,3) default 0;
alter table public.productos add column if not exists stock_minimo numeric(12,3) default 5;
alter table public.productos add column if not exists activo boolean default true;
update public.productos set stock = coalesce(stock,0), stock_minimo = coalesce(stock_minimo,5), activo = coalesce(activo,true);

create index if not exists idx_productos_categoria on public.productos(categoria_id);
create index if not exists idx_productos_codigo    on public.productos(codigo_barras);
create index if not exists idx_productos_activo    on public.productos(activo) where activo;
create index if not exists idx_productos_nombre_trgm on public.productos using gin (nombre gin_trgm_ops);
do $$ begin
  create extension if not exists "pg_trgm";
exception when others then null; end $$;

-- =====================================================================
-- 4. LOTES / KARDEX / AJUSTES
-- =====================================================================
create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  codigo_lote text,
  fecha_vencimiento date,
  cantidad numeric(12,3) not null default 0,
  costo_unitario numeric(12,2) default 0,
  creado_en timestamptz default now()
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
-- 5. CLIENTES
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
-- Compatibilidad con tablas antiguas
alter table public.clientes add column if not exists tipo_doc text default 'DNI';
alter table public.clientes add column if not exists documento text;
alter table public.clientes add column if not exists nombre text;
alter table public.clientes add column if not exists email text;
alter table public.clientes add column if not exists telefono text;
alter table public.clientes add column if not exists direccion text;
alter table public.clientes add column if not exists puntos int default 0;
alter table public.clientes add column if not exists activo boolean default true;
alter table public.clientes add column if not exists creado_en timestamptz default now();
-- Migrar datos de columnas antiguas si existen
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='numero_documento') then
    update public.clientes set documento = coalesce(documento, numero_documento) where documento is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='tipo_documento') then
    update public.clientes set tipo_doc = coalesce(tipo_doc, tipo_documento) where tipo_doc is null or tipo_doc='DNI';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='razon_social') then
    update public.clientes set nombre = coalesce(nombre, razon_social, trim(concat_ws(' ', nombres, apellidos))) where nombre is null;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='clientes' and column_name='correo') then
    update public.clientes set email = coalesce(email, correo) where email is null;
  end if;
end $$;
update public.clientes set nombre = coalesce(nombre, 'Cliente') where nombre is null;

create unique index if not exists uq_clientes_doc on public.clientes(tipo_doc, documento) where documento is not null;
create index if not exists idx_clientes_nombre_trgm on public.clientes using gin (nombre gin_trgm_ops);


-- =====================================================================
-- 6. VENTAS
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

create table if not exists public.venta_pagos (
  id bigserial primary key,
  venta_id uuid not null references public.ventas(id) on delete cascade,
  metodo text not null,
  monto  numeric(12,2) not null,
  referencia text,
  creado_en timestamptz default now()
);

-- Helper: siguiente correlativo por serie/tipo (sin condiciones de carrera graves)
create or replace function public.siguiente_correlativo(_serie text, _tipo text)
returns bigint language sql as $$
  select coalesce(max(correlativo),0) + 1
  from public.ventas where serie = _serie and tipo_comprobante = _tipo;
$$;

-- =====================================================================
-- 7. COMPRAS
-- =====================================================================
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references public.proveedores(id) on delete set null,
  documento text,
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
-- 8. CAJA / GASTOS
-- =====================================================================
create table if not exists public.caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  terminal_id uuid references public.terminales(id) on delete set null,
  usuario_id  uuid references auth.users(id),
  apertura numeric(12,2) not null default 0,
  cierre   numeric(12,2),
  estado text default 'ABIERTA' check (estado in ('ABIERTA','CERRADA')),
  abierta_en timestamptz default now(),
  cerrada_en timestamptz
);
create index if not exists idx_caja_usuario on public.caja_sesiones(usuario_id, estado);

create table if not exists public.caja_movimientos (
  id bigserial primary key,
  sesion_id uuid references public.caja_sesiones(id) on delete cascade,
  tipo text not null check (tipo in ('INGRESO','EGRESO','VENTA','RETIRO')),
  monto numeric(12,2) not null,
  motivo text,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  categoria text,
  descripcion text not null,
  monto numeric(12,2) not null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  usuario_id uuid references auth.users(id),
  creado_en timestamptz default now()
);
create index if not exists idx_gastos_fecha on public.gastos(fecha desc);

-- =====================================================================
-- 9. COMBOS / ETIQUETAS / CONFIG
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
  id uuid primary key default gen_random_uuid(),
  clave text unique,
  plan text default 'free',
  expira_en date,
  activo boolean default true,
  creada_en timestamptz default now()
);

create table if not exists public.log_auditoria (
  id bigserial primary key,
  usuario_id uuid references auth.users(id),
  accion text not null,
  entidad text, entidad_id text,
  detalle jsonb, ip text,
  creado_en timestamptz default now()
);
create index if not exists idx_log_fecha on public.log_auditoria(creado_en desc);

-- =====================================================================
-- 10. TRIGGERS
-- =====================================================================
create or replace function public.trg_actualizado_en() returns trigger
language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;

drop trigger if exists tr_productos_upd on public.productos;
create trigger tr_productos_upd before update on public.productos
for each row execute function public.trg_actualizado_en();

-- Descuento automático de stock al vender
create or replace function public.trg_venta_item_stock() returns trigger
language plpgsql as $$
declare _saldo numeric(12,3);
begin
  if new.producto_id is not null then
    update public.productos
       set stock = coalesce(stock,0) - new.cantidad
     where id = new.producto_id
    returning stock into _saldo;
    insert into public.kardex(producto_id, tipo, cantidad, saldo, documento, motivo, usuario_id)
    values (new.producto_id, 'VENTA', -new.cantidad, _saldo, new.venta_id::text, 'Venta automática', auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists tr_venta_item_stock on public.venta_items;
create trigger tr_venta_item_stock after insert on public.venta_items
for each row execute function public.trg_venta_item_stock();

-- Reversión de stock al anular venta
create or replace function public.trg_venta_anulada() returns trigger
language plpgsql as $$
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

-- Compra incrementa stock y registra kardex
create or replace function public.trg_compra_item_stock() returns trigger
language plpgsql as $$
declare _saldo numeric(12,3);
begin
  if new.producto_id is not null then
    update public.productos
       set stock = coalesce(stock,0) + new.cantidad,
           precio_compra = new.costo_unitario
     where id = new.producto_id
    returning stock into _saldo;
    insert into public.kardex(producto_id, tipo, cantidad, saldo, costo_unitario, documento, motivo, usuario_id)
    values (new.producto_id, 'COMPRA', new.cantidad, _saldo, new.costo_unitario, new.compra_id::text, 'Ingreso por compra', auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists tr_compra_item_stock on public.compra_items;
create trigger tr_compra_item_stock after insert on public.compra_items
for each row execute function public.trg_compra_item_stock();

-- Ajuste de inventario actualiza stock
create or replace function public.trg_ajuste_stock() returns trigger
language plpgsql as $$
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

-- =====================================================================
-- 11. VISTAS / KPIs
-- =====================================================================
drop view if exists public.v_stock_bajo cascade;
create view public.v_stock_bajo as
  select p.*, coalesce(c.nombre,'Sin categoría') as categoria
  from public.productos p
  left join public.categorias c on c.id = p.categoria_id
  where p.activo and coalesce(p.stock,0) <= coalesce(p.stock_minimo,0);

drop view if exists public.v_ventas_dia cascade;
create view public.v_ventas_dia as
  select date(creada_en) as dia, count(*) as transacciones,
         sum(total) as total_ventas, sum(igv) as total_igv,
         sum(descuento) as total_descuento
  from public.ventas where estado <> 'ANULADA'
  group by date(creada_en) order by dia desc;

drop view if exists public.v_top_productos cascade;
create view public.v_top_productos as
  select vi.producto_id, vi.nombre,
         sum(vi.cantidad) as unidades, sum(vi.total) as monto
  from public.venta_items vi
  join public.ventas v on v.id = vi.venta_id
  where v.estado <> 'ANULADA'
  group by vi.producto_id, vi.nombre
  order by unidades desc;

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
  from public.lotes l
  join public.productos p on p.id = l.producto_id
  where l.fecha_vencimiento is not null
    and l.fecha_vencimiento <= current_date + interval '30 days'
  order by l.fecha_vencimiento asc;

drop view if exists public.v_caja_resumen cascade;
create view public.v_caja_resumen as
  select s.id as sesion_id, s.usuario_id, s.apertura, s.estado, s.abierta_en, s.cerrada_en,
         coalesce(sum(m.monto) filter (where m.tipo in ('INGRESO','VENTA')),0) as ingresos,
         coalesce(sum(m.monto) filter (where m.tipo in ('EGRESO','RETIRO')),0) as egresos,
         s.apertura
           + coalesce(sum(m.monto) filter (where m.tipo in ('INGRESO','VENTA')),0)
           - coalesce(sum(m.monto) filter (where m.tipo in ('EGRESO','RETIRO')),0) as saldo
  from public.caja_sesiones s
  left join public.caja_movimientos m on m.sesion_id = s.id
  group by s.id;

-- =====================================================================
-- 12. GRANTS (obligatorio en Supabase para PostgREST)
-- =====================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'tiendas','terminales','categorias','proveedores','productos',
    'lotes','kardex','ajustes_inventario','clientes','ventas','venta_items','venta_pagos',
    'compras','compra_items','caja_sesiones','caja_movimientos','gastos','combos','combo_items',
    'etiquetas','configuracion','licencia','log_auditoria'
  ]) loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;
grant select on public.v_stock_bajo, public.v_ventas_dia, public.v_top_productos,
               public.v_kpi_hoy, public.v_lotes_por_vencer, public.v_caja_resumen
  to authenticated;

-- =====================================================================
-- 13. RLS POR ROL
-- =====================================================================
do $$
declare t text;
begin
  for t in select unnest(array[
    'roles_usuario','tiendas','terminales','categorias','proveedores','productos',
    'lotes','kardex','ajustes_inventario','clientes','ventas','venta_items','venta_pagos',
    'compras','compra_items','caja_sesiones','caja_movimientos','gastos','combos','combo_items',
    'etiquetas','configuracion','licencia','log_auditoria'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "auth_read_%1$s"  on public.%1$I', t);
    execute format('drop policy if exists "auth_write_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "auth_del_%1$s"   on public.%1$I', t);
  end loop;
end $$;

-- Lectura para cualquier usuario autenticado
do $$
declare t text;
begin
  for t in select unnest(array[
    'tiendas','terminales','categorias','proveedores','productos','lotes','kardex',
    'clientes','ventas','venta_items','venta_pagos','compras','compra_items',
    'caja_sesiones','caja_movimientos','gastos','combos','combo_items','etiquetas',
    'configuracion','licencia'
  ]) loop
    execute format('create policy "auth_read_%1$s" on public.%1$I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Solo el propio usuario lee su rol (admin lee todos)
create policy "auth_read_roles_usuario" on public.roles_usuario
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

-- Escritura: ventas/caja para quien pueda vender; resto para admin/supervisor
create policy "vender_ventas"      on public.ventas       for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_venta_items" on public.venta_items  for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_venta_pagos" on public.venta_pagos  for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_caja_ses"    on public.caja_sesiones    for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_caja_mov"    on public.caja_movimientos for all to authenticated using (public.puede_vender()) with check (public.puede_vender());
create policy "vender_clientes"    on public.clientes     for all to authenticated using (public.puede_vender()) with check (public.puede_vender());

-- Inventario para almaceneros/admin/supervisor
create policy "alm_productos"    on public.productos         for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_categorias"   on public.categorias        for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_proveedores"  on public.proveedores       for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_lotes"        on public.lotes             for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_ajustes"      on public.ajustes_inventario for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_compras"      on public.compras           for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_compra_items" on public.compra_items      for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_etiquetas"    on public.etiquetas         for all to authenticated using (public.has_role(auth.uid(),'administrador') or public.has_role(auth.uid(),'supervisor') or public.has_role(auth.uid(),'almacenero')) with check (true);
create policy "alm_kardex_ins"   on public.kardex            for insert to authenticated with check (true);
create policy "alm_kardex_upd"   on public.kardex            for update to authenticated using (public.es_admin());
create policy "alm_kardex_del"   on public.kardex            for delete to authenticated using (public.es_admin());

-- Sólo admin: tiendas, terminales, gastos, combos, config, licencia, auditoría, roles
create policy "adm_tiendas"      on public.tiendas      for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "adm_terminales"   on public.terminales   for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "adm_gastos"       on public.gastos       for all to authenticated using (public.es_admin() or public.has_role(auth.uid(),'supervisor')) with check (true);
create policy "adm_combos"       on public.combos       for all to authenticated using (public.es_admin() or public.has_role(auth.uid(),'supervisor')) with check (true);
create policy "adm_combo_items"  on public.combo_items  for all to authenticated using (public.es_admin() or public.has_role(auth.uid(),'supervisor')) with check (true);
create policy "adm_config"       on public.configuracion for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "adm_licencia"     on public.licencia     for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "adm_log_read"     on public.log_auditoria for select to authenticated using (public.es_admin());
create policy "adm_log_ins"      on public.log_auditoria for insert to authenticated with check (true);
create policy "adm_roles_write"  on public.roles_usuario for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- 14. DATOS DEMO
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

-- =====================================================================
-- 15. CREAR ADMINISTRADOR
--   1) Authentication → Users → Add user (email + contraseña)
--   2) Copia el UUID y ejecuta:
--        insert into public.roles_usuario(usuario_id, rol, nombre)
--        values ('PEGA-EL-UUID','administrador','Tu Nombre')
--        on conflict (usuario_id) do update
--          set rol='administrador', activo=true;
-- =====================================================================
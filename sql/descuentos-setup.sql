-- ============================================================
-- MÓDULO DE DESCUENTOS — Script completo
-- Pegar y ejecutar en Supabase → SQL Editor
-- Es idempotente: se puede correr varias veces sin romper nada.
-- ============================================================

-- 1) Columnas de descuento en ventas / venta_items -------------
alter table public.ventas
  add column if not exists descuento numeric(12,2) not null default 0;

alter table public.venta_items
  add column if not exists descuento numeric(12,2) not null default 0;

-- 2) Tabla de auditoría de descuentos --------------------------
create table if not exists public.descuentos_auditoria (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid null references public.ventas(id) on delete cascade,
  usuario_id uuid null,
  autorizado_por text null,
  tipo text not null check (tipo in ('porcentaje','monto')),
  aplicado_a text not null check (aplicado_a in ('total','producto')),
  producto_id uuid null references public.productos(id) on delete set null,
  valor numeric(12,2) not null,
  monto_descuento numeric(12,2) not null,
  motivo text not null,
  motivo_texto text null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_descuentos_auditoria_venta
  on public.descuentos_auditoria(venta_id);
create index if not exists idx_descuentos_auditoria_fecha
  on public.descuentos_auditoria(creado_en desc);
create index if not exists idx_descuentos_auditoria_usuario
  on public.descuentos_auditoria(usuario_id);

-- 3) Permisos (obligatorio: PostgREST no los da por defecto) ----
grant select, insert on public.descuentos_auditoria to authenticated;
grant all on public.descuentos_auditoria to service_role;

-- 4) RLS --------------------------------------------------------
alter table public.descuentos_auditoria enable row level security;

drop policy if exists "descuentos_ins" on public.descuentos_auditoria;
create policy "descuentos_ins" on public.descuentos_auditoria
  for insert to authenticated with check (true);

drop policy if exists "descuentos_sel" on public.descuentos_auditoria;
create policy "descuentos_sel" on public.descuentos_auditoria
  for select to authenticated using (true);

-- 5) Verificación rápida ----------------------------------------
-- select count(*) from public.descuentos_auditoria;
-- select id, fecha, total, descuento from public.ventas where descuento > 0 order by fecha desc limit 20;
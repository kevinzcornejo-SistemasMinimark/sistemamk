-- Auditoría de descuentos aplicados en el POS
-- Ejecutar en Supabase → SQL Editor

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

create index if not exists idx_descuentos_auditoria_venta on public.descuentos_auditoria(venta_id);
create index if not exists idx_descuentos_auditoria_fecha on public.descuentos_auditoria(creado_en desc);
create index if not exists idx_descuentos_auditoria_usuario on public.descuentos_auditoria(usuario_id);

grant select, insert on public.descuentos_auditoria to authenticated;
grant all on public.descuentos_auditoria to service_role;

alter table public.descuentos_auditoria enable row level security;

drop policy if exists "descuentos_ins" on public.descuentos_auditoria;
create policy "descuentos_ins" on public.descuentos_auditoria
  for insert to authenticated with check (true);

drop policy if exists "descuentos_sel" on public.descuentos_auditoria;
create policy "descuentos_sel" on public.descuentos_auditoria
  for select to authenticated using (true);
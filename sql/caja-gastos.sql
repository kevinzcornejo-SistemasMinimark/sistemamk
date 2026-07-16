-- =====================================================================
-- CAJAS, MOVIMIENTOS DE CAJA Y GASTOS
-- Ejecuta este script una sola vez en el SQL Editor de Supabase.
-- =====================================================================

-- ------- CAJAS ---------------------------------------------------------
create sequence if not exists public.cajas_numero_seq;

create table if not exists public.cajas (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default nextval('public.cajas_numero_seq'),
  cajero_id uuid references auth.users(id) on delete set null,
  estado text not null default 'ABIERTA' check (estado in ('ABIERTA','CERRADA')),
  monto_apertura numeric(12,2) not null default 0,
  monto_cierre numeric(12,2),
  total_ventas numeric(12,2) not null default 0,
  abierta_en timestamptz not null default now(),
  cerrada_en timestamptz
);
alter sequence public.cajas_numero_seq owned by public.cajas.numero;

create index if not exists idx_cajas_cajero_estado on public.cajas(cajero_id, estado);
create index if not exists idx_cajas_abierta_en on public.cajas(abierta_en desc);

grant select, insert, update, delete on public.cajas to authenticated;
grant usage, select on sequence public.cajas_numero_seq to authenticated;
grant all on public.cajas to service_role;
grant all on sequence public.cajas_numero_seq to service_role;

alter table public.cajas enable row level security;
drop policy if exists "cajas_select" on public.cajas;
drop policy if exists "cajas_insert" on public.cajas;
drop policy if exists "cajas_update" on public.cajas;
create policy "cajas_select" on public.cajas for select to authenticated using (true);
create policy "cajas_insert" on public.cajas for insert to authenticated with check (auth.uid() = cajero_id);
create policy "cajas_update" on public.cajas for update to authenticated using (true) with check (true);

-- ------- MOVIMIENTOS DE CAJA ------------------------------------------
create table if not exists public.movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  caja_id uuid not null references public.cajas(id) on delete cascade,
  tipo text not null check (tipo in ('INGRESO','EGRESO','VENTA','RETIRO','GASTO')),
  metodo_pago text,
  monto numeric(12,2) not null,
  concepto text not null default '',
  usuario_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists idx_mov_caja on public.movimientos_caja(caja_id, creado_en desc);

grant select, insert, update, delete on public.movimientos_caja to authenticated;
grant all on public.movimientos_caja to service_role;

alter table public.movimientos_caja enable row level security;
drop policy if exists "mov_caja_all" on public.movimientos_caja;
create policy "mov_caja_all" on public.movimientos_caja for all to authenticated using (true) with check (true);

-- Trigger: actualiza total_ventas de la caja
create or replace function public.fn_caja_actualiza_total()
returns trigger language plpgsql as $$
begin
  if new.tipo = 'VENTA' then
    update public.cajas set total_ventas = total_ventas + new.monto where id = new.caja_id;
  elsif new.tipo = 'INGRESO' then
    update public.cajas set total_ventas = total_ventas + 0 where id = new.caja_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_caja_actualiza_total on public.movimientos_caja;
create trigger trg_caja_actualiza_total
after insert on public.movimientos_caja
for each row execute function public.fn_caja_actualiza_total();

-- ------- GASTOS --------------------------------------------------------
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
-- Compatibilidad con seed antiguo (descripcion) → concepto
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='gastos' and column_name='descripcion')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gastos' and column_name='concepto') then
    alter table public.gastos rename column descripcion to concepto;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gastos' and column_name='metodo_pago') then
    alter table public.gastos add column metodo_pago text not null default 'EFECTIVO';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='gastos' and column_name='numero_documento') then
    alter table public.gastos add column numero_documento text;
  end if;
end $$;

create index if not exists idx_gastos_fecha on public.gastos(fecha desc);

grant select, insert, update, delete on public.gastos to authenticated;
grant all on public.gastos to service_role;

alter table public.gastos enable row level security;
drop policy if exists "gastos_all" on public.gastos;
create policy "gastos_all" on public.gastos for all to authenticated using (true) with check (true);

-- =====================================================================
-- CAJA PRO — Extensiones al módulo de caja
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- =====================================================================

-- ------- CAJAS: columnas adicionales -----------------------------------
alter table public.cajas add column if not exists sucursal text default 'Principal';
alter table public.cajas add column if not exists turno text;
alter table public.cajas add column if not exists equipo text;
alter table public.cajas add column if not exists ip text;
alter table public.cajas add column if not exists observacion_apertura text;
alter table public.cajas add column if not exists observacion_cierre text;
alter table public.cajas add column if not exists monto_esperado numeric(12,2);
alter table public.cajas add column if not exists diferencia numeric(12,2);
alter table public.cajas add column if not exists arqueo jsonb;
alter table public.cajas add column if not exists total_ingresos numeric(12,2) not null default 0;
alter table public.cajas add column if not exists total_egresos numeric(12,2) not null default 0;
alter table public.cajas add column if not exists total_retiros numeric(12,2) not null default 0;

-- Constraint de turno (tolerante a nulos y valores libres previos)
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'cajas_turno_check') then
    alter table public.cajas drop constraint cajas_turno_check;
  end if;
end $$;
alter table public.cajas add constraint cajas_turno_check
  check (turno is null or turno in ('MANANA','TARDE','NOCHE'));

-- ------- MOVIMIENTOS_CAJA: columnas adicionales -----------------------
alter table public.movimientos_caja add column if not exists saldo numeric(12,2);
alter table public.movimientos_caja add column if not exists documento text;
alter table public.movimientos_caja add column if not exists referencia text;

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'movimientos_caja_tipo_check') then
    alter table public.movimientos_caja drop constraint movimientos_caja_tipo_check;
  end if;
end $$;
alter table public.movimientos_caja add constraint movimientos_caja_tipo_check
  check (tipo in ('APERTURA','INGRESO','EGRESO','VENTA','RETIRO','GASTO','ANULACION','DEVOLUCION','AJUSTE','CIERRE'));

-- ------- Trigger: saldo corrido + totales por caja --------------------
create or replace function public.fn_caja_movimiento()
returns trigger language plpgsql as $$
declare
  v_prev numeric(12,2);
  v_sign int;
begin
  select saldo into v_prev
    from public.movimientos_caja
    where caja_id = new.caja_id
    order by creado_en desc, id desc
    limit 1;
  if v_prev is null then
    select coalesce(monto_apertura,0) into v_prev from public.cajas where id = new.caja_id;
  end if;

  v_sign := case
    when new.tipo in ('INGRESO','VENTA','DEVOLUCION','APERTURA') then 1
    when new.tipo in ('EGRESO','GASTO','RETIRO','ANULACION') then -1
    else 0
  end;
  new.saldo := coalesce(v_prev,0) + (v_sign * coalesce(new.monto,0));
  return new;
end $$;

drop trigger if exists trg_caja_actualiza_total on public.movimientos_caja;
drop trigger if exists trg_caja_saldo on public.movimientos_caja;
create trigger trg_caja_saldo
before insert on public.movimientos_caja
for each row execute function public.fn_caja_movimiento();

-- Acumular totales por caja después del insert
create or replace function public.fn_caja_acumula()
returns trigger language plpgsql as $$
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
create trigger trg_caja_acumula
after insert on public.movimientos_caja
for each row execute function public.fn_caja_acumula();

-- Índices útiles
create index if not exists idx_mov_caja_tipo on public.movimientos_caja(caja_id, tipo);
create index if not exists idx_mov_caja_metodo on public.movimientos_caja(caja_id, metodo_pago);

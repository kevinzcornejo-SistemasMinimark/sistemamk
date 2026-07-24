-- Permitir turno DIA (turno único por defecto). Mantiene compatibilidad con MANANA/TARDE/NOCHE
-- para cuando en el futuro se habiliten múltiples turnos.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'cajas_turno_check') then
    alter table public.cajas drop constraint cajas_turno_check;
  end if;
end $$;

alter table public.cajas add constraint cajas_turno_check
  check (turno is null or turno in ('DIA','MANANA','TARDE','NOCHE'));

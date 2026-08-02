-- =====================================================================
-- SERVICIOS DEL POS: Recarga Celular, Pago de Servicio, Bolsa Plástica
-- Ejecutar UNA VEZ en el SQL Editor de Supabase (idempotente).
-- =====================================================================

-- Marca productos que no controlan stock (servicios)
alter table public.productos add column if not exists es_servicio boolean not null default false;

-- Productos "virtuales" usados por los accesos rápidos del POS.
-- activo = false para que NO aparezcan en la grilla de productos.
insert into public.productos (codigo_barras, nombre, unidad, precio_venta, precio_compra, stock, stock_minimo, afecto_igv, activo, es_servicio)
values
  ('SERV-RECARGA', 'Recarga Celular',  'UND', 0,   0, 999999, 0, false, false, true),
  ('SERV-PAGO',    'Pago de Servicio', 'UND', 0,   0, 999999, 0, false, false, true),
  ('SERV-BOLSA',   'Bolsa Plástica',   'UND', 0.30,0, 999999, 0, true,  false, true)
on conflict (codigo_barras) do update
  set nombre = excluded.nombre,
      es_servicio = true,
      stock = 999999,
      activo = false;

-- =========================================================
-- Quita el trigger que descontaba stock al insertar venta_items.
-- El descuento ahora lo hace la RPC public.descontar_stock_venta
-- (FIFO por lotes) desde el frontend. Dejar ambos causaba que
-- vender 1 unidad restara 2 al stock.
-- =========================================================

drop trigger if exists tr_venta_item_stock on public.venta_items;
drop function  if exists public.trg_venta_item_stock() cascade;

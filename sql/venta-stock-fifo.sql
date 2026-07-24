-- =========================================================
-- Descuento de stock atómico al vender (FIFO por vencimiento)
-- Uso: SELECT public.descontar_stock_venta(p_producto uuid, p_cantidad numeric);
-- - Descuenta productos.stock
-- - Descuenta lotes.cantidad_actual en orden FIFO (vence más pronto primero),
--   ignorando lotes bloqueados o sin stock.
-- - Devuelve el nuevo stock del producto.
-- =========================================================

create or replace function public.descontar_stock_venta(
  p_producto uuid,
  p_cantidad numeric
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restante numeric := p_cantidad;
  v_nuevo numeric;
  r record;
  v_tomar numeric;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    select stock into v_nuevo from public.productos where id = p_producto;
    return v_nuevo;
  end if;

  -- 1) Descontar de lotes FIFO (si existen)
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='lotes'
  ) then
    for r in
      select id, cantidad_actual
      from public.lotes
      where producto_id = p_producto
        and coalesce(bloqueado,false) = false
        and coalesce(cantidad_actual,0) > 0
      order by fecha_vencimiento asc nulls last, creado_en asc
      for update
    loop
      exit when v_restante <= 0;
      v_tomar := least(r.cantidad_actual, v_restante);
      update public.lotes
         set cantidad_actual = cantidad_actual - v_tomar
       where id = r.id;
      v_restante := v_restante - v_tomar;
    end loop;
  end if;

  -- 2) Descontar el total del stock del producto (aunque no haya lotes)
  update public.productos
     set stock = greatest(0, coalesce(stock,0) - p_cantidad),
         actualizado_en = now()
   where id = p_producto
  returning stock into v_nuevo;

  return v_nuevo;
end;
$$;

revoke all on function public.descontar_stock_venta(uuid, numeric) from public;
grant execute on function public.descontar_stock_venta(uuid, numeric) to authenticated, service_role;

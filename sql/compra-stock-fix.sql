-- =========================================================
-- FIX: la compra no aumentaba el stock
-- Causa: el trigger tr_compra_item_stock actualiza public.productos
--        SIN security definer, por lo que RLS lo bloquea silenciosamente
--        (0 filas) cuando el usuario no es administrador/supervisor/almacenero.
-- Solución: una única RPC security definer que suma el stock, actualiza el
--        costo y registra kardex. Se elimina el trigger para no duplicar.
-- Ejecutar en Supabase → SQL Editor.
-- =========================================================

drop trigger if exists tr_compra_item_stock on public.compra_items;
drop function if exists public.trg_compra_item_stock() cascade;

create or replace function public.aumentar_stock_compra(
  p_producto uuid,
  p_cantidad numeric,
  p_costo    numeric default null,
  p_documento text default null,
  p_motivo    text default 'Ingreso por compra'
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo numeric;
begin
  if p_producto is null or p_cantidad is null or p_cantidad <= 0 then
    select stock into v_nuevo from public.productos where id = p_producto;
    return v_nuevo;
  end if;

  update public.productos
     set stock = coalesce(stock,0) + p_cantidad,
         precio_compra = case when coalesce(p_costo,0) > 0 then p_costo else precio_compra end,
         actualizado_en = now()
   where id = p_producto
  returning stock into v_nuevo;

  if v_nuevo is null then
    raise exception 'Producto % no existe', p_producto;
  end if;

  insert into public.kardex(producto_id, tipo, cantidad, saldo, costo_unitario, documento, motivo, usuario_id)
  values (p_producto, 'COMPRA', p_cantidad, v_nuevo, p_costo, p_documento, p_motivo, auth.uid());

  return v_nuevo;
end;
$$;

revoke all on function public.aumentar_stock_compra(uuid, numeric, numeric, text, text) from public;
grant execute on function public.aumentar_stock_compra(uuid, numeric, numeric, text, text) to authenticated, service_role;

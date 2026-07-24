import { supabase } from "@/integrations/supabase/client";
import type { CartItem, DescuentoInfo } from "@/hooks/usePOSCart";

export type RegistrarVentaInput = {
  items: CartItem[];
  tipo_comprobante: "BOLETA" | "FACTURA" | "TICKET";
  serie: string;
  cliente_id?: string | null;
  pagos: { metodo: string; monto: number; referencia?: string }[];
  subtotal: number;
  igv: number;
  total: number;
  cajero_id?: string | null;
  caja_id?: string | null;
  observaciones?: string;
  descuento_info?: DescuentoInfo | null;
};

export async function registrarVenta(input: RegistrarVentaInput) {
  const metodo_pago =
    input.pagos.length > 1
      ? "MIXTO"
      : (input.pagos[0]?.metodo ?? "EFECTIVO");
  const recibido = input.pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const vuelto = Math.max(0, recibido - input.total);

  const { data: venta, error: vErr } = await supabase
    .from("ventas")
    .insert({
      tipo_comprobante: input.tipo_comprobante,
      serie: input.serie,
      cliente_id: input.cliente_id ?? null,
      cajero_id: input.cajero_id ?? null,
      subtotal: input.subtotal,
      descuento: input.descuento_info?.montoDescuento ?? 0,
      igv: input.igv,
      total: input.total,
      metodo_pago: metodo_pago as any,
      monto_recibido: recibido,
      vuelto,
      estado: "PAGADA" as any,
      observaciones: input.observaciones ?? null,
    })
    .select("id, serie, correlativo")
    .single();
  if (vErr || !venta) throw vErr ?? new Error("No se pudo crear la venta");

  // Auditoría de descuento (best-effort — no rompe la venta si falla)
  if (input.descuento_info && input.descuento_info.montoDescuento > 0) {
    try {
      await supabase.from("descuentos_auditoria").insert({
        venta_id: venta.id,
        usuario_id: input.cajero_id ?? null,
        tipo: input.descuento_info.tipo,
        aplicado_a: input.descuento_info.aplicadoA,
        producto_id: input.descuento_info.productoId ?? null,
        valor: input.descuento_info.valor,
        monto_descuento: input.descuento_info.montoDescuento,
        motivo:
          input.descuento_info.motivo === "Otro"
            ? (input.descuento_info.motivoTexto ?? "Otro")
            : input.descuento_info.motivo,
        motivo_texto: input.descuento_info.motivoTexto ?? null,
        autorizado_por: input.descuento_info.autorizadoPor ?? null,
      });
    } catch (e) {
      // Ignorar si la tabla no existe todavía
      console.warn("No se pudo registrar auditoría de descuento:", e);
    }
  }

  const detalle = input.items.map((i) => {
    const lineaTotal = i.producto.precio_venta * i.cantidad - i.descuento;
    const igv = i.producto.igv ? lineaTotal - lineaTotal / 1.18 : 0;
    return {
      venta_id: venta.id,
      producto_id: i.producto.id,
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio_unitario: i.producto.precio_venta,
      descuento: i.descuento,
      subtotal: lineaTotal - igv,
      igv,
      total: lineaTotal,
    };
  });

  const { error: dErr } = await supabase.from("venta_items").insert(detalle);
  if (dErr) throw dErr;

  const pagos = input.pagos.map((p) => ({
    venta_id: venta.id,
    metodo: p.metodo,
    monto: p.monto,
    referencia: p.referencia ?? null,
  }));
  const { error: pErr } = await supabase.from("venta_pagos").insert(pagos);
  if (pErr) throw pErr;

  // Descontar stock (FIFO por lotes) y registrar kardex
  const movimientos: any[] = [];
  const erroresStock: string[] = [];
  for (const i of input.items) {
    const { data: nuevoStock, error: rpcErr } = await supabase.rpc(
      "descontar_stock_venta",
      { p_producto: i.producto.id, p_cantidad: i.cantidad },
    );
    if (rpcErr) {
      // Fallback: descuento directo si la función aún no existe en la BD
      const stockActual = Number(i.producto.stock ?? 0);
      const fallback = Math.max(0, stockActual - Number(i.cantidad ?? 0));
      const { error: upErr } = await supabase
        .from("productos")
        .update({ stock: fallback })
        .eq("id", i.producto.id);
      if (upErr) {
        erroresStock.push(`${i.producto.nombre}: ${upErr.message}`);
        continue;
      }
      movimientos.push({
        producto_id: i.producto.id,
        tipo: "VENTA",
        cantidad: -i.cantidad,
        saldo: fallback,
        costo_unitario: i.producto.precio_compra ?? null,
        documento: `${venta.serie}-${venta.correlativo ?? ""}`,
        motivo: `Venta ${venta.id.slice(0, 8)}`,
        usuario_id: input.cajero_id ?? null,
      });
      continue;
    }
    movimientos.push({
      producto_id: i.producto.id,
      tipo: "VENTA",
      cantidad: -i.cantidad,
      saldo: Number(nuevoStock ?? 0),
      costo_unitario: i.producto.precio_compra ?? null,
      documento: `${venta.serie}-${venta.correlativo ?? ""}`,
      motivo: `Venta ${venta.id.slice(0, 8)}`,
      usuario_id: input.cajero_id ?? null,
    });
  }
  if (movimientos.length > 0) {
    await supabase.from("kardex").insert(movimientos);
  }
  if (erroresStock.length > 0) {
    throw new Error(`No se pudo actualizar el stock: ${erroresStock.join("; ")}`);
  }


  // Registrar movimientos de caja (uno por método de pago)
  if (input.caja_id) {
    const doc = `${venta.serie}-${String(venta.correlativo ?? "").padStart(8, "0")}`;
    const movCaja = input.pagos.map((p) => ({
      caja_id: input.caja_id,
      tipo: "VENTA",
      metodo_pago: p.metodo,
      monto: p.monto,
      concepto: `Venta ${doc}`,
      documento: doc,
      referencia: p.referencia ?? null,
      usuario_id: input.cajero_id ?? null,
    }));
    if (movCaja.length > 0) {
      await supabase.from("movimientos_caja").insert(movCaja);
    }
  }

  return venta;
}

import { supabase } from "@/integrations/supabase/client";
import type { CartItem } from "@/hooks/usePOSCart";

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
  observaciones?: string;
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
      descuento: 0,
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

  // Descontar stock y registrar kardex
  const movimientos: any[] = [];
  await Promise.all(
    input.items.map(async (i) => {
      const stockActual = Number(i.producto.stock ?? 0);
      const nuevoStock = stockActual - Number(i.cantidad ?? 0);
      const { error: upErr } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", i.producto.id);
      if (upErr) return;
      movimientos.push({
        producto_id: i.producto.id,
        tipo: "VENTA",
        cantidad: -i.cantidad,
        saldo: nuevoStock,
        costo_unitario: i.producto.precio_compra ?? null,
        documento: `${venta.serie}-${venta.correlativo ?? ""}`,
        motivo: `Venta ${venta.id.slice(0, 8)}`,
        usuario_id: input.cajero_id ?? null,
      });
    }),
  );
  if (movimientos.length > 0) {
    await supabase.from("kardex").insert(movimientos);
  }

  return venta;
}

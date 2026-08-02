import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MockProducto } from "@/data/mockData";

export const SERVICIO_CODES = {
  recarga: "SERV-RECARGA",
  pago: "SERV-PAGO",
  bolsa: "SERV-BOLSA",
} as const;

export type ServicioKey = keyof typeof SERVICIO_CODES;

const DEFAULTS: Record<ServicioKey, { nombre: string; precio: number; igv: boolean }> = {
  recarga: { nombre: "Recarga Celular", precio: 0, igv: false },
  pago: { nombre: "Pago de Servicio", precio: 0, igv: false },
  bolsa: { nombre: "Bolsa Plástica", precio: 0.3, igv: true },
};

function virtual(key: ServicioKey): MockProducto {
  const d = DEFAULTS[key];
  return {
    id: `virtual-${SERVICIO_CODES[key]}`,
    codigo_barras: SERVICIO_CODES[key],
    nombre: d.nombre,
    precio_venta: d.precio,
    precio_compra: 0,
    stock: 999999,
    stock_minimo: 0,
    unidad: "UND",
    categoria_id: "",
    igv: d.igv,
    es_servicio: true,
  };
}

/**
 * Carga los "productos de servicio" (recarga, pago de servicio, bolsa) que
 * respaldan los accesos rápidos del POS. Si no existen en la base de datos
 * devuelve versiones virtuales (modo demo) y marca `disponible = false`.
 */
export function useServiciosPOS(enabled: boolean) {
  const [servicios, setServicios] = useState<Record<ServicioKey, MockProducto>>({
    recarga: virtual("recarga"),
    pago: virtual("pago"),
    bolsa: virtual("bolsa"),
  });
  const [disponible, setDisponible] = useState(false);

  const cargar = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase
      .from("productos")
      .select("id,codigo_barras,nombre,precio_venta,unidad,afecto_igv")
      .in("codigo_barras", Object.values(SERVICIO_CODES));
    if (error || !data?.length) {
      setDisponible(false);
      return;
    }
    const next = { ...servicios };
    let count = 0;
    (Object.keys(SERVICIO_CODES) as ServicioKey[]).forEach((key) => {
      const row = data.find((r: any) => r.codigo_barras === SERVICIO_CODES[key]);
      if (!row) return;
      count++;
      next[key] = {
        ...virtual(key),
        id: row.id,
        nombre: row.nombre ?? DEFAULTS[key].nombre,
        precio_venta: Number(row.precio_venta ?? DEFAULTS[key].precio),
        igv: !!row.afecto_igv,
      };
    });
    setServicios(next);
    setDisponible(count === 3);
  }, [enabled]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { servicios, disponible, recargar: cargar };
}

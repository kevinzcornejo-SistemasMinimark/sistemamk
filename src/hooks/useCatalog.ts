import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  mockCategorias,
  mockProductos,
  type MockCategoria,
  type MockProducto,
} from "@/data/mockData";

function mapProducto(p: any): MockProducto {
  return {
    id: p.id,
    codigo_barras: p.codigo_barras ?? "",
    nombre: p.nombre,
    precio_venta: Number(p.precio_venta ?? 0),
    precio_compra: Number(p.precio_compra ?? 0),
    stock: Number(p.stock ?? 0),
    stock_minimo: Number(p.stock_minimo ?? 0),
    unidad: String(p.unidad ?? "UNIDAD").slice(0, 3),
    categoria_id: p.categoria_id ?? "",
    igv: !!p.afecto_igv,
    imagen: p.imagen_url ?? undefined,
  };
}

function mapCategoria(c: any): MockCategoria {
  return {
    id: c.id,
    nombre: c.nombre,
    icono: c.icono ?? "Box",
    color: c.color ?? "#3B82F6",
  };
}

export function useCatalog() {
  const { isDemo, user } = useAuth();
  const [productos, setProductos] = useState<MockProducto[]>(
    isDemo ? mockProductos : [],
  );
  const [categorias, setCategorias] = useState<MockCategoria[]>(
    isDemo ? mockCategorias : [],
  );
  const [loading, setLoading] = useState(!isDemo);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancel = false;
    if (isDemo) {
      setProductos(mockProductos);
      setCategorias(mockCategorias);
      setLoading(false);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase
          .from("categorias")
          .select("id,nombre,icono,color,orden,activa")
          .eq("activa", true)
          .order("orden", { ascending: true }),
        supabase
          .from("productos")
          .select(
            "id,codigo_barras,nombre,precio_venta,precio_compra,stock,stock_minimo,unidad,categoria_id,afecto_igv,imagen_url,activo",
          )
          .eq("activo", true)
          .order("nombre", { ascending: true }),
      ]);
      if (cancel) return;
      setCategorias((cats ?? []).map(mapCategoria));
      setProductos((prods ?? []).map(mapProducto));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [isDemo, user?.id, tick]);

  return { productos, categorias, loading, refresh };
}
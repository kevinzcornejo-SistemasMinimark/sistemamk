import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CajaAbierta = {
  id: string;
  numero: number;
  cajero_id: string | null;
  estado: string;
  monto_apertura: number;
  total_ventas: number;
  total_ingresos: number;
  total_egresos: number;
  total_retiros: number;
  abierta_en: string;
  sucursal: string | null;
  turno: string | null;
  equipo: string | null;
};

export function useCajaAbierta(userId?: string | null) {
  const [caja, setCaja] = useState<CajaAbierta | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setCaja(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("cajas")
      .select("*")
      .eq("cajero_id", userId)
      .eq("estado", "ABIERTA")
      .order("abierta_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCaja((data as any) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { caja, loading, reload };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LicenciaEstado = "activa" | "vencida" | "suspendida" | "sin_licencia";

export function useLicencia() {
  const [lic, setLic] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.from("licencia").select("*").limit(1).maybeSingle();
      if (cancel) return;
      setLic(data);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const hoyStr = new Date().toISOString().slice(0, 10);
  const vencStr: string | null = lic?.fecha_vencimiento
    ? String(lic.fecha_vencimiento).slice(0, 10)
    : null;
  const vencidaPorFecha = vencStr ? vencStr < hoyStr : false;
  const vencida = vencidaPorFecha || lic?.estado === "vencida";
  const suspendida = lic?.estado === "suspendida";
  const sinLicencia = !loading && !lic;
  const bloqueada = !loading && (suspendida || vencida || sinLicencia);

  const estado: LicenciaEstado = sinLicencia
    ? "sin_licencia"
    : suspendida
      ? "suspendida"
      : vencida
        ? "vencida"
        : "activa";

  return { licencia: lic, loading, bloqueada, estado, vencida, suspendida, sinLicencia };
}

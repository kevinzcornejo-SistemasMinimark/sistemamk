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

  const hoy = new Date();
  const venc = lic?.fecha_vencimiento ? new Date(lic.fecha_vencimiento) : null;
  const vencida = venc ? venc.getTime() < new Date(hoy.toDateString()).getTime() : false;
  const suspendida = lic?.estado === "suspendida";
  const sinLicencia = !lic;
  const bloqueada = suspendida || vencida || sinLicencia;

  const estado: LicenciaEstado = sinLicencia
    ? "sin_licencia"
    : suspendida
      ? "suspendida"
      : vencida
        ? "vencida"
        : "activa";

  return { licencia: lic, loading, bloqueada, estado, vencida, suspendida, sinLicencia };
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mockBusiness } from "@/data/mockData";

export type BusinessInfo = {
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  logo: string;
  ticketLogo: string;
};

const KEYS = [
  "negocio_nombre",
  "negocio_ruc",
  "negocio_direccion",
  "negocio_telefono",
  "negocio_logo_url",
  "ticket_logo_url",
];

function build(map: Record<string, string>): BusinessInfo {
  return {
    nombre: map.negocio_nombre?.trim() || mockBusiness.nombre_comercial,
    ruc: map.negocio_ruc?.trim() || mockBusiness.ruc,
    direccion: map.negocio_direccion?.trim() || mockBusiness.direccion,
    telefono: map.negocio_telefono?.trim() || "",
    logo: map.negocio_logo_url?.trim() || "",
    ticketLogo: (map.ticket_logo_url || map.negocio_logo_url || "").trim(),
  };
}

export function useBusinessInfo() {
  const [info, setInfo] = useState<BusinessInfo>(() => build({}));

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("configuracion")
      .select("clave,valor")
      .in("clave", KEYS);
    const m: Record<string, string> = {};
    (data ?? []).forEach((r: any) => {
      m[r.clave] = r.valor ?? "";
    });
    setInfo(build(m));
  }, []);

  useEffect(() => {
    void load();
    const onUpd = () => void load();
    window.addEventListener("config-updated", onUpd);
    return () => window.removeEventListener("config-updated", onUpd);
  }, [load]);

  return info;
}

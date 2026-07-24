import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TEMAS: Record<string, string> = {
  naranja: "#F97316",
  azul: "#3B82F6",
  verde: "#10B981",
  purpura: "#8B5CF6",
  rojo: "#EF4444",
  teal: "#14B8A6",
};

const SIDEBARS: Record<string, string> = {
  oscuro: "#1F2937",
  negro: "#0B0B0B",
  azul_marino: "#1E3A8A",
  gris: "#475569",
};

function hexToOklch(hex: string): string {
  // Simple sRGB -> oklab (approx) -> oklch
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bo = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + Bo * Bo);
  let H = (Math.atan2(Bo, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
}

function applyTheme(cfg: Record<string, string>) {
  const temaId = cfg.tema_color;
  const hex = temaId === "personalizado" ? (cfg.tema_color_custom || "#F97316") : TEMAS[temaId];
  if (hex) {
    const c = hexToOklch(hex);
    document.documentElement.style.setProperty("--primary", c);
    document.documentElement.style.setProperty("--accent", c);
    document.documentElement.style.setProperty("--ring", c);
  }
  const sb = SIDEBARS[cfg.sidebar_color];
  if (sb) {
    document.documentElement.style.setProperty("--sidebar", hexToOklch(sb));
    document.documentElement.style.setProperty("--sidebar-foreground", "oklch(0.98 0 0)");
  }
}

export function useAppConfig() {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("configuracion").select("clave,valor");
    const m: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { m[r.clave] = r.valor ?? ""; });
    setCfg(m);
    applyTheme(m);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
    const onUpd = () => void load();
    window.addEventListener("config-updated", onUpd);
    return () => window.removeEventListener("config-updated", onUpd);
  }, [load]);

  return { cfg, loaded, reload: load, applyTheme };
}

export { applyTheme };

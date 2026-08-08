import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLicencia } from "@/hooks/useLicencia";

function diasEntre(vencStr: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(vencStr + "T00:00:00");
  const ms = venc.getTime() - hoy.getTime();
  return Math.ceil(ms / 86400000);
}

export function LicenseWidget({ collapsed }: { collapsed: boolean }) {
  const { licencia, loading, estado } = useLicencia();

  const vencStr: string | null = licencia?.fecha_vencimiento
    ? String(licencia.fecha_vencimiento).slice(0, 10)
    : null;

  const dias = vencStr ? diasEntre(vencStr) : null;

  let texto = "Sin licencia";
  if (loading) texto = "Licencia…";
  else if (estado === "suspendida") texto = "Suspendida";
  else if (estado === "vencida") texto = "Vencida";
  else if (dias !== null) texto = `Licencia: ${dias}d`;

  const critico = estado !== "activa" || (dias !== null && dias <= 15);
  const advertencia = !critico && dias !== null && dias <= 60;

  const color = critico
    ? "text-red-400 border-red-500/40 bg-red-500/10"
    : advertencia
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";

  const tooltip =
    estado === "activa" && dias !== null
      ? `Licencia vigente por ${dias} días (vence ${vencStr})`
      : texto;

  if (collapsed) {
    return (
      <div
        className={cn(
          "mb-2 mx-auto grid place-items-center h-8 w-8 rounded-md border",
          color,
        )}
        title={tooltip}
      >
        <KeyRound className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mb-2 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-semibold",
        color,
      )}
      title={tooltip}
    >
      <KeyRound className="h-4 w-4 shrink-0" />
      <span className="truncate">el recordatorio mejoralo</span>
    </div>
  );
}
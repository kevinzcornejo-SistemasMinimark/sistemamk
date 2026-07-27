import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "licencia_expira";
const INSTALL_KEY = "licencia_instalada";
const DIAS_LICENCIA = 1825; // 5 años por defecto

function diasRestantes(): number {
  try {
    let expira = localStorage.getItem(STORAGE_KEY);
    if (!expira) {
      let inst = localStorage.getItem(INSTALL_KEY);
      if (!inst) {
        inst = new Date().toISOString();
        localStorage.setItem(INSTALL_KEY, inst);
      }
      const d = new Date(inst);
      d.setDate(d.getDate() + DIAS_LICENCIA);
      expira = d.toISOString();
      localStorage.setItem(STORAGE_KEY, expira);
    }
    const ms = new Date(expira).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  } catch {
    return DIAS_LICENCIA;
  }
}

export function LicenseWidget({ collapsed }: { collapsed: boolean }) {
  const [dias, setDias] = useState<number>(0);

  useEffect(() => {
    setDias(diasRestantes());
    const id = setInterval(() => setDias(diasRestantes()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const critico = dias <= 15;
  const advertencia = !critico && dias <= 60;

  const color = critico
    ? "text-red-400 border-red-500/40 bg-red-500/10"
    : advertencia
      ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
      : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";

  if (collapsed) {
    return (
      <div
        className={cn(
          "mb-2 mx-auto grid place-items-center h-8 w-8 rounded-md border",
          color,
        )}
        title={`Licencia: ${dias} días`}
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
      title={`Licencia vigente por ${dias} días`}
    >
      <KeyRound className="h-4 w-4 shrink-0" />
      <span className="truncate">Licencia: {dias}d</span>
    </div>
  );
}
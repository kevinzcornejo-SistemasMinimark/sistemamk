import { AlertTriangle, Phone } from "lucide-react";
import type { LicenciaEstado } from "@/hooks/useLicencia";

export function LicenciaBloqueo({ estado }: { estado: LicenciaEstado }) {
  const titulo =
    estado === "suspendida" ? "Licencia SUSPENDIDA"
    : estado === "vencida" ? "Licencia VENCIDA"
    : "SIN LICENCIA ACTIVA";

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
      <div className="max-w-lg w-full rounded-2xl border-2 border-red-500/60 bg-red-50 p-8 shadow-xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
          <AlertTriangle className="w-9 h-9 text-red-600" />
        </div>
        <h2 className="text-2xl font-extrabold text-red-700 mb-2">{titulo}</h2>
        <p className="text-red-800/90 mb-5">
          No se pueden realizar ventas mientras la licencia no esté activa.
        </p>
        <div className="rounded-xl border border-red-300 bg-white p-4 text-left space-y-1">
          <div className="text-xs font-bold uppercase tracking-wider text-red-600">
            Contactar al creador del sistema
          </div>
          <div className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Phone className="w-5 h-5 text-red-600" /> Kevin — MG Solutions
          </div>
          <div className="text-sm text-muted-foreground">
            Solicita la renovación o activación de tu licencia para seguir vendiendo.
          </div>
        </div>
      </div>
    </div>
  );
}

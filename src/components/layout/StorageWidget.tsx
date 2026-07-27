import { useCallback, useEffect, useState } from "react";
import { HardDrive, Database, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const LIMITE_MB = 500; // Supabase free tier

type Info = {
  totalBytes: number;
  totalPretty: string;
  tablasBytes: number;
  tablasPretty: string;
};

function bytesToMB(b: number) {
  return b / (1024 * 1024);
}

export function StorageWidget({ collapsed }: { collapsed?: boolean }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("get_db_size");
    if (error) {
      setError(error.message);
    } else if (Array.isArray(data) && data.length > 0) {
      const r: any = data[0];
      setInfo({
        totalBytes: Number(r.total_bytes ?? 0),
        totalPretty: r.total_pretty ?? "—",
        tablasBytes: Number(r.tablas_bytes ?? 0),
        tablasPretty: r.tablas_pretty ?? "—",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usadoMB = info ? bytesToMB(info.totalBytes) : 0;
  const pct = Math.min(100, (usadoMB / LIMITE_MB) * 100);
  const critico = pct >= 90;
  const alto = pct >= 70;

  const barColor = critico
    ? "bg-destructive"
    : alto
      ? "bg-amber-500"
      : "bg-orange-500";

  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-full grid place-items-center py-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/80"
            title="Almacenamiento"
          >
            <HardDrive className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" className="w-80 p-0">
          <Detalle info={info} loading={loading} error={error} pct={pct} onReload={load} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full rounded-lg bg-sidebar-accent/40 hover:bg-sidebar-accent px-3 py-2 text-left transition-colors">
          <div className="flex items-center gap-2 text-sidebar-foreground">
            <HardDrive className="h-4 w-4" />
            <span className="text-sm font-semibold flex-1">Almacenamiento</span>
            <span className="text-[10px] text-sidebar-foreground/60">
              {info ? `${usadoMB.toFixed(1)}MB` : "…"}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-sidebar-foreground/10 overflow-hidden">
            <div
              className={cn("h-full transition-all", barColor)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <Detalle info={info} loading={loading} error={error} pct={pct} onReload={load} />
      </PopoverContent>
    </Popover>
  );
}

function Detalle({
  info,
  loading,
  error,
  pct,
  onReload,
}: {
  info: Info | null;
  loading: boolean;
  error: string | null;
  pct: number;
  onReload: () => void;
}) {
  const usadoMB = info ? bytesToMB(info.totalBytes) : 0;
  const critico = pct >= 90;
  const alto = pct >= 70;
  const estado = critico
    ? { label: "Almacenamiento crítico", desc: "Libera espacio o amplía tu plan.", icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" }
    : alto
      ? { label: "Almacenamiento alto", desc: "Considera revisar tus datos.", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-500/10" }
      : { label: "Almacenamiento disponible", desc: "Tu base de datos tiene espacio suficiente.", icon: CheckCircle2, color: "text-orange-600", bg: "bg-orange-500/10" };
  const Icon = estado.icon;

  return (
    <div className="p-4 space-y-3">
      <div className={cn("flex gap-3 p-3 rounded-lg", estado.bg)}>
        <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", estado.color)} />
        <div>
          <div className={cn("font-bold text-sm", estado.color)}>{estado.label}</div>
          <div className="text-xs text-muted-foreground">{estado.desc}</div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
          {error}. Ejecuta <code className="font-mono">sql/db-size.sql</code> en Supabase.
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Almacenamiento usado</span>
          <span className="font-bold">
            {info ? `${usadoMB.toFixed(1)} MB` : "—"} de {LIMITE_MB} MB
          </span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{pct.toFixed(1)}% usado</span>
          <span>Límite: {LIMITE_MB} MB</span>
        </div>
      </div>

      <div className="flex gap-2 p-2.5 rounded-lg border bg-muted/40">
        <Database className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Base de datos PostgreSQL.</span>{" "}
          Incluye tablas, índices y datos del sistema
          {info ? ` (tablas: ${info.tablasPretty})` : ""}.
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onReload}
        disabled={loading}
      >
        <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
        Actualizar información
      </Button>
    </div>
  );
}
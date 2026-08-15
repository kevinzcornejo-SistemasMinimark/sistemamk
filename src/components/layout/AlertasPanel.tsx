import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CalendarClock, 
  Package, 
  X, 
  Filter, 
  CheckCircle2, 
  RefreshCcw,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getNotificacionesAlertas, resolverNotificacion } from "@/lib/notificaciones.functions";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

interface AlertasPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AlertasPanel({ open, onClose }: AlertasPanelProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"todos" | "vencimiento" | "stock">("todos");
  
  const getAlerts = useServerFn(getNotificacionesAlertas);
  const markResolved = useServerFn(resolverNotificacion);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAlerts();
      setAlerts(res.alerts || []);
    } catch (error: any) {
      console.error("Error al cargar alertas:", error);
      toast.error("No se pudieron cargar las alertas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  const handleResolve = async (id: string) => {
    try {
      await markResolved({ data: { id } });
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success("Alerta marcada como gestionada");
    } catch (error) {
      toast.error("Error al gestionar alerta");
    }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === "todos") return true;
    return a.tipo === filter;
  });

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[400px] bg-background border-l shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-600 grid place-items-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">Alertas Críticas</h2>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mt-1">
                Gestión de riesgos e inventario
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Filtros */}
        <div className="p-3 border-b flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Button 
            variant={filter === "todos" ? "default" : "outline"} 
            size="sm" 
            className="h-8 rounded-full text-xs"
            onClick={() => setFilter("todos")}
          >
            <Filter className="h-3 w-3 mr-1" /> Todos
          </Button>
          <Button 
            variant={filter === "vencimiento" ? "default" : "outline"} 
            size="sm" 
            className="h-8 rounded-full text-xs"
            onClick={() => setFilter("vencimiento")}
          >
            <CalendarClock className="h-3 w-3 mr-1" /> Vencimiento
          </Button>
          <Button 
            variant={filter === "stock" ? "default" : "outline"} 
            size="sm" 
            className="h-8 rounded-full text-xs"
            onClick={() => setFilter("stock")}
          >
            <Package className="h-3 w-3 mr-1" /> Stock Mínimo
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full ml-auto"
            onClick={load}
            disabled={loading}
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {loading && alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <RefreshCcw className="h-8 w-8 animate-spin opacity-20" />
                <p className="text-sm">Buscando riesgos...</p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                <div className="h-12 w-12 rounded-full bg-muted grid place-items-center mb-4">
                  <CheckCircle2 className="h-6 w-6 opacity-40" />
                </div>
                <h3 className="font-semibold text-foreground">Todo en orden</h3>
                <p className="text-sm px-10">No hay alertas críticas que requieran atención inmediata.</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-xl border-l-4 transition-all hover:shadow-md border bg-card",
                    alert.urgenciaLabel === "Crítico" || alert.urgenciaLabel === "Vencido"
                      ? "border-l-rose-500 shadow-rose-500/5"
                      : "border-l-amber-500 shadow-amber-500/5"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] font-black uppercase px-2 py-0",
                        alert.tipo === "vencimiento" 
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      )}
                    >
                      {alert.tipo === "vencimiento" ? "Lote / Vencimiento" : "Stock / Inventario"}
                    </Badge>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                      alert.urgenciaLabel === "Crítico" || alert.urgenciaLabel === "Vencido"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    )}>
                      {alert.urgenciaLabel}
                    </span>
                  </div>
                  
                  <h4 className="font-bold text-sm leading-tight mb-1 text-foreground">
                    {alert.mensaje}
                  </h4>
                  
                  <div className="flex items-center justify-between mt-3 gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Stock: {alert.stock} {alert.unidad}
                      </div>
                      {alert.diasRestantes !== null && (
                        <div className={cn(
                          "text-[11px] font-bold flex items-center gap-1",
                          alert.diasRestantes <= 0 ? "text-rose-600" : "text-muted-foreground"
                        )}>
                          <CalendarClock className="h-3 w-3" />
                          {alert.diasRestantes <= 0 
                            ? "VENCIDO" 
                            : `${alert.diasRestantes} días`}
                        </div>
                      )}
                    </div>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-2 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          const id = alert.id.split("-")[1];
                          // Redirigir a detalle (si es stock, es producto; si es vencimiento, lote)
                          // Aquí simplemente navegamos al producto por ahora
                          window.location.href = `/detalle-producto/${id}`;
                        }}
                      >
                        VER DETALLE
                      </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        {/* Footer */}
        <div className="p-4 border-t bg-muted/10">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3 font-medium">
            <span>TOTAL ALERTAS ACTIVAS</span>
            <span className="font-bold text-foreground bg-muted px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          </div>
          <Button 
            variant="outline" 
            className="w-full h-10 font-bold text-xs rounded-xl"
            onClick={onClose}
          >
            CERRAR PANEL
          </Button>
        </div>
      </aside>
    </>
  );
}

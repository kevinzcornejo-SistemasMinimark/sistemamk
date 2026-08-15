import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  CalendarClock, 
  Package, 
  X, 
  Filter, 
  CheckCircle2, 
  RefreshCcw,
  AlertCircle,
  History,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getNotificacionesAlertas, resolverNotificacion } from "@/lib/notificaciones.functions";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPEN } from "@/lib/format";

interface AlertasPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AlertasPanel({ open, onClose }: AlertasPanelProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"todos" | "vencimiento" | "stock">("todos");
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("Ajuste de Stock");
  
  const getAlerts = useServerFn(getNotificacionesAlertas);
  const markResolved = useServerFn(resolverNotificacion);

  const loadDetails = async (alert: any) => {
    const id = alert.id.split("-")[1];
    setLoading(true);
    try {
      const { data: prod } = await supabase
        .from("productos")
        .select("*, categorias(nombre)")
        .eq("id", alert.tipo === 'stock' ? id : alert.producto_id)
        .single();
      
      const { data: movs } = await supabase
        .from("kardex")
        .select("*")
        .eq("producto_id", prod.id)
        .order("creado_en", { ascending: false })
        .limit(5);

      setDetails({ prod, movs });
      setSelectedAlert(alert);
    } catch (err) {
      toast.error("Error al cargar detalles");
    } finally {
      setLoading(false);
    }
  };

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

  const handleResolve = async () => {
    if (!resolvingId) return;
    try {
      await markResolved({ data: { id: resolvingId, motivo } });
      setAlerts(prev => prev.filter(a => a.id !== resolvingId));
      setResolvingId(null);
      setSelectedAlert(null);
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
                        onClick={(e) => {
                          e.stopPropagation();
                          loadDetails(alert);
                        }}
                      >
                        VER DETALLE
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-2 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResolvingId(alert.id);
                        }}
                      >
                        RESOLVER
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

      {/* Modal Detalle */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Detalle y Movimientos
            </DialogTitle>
          </DialogHeader>
          
          {details && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Producto</label>
                  <p className="font-bold">{details.prod.nombre}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">Stock Actual</label>
                  <p className="font-bold">{details.prod.stock} {details.prod.unidad}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Últimos Movimientos (Kardex)
                </h3>
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-bold">Fecha</th>
                        <th className="px-3 py-2 font-bold">Tipo</th>
                        <th className="px-3 py-2 font-bold text-right">Cant.</th>
                        <th className="px-3 py-2 font-bold">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.movs.map((m: any) => (
                        <tr key={m.id} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">{new Date(m.creado_en).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[9px] uppercase font-bold">{m.tipo}</Badge>
                          </td>
                          <td className={cn(
                            "px-3 py-2 text-right font-bold",
                            m.cantidad >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {m.cantidad >= 0 ? `+${m.cantidad}` : m.cantidad}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground italic">{m.motivo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAlert(null)}>Cerrar</Button>
            <Button 
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                setResolvingId(selectedAlert.id);
              }}
            >
              Resolver Alerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Resolver */}
      <Dialog open={!!resolvingId} onOpenChange={(open) => !open && setResolvingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Resuelta</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">Motivo de la resolución</label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ajuste de Stock">Ajuste de Stock</SelectItem>
                  <SelectItem value="Retiro de Producto">Retiro de Producto</SelectItem>
                  <SelectItem value="Aplicación de Descuento">Aplicación de Descuento</SelectItem>
                  <SelectItem value="Verificación de Lote">Verificación de Lote</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvingId(null)}>Cancelar</Button>
            <Button onClick={handleResolve}>Confirmar Resolución</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

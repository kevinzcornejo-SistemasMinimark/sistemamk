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
  TrendingUp,
  Settings,
  MapPin,
  ChevronDown,
  ChevronUp
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

interface AlertasPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AlertasPanel({ open, onClose }: AlertasPanelProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<"todos" | "vencimiento" | "stock">("todos");
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
      const res = await getAlerts({ data: {} });
      setAlerts(res.alerts || []);
    } catch (error: any) {
      console.error("Error al cargar alertas:", error);
      toast.error("No se pudieron cargar las alertas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
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
    if (filterType === "todos") return true;
    return a.tipo === filterType;
  });

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm transition-opacity" onClick={onClose} />}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[420px] bg-background border-l shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-600 grid place-items-center">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-none">Alertas Críticas</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-3 border-b flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Button variant={filterType === "todos" ? "default" : "outline"} size="sm" className="h-8 rounded-full text-xs" onClick={() => setFilterType("todos")}>
            <Filter className="h-3 w-3 mr-1" /> Todos
          </Button>
          <Button variant={filterType === "vencimiento" ? "default" : "outline"} size="sm" className="h-8 rounded-full text-xs" onClick={() => setFilterType("vencimiento")}>
            <CalendarClock className="h-3 w-3 mr-1" /> Vencimiento
          </Button>
          <Button variant={filterType === "stock" ? "default" : "outline"} size="sm" className="h-8 rounded-full text-xs" onClick={() => setFilterType("stock")}>
            <Package className="h-3 w-3 mr-1" /> Stock Mínimo
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className="p-3 rounded-xl border group border-l-4 border-l-rose-500">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="text-[10px] font-black">{alert.tipo}</Badge>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">{alert.urgenciaLabel}</span>
                </div>
                <h4 className="font-bold text-sm mb-2">{alert.mensaje}</h4>
                <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => loadDetails(alert)}>DETALLE</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setResolvingId(alert.id)}>RESOLVER</Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle</DialogTitle></DialogHeader>
          {details && (
            <div className="space-y-4">
              <p>Producto: {details.prod.nombre}</p>
              <div className="border rounded p-2 text-xs">
                {details.movs.map((m: any) => <div key={m.id}>{m.tipo} - {m.cantidad}</div>)}
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setSelectedAlert(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
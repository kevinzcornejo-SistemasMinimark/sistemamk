import { Menu, PanelLeftClose, LogOut, Wifi, WifiOff, Bell, BellDot, Package, Calendar, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotificacionesAlertas, resolverNotificacion } from "@/lib/notificaciones.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function Header({
  onToggleSidebar,
  onOpenMobile,
}: {
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}) {
  const { user, isDemo, role, signOut } = useAuth();
  const navigate = useNavigate();
  const biz = useBusinessInfo();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <header className="h-12 border-b bg-card/80 backdrop-blur flex items-center px-3 md:px-4 gap-2 sticky top-0 z-[100]">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobile}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={onToggleSidebar}
      >
        <PanelLeftClose className="h-5 w-5" />
      </Button>

      <div className="hidden sm:flex items-center gap-2">
        {biz.logo && (
          <img src={biz.logo} alt="logo" className="h-8 w-8 rounded object-cover" />
        )}
        <div>
          <div className="text-sm font-bold leading-tight">{biz.nombre}</div>
          <div className="text-[11px] text-muted-foreground">RUC {biz.ruc}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 hidden sm:inline-flex"
        >
          {online ? (
            <Wifi className="h-3 w-3 text-emerald-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-destructive" />
          )}
          {online ? "En línea" : "Sin conexión"}
        </Badge>
        {isDemo && (
          <Badge className="bg-accent text-accent-foreground">DEMO</Badge>
        )}
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {role ?? "—"}
        </Badge>

        <NotificacionesPopover />

        <div className="hidden md:block text-xs text-muted-foreground max-w-[160px] truncate">
          {user?.email ?? (isDemo ? "Modo demo" : "")}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
          title="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}

function NotificacionesPopover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAlerts = useServerFn(getNotificacionesAlertas);
  const markResolved = useServerFn(resolverNotificacion);

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["notificaciones-alertas"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60000 * 5,
  });

  const mutation = useMutation({
    mutationFn: (id: string) => markResolved({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaciones-alertas"] });
    },
  });

  const handleResolve = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    mutation.mutate(id);
  };

  const noLeidas = alerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 flex items-center justify-center">
          {noLeidas > 0 ? (
            <>
              <BellDot className="h-5 w-5 text-accent animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {noLeidas}
              </span>
            </>
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-96 p-0 overflow-hidden shadow-xl border-border/60 z-[110]">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm">Alertas activas ({alerts.length})</h3>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              onClick={() => refetch()}
              disabled={isLoading}
              title="Actualizar"
            >
              <Bell className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>
          </div>
          {noLeidas > 0 && (
            <Badge variant="destructive" className="text-[10px] animate-pulse">
              {noLeidas} Pendientes
            </Badge>
          )}
        </div>
        <div className="max-h-[450px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Analizando inventario…
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle className="h-8 w-8 text-emerald-500/30 mx-auto" />
              <p className="text-xs text-muted-foreground">¡Todo en orden! No hay lotes ni stock crítico.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  onClick={() => {
                    if (alert.tipo === 'vencimiento') navigate({ to: '/lotes' });
                    else if (alert.tipo === 'stock') navigate({ to: '/inventario' });
                  }}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group relative"
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-full grid place-items-center shrink-0 border shadow-sm",
                      alert.prioridad === 0 ? "bg-red-100 text-red-700 border-red-200" :
                      alert.prioridad === 1 ? "bg-amber-100 text-amber-700 border-amber-200" :
                      "bg-blue-100 text-blue-700 border-blue-200"
                    )}>
                      {alert.tipo === 'vencimiento' ? <Calendar className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    </div>
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs truncate uppercase tracking-wider">
                          {alert.titulo}
                        </span>
                        <Badge variant="outline" className={cn(
                          "text-[9px] px-1.5 py-0 h-4 border-none font-bold",
                          alert.prioridad === 0 ? "bg-red-50 text-red-700" :
                          alert.prioridad === 1 ? "bg-amber-50 text-amber-700" :
                          "bg-blue-50 text-blue-700"
                        )}>
                          {alert.urgenciaLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {alert.mensaje}
                      </p>
                      
                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex items-center gap-1 text-[10px] font-medium bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                          <Package className="h-3 w-3 text-muted-foreground" />
                          Stock: <span className={cn(alert.stock <= 0 ? "text-destructive" : "text-foreground")}>{alert.stock} {alert.unidad}</span>
                        </div>
                        {alert.diasRestantes !== null && (
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border",
                            alert.diasRestantes <= 0 ? "bg-red-50 text-red-700 border-red-200" :
                            alert.diasRestantes <= 7 ? "bg-amber-50 text-amber-700 border-amber-200" :
                            "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            <Calendar className="h-3 w-3" />
                            {alert.diasRestantes <= 0 ? "Vencido" : `Faltan ${alert.diasRestantes} días`}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-full shrink-0 self-start"
                      onClick={(e) => handleResolve(e, alert.id)}
                      title="Marcar como gestionado"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t bg-muted/20 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-[10px] h-7" asChild>
            <a href="/lotes"><Info className="h-3 w-3 mr-1" /> Ver todos los lotes</a>
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-[10px] h-7" asChild>
            <a href="/configuracion">Configurar</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { Menu, PanelLeftClose, LogOut, Wifi, WifiOff, Bell, BellDot, Package, Shield, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotificacionesAlertas } from "@/lib/notificaciones.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

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
    <header className="h-12 border-b bg-card/80 backdrop-blur flex items-center px-3 md:px-4 gap-2 sticky top-0 z-30">
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
  const fetchAlerts = useServerFn(getNotificacionesAlertas);
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["notificaciones-alertas"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60000 * 5, // Cada 5 min
  });

  const noLeidas = alerts.filter((a: any) => !a.leida).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
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
      <PopoverContent align="end" className="w-80 p-0 overflow-hidden shadow-xl border-border/60">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="font-bold text-sm">Notificaciones</h3>
          {noLeidas > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {noLeidas} nuevas
            </Badge>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Cargando alertas…
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-xs text-muted-foreground">No tienes notificaciones pendientes</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 hover:bg-muted/50 transition-colors cursor-default",
                    !alert.leida && "bg-accent/5"
                  )}
                >
                  <div className="flex gap-3">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full grid place-items-center shrink-0",
                        alert.tipo === "stock"
                          ? "bg-amber-100 text-amber-600"
                          : alert.tipo === "licencia"
                          ? "bg-red-100 text-red-600"
                          : alert.tipo === "vencimiento"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-blue-100 text-blue-600"
                      )}
                    >
                      {alert.tipo === "stock" ? (
                        <Package className="h-4 w-4" />
                      ) : alert.tipo === "licencia" ? (
                        <Shield className="h-4 w-4" />
                      ) : alert.tipo === "vencimiento" ? (
                        <Calendar className="h-4 w-4" />
                      ) : (
                        <Tag className="h-4 w-4" />
                      )}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs truncate">
                          {alert.titulo}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(alert.fecha), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {alert.mensaje}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-2 border-t bg-muted/20">
          <Button variant="ghost" size="sm" className="w-full text-[10px]" asChild>
            <a href="/configuracion">Configurar alertas</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

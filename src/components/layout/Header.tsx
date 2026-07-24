import { Menu, PanelLeftClose, LogOut, Wifi, WifiOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";

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
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
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
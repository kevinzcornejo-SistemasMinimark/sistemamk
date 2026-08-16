import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { useLicencia } from "@/hooks/useLicencia";
import { LicenciaBloqueo } from "@/components/LicenciaBloqueo";
import { useAppConfig } from "@/hooks/useAppConfig";
import { toast } from "sonner";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const RUTAS_PERMITIDAS = ["/configuracion", "/ajustes"];

function AppLayout() {
  const { user, isDemo, loading, can } = useAuth();
  const { bloqueada, estado, loading: licLoading } = useLicencia();
  useAppConfig();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user && !isDemo) {
      navigate({ to: "/login" });
      return;
    }

    if (!loading && user) {
      // Validar acceso al módulo actual basándose en permisos_usuario
      const path = location.pathname;
      const parts = path.split('/').filter(Boolean);
      const modulo = parts[0];

      if (modulo && !["configuracion", "ajustes", "perfil"].includes(modulo)) {
        if (!can(modulo)) {
          console.warn(`[Auth] Acceso denegado a módulo: ${modulo}`);
          toast.error("No tienes permiso para acceder a este módulo");
          navigate({ to: "/dashboard" });
        }
      }
    }
  }, [user, isDemo, loading, navigate, location.pathname, can]);

  if (loading || licLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!user && !isDemo) return null;

  const rutaPermitida = RUTAS_PERMITIDAS.some((r) => location.pathname.startsWith(r));
  const mostrarBloqueo = bloqueada && !isDemo && !rutaPermitida;

  return (
    <AppShell>
      {mostrarBloqueo ? <LicenciaBloqueo estado={estado} /> : <Outlet />}
    </AppShell>
  );
}

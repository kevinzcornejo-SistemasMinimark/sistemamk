import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { useLicencia } from "@/hooks/useLicencia";
import { LicenciaBloqueo } from "@/components/LicenciaBloqueo";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

// Rutas permitidas aún con la licencia bloqueada (para poder renovar/activar)
const RUTAS_PERMITIDAS = ["/configuracion", "/ajustes"];

function AppLayout() {
  const { user, isDemo, loading } = useAuth();
  const { bloqueada, estado, loading: licLoading } = useLicencia();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user && !isDemo) {
      navigate({ to: "/login" });
    }
  }, [user, isDemo, loading, navigate]);

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
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, Package, Clock, ShieldAlert } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";

export const Route = createFileRoute("/_app/alertas")({
  head: () => ({ meta: [{ title: "Alertas — POS Minimarket" }] }),
  component: AlertasPage,
});

function AlertasPage() {
  const { productos } = useCatalog();

  const stats = {
    critico: productos.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo / 2).length,
    bajo: productos.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo).length,
    agotado: productos.filter((p) => p.stock <= 0).length,
    sobrestock: productos.filter((p) => p.stock > 100).length, // Ejemplo simple
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Panel de Alertas</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AlertCard title="Stock Crítico" count={stats.critico} icon={ShieldAlert} color="text-red-500" />
        <AlertCard title="Stock Bajo" count={stats.bajo} icon={AlertTriangle} color="text-orange-500" />
        <AlertCard title="Agotados" count={stats.agotado} icon={Package} color="text-gray-500" />
        <AlertCard title="Sobrestock" count={stats.sobrestock} icon={TrendingUp} color="text-blue-500" />
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Inventario detallado</h2>
        <p className="text-muted-foreground">Esta sección mostrará las listas detalladas según el requerimiento del usuario.</p>
      </Card>
    </div>
  );
}

function AlertCard({ title, count, icon: Icon, color }: { title: string, count: number, icon: any, color: string }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={cn("p-3 rounded-xl bg-background border", color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="text-2xl font-black">{count}</div>
      </div>
    </Card>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

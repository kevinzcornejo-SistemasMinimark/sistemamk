import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/_app/notificaciones")({
  component: NotificacionesPage,
});

function NotificacionesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard de Notificaciones</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Stock Crítico" value="0" color="bg-red-500" />
        <StatCard title="Stock Bajo" value="0" color="bg-amber-500" />
        <StatCard title="Productos Agotados" value="0" color="bg-neutral-800" />
        <StatCard title="Próximos a Vencer" value="0" color="bg-sky-500" />
      </div>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Detalle de Alertas</h2>
        <p className="text-muted-foreground">Módulo en construcción: Integrando datos reales de stock y lotes.</p>
      </Card>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={`h-12 w-2 rounded-full ${color}`} />
      <div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Card>
  );
}

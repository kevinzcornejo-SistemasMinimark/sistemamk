import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Package,
  CalendarClock,
  TrendingUp,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { formatPEN } from "@/lib/format";

export const Route = createFileRoute("/_app/notificaciones")({
  component: NotificacionesPage,
});

function NotificacionesPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [
        { data: prodData },
        { data: loteData }
      ] = await Promise.all([
        supabase.from("productos").select("*"),
        supabase.from("lotes").select("*, productos(nombre)").order("fecha_vencimiento")
      ]);
      setProductos(prodData || []);
      setLotes(loteData || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const stats = useMemo(() => {
    const ahora = new Date();
    const proximoVencer = lotes.filter(l => l.fecha_vencimiento && new Date(l.fecha_vencimiento) > ahora && new Date(l.fecha_vencimiento) < new Date(ahora.getTime() + 30 * 86400000));
    const vencidos = lotes.filter(l => l.fecha_vencimiento && new Date(l.fecha_vencimiento) < ahora);
    
    return {
      stockCritico: productos.filter(p => p.stock <= p.stock_minimo && p.stock > 0).length,
      agotados: productos.filter(p => p.stock <= 0).length,
      proximoVencer: proximoVencer.length,
      vencidos: vencidos.length
    };
  }, [productos, lotes]);

  if (loading) return <div className="p-6">Cargando dashboard...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard de Notificaciones</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Stock Crítico" value={stats.stockCritico.toString()} icon={AlertTriangle} color="text-amber-500" />
        <StatCard title="Productos Agotados" value={stats.agotados.toString()} icon={Package} color="text-red-600" />
        <StatCard title="Próximos a Vencer" value={stats.proximoVencer.toString()} icon={CalendarClock} color="text-sky-500" />
        <StatCard title="Productos Vencidos" value={stats.vencidos.toString()} icon={AlertTriangle} color="text-rose-600" />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={`p-3 rounded-full bg-muted ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Card>
  );
}

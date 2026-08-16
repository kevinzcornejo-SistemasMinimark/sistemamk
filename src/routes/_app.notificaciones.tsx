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
  History,
  AlertCircle,
  Skull,
  TrendingDown,
  ChevronRight,
  BadgeAlert,
} from "lucide-react";
import { formatPEN } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/notificaciones")({
  head: () => ({ meta: [{ title: "Dashboard Notificaciones — LA COOP" }] }),
  component: NotificacionesPage,
});

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

function NotificacionesPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [ventaItems, setVentaItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVentas, setFiltroVentas] = useState("30d");

  useEffect(() => {
    async function loadData() {
      const ahora = new Date();
      let fechaFiltro = new Date();
      if (filtroVentas === "hoy") fechaFiltro.setHours(0, 0, 0, 0);
      else if (filtroVentas === "7d") fechaFiltro.setDate(ahora.getDate() - 7);
      else if (filtroVentas === "30d") fechaFiltro.setDate(ahora.getDate() - 30);
      else if (filtroVentas === "año") fechaFiltro.setFullYear(ahora.getFullYear() - 1);

      const [
        { data: prodData },
        { data: loteData },
        { data: detData }
      ] = await Promise.all([
        supabase.from("productos").select("*, categorias(nombre)").order("nombre"),
        supabase.from("lotes").select("*, productos(nombre)").order("fecha_vencimiento"),
        supabase.from("venta_items")
          .select("cantidad, total, producto_id, productos(nombre), ventas!inner(creada_en, estado)")
          .gte("ventas.creada_en", fechaFiltro.toISOString())
          .neq("ventas.estado", "ANULADA")
          .limit(5000)
      ]);
      
      setProductos(prodData || []);
      setLotes(loteData || []);
      setVentaItems(detData || []);
      setLoading(false);
    }
    loadData();
  }, [filtroVentas]);

  const stats = useMemo(() => {
    const ahora = new Date();
    const hoy = ahora.toISOString().slice(0, 10);
    const en30d = new Date(ahora.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    
    // FEFO: Priorizar los que vencen primero
    const lotesActivos = lotes.filter(l => l.cantidad_actual > 0);
    
    const critico = productos.filter(p => p.stock > 0 && p.stock <= p.stock_minimo);
    const bajo = productos.filter(p => p.stock > p.stock_minimo && p.stock <= p.stock_minimo * 1.5);
    const agotados = productos.filter(p => p.stock <= 0);
    const sobrestock = productos.filter(p => p.stock > p.stock_minimo * 5 && p.stock_minimo > 0);
    
    const proximosVencer = lotesActivos.filter(l => l.fecha_vencimiento && l.fecha_vencimiento > hoy && l.fecha_vencimiento <= en30d);
    const vencidos = lotesActivos.filter(l => l.fecha_vencimiento && l.fecha_vencimiento <= hoy);

    // Productos sin movimiento (en el periodo de ventas cargado)
    const idsConVenta = new Set(ventaItems.map(vi => vi.producto_id));
    const sinMovimiento = productos.filter(p => !idsConVenta.has(p.id) && p.stock > 0);

    return {
      critico,
      bajo,
      agotados,
      sobrestock,
      sinMovimiento,
      proximosVencer,
      vencidos,
      reponer: critico.length + agotados.length
    };
  }, [productos, lotes, ventaItems]);

  const salesData = useMemo(() => {
    const map: Record<string, { nombre: string; cantidad: number; total: number }> = {};
    ventaItems.forEach((d) => {
      const k = d.producto_id;
      if (!map[k]) map[k] = { nombre: d.productos?.nombre ?? "—", cantidad: 0, total: 0 };
      map[k].cantidad += Number(d.cantidad);
      map[k].total += Number(d.total);
    });
    const sorted = Object.values(map).sort((a, b) => b.total - a.total);
    return {
      top: sorted.slice(0, 10),
      bottom: sorted.filter(p => p.cantidad > 0).reverse().slice(0, 10),
      totalFacturado: sorted.reduce((s, p) => s + p.total, 0)
    };
  }, [ventaItems]);

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando análisis de inventario...</div>;

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Dashboard de Notificaciones</h1>
          <p className="text-muted-foreground text-lg">Monitoreo inteligente de stock, vencimientos y ventas críticas.</p>
        </div>
        <Tabs value={filtroVentas} onValueChange={setFiltroVentas} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-4 md:flex md:w-auto">
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="7d">7 días</TabsTrigger>
            <TabsTrigger value="30d">30 días</TabsTrigger>
            <TabsTrigger value="año">Año</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      
      {/* 📦 Tablas de Inventario Crítico - Movido arriba para visibilidad */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-5 xl:col-span-1 border-none shadow-sm ring-1 ring-border bg-red-50/30 ring-red-100">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-700">
            <BadgeAlert className="h-6 w-6 text-red-600 animate-pulse" /> Stock Crítico
          </h3>
          <div className="space-y-2">
            {stats.critico.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No hay productos en nivel crítico</div>
            ) : (
              stats.critico.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/80 border border-red-100 shadow-sm hover:scale-[1.02] transition-transform">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold truncate text-neutral-800">{p.nombre}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">{p.categorias?.nombre || 'General'}</span>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-sm font-black text-red-600">{p.stock} {p.unidad}</span>
                    <span className="text-[9px] text-red-400 font-bold uppercase">Mín: {p.stock_minimo}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-1 border-none shadow-sm ring-1 ring-border">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" /> Sobrestock
          </h3>
          <div className="space-y-2">
            {stats.sobrestock.slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{p.nombre}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{p.categorias?.nombre || 'General'}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-xs font-bold text-emerald-600">{p.stock} {p.unidad}</span>
                  <span className="text-[9px] text-muted-foreground">Capacidad excedida</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-1 border-none shadow-sm ring-1 ring-border">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" /> Sin Movimiento
          </h3>
          <div className="space-y-2">
            {stats.sinMovimiento.slice(0, 8).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{p.nombre}</span>
                  <span className="text-[10px] text-muted-foreground">Stock actual: {p.stock}</span>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-[10px]">Rotación Baja</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusMiniCard title="Stock Bajo" value={stats.bajo.length} icon={AlertTriangle} color="text-amber-500" />
        <StatusMiniCard title="Próximos a Vencer" value={stats.proximosVencer.length} icon={CalendarClock} color="text-sky-500" />
        <StatusMiniCard title="Sobrestock" value={stats.sobrestock.length} icon={TrendingUp} color="text-emerald-500" />
        <StatusMiniCard title="Por Reponer" value={stats.reponer} icon={ShoppingBag} color="text-indigo-500" />
      </div>

      {/* 📈 Análisis de Ventas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-none shadow-sm ring-1 ring-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Top 10 Más Vendidos</h2>
              <p className="text-sm text-muted-foreground">Productos con mayor facturación en el periodo</p>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData.top} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis dataKey="nombre" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(v: any) => formatPEN(v)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {salesData.top.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-sm ring-1 ring-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold">Resumen de Vencimientos</h2>
              <p className="text-sm text-muted-foreground">Lotes activos según fecha de expiración</p>
            </div>
            <CalendarClock className="h-6 w-6 text-sky-500" />
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {stats.vencidos.map((l, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-100">
                <div className="flex flex-col">
                  <span className="font-bold text-rose-900">{l.productos?.nombre}</span>
                  <span className="text-xs text-rose-700">Lote: {l.numero_lote} · Venció: {l.fecha_vencimiento}</span>
                </div>
                <Badge variant="destructive" className="font-bold">VENCIDO</Badge>
              </div>
            ))}
            {stats.proximosVencer.map((l, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-sky-50 border border-sky-100">
                <div className="flex flex-col">
                  <span className="font-bold text-sky-900">{l.productos?.nombre}</span>
                  <span className="text-xs text-sky-700">Lote: {l.numero_lote} · Vence: {l.fecha_vencimiento}</span>
                </div>
                <Badge className="bg-sky-500 hover:bg-sky-600 font-bold">PRÓXIMO</Badge>
              </div>
            ))}
            {stats.vencidos.length === 0 && stats.proximosVencer.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-2 opacity-20" />
                <p>No hay alertas de vencimiento pendientes</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Tarjetas de Resumen Secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AlertCard 
          title="Stock Crítico" 
          value={stats.critico.length} 
          subtitle="Productos por debajo del mínimo" 
          icon={BadgeAlert} 
          color="text-red-600" 
          bg="bg-red-50" 
        />
        <AlertCard 
          title="Agotados" 
          value={stats.agotados.length} 
          subtitle="Stock en cero absoluto" 
          icon={Package} 
          color="text-neutral-900" 
          bg="bg-neutral-100" 
        />
        <AlertCard 
          title="Vencidos" 
          value={stats.vencidos.length} 
          subtitle="Lotes que ya expiraron" 
          icon={Skull} 
          color="text-rose-600" 
          bg="bg-rose-50" 
        />
        <AlertCard 
          title="Sin Movimiento" 
          value={stats.sinMovimiento.length} 
          subtitle="No se venden en este periodo" 
          icon={History} 
          color="text-amber-600" 
          bg="bg-amber-50" 
        />
      </div>
    </div>
  );
}

function AlertCard({ title, value, subtitle, icon: Icon, color, bg }: { title: string; value: number; subtitle: string; icon: any; color: string; bg: string }) {
  return (
    <Card className={`p-5 border-none shadow-sm ring-1 ring-border ${bg} relative overflow-hidden group`}>
      <Icon className={`absolute -right-2 -bottom-2 h-20 w-20 opacity-10 ${color} group-hover:scale-110 transition-transform`} />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-5 w-5 ${color}`} />
          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
        </div>
        <div className={`text-4xl font-black ${color} mb-1`}>{value}</div>
        <div className="text-[11px] text-muted-foreground font-medium">{subtitle}</div>
      </div>
    </Card>
  );
}

function StatusMiniCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: any; color: string }) {
  return (
    <Card className="p-4 flex items-center justify-between border-none shadow-sm ring-1 ring-border hover:bg-muted/30 transition-colors cursor-default">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold text-muted-foreground">{title}</span>
      </div>
      <span className="text-xl font-bold">{value}</span>
    </Card>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, TrendingUp, Package, Clock, ShieldAlert, 
  ShoppingCart, Ban, Boxes, Bell, TrendingDown,
  BarChart3, Calendar, RefreshCw, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/hooks/useCatalog";
import { formatPEN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { 
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, format, isWithinInterval 
} from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

export const Route = createFileRoute("/_app/alertas")({
  head: () => ({ meta: [{ title: "Alertas — POS Minimarket" }] }),
  component: AlertasPage,
});

type FilterType = 'hoy' | '7d' | '30d' | 'mes' | 'año' | 'custom';

function AlertasPage() {
  const { user, isDemo } = useAuth();
  const { productos, loading: loadingCatalog } = useCatalog();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('30d');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);
  
  const [ventas, setVentas] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [alertasPendientes, setAlertasPendientes] = useState<number>(0);

  const getRange = () => {
    const now = new Date();
    if (filter === 'hoy') return { from: startOfDay(now), to: endOfDay(now) };
    if (filter === '7d') return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    if (filter === '30d') return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    if (filter === 'mes') return { from: startOfMonth(now), to: endOfMonth(now) };
    if (filter === 'año') return { from: startOfYear(now), to: endOfYear(now) };
    if (filter === 'custom' && dateRange) return dateRange;
    return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  };

  const range = useMemo(getRange, [filter, dateRange]);

  const cargarDatos = async () => {
    if (isDemo || !user) return;
    setLoading(true);
    try {
      const { data: v } = await supabase.from("ventas")
        .select("id, total, creada_en, estado")
        .gte("creada_en", range.from.toISOString())
        .lte("creada_en", range.to.toISOString())
        .neq("estado", "ANULADA");

      const { data: l } = await supabase.from("lotes")
        .select("id, fecha_vencimiento, producto_id, cantidad_actual, numero_lote, productos(nombre)");

      const { count } = await supabase.from("notificaciones_gestion")
        .select("*", { count: 'exact', head: true });

      setVentas(v ?? []);
      setLotes(l ?? []);
      setAlertasPendientes(count ?? 0);

      if (v && v.length > 0) {
        const ids = v.map(x => x.id);
        const { data: vi } = await supabase.from("venta_items")
          .select("cantidad, total, producto_id, productos(nombre)")
          .in("venta_id", ids);
        setItems(vi ?? []);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filter, dateRange, isDemo, user?.id]);

  // Cálculos de Inventario
  const inventoryStats = useMemo(() => {
    const critico = productos.filter(p => p.stock > 0 && p.stock <= (p.stock_minimo * 0.5));
    const bajo = productos.filter(p => p.stock > 0 && p.stock <= p.stock_minimo && p.stock > (p.stock_minimo * 0.5));
    const agotados = productos.filter(p => p.stock <= 0);
    const sobrestock = productos.filter(p => p.stock > (p.stock_minimo * 5) && p.stock_minimo > 0);
    
    // Sin movimiento (productos que no están en venta_items del periodo)
    const vendidosIds = new Set(items.map(i => i.producto_id));
    const sinMovimiento = productos.filter(p => !vendidosIds.has(p.id));

    const hoy = new Date();
    const proximosVencer = lotes.filter(l => {
      if (!l.fecha_vencimiento) return false;
      const f = new Date(l.fecha_vencimiento);
      const diff = (f.getTime() - hoy.getTime()) / 86400000;
      return diff > 0 && diff <= 30 && l.cantidad_actual > 0;
    });
    
    const vencidos = lotes.filter(l => {
      if (!l.fecha_vencimiento) return false;
      const f = new Date(l.fecha_vencimiento);
      return f < hoy && l.cantidad_actual > 0;
    });

    const porReponer = productos.filter(p => p.stock <= p.stock_minimo);

    return { 
      critico, bajo, agotados, sobrestock, sinMovimiento, 
      proximosVencer, vencidos, porReponer 
    };
  }, [productos, lotes, items]);

  // Cálculos de Ventas y Rendimiento
  const performanceStats = useMemo(() => {
    const prodMap: Record<string, { nombre: string, cantidad: number, total: number }> = {};
    items.forEach(i => {
      if (!prodMap[i.producto_id]) prodMap[i.producto_id] = { nombre: i.productos?.nombre || '—', cantidad: 0, total: 0 };
      prodMap[i.producto_id].cantidad += Number(i.cantidad);
      prodMap[i.producto_id].total += Number(i.total);
    });

    const sorted = Object.entries(prodMap).map(([id, data]) => ({ id, ...data }));
    const masVendidos = [...sorted].sort((a, b) => b.cantidad - a.cantidad).slice(0, 10);
    const menosVendidos = [...sorted].sort((a, b) => a.cantidad - b.cantidad).slice(0, 10);
    const mayorFacturacion = [...sorted].sort((a, b) => b.total - a.total).slice(0, 10);

    // Tendencias (muy simplificado: comparando primera mitad del periodo vs segunda mitad)
    const midPoint = range.from.getTime() + (range.to.getTime() - range.from.getTime()) / 2;
    const primeraMitad = ventas.filter(v => new Date(v.creada_en).getTime() < midPoint);
    const segundaMitad = ventas.filter(v => new Date(v.creada_en).getTime() >= midPoint);
    
    // Aquí se podría profundizar en la tendencia por producto
    
    return { masVendidos, menosVendidos, mayorFacturacion, totalVentas: ventas.reduce((s, v) => s + Number(v.total), 0) };
  }, [items, ventas, range]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">Dashboard de Alertas</h1>
          <p className="text-muted-foreground">Monitoreo crítico de inventario y rendimiento</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            {(['hoy', '7d', '30d', 'mes', 'año'] as FilterType[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                size="sm"
                className="h-8 text-[11px] uppercase font-bold"
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={filter === 'custom' ? "default" : "ghost"} 
                  size="sm" 
                  className="h-8 text-[11px] uppercase font-bold"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Personalizado
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(r: any) => {
                    setDateRange(r);
                    if (r?.from && r?.to) setFilter('custom');
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={cargarDatos} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard title="Stock Crítico" count={inventoryStats.critico.length} icon={ShieldAlert} color="red" />
        <StatCard title="Stock Bajo" count={inventoryStats.bajo.length} icon={AlertTriangle} color="orange" />
        <StatCard title="Agotados" count={inventoryStats.agotados.length} icon={Ban} color="slate" />
        <StatCard title="Sobrestock" count={inventoryStats.sobrestock.length} icon={Boxes} color="blue" />
        <StatCard title="Sin Movimiento" count={inventoryStats.sinMovimiento.length} icon={Clock} color="zinc" />
        <StatCard title="Próx. a Vencer" count={inventoryStats.proximosVencer.length} icon={Bell} color="amber" />
        <StatCard title="Vencidos" count={inventoryStats.vencidos.length} icon={Ban} color="rose" />
        <StatCard title="Por Reponer" count={inventoryStats.porReponer.length} icon={ShoppingCart} color="emerald" />
        <StatCard title="Alertas Pendientes" count={alertasPendientes} icon={AlertTriangle} color="yellow" />
        <StatCard title="Ventas" count={formatPEN(performanceStats.totalVentas)} icon={TrendingUp} color="indigo" isCurrency />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Rendimiento de Productos */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-bold uppercase tracking-tight">Rendimiento de Ventas</h2>
          </div>
          
          <div className="space-y-6">
            <RankingList title="Top 10 más vendidos" items={performanceStats.masVendidos} type="qty" />
            <RankingList title="Productos con mayor facturación" items={performanceStats.mayorFacturacion} type="total" />
            <RankingList title="Productos menos vendidos" items={performanceStats.menosVendidos} type="qty" />
          </div>
        </Card>

        {/* Detalle de Inventario */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-bold uppercase tracking-tight">Inventario Crítico</h2>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            <InventoryGroup title="Stock Crítico" items={inventoryStats.critico} color="text-red-600" />
            <InventoryGroup title="Productos Agotados" items={inventoryStats.agotados} color="text-slate-600" />
            <InventoryGroup title="Sobrestock" items={inventoryStats.sobrestock} color="text-blue-600" />
            <ExpiryGroup title="Lotes por Vencer (30d)" items={inventoryStats.proximosVencer} color="text-amber-600" />
            <ExpiryGroup title="Productos Vencidos" items={inventoryStats.vencidos} color="text-rose-600" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, count, icon: Icon, color, isCurrency }: { title: string, count: string | number, icon: any, color: string, isCurrency?: boolean }) {
  const colors: any = {
    red: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20 dark:border-red-900/30",
    orange: "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30",
    slate: "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800",
    blue: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30",
    zinc: "bg-zinc-50 text-zinc-600 border-zinc-100 dark:bg-zinc-900/20 dark:border-zinc-800",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30",
    rose: "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30",
    yellow: "bg-yellow-50 text-yellow-600 border-yellow-100 dark:bg-yellow-950/20 dark:border-yellow-900/30",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30",
  };

  return (
    <Card className={cn("p-3 border-l-4 flex flex-col justify-between h-full hover:shadow-md transition-shadow", colors[color])}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-1.5 rounded-lg bg-background/50">
          <Icon className="h-4 w-4" />
        </div>
        {!isCurrency && count === 0 && <Badge variant="outline" className="text-[9px]">OK</Badge>}
      </div>
      <div>
        <div className="text-[10px] uppercase font-black tracking-widest opacity-70 mb-1">{title}</div>
        <div className={cn("text-xl font-black tabular-nums tracking-tighter", isCurrency && "text-lg")}>{count}</div>
      </div>
    </Card>
  );
}

function RankingList({ title, items, type }: { title: string, items: any[], type: 'qty' | 'total' }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground border-l-2 border-primary pl-2">{title}</h3>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-dashed last:border-0">
            <div className="flex items-center gap-2 truncate">
              <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
              <span className="truncate font-medium">{item.nombre}</span>
            </div>
            <span className="font-bold tabular-nums shrink-0">
              {type === 'qty' ? `${item.cantidad} und.` : formatPEN(item.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryGroup({ title, items, color }: { title: string, items: any[], color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2 bg-muted/20 p-3 rounded-lg border">
      <h3 className={cn("text-xs font-black uppercase tracking-widest", color)}>{title}</h3>
      <div className="grid gap-1.5">
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-xs bg-card p-2 rounded border border-border/40">
            <span className="font-bold truncate">{p.nombre}</span>
            <Badge variant="outline" className="font-black">Stock: {p.stock}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpiryGroup({ title, items, color }: { title: string, items: any[], color: string }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2 bg-muted/20 p-3 rounded-lg border">
      <h3 className={cn("text-xs font-black uppercase tracking-widest", color)}>{title}</h3>
      <div className="grid gap-1.5">
        {items.map((l) => (
          <div key={l.id} className="flex flex-col gap-1 bg-card p-2 rounded border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold truncate">{l.productos?.nombre || '—'}</span>
              <span className="font-black tabular-nums">{l.cantidad_actual} und.</span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold">
              <span>Lote: {l.numero_lote || 'N/A'}</span>
              <span className={color}>Vence: {l.fecha_vencimiento ? format(new Date(l.fecha_vencimiento), "dd MMM yyyy", { locale: es }) : '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

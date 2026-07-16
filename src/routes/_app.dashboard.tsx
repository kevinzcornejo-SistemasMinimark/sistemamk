import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { formatPEN } from "@/lib/format";
import {
  TrendingUp, ShoppingBag, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight,
  Package, Receipt,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/hooks/useCatalog";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — POS Minimarket" }] }),
  component: Dashboard,
});

type VentaRow = { total: number; creada_en: string; metodo_pago: string };
type DetalleRow = { cantidad: number; total: number; producto_id: string; productos: { nombre: string } | null };

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

function Dashboard() {
  const { isDemo, user } = useAuth();
  const { productos } = useCatalog();
  const [ventas30, setVentas30] = useState<VentaRow[]>([]);
  const [topDet, setTopDet] = useState<DetalleRow[]>([]);

  useEffect(() => {
    if (isDemo || !user) return;
    (async () => {
      const desde = new Date(); desde.setDate(desde.getDate() - 60);
      const { data: v } = await supabase.from("ventas")
        .select("total,creada_en,metodo_pago")
        .gte("creada_en", desde.toISOString())
        .neq("estado", "ANULADA");
      setVentas30((v ?? []) as any);

      const desdeMes = new Date(); desdeMes.setDate(desdeMes.getDate() - 30);
      const { data: d } = await supabase.from("venta_items")
        .select("cantidad,total,producto_id,productos(nombre),ventas!inner(creada_en,estado)")
        .gte("ventas.creada_en", desdeMes.toISOString())
        .neq("ventas.estado", "ANULADA")
        .limit(2000);
      setTopDet((d ?? []) as any);
    })();
  }, [isDemo, user?.id]);

  const stats = useMemo(() => {
    const ahora = new Date();
    const hoy0 = new Date(ahora); hoy0.setHours(0, 0, 0, 0);
    const ayer0 = new Date(hoy0); ayer0.setDate(ayer0.getDate() - 1);
    const sem0 = new Date(hoy0); sem0.setDate(sem0.getDate() - 7);
    const semPrev = new Date(hoy0); semPrev.setDate(semPrev.getDate() - 14);
    const mes0 = new Date(hoy0); mes0.setDate(mes0.getDate() - 30);

    const sum = (arr: VentaRow[]) => arr.reduce((s, v) => s + Number(v.total), 0);
    const hoy = ventas30.filter((v) => new Date(v.creada_en) >= hoy0);
    const ayer = ventas30.filter((v) => { const d = new Date(v.creada_en); return d >= ayer0 && d < hoy0; });
    const semana = ventas30.filter((v) => new Date(v.creada_en) >= sem0);
    const semanaPrev = ventas30.filter((v) => { const d = new Date(v.creada_en); return d >= semPrev && d < sem0; });
    const mes = ventas30.filter((v) => new Date(v.creada_en) >= mes0);

    const ventasHoy = sum(hoy);
    const ventasAyer = sum(ayer);
    const vsAyer = ventasAyer ? ((ventasHoy - ventasAyer) / ventasAyer) * 100 : 0;
    const vsSemPrev = sum(semanaPrev) ? ((sum(semana) - sum(semanaPrev)) / sum(semanaPrev)) * 100 : 0;

    // Serie 14 días
    const dias14: { dia: string; ventas: number; transacciones: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy0); d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const arr = ventas30.filter((v) => v.creada_en.slice(0, 10) === dStr);
      dias14.push({
        dia: d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
        ventas: Number(sum(arr).toFixed(2)),
        transacciones: arr.length,
      });
    }

    // Ventas por hora (últimos 7 días)
    const horas: { hora: string; ventas: number }[] = Array.from({ length: 24 }, (_, h) => ({
      hora: `${String(h).padStart(2, "0")}h`, ventas: 0,
    }));
    semana.forEach((v) => {
      const h = new Date(v.creada_en).getHours();
      horas[h].ventas += Number(v.total);
    });

    // Métodos de pago (semana)
    const metodos: Record<string, number> = {};
    semana.forEach((v) => { metodos[v.metodo_pago] = (metodos[v.metodo_pago] ?? 0) + Number(v.total); });
    const pieData = Object.entries(metodos).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

    return {
      ventasHoy, transacciones: hoy.length, ticketPromedio: hoy.length ? ventasHoy / hoy.length : 0,
      ventasMes: sum(mes), vsAyer, vsSemPrev,
      dias14, horas, pieData,
    };
  }, [ventas30]);

  const topProductos = useMemo(() => {
    const map: Record<string, { nombre: string; cantidad: number; total: number }> = {};
    topDet.forEach((d) => {
      const k = d.producto_id;
      if (!map[k]) map[k] = { nombre: d.productos?.nombre ?? "—", cantidad: 0, total: 0 };
      map[k].cantidad += Number(d.cantidad);
      map[k].total += Number(d.total);
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [topDet]);

  const stockCritico = productos.filter((p) => p.stock <= p.stock_minimo);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Vista general del minimarket — últimos 30 días</p>
        </div>
      </div>

      {/* KPIs con variación */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Ventas de hoy" value={formatPEN(stats.ventasHoy)} icon={TrendingUp} color="emerald" delta={stats.vsAyer} deltaLabel="vs ayer" />
        <KpiCard label="Transacciones" value={String(stats.transacciones)} icon={Receipt} color="sky" />
        <KpiCard label="Ticket promedio" value={formatPEN(stats.ticketPromedio)} icon={Wallet} color="violet" />
        <KpiCard label="Ventas semana" value={formatPEN(stats.dias14.slice(-7).reduce((s, d) => s + d.ventas, 0))} icon={ShoppingBag} color="amber" delta={stats.vsSemPrev} deltaLabel="vs semana anterior" />
      </div>

      {/* Gráfico principal: tendencia 14 días */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-lg">Tendencia de ventas</h2>
            <p className="text-xs text-muted-foreground">Últimos 14 días</p>
          </div>
          <Link to="/reportes" className="text-xs text-primary hover:underline font-semibold">Ver reportes →</Link>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.dias14}>
              <defs>
                <linearGradient id="gradV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
              <Tooltip formatter={(v: number) => formatPEN(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={2.5} fill="url(#gradV)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Ventas por hora */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-bold mb-1">Ventas por hora</h2>
          <p className="text-xs text-muted-foreground mb-3">Últimos 7 días — identifica horas pico</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.horas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatPEN(v)} contentStyle={{ borderRadius: 8 }} />
                <Bar dataKey="ventas" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Métodos de pago */}
        <Card className="p-5">
          <h2 className="font-bold mb-1">Métodos de pago</h2>
          <p className="text-xs text-muted-foreground mb-3">Esta semana</p>
          {stats.pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                    {stats.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatPEN(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top productos */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">Top productos vendidos</h2>
              <p className="text-xs text-muted-foreground">Últimos 30 días por monto</p>
            </div>
            <Package className="h-5 w-5 text-primary" />
          </div>
          {topProductos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Aún no hay ventas registradas</div>
          ) : (
            <div className="space-y-2">
              {topProductos.map((p, i) => {
                const max = topProductos[0].total;
                const pct = (p.total / max) * 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 ${i < 3 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                        <span className="truncate font-medium">{p.nombre}</span>
                      </span>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-bold">{formatPEN(p.total)}</span>
                        <span className="text-xs text-muted-foreground ml-2">×{p.cantidad}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Stock crítico */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold">Stock crítico</h2>
              <p className="text-xs text-muted-foreground">Productos por reponer</p>
            </div>
            <AlertTriangle className={`h-5 w-5 ${stockCritico.length ? "text-amber-500" : "text-emerald-500"}`} />
          </div>
          {stockCritico.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">✓ Todo el stock está en orden</div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {stockCritico.slice(0, 10).map((p) => {
                const agot = p.stock <= 0;
                return (
                  <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg ${agot ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20"}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.nombre}</div>
                      <div className="text-[11px] text-muted-foreground">Mín: {p.stock_minimo} {p.unidad}</div>
                    </div>
                    <div className={`text-right font-bold tabular-nums ${agot ? "text-red-600" : "text-amber-600"}`}>
                      {p.stock} {p.unidad}
                    </div>
                  </div>
                );
              })}
              {stockCritico.length > 10 && (
                <Link to="/inventario" className="block text-center text-xs text-primary hover:underline pt-2 font-semibold">
                  Ver {stockCritico.length - 10} más →
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, delta, deltaLabel }: {
  label: string; value: string; icon: any; color: string; delta?: number; deltaLabel?: string;
}) {
  const palette: Record<string, string> = {
    emerald: "from-emerald-500/10 text-emerald-600 border-emerald-200/50",
    sky: "from-sky-500/10 text-sky-600 border-sky-200/50",
    violet: "from-violet-500/10 text-violet-600 border-violet-200/50",
    amber: "from-amber-500/10 text-amber-600 border-amber-200/50",
  };
  const positivo = (delta ?? 0) >= 0;
  return (
    <Card className={`p-4 bg-gradient-to-br to-card border ${palette[color]}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-extrabold mt-2 text-foreground tabular-nums">{value}</div>
      {delta !== undefined && (
        <div className={`flex items-center gap-1 text-xs mt-1 font-semibold ${positivo ? "text-emerald-600" : "text-red-600"}`}>
          {positivo ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}% <span className="text-muted-foreground font-normal">{deltaLabel}</span>
        </div>
      )}
    </Card>
  );
}

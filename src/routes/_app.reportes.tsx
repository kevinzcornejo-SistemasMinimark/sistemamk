import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, FileSpreadsheet, Printer, Calendar as CalendarIcon, Package, RefreshCw, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatPEN } from "@/lib/format";
import { exportToCSV, printHTML } from "@/lib/exporters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, endOfDay, subDays, addHours } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/reportes")({
  head: () => ({ meta: [{ title: "Reportes — POS Minimarket" }] }),
  component: ReportesPage,
});

type Venta = { creada_en: string; total: number; subtotal: number; descuento: number; metodo_pago: string; tipo_comprobante: string };
type TopProd = { nombre: string; cantidad: number; total: number };
const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

function ReportesPage() {
  const { user, isDemo } = useAuth();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [gastosTotal, setGastosTotal] = useState(0);
  const [topProductos, setTopProductos] = useState<TopProd[]>([]);
  const [porHora, setPorHora] = useState<{ hora: string; ventas: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rango, setRango] = useState<number | 'custom'>(30);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>(undefined);

  const cargar = async () => {
    if (isDemo || !user) return;
    setLoading(true); setErrorMsg(null);
    try {
      let desdeIso: string;
      // Ajuste para considerar el día completo en America/Lima
      let hastaIso = endOfDay(new Date()).toISOString();

      if (rango === 'custom' && dateRange?.from) {
        desdeIso = startOfDay(dateRange.from).toISOString();
        if (dateRange.to) {
          hastaIso = endOfDay(dateRange.to).toISOString();
        }
      } else {
        const dias = typeof rango === 'number' ? rango : 30;
        const desde = startOfDay(subDays(new Date(), dias));
        desdeIso = desde.toISOString();
      }

      const { data: v, error: vErr } = await supabase.from("ventas")
        .select("id,creada_en,total,subtotal,descuento,metodo_pago,tipo_comprobante")
        .gte("creada_en", desdeIso)
        .lte("creada_en", hastaIso)
        .neq("estado", "ANULADA");
      if (vErr) throw vErr;
      setVentas((v ?? []) as any);

      // Agrupar por hora del día
      const hh: Record<string, number> = {};
      (v ?? []).forEach((row: any) => {
        // Ajuste manual de hora para el reporte visual (UTC a Lima: -5h)
        const h = format(addHours(new Date(row.creada_en), -5), "HH");
        hh[h] = (hh[h] ?? 0) + Number(row.total);
      });
      setPorHora(
        Array.from({ length: 24 }, (_, i) => {
          const k = i.toString().padStart(2, "0");
          return { hora: `${k}h`, ventas: Number((hh[k] ?? 0).toFixed(2)) };
        }),
      );

      // Top productos
      const ids = (v ?? []).map((x: any) => x.id);
      if (ids.length) {
        const { data: det, error: dErr } = await supabase
          .from("venta_items")
          .select("cantidad,total,productos(nombre)")
          .in("venta_id", ids);
        if (dErr) throw dErr;
        const acc: Record<string, TopProd> = {};
        (det ?? []).forEach((r: any) => {
          const n = r.productos?.nombre ?? "—";
          if (!acc[n]) acc[n] = { nombre: n, cantidad: 0, total: 0 };
          acc[n].cantidad += Number(r.cantidad);
          acc[n].total += Number(r.total);
        });
        setTopProductos(
          Object.values(acc).sort((a, b) => b.total - a.total).slice(0, 10),
        );
      } else {
        setTopProductos([]);
      }

      // Gastos
      try {
        let desdeStr: string;
        if (rango === 'custom' && dateRange?.from) {
          desdeStr = format(dateRange.from, 'yyyy-MM-dd');
        } else {
          const dias = typeof rango === 'number' ? rango : 30;
          desdeStr = format(subDays(new Date(), dias), 'yyyy-MM-dd');
        }

        const { data: g, error: gErr } = await supabase.from("gastos")
          .select("monto").gte("fecha", desdeStr);
        if (gErr) throw gErr;
        setGastosTotal((g ?? []).reduce((s: number, r: any) => s + Number(r.monto), 0));
      } catch {
        setGastosTotal(0);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error cargando reportes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [user?.id, isDemo, rango, dateRange]);

  const stats = useMemo(() => {
    const total = ventas.reduce((s, v) => s + Number(v.total), 0);
    const totalDescuentos = ventas.reduce((s, v) => s + Number(v.descuento || 0), 0);
    const count = ventas.length;
    const promedio = count ? total / count : 0;
    const porMetodo: Record<string, number> = {};
    const porTipo: Record<string, number> = {};
    const porDia: Record<string, { dia: string; ventas: number; trans: number }> = {};
    ventas.forEach((v) => {
      porMetodo[v.metodo_pago] = (porMetodo[v.metodo_pago] ?? 0) + Number(v.total);
      porTipo[v.tipo_comprobante] = (porTipo[v.tipo_comprobante] ?? 0) + Number(v.total);
      // Ajuste de fecha para el reporte visual (UTC a Lima: -5h)
      const k = format(addHours(new Date(v.creada_en), -5), "yyyy-MM-dd");
      if (!porDia[k]) porDia[k] = { dia: k.slice(5), ventas: 0, trans: 0 };
      porDia[k].ventas += Number(v.total);
      porDia[k].trans += 1;
    });
    return {
      total, count, promedio, totalDescuentos,
      metodos: Object.entries(porMetodo).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
      tipos: Object.entries(porTipo).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })),
      serie: Object.values(porDia).sort((a, b) => a.dia.localeCompare(b.dia)),
    };
  }, [ventas]);

  const exportarCSV = () => {
    exportToCSV(`reporte-ventas-${rango}d`, stats.serie.map((d) => ({
      Día: d.dia, Ventas: d.ventas.toFixed(2), Transacciones: d.trans,
    })));
  };

  const imprimirPDF = () => {
    const filas = stats.serie.map((d) => `<tr><td>${d.dia}</td><td class="right">${d.trans}</td><td class="right">${formatPEN(d.ventas)}</td></tr>`).join("");
    const metodos = stats.metodos.map((m) => `<tr><td>${m.name}</td><td class="right">${formatPEN(m.value)}</td></tr>`).join("");
    printHTML(`Reporte de ventas ${rango}d`, `
      <h1>Reporte de ventas — últimos ${rango} días</h1>
      <div class="meta">Generado: ${new Date().toLocaleString("es-PE")}</div>
      <div style="display:flex;gap:20px;margin:14px 0;flex-wrap:wrap">
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Ventas totales</div><div class="total">${formatPEN(stats.total)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Transacciones</div><div class="total">${stats.count}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Ticket promedio</div><div class="total">${formatPEN(stats.promedio)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Gastos</div><div class="total" style="color:#dc2626">${formatPEN(gastosTotal)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Utilidad bruta</div><div class="total">${formatPEN(stats.total - gastosTotal)}</div></div>
      </div>
      <h2 style="font-size:13px;margin-top:18px">Ventas por día</h2>
      <table><thead><tr><th>Día</th><th class="right">Transacciones</th><th class="right">Ventas</th></tr></thead><tbody>${filas}</tbody></table>
      <h2 style="font-size:13px;margin-top:18px">Por método de pago</h2>
      <table><thead><tr><th>Método</th><th class="right">Monto</th></tr></thead><tbody>${metodos}</tbody></table>
    `);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Reportes
          </h1>
          <p className="text-muted-foreground">
            {rango === 'custom' && dateRange?.from 
              ? `Periodo: ${format(dateRange.from, 'dd/MM/yy')} - ${dateRange.to ? format(dateRange.to, 'dd/MM/yy') : '...'}`
              : `Análisis de ventas — últimos ${rango} días`}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 bg-card rounded-lg border p-1 flex-wrap">
            {([1, 3, 7, 15, 30, 90] as const).map((r) => (
              <button key={r} onClick={() => setRango(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 ${rango === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <CalendarIcon className="h-3 w-3" />{r}d
              </button>
            ))}
            
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  onClick={() => setRango('custom')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-1 ${rango === 'custom' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <CalendarDays className="h-3 w-3" />
                  {rango === 'custom' && dateRange?.from 
                    ? `${format(dateRange.from, 'dd/MM', { locale: es })}`
                    : 'Rango'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{ from: dateRange?.from, to: dateRange?.to }}
                  onSelect={(range: any) => setDateRange(range)}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button variant="outline" onClick={cargar} className="font-semibold" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 text-blue-600 ${loading ? "animate-spin" : ""}`} />Actualizar
          </Button>
          <Button variant="outline" onClick={exportarCSV} className="font-semibold">
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Excel
          </Button>
          <Button variant="outline" onClick={imprimirPDF} className="font-semibold">
            <Printer className="h-4 w-4 mr-2 text-rose-600" />PDF
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Card className="p-3 border-red-300 bg-red-50 text-red-700 text-sm font-medium">
          {errorMsg}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-card border-indigo-200">
          <div className="text-[11px] text-indigo-700 uppercase font-semibold">Descuentos</div>
          <div className="text-2xl font-extrabold text-indigo-700 mt-1">{formatPEN(stats.totalDescuentos)}</div>
        </Card>
        <Card className="p-4"><div className="text-[11px] text-muted-foreground uppercase font-semibold">Ventas</div><div className="text-2xl font-extrabold text-primary mt-1">{formatPEN(stats.total)}</div></Card>
        <Card className="p-4"><div className="text-[11px] text-muted-foreground uppercase font-semibold">Transacciones</div><div className="text-2xl font-extrabold mt-1">{stats.count}</div></Card>
        <Card className="p-4"><div className="text-[11px] text-muted-foreground uppercase font-semibold">Ticket promedio</div><div className="text-2xl font-extrabold mt-1">{formatPEN(stats.promedio)}</div></Card>
        <Card className="p-4"><div className="text-[11px] text-muted-foreground uppercase font-semibold">Gastos</div><div className="text-2xl font-extrabold text-red-600 mt-1">{formatPEN(gastosTotal)}</div></Card>
        <Card className="p-4 col-span-2 md:col-span-1 bg-gradient-to-br from-emerald-50 to-card border-emerald-200">
          <div className="text-[11px] text-emerald-700 uppercase font-semibold">Utilidad bruta</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{formatPEN(stats.total - gastosTotal)}</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Evolución de ventas</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.serie}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
              <Tooltip formatter={(v: number) => formatPEN(v)} contentStyle={{ borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Ventas (S/)" />
              <Line type="monotone" dataKey="trans" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Transacciones" yAxisId="right" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-bold mb-3">Distribución por método de pago</div>
          {stats.metodos.length === 0 ? <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div> : (
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stats.metodos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.name}: ${formatPEN(e.value)}`}>
                    {stats.metodos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatPEN(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="font-bold mb-3">Por tipo de comprobante</div>
          {stats.tipos.length === 0 ? <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div> : (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={stats.tipos} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(v: number) => formatPEN(v)} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                    {stats.tipos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        <Card className="p-5">
          <div className="font-bold mb-3 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Top 10 productos</div>
          {topProductos.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-1">Producto</th><th className="py-1 text-right">Unid.</th><th className="py-1 text-right">Total</th></tr>
              </thead>
              <tbody>
                {topProductos.map((p) => (
                  <tr key={p.nombre} className="border-t">
                    <td className="py-2">{p.nombre}</td>
                    <td className="py-2 text-right font-semibold">{p.cantidad}</td>
                    <td className="py-2 text-right font-bold text-emerald-600">{formatPEN(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-5">
          <div className="font-bold mb-3">Ventas por hora del día</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={porHora}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                <Tooltip formatter={(v: number) => formatPEN(v)} />
                <Bar dataKey="ventas" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

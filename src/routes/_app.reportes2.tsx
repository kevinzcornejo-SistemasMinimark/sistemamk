import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Scale, TrendingUp, TrendingDown, Calendar, RefreshCw,
  FileSpreadsheet, Printer, ShoppingCart, Receipt, DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatPEN } from "@/lib/format";
import { exportToCSV, printHTML } from "@/lib/exporters";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/reportes2")({
  head: () => ({ meta: [{ title: "Reporte comparativo — POS Minimarket" }] }),
  component: Reportes2Page,
});

type Row = { fecha: string; ventas: number; compras: number; gastos: number };

function Reportes2Page() {
  const { user, isDemo } = useAuth();
  const [rango, setRango] = useState<7 | 15 | 30 | 90>(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [tot, setTot] = useState({ ventas: 0, compras: 0, gastos: 0 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = async () => {
    if (isDemo || !user) return;
    setLoading(true); setErr(null);
    try {
      const desde = new Date(); desde.setDate(desde.getDate() - rango);
      const desdeIso = desde.toISOString();
      const desdeDate = desde.toISOString().slice(0, 10);

      const [vRes, cRes, gRes] = await Promise.all([
        supabase.from("ventas").select("creada_en,total,estado").gte("creada_en", desdeIso).neq("estado", "ANULADA"),
        supabase.from("compras").select("creada_en,total,estado").gte("creada_en", desdeIso),
        supabase.from("gastos").select("fecha,monto").gte("fecha", desdeDate),
      ]);
      if (vRes.error) throw vRes.error;
      if (cRes.error) throw cRes.error;

      const map: Record<string, Row> = {};
      const ensure = (k: string) => (map[k] ??= { fecha: k, ventas: 0, compras: 0, gastos: 0 });

      let tV = 0, tC = 0, tG = 0;
      (vRes.data ?? []).forEach((r: any) => {
        const k = r.creada_en.slice(0, 10);
        ensure(k).ventas += Number(r.total);
        tV += Number(r.total);
      });
      (cRes.data ?? []).forEach((r: any) => {
        if (r.estado === "ANULADA") return;
        const k = r.creada_en.slice(0, 10);
        ensure(k).compras += Number(r.total);
        tC += Number(r.total);
      });
      (gRes.data ?? []).forEach((r: any) => {
        const k = String(r.fecha).slice(0, 10);
        ensure(k).gastos += Number(r.monto);
        tG += Number(r.monto);
      });

      const out = Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => ({
        ...r,
        ventas: Number(r.ventas.toFixed(2)),
        compras: Number(r.compras.toFixed(2)),
        gastos: Number(r.gastos.toFixed(2)),
      }));
      setRows(out);
      setTot({ ventas: tV, compras: tC, gastos: tG });
    } catch (e: any) {
      setErr(e?.message ?? "Error cargando reporte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [user?.id, isDemo, rango]);

  const utilidad = tot.ventas - tot.compras - tot.gastos;
  const margen = tot.ventas > 0 ? (utilidad / tot.ventas) * 100 : 0;

  const pie = useMemo(() => ([
    { name: "Ventas", value: Number(tot.ventas.toFixed(2)) },
    { name: "Compras", value: Number(tot.compras.toFixed(2)) },
    { name: "Gastos", value: Number(tot.gastos.toFixed(2)) },
  ]), [tot]);

  const exportarCSV = () => {
    exportToCSV(`reporte-comparativo-${rango}d`, rows.map((r) => ({
      Fecha: r.fecha, Ventas: r.ventas.toFixed(2), Compras: r.compras.toFixed(2),
      Gastos: r.gastos.toFixed(2), Utilidad: (r.ventas - r.compras - r.gastos).toFixed(2),
    })));
  };

  const imprimirPDF = () => {
    const filas = rows.map((r) => {
      const u = r.ventas - r.compras - r.gastos;
      return `<tr><td>${r.fecha}</td>
        <td class="right">${formatPEN(r.ventas)}</td>
        <td class="right">${formatPEN(r.compras)}</td>
        <td class="right">${formatPEN(r.gastos)}</td>
        <td class="right" style="color:${u >= 0 ? "#059669" : "#dc2626"};font-weight:700">${formatPEN(u)}</td></tr>`;
    }).join("");
    printHTML(`Comparativo ${rango}d`, `
      <h1>Reporte comparativo — Ventas vs Compras vs Gastos</h1>
      <div class="meta">Últimos ${rango} días · Generado: ${new Date().toLocaleString("es-PE")}</div>
      <div style="display:flex;gap:20px;margin:14px 0;flex-wrap:wrap">
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Ventas</div><div class="total">${formatPEN(tot.ventas)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Compras</div><div class="total" style="color:#0ea5e9">${formatPEN(tot.compras)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Gastos</div><div class="total" style="color:#dc2626">${formatPEN(tot.gastos)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Utilidad neta</div><div class="total" style="color:${utilidad >= 0 ? "#059669" : "#dc2626"}">${formatPEN(utilidad)}</div></div>
        <div><div style="font-size:10px;color:#64748b;text-transform:uppercase">Margen</div><div class="total">${margen.toFixed(1)}%</div></div>
      </div>
      <table><thead><tr><th>Fecha</th><th class="right">Ventas</th><th class="right">Compras</th><th class="right">Gastos</th><th class="right">Utilidad</th></tr></thead><tbody>${filas}</tbody></table>
    `);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" /> Reporte comparativo
          </h1>
          <p className="text-muted-foreground">Ventas vs Compras vs Gastos — últimos {rango} días</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-card rounded-lg border p-1">
            {([7, 15, 30, 90] as const).map((r) => (
              <button key={r} onClick={() => setRango(r)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md ${rango === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                <Calendar className="h-3 w-3 inline mr-1" />{r}d
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={cargar} disabled={loading} className="font-semibold">
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

      {err && (
        <Card className="p-3 border-red-300 bg-red-50 text-red-700 text-sm font-medium">{err}</Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-card border-emerald-200">
          <div className="text-[11px] text-emerald-700 uppercase font-semibold flex items-center gap-1"><Receipt className="h-3 w-3" />Ventas</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{formatPEN(tot.ventas)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-sky-50 to-card border-sky-200">
          <div className="text-[11px] text-sky-700 uppercase font-semibold flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Compras</div>
          <div className="text-2xl font-extrabold text-sky-700 mt-1">{formatPEN(tot.compras)}</div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-50 to-card border-red-200">
          <div className="text-[11px] text-red-700 uppercase font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" />Gastos</div>
          <div className="text-2xl font-extrabold text-red-700 mt-1">{formatPEN(tot.gastos)}</div>
        </Card>
        <Card className={`p-4 bg-gradient-to-br ${utilidad >= 0 ? "from-teal-50 border-teal-200" : "from-rose-50 border-rose-200"} to-card`}>
          <div className="text-[11px] uppercase font-semibold flex items-center gap-1">
            {utilidad >= 0 ? <TrendingUp className="h-3 w-3 text-teal-700" /> : <TrendingDown className="h-3 w-3 text-rose-700" />}
            Utilidad neta
          </div>
          <div className={`text-2xl font-extrabold mt-1 ${utilidad >= 0 ? "text-teal-700" : "text-rose-700"}`}>{formatPEN(utilidad)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] text-muted-foreground uppercase font-semibold">Margen</div>
          <div className={`text-2xl font-extrabold mt-1 ${margen >= 0 ? "text-emerald-600" : "text-red-600"}`}>{margen.toFixed(1)}%</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Evolución diaria</div>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
              <Tooltip formatter={(v: number) => formatPEN(v)} contentStyle={{ borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} name="Ventas" />
              <Line type="monotone" dataKey="compras" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="Compras" />
              <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Gastos" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-bold mb-3">Comparativo por día</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `S/${v}`} />
                <Tooltip formatter={(v: number) => formatPEN(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ventas" fill="#10b981" radius={[4, 4, 0, 0]} name="Ventas" />
                <Bar dataKey="compras" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Compras" />
                <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-bold mb-3">Distribución total</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={(e: any) => `${e.name}: ${formatPEN(e.value)}`}>
                  <Cell fill="#10b981" />
                  <Cell fill="#0ea5e9" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip formatter={(v: number) => formatPEN(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="font-bold mb-3">Detalle diario</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="py-2">Fecha</th>
                <th className="py-2 text-right">Ventas</th>
                <th className="py-2 text-right">Compras</th>
                <th className="py-2 text-right">Gastos</th>
                <th className="py-2 text-right">Utilidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sin movimientos en el periodo</td></tr>
              ) : rows.map((r) => {
                const u = r.ventas - r.compras - r.gastos;
                return (
                  <tr key={r.fecha} className="border-t">
                    <td className="py-2 font-medium">{r.fecha}</td>
                    <td className="py-2 text-right text-emerald-600 font-semibold">{formatPEN(r.ventas)}</td>
                    <td className="py-2 text-right text-sky-600 font-semibold">{formatPEN(r.compras)}</td>
                    <td className="py-2 text-right text-red-600 font-semibold">{formatPEN(r.gastos)}</td>
                    <td className={`py-2 text-right font-extrabold ${u >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatPEN(u)}</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 font-extrabold">
                <tr>
                  <td className="py-2">TOTAL</td>
                  <td className="py-2 text-right text-emerald-700">{formatPEN(tot.ventas)}</td>
                  <td className="py-2 text-right text-sky-700">{formatPEN(tot.compras)}</td>
                  <td className="py-2 text-right text-red-700">{formatPEN(tot.gastos)}</td>
                  <td className={`py-2 text-right ${utilidad >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatPEN(utilidad)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

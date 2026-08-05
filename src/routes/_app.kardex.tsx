import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ScrollText, Search, FileDown, Printer, RefreshCw, TrendingUp, TrendingDown, Boxes, Filter, X,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";
import { exportToCSV, printHTML } from "@/lib/exporters";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kardex")({
  head: () => ({
    meta: [
      { title: "Kardex de inventario — POS Minimarket" },
      { name: "description", content: "Historial de movimientos de inventario con filtros, gráficos y exportación a PDF/CSV." },
      { property: "og:title", content: "Kardex de inventario — POS Minimarket" },
      { property: "og:description", content: "Entradas, salidas y saldos de tu inventario en tiempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KardexPage,
});

type Mov = {
  id: number;
  tipo: string;
  cantidad: number;
  saldo: number | null;
  costo_unitario: number | null;
  documento: string | null;
  motivo: string | null;
  creado_en: string;
  productos: { nombre: string } | null;
};

const ENTRADAS = ["COMPRA", "ENTRADA", "DEVOLUCION", "AJUSTE_POSITIVO"];
const hoy = () => new Date().toISOString().slice(0, 10);
const hace = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const money = (n: number) => `S/ ${n.toFixed(2)}`;

function KardexPage() {
  const { user, isDemo } = useAuth();
  const negocio = useBusinessInfo();
  const [rows, setRows] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("TODOS");
  const [desde, setDesde] = useState(hace(30));
  const [hasta, setHasta] = useState(hoy());

  const load = async () => {
    if (isDemo || !user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("kardex")
      .select("id,tipo,cantidad,saldo,costo_unitario,documento,motivo,creado_en,productos(nombre)")
      .gte("creado_en", `${desde}T00:00:00`)
      .lte("creado_en", `${hasta}T23:59:59`)
      .order("creado_en", { ascending: false })
      .limit(2000);
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id, isDemo, desde, hasta]);

  const tipos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.tipo))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipo !== "TODOS" && r.tipo !== tipo) return false;
      if (!k) return true;
      return (
        (r.productos?.nombre ?? "").toLowerCase().includes(k) ||
        r.tipo.toLowerCase().includes(k) ||
        (r.documento ?? "").toLowerCase().includes(k) ||
        (r.motivo ?? "").toLowerCase().includes(k)
      );
    });
  }, [rows, q, tipo]);

  const kpis = useMemo(() => {
    let entradas = 0, salidas = 0, valor = 0;
    filtered.forEach((r) => {
      const c = Number(r.cantidad ?? 0);
      if (c >= 0) entradas += c; else salidas += Math.abs(c);
      valor += Math.abs(c) * Number(r.costo_unitario ?? 0);
    });
    return { entradas, salidas, valor, total: filtered.length };
  }, [filtered]);

  const chartData = useMemo(() => {
    const map = new Map<string, { dia: string; entradas: number; salidas: number }>();
    filtered.forEach((r) => {
      const dia = new Date(r.creado_en).toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" });
      const e = map.get(dia) ?? { dia, entradas: 0, salidas: 0 };
      const c = Number(r.cantidad ?? 0);
      if (c >= 0) e.entradas += c; else e.salidas += Math.abs(c);
      map.set(dia, e);
    });
    return Array.from(map.values()).reverse().slice(-14);
  }, [filtered]);

  const topProductos = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      const n = r.productos?.nombre ?? "—";
      map.set(n, (map.get(n) ?? 0) + Math.abs(Number(r.cantidad ?? 0)));
    });
    return Array.from(map, ([nombre, cant]) => ({ nombre, cant }))
      .sort((a, b) => b.cant - a.cant)
      .slice(0, 8);
  }, [filtered]);

  const tipoColor = (t: string) =>
    ENTRADAS.includes(t) ? "bg-emerald-500" :
    ["VENTA", "SALIDA", "ANULACION", "MERMA"].includes(t) ? "bg-destructive" :
    "bg-muted-foreground";

  const exportCSV = () => {
    if (filtered.length === 0) return toast.error("Sin datos para exportar");
    exportToCSV(
      `kardex_${desde}_${hasta}`,
      filtered.map((r) => ({
        Fecha: new Date(r.creado_en).toLocaleString("es-PE"),
        Producto: r.productos?.nombre ?? "",
        Tipo: r.tipo,
        Cantidad: r.cantidad,
        Saldo: r.saldo ?? "",
        Costo: r.costo_unitario ?? "",
        Documento: r.documento ?? "",
        Motivo: r.motivo ?? "",
      })),
    );
  };

  const exportPDF = () => {
    if (filtered.length === 0) return toast.error("Sin datos para exportar");
    const filas = filtered.map((r) => `<tr>
      <td>${new Date(r.creado_en).toLocaleString("es-PE")}</td>
      <td>${r.productos?.nombre ?? "—"}</td>
      <td>${r.tipo}</td>
      <td class="right">${r.cantidad}</td>
      <td class="right">${r.saldo ?? "—"}</td>
      <td>${r.documento ?? "—"}</td>
      <td>${r.motivo ?? "—"}</td>
    </tr>`).join("");
    printHTML(`Kardex ${desde} al ${hasta}`, `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        ${negocio.logo ? `<img src="${negocio.logo}" style="max-height:60px" />` : ""}
        <div>
          <h1>${negocio.nombre}</h1>
          <div class="meta">RUC ${negocio.ruc} · ${negocio.direccion}</div>
        </div>
      </div>
      <h1>Kardex de inventario</h1>
      <div class="meta">Del ${desde} al ${hasta} · Tipo: ${tipo} · ${filtered.length} movimientos</div>
      <div class="meta">Entradas: <b>${kpis.entradas}</b> · Salidas: <b>${kpis.salidas}</b> · Valor movido: <b>${money(kpis.valor)}</b></div>
      <table><thead><tr>
        <th>Fecha</th><th>Producto</th><th>Tipo</th><th class="right">Cant.</th>
        <th class="right">Saldo</th><th>Documento</th><th>Motivo</th>
      </tr></thead><tbody>${filas}</tbody></table>
    `);
  };

  const limpiar = () => { setQ(""); setTipo("TODOS"); setDesde(hace(30)); setHasta(hoy()); };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> Kardex
          </h1>
          <p className="text-muted-foreground">Historial de movimientos de inventario</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileDown className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <Printer className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      </div>

      {isDemo && <Card className="p-4 text-sm border-amber-500/30 bg-amber-500/5">Modo demo · sin datos reales</Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Entradas</div>
          <div className="text-2xl font-extrabold text-emerald-600">{kpis.entradas}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3.5 w-3.5 text-destructive" /> Salidas</div>
          <div className="text-2xl font-extrabold text-destructive">{kpis.salidas}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> Movimientos</div>
          <div className="text-2xl font-extrabold">{kpis.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Valor movido</div>
          <div className="text-2xl font-extrabold">{money(kpis.valor)}</div>
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4" /> Filtros</div>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Producto, tipo, documento o motivo…" className="pl-9" />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <div className="flex gap-2">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            <Button variant="ghost" size="icon" onClick={limpiar} title="Limpiar filtros"><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[["Hoy", 0], ["7 días", 7], ["30 días", 30], ["90 días", 90]].map(([l, d]) => (
            <Button key={l as string} variant="secondary" size="sm"
              onClick={() => { setDesde(hace(d as number)); setHasta(hoy()); }}>
              {l as string}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Entradas vs salidas por día</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="salidas" name="Salidas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Productos con más movimiento</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductos} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="nombre" width={110} fontSize={11} />
                <Tooltip />
                <Bar dataKey="cant" name="Unidades" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase sticky top-0">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Cantidad</th>
                <th className="px-4 py-2 text-right">Saldo</th>
                <th className="px-4 py-2 text-right">Costo</th>
                <th className="px-4 py-2">Documento</th>
                <th className="px-4 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin movimientos en este rango</td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="border-t hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap text-xs">{new Date(m.creado_en).toLocaleString("es-PE")}</td>
                  <td className="px-4 py-2 font-medium">{m.productos?.nombre ?? "—"}</td>
                  <td className="px-4 py-2"><Badge className={tipoColor(m.tipo)}>{m.tipo}</Badge></td>
                  <td className={`px-4 py-2 text-right font-mono font-semibold ${Number(m.cantidad) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {Number(m.cantidad) >= 0 ? `+${m.cantidad}` : m.cantidad}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">{m.saldo ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-xs">{m.costo_unitario != null ? money(Number(m.costo_unitario)) : "—"}</td>
                  <td className="px-4 py-2 text-xs font-mono">{m.documento ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{m.motivo ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

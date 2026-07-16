import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Layers, Search, Plus, AlertTriangle, ShieldAlert, ShieldCheck,
  Trash2, Snowflake, Candy, Package, Ban,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/hooks/useCatalog";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";


export const Route = createFileRoute("/_app/lotes")({
  head: () => ({ meta: [{ title: "Lotes — POS Minimarket" }] }),
  component: LotesPage,
});

type Lote = {
  id: string;
  producto_id: string;
  numero_lote: string;
  fecha_produccion: string | null;
  fecha_vencimiento: string | null;
  cantidad_inicial: number;
  cantidad_actual: number;
  costo_unitario: number | null;
  bloqueado?: boolean;
  creado_en?: string | null;
  productos: { nombre: string } | null;
};

function diasRestantes(f: string | null) {
  if (!f) return null;
  return Math.ceil((new Date(f).getTime() - Date.now()) / 86400000);
}

type EstadoLote = "vencido" | "porVencer" | "enRiesgo" | "proximo" | "disponible" | "sinFecha";

function estadoDe(l: Lote): EstadoLote {
  const d = diasRestantes(l.fecha_vencimiento);
  if (d === null) return "sinFecha";
  if (d < 0) return "vencido";
  if (d <= 7) return "enRiesgo";
  if (d <= 30) return "porVencer";
  if (d <= 60) return "proximo";
  return "disponible";
}

function EstadoBadge({ estado, dias }: { estado: EstadoLote; dias: number | null }) {
  if (estado === "vencido") return <Badge variant="destructive">Vencido</Badge>;
  if (estado === "enRiesgo") return <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">En riesgo</Badge>;
  if (estado === "porVencer") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">Disponible</Badge>;
  if (estado === "proximo") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">Disponible</Badge>;
  if (estado === "disponible") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">Disponible</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function ProximoTag({ dias }: { dias: number | null }) {
  if (dias === null || dias < 0 || dias > 60) return null;
  return <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] tracking-wide">PRÓXIMO</Badge>;
}

function iconoCategoria(nombre: string) {
  const n = nombre.toLowerCase();
  if (n.includes("helad")) return <Snowflake className="h-4 w-4 text-sky-500" />;
  if (n.includes("golos") || n.includes("dulc") || n.includes("snack") || n.includes("galle") || n.includes("choc")) return <Candy className="h-4 w-4 text-pink-500" />;
  return <Package className="h-4 w-4 text-muted-foreground" />;
}

function LotesPage() {
  const { user, isDemo } = useAuth();
  const { productos, categorias } = useCatalog();
  const [rows, setRows] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});

  const load = async () => {
    if (isDemo || !user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("lotes")
      .select("id,producto_id,numero_lote,fecha_produccion,fecha_vencimiento,cantidad_inicial,cantidad_actual,costo_unitario,bloqueado,creado_en,productos(nombre,categoria_id)")
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id, isDemo]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const k = q.toLowerCase();
    return rows.filter((r) => r.numero_lote.toLowerCase().includes(k) || (r.productos?.nombre ?? "").toLowerCase().includes(k));
  }, [rows, q]);

  const productoMap = useMemo(() => {
    const m = new Map<string, { nombre: string; categoria_id: string }>();
    productos.forEach((p) => m.set(p.id, { nombre: p.nombre, categoria_id: p.categoria_id }));
    return m;
  }, [productos]);
  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    categorias.forEach((c) => m.set(c.id, c.nombre));
    return m;
  }, [categorias]);

  const kpis = useMemo(() => {
    const total = rows.length;
    let golosinas = 0, helados = 0, porVencer = 0, bloqueados = 0;
    rows.forEach((l) => {
      const catId = productoMap.get(l.producto_id)?.categoria_id ?? "";
      const cat = (catMap.get(catId) ?? "").toLowerCase();
      if (cat.includes("helad")) helados++;
      if (cat.includes("golos") || cat.includes("snack") || cat.includes("dulc")) golosinas++;
      const e = estadoDe(l);
      if (e === "porVencer" || e === "enRiesgo") porVencer++;
      if (l.bloqueado) bloqueados++;
    });
    return { total, golosinas, helados, porVencer, bloqueados };
  }, [rows, productoMap, catMap]);

  const alertas = useMemo(() =>
    rows.filter((l) => {
      const e = estadoDe(l);
      return e === "enRiesgo" || e === "porVencer" || e === "vencido" || l.bloqueado;
    }).slice(0, 6)
  , [rows]);

  // Agrupar por producto y ordenar FIFO (vencimiento ascendente)
  const grupos = useMemo(() => {
    const map = new Map<string, Lote[]>();
    filtered.forEach((l) => {
      const k = l.producto_id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    });
    return Array.from(map.entries()).map(([pid, lotes]) => ({
      pid,
      nombre: lotes[0].productos?.nombre ?? productoMap.get(pid)?.nombre ?? "Producto",
      categoria: catMap.get(productoMap.get(pid)?.categoria_id ?? "") ?? "",
      stock: lotes.reduce((s, x) => s + (x.bloqueado ? 0 : Number(x.cantidad_actual ?? 0)), 0),
      lotes: lotes.sort((a, b) => {
        const da = a.fecha_vencimiento ? new Date(a.fecha_vencimiento).getTime() : Infinity;
        const db = b.fecha_vencimiento ? new Date(b.fecha_vencimiento).getTime() : Infinity;
        return da - db;
      }),
    }));
  }, [filtered, productoMap, catMap]);

  const save = async () => {
    if (!f.producto_id || !f.numero_lote || !f.cantidad_inicial) return toast.error("Completa los datos");
    const payload = {
      producto_id: f.producto_id,
      numero_lote: f.numero_lote,
      fecha_produccion: f.fecha_produccion || null,
      fecha_vencimiento: f.fecha_vencimiento || null,
      cantidad_inicial: Number(f.cantidad_inicial),
      cantidad_actual: Number(f.cantidad_inicial),
      costo_unitario: f.costo_unitario ? Number(f.costo_unitario) : null,
      bloqueado: false,
    };
    const { error } = await supabase.from("lotes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Lote registrado"); setOpen(false); setF({}); void load();
  };

  const toggleBloqueo = async (l: Lote) => {
    const { error } = await supabase.from("lotes").update({ bloqueado: !l.bloqueado }).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(l.bloqueado ? "Lote reactivado" : "Lote bloqueado");
    void load();
  };
  const eliminar = async (l: Lote) => {
    if (!confirm(`¿Eliminar el lote ${l.numero_lote}?`)) return;
    const { error } = await supabase.from("lotes").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Lote eliminado"); void load();
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Layers className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Gestión de Lotes</h1>
            <p className="text-sm text-muted-foreground">
              FIFO automático · Control de vencimientos · Helados con prioridad
            </p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-1" />Registrar lote
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Layers className="h-4 w-4" />} label="Lotes totales" value={kpis.total} />
        <KpiCard icon={<Candy className="h-4 w-4 text-pink-500" />} label="Golosinas" value={kpis.golosinas} />
        <KpiCard icon={<Snowflake className="h-4 w-4 text-sky-500" />} label="Helados" value={kpis.helados} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Por vencer" value={kpis.porVencer} tone="amber" />
        <KpiCard icon={<ShieldAlert className="h-4 w-4 text-rose-500" />} label="Bloqueados" value={kpis.bloqueados} tone="rose" />
      </div>

      {/* Alertas activas */}
      {alertas.length > 0 && (
        <Card className="p-4 bg-amber-50/60 border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-amber-900">Alertas activas ({alertas.length})</span>
          </div>
          <div className="divide-y divide-amber-200/60">
            {alertas.map((l) => {
              const d = diasRestantes(l.fecha_vencimiento);
              const e = estadoDe(l);
              const catNombre = catMap.get(productoMap.get(l.producto_id)?.categoria_id ?? "") ?? "";
              return (
                <div key={l.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    {iconoCategoria(catNombre)}
                    <span className="font-medium">{l.productos?.nombre}</span>
                    <span className="text-muted-foreground">· Lote {l.numero_lote}</span>
                  </div>
                  <span className={cn(
                    "font-medium",
                    l.bloqueado ? "text-rose-600" :
                    e === "vencido" ? "text-rose-600" :
                    e === "enRiesgo" ? "text-amber-700" : "text-amber-600",
                  )}>
                    {l.bloqueado ? "Bloqueado — no vendible"
                      : e === "vencido" ? "Vencido"
                      : e === "enRiesgo" ? "En riesgo — no vendible"
                      : `Vence en ${d}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lote o producto…" className="pl-9" />
      </div>

      {/* Grupos por producto */}
      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">Cargando…</Card>
      ) : grupos.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Sin lotes registrados</Card>
      ) : grupos.map((g) => (
        <Card key={g.pid} className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {iconoCategoria(g.categoria)}
              <h3 className="font-semibold">{g.nombre}</h3>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Stock disponible:</span>
              <Badge className="bg-slate-900 hover:bg-slate-900 text-white">{g.stock}</Badge>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="text-left px-5 py-2 font-medium">Lote</th>
                <th className="text-left px-5 py-2 font-medium">Ingreso</th>
                <th className="text-left px-5 py-2 font-medium">Vence</th>
                <th className="text-left px-5 py-2 font-medium">Stock</th>
                <th className="text-left px-5 py-2 font-medium">Estado</th>
                <th className="text-right px-5 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {g.lotes.map((l) => {
                const d = diasRestantes(l.fecha_vencimiento);
                const e = estadoDe(l);
                const rowBg = l.bloqueado ? "bg-rose-50/50" : e === "vencido" ? "bg-rose-50/40" : e === "enRiesgo" ? "bg-amber-50/40" : "bg-emerald-50/30";
                return (
                  <tr key={l.id} className={cn("border-b last:border-0", rowBg)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{l.numero_lote}</span>
                        {!l.bloqueado && <ProximoTag dias={d} />}
                        {l.bloqueado && <Badge variant="destructive" className="text-[10px]">BLOQUEADO</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {l.creado_en ? formatDate(l.creado_en) : (l.fecha_produccion ? formatDate(l.fecha_produccion) : "—")}
                    </td>
                    <td className="px-5 py-3">
                      {l.fecha_vencimiento ? (
                        <div>
                          <div>{formatDate(l.fecha_vencimiento)}</div>
                          {d !== null && (
                            <div className={cn("text-xs", d < 0 ? "text-rose-600" : d <= 7 ? "text-amber-700" : "text-muted-foreground")}>
                              {d < 0 ? `Vencido hace ${-d}d` : `En ${d}d`}
                            </div>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 font-medium">{l.cantidad_actual}/{l.cantidad_inicial}</td>
                    <td className="px-5 py-3">
                      {l.bloqueado
                        ? <Badge variant="destructive">Bloqueado</Badge>
                        : e === "enRiesgo"
                          ? <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">En riesgo</Badge>
                          : <EstadoBadge estado={e} dias={d} />}
                      {!l.bloqueado && (e === "porVencer" || e === "enRiesgo") && d !== null && (
                        <div className="text-xs text-amber-700 mt-1">Vence en {d}d</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {l.bloqueado ? (
                          <Button size="sm" variant="ghost" onClick={() => toggleBloqueo(l)} className="text-emerald-700 hover:text-emerald-800">
                            <ShieldCheck className="h-4 w-4 mr-1" /> Reactivar
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" title="Bloquear" onClick={() => toggleBloqueo(l)}>
                            <Ban className="h-4 w-4 text-amber-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Eliminar" onClick={() => eliminar(l)}>
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar lote</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Producto</Label>
              <Select value={f.producto_id ?? ""} onValueChange={(v) => setF({ ...f, producto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>N° Lote</Label><Input value={f.numero_lote ?? ""} onChange={(e) => setF({ ...f, numero_lote: e.target.value })} /></div>
            <div><Label>Cantidad</Label><Input type="number" value={f.cantidad_inicial ?? ""} onChange={(e) => setF({ ...f, cantidad_inicial: e.target.value })} /></div>
            <div><Label>Fecha producción</Label><Input type="date" value={f.fecha_produccion ?? ""} onChange={(e) => setF({ ...f, fecha_produccion: e.target.value })} /></div>
            <div><Label>Fecha vencimiento</Label><Input type="date" value={f.fecha_vencimiento ?? ""} onChange={(e) => setF({ ...f, fecha_vencimiento: e.target.value })} /></div>
            <div className="col-span-2"><Label>Costo unitario</Label><Input type="number" step="0.01" value={f.costo_unitario ?? ""} onChange={(e) => setF({ ...f, costo_unitario: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "amber" | "rose" }) {
  return (
    <Card className={cn(
      "p-4",
      tone === "amber" && "bg-amber-50/60 border-amber-200",
      tone === "rose" && "bg-rose-50/60 border-rose-200",
    )}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </Card>
  );
}
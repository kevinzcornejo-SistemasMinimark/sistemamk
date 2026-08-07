import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Percent, FileSpreadsheet, RefreshCw, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPEN } from "@/lib/format";
import { exportToCSV } from "@/lib/exporters";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/descuentos")({
  head: () => ({ meta: [{ title: "Reporte de Descuentos — POS Minimarket" }] }),
  component: DescuentosReporte,
});

type Rango = "hoy" | "ayer" | "semana" | "mes" | "rango" | "todos";

function rangoFechas(r: Rango, desde?: string, hasta?: string) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (r) {
    case "todos":
      return { desde: new Date(2000, 0, 1).toISOString(), hasta: iso(endOfDay(now)) };
    case "hoy":
      return { desde: iso(startOfDay(now)), hasta: iso(endOfDay(now)) };
    case "ayer": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { desde: iso(startOfDay(y)), hasta: iso(endOfDay(y)) };
    }
    case "semana": {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      return { desde: iso(startOfDay(d)), hasta: iso(endOfDay(now)) };
    }
    case "mes": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { desde: iso(startOfDay(d)), hasta: iso(endOfDay(now)) };
    }
    case "rango":
      return {
        desde: desde ? iso(new Date(desde + "T00:00:00")) : iso(startOfDay(now)),
        hasta: hasta ? iso(new Date(hasta + "T23:59:59")) : iso(endOfDay(now)),
      };
  }
}

function DescuentosReporte() {
  const [rango, setRango] = useState<Rango>("hoy");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState<string>("__all__");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { desde: d1, hasta: d2 } = rangoFechas(rango, desde, hasta);
      let q = supabase
        .from("descuentos_auditoria")
        .select("id, creado_en, tipo, aplicado_a, valor, monto_descuento, motivo, motivo_texto, autorizado_por, usuario_id, venta_id, producto_id")
        .gte("creado_en", d1)
        .lte("creado_en", d2)
        .order("creado_en", { ascending: false });
      if (motivo !== "__all__") q = q.eq("motivo", motivo);
      const { data, error } = await q;
      if (error) throw error;
      let out = data ?? [];
      // Respaldo: si no hay auditoría, mostrar las ventas que tienen descuento
      if (out.length === 0 && motivo === "__all__") {
        const { data: v } = await supabase
          .from("ventas")
          .select("id, creada_en, subtotal, descuento, total")
          .gt("descuento", 0)
          .gte("creada_en", d1)
          .lte("creada_en", d2)
          .order("creada_en", { ascending: false });
        out = (v ?? []).map((r: any) => ({
          id: r.id,
          creado_en: r.creada_en,
          tipo: "monto",
          aplicado_a: "total",
          valor: r.descuento,
          monto_descuento: r.descuento,
          motivo: "Sin registro de motivo",
          motivo_texto: null,
          autorizado_por: null,
          usuario_id: null,
          venta_id: r.id,
          producto_id: null,
        }));
      }
      setRows(out);
    } catch (e: any) {
      // Si la tabla no existe todavía
      if (String(e?.message ?? "").includes("does not exist") || e?.code === "42P01") {
        toast.error("Ejecuta el SQL sql/descuentos-auditoria.sql en tu base de datos");
      } else {
        toast.error(e?.message ?? "Error al cargar descuentos");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rango, motivo]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.monto_descuento || 0), 0), [rows]);

  const exportar = () => {
    if (rows.length === 0) { toast.info("No hay datos para exportar"); return; }
    exportToCSV(
      `descuentos_${new Date().toISOString().slice(0,10)}`,
      rows.map((r) => ({
        Fecha: new Date(r.creado_en).toLocaleString("es-PE"),
        Tipo: r.tipo,
        AplicadoA: r.aplicado_a,
        Valor: r.valor,
        Descuento: Number(r.monto_descuento).toFixed(2),
        Motivo: r.motivo === "Otro" ? r.motivo_texto : r.motivo,
        Autorizador: r.autorizado_por ?? "",
        Venta: r.venta_id ?? "",
        Usuario: r.usuario_id ?? "",
      })),
    );
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Reporte de Descuentos</h1>
            <p className="text-xs text-muted-foreground">Historial y auditoría de descuentos aplicados en el POS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="h-10">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
          <Button onClick={exportar} className="h-10 bg-emerald-600 hover:bg-emerald-700">
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold uppercase text-muted-foreground">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-bold mb-1 block">Rango</label>
            <Select value={rango} onValueChange={(v) => setRango(v as Rango)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hoy">Hoy</SelectItem>
                <SelectItem value="ayer">Ayer</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mes</SelectItem>
                <SelectItem value="rango">Rango personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rango === "rango" && (
            <>
              <div>
                <label className="text-xs font-bold mb-1 block">Desde</label>
                <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10" />
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block">Hasta</label>
                <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-10" />
              </div>
              <div className="flex items-end">
                <Button onClick={load} className="h-10">Aplicar</Button>
              </div>
            </>
          )}
          <div>
            <label className="text-xs font-bold mb-1 block">Motivo</label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {["Cliente Frecuente","Promoción","Producto con pequeño daño","Producto próximo a vencer","Error de precio","Cortesía","Empleado","Convenio","Otro"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Descuentos</div>
          <div className="text-2xl font-black">{rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Monto total descontado</div>
          <div className="text-2xl font-black text-emerald-600">{formatPEN(total)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Promedio por descuento</div>
          <div className="text-2xl font-black">{formatPEN(rows.length ? total / rows.length : 0)}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold">Fecha</th>
                <th className="px-3 py-2 font-bold">Tipo</th>
                <th className="px-3 py-2 font-bold">Aplicado a</th>
                <th className="px-3 py-2 font-bold">Valor</th>
                <th className="px-3 py-2 font-bold text-right">Descuento</th>
                <th className="px-3 py-2 font-bold">Motivo</th>
                <th className="px-3 py-2 font-bold">Autorizador</th>
                <th className="px-3 py-2 font-bold">Venta</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                  {loading ? "Cargando..." : "No hay descuentos en el rango seleccionado."}
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.creado_en).toLocaleString("es-PE")}</td>
                  <td className="px-3 py-2 uppercase text-xs font-bold">{r.tipo}</td>
                  <td className="px-3 py-2 uppercase text-xs">{r.aplicado_a}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.tipo === "porcentaje" ? `${Number(r.valor).toFixed(0)}%` : formatPEN(Number(r.valor))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-600">
                    {formatPEN(Number(r.monto_descuento))}
                  </td>
                  <td className="px-3 py-2">{r.motivo === "Otro" ? r.motivo_texto : r.motivo}</td>
                  <td className="px-3 py-2 text-xs">{r.autorizado_por ?? "—"}</td>
                  <td className="px-3 py-2 text-xs font-mono">{r.venta_id ? String(r.venta_id).slice(0, 8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
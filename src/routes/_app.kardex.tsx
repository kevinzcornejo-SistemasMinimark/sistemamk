import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kardex")({
  head: () => ({ meta: [{ title: "Kardex — POS Minimarket" }] }),
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


function KardexPage() {
  const { user, isDemo } = useAuth();
  const [rows, setRows] = useState<Mov[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (isDemo || !user) { setRows([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("kardex")
        .select("id,tipo,cantidad,saldo,costo_unitario,documento,motivo,creado_en,productos(nombre)")
        .order("creado_en", { ascending: false })
        .limit(500);
      if (error) toast.error(error.message);
      setRows((data ?? []) as any);
      setLoading(false);
    })();
  }, [user?.id, isDemo]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const k = q.toLowerCase();
    return rows.filter((r) =>
      (r.productos?.nombre ?? "").toLowerCase().includes(k) ||
      r.tipo.toLowerCase().includes(k) ||
      (r.documento ?? "").toLowerCase().includes(k),
    );
  }, [rows, q]);

  const tipoColor = (t: string) =>
    t === "COMPRA" || t === "ENTRADA" || t === "DEVOLUCION" ? "bg-emerald-500" :
    t === "VENTA" || t === "SALIDA" || t === "ANULACION" ? "bg-destructive" :
    "bg-muted-foreground";


  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" /> Kardex
        </h1>
        <p className="text-muted-foreground">Historial de movimientos de inventario</p>
      </div>
      {isDemo && <Card className="p-4 text-sm border-amber-500/30 bg-amber-500/5">Modo demo · sin datos reales</Card>}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o tipo…" className="pl-9" />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2 text-right">Cantidad</th>
              <th className="px-4 py-2 text-right">Anterior</th>
              <th className="px-4 py-2 text-right">Nuevo</th>
              <th className="px-4 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin movimientos</td></tr>
            ) : filtered.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2 whitespace-nowrap text-xs">{new Date(m.creado_en).toLocaleString("es-PE")}</td>
                <td className="px-4 py-2 font-medium">{m.productos?.nombre ?? "—"}</td>
                <td className="px-4 py-2"><Badge className={tipoColor(m.tipo_movimiento)}>{m.tipo_movimiento}</Badge></td>
                <td className="px-4 py-2 text-right font-mono">{m.cantidad}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">{m.stock_anterior}</td>
                <td className="px-4 py-2 text-right font-semibold">{m.stock_nuevo}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{m.motivo ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
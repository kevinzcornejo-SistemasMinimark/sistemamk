import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Boxes, Search, AlertTriangle, FileSpreadsheet, Printer, PackagePlus, RefreshCcw } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import { formatPEN } from "@/lib/format";
import { exportToCSV, printHTML } from "@/lib/exporters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/inventario")({
  head: () => ({ meta: [{ title: "Inventario — POS Minimarket" }] }),
  component: InventarioPage,
});

function InventarioPage() {
  const { productos, loading, refresh: refetchCatalog } = useCatalog();
  const [q, setQ] = useState("");
  const [solo, setSolo] = useState<"todos" | "bajo" | "agotado" | "reponer">("todos");

  // Notificar a la campana cuando se entra en inventario
  useEffect(() => {
    if (!loading) {
      window.dispatchEvent(new Event("refresh-notifications"));
    }
  }, [loading]);

  const filtered = useMemo(() => {
    let list = productos;
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter(
        (p) => p.nombre.toLowerCase().includes(k) || p.codigo_barras.includes(k),
      );
    }
    if (solo === "bajo") list = list.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo);
    if (solo === "agotado") list = list.filter((p) => p.stock <= 0);
    if (solo === "reponer") list = list.filter((p) => p.stock <= p.stock_minimo);
    return list;
  }, [productos, q, solo]);

  const stats = useMemo(() => {
    const total = productos.length;
    const bajo = productos.filter((p) => p.stock > 0 && p.stock <= p.stock_minimo).length;
    const agotado = productos.filter((p) => p.stock <= 0).length;
    const valor = productos.reduce((s, p) => s + p.stock * p.precio_compra, 0);
    const valorVenta = productos.reduce((s, p) => s + p.stock * p.precio_venta, 0);
    return { total, bajo, agotado, valor, valorVenta };
  }, [productos]);

  // Sugerencia de reposición: hasta llevar al doble del mínimo
  const sugerencia = useMemo(() => {
    return productos
      .filter((p) => p.stock <= p.stock_minimo)
      .map((p) => ({
        ...p,
        sugerido: Math.max(p.stock_minimo * 2 - p.stock, p.stock_minimo),
        costoEstimado: Math.max(p.stock_minimo * 2 - p.stock, p.stock_minimo) * p.precio_compra,
      }))
      .sort((a, b) => b.costoEstimado - a.costoEstimado);
  }, [productos]);

  const exportarCSV = () => {
    exportToCSV("inventario", filtered.map((p) => ({
      Producto: p.nombre,
      Código: p.codigo_barras,
      Stock: p.stock,
      Unidad: p.unidad,
      Mínimo: p.stock_minimo,
      "P. Compra": p.precio_compra.toFixed(2),
      "P. Venta": p.precio_venta.toFixed(2),
      "Valor stock": (p.stock * p.precio_compra).toFixed(2),
      Estado: p.stock <= 0 ? "AGOTADO" : p.stock <= p.stock_minimo ? "BAJO" : "OK",
    })));
  };

  const imprimirSugerencia = () => {
    const totalCosto = sugerencia.reduce((s, p) => s + p.costoEstimado, 0);
    const filas = sugerencia.map((p) => `<tr>
      <td>${p.nombre}</td><td>${p.codigo_barras || "—"}</td>
      <td class="right">${p.stock}</td><td class="right">${p.stock_minimo}</td>
      <td class="right" style="color:#059669;font-weight:700">${p.sugerido}</td>
      <td class="right">${formatPEN(p.costoEstimado)}</td>
    </tr>`).join("");
    printHTML("Orden de reposición sugerida", `
      <h1>Orden de reposición sugerida</h1>
      <div class="meta">${new Date().toLocaleString("es-PE")} — ${sugerencia.length} productos</div>
      <table><thead><tr><th>Producto</th><th>Código</th><th class="right">Stock</th><th class="right">Mínimo</th><th class="right">Sugerido</th><th class="right">Costo est.</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="5" class="right" style="font-weight:700">TOTAL ESTIMADO</td><td class="right total">${formatPEN(totalCosto)}</td></tr></tfoot></table>
    `);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" /> Inventario
          </h1>
          <p className="text-muted-foreground">Stock actual de productos y alertas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon"
            onClick={async () => {
              await refetchCatalog();
              window.dispatchEvent(new Event("refresh-notifications"));
              toast.success("Inventario y notificaciones actualizadas");
            }}
            disabled={loading}
            className="h-9 w-9"
            title="Sincronizar todo ahora"
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" onClick={exportarCSV} className="h-9 font-semibold">
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Excel
          </Button>
          <Button variant="outline" onClick={imprimirSugerencia} disabled={sugerencia.length === 0} className="h-9 font-semibold">
            <Printer className="h-4 w-4 mr-2 text-rose-600" />Orden reposición
          </Button>
          <Link to="/kardex" className="text-sm text-primary hover:underline">Ver Kardex →</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Productos</div><div className="text-2xl font-bold">{stats.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Stock bajo</div><div className="text-2xl font-bold text-amber-600">{stats.bajo}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Agotados</div><div className="text-2xl font-bold text-destructive">{stats.agotado}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Valor (costo)</div><div className="text-2xl font-bold">{formatPEN(stats.valor)}</div></Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-card"><div className="text-xs text-emerald-700">Valor (venta)</div><div className="text-2xl font-bold text-emerald-700">{formatPEN(stats.valorVenta)}</div></Card>
      </div>

      {sugerencia.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <PackagePlus className="h-6 w-6 text-amber-600" />
              <div>
                <div className="font-bold">Sugerencia de reposición</div>
                <div className="text-xs text-muted-foreground">
                  {sugerencia.length} producto{sugerencia.length !== 1 && "s"} requieren reposición · Costo estimado{" "}
                  <span className="font-bold text-foreground">
                    {formatPEN(sugerencia.reduce((s, p) => s + p.costoEstimado, 0))}
                  </span>
                </div>
              </div>
            </div>
            <Button onClick={imprimirSugerencia} size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold">
              <Printer className="h-4 w-4 mr-2" />Generar orden
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o código…" className="pl-9" />
        </div>
        {(["todos","bajo","agotado","reponer"] as const).map((k) => (
          <button key={k} onClick={() => setSolo(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${solo===k?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-muted"}`}>
            {k === "todos" ? "Todos" : k === "bajo" ? "Stock bajo" : k === "agotado" ? "Agotados" : "Por reponer"}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2 text-right">Stock</th>
              <th className="px-4 py-2 text-right">Mínimo</th>
              <th className="px-4 py-2 text-right">P. compra</th>
              <th className="px-4 py-2 text-right">P. venta</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin productos</td></tr>
            ) : filtered.map((p) => {
              const agot = p.stock <= 0;
              const bajo = !agot && p.stock <= p.stock_minimo;
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{p.nombre}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.codigo_barras || "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold">{p.stock} {p.unidad}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{p.stock_minimo}</td>
                  <td className="px-4 py-2 text-right">{formatPEN(p.precio_compra)}</td>
                  <td className="px-4 py-2 text-right">{formatPEN(p.precio_venta)}</td>
                  <td className="px-4 py-2">
                    {agot ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Agotado</Badge>
                      : bajo ? <Badge className="bg-amber-500 hover:bg-amber-600">Bajo</Badge>
                      : <Badge variant="secondary">OK</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
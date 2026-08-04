import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShoppingCart, Plus, Trash2, AlertTriangle, Eye, FileSpreadsheet, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/hooks/useCatalog";
import { toast } from "sonner";
import { formatPEN, formatDate, IGV_RATE } from "@/lib/format";
import { exportToCSV, printHTML, printTicket } from "@/lib/exporters";

export const Route = createFileRoute("/_app/compras")({
  head: () => ({ meta: [{ title: "Compras — POS Minimarket" }] }),
  component: ComprasPage,
});

type Compra = { id: string; documento: string | null; creada_en: string; total: number; estado: string; proveedores: { razon_social: string } | null };
type LoteActivo = { id: string; producto_id: string; numero_lote: string; fecha_vencimiento: string | null; cantidad_actual: number };
type Linea = { producto_id: string; cantidad: number; precio_unitario: number; modo_lote: "nuevo" | "existente" | "ninguno"; numero_lote?: string; fecha_vencimiento?: string; lote_id?: string };

function ComprasPage() {
  const { user, isDemo } = useAuth();
  const { productos, refresh } = useCatalog();
  const [rows, setRows] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; razon_social: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ tipo_comprobante: "FACTURA", fecha_emision: new Date().toISOString().slice(0, 10), metodo_pago: "EFECTIVO" });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [alertas, setAlertas] = useState<{ i: number; nombre: string; tipo: "venta" | "menor"; nuevo: number; anterior: number }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleCompra, setDetalleCompra] = useState<Compra | null>(null);
  const [detalleItems, setDetalleItems] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [lotesActivos, setLotesActivos] = useState<LoteActivo[]>([]);

  const loadLotes = async () => {
    if (isDemo || !user) return;
    const { data } = await supabase
      .from("lotes")
      .select("id,producto_id,numero_lote,fecha_vencimiento,cantidad_actual")
      .eq("bloqueado", false)
      .gt("cantidad_actual", 0)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    setLotesActivos((data ?? []) as LoteActivo[]);
  };
  useEffect(() => { if (open) void loadLotes(); }, [open, user?.id, isDemo]);

  const load = async () => {
    if (isDemo || !user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("compras").select("id,documento,creada_en,total,estado,proveedores(razon_social)").order("creada_en", { ascending: false });
    setRows((data ?? []) as any);
    const { data: p } = await supabase.from("proveedores").select("id,razon_social").eq("activo", true).order("razon_social");
    setProveedores((p ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id, isDemo]);

  const subtotal = lineas.reduce((s, l) => s + (l.cantidad * l.precio_unitario) / (1 + IGV_RATE), 0);
  const igv = lineas.reduce((s, l) => s + (l.cantidad * l.precio_unitario) - (l.cantidad * l.precio_unitario) / (1 + IGV_RATE), 0);
  const total = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);

  const addLinea = () => {
    const d = new Date();
    const lote = `L${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(lineas.length + 1).padStart(3, "0")}`;
    setLineas([...lineas, { producto_id: productos[0]?.id ?? "", cantidad: 1, precio_unitario: 0, modo_lote: "nuevo", numero_lote: lote, fecha_vencimiento: "" }]);
  };
  const updLinea = (i: number, patch: Partial<Linea>) => setLineas(lineas.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const delLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!f.proveedor_id) return toast.error("Selecciona proveedor");
    if (lineas.length === 0) return toast.error("Agrega productos");
    // Validaciones de lote
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (l.cantidad <= 0) return toast.error(`Línea ${i + 1}: cantidad debe ser mayor a 0`);
      if (l.modo_lote === "nuevo" && (!l.numero_lote || !l.numero_lote.trim())) {
        return toast.error(`Línea ${i + 1}: ingresa el número de lote o cambia a "Sin lote"`);
      }
      if (l.modo_lote === "existente" && !l.lote_id) {
        return toast.error(`Línea ${i + 1}: selecciona el lote existente`);
      }
    }
    type Alerta = { i: number; nombre: string; tipo: "venta" | "menor"; nuevo: number; anterior: number };
    const problemas: Alerta[] = [];
    lineas.forEach((l, i) => {
      const prod = productos.find((p) => p.id === l.producto_id);
      if (!prod || l.precio_unitario <= 0) return;
      if (l.precio_unitario >= prod.precio_venta) {
        problemas.push({ i: i + 1, nombre: prod.nombre, tipo: "venta", nuevo: l.precio_unitario, anterior: prod.precio_venta });
      } else if (prod.precio_compra > 0 && l.precio_unitario < prod.precio_compra) {
        problemas.push({ i: i + 1, nombre: prod.nombre, tipo: "menor", nuevo: l.precio_unitario, anterior: prod.precio_compra });
      }
    });
    if (problemas.length > 0) {
      setAlertas(problemas);
      setConfirmOpen(true);
      return;
    }
    await doSave();
  };

  const doSave = async () => {
    setConfirmOpen(false);
    const { data: compra, error } = await supabase.from("compras").insert({
      proveedor_id: f.proveedor_id,
      documento: f.numero_documento || null,
      subtotal, igv, total,
      estado: "RECIBIDA",
      usuario_id: user?.id ?? null,
    }).select("id").single();
    if (error || !compra) return toast.error(error?.message ?? "Error");
    const detalles = lineas.map((l) => {
      const prod = productos.find((p) => p.id === l.producto_id);
      const ttl = l.cantidad * l.precio_unitario;
      return {
        compra_id: compra.id,
        producto_id: l.producto_id,
        nombre: prod?.nombre ?? "",
        cantidad: l.cantidad,
        costo_unitario: l.precio_unitario,
        subtotal: ttl,
      };
    });
    const { error: dErr } = await supabase.from("compra_items").insert(detalles);
    if (dErr) return toast.error(dErr.message);

    // Aumentar stock, actualizar último precio de compra y registrar kardex
    const stockErrors: string[] = [];
    const movimientos: any[] = [];
    const lotesNuevos: any[] = [];
    const lotesActualizar: { id: string; nueva_cant: number; nueva_inicial: number }[] = [];
    for (const l of lineas) {
      const prod = productos.find((p) => p.id === l.producto_id);
      if (!prod) continue;
      // Leer el stock REAL desde la BD (el catálogo puede estar desactualizado)
      const { data: actual, error: readErr } = await supabase
        .from("productos")
        .select("stock")
        .eq("id", l.producto_id)
        .maybeSingle();
      if (readErr) { stockErrors.push(`${prod.nombre}: ${readErr.message}`); continue; }
      const stockBase = Number(actual?.stock ?? prod.stock ?? 0);
      const nuevoStock = stockBase + Number(l.cantidad ?? 0);
      const patch: Record<string, number> = { stock: nuevoStock };
      if (l.precio_unitario > 0) patch.precio_compra = l.precio_unitario;
      const { data: upRows, error: upErr } = await supabase
        .from("productos")
        .update(patch)
        .eq("id", l.producto_id)
        .select("id,stock");
      if (upErr) { stockErrors.push(`${prod.nombre}: ${upErr.message}`); continue; }
      if (!upRows || upRows.length === 0) {
        stockErrors.push(`${prod.nombre}: sin permiso para actualizar el stock (RLS)`);
        continue;
      }

      let refLote = "";
      if (l.modo_lote === "nuevo" && l.numero_lote?.trim()) {
        lotesNuevos.push({
          producto_id: l.producto_id,
          numero_lote: l.numero_lote.trim(),
          fecha_vencimiento: l.fecha_vencimiento || null,
          cantidad_inicial: l.cantidad,
          cantidad_actual: l.cantidad,
          costo_unitario: l.precio_unitario,
        });
        refLote = l.numero_lote.trim();
      } else if (l.modo_lote === "existente" && l.lote_id) {
        const lt = lotesActivos.find((x) => x.id === l.lote_id);
        if (lt) {
          lotesActualizar.push({
            id: lt.id,
            nueva_cant: Number(lt.cantidad_actual) + Number(l.cantidad),
            nueva_inicial: Number(lt.cantidad_actual) + Number(l.cantidad),
          });
          refLote = lt.numero_lote;
        }
      }

      movimientos.push({
        producto_id: l.producto_id,
        tipo: "COMPRA",
        cantidad: l.cantidad,
        saldo: nuevoStock,
        costo_unitario: l.precio_unitario,
        documento: f.numero_documento || null,
        motivo: `Compra ${compra.id.slice(0, 8)}${refLote ? ` · Lote ${refLote}` : ""}`,
        usuario_id: user?.id ?? null,
      });
    }
    for (const lu of lotesActualizar) {
      const { error: ulErr } = await supabase
        .from("lotes")
        .update({ cantidad_actual: lu.nueva_cant, cantidad_inicial: lu.nueva_inicial })
        .eq("id", lu.id);
      if (ulErr) stockErrors.push(`lote: ${ulErr.message}`);
    }
    if (lotesNuevos.length > 0) {
      const { error: lErr } = await supabase.from("lotes").insert(lotesNuevos);
      if (lErr) stockErrors.push(`lotes: ${lErr.message}`);
    }
    if (movimientos.length > 0) {
      const { error: kErr } = await supabase.from("kardex").insert(movimientos);
      if (kErr) stockErrors.push(`kardex: ${kErr.message}`);
    }
    if (stockErrors.length > 0) {
      toast.error(`Errores: ${stockErrors.join(" | ")}`);
    } else {
      toast.success("Compra registrada. Stock, lotes y kardex actualizados");
    }

    setOpen(false); setLineas([]); setF({ tipo_comprobante: "FACTURA", fecha_emision: new Date().toISOString().slice(0, 10), metodo_pago: "EFECTIVO" });
    refresh();
    void load();
    void loadLotes();
  };

  const verDetalle = async (c: Compra) => {
    setDetalleCompra(c);
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalleItems([]);
    const { data, error } = await supabase
      .from("compra_items")
      .select("nombre,cantidad,costo_unitario,subtotal,producto_id")
      .eq("compra_id", c.id);
    if (error) toast.error(error.message);
    setDetalleItems(data ?? []);
    setDetalleLoading(false);
  };

  const exportarCompras = () => {
    if (rows.length === 0) return toast.error("Sin compras para exportar");
    exportToCSV("compras", rows.map((c) => ({
      N: c.id.slice(0, 8),
      Documento: c.documento ?? "",
      Proveedor: c.proveedores?.razon_social ?? "",
      Fecha: formatDate(c.creada_en),
      Estado: c.estado,
      Total: Number(c.total).toFixed(2),
    })));
  };

  const imprimirCompras = () => {
    if (rows.length === 0) return toast.error("Sin compras");
    const totalGral = rows.reduce((s, c) => s + Number(c.total || 0), 0);
    const html = `
      <h1>Listado de Compras</h1>
      <div class="meta">Generado: ${new Date().toLocaleString("es-PE")} · ${rows.length} compras</div>
      <table><thead><tr>
        <th>N°</th><th>Documento</th><th>Proveedor</th><th>Fecha</th><th>Estado</th><th class="right">Total</th>
      </tr></thead><tbody>
        ${rows.map((c) => `<tr>
          <td>${c.id.slice(0, 8)}</td>
          <td>${c.documento ?? "—"}</td>
          <td>${c.proveedores?.razon_social ?? "—"}</td>
          <td>${formatDate(c.creada_en)}</td>
          <td>${c.estado}</td>
          <td class="right">${formatPEN(c.total)}</td>
        </tr>`).join("")}
      </tbody></table>
      <p class="right total" style="margin-top:12px">Total general: ${formatPEN(totalGral)}</p>
    `;
    printHTML("Compras", html);
  };

  const exportarDetalle = () => {
    if (!detalleCompra || detalleItems.length === 0) return;
    exportToCSV(`compra-${detalleCompra.id.slice(0, 8)}`, detalleItems.map((d) => ({
      Producto: d.nombre,
      Cantidad: d.cantidad,
      "Costo unitario": Number(d.costo_unitario).toFixed(2),
      Subtotal: Number(d.subtotal).toFixed(2),
    })));
  };

  const imprimirDetalle = () => {
    if (!detalleCompra) return;
    const c = detalleCompra;
    const html = `
      <h1>Compra ${c.id.slice(0, 8)}</h1>
      <div class="meta">
        Documento: ${c.documento ?? "—"} · Proveedor: ${c.proveedores?.razon_social ?? "—"}<br/>
        Fecha: ${formatDate(c.creada_en)} · Estado: ${c.estado}
      </div>
      <table><thead><tr>
        <th>Producto</th><th class="right">Cant.</th><th class="right">Costo unit.</th><th class="right">Subtotal</th>
      </tr></thead><tbody>
        ${detalleItems.map((d) => `<tr>
          <td>${d.nombre}</td>
          <td class="right">${d.cantidad}</td>
          <td class="right">${formatPEN(d.costo_unitario)}</td>
          <td class="right">${formatPEN(d.subtotal)}</td>
        </tr>`).join("")}
      </tbody></table>
      <p class="right total" style="margin-top:12px">Total: ${formatPEN(c.total)}</p>
    `;
    printHTML(`Compra ${c.id.slice(0, 8)}`, html);
  };

  const imprimirTicket = () => {
    if (!detalleCompra) return;
    const c = detalleCompra;
    const html = `
      <h1>COMPRA</h1>
      <div class="meta">
        N° ${c.id.slice(0, 8)}<br/>
        ${formatDate(c.creada_en)}
      </div>
      <div class="sep"></div>
      <div>Doc: ${c.documento ?? "—"}</div>
      <div>Prov: ${c.proveedores?.razon_social ?? "—"}</div>
      <div>Estado: ${c.estado}</div>
      <div class="sep"></div>
      <table><thead><tr>
        <th>Producto</th><th class="right">Cant</th><th class="right">Total</th>
      </tr></thead><tbody>
        ${detalleItems.map((d) => `<tr>
          <td colspan="3">${d.nombre}</td></tr><tr>
          <td>${Number(d.cantidad)} x ${formatPEN(d.costo_unitario)}</td>
          <td></td>
          <td class="right">${formatPEN(d.subtotal)}</td>
        </tr>`).join("")}
      </tbody></table>
      <div class="sep"></div>
      <div class="total right">TOTAL: ${formatPEN(c.total)}</div>
      <div class="sep"></div>
      <div class="center" style="margin-top:6px">¡Gracias!</div>
    `;
    printTicket(`Ticket ${c.id.slice(0, 8)}`, html);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-primary" /> Compras</h1>
          <p className="text-muted-foreground">Órdenes de compra y recepciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarCompras} disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={imprimirCompras} disabled={rows.length === 0}><Printer className="h-4 w-4 mr-1" />PDF</Button>
          <Button onClick={() => setOpen(true)} disabled={isDemo || !user}><Plus className="h-4 w-4 mr-1" />Nueva compra</Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr><th className="px-4 py-2">N°</th><th className="px-4 py-2">Documento</th><th className="px-4 py-2">Proveedor</th><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Acciones</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sin compras</td></tr>
            : rows.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 font-bold font-mono text-xs">{c.id.slice(0, 8)}</td>
                <td className="px-4 py-2 font-mono text-xs">{c.documento ?? "—"}</td>
                <td className="px-4 py-2">{c.proveedores?.razon_social ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{formatDate(c.creada_en)}</td>
                <td className="px-4 py-2"><Badge variant="secondary">{c.estado}</Badge></td>
                <td className="px-4 py-2 text-right font-bold">{formatPEN(c.total)}</td>
                <td className="px-4 py-2 text-center">
                  <Button size="sm" variant="ghost" onClick={() => void verDetalle(c)}><Eye className="h-4 w-4 mr-1" />Ver</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nueva compra</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Proveedor</Label>
              <Select value={f.proveedor_id ?? ""} onValueChange={(v) => setF({ ...f, proveedor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>{proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo comprobante</Label>
              <Select value={f.tipo_comprobante} onValueChange={(v) => setF({ ...f, tipo_comprobante: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["FACTURA","BOLETA","NOTA_VENTA"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>N° documento</Label><Input value={f.numero_documento ?? ""} onChange={(e) => setF({ ...f, numero_documento: e.target.value })} /></div>
            <div><Label>Fecha</Label><Input type="date" value={f.fecha_emision} onChange={(e) => setF({ ...f, fecha_emision: e.target.value })} /></div>
          </div>
          <div className="border-t pt-3">
            <div className="flex justify-between mb-2"><span className="font-semibold">Productos</span><Button size="sm" variant="outline" onClick={addLinea}><Plus className="h-3 w-3 mr-1" />Agregar</Button></div>
            <div className="space-y-2">
              {lineas.length > 0 && (
                <div className="flex gap-2 items-center text-xs font-semibold text-muted-foreground uppercase px-1">
                  <span className="flex-1">Producto</span>
                  <span className="w-20 text-center">Cant.</span>
                  <span className="w-28 text-center">Precio</span>
                  <span className="w-24 text-right">Subtotal</span>
                  <span className="w-9" />
                </div>
              )}
              {lineas.map((l, i) => {
                const lotesProd = lotesActivos.filter((lt) => lt.producto_id === l.producto_id);
                return (
                <div key={i} className="space-y-1 border-b pb-2">
                  <div className="flex gap-2 items-center">
                    <Select value={l.producto_id} onValueChange={(v) => updLinea(i, { producto_id: v, lote_id: undefined })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" value={l.cantidad} onChange={(e) => updLinea(i, { cantidad: Number(e.target.value) })} className="w-20" placeholder="Cant" />
                    <Input type="number" step="0.01" value={l.precio_unitario} onChange={(e) => updLinea(i, { precio_unitario: Number(e.target.value) })} className="w-28" placeholder="Precio" />
                    <span className="w-24 text-right text-sm font-semibold">{formatPEN(l.cantidad * l.precio_unitario)}</span>
                    <Button size="icon" variant="ghost" onClick={() => delLinea(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="flex gap-2 items-center pl-1 flex-wrap">
                    <span className="text-xs text-muted-foreground w-14">Modo lote:</span>
                    <Select value={l.modo_lote} onValueChange={(v) => updLinea(i, { modo_lote: v as any, lote_id: undefined })}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nuevo">Nuevo lote</SelectItem>
                        <SelectItem value="existente">Lote existente</SelectItem>
                        <SelectItem value="ninguno">Sin lote</SelectItem>
                      </SelectContent>
                    </Select>
                    {l.modo_lote === "nuevo" && (
                      <>
                        <Input value={l.numero_lote ?? ""} onChange={(e) => updLinea(i, { numero_lote: e.target.value })} className="flex-1 h-8 text-xs min-w-40" placeholder="N° de lote" />
                        <span className="text-xs text-muted-foreground">Vence:</span>
                        <Input type="date" value={l.fecha_vencimiento ?? ""} onChange={(e) => updLinea(i, { fecha_vencimiento: e.target.value })} className="w-36 h-8 text-xs" />
                      </>
                    )}
                    {l.modo_lote === "existente" && (
                      <Select value={l.lote_id ?? ""} onValueChange={(v) => updLinea(i, { lote_id: v })}>
                        <SelectTrigger className="h-8 flex-1 text-xs min-w-60"><SelectValue placeholder={lotesProd.length === 0 ? "Sin lotes activos" : "Elegir lote…"} /></SelectTrigger>
                        <SelectContent>
                          {lotesProd.map((lt) => (
                            <SelectItem key={lt.id} value={lt.id}>
                              {lt.numero_lote} · {lt.fecha_vencimiento ? `vence ${formatDate(lt.fecha_vencimiento)}` : "sin venc."} · stock {lt.cantidad_actual}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {l.producto_id && lotesProd.length > 0 && (
                    <div className="pl-1 text-[11px] text-muted-foreground">
                      Lotes activos: {lotesProd.map((lt) => `${lt.numero_lote} (${lt.cantidad_actual}${lt.fecha_vencimiento ? `, vence ${formatDate(lt.fecha_vencimiento)}` : ""})`).join(" · ")}
                    </div>
                  )}
                </div>
                );
              })}
              {lineas.map((l, i) => {
                const prod = productos.find((p) => p.id === l.producto_id);
                if (!prod || l.precio_unitario <= 0) return null;
                if (l.precio_unitario >= prod.precio_venta) {
                  return (
                    <p key={`w-${i}`} className="text-xs text-destructive px-1">
                      ⚠ Línea {i + 1}: precio de compra ({formatPEN(l.precio_unitario)}) es mayor o igual al precio de venta actual ({formatPEN(prod.precio_venta)}). Revisa antes de registrar.
                    </p>
                  );
                }
                return null;
              })}
              {lineas.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">Agrega productos</div>}
            </div>
          </div>
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatPEN(subtotal)}</span></div>
            <div className="flex justify-between"><span>IGV</span><span>{formatPEN(igv)}</span></div>
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatPEN(total)}</span></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Registrar compra</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de compra {detalleCompra?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {detalleCompra && (
            <div className="grid grid-cols-2 gap-2 text-sm border-b pb-3">
              <div><span className="text-muted-foreground">Proveedor:</span> <b>{detalleCompra.proveedores?.razon_social ?? "—"}</b></div>
              <div><span className="text-muted-foreground">Documento:</span> <b className="font-mono">{detalleCompra.documento ?? "—"}</b></div>
              <div><span className="text-muted-foreground">Fecha:</span> <b>{formatDate(detalleCompra.creada_en)}</b></div>
              <div><span className="text-muted-foreground">Estado:</span> <Badge variant="secondary">{detalleCompra.estado}</Badge></div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-left">
                <tr>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2 text-right">Costo unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalleLoading ? (
                  <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Cargando…</td></tr>
                ) : detalleItems.length === 0 ? (
                  <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sin items</td></tr>
                ) : detalleItems.map((d, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{d.nombre}</td>
                    <td className="px-3 py-2 text-right">{d.cantidad}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatPEN(d.costo_unitario)}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatPEN(d.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detalleCompra && (
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPEN(detalleCompra.total)}</span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={exportarDetalle} disabled={detalleItems.length === 0}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" onClick={imprimirDetalle} disabled={detalleItems.length === 0}><Printer className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" onClick={imprimirTicket} disabled={detalleItems.length === 0}><Printer className="h-4 w-4 mr-1" />Ticket</Button>
            <Button onClick={() => setDetalleOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Advertencia de precios
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1">
                <p>
                  Se detectaron {alertas.length === 1 ? "1 línea" : `${alertas.length} líneas`} con precios a revisar.
                </p>
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
                  {alertas.map((a, idx) => (
                    <div key={`${a.i}-${idx}`} className="px-3 py-2 text-sm">
                      <div className="font-semibold text-foreground">Línea {a.i} · {a.nombre}</div>
                      {a.tipo === "venta" ? (
                        <div className="text-xs text-muted-foreground">
                          Compra <span className="font-mono text-destructive">{formatPEN(a.nuevo)}</span>
                          {" ≥ "}
                          Venta actual <span className="font-mono">{formatPEN(a.anterior)}</span> — venderías con pérdida.
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          Precio ingresado <span className="font-mono text-destructive">{formatPEN(a.nuevo)}</span>
                          {" < "}
                          Último precio de compra <span className="font-mono">{formatPEN(a.anterior)}</span>. ¿Desea continuar?
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs">Cancela para modificar los precios, o continúa para registrar la compra de todos modos.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Revisar precios</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doSave()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Registrar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
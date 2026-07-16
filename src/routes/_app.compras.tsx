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
import { ShoppingCart, Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalog } from "@/hooks/useCatalog";
import { toast } from "sonner";
import { formatPEN, formatDate, IGV_RATE } from "@/lib/format";

export const Route = createFileRoute("/_app/compras")({
  head: () => ({ meta: [{ title: "Compras — POS Minimarket" }] }),
  component: ComprasPage,
});

type Compra = { id: string; documento: string | null; creada_en: string; total: number; estado: string; proveedores: { razon_social: string } | null };
type Linea = { producto_id: string; cantidad: number; precio_unitario: number };

function ComprasPage() {
  const { user, isDemo } = useAuth();
  const { productos } = useCatalog();
  const [rows, setRows] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<{ id: string; razon_social: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ tipo_comprobante: "FACTURA", fecha_emision: new Date().toISOString().slice(0, 10), metodo_pago: "EFECTIVO" });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [alertas, setAlertas] = useState<{ i: number; nombre: string; compra: number; venta: number }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const addLinea = () => setLineas([...lineas, { producto_id: productos[0]?.id ?? "", cantidad: 1, precio_unitario: 0 }]);
  const updLinea = (i: number, patch: Partial<Linea>) => setLineas(lineas.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const delLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!f.proveedor_id) return toast.error("Selecciona proveedor");
    if (lineas.length === 0) return toast.error("Agrega productos");
    const problemas = lineas
      .map((l, i) => {
        const prod = productos.find((p) => p.id === l.producto_id);
        if (!prod || l.precio_unitario <= 0) return null;
        if (l.precio_unitario >= prod.precio_venta) {
          return { i: i + 1, nombre: prod.nombre, compra: l.precio_unitario, venta: prod.precio_venta };
        }
        return null;
      })
      .filter(Boolean) as { i: number; nombre: string; compra: number; venta: number }[];
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
      tipo_comprobante: f.tipo_comprobante,
      numero_documento: f.numero_documento || null,
      fecha_emision: f.fecha_emision,
      metodo_pago: f.metodo_pago,
      subtotal, igv, total,
      estado: "RECIBIDA",
      usuario_id: user?.id ?? null,
    }).select("id").single();
    if (error || !compra) return toast.error(error?.message ?? "Error");
    const detalles = lineas.map((l) => {
      const ttl = l.cantidad * l.precio_unitario;
      const stl = ttl / (1 + IGV_RATE);
      return { compra_id: compra.id, producto_id: l.producto_id, cantidad: l.cantidad, precio_unitario: l.precio_unitario, subtotal: stl, igv: ttl - stl, total: ttl };
    });
    const { error: dErr } = await supabase.from("detalle_compras").insert(detalles);
    if (dErr) return toast.error(dErr.message);
    toast.success("Compra registrada");
    // Sugerir actualizar precio de venta de productos donde el costo subió por encima del precio actual
    const necesitanAjuste = lineas
      .map((l) => {
        const prod = productos.find((p) => p.id === l.producto_id);
        if (!prod || l.precio_unitario <= 0) return null;
        if (l.precio_unitario >= prod.precio_venta) return prod.nombre;
        return null;
      })
      .filter(Boolean) as string[];
    if (necesitanAjuste.length > 0) {
      toast.warning(
        `Actualiza el precio de venta en: ${necesitanAjuste.join(", ")}`,
        { duration: 8000 },
      );
    }
    setOpen(false); setLineas([]); setF({ tipo_comprobante: "FACTURA", fecha_emision: new Date().toISOString().slice(0, 10), metodo_pago: "EFECTIVO" });
    void load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2"><ShoppingCart className="h-6 w-6 text-primary" /> Compras</h1>
          <p className="text-muted-foreground">Órdenes de compra y recepciones</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={isDemo || !user}><Plus className="h-4 w-4 mr-1" />Nueva compra</Button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr><th className="px-4 py-2">N°</th><th className="px-4 py-2">Documento</th><th className="px-4 py-2">Proveedor</th><th className="px-4 py-2">Fecha</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Total</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sin compras</td></tr>
            : rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2 font-bold font-mono text-xs">{c.id.slice(0, 8)}</td>
                <td className="px-4 py-2 font-mono text-xs">{c.documento ?? "—"}</td>
                <td className="px-4 py-2">{c.proveedores?.razon_social ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{formatDate(c.creada_en)}</td>
                <td className="px-4 py-2"><Badge variant="secondary">{c.estado}</Badge></td>
                <td className="px-4 py-2 text-right font-bold">{formatPEN(c.total)}</td>
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
              {lineas.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={l.producto_id} onValueChange={(v) => updLinea(i, { producto_id: v })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={l.cantidad} onChange={(e) => updLinea(i, { cantidad: Number(e.target.value) })} className="w-20" placeholder="Cant" />
                  <Input type="number" step="0.01" value={l.precio_unitario} onChange={(e) => updLinea(i, { precio_unitario: Number(e.target.value) })} className="w-28" placeholder="Precio" />
                  <span className="w-24 text-right text-sm font-semibold">{formatPEN(l.cantidad * l.precio_unitario)}</span>
                  <Button size="icon" variant="ghost" onClick={() => delLinea(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
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
                  {alertas.length === 1
                    ? "Hay 1 producto donde el precio de compra es mayor o igual al precio de venta actual."
                    : `Hay ${alertas.length} productos donde el precio de compra es mayor o igual al precio de venta actual.`}
                  {" "}Esto significa que venderías con pérdida.
                </p>
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 divide-y divide-destructive/10">
                  {alertas.map((a) => (
                    <div key={a.i} className="px-3 py-2 text-sm">
                      <div className="font-semibold text-foreground">Línea {a.i} · {a.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        Compra <span className="font-mono text-destructive">{formatPEN(a.compra)}</span>
                        {" ≥ "}
                        Venta actual <span className="font-mono">{formatPEN(a.venta)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs">Revisa los precios o actualiza el precio de venta en el módulo Productos antes de continuar.</p>
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
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { formatPEN } from "@/lib/format";
import { fileToThumbDataUrl } from "@/lib/imageResize";
import { Upload, X as XIcon } from "lucide-react";
import { useRef } from "react";

export const Route = createFileRoute("/_app/productos")({
  head: () => ({ meta: [{ title: "Productos — POS Minimarket" }] }),
  component: ProductosPage,
});

type Producto = {
  id: string;
  codigo_barras: string | null;
  nombre: string;
  precio_venta: number;
  precio_compra: number;
  stock: number;
  stock_minimo: number;
  unidad: string;
  categoria_id: string | null;
  afecto_igv: boolean;
  activo: boolean;
  imagen_url?: string | null;
};
type Categoria = { id: string; nombre: string };

const UNIDADES = [
  "UNIDAD",
  "KILOGRAMO",
  "GRAMO",
  "LITRO",
  "MILILITRO",
  "CAJA",
  "PAQUETE",
  "DOCENA",
  "BOLSA",
];

function ProductosPage() {
  const { isDemo, user } = useAuth();
  const [rows, setRows] = useState<Producto[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);

  const load = async () => {
    if (isDemo || !user) {
      setRows([]);
      setCats([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: ps, error: e1 }, { data: cs }] = await Promise.all([
      supabase
        .from("productos")
        .select(
          "id,codigo_barras,nombre,precio_venta,precio_compra,stock,stock_minimo,unidad,categoria_id,afecto_igv,activo,imagen_url",
        )
        .order("nombre"),
      supabase.from("categorias").select("id,nombre").order("nombre"),
    ]);
    if (e1) toast.error(e1.message);
    setRows((ps ?? []) as Producto[]);
    setCats((cs ?? []) as Categoria[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [isDemo, user?.id]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const k = q.toLowerCase();
    return rows.filter(
      (p) =>
        p.nombre.toLowerCase().includes(k) ||
        (p.codigo_barras ?? "").includes(k),
    );
  }, [rows, q]);

  const onSave = async (p: Partial<Producto>) => {
    if (isDemo || !user) {
      toast.info("Demo: no se guarda en la base de datos");
      setOpen(false);
      return;
    }
    const pc = Number(p.precio_compra ?? 0);
    const pv = Number(p.precio_venta ?? 0);
    if (pv < pc) {
      return toast.error("El precio de venta no puede ser menor al precio de compra");
    }
    const payload: any = {
      codigo_barras: p.codigo_barras || null,
      nombre: p.nombre,
      precio_venta: p.precio_venta ?? 0,
      precio_compra: p.precio_compra ?? 0,
      stock: p.stock ?? 0,
      stock_minimo: p.stock_minimo ?? 0,
      unidad: p.unidad ?? "UNIDAD",
      categoria_id: p.categoria_id || null,
      afecto_igv: p.afecto_igv ?? true,
      activo: p.activo ?? true,
      imagen_url: p.imagen_url ?? null,
    };
    const { error } = editing?.id
      ? await supabase.from("productos").update(payload).eq("id", editing.id)
      : await supabase.from("productos").insert(payload);
    if (error) {
      const msg = error.message ?? "";
      if (/imagen_url/i.test(msg)) {
        toast.error(
          "Falta la columna imagen_url en la tabla productos. Ejecuta en Supabase: ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS imagen_url text; NOTIFY pgrst, 'reload schema';",
          { duration: 10000 },
        );
      } else {
        toast.error(msg);
      }
      return;
    }
    toast.success("Producto guardado");
    setOpen(false);
    setEditing(null);
    void load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar producto?")) return;
    const { error } = await supabase.from("productos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    void load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Productos
          </h1>
          <p className="text-muted-foreground">
            Precios, stock y código de barras
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Nuevo producto
        </Button>
      </div>

      {isDemo && (
        <Card className="p-4 text-sm border-amber-500/30 bg-amber-500/5">
          Modo demo activo · inicia sesión real para guardar productos en
          Supabase.
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o código…"
          className="pl-9"
        />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2 w-14"></th>
              <th className="px-4 py-2">Producto</th>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2 text-right">P. Compra</th>
              <th className="px-4 py-2 text-right">P. Venta</th>
              <th className="px-4 py-2 text-right">Stock</th>
              <th className="px-4 py-2 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Sin productos
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className={`border-t ${Number(p.precio_venta) > 0 && Number(p.precio_venta) <= Number(p.precio_compra) ? "bg-destructive/5" : ""}`}>
                  <td className="px-4 py-2">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="h-10 w-10 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted grid place-items-center text-[10px] font-bold text-muted-foreground">
                        {p.nombre.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{p.nombre}</span>
                      {Number(p.precio_venta) > 0 && Number(p.precio_venta) <= Number(p.precio_compra) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide">
                          Pérdida
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {p.codigo_barras ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatPEN(Number(p.precio_compra))}
                  </td>
                  <td className={`px-4 py-2 text-right font-semibold ${Number(p.precio_venta) > 0 && Number(p.precio_venta) <= Number(p.precio_compra) ? "text-destructive" : "text-primary"}`}>
                    {formatPEN(Number(p.precio_venta))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {Number(p.stock)} {p.unidad.slice(0, 3)}
                  </td>
                  <td className="px-4 py-2 text-right space-x-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <ProductoModal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        categorias={cats}
        onSave={onSave}
      />
    </div>
  );
}

function ProductoModal({
  open,
  onOpenChange,
  initial,
  categorias,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Producto | null;
  categorias: Categoria[];
  onSave: (p: Partial<Producto>) => void;
}) {
  const [f, setF] = useState<Partial<Producto>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (open) {
      setF(
        initial ?? {
          nombre: "",
          codigo_barras: "",
          precio_compra: 0,
          precio_venta: 0,
          stock: 0,
          stock_minimo: 0,
          unidad: "UNIDAD",
          afecto_igv: true,
          activo: true,
        },
      );
    }
  }, [open, initial]);

  const set = (patch: Partial<Producto>) => setF((p) => ({ ...p, ...patch }));

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    // Validar formato
    const formatosOk = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
    if (!formatosOk.includes(file.type)) {
      toast.error(`Formato no soportado (${file.type || "desconocido"}). Usa JPG, PNG, WEBP, GIF o BMP.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    // Validar tamaño (máx 8 MB del archivo original)
    const MAX_MB = 8;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Máximo permitido: ${MAX_MB} MB.`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    try {
      setProcesando(true);
      const url = await fileToThumbDataUrl(file, 128, 0.78);
      const kb = Math.round((url.length * 0.75) / 1024);
      set({ imagen_url: url });
      toast.success(`Imagen lista · 128×128 (~${kb} KB)`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo procesar la imagen");
    } finally {
      setProcesando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar" : "Nuevo"} producto</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="h-20 w-20 rounded-lg border bg-card overflow-hidden grid place-items-center shrink-0">
              {f.imagen_url ? (
                <img
                  src={f.imagen_url}
                  alt="Vista previa"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Sin foto</span>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-sm font-semibold">Foto del producto</div>
              <p className="text-xs text-muted-foreground">
                Se convierte automáticamente a icono 128×128 (≈ 5 KB) para no pesar en la base de datos.
              </p>
              <div className="flex gap-2 pt-1 items-center">
                <label
                  className={`inline-flex items-center gap-1 h-8 px-3 rounded-md border text-sm font-medium cursor-pointer bg-background hover:bg-muted transition ${
                    procesando ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <Upload className="h-4 w-4" />
                  {procesando ? "Procesando…" : f.imagen_url ? "Cambiar" : "Subir foto"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/*"
                    className="hidden"
                    onClick={(e) => {
                      // permite volver a elegir el mismo archivo
                      (e.currentTarget as HTMLInputElement).value = "";
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      console.log("[foto] archivo seleccionado:", file?.name, file?.type, file?.size);
                      void onPickFile(file);
                    }}
                  />
                </label>
                {f.imagen_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set({ imagen_url: null })}
                  >
                    <XIcon className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                )}
              </div>

            </div>
          </div>
          <div className="col-span-2">
            <Label>Nombre</Label>
            <Input
              value={f.nombre ?? ""}
              onChange={(e) => set({ nombre: e.target.value })}
            />
          </div>
          <div>
            <Label>Código de barras</Label>
            <Input
              value={f.codigo_barras ?? ""}
              onChange={(e) => set({ codigo_barras: e.target.value })}
            />
          </div>
          <div>
            <Label>Unidad</Label>
            <Select
              value={f.unidad ?? "UNIDAD"}
              onValueChange={(v) => set({ unidad: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select
              value={f.categoria_id ?? "none"}
              onValueChange={(v) =>
                set({ categoria_id: v === "none" ? null : v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>IGV</Label>
            <Select
              value={String(f.afecto_igv ?? true)}
              onValueChange={(v) => set({ afecto_igv: v === "true" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Afecto (18%)</SelectItem>
                <SelectItem value="false">Exonerado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Precio compra</Label>
            <Input
              type="number"
              step="0.01"
              value={f.precio_compra ?? 0}
              onChange={(e) =>
                set({ precio_compra: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Precio venta</Label>
            <Input
              type="number"
              step="0.01"
              value={f.precio_venta ?? 0}
              onChange={(e) =>
                set({ precio_venta: parseFloat(e.target.value) || 0 })
              }
            />
            {Number(f.precio_venta ?? 0) > 0 &&
              Number(f.precio_venta ?? 0) < Number(f.precio_compra ?? 0) && (
                <p className="text-xs text-destructive mt-1">
                  Menor al precio de compra
                </p>
              )}
          </div>
          <div>
            <Label>Stock actual</Label>
            <Input
              type="number"
              step="0.001"
              value={f.stock ?? 0}
              onChange={(e) =>
                set({ stock: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <Label>Stock mínimo</Label>
            <Input
              type="number"
              step="0.001"
              value={f.stock_minimo ?? 0}
              onChange={(e) =>
                set({ stock_minimo: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(f)} disabled={!f.nombre?.trim()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
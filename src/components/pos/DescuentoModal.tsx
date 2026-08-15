import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Percent, DollarSign, ShoppingCart, Package, ShieldAlert, X, Check, Tag, TrendingDown } from "lucide-react";
import { formatPEN } from "@/lib/format";
import type { CartItem, DescuentoInfo, DescuentoTipo, DescuentoAplicadoA } from "@/hooks/usePOSCart";
import { supabaseSignup } from "@/integrations/supabase/signupClient";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MOTIVOS = [
  "Cliente Frecuente",
  "Promoción",
  "Producto con pequeño daño",
  "Producto próximo a vencer",
  "Error de precio",
  "Cortesía",
  "Empleado",
  "Convenio",
  "Otro",
];

const PORCENTAJES_RAPIDOS = [5, 10, 15, 20, 25, 30];

// Límite por rol (% máximo permitido sin autorización)
export function limitePorRol(role: string | null | undefined, isAdminMaestro: boolean) {
  if (isAdminMaestro) return Infinity;
  switch (role) {
    case "administrador":
    case "gerente":
      return Infinity;
    case "supervisor":
      return 20;
    case "cajero":
    case "vendedor":
      return 30;
    default:
      return 10;
  }
}

export function DescuentoModal({
  open,
  onOpenChange,
  items,
  totalBruto,
  descuentoActual,
  onAplicar,
  onQuitar,
  role,
  isAdminMaestro,
  usuarioEmail,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CartItem[];
  totalBruto: number;
  descuentoActual: DescuentoInfo | null;
  onAplicar: (info: Omit<DescuentoInfo, "montoDescuento">) => void;
  onQuitar: () => void;
  role: string | null;
  isAdminMaestro: boolean;
  usuarioEmail?: string | null;
}) {
  const [tipo, setTipo] = useState<DescuentoTipo>("porcentaje");
  const [aplicadoA, setAplicadoA] = useState<DescuentoAplicadoA>("total");
  const [productoId, setProductoId] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [motivoTexto, setMotivoTexto] = useState<string>("");
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminPass, setAdminPass] = useState<string>("");
  const [verificando, setVerificando] = useState(false);
  const [autorizadoPor, setAutorizadoPor] = useState<string | null>(null);
  const [aceptaBajoCosto, setAceptaBajoCosto] = useState(false);

  useEffect(() => {
    if (open) {
      // reset
      if (descuentoActual) {
        setTipo(descuentoActual.tipo);
        setAplicadoA(descuentoActual.aplicadoA);
        setProductoId(descuentoActual.productoId ?? "");
        setValor(String(descuentoActual.valor));
        setMotivo(descuentoActual.motivo);
        setMotivoTexto(descuentoActual.motivoTexto ?? "");
        setAutorizadoPor(descuentoActual.autorizadoPor ?? null);
      } else {
        setTipo("porcentaje");
        setAplicadoA("total");
        setProductoId(items[0]?.producto.id ?? "");
        setValor("");
        setMotivo("");
        setMotivoTexto("");
        setAutorizadoPor(null);
      }
      setAdminEmail("");
      setAdminPass("");
      setAceptaBajoCosto(false);
    }
  }, [open]);

  const productoSeleccionado = items.find((i) => i.producto.id === productoId);
  const valorNum = Math.max(0, Number(valor) || 0);

  // Base para calcular el descuento
  const base = useMemo(() => {
    if (aplicadoA === "producto" && productoSeleccionado) {
      return productoSeleccionado.producto.precio_venta * productoSeleccionado.cantidad;
    }
    return totalBruto;
  }, [aplicadoA, productoSeleccionado, totalBruto]);

  const montoDescuento = useMemo(() => {
    if (base <= 0) return 0;
    const raw = tipo === "porcentaje" ? base * (valorNum / 100) : Math.min(valorNum, base);
    return Math.max(0, Math.round(raw * 100) / 100);
  }, [tipo, valorNum, base]);

  const porcentajeEfectivo = base > 0 ? (montoDescuento / base) * 100 : 0;
  const nuevoTotal = Math.max(0, totalBruto - (aplicadoA === "total" ? montoDescuento : montoDescuento));
  const nuevoTotalDisplay = Math.max(0, totalBruto - montoDescuento);

  // ---- Control de costo: el descuento no puede dejar el precio por debajo del costo ----
  const costoBase = useMemo(() => {
    const costoDe = (i: CartItem) =>
      (i.producto.es_servicio ? 0 : Number(i.producto.precio_compra ?? 0)) * i.cantidad;
    if (aplicadoA === "producto" && productoSeleccionado) return costoDe(productoSeleccionado);
    return items.reduce((s, i) => s + costoDe(i), 0);
  }, [aplicadoA, productoSeleccionado, items]);

  const maxDescuentoCosto = Math.max(0, Math.round((base - costoBase) * 100) / 100);
  const maxPorcentajeCosto = base > 0 ? (maxDescuentoCosto / base) * 100 : 0;
  const bajoCosto = costoBase > 0 && montoDescuento > maxDescuentoCosto + 0.009;
  const margenResultante = base - montoDescuento - costoBase;
  const puedeAutorizarBajoCosto =
    isAdminMaestro || role === "administrador" || role === "gerente";

  // Límite por rol (basado en porcentaje efectivo sobre la base)
  const limite = limitePorRol(role, isAdminMaestro);
  const requiereAutorizacion = porcentajeEfectivo > limite && !autorizadoPor;

  const puedeAplicar =
    items.length > 0 &&
    valorNum > 0 &&
    montoDescuento > 0 &&
    montoDescuento <= base &&
    motivo.length > 0 &&
    (motivo !== "Otro" || motivoTexto.trim().length > 0) &&
    (aplicadoA !== "producto" || !!productoSeleccionado) &&
    !requiereAutorizacion &&
    (!bajoCosto || (puedeAutorizarBajoCosto && aceptaBajoCosto));

  const autorizar = async () => {
    if (!adminEmail || !adminPass) {
      toast.error("Ingresa credenciales del administrador");
      return;
    }
    setVerificando(true);
    try {
      const { data, error } = await supabaseSignup.auth.signInWithPassword({
        email: adminEmail.trim(),
        password: adminPass,
      });
      if (error || !data.user) {
        toast.error("Credenciales inválidas");
        return;
      }
      // Verificar que sea administrador
      const emailNorm = adminEmail.trim().toLowerCase();
      const esMaestro = emailNorm === "kevincoorporativa@gmail.com";
      let esAdmin = esMaestro;
      if (!esAdmin) {
        const { data: r } = await supabase
          .from("roles_usuario")
          .select("rol")
          .eq("usuario_id", data.user.id)
          .maybeSingle();
        esAdmin = r?.rol === "administrador" || r?.rol === "gerente";
      }
      // cerrar sesión temporal
      await supabaseSignup.auth.signOut();
      if (!esAdmin) {
        toast.error("El usuario no tiene rol de administrador");
        return;
      }
      setAutorizadoPor(emailNorm);
      toast.success("Autorización concedida");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al autorizar");
    } finally {
      setVerificando(false);
    }
  };

  const aplicar = () => {
    if (!puedeAplicar) return;
    onAplicar({
      tipo,
      valor: valorNum,
      aplicadoA,
      productoId: aplicadoA === "producto" ? productoId : undefined,
      motivo,
      motivoTexto: motivo === "Otro" ? motivoTexto.trim() : undefined,
      autorizadoPor,
    });
    toast.success(`Descuento aplicado: ${formatPEN(montoDescuento)}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b bg-gradient-to-r from-primary/10 to-emerald-50 dark:from-primary/20">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Percent className="h-6 w-6 text-primary" /> Aplicar Descuento
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-medium">
            Configura descuentos por porcentaje, monto, producto o total de venta
          </p>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
          {/* Tipo de descuento */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
              Tipo de descuento
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTipo("porcentaje")}
                className={`h-14 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition ${
                  tipo === "porcentaje"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Percent className="h-5 w-5" /> Por Porcentaje
              </button>
              <button
                onClick={() => setTipo("monto")}
                className={`h-14 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition ${
                  tipo === "monto"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <DollarSign className="h-5 w-5" /> Monto Fijo (S/)
              </button>
            </div>
          </div>

          {/* Aplicar a */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
              Aplicar a
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAplicadoA("total")}
                className={`h-14 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition ${
                  aplicadoA === "total"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-border hover:bg-muted"
                }`}
              >
                <ShoppingCart className="h-5 w-5" /> Total de la venta
              </button>
              <button
                onClick={() => setAplicadoA("producto")}
                disabled={items.length === 0}
                className={`h-14 rounded-xl border-2 font-bold flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  aplicadoA === "producto"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Package className="h-5 w-5" /> Producto específico
              </button>
            </div>
          </div>

          {aplicadoA === "producto" && (
            <div>
              <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
                Producto
              </Label>
              <Select value={productoId} onValueChange={setProductoId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.producto.id} value={i.producto.id}>
                      {i.producto.nombre} · {i.cantidad} × {formatPEN(i.producto.precio_venta)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {productoSeleccionado && (
                <div className="mt-3 rounded-xl border bg-muted/40 p-3 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg bg-muted grid place-items-center shrink-0">
                    {productoSeleccionado.producto.imagen ? (
                      <img
                        src={productoSeleccionado.producto.imagen}
                        alt={productoSeleccionado.producto.nombre}
                        className="h-full w-full object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="font-bold">{productoSeleccionado.producto.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {productoSeleccionado.cantidad} × {formatPEN(productoSeleccionado.producto.precio_venta)}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span>Original: <span className="line-through">{formatPEN(base)}</span></span>
                      <span className="text-emerald-600 font-bold">
                        Nuevo: {formatPEN(base - montoDescuento)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Valor */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
              {tipo === "porcentaje" ? "Porcentaje (%)" : "Monto (S/)"}
            </Label>
            {tipo === "porcentaje" && (
              <div className="flex flex-wrap gap-2 mb-2">
                {PORCENTAJES_RAPIDOS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setValor(String(p))}
                    className={`px-3 h-9 rounded-lg text-sm font-bold border-2 transition ${
                      Number(valor) === p
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-muted"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={tipo === "porcentaje" ? "1" : "0.10"}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={tipo === "porcentaje" ? "Ej: 10" : "Ej: 5.00"}
                className="h-12 text-lg font-bold pl-10"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {tipo === "porcentaje" ? <Percent className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />}
              </span>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">
              Motivo del descuento <span className="text-destructive">*</span>
            </Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {motivo === "Otro" && (
              <Input
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                placeholder="Describe el motivo..."
                className="mt-2 h-11"
              />
            )}
          </div>

          {/* Vista previa */}
          <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-4 space-y-2">
            <div className="text-xs font-extrabold uppercase text-emerald-700 flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" /> Vista previa
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold tabular-nums">{formatPEN(totalBruto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Descuento ({porcentajeEfectivo.toFixed(1)}%)</span>
              <span className="font-bold tabular-nums text-destructive">- {formatPEN(montoDescuento)}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t border-emerald-200">
              <span className="font-extrabold">Nuevo Total</span>
              <span className="font-black tabular-nums text-emerald-600">{formatPEN(nuevoTotalDisplay)}</span>
            </div>
            <div className="text-xs font-bold text-emerald-700 text-right">
              Ahorro del cliente: {formatPEN(montoDescuento)}
            </div>
            {costoBase > 0 && (
              <div className="pt-2 mt-1 border-t border-emerald-200 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground font-semibold uppercase">Costo</div>
                  <div className="font-bold tabular-nums">{formatPEN(costoBase)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-semibold uppercase">Margen</div>
                  <div className={`font-bold tabular-nums ${margenResultante < 0 ? "text-destructive" : "text-emerald-700"}`}>
                    {formatPEN(margenResultante)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground font-semibold uppercase">Desc. máx.</div>
                  <div className="font-bold tabular-nums">
                    {formatPEN(maxDescuentoCosto)} ({maxPorcentajeCosto.toFixed(1)}%)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Aviso: descuento por debajo del costo */}
          {bajoCosto && (
            <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <TrendingDown className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-extrabold text-destructive">
                    El descuento deja el precio por debajo del costo
                  </div>
                  <div className="text-xs text-destructive/90">
                    Costo {formatPEN(costoBase)} · Precio con descuento {formatPEN(base - montoDescuento)} ·
                    Pérdida {formatPEN(Math.abs(margenResultante))}. Máximo permitido:{" "}
                    <b>{formatPEN(maxDescuentoCosto)} ({maxPorcentajeCosto.toFixed(1)}%)</b>.
                  </div>
                </div>
              </div>
              {puedeAutorizarBajoCosto ? (
                <label className="flex items-center gap-2 text-xs font-bold text-destructive cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aceptaBajoCosto}
                    onChange={(e) => setAceptaBajoCosto(e.target.checked)}
                    className="h-4 w-4 accent-current"
                  />
                  Autorizo vender por debajo del costo (queda registrado en auditoría)
                </label>
              ) : (
                <div className="text-xs font-bold text-destructive">
                  Tu rol no puede vender bajo costo. Reduce el descuento.
                </div>
              )}
            </div>
          )}

          {/* Autorización */}
          {requiereAutorizacion && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-extrabold text-amber-800">
                    Se requiere autorización del administrador
                  </div>
                  <div className="text-xs text-amber-700">
                    Tu rol permite hasta {limite === Infinity ? "∞" : `${limite}%`}. Este descuento es {porcentajeEfectivo.toFixed(1)}%.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  type="email"
                  placeholder="Email admin"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="h-11"
                />
                <Input
                  type="password"
                  placeholder="Contraseña"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="h-11"
                />
              </div>
              <Button
                onClick={autorizar}
                disabled={verificando}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-extrabold"
              >
                {verificando ? "Verificando..." : "Autorizar"}
              </Button>
            </div>
          )}

          {autorizadoPor && (
            <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <Check className="h-4 w-4" /> Autorizado por {autorizadoPor}
            </div>
          )}
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-card gap-2 sm:gap-2">
          {descuentoActual && (
            <Button
              variant="outline"
              onClick={() => { onQuitar(); toast.info("Descuento eliminado"); onOpenChange(false); }}
              className="h-12 px-4 font-bold text-destructive border-destructive/40 hover:bg-destructive/10"
            >
              <X className="h-4 w-4 mr-2" /> Eliminar
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-12 px-4 font-bold"
          >
            Cancelar
          </Button>
          <Button
            onClick={aplicar}
            disabled={!puedeAplicar}
            className="h-12 px-6 font-extrabold flex-1"
          >
            <Check className="h-5 w-5 mr-2" />
            {descuentoActual ? "Reemplazar descuento" : "Aplicar descuento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
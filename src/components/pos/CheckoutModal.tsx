import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Check } from "lucide-react";
import { formatPEN } from "@/lib/format";
import { toast } from "sonner";
import yapeLogo from "@/assets/yape.png.asset.json";
import plinLogo from "@/assets/plin.png.asset.json";

// Logos de marca como SVG inline (Efectivo y Tarjetas)
const EfectivoLogo = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 48 32" className="h-9 w-14" aria-hidden>
    <rect x="1" y="1" width="46" height="30" rx="4"
      fill={active ? "#ffffff" : "#10b981"} stroke={active ? "#ffffff" : "#059669"} strokeWidth="1.5"/>
    <circle cx="24" cy="16" r="7" fill="none" stroke={active ? "#10b981" : "#ffffff"} strokeWidth="1.8"/>
    <text x="24" y="20" textAnchor="middle" fontSize="9" fontWeight="900"
      fill={active ? "#10b981" : "#ffffff"} fontFamily="system-ui">S/</text>
  </svg>
);

const YapeLogo = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden>
    {/* Fondo redondeado morado de Yape */}
    <rect width="100" height="100" rx="25" fill={active ? "#ffffff" : "#742284"} />
    {/* Círculo turquesa con "S/" */}
    <circle cx="50" cy="35" r="18" fill="#00D2B5" />
    <text x="50" y="40" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white" fontFamily="sans-serif">S/</text>
    {/* Texto "yape" estilizado simplificado */}
    <text x="50" y="75" textAnchor="middle" fontSize="28" fontWeight="900" fill={active ? "#742284" : "white"} fontFamily="cursive, sans-serif">yape</text>
  </svg>
);

const PlinLogo = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 100 100" className="h-12 w-12" aria-hidden>
    {/* Círculo degradado cian/azul de Plin */}
    <defs>
      <linearGradient id="plinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00E5E5" />
        <stop offset="100%" stopColor="#0080FF" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill={active ? "white" : "url(#plinGradient)"} />
    {/* Texto "plin" */}
    <text x="50" y="62" textAnchor="middle" fontSize="32" fontWeight="900" fill={active ? "#0080FF" : "white"} fontFamily="sans-serif">plin</text>
    {/* Punto rosado característico */}
    <circle cx="68" cy="40" r="5" fill="#FF4081" />
  </svg>
);

const VisaMcLogo = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 60 28" className="h-8 w-16" aria-hidden>
    <rect width="60" height="28" rx="4" fill={active ? "#ffffff" : "#1A1F71"}/>
    <text x="14" y="20" textAnchor="middle" fontSize="11" fontWeight="900"
      fill={active ? "#1A1F71" : "#ffffff"} fontFamily="system-ui" fontStyle="italic">VISA</text>
    <circle cx="38" cy="14" r="6" fill="#EB001B" opacity="0.9"/>
    <circle cx="46" cy="14" r="6" fill="#F79E1B" opacity="0.85"/>
  </svg>
);

const TransferLogo = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 48 32" className="h-9 w-14" aria-hidden>
    <rect x="1" y="1" width="46" height="30" rx="4"
      fill={active ? "#ffffff" : "#0F4C81"} stroke={active ? "#ffffff" : "#0a3a64"} strokeWidth="1.5"/>
    <path d="M12 12 H32 M28 8 L34 12 L28 16" stroke={active ? "#0F4C81" : "#ffffff"} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M36 22 H16 M20 18 L14 22 L20 26" stroke={active ? "#0F4C81" : "#ffffff"} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo", Logo: EfectivoLogo, color: "bg-emerald-500", ring: "ring-emerald-300" },
  { value: "YAPE", label: "Yape", Logo: YapeLogo, color: "bg-[#6B2BD9]", ring: "ring-purple-300" },
  { value: "PLIN", label: "Plin", Logo: PlinLogo, color: "bg-[#00B2A9]", ring: "ring-cyan-300" },
  { value: "TARJETA_DEBITO", label: "Débito", Logo: VisaMcLogo, color: "bg-[#1A1F71]", ring: "ring-blue-300" },
  { value: "TARJETA_CREDITO", label: "Crédito", Logo: VisaMcLogo, color: "bg-[#1A1F71]", ring: "ring-indigo-300" },
  { value: "TRANSFERENCIA", label: "Transfer.", Logo: TransferLogo, color: "bg-[#0F4C81]", ring: "ring-slate-300" },
] as const;

const BILLETES = [10, 20, 50, 100, 200];

type Pago = { metodo: string; monto: number; referencia?: string };

export function CheckoutModal({
  open,
  onOpenChange,
  total,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  onConfirm: (data: {
    tipo_comprobante: "BOLETA" | "FACTURA" | "TICKET";
    serie: string;
    documento_cliente?: string;
    nombre_cliente?: string;
    pagos: Pago[];
  }) => void;
}) {
  const [tipo, setTipo] = useState<"BOLETA" | "FACTURA" | "TICKET">("TICKET");
  const [doc, setDoc] = useState("");
  const [nombre, setNombre] = useState("");
  const [pagos, setPagos] = useState<Pago[]>([
    { metodo: "EFECTIVO", monto: total },
  ]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPagos([{ metodo: "EFECTIVO", monto: total }]);
      setDoc("");
      setNombre("");
      setTipo("TICKET");
    }
  }, [open, total]);

  const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const vuelto = totalPagado - total;
  const falta = total - totalPagado;
  const completo = totalPagado >= total - 0.01;
  const serie =
    tipo === "BOLETA" ? "B001" : tipo === "FACTURA" ? "F001" : "T001";

  const updatePago = (i: number, patch: Partial<Pago>) =>
    setPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  // Al cambiar de método: recalcula el monto para cubrir lo que falta
  // (suma/resta automática). Efectivo permite vuelto, los demás se ajustan exacto.
  const cambiarMetodo = (i: number, nuevoMetodo: string) => {
    setPagos((prev) => {
      const otrosPagados = prev.reduce(
        (s, p, idx) => (idx === i ? s : s + (p.monto || 0)),
        0,
      );
      const restante = Math.max(0, +(total - otrosPagados).toFixed(2));
      return prev.map((p, idx) =>
        idx === i ? { ...p, metodo: nuevoMetodo, monto: restante } : p,
      );
    });
  };

  const confirmar = () => {
    if (totalPagado < total - 0.01) {
      toast.error(`Falta ${formatPEN(falta)}`);
      return;
    }
    if (tipo === "FACTURA" && (!doc || doc.length !== 11)) {
      toast.error("Ingresa el RUC del cliente (11 dígitos)");
      return;
    }
    onConfirm({
      tipo_comprobante: tipo,
      serie,
      documento_cliente: doc || undefined,
      nombre_cliente: nombre.trim() || undefined,
      pagos,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        {/* HEADER GRANDE con total */}
        <div
          className={`px-8 py-6 transition-colors text-white ${
            completo
              ? "bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-600"
              : "bg-gradient-to-r from-primary via-primary to-primary/80"
          }`}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold opacity-90">
              Cobrar venta
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-wider opacity-80">Total a cobrar</div>
              <div className="text-6xl font-black tabular-nums leading-none mt-1">
                {formatPEN(total)}
              </div>
            </div>
            <div className="text-right">
              {completo ? (
                <div className="space-y-1">
                  <div className="text-sm uppercase tracking-wider opacity-80">Vuelto</div>
                  <div className="text-4xl font-black tabular-nums">{formatPEN(vuelto)}</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm uppercase tracking-wider opacity-80">Falta</div>
                  <div className="text-4xl font-black tabular-nums">{formatPEN(falta)}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_1.2fr] gap-0">
          {/* Columna comprobante */}
          <div className="p-6 border-r space-y-5">
            <div>
              <Label className="text-base font-bold mb-2 block">Tipo de comprobante</Label>
              <Tabs
              value={tipo}
              onValueChange={(v) => setTipo(v as typeof tipo)}
              className="mt-2"
            >
              <TabsList className="grid grid-cols-3 w-full h-14">
                <TabsTrigger value="BOLETA" className="text-base font-bold">Boleta</TabsTrigger>
                <TabsTrigger value="FACTURA" className="text-base font-bold">Factura</TabsTrigger>
                <TabsTrigger value="TICKET" className="text-base font-bold">Ticket</TabsTrigger>
              </TabsList>
              <TabsContent value={tipo} className="mt-3 space-y-2">
                <div className="text-sm text-muted-foreground">
                  Serie: <span className="font-mono font-bold text-foreground">{serie}</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">
                    {tipo === "FACTURA" ? "RUC" : "DNI / RUC / CE"}
                    {tipo === "TICKET" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (opcional · por defecto Cliente Genérico)
                      </span>
                    )}
                  </Label>
                  <Input
                    value={doc}
                    onChange={(e) => setDoc(e.target.value.replace(/\D/g, ""))}
                    placeholder={
                      tipo === "FACTURA"
                        ? "20XXXXXXXXX"
                        : tipo === "TICKET"
                          ? "Cliente Genérico"
                          : "DNI 8 dígitos"
                    }
                    maxLength={tipo === "FACTURA" ? 11 : 12}
                    className="h-12 text-lg font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">
                    Nombre del cliente
                    {tipo === "TICKET" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (opcional)
                      </span>
                    )}
                  </Label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={
                      tipo === "FACTURA"
                        ? "Razón social"
                        : "Nombres y apellidos"
                    }
                    maxLength={120}
                    className="h-12 text-lg"
                  />
                </div>
              </TabsContent>
            </Tabs>
            </div>

            {/* Billetes rápidos (solo si hay un pago en efectivo seleccionado) */}
            {pagos[0]?.metodo === "EFECTIVO" && pagos.length === 1 && (
              <div>
                <Label className="text-base font-bold mb-2 block">Efectivo recibido</Label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Button
                    variant="outline"
                    className="h-14 text-base font-bold border-2"
                    onClick={() => updatePago(0, { monto: total })}
                  >
                    Exacto
                  </Button>
                  {BILLETES.slice(0, 2).map((b) => (
                    <Button
                      key={b}
                      variant="outline"
                      className="h-14 text-base font-bold border-2"
                      onClick={() => updatePago(0, { monto: b })}
                    >
                      S/ {b}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {BILLETES.slice(2).map((b) => (
                    <Button
                      key={b}
                      variant="outline"
                      className="h-14 text-base font-bold border-2"
                      onClick={() => updatePago(0, { monto: b })}
                    >
                      S/ {b}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-muted p-4 space-y-2 text-base">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagado</span>
                <span className="font-extrabold tabular-nums">{formatPEN(totalPagado)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Total</span>
                <span className="font-extrabold tabular-nums">{formatPEN(total)}</span>
              </div>
            </div>
          </div>

          {/* Columna pagos */}
          <div className="p-6 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-base font-bold">
                Método de pago {pagos.length > 1 && <Badge variant="secondary" className="ml-2">MIXTO</Badge>}
              </Label>
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() =>
                  setPagos((p) => [
                    ...p,
                    { metodo: "YAPE", monto: Math.max(0, falta) },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Dividir
              </Button>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {pagos.map((p, i) => (
                <div key={i} className="bg-card rounded-xl p-3 border-2 space-y-3">
                  {/* Grid de métodos con iconos grandes */}
                  <div className="grid grid-cols-3 gap-2">
                    {METODOS.map((m) => {
                      const Logo = m.Logo;
                      const active = p.metodo === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => cambiarMetodo(i, m.value)}
                          className={`relative h-24 rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 transition active:scale-95 ${
                            active
                              ? `${m.color} text-white border-transparent shadow-lg ring-4 ${m.ring}`
                              : "bg-card hover:bg-muted border-border hover:border-primary/40"
                          }`}
                        >
                          {active && (
                            <Check className="absolute top-1 right-1 h-4 w-4" />
                          )}
                          <Logo active={active} />
                          <span className="text-xs font-bold">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Monto</Label>
                      <Input
                        type="number"
                        step="0.10"
                        min="0"
                        value={p.monto}
                        onChange={(e) =>
                          updatePago(i, { monto: parseFloat(e.target.value) || 0 })
                        }
                        className="h-14 text-2xl font-extrabold tabular-nums text-right"
                      />
                    </div>
                    {pagos.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-14 w-14 text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setPagos((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        <X className="h-6 w-6" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-16 px-8 text-lg font-bold flex-1 sm:flex-initial"
          >
            <X className="h-5 w-5 mr-2" /> Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!completo}
            className={`h-16 px-8 text-xl font-extrabold flex-1 shadow-lg transition ${
              completo ? "bg-emerald-500 hover:bg-emerald-600 text-white" : ""
            }`}
          >
            <Check className="h-6 w-6 mr-2" />
            {completo ? `CONFIRMAR ${formatPEN(total)}` : `Falta ${formatPEN(falta)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
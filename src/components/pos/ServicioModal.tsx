import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPEN } from "@/lib/format";
import { Smartphone, Zap } from "lucide-react";

export type ServicioTipo = "recarga" | "pago";

export type ServicioResultado = {
  tipo: ServicioTipo;
  proveedor: string;
  monto: number;
  comision: number;
  referencia: string;
  descripcion: string;
  total: number;
};

const OPERADORES = ["Claro", "Movistar", "Entel", "Bitel"];
const SERVICIOS = ["Luz", "Agua", "Internet", "Cable", "Gas", "Teléfono", "Otro"];
const MONTOS_RAPIDOS = [5, 10, 15, 20, 30, 50];

export function ServicioModal({
  open,
  onOpenChange,
  tipo,
  comisionSugerida = 0,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tipo: ServicioTipo;
  comisionSugerida?: number;
  onConfirm: (r: ServicioResultado) => void;
}) {
  const esRecarga = tipo === "recarga";
  const opciones = esRecarga ? OPERADORES : SERVICIOS;
  const [proveedor, setProveedor] = useState(opciones[0]);
  const [monto, setMonto] = useState("");
  const [comision, setComision] = useState(String(comisionSugerida));
  const [referencia, setReferencia] = useState("");

  useEffect(() => {
    if (!open) return;
    setProveedor(opciones[0]);
    setMonto("");
    setComision(String(comisionSugerida));
    setReferencia("");
  }, [open, tipo]);

  const m = Number(monto) || 0;
  const c = Number(comision) || 0;
  const total = useMemo(() => Math.round((m + c) * 100) / 100, [m, c]);
  const valido = m > 0 && c >= 0;

  const confirmar = () => {
    if (!valido) return;
    const descripcion = esRecarga
      ? `Recarga ${proveedor}${referencia ? ` · ${referencia}` : ""}`
      : `Pago ${proveedor}${referencia ? ` · ${referencia}` : ""}`;
    onConfirm({
      tipo,
      proveedor,
      monto: m,
      comision: c,
      referencia,
      descripcion,
      total,
    });
    onOpenChange(false);
  };

  const Icon = esRecarga ? Smartphone : Zap;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${esRecarga ? "text-purple-600" : "text-blue-600"}`} />
            {esRecarga ? "Recarga Celular" : "Pago de Servicio"}
          </DialogTitle>
          <DialogDescription>
            {esRecarga
              ? "Registra la recarga como una línea de venta."
              : "Registra el cobro del servicio y su comisión."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{esRecarga ? "Operador" : "Servicio"}</Label>
            <div className="flex flex-wrap gap-2">
              {opciones.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setProveedor(o)}
                  className={`h-9 px-3 rounded-lg border-2 text-sm font-bold transition ${
                    proveedor === o
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="serv-monto">Monto (S/)</Label>
              <Input
                id="serv-monto"
                type="number"
                min="0"
                step="0.10"
                value={monto}
                autoFocus
                onChange={(e) => setMonto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmar()}
                placeholder="0.00"
                className="h-11 text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serv-comision">Comisión (S/)</Label>
              <Input
                id="serv-comision"
                type="number"
                min="0"
                step="0.10"
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmar()}
                placeholder="0.00"
                className="h-11 text-lg font-bold"
              />
            </div>
          </div>

          {esRecarga && (
            <div className="flex flex-wrap gap-2">
              {MONTOS_RAPIDOS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMonto(String(v))}
                  className="h-9 px-3 rounded-lg border text-sm font-bold hover:bg-muted"
                >
                  S/ {v}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="serv-ref">
              {esRecarga ? "Número de celular (opcional)" : "N° de suministro / recibo (opcional)"}
            </Label>
            <Input
              id="serv-ref"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmar()}
              placeholder={esRecarga ? "999 888 777" : "Ej. 0123456789"}
              className="h-11"
            />
          </div>

          <div className="rounded-xl border-2 bg-muted/40 p-3 flex items-center justify-between">
            <span className="text-sm font-bold text-muted-foreground">Total a cobrar</span>
            <span className="text-2xl font-black">{formatPEN(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!valido} className="font-bold">
            Agregar al carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

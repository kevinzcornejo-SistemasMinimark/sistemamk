import { useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Eye } from "lucide-react";
import { formatPEN } from "@/lib/format";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";
import { useAppConfig } from "@/hooks/useAppConfig";
import type { CartItem } from "@/hooks/usePOSCart";

export interface TicketData {
  tipo: "BOLETA" | "FACTURA" | "TICKET";
  serie: string;
  correlativo: number | string;
  fecha: Date;
  items: CartItem[];
  subtotal: number;
  igv: number;
  total: number;
  metodoPago: string;
  cliente?: string;
  documentoCliente?: string;
  cajero?: string;
  caja?: string;
  turno?: string;
  descuento?: number;
  descuentoMotivo?: string;
}

const tipoLabel = (t: TicketData["tipo"]) =>
  t === "BOLETA" ? "BOLETA DE VENTA" : t === "FACTURA" ? "FACTURA ELECTRÓNICA" : "TICKET DE VENTA";

export function TicketModal({
  open,
  onOpenChange,
  ticket,
  autoPrint = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ticket: TicketData | null;
  autoPrint?: boolean;
}) {
  const biz = useBusinessInfo();
  const { cfg } = useAppConfig();
  const printedRef = useRef(false);
  const correl = ticket ? String(ticket.correlativo).padStart(4, "0") : "";
  const fechaStr = ticket
    ? ticket.fecha.toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      })
    : "";
  const promocion = (cfg.ticket_promocion || "").trim();
  const pie = (cfg.ticket_pie || "¡Gracias por su compra!").trim();
  const copias = Math.max(1, Math.min(20, parseInt(cfg.impresora_copias || "1", 10) || 1));

  const handlePrint = useCallback(() => {
    if (!ticket) return;
    const el = document.getElementById("ticket-print-area");
    if (!el) return;
    const bodyOne = el.innerHTML;
    const body = Array.from({ length: copias })
      .map((_, i) => `<div>${bodyOne}</div>${i < copias - 1 ? '<div style="page-break-after:always"></div>' : ""}`)
      .join("");
    const html = `
      <html><head><title>Ticket ${ticket.serie}-${correl}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; padding: 8px; margin: 0; color: #000; -webkit-font-smoothing: none; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: 900; }
        img { max-height: 110px !important; max-width: 100% !important; filter: contrast(1.6) grayscale(1); }
        hr { border: 0; border-top: 2px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 2px 0; font-size: 12px; font-weight: 700; }
        th { font-weight: 900; }
        th:last-child, td:last-child { text-align: right; }
        .total { font-size: 18px; font-weight: 900; }
      </style></head>
      <body>${body}</body>
      </html>
    `;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(html); doc.close();
    const fire = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1500);
    };
    if (iframe.contentWindow?.document.readyState === "complete") setTimeout(fire, 200);
    else iframe.onload = () => setTimeout(fire, 200);
  }, [ticket, correl, copias]);

  // Impresión automática al confirmar la venta
  useEffect(() => {
    if (!open || !ticket) { printedRef.current = false; return; }
    if (!autoPrint || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => handlePrint(), 250);
    return () => clearTimeout(t);
  }, [open, ticket, autoPrint, handlePrint]);

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5 text-emerald-600" /> Vista previa del ticket
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-medium">
            Revisa el contenido antes de enviarlo a la impresora
          </p>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-5 bg-muted/40">
          <div
            id="ticket-print-area"
            className="bg-white text-black mx-auto p-4 rounded shadow-sm font-mono text-[13px] font-bold leading-tight"
            style={{ width: 300 }}
          >
            <div className="center text-center">
              {biz.ticketLogo && (
                <div className="flex justify-center mb-2">
                  <img src={biz.ticketLogo} alt="logo" style={{ maxHeight: 110, maxWidth: 260 }} />
                </div>
              )}
              <div className="bold font-extrabold text-lg">{biz.nombre.toUpperCase()}</div>
              <div>R.U.C. : {biz.ruc}</div>
              <div>{biz.direccion}</div>
              {biz.telefono && <div>Tel: {biz.telefono}</div>}
              <hr className="my-2 border-t border-dashed border-black" />
              <div className="bold font-extrabold">{tipoLabel(ticket.tipo)}</div>
              <div className="bold font-extrabold mt-1 text-base">{ticket.serie}-{correl}</div>
            </div>
            <hr className="my-2 border-t border-dashed border-black" />
            <div>FECHA : {fechaStr}</div>
            <div>TIPO  : Venta</div>
            <div>CLIENTE : {ticket.cliente ?? "Cliente Genérico"}</div>
            {ticket.documentoCliente && <div>DOC : {ticket.documentoCliente}</div>}
            <div>PAGO  : {ticket.metodoPago}</div>
            <hr className="my-2 border-t border-dashed border-black" />
            <table className="w-full">
              <thead>
                <tr className="border-b border-dashed border-black font-extrabold">
                  <th className="text-left">CANT</th>
                  <th className="text-left">DESCRIPCION</th>
                  <th className="text-right">PRECIO</th>
                  <th className="text-right">SUBT</th>
                </tr>
              </thead>
              <tbody>
                {ticket.items.map((i) => (
                  <tr key={i.producto.id}>
                    <td className="align-top">{i.cantidad}</td>
                    <td className="align-top pr-1">{i.producto.nombre}</td>
                    <td className="align-top text-right tabular-nums">{i.producto.precio_venta.toFixed(2)}</td>
                    <td className="align-top text-right tabular-nums">{(i.producto.precio_venta * i.cantidad - i.descuento).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <hr className="my-2 border-t border-dashed border-black" />
            <div className="row flex justify-between text-xs font-bold">
              <span>SUBTOTAL</span><span className="tabular-nums">{formatPEN(ticket.subtotal)}</span>
            </div>
            <div className="row flex justify-between text-xs font-bold">
              <span>IGV (18%)</span><span className="tabular-nums">{formatPEN(ticket.igv)}</span>
            </div>
            {ticket.descuento && ticket.descuento > 0 ? (
              <>
                <div className="row flex justify-between text-xs">
                  <span>DESCUENTO</span><span className="tabular-nums">- {formatPEN(ticket.descuento)}</span>
                </div>
                {ticket.descuentoMotivo && (
                  <div className="text-[10px]">Motivo: {ticket.descuentoMotivo}</div>
                )}
              </>
            ) : null}
            <hr className="my-2 border-t border-dashed border-black" />
            <div className="row flex justify-between total text-lg font-extrabold">
              <span>TOTAL S/.</span>
              <span className="tabular-nums">{ticket.total.toFixed(2)}</span>
            </div>
            <hr className="my-2 border-t border-dashed border-black" />
            {promocion && (
              <div className="center text-center text-[12px] font-extrabold mb-1">
                {promocion.split("\n").map((l, i) => (<div key={i}>{l}</div>))}
              </div>
            )}
            <div className="center text-center text-[12px] font-bold">
              {pie.split("\n").map((l, i) => (<div key={i}>{l}</div>))}
            </div>
            <hr className="my-2 border-t border-dashed border-black" />
            <div className="text-[11px] leading-snug font-bold">
              <div>EMITIDO : {fechaStr}</div>
              {ticket.caja && <div>CAJA    : {ticket.caja}</div>}
              {ticket.turno && <div>TURNO   : {ticket.turno}</div>}
              {ticket.cajero && <div>CAJERO  : {ticket.cajero}</div>}
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t bg-card gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-14 px-6 text-base font-bold flex-1 sm:flex-initial"
          >
            <X className="h-5 w-5 mr-2" /> Sin imprimir
          </Button>
          <Button
            onClick={() => { handlePrint(); onOpenChange(false); }}
            className="h-14 px-6 text-base font-extrabold flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Printer className="h-5 w-5 mr-2" /> Imprimir ahora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

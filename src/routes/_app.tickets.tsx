import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Ticket,
  Search,
  Filter,
  Calendar,
  Printer,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ArrowUpAZ,
  ArrowDownAZ,
} from "lucide-react";
import { Smartphone, Banknote, CreditCard, ArrowRightLeft, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatPEN } from "@/lib/format";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";
import { TicketModal, type TicketData } from "@/components/pos/TicketModal";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const METODO_STYLES: Record<string, string> = {
  EFECTIVO: "bg-emerald-100 text-emerald-700 border-emerald-300",
  YAPE: "bg-purple-100 text-purple-700 border-purple-300",
  PLIN: "bg-cyan-100 text-cyan-700 border-cyan-300",
  TARJETA_DEBITO: "bg-blue-100 text-blue-700 border-blue-300",
  TARJETA_CREDITO: "bg-orange-100 text-orange-700 border-orange-300",
  TARJETA: "bg-blue-100 text-blue-700 border-blue-300",
  TRANSFERENCIA: "bg-slate-200 text-slate-800 border-slate-300",
};
const METODO_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TARJETA_DEBITO: "T. Débito",
  TARJETA_CREDITO: "T. Crédito",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transfer.",
};
function MetodoPill({ metodo }: { metodo: string }) {
  const cls = METODO_STYLES[metodo] ?? "bg-muted text-foreground border-border";
  const label = METODO_LABEL[metodo] ?? metodo;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

function metodoMeta(metodo: string) {
  switch (metodo) {
    case "YAPE":
      return { icon: Smartphone, bg: "bg-card", iconBg: "bg-purple-100", iconColor: "text-purple-600", barColor: "bg-purple-500" };
    case "PLIN":
      return { icon: Smartphone, bg: "bg-card", iconBg: "bg-cyan-100", iconColor: "text-cyan-600", barColor: "bg-cyan-500" };
    case "EFECTIVO":
      return { icon: Banknote, bg: "bg-card", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", barColor: "bg-emerald-500" };
    case "TARJETA":
    case "TARJETA_DEBITO":
      return { icon: CreditCard, bg: "bg-card", iconBg: "bg-blue-100", iconColor: "text-blue-600", barColor: "bg-blue-500" };
    case "TARJETA_CREDITO":
      return { icon: CreditCard, bg: "bg-card", iconBg: "bg-orange-100", iconColor: "text-orange-600", barColor: "bg-orange-500" };
    case "TRANSFERENCIA":
      return { icon: ArrowRightLeft, bg: "bg-card", iconBg: "bg-slate-200", iconColor: "text-slate-700", barColor: "bg-slate-500" };
    default:
      return { icon: Wallet, bg: "bg-card", iconBg: "bg-muted", iconColor: "text-foreground", barColor: "bg-foreground/60" };
  }
}

export const Route = createFileRoute("/_app/tickets")({
  head: () => ({ meta: [{ title: "Tickets — POS Minimarket" }] }),
  component: TicketsPage,
});

type Venta = {
  id: string;
  correlativo: number;
  serie: string;
  tipo_comprobante: string;
  total: number;
  descuento: number;
  metodo_pago: string;
  estado: string;
  creada_en: string;
  cajero_id: string | null;
  clientes: { razon_social: string | null; nombres: string | null } | null;
};

type RangoPreset = "hoy" | "ayer" | "semana" | "mes" | "rango";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function TicketsPage() {
  const { user, isDemo } = useAuth();
  const biz = useBusinessInfo();
  const [rows, setRows] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [preset, setPreset] = useState<RangoPreset>("hoy");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipo, setTipo] = useState<string>("TODOS");
  const [metodo, setMetodo] = useState<string>("TODOS");
  const [estado, setEstado] = useState<string>("TODOS");
  const [reprintOpen, setReprintOpen] = useState(false);
  const [reprintData, setReprintData] = useState<TicketData | null>(null);
  const [reprintingId, setReprintingId] = useState<string | null>(null);
  const [confirmVenta, setConfirmVenta] = useState<Venta | null>(null);
  const [cajerosMap, setCajerosMap] = useState<Record<string, string>>({});
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Imprime HTML usando un iframe oculto (evita bloqueadores de popups)
  const printViaIframe = (html: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();
    const trigger = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) { /* noop */ }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1500);
    };
    if (iframe.contentWindow?.document.readyState === "complete") {
      setTimeout(trigger, 250);
    } else {
      iframe.onload = () => setTimeout(trigger, 250);
    }
  };

  const cargar = async () => {
    if (isDemo || !user) { setRows([]); setLoading(false); return; }
    setLoading(true);
    let qy = supabase
      .from("ventas")
      .select("id,correlativo,serie,tipo_comprobante,total,subtotal,igv,descuento,metodo_pago,estado,creada_en,cajero_id,clientes(razon_social,nombres)")
      .order("creada_en", { ascending: false })
      .limit(5000);
    if (from) qy = qy.gte("creada_en", from.toISOString());
    if (to) qy = qy.lte("creada_en", to.toISOString());
    const { data, error } = await qy;
    if (error) toast.error(error.message);
    const ventas = (data ?? []) as any[];
    setRows(ventas as any);
    // Resolver nombres de cajeros desde perfiles
    const ids = Array.from(new Set(ventas.map((v) => v.cajero_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: per } = await supabase.from("perfiles").select("id,nombre,correo").in("id", ids);
      const map: Record<string, string> = {};
      (per ?? []).forEach((p: any) => {
        map[p.id] = p.nombre || (p.correo ? String(p.correo).split("@")[0] : p.id.slice(0, 8));
      });
      setCajerosMap(map);
    } else {
      setCajerosMap({});
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isDemo, preset, desde, hasta]);

  // Calcular rango según preset
  const { from, to } = useMemo(() => {
    const now = new Date();
    if (preset === "hoy") return { from: startOfDay(now), to: endOfDay(now) };
    if (preset === "ayer") {
      const a = new Date(now); a.setDate(a.getDate() - 1);
      return { from: startOfDay(a), to: endOfDay(a) };
    }
    if (preset === "semana") {
      const a = new Date(now); a.setDate(a.getDate() - 7);
      return { from: startOfDay(a), to: endOfDay(now) };
    }
    if (preset === "mes") {
      const a = new Date(now); a.setDate(a.getDate() - 30);
      return { from: startOfDay(a), to: endOfDay(now) };
    }
    return {
      from: desde ? startOfDay(new Date(desde)) : null,
      to: hasta ? endOfDay(new Date(hasta)) : null,
    };
  }, [preset, desde, hasta]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      const d = new Date(r.creada_en);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (tipo !== "TODOS" && r.tipo_comprobante !== tipo) return false;
      if (metodo !== "TODOS" && r.metodo_pago !== metodo) return false;
      if (estado !== "TODOS" && r.estado !== estado) return false;
      if (k) {
        const haystack = `${r.serie}-${r.correlativo} ${r.tipo_comprobante} ${r.clientes?.razon_social ?? ""} ${r.clientes?.nombres ?? ""}`.toLowerCase();
        if (!haystack.includes(k)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const ta = new Date(a.creada_en).getTime();
      const tb = new Date(b.creada_en).getTime();
      return sortDir === "asc" ? ta - tb : tb - ta;
    });
    return out;
  }, [rows, q, from, to, tipo, metodo, estado, sortDir]);

  const totalPeriodo = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.total || 0), 0),
    [filtered],
  );

  const desgloseMetodos = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const v of filtered) {
      const k = v.metodo_pago || "—";
      const cur = map.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(v.total || 0);
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([metodo, d]) => ({
        metodo,
        count: d.count,
        total: d.total,
        pct: totalPeriodo > 0 ? (d.total / totalPeriodo) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, totalPeriodo]);

  const tiposUnicos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.tipo_comprobante))).filter(Boolean),
    [rows],
  );
  const metodosUnicos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.metodo_pago))).filter(Boolean),
    [rows],
  );

  const exportarExcel = () => {
    if (filtered.length === 0) { toast.error("No hay tickets para exportar"); return; }
    const data = filtered.map((v) => ({
      Comprobante: `${v.serie}-${String(v.correlativo).padStart(8, "0")}`,
      Tipo: v.tipo_comprobante,
      Cliente: v.clientes?.razon_social ?? v.clientes?.nombres ?? "",
      Metodo: METODO_LABEL[v.metodo_pago] ?? v.metodo_pago,
      Estado: v.estado,
      Fecha: new Date(v.creada_en).toLocaleString("es-PE"),
      Total: Number(v.total),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 22 }, { wch: 10 }, { wch: 28 }, { wch: 12 }, { wch: 11 }, { wch: 22 }, { wch: 12 }];
    // Formato moneda para Total
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 6 })];
      if (cell) cell.z = '"S/" #,##0.00';
    }
    // Fila total
    const totalRow = range.e.r + 2;
    XLSX.utils.sheet_add_aoa(ws, [["", "", "", "", "", "TOTAL", totalPeriodo]], { origin: { r: totalRow, c: 0 } });
    const totalCell = ws[XLSX.utils.encode_cell({ r: totalRow, c: 6 })];
    if (totalCell) totalCell.z = '"S/" #,##0.00';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    XLSX.writeFile(wb, `tickets-${toInputDate(new Date())}.xlsx`, { bookType: "xlsx" });
    toast.success(`${filtered.length} tickets exportados a Excel`);
  };

  const exportarPDF = () => {
    if (filtered.length === 0) { toast.error("No hay tickets para exportar"); return; }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Reporte de Tickets", 14, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Periodo: ${periodoTexto}   |   Total: S/ ${totalPeriodo.toFixed(2)}   |   ${filtered.length} ticket(s)   |   Orden: ${sortDir === "asc" ? "Fecha ascendente" : "Fecha descendente"}`,
      14, 23,
    );
    doc.setTextColor(0, 0, 0);

    const body = filtered.map((v) => {
      const f = new Date(v.creada_en);
      const fecha = f.toLocaleDateString("es-PE");
      const hora = f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
      const ticket = `${v.serie}-${String(v.correlativo).padStart(8, "0")}`;
      const cliente = v.clientes?.razon_social ?? v.clientes?.nombres ?? "—";
      const usuario = v.cajero_id ? (cajerosMap[v.cajero_id] ?? v.cajero_id.slice(0, 8)) : "—";
      return [
        ticket, fecha, hora, cliente,
        v.tipo_comprobante || "—",
        METODO_LABEL[v.metodo_pago] ?? v.metodo_pago ?? "—",
        `S/ ${Number(v.total).toFixed(2)}`,
        usuario,
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [["Ticket", "Fecha", "Hora", "Cliente", "Tipo", "Método Pago", "Total", "Usuario"]],
      body,
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [234, 91, 31], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      columnStyles: { 6: { halign: "right", fontStyle: "bold" } },
      foot: [["", "", "", "", "", "TOTAL", `S/ ${totalPeriodo.toFixed(2)}`, ""]],
      footStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", halign: "right" },
      margin: { left: 10, right: 10 },
    });

    // Cuadro: DETALLE POR MÉTODO DE PAGO
    const porMetodo = new Map<string, { count: number; total: number }>();
    for (const v of filtered) {
      const k = v.metodo_pago || "—";
      const cur = porMetodo.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(v.total || 0);
      porMetodo.set(k, cur);
    }
    const desglose = Array.from(porMetodo.entries()).sort((a, b) => b[1].total - a[1].total);
    const desgloseBody = desglose.map(([m, d]) => {
      const pct = totalPeriodo > 0 ? (d.total / totalPeriodo) * 100 : 0;
      return [
        METODO_LABEL[m] ?? m,
        String(d.count),
        `S/ ${d.total.toFixed(2)}`,
        `${pct.toFixed(1)}%`,
      ];
    });

    const afterY = (doc as any).lastAutoTable?.finalY ?? 28;
    autoTable(doc, {
      startY: afterY + 8,
      head: [["DETALLE POR MÉTODO DE PAGO", "Tickets", "Monto", "%"]],
      body: desgloseBody,
      foot: [["TOTAL", String(filtered.length), `S/ ${totalPeriodo.toFixed(2)}`, "100.0%"]],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "center" },
        2: { halign: "right", fontStyle: "bold" },
        3: { halign: "right" },
      },
      alternateRowStyles: { fillColor: [243, 244, 246] },
      margin: { left: 10, right: 10 },
      tableWidth: 130,
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Generado: ${new Date().toLocaleString("es-PE")}   —   Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 6,
        { align: "right" },
      );
    }

    const fname = `tickets-${toInputDate(new Date())}.pdf`;
    doc.save(fname);
    toast.success(`PDF descargado: ${fname}`);
  };

  const imprimirUltimo = () => {
    if (filtered.length === 0) { toast.error("No hay tickets"); return; }
    reimprimir(filtered[0]);
  };

  const presetLabel: Record<RangoPreset, string> = {
    hoy: "Hoy", ayer: "Ayer", semana: "Última Semana", mes: "Último Mes", rango: "Rango personalizado",
  };

  const periodoTexto = useMemo(() => {
    const base = presetLabel[preset] ?? "Personalizado";
    if (from && to) {
      const f = from.toLocaleDateString("es-PE");
      const t = to.toLocaleDateString("es-PE");
      return preset === "rango" ? `Del ${f} al ${t}` : `${base} (${f} – ${t})`;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, from, to]);

  const construirReporteHtml = (): string | null => {
    if (filtered.length === 0) { toast.error("No hay tickets para el reporte"); return null; }

    // Desglose por método de pago
    const porMetodo = new Map<string, { count: number; total: number }>();
    for (const v of filtered) {
      const k = v.metodo_pago || "—";
      const cur = porMetodo.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(v.total || 0);
      porMetodo.set(k, cur);
    }
    const desglose = Array.from(porMetodo.entries())
      .sort((a, b) => b[1].total - a[1].total);

    const fmt = (n: number) => `S/${n.toFixed(2)}`;
    const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length));
    const padR = (s: string, n: number) => (s.length >= n ? s.slice(-n) : " ".repeat(n - s.length) + s);

    const filas = filtered.map((v) => {
      const fecha = new Date(v.creada_en);
      const dd = String(fecha.getDate()).padStart(2, "0");
      const mm = String(fecha.getMonth() + 1).padStart(2, "0");
      const hh = String(fecha.getHours()).padStart(2, "0");
      const mi = String(fecha.getMinutes()).padStart(2, "0");
      const ticket = `#${String(v.correlativo).replace(/^0+/, "") || "0"}`;
      const pago = (METODO_LABEL[v.metodo_pago] ?? v.metodo_pago ?? "");
      return (
        pad(ticket, 7) +
        pad(`${dd}/${mm}`, 6) +
        pad(`${hh}:${mi}`, 6) +
        pad(pago, 11) +
        padR(fmt(Number(v.total)), 10)
      );
    }).join("\n");

    const totalDesglose = desglose.map(([m, d]) => {
      const label = `${METODO_LABEL[m] ?? m} (${d.count})`;
      const pct = totalPeriodo > 0 ? (d.total / totalPeriodo) * 100 : 0;
      const right = `${fmt(d.total)} ${pct.toFixed(1)}%`;
      return pad(label, 21) + padR(right, 19);
    }).join("\n");

    const sep = "-".repeat(40);
    const titulo = `REPORTE DE TICKETS`;
    const subt = periodoTexto;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte de tickets</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: 'Courier New', monospace; font-size: 13px; font-weight: 700; color:#000; margin:0; -webkit-font-smoothing: none; }
  .center { text-align:center; }
  .logo { font-size: 19px; font-weight: 900; letter-spacing: 1px; }
  img.marca { max-height: 110px; max-width: 100%; filter: contrast(1.6) grayscale(1); margin-bottom: 4px; }
  pre { font-family: inherit; font-size: 13px; font-weight: 700; line-height: 1.3; margin: 0; white-space: pre; }
  .total-box { border:2px solid #000; padding:5px 0; margin:7px 0; text-align:center; font-weight:900; font-size:16px; }
  .small { font-size: 12px; font-weight: 700; }
  h3 { font-size: 14px; font-weight: 900; margin: 7px 0 3px; }
</style></head><body>
  <div class="center">
    ${biz.ticketLogo ? `<img class="marca" src="${esc(biz.ticketLogo)}" alt="logo" />` : ""}
    <div class="logo">${esc(biz.nombre.toUpperCase())}</div>
    ${biz.ruc ? `<div class="small">R.U.C. ${esc(biz.ruc)}</div>` : ""}
    ${biz.direccion ? `<div class="small">${esc(biz.direccion)}</div>` : ""}
    <div style="font-size:15px;font-weight:900;margin-top:3px">${titulo}</div>
    <div class="small">${subt}</div>
  </div>
  <pre>${sep}</pre>
  <pre>${pad("TICKET", 7)}${pad("FECHA", 6)}${pad("HORA", 6)}${pad("PAGO", 11)}${padR("TOTAL", 10)}</pre>
  <pre>${sep}</pre>
  <pre>${filas}</pre>
  <pre>${sep}</pre>
  <div class="total-box">TOTAL: ${fmt(totalPeriodo)} (${filtered.length} tickets)</div>
  <pre>${sep}</pre>
  <h3>DETALLE POR MÉTODO DE PAGO:</h3>
  <pre>${totalDesglose}</pre>
  <pre>${sep}</pre>
  <div class="center small">Generado: ${new Date().toLocaleString("es-PE")}</div>
  <script>window.onload=()=>{setTimeout(()=>{window.print();setTimeout(()=>window.close(),400);},300);}</script>
</body></html>`;
    return html;
  };

  const previsualizarReporte = () => {
    const html = construirReporteHtml();
    if (html) setPreviewHtml(html);
  };

  const imprimirReporte = () => {
    const html = construirReporteHtml();
    if (!html) return;
    printViaIframe(html);
    toast.success(`Reporte 80mm listo (${filtered.length} tickets)`);
  };

  const limpiarFiltros = () => {
    setQ(""); setTipo("TODOS"); setMetodo("TODOS"); setEstado("TODOS");
    setPreset("hoy"); setDesde(""); setHasta("");
  };

  const reimprimir = async (v: any) => {
    try {
      setReprintingId(v.id);
      const { data: det, error } = await supabase
        .from("venta_items")
        .select("cantidad,precio_unitario,descuento,total,producto_id,productos(id,nombre,precio_venta,afecto_igv),ventas(descuento, subtotal, igv)")
        .eq("venta_id", v.id);
      if (error) throw error;
      const items = (det ?? []).map((d: any) => ({
        producto: {
          id: d.productos?.id ?? d.producto_id,
          nombre: d.productos?.nombre ?? "Producto",
          precio_venta: Number(d.precio_unitario),
          igv: d.productos?.afecto_igv ?? true,
        } as any,
        cantidad: Number(d.cantidad),
        descuento: Number(d.descuento ?? 0),
      }));
      // Intentar obtener el detalle del descuento desde la auditoría
      const { data: aud } = await supabase
        .from("descuentos_auditoria")
        .select("motivo, monto_descuento")
        .eq("venta_id", v.id)
        .maybeSingle();

      const descuentoTotal = Number(aud?.monto_descuento || v.descuento || 0);
      const total = Number(v.total);
      const igv = Number(v.igv || 0);
      const subtotal = Number(v.subtotal || (total - igv));
      const bruto = Number(subtotal + igv + descuentoTotal);
      const tipo = (v.tipo_comprobante === "FACTURA" || v.tipo_comprobante === "BOLETA")
        ? v.tipo_comprobante
        : "TICKET";

      setReprintData({
        tipo: tipo as TicketData["tipo"],
        serie: v.serie,
        correlativo: v.correlativo,
        fecha: new Date(v.creada_en),
        items: items as any,
        subtotal,
        igv,
        total,
        descuento: descuentoTotal,
        bruto: bruto,
        descuentoMotivo: aud?.motivo || undefined,
        metodoPago: v.metodo_pago,
        cliente: v.clientes?.razon_social ?? v.clientes?.nombres ?? undefined,
        cajero: cajerosMap[v.cajero_id || ""] || undefined,
      });
      setReprintOpen(true);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo cargar el ticket");
    } finally {
      setReprintingId(null);
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Ticket className="h-7 w-7 text-primary" /> Tickets
          </h1>
          <p className="text-muted-foreground">Historial de ventas y reimpresión</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 font-semibold" onClick={imprimirUltimo}><Printer className="h-4 w-4 mr-2" /> IMP-Ticket</Button>
          <Button variant="outline" className="h-10 font-semibold" onClick={previsualizarReporte}><Printer className="h-4 w-4 mr-2 text-purple-600" /> Reporte 80mm</Button>
          <Button variant="outline" className="h-10 font-semibold" onClick={exportarExcel}><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Excel</Button>
          <Button variant="outline" className="h-10 font-semibold" onClick={exportarPDF}><FileText className="h-4 w-4 mr-2 text-rose-600" /> PDF</Button>
          <Button variant="outline" className="h-10 font-semibold" onClick={cargar}><RefreshCw className="h-4 w-4 mr-2 text-blue-600" /> Actualizar</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {([
              ["hoy", "Hoy"],
              ["ayer", "Ayer"],
              ["semana", "Semana"],
              ["mes", "Mes"],
              ["rango", "Rango"],
            ] as [RangoPreset, string][]).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setPreset(k)}
                className={`h-9 px-4 rounded-full text-sm font-bold border transition ${
                  preset === k
                    ? "bg-emerald-500 text-white border-emerald-500 shadow"
                    : "bg-card hover:bg-muted border-border"
                }`}
              >
                {k === "hoy" && <Calendar className="h-3.5 w-3.5 inline mr-1.5" />}
                {l}
              </button>
            ))}
          </div>
          {preset === "rango" && (
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Desde:</label>
                <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-9 w-40" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Hasta:</label>
                <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-9 w-40" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 px-3 rounded-md border bg-card text-sm font-semibold">
              <option value="TODOS">Todos los tipos</option>
              {tiposUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="h-9 px-3 rounded-md border bg-card text-sm font-semibold">
              <option value="TODOS">Todos los métodos</option>
              {metodosUnicos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="h-9 px-3 rounded-md border bg-card text-sm font-semibold">
              <option value="TODOS">Todos los estados</option>
              <option value="PAGADA">PAGADA</option>
              <option value="ANULADA">ANULADA</option>
              <option value="PENDIENTE">PENDIENTE</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-muted-foreground">Ordenar por fecha:</span>
            <button
              type="button"
              onClick={() => setSortDir("desc")}
              className={`h-9 px-3 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition ${
                sortDir === "desc"
                  ? "bg-blue-500 text-white border-blue-500 shadow"
                  : "bg-card hover:bg-muted border-border"
              }`}
            >
              <ArrowDownAZ className="h-3.5 w-3.5" /> Más reciente primero
            </button>
            <button
              type="button"
              onClick={() => setSortDir("asc")}
              className={`h-9 px-3 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 transition ${
                sortDir === "asc"
                  ? "bg-blue-500 text-white border-blue-500 shadow"
                  : "bg-card hover:bg-muted border-border"
              }`}
            >
              <ArrowUpAZ className="h-3.5 w-3.5" /> Más antiguo primero
            </button>
          </div>
        </Card>

        <Card className="p-4 flex flex-col items-center justify-center bg-emerald-50/60 border-emerald-200">
          <div className="text-xs font-semibold text-muted-foreground">Total Período</div>
          <div className="text-3xl font-extrabold text-emerald-600">{formatPEN(totalPeriodo)}</div>
          <div className="text-xs text-muted-foreground">{filtered.length} ticket{filtered.length !== 1 && "s"}</div>
        </Card>
      </div>

      {/* Buscador */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número de ticket, tipo o cliente…"
            className="pl-9 h-11 rounded-full bg-card"
          />
        </div>
        <Button variant="ghost" onClick={limpiarFiltros} className="h-11 font-semibold">Limpiar</Button>
      </div>

      {/* Detalle por Método de Pago */}
      {desgloseMetodos.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-sm">Detalle por Método de Pago</div>
            <div className="text-xs text-muted-foreground font-semibold">
              {filtered.length} ticket{filtered.length !== 1 && "s"} · {formatPEN(totalPeriodo)}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {desgloseMetodos.map((d) => {
              const meta = metodoMeta(d.metodo);
              const Icon = meta.icon;
              return (
                <div
                  key={d.metodo}
                  className={`rounded-xl border p-3 flex items-center gap-3 ${meta.bg}`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
                    <Icon className={`h-5 w-5 ${meta.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-bold text-sm truncate">{METODO_LABEL[d.metodo] ?? d.metodo}</div>
                      <div className="font-extrabold text-orange-600 whitespace-nowrap">{formatPEN(d.total)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="text-xs text-muted-foreground">
                        {d.count} transacci{d.count === 1 ? "ón" : "ones"}
                      </div>
                      <div className="text-xs font-semibold text-muted-foreground">
                        {d.pct.toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${meta.barColor}`}
                        style={{ width: `${Math.min(100, d.pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr><th className="px-4 py-2">Comprobante</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Método</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Descuento</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Acciones</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Cargando…</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin ventas</td></tr>
            : filtered.map((v) => (
              <tr key={v.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{v.serie}-{String(v.correlativo).padStart(8, "0")}</td>
                <td className="px-4 py-2"><Badge variant="secondary">{v.tipo_comprobante}</Badge></td>
                <td className="px-4 py-2">{v.clientes?.razon_social ?? v.clientes?.nombres ?? "—"}</td>
                <td className="px-4 py-2"><MetodoPill metodo={v.metodo_pago} /></td>
                <td className="px-4 py-2"><Badge variant={v.estado === "PAGADA" ? "default" : v.estado === "ANULADA" ? "destructive" : "secondary"}>{v.estado}</Badge></td>
                <td className="px-4 py-2 text-right tabular-nums text-rose-600 font-medium">{Number(v.descuento || 0) > 0 ? `-${formatPEN(v.descuento)}` : "—"}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums">{formatPEN(v.total)}</td>
                <td className="px-4 py-2 text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reimprimir(v)}
                    disabled={reprintingId === v.id}
                    className="h-8 font-semibold"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                    {reprintingId === v.id ? "Cargando…" : "Vista previa"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <TicketModal open={reprintOpen} onOpenChange={setReprintOpen} ticket={reprintData} />

      <AlertDialog open={!!confirmVenta} onOpenChange={(o) => !o && setConfirmVenta(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              ¿Reimprimir ticket?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-1">
                <div>
                  Estás a punto de reimprimir el comprobante{" "}
                  <span className="font-mono font-bold text-foreground">
                    {confirmVenta?.serie}-{String(confirmVenta?.correlativo ?? "").padStart(8, "0")}
                  </span>{" "}
                  por{" "}
                  <span className="font-bold text-foreground">
                    {confirmVenta ? formatPEN(confirmVenta.total) : ""}
                  </span>.
                </div>
                <div className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                  ⚠ Esta reimpresión es solo para reemplazar un ticket extraviado. No genera una nueva venta.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 font-semibold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => {
                const v = confirmVenta;
                setConfirmVenta(null);
                if (v) reimprimir(v);
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> Sí, reimprimir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!previewHtml} onOpenChange={(o) => !o && setPreviewHtml(null)}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Vista previa — Reporte 80mm</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 px-4 py-3 max-h-[65vh] overflow-auto flex justify-center">
            <iframe
              title="Vista previa reporte"
              srcDoc={(previewHtml ?? "").replace(/<script[\s\S]*?<\/script>/g, "")}
              style={{ width: "302px", minHeight: "60vh", background: "white", border: "1px solid hsl(var(--border))" }}
            />
          </div>
          <DialogFooter className="px-4 pb-4 gap-2">
            <Button variant="outline" onClick={() => setPreviewHtml(null)}>Cerrar</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                const html = previewHtml;
                setPreviewHtml(null);
                if (html) {
                  printViaIframe(html);
                  toast.success(`Reporte 80mm enviado a imprimir (${filtered.length} tickets)`);
                }
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
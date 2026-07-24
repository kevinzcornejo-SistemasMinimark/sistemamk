import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Rocket, Store, Palette, FileText, Printer, Bell, Shield, Database,
  Save, RefreshCcw, Plus, CheckCircle2, Upload, Eye, Key, Download,
  Trash2, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { applyTheme } from "@/hooks/useAppConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fileToThumbDataUrl } from "@/lib/imageResize";


export const Route = createFileRoute("/_app/configuracion")({
  head: () => ({ meta: [{ title: "Configuración — POS Minimarket" }] }),
  component: ConfigPage,
});

// ============== Tipos / paletas ==============
const TEMAS = [
  { id: "naranja",   nombre: "Naranja (Pizzería)",   colors: ["#F97316","#1F2937","#FBBF24"] },
  { id: "azul",      nombre: "Azul (Profesional)",   colors: ["#3B82F6","#1E293B","#38BDF8"] },
  { id: "verde",     nombre: "Verde (Natural)",      colors: ["#10B981","#059669","#34D399"] },
  { id: "purpura",   nombre: "Púrpura (Elegante)",   colors: ["#8B5CF6","#6D28D9","#A78BFA"] },
  { id: "rojo",      nombre: "Rojo (Restaurante)",   colors: ["#EF4444","#B91C1C","#F97316"] },
  { id: "teal",      nombre: "Teal (Moderno)",       colors: ["#14B8A6","#0F766E","#5EEAD4"] },
];
const SIDEBARS = [
  { id: "oscuro",     nombre: "Oscuro (Predeterminado)", bg: "#1F2937" },
  { id: "negro",      nombre: "Negro Profundo",          bg: "#0B0B0B" },
  { id: "azul_marino",nombre: "Azul Marino",             bg: "#1E3A8A" },
  { id: "gris",       nombre: "Gris Pizarra",            bg: "#475569" },
];

// Orden: hijos antes que padres para respetar FKs
const TABLAS_BORRAR = [
  { id: "venta_items", nombre: "Detalle de ventas", desc: "Líneas de cada venta" },
  { id: "venta_pagos", nombre: "Pagos de ventas", desc: "Pagos recibidos por venta" },
  { id: "ventas", nombre: "Ventas", desc: "Ventas y comprobantes" },
  { id: "movimientos_caja", nombre: "Movimientos de caja", desc: "Entradas/salidas" },
  { id: "cajas", nombre: "Sesiones de caja", desc: "Aperturas/cierres" },
  { id: "gastos", nombre: "Gastos", desc: "Registro de gastos" },
  { id: "clientes", nombre: "Clientes", desc: "Base de clientes" },
  { id: "kardex", nombre: "Kardex", desc: "Movimientos de stock" },
  { id: "compra_items", nombre: "Detalle de compras", desc: "Líneas de compra" },
  { id: "compras", nombre: "Compras", desc: "Compras a proveedores" },
  { id: "lotes", nombre: "Lotes", desc: "Lotes y vencimientos" },
  { id: "combo_items", nombre: "Detalle de combos", desc: "Componentes de combos" },
  { id: "combos", nombre: "Combos", desc: "Catálogo de combos" },
  { id: "productos", nombre: "Productos", desc: "Catálogo de productos" },
  { id: "categorias", nombre: "Categorías", desc: "Categorías de productos" },
  { id: "proveedores", nombre: "Proveedores", desc: "Base de proveedores" },
];

// Duraciones predefinidas para licencia
const DURACIONES_LIC = [
  { id: "1d",   nombre: "1 día (prueba)",  dias: 1 },
  { id: "3d",   nombre: "3 días (prueba)", dias: 3 },
  { id: "30d",  nombre: "30 días",  dias: 30 },
  { id: "60d",  nombre: "60 días",  dias: 60 },
  { id: "90d",  nombre: "90 días",  dias: 90 },
  { id: "1a",   nombre: "1 año",    dias: 365 },
  { id: "5a",   nombre: "5 años",   dias: 365 * 5 },
  { id: "10a",  nombre: "10 años",  dias: 365 * 10 },
];

function ConfigPage() {
  const { user, isDemo, isAdmin } = useAuth();
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tiendas, setTiendas] = useState<any[]>([]);
  const [terminales, setTerminales] = useState<any[]>([]);
  const [countCategorias, setCountCategorias] = useState(0);
  const [countProductos, setCountProductos] = useState(0);
  const [licencia, setLicencia] = useState<any>(null);

  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});

  // Licencia
  const [licDuracion, setLicDuracion] = useState<string>("30d");
  const [licAniosCustom, setLicAniosCustom] = useState<number>(2);
  const [licSaving, setLicSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);



  const cargar = async () => {
    setLoading(true);
    if (isDemo || !user) {
      setCfg({
        negocio_nombre: "Mi Minimarket",
        negocio_direccion: "Av. Principal 123, Lima",
        negocio_telefono: "01-234-5678",
        negocio_ruc: "20123456789",
        tema_color: "naranja",
        sidebar_color: "oscuro",
        ticket_promocion: "¡Ofertas especiales todos los días!",
        ticket_pie: "¡Gracias por su preferencia!",
        impresora_habilitada: "true",
        impresora_nombre: "Ticketera-80mm",
        impresora_copias: "2",
        impresora_auto: "true",
        notif_stock_bajo: "true",
        notif_licencia: "true",
        notif_resumen: "false",
        serie_boleta: "B001",
        serie_factura: "F001",
        moneda: "PEN",
        igv_porcentaje: "18",
      });
      setTiendas([{ id: "demo", nombre: "Tienda Principal", activa: true }]);
      setTerminales([{ id: "demo", nombre: "Caja 1", activa: true }]);
      setCountCategorias(5);
      setCountProductos(14);
      setLicencia({ tipo: "demo", estado: "activa", fecha_vencimiento: "2027-06-23" });
      setLoading(false);
      return;
    }
    const [
      { data: c },
      { data: t },
      { data: term },
      { count: cats },
      { count: prods },
      { data: lic },
    ] = await Promise.all([
      supabase.from("configuracion").select("clave,valor"),
      supabase.from("tiendas").select("*").order("creada_en"),
      supabase.from("terminales").select("*").order("creada_en"),
      supabase.from("categorias").select("*", { count: "exact", head: true }),
      supabase.from("productos").select("*", { count: "exact", head: true }),
      supabase.from("licencia").select("*").limit(1).maybeSingle(),
    ]);
    const m: Record<string, string> = {};
    (c ?? []).forEach((r: any) => { m[r.clave] = r.valor ?? ""; });
    setCfg(m);
    setTiendas(t ?? []);
    setTerminales(term ?? []);
    setCountCategorias(cats ?? 0);
    setCountProductos(prods ?? 0);
    setLicencia(lic);
    setLoading(false);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [user?.id, isDemo]);

  const set = (k: string, v: string) => {
    setCfg((p) => {
      const next = { ...p, [k]: v };
      if (k === "tema_color" || k === "tema_color_custom" || k === "sidebar_color") {
        try { applyTheme(next); } catch {}
      }
      return next;
    });
  };

  const guardar = async () => {
    if (!isAdmin) return toast.error("Solo administradores");
    if (isDemo) return toast.info("Modo demo: cambios no persistidos");
    setSaving(true);
    const rows = Object.entries(cfg).map(([clave, valor]) => ({ clave, valor }));
    const { error } = await supabase.from("configuracion").upsert(rows, { onConflict: "clave" });
    setSaving(false);
    if (error) return toast.error(error.message);
    window.dispatchEvent(new Event("config-updated"));
    toast.success("Configuración guardada");
  };

  // ===== Impresión de prueba (ticket 80mm) =====
  const buildTicketHTML = () => {
    const nombre = cfg.negocio_nombre || "Mi Negocio";
    const dir = cfg.negocio_direccion || "";
    const tel = cfg.negocio_telefono || "";
    const ruc = cfg.negocio_ruc || "";
    const promo = cfg.ticket_promocion || "";
    const pie = cfg.ticket_pie || "¡Gracias por su compra!";
    const logo = cfg.ticket_logo_url || cfg.negocio_logo_url || "";
    const fecha = new Date().toLocaleString("es-PE");
    return `
      <div style="text-align:center">
        ${logo ? `<img src="${logo}" style="max-width:120px;max-height:80px;margin:0 auto 4px" />` : ""}
        <div style="font-weight:700;font-size:14px">${nombre.toUpperCase()}</div>
        ${ruc ? `<div>R.U.C. ${ruc}</div>` : ""}
        ${dir ? `<div>${dir}</div>` : ""}
        ${tel ? `<div>Tel: ${tel}</div>` : ""}
        <hr style="border:0;border-top:1px dashed #000;margin:6px 0" />
        <div style="font-weight:700">TICKET DE PRUEBA</div>
        <div>T001-000001</div>
      </div>
      <hr style="border:0;border-top:1px dashed #000;margin:6px 0" />
      <div>FECHA : ${fecha}</div>
      <div>TIPO  : LOCAL</div>
      <div>CLIENTE : Cliente Genérico</div>
      <div>PAGO  : EFECTIVO</div>
      <hr style="border:0;border-top:1px dashed #000;margin:6px 0" />
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="border-bottom:1px dashed #000">
          <th style="text-align:left">CANT</th>
          <th style="text-align:left">DESCRIPCION</th>
          <th style="text-align:right">SUBT</th>
        </tr></thead>
        <tbody>
          <tr><td>1</td><td>Producto demo A</td><td style="text-align:right">10.00</td></tr>
          <tr><td>2</td><td>Producto demo B</td><td style="text-align:right">14.00</td></tr>
        </tbody>
      </table>
      <hr style="border:0;border-top:1px dashed #000;margin:6px 0" />
      <div style="display:flex;justify-content:space-between"><span>SUBTOTAL</span><span>S/ 20.34</span></div>
      <div style="display:flex;justify-content:space-between"><span>IGV (18%)</span><span>S/ 3.66</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px"><span>TOTAL</span><span>S/ 24.00</span></div>
      <div style="display:flex;justify-content:space-between"><span>RECIBIDO</span><span>S/ 30.00</span></div>
      <div style="display:flex;justify-content:space-between"><span>VUELTO</span><span>S/ 6.00</span></div>
      <hr style="border:0;border-top:1px dashed #000;margin:6px 0" />
      ${promo ? `<div style="text-align:center">${promo}</div>` : ""}
      <div style="text-align:center;margin-top:4px">${pie}</div>
    `;
  };

  const imprimirPrueba = () => {
    const copias = Math.max(1, parseInt(cfg.impresora_copias || "1", 10) || 1);
    const html = buildTicketHTML();
    const full = `
      <html><head><title>Prueba de impresión</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: 'Courier New', monospace; font-size: 12px; padding: 8px; margin: 0; color: #000; width: 80mm; }
      </style></head>
      <body>${Array.from({ length: copias }).map((_,i)=>`<div>${html}</div>${i<copias-1?'<div style="page-break-after:always"></div>':''}`).join("")}</body></html>
    `;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open(); doc.write(full); doc.close();
    const fire = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {}
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1500);
    };
    if (iframe.contentWindow?.document.readyState === "complete") setTimeout(fire, 200);
    else iframe.onload = () => setTimeout(fire, 200);
  };


  // ===== Setup checks =====
  const checks = [
    { ok: tiendas.some((x) => x.activa),    n: tiendas.filter((x:any)=>x.activa).length, label: "Tienda",        desc: "Al menos una tienda activa es necesaria",  icon: Store },
    { ok: terminales.some((x) => x.activa), n: terminales.filter((x:any)=>x.activa).length, label: "Terminal / Caja", desc: "Terminal de venta asociado a una tienda", icon: Database },
    { ok: countCategorias > 0,              n: countCategorias, label: "Categorías",     desc: "Organiza tus productos en categorías",      icon: FileText },
    { ok: countProductos > 0,               n: countProductos,  label: "Productos",      desc: "Productos disponibles para la venta",        icon: Database },
  ];
  const completados = checks.filter((c) => c.ok).length;
  const progreso = (completados / checks.length) * 100;

  // ===== Acciones rápidas tiendas/terminales =====
  const crearTienda = async () => {
    if (isDemo) return toast.info("Modo demo");
    const nombre = window.prompt("Nombre de la tienda:");
    if (!nombre) return;
    const { error } = await supabase.from("tiendas").insert({ nombre });
    if (error) return toast.error(error.message);
    toast.success("Tienda creada"); cargar();
  };
  const crearTerminal = async () => {
    if (isDemo) return toast.info("Modo demo");
    const nombre = window.prompt("Nombre del terminal/caja:");
    if (!nombre) return;
    const tienda_id = tiendas[0]?.id ?? null;
    const { error } = await supabase.from("terminales").insert({ nombre, tienda_id });
    if (error) return toast.error(error.message);
    toast.success("Terminal creado"); cargar();
  };

  // ===== Subida de logo =====
  const subirLogo = async (file: File, key: "negocio_logo_url" | "ticket_logo_url") => {
    if (isDemo) return toast.info("Modo demo");
    const path = `${key}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    set(key, data.publicUrl);
    toast.success("Logo subido. No olvides guardar cambios.");
  };

  // ===== Seguridad =====
  const actualizarPass = async () => {
    if (pass1.length < 4) return toast.error("Mínimo 4 caracteres");
    if (pass1 !== pass2)  return toast.error("Las contraseñas no coinciden");
    const enc = new TextEncoder().encode(pass1);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    set("seg_pass_devoluciones_hash", hex);
    if (!isDemo) {
      await supabase.from("configuracion").upsert({ clave: "seg_pass_devoluciones_hash", valor: hex });
    }
    setPass1(""); setPass2("");
    toast.success("Contraseña actualizada");
  };

  // ===== Backup =====
  const generarBackup = async () => {
    if (isDemo) return toast.info("Modo demo");
    toast.message("Generando backup…");
    const tablas = ["configuracion","tiendas","terminales","licencia","categorias","productos","proveedores","clientes","combos","lotes","kardex","compras","compra_items","ventas","venta_items","venta_pagos","cajas","movimientos_caja","gastos"];
    const dump: Record<string, any[]> = {};
    for (const t of tablas) {
      const { data } = await supabase.from(t).select("*");
      dump[t] = data ?? [];
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `backup-minimarket-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Backup descargado");
  };

  const borrarSeleccionados = async () => {
    if (isDemo) return toast.info("Modo demo");
    const elegidas = Object.entries(sel).filter(([,v])=>v).map(([k])=>k);
    if (!elegidas.length) return;
    if (!window.confirm(`¿Borrar TODOS los registros de: ${elegidas.join(", ")}? Esta acción es irreversible.`)) return;
    for (const t of elegidas) {
      await supabase.from(t).delete().not("id", "is", null);
    }
    setSel({});
    toast.success("Datos eliminados"); cargar();
  };
  const totalSel = Object.values(sel).filter(Boolean).length;

  const [resetting, setResetting] = useState(false);
  const resetearSistema = async () => {
    if (isDemo) return toast.info("Modo demo");
    if (!isAdmin) return toast.error("Solo administradores");
    if (!window.confirm("¿Resetear el sistema?\n\nSe eliminarán: ventas, pagos, items de venta, compras, items de compra, gastos, cajas, movimientos de caja, kardex, lotes y clientes.\n\nSE MANTIENEN: usuarios, empresa, licencia, sucursales, categorías, productos, combos y proveedores.\n\nEsta acción es IRREVERSIBLE.")) return;
    if (!window.confirm("Confirmación final: ¿Proceder con el reseteo?")) return;
    setResetting(true);
    const orden = ["kardex","movimientos_caja","venta_pagos","venta_items","ventas","compra_items","compras","gastos","cajas","lotes","clientes"];
    const avisos: string[] = [];
    for (const t of orden) {
      const { error } = await supabase.from(t).delete().not("id", "is", null);
      if (error) avisos.push(`${t}: ${error.message}`);
    }
    setResetting(false);
    if (avisos.length) toast.error("Reset con avisos: " + avisos.slice(0,3).join(" | "));
    else toast.success("Sistema reseteado. Catálogo y usuarios intactos.");
    cargar();
  };

  const [seeding, setSeeding] = useState(false);
  const insertarEjemplos = async () => {
    if (isDemo) return toast.info("Modo demo");
    if (!isAdmin) return toast.error("Solo administradores");
    if (!window.confirm("¿Insertar datos de EJEMPLO en las tablas principales?\n\nSe crearán filas de muestra prefijadas con 'EJEMPLO —' para que puedas identificarlas.")) return;
    setSeeding(true);
    const ok: string[] = [];
    const fail: string[] = [];
    const tryIns = async (tabla: string, rows: any[]): Promise<any[] | null> => {
      const { data, error } = await supabase.from(tabla).insert(rows).select();
      if (error) { fail.push(`${tabla}: ${error.message}`); return null; }
      ok.push(tabla); return data ?? [];
    };

    const cat = await tryIns("categorias", [{ nombre: "EJEMPLO — Abarrotes", descripcion: "Categoría de ejemplo" }]);
    const catId = cat?.[0]?.id ?? null;

    const prov = await tryIns("proveedores", [{ razon_social: "EJEMPLO — Distribuidora Demo S.A.C.", ruc: "20999888777", telefono: "999888777", email: "demo@proveedor.com", direccion: "Av. Demo 123" }]);
    const provId = prov?.[0]?.id ?? null;

    await tryIns("clientes", [{ razon_social: "EJEMPLO — Cliente Demo", tipo_doc: "DNI", numero_doc: "12345678", telefono: "987654321", email: "cliente@demo.com" }]);

    const prod = await tryIns("productos", [{
      nombre: "EJEMPLO — Arroz Costeño 1kg", codigo_barras: "7750100000001",
      precio_venta: 5.5, precio_compra: 4.2, stock: 20, stock_minimo: 5,
      unidad: "UND", igv: true, afecto_igv: true, categoria_id: catId, activo: true,
    }]);
    const prodId = prod?.[0]?.id ?? null;

    if (prodId) {
      await tryIns("lotes", [{
        producto_id: prodId, numero_lote: "L-EJEMPLO-001",
        cantidad_actual: 20, cantidad_inicial: 20,
        fecha_vencimiento: new Date(Date.now() + 180*86400000).toISOString().slice(0,10),
      }]);
    }

    await tryIns("combos", [{ nombre: "EJEMPLO — Combo Desayuno", precio: 12.9, activo: true }]);

    await tryIns("gastos", [{
      concepto: "EJEMPLO — Servicio de luz", descripcion: "Gasto de ejemplo",
      monto: 120, fecha: new Date().toISOString().slice(0,10), categoria: "SERVICIOS",
    }]);

    const caja = await tryIns("cajas", [{
      numero: 9999, estado: "CERRADA", monto_apertura: 100, monto_cierre: 100,
      abierta_en: new Date().toISOString(), cerrada_en: new Date().toISOString(), turno: "DIA",
    }]);
    const cajaId = caja?.[0]?.id ?? null;
    if (cajaId) {
      await tryIns("movimientos_caja", [{
        caja_id: cajaId, tipo: "INGRESO", monto: 50,
        concepto: "EJEMPLO — Ingreso de caja", fecha: new Date().toISOString(),
      }]);
    }

    if (provId && prodId) {
      const compra = await tryIns("compras", [{
        proveedor_id: provId, serie: "F001", correlativo: "EJEMPLO-1",
        tipo_documento: "FACTURA", subtotal: 42, igv: 7.56, total: 49.56,
        fecha: new Date().toISOString(), estado: "REGISTRADA",
      }]);
      const compraId = compra?.[0]?.id ?? null;
      if (compraId) {
        await tryIns("compra_items", [{ compra_id: compraId, producto_id: prodId, cantidad: 10, precio_unitario: 4.2, subtotal: 42 }]);
      }
    }

    if (prodId) {
      const venta = await tryIns("ventas", [{
        serie: "B001", tipo_documento: "BOLETA",
        subtotal: 4.66, igv: 0.84, total: 5.5,
        monto_recibido: 10, vuelto: 4.5, metodo_pago: "EFECTIVO",
        estado: "PAGADA", fecha: new Date().toISOString(),
      }]);
      const ventaId = venta?.[0]?.id ?? null;
      if (ventaId) {
        await tryIns("venta_items", [{ venta_id: ventaId, producto_id: prodId, cantidad: 1, precio_unitario: 5.5, descuento: 0, subtotal: 5.5 }]);
        await tryIns("venta_pagos", [{ venta_id: ventaId, metodo: "EFECTIVO", monto: 5.5 }]);
      }
    }

    setSeeding(false);
    if (ok.length) toast.success(`Ejemplos insertados en: ${ok.join(", ")}`);
    if (fail.length) toast.error("Con avisos: " + fail.slice(0,2).join(" | "));
    cargar();
  };

  const diasRestantes = useMemo(() => {
    if (!licencia?.fecha_vencimiento) return 0;
    const d = (new Date(licencia.fecha_vencimiento).getTime() - Date.now()) / 86400000;
    return Math.max(0, Math.floor(d));
  }, [licencia]);

  // ===== Licencia: activar/renovar =====
  const diasSeleccionados = (): number => {
    if (licDuracion === "custom") return Math.max(1, Math.floor(licAniosCustom * 365));
    return DURACIONES_LIC.find(d => d.id === licDuracion)?.dias ?? 30;
  };
  const nombreTipo = (): string => {
    if (licDuracion === "custom") return `${licAniosCustom} año${licAniosCustom !== 1 ? "s" : ""}`;
    return DURACIONES_LIC.find(d => d.id === licDuracion)?.nombre ?? "30 días";
  };
  const activarLicencia = async (modo: "nueva" | "renovar") => {
    if (!isAdmin) return toast.error("Solo administradores");
    if (isDemo) return toast.info("Modo demo: cambios no persistidos");
    const dias = diasSeleccionados();
    const inicio = modo === "renovar" && licencia?.fecha_vencimiento && new Date(licencia.fecha_vencimiento) > new Date()
      ? new Date(licencia.fecha_vencimiento)
      : new Date();
    const vence = new Date(inicio);
    vence.setDate(vence.getDate() + dias);
    const clave = `LIC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payload: any = {
      tipo: licDuracion === "custom" ? `${licAniosCustom}a` : licDuracion,
      estado: "activa",
      duracion_dias: dias,
      fecha_inicio: (modo === "renovar" ? new Date() : inicio).toISOString().slice(0, 10),
      fecha_vencimiento: vence.toISOString().slice(0, 10),
      clave,
      notas: `${modo === "renovar" ? "Renovación" : "Activación"} — ${nombreTipo()}`,
    };
    setLicSaving(true);
    let error: any = null;
    if (licencia?.id) {
      const res = await supabase.from("licencia").update(payload).eq("id", licencia.id);
      error = res.error;
    } else {
      const res = await supabase.from("licencia").insert(payload);
      error = res.error;
    }
    setLicSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Licencia ${modo === "renovar" ? "renovada" : "activada"} por ${nombreTipo()}`);
    cargar();
  };
  const suspenderLicencia = async () => {
    if (!isAdmin || isDemo || !licencia?.id) return;
    if (!window.confirm("¿Suspender la licencia?")) return;
    const { error } = await supabase.from("licencia").update({ estado: "suspendida" }).eq("id", licencia.id);
    if (error) return toast.error(error.message);
    toast.success("Licencia suspendida"); cargar();
  };


  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">Ajustes del sistema</p>
        </div>
        <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-md" onClick={guardar} disabled={saving || loading}>
          <Save className="h-4 w-4 mr-2" /> Guardar Cambios
        </Button>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto p-1 bg-muted/60">
          <TabsTrigger value="setup"><Rocket className="h-4 w-4 mr-1" /> Setup Inicial</TabsTrigger>
          <TabsTrigger value="negocio"><Store className="h-4 w-4 mr-1" /> Negocio</TabsTrigger>
          <TabsTrigger value="apariencia"><Palette className="h-4 w-4 mr-1" /> Apariencia</TabsTrigger>
          <TabsTrigger value="ticket"><FileText className="h-4 w-4 mr-1" /> Ticket</TabsTrigger>
          <TabsTrigger value="impresora"><Printer className="h-4 w-4 mr-1" /> Impresora</TabsTrigger>
          <TabsTrigger value="notif"><Bell className="h-4 w-4 mr-1" /> Notificaciones</TabsTrigger>
          <TabsTrigger value="seguridad"><Shield className="h-4 w-4 mr-1" /> Seguridad</TabsTrigger>
          <TabsTrigger value="sistema"><Database className="h-4 w-4 mr-1" /> Sistema</TabsTrigger>
        </TabsList>

        {/* ============ SETUP ============ */}
        <TabsContent value="setup" className="mt-4">
          <Card className="p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><Rocket className="h-5 w-5 text-accent"/> Asistente de Configuración Inicial</h2>
                <p className="text-sm text-muted-foreground">Verifica y configura los elementos esenciales para operar el POS</p>
              </div>
              <Button variant="outline" onClick={cargar}><RefreshCcw className="h-4 w-4 mr-1"/> Actualizar</Button>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progreso de configuración</span>
                <span className="font-medium">{completados} de {checks.length} completados</span>
              </div>
              <Progress value={progreso} className="h-2" />
            </div>

            {completados === checks.length && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-semibold text-green-700">¡Sistema listo para operar!</div>
                  <div className="text-sm text-green-700/80">Todos los elementos esenciales están configurados.</div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {checks.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {c.label}
                          {c.ok ? <Badge variant="secondary" className="bg-green-500/15 text-green-700 border-green-500/30">✓ {c.n} registrado{c.n!==1?"s":""}</Badge>
                                : <Badge variant="destructive">Pendiente</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.desc}</div>
                      </div>
                    </div>
                    <div>
                      {c.label === "Tienda"        && <Button variant="outline" onClick={crearTienda}><Plus className="h-4 w-4 mr-1"/> Crear Tienda</Button>}
                      {c.label === "Terminal / Caja" && <Button variant="outline" onClick={crearTerminal}><Plus className="h-4 w-4 mr-1"/> Crear Terminal</Button>}
                      {c.label === "Categorías"    && <Button variant="outline" asChild><a href="/categorias"><Plus className="h-4 w-4 mr-1"/> Crear Categoría</a></Button>}
                      {c.label === "Productos"     && <Button variant="outline" asChild><a href="/productos"><Plus className="h-4 w-4 mr-1"/> Crear Producto</a></Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ============ NEGOCIO ============ */}
        <TabsContent value="negocio" className="mt-4 grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Store className="h-5 w-5 text-accent"/> Información del Negocio</h2>
            <p className="text-sm text-muted-foreground -mt-2">Datos que aparecerán en los tickets</p>

            <div>
              <Label>Logo del Sistema</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-16 w-16 rounded-md bg-muted overflow-hidden grid place-items-center">
                  {cfg.negocio_logo_url ? <img src={cfg.negocio_logo_url} alt="logo" className="h-full w-full object-cover"/> : <Upload className="h-6 w-6 text-muted-foreground"/>}
                </div>
                <label className="flex-1">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0], "negocio_logo_url")}/>
                  <div className="cursor-pointer rounded-md bg-accent text-accent-foreground px-4 py-2 text-center text-sm font-medium hover:opacity-90"><Upload className="h-4 w-4 inline mr-1"/> Subir logo del sistema</div>
                  <p className="text-xs text-muted-foreground mt-1">Este logo aparecerá en el sidebar y login</p>
                </label>
              </div>
            </div>

            <div><Label>Nombre del negocio</Label><Input value={cfg.negocio_nombre ?? ""} onChange={(e)=>set("negocio_nombre", e.target.value)} /></div>
            <div><Label>Dirección</Label><Input value={cfg.negocio_direccion ?? ""} onChange={(e)=>set("negocio_direccion", e.target.value)} /></div>
            <div><Label>Teléfono</Label><Input value={cfg.negocio_telefono ?? ""} onChange={(e)=>set("negocio_telefono", e.target.value)} /></div>
            <div><Label>RUC</Label><Input value={cfg.negocio_ruc ?? ""} onChange={(e)=>set("negocio_ruc", e.target.value)} /></div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Key className="h-5 w-5 text-accent"/> Licencia del Sistema</h2>
            <p className="text-sm text-muted-foreground -mt-2">Estado y renovación de tu licencia</p>

            {(() => {
              const estado = (licencia?.estado ?? "sin licencia").toString();
              const vencida = diasRestantes <= 0 && licencia?.fecha_vencimiento;
              const porVencer = diasRestantes > 0 && diasRestantes <= 7;
              const cls = vencida ? "border-red-500/40 bg-red-500/10"
                        : porVencer ? "border-yellow-500/40 bg-yellow-500/10"
                        : "border-green-500/30 bg-green-500/10";
              const badgeCls = vencida ? "bg-red-600" : porVencer ? "bg-yellow-600" : "bg-green-600";
              return (
                <div className={`rounded-lg border p-4 space-y-2 text-sm ${cls}`}>
                  <div className="flex justify-between"><span className="font-medium">Estado:</span><Badge className={badgeCls}>{estado.toUpperCase()}</Badge></div>
                  <div className="flex justify-between"><span className="font-medium">Tipo:</span><span>{licencia?.tipo ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Inicio:</span><span>{licencia?.fecha_inicio ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Vence:</span><span>{licencia?.fecha_vencimiento ?? "—"}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Días restantes:</span><span className={`font-bold ${vencida?"text-red-700":porVencer?"text-yellow-700":"text-green-700"}`}>{diasRestantes} días</span></div>
                  {licencia?.clave && <div className="flex justify-between gap-2"><span className="font-medium">Clave:</span><span className="font-mono text-xs truncate max-w-[60%]">{licencia.clave}</span></div>}
                </div>
              );
            })()}

            <div>
              <Label>Duración de la licencia</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {DURACIONES_LIC.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setLicDuracion(d.id)}
                    className={`rounded-md border p-2 text-sm font-medium transition ${licDuracion===d.id ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-muted-foreground/40"}`}
                  >
                    {d.nombre}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setLicDuracion("custom")}
                  className={`rounded-md border p-2 text-sm font-medium transition ${licDuracion==="custom" ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-muted-foreground/40"}`}
                >
                  Personalizado
                </button>
              </div>
              {licDuracion === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-xs">Años:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={licAniosCustom}
                    onChange={(e) => setLicAniosCustom(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">= {licAniosCustom * 365} días</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={() => activarLicencia("renovar")}
                disabled={licSaving || !isAdmin}
              >
                <RefreshCcw className="h-4 w-4 mr-1"/> Renovar ({nombreTipo()})
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => activarLicencia("nueva")}
                disabled={licSaving || !isAdmin}
              >
                <Key className="h-4 w-4 mr-1"/> Activar nueva
              </Button>
            </div>
            {licencia?.id && licencia?.estado === "activa" && (
              <Button variant="ghost" className="w-full text-red-600 hover:text-red-700" onClick={suspenderLicencia}>
                Suspender licencia
              </Button>
            )}
            {!isAdmin && <p className="text-xs text-muted-foreground">Solo el administrador puede modificar la licencia.</p>}
          </Card>
        </TabsContent>

        {/* ============ APARIENCIA ============ */}
        <TabsContent value="apariencia" className="mt-4 space-y-4">
          <Card className="p-6 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2"><Palette className="h-5 w-5 text-accent"/> Tema de Colores Principal</h2>
            <p className="text-sm text-muted-foreground -mt-1">Personaliza el color principal de botones y acentos</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMAS.map((t) => {
                const active = cfg.tema_color === t.id;
                return (
                  <button key={t.id} onClick={()=>set("tema_color", t.id)} className={`relative text-left rounded-xl border-2 p-4 transition ${active?"border-accent ring-2 ring-accent/30":"border-border hover:border-muted-foreground/40"}`}>
                    {active && <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-accent"/>}
                    <div className="flex gap-2 mb-2">{t.colors.map((c,i)=>(<span key={i} className="h-7 w-7 rounded-full border" style={{background:c}}/>))}</div>
                    <div className="text-sm font-medium">{t.nombre}</div>
                  </button>
                );
              })}
              <button onClick={()=>set("tema_color","personalizado")} className={`relative text-left rounded-xl border-2 p-4 transition ${cfg.tema_color==="personalizado"?"border-accent ring-2 ring-accent/30":"border-border hover:border-muted-foreground/40"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <input type="color" value={cfg.tema_color_custom ?? "#F97316"} onChange={(e)=>set("tema_color_custom", e.target.value)} className="h-8 w-8 rounded-full border cursor-pointer"/>
                  <span className="text-2xl">🎨</span>
                </div>
                <div className="text-sm font-medium">Personalizado</div>
              </button>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2"><Palette className="h-5 w-5 text-accent"/> Color del Menú Lateral (Sidebar)</h2>
            <p className="text-sm text-muted-foreground -mt-1">Cambia el color de fondo del menú lateral izquierdo</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SIDEBARS.map((s) => {
                const active = cfg.sidebar_color === s.id;
                return (
                  <button key={s.id} onClick={()=>set("sidebar_color", s.id)} className={`relative rounded-xl border-2 p-3 transition ${active?"border-accent ring-2 ring-accent/30":"border-border hover:border-muted-foreground/40"}`}>
                    {active && <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-accent z-10"/>}
                    <div className="h-20 rounded-md flex flex-col gap-1 p-2" style={{background:s.bg}}>
                      <span className="h-2 w-12 bg-white/60 rounded"/>
                      <span className="h-2 w-16 bg-white/40 rounded"/>
                    </div>
                    <div className="text-xs font-medium mt-2 text-center">{s.nombre}</div>
                  </button>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* ============ TICKET ============ */}
        <TabsContent value="ticket" className="mt-4 grid md:grid-cols-2 gap-4">
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-accent"/> Diseño del Ticket</h2>
            <p className="text-sm text-muted-foreground -mt-2">Personaliza la apariencia de tus tickets de venta</p>

            <div>
              <Label>Logo de la empresa</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-16 w-16 rounded-md bg-muted overflow-hidden grid place-items-center">
                  {cfg.ticket_logo_url ? <img src={cfg.ticket_logo_url} alt="" className="h-full w-full object-cover"/> : <Upload className="h-6 w-6 text-muted-foreground"/>}
                </div>
                <label className="flex-1">
                  <input type="file" accept="image/*" className="hidden" onChange={(e)=> e.target.files?.[0] && subirLogo(e.target.files[0], "ticket_logo_url")}/>
                  <div className="cursor-pointer rounded-md border bg-muted/50 px-4 py-2 text-center text-sm hover:bg-muted"><Upload className="h-4 w-4 inline mr-1"/> Subir logo</div>
                  <p className="text-xs text-muted-foreground mt-1">Recomendado: 200x200px, PNG o JPG</p>
                </label>
              </div>
            </div>

            <div>
              <Label>Texto de promoción</Label>
              <Textarea value={cfg.ticket_promocion ?? ""} onChange={(e)=>set("ticket_promocion", e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Deja vacío para no mostrar promoción</p>
            </div>
            <div>
              <Label>Texto de pie de ticket</Label>
              <Input value={cfg.ticket_pie ?? ""} onChange={(e)=>set("ticket_pie", e.target.value)} />
            </div>

            <Button variant="outline" className="w-full" onClick={()=>setPreviewOpen(true)}><Eye className="h-4 w-4 mr-1"/> Ver Vista Previa</Button>
          </Card>

          <Card className="p-6 bg-blue-50/60 border-blue-200/60">
            <h3 className="font-bold text-blue-900 flex items-center gap-2"><FileText className="h-5 w-5"/> Información del Ticket</h3>
            <p className="text-sm font-medium text-blue-900 mt-3">El ticket incluirá:</p>
            <ul className="list-disc list-inside text-sm text-blue-800/90 mt-2 space-y-1">
              <li>Logo de tu empresa (opcional)</li>
              <li>Nombre del negocio</li>
              <li>Dirección y teléfono</li>
              <li>RUC (si está configurado)</li>
              <li>Número de ticket y fecha/hora</li>
              <li>Tipo de pedido (Local/Llevar/Delivery)</li>
              <li>Detalle de productos</li>
              <li>Subtotal, descuentos y total</li>
              <li>Método de pago y vuelto</li>
              <li>Mensaje promocional</li>
              <li>Mensaje de agradecimiento</li>
            </ul>
            <div className="mt-4 text-sm bg-blue-100/60 rounded p-2 text-blue-900">💡 Tip: Un buen diseño de ticket puede aumentar la fidelización de clientes</div>
          </Card>
        </TabsContent>

        {/* ============ IMPRESORA ============ */}
        <TabsContent value="impresora" className="mt-4">
          <Card className="p-6 space-y-4 max-w-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2"><Printer className="h-5 w-5 text-accent"/> Configuración de Impresora</h2>
            <p className="text-sm text-muted-foreground -mt-2">Configura tu ticketera térmica de 80mm</p>

            <div className="flex items-center justify-between rounded-lg bg-muted/60 p-4">
              <div>
                <div className="font-medium">Impresión habilitada</div>
                <div className="text-xs text-muted-foreground">Activar/desactivar impresión de tickets</div>
              </div>
              <Switch checked={cfg.impresora_habilitada==="true"} onCheckedChange={(v)=>set("impresora_habilitada", String(v))}/>
            </div>

            <div><Label>Nombre de la impresora</Label><Input value={cfg.impresora_nombre ?? ""} onChange={(e)=>set("impresora_nombre", e.target.value)}/></div>
            <div>
              <Label>Número de copias</Label>
              <Input type="number" min={1} max={5} value={cfg.impresora_copias ?? "2"} onChange={(e)=>set("impresora_copias", e.target.value)} className="w-24"/>
              <p className="text-xs text-muted-foreground mt-1">Por defecto: 2 copias (una para cliente, una para cocina)</p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/60 p-4">
              <div>
                <div className="font-medium">Impresión automática</div>
                <div className="text-xs text-muted-foreground">Imprimir ticket al confirmar venta</div>
              </div>
              <Switch checked={cfg.impresora_auto==="true"} onCheckedChange={(v)=>set("impresora_auto", String(v))}/>
            </div>

            <Button variant="outline" className="w-full" onClick={imprimirPrueba} disabled={cfg.impresora_habilitada!=="true"}><Printer className="h-4 w-4 mr-1"/> Imprimir Prueba</Button>
          </Card>
        </TabsContent>

        {/* ============ NOTIFICACIONES ============ */}
        <TabsContent value="notif" className="mt-4">
          <Card className="p-6 space-y-3 max-w-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="h-5 w-5 text-accent"/> Notificaciones</h2>
            <p className="text-sm text-muted-foreground -mt-2">Configura las alertas del sistema</p>

            {[
              {k:"notif_stock_bajo",  t:"Alerta de stock bajo",     d:"Notificar cuando un producto tenga stock bajo"},
              {k:"notif_licencia",    t:"Vencimiento de licencia",  d:"Alertar 7, 3 y 1 día antes del vencimiento"},
              {k:"notif_resumen",     t:"Resumen de ventas",        d:"Notificación al cerrar caja"},
            ].map((n)=>(
              <div key={n.k} className="flex items-center justify-between rounded-lg bg-muted/60 p-4">
                <div><div className="font-medium">{n.t}</div><div className="text-xs text-muted-foreground">{n.d}</div></div>
                <Switch checked={cfg[n.k]==="true"} onCheckedChange={(v)=>set(n.k, String(v))}/>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* ============ SEGURIDAD ============ */}
        <TabsContent value="seguridad" className="mt-4">
          <Card className="p-6 space-y-4 max-w-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-accent"/> Contraseña de Devoluciones</h2>
            <p className="text-sm text-muted-foreground -mt-2">Esta contraseña se requerirá para autorizar devoluciones de productos</p>
            <div><Label>Nueva contraseña</Label><Input type="password" value={pass1} onChange={(e)=>setPass1(e.target.value)}/></div>
            <div><Label>Confirmar contraseña</Label><Input type="password" value={pass2} onChange={(e)=>setPass2(e.target.value)}/></div>
            <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={actualizarPass} disabled={!pass1 || !pass2}>Actualizar Contraseña</Button>
            {cfg.seg_pass_devoluciones_hash && <div className="text-xs text-muted-foreground">✓ Contraseña configurada</div>}
          </Card>
        </TabsContent>

        {/* ============ SISTEMA ============ */}
        <TabsContent value="sistema" className="mt-4 space-y-4">
          <Card className="p-4 border-yellow-300/60 bg-yellow-50/50">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5"/>
              <div>
                <div className="font-bold text-yellow-800">Zona de Administración del Sistema</div>
                <p className="text-sm text-yellow-800/90">Las acciones de esta sección son críticas. Se recomienda realizar un backup antes de resetear o borrar datos. Todas las acciones quedan registradas en el log de auditoría.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2"><Download className="h-5 w-5 text-green-600"/> Backup del Sistema</h2>
            <p className="text-sm text-muted-foreground -mt-2">Genera una copia de seguridad completa en formato JSON</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Exporta todas las tablas del sistema</li>
              <li>Mantiene la estructura de columnas y datos</li>
              <li>Incluye fecha y hora de generación</li>
              <li>El archivo se descarga automáticamente</li>
            </ul>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={generarBackup}><Download className="h-4 w-4 mr-1"/> Generar Backup</Button>
          </Card>

          <Card className="p-6 border-orange-200/70 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-orange-700"><RefreshCcw className="h-5 w-5"/> Resetear Sistema</h2>
            <p className="text-sm text-muted-foreground -mt-2">Reinicia el sistema como si empezara desde cero (sin eliminar tablas)</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Limpia todas las tablas transaccionales (ventas, pagos, caja, stock, clientes)</li>
              <li><strong>NO elimina:</strong> Usuarios, Empresa, Licencia, Sucursales</li>
              <li>Mantiene intacta la estructura de todas las tablas</li>
              <li>Mantiene el catálogo de productos, categorías, combos e insumos</li>
            </ul>
            <div className="rounded-md border border-yellow-300/60 bg-yellow-50/60 p-3 text-sm text-yellow-800">⚠ Se eliminarán: Órdenes, Pagos, Sesiones de caja, Movimientos de stock, Clientes</div>
            <Button variant="outline" className="border-orange-300 text-orange-700" disabled={resetting} onClick={resetearSistema}>
              <RefreshCcw className={`h-4 w-4 mr-1 ${resetting?"animate-spin":""}`}/> {resetting?"Reseteando…":"Resetear Sistema"}
            </Button>
          </Card>

          <Card className="p-6 border-emerald-200/70 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-700"><Database className="h-5 w-5"/> Insertar Ejemplos (Guía)</h2>
            <p className="text-sm text-muted-foreground -mt-2">Crea una fila de muestra en cada tabla principal para que puedas ver cómo se llenan los datos del sistema.</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Categorías, Productos, Proveedores, Clientes, Combos, Lotes</li>
              <li>Compras + items, Ventas + items + pagos</li>
              <li>Cajas + movimientos, Gastos</li>
              <li>Todas las filas se prefijan con <strong>"EJEMPLO —"</strong> para identificarlas</li>
            </ul>
            <div className="rounded-md border border-emerald-300/60 bg-emerald-50/60 p-3 text-sm text-emerald-800">Recomendado tras un reset o al empezar. Puedes borrarlos luego desde "Borrar Datos Específicos".</div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={seeding} onClick={insertarEjemplos}>
              <Database className={`h-4 w-4 mr-1 ${seeding?"animate-pulse":""}`}/> {seeding?"Insertando…":"Insertar Ejemplos"}
            </Button>
          </Card>


          <Card className="p-6 border-red-200 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2 text-red-700"><Trash2 className="h-5 w-5"/> Borrar Datos Específicos</h2>
            <p className="text-sm text-muted-foreground -mt-2">Selecciona qué tablas deseas limpiar para liberar espacio</p>
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"><strong>ADVERTENCIA:</strong> La eliminación de datos es IRREVERSIBLE. Las tablas de Usuario, Empresa y Licencia nunca serán afectadas.</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={()=>{ const all:Record<string,boolean>={}; TABLAS_BORRAR.forEach(t=>all[t.id]=true); setSel(all); }}>Seleccionar todo</Button>
              <Button variant="outline" size="sm" onClick={()=>setSel({})}>Deseleccionar todo</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-auto pr-2">
              {TABLAS_BORRAR.map((t)=>(
                <label key={t.id} className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={!!sel[t.id]} onCheckedChange={(v)=>setSel({...sel, [t.id]: !!v})}/>
                  <div><div className="text-sm font-medium">{t.nombre}</div><div className="text-xs text-muted-foreground">{t.desc}</div></div>
                </label>
              ))}
            </div>
            <Button variant="destructive" disabled={!totalSel} onClick={borrarSeleccionados}><Trash2 className="h-4 w-4 mr-1"/> Borrar Datos Seleccionados ({totalSel})</Button>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b">
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4"/> Vista previa del ticket</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-muted/40 max-h-[70vh] overflow-auto">
            <div
              className="bg-white text-black mx-auto p-3 rounded shadow-sm font-mono text-[12px] leading-tight"
              style={{ width: 300 }}
              dangerouslySetInnerHTML={{ __html: buildTicketHTML() }}
            />
          </div>
          <div className="p-3 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={()=>setPreviewOpen(false)}>Cerrar</Button>
            <Button onClick={()=>{ imprimirPrueba(); setPreviewOpen(false); }} className="bg-accent text-accent-foreground"><Printer className="h-4 w-4 mr-1"/> Imprimir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


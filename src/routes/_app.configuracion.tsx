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
];

// Duraciones predefinidas para licencia
const DURACIONES_LIC = [
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

  const set = (k: string, v: string) => setCfg((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!isAdmin) return toast.error("Solo administradores");
    if (isDemo) return toast.info("Modo demo: cambios no persistidos");
    setSaving(true);
    const rows = Object.entries(cfg).map(([clave, valor]) => ({ clave, valor }));
    const { error } = await supabase.from("configuracion").upsert(rows, { onConflict: "clave" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Configuración guardada");
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
      await supabase.from(t).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
    setSel({});
    toast.success("Datos eliminados"); cargar();
  };
  const totalSel = Object.values(sel).filter(Boolean).length;

  const diasRestantes = useMemo(() => {
    if (!licencia?.fecha_vencimiento) return 0;
    const d = (new Date(licencia.fecha_vencimiento).getTime() - Date.now()) / 86400000;
    return Math.max(0, Math.floor(d));
  }, [licencia]);

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
            <p className="text-sm text-muted-foreground -mt-2">Estado de tu licencia actual</p>
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="font-medium">Estado:</span><Badge className="bg-green-600">{licencia?.estado?.toUpperCase() ?? "—"}</Badge></div>
              <div className="flex justify-between"><span className="font-medium">Tipo:</span><span>{licencia?.tipo ?? "—"}</span></div>
              <div className="flex justify-between"><span className="font-medium">Vence:</span><span>{licencia?.fecha_vencimiento ?? "—"}</span></div>
              <div className="flex justify-between"><span className="font-medium">Días restantes:</span><span className="text-green-700 font-bold">{diasRestantes} días</span></div>
            </div>
            <Button variant="outline" className="w-full" onClick={()=>toast.info("Contacta a tu proveedor para renovar")}><RefreshCcw className="h-4 w-4 mr-1"/> Renovar Licencia</Button>
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

            <Button variant="outline" className="w-full" onClick={()=>window.print()}><Eye className="h-4 w-4 mr-1"/> Ver Vista Previa</Button>
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

            <Button variant="outline" className="w-full" onClick={()=>window.print()}><Printer className="h-4 w-4 mr-1"/> Imprimir Prueba</Button>
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
            <Button variant="outline" className="border-orange-300 text-orange-700" onClick={()=>{
              setSel({ ventas:true, venta_pagos:true, venta_items:true, cajas:true, movimientos_caja:true, kardex:true, clientes:true, gastos:true });
              toast.info("Selección preparada. Confirma abajo en 'Borrar Datos Seleccionados'.");
            }}><RefreshCcw className="h-4 w-4 mr-1"/> Resetear Sistema</Button>
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
    </div>
  );
}

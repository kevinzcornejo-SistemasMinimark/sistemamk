import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ScanLine,
  Pause,
  Maximize2,
  Minimize2,
  Smartphone,
  Zap,
  ShoppingBag,
  Package,
  CupSoda,
  Milk,
  Croissant,
  SprayCan,
  Cookie,
  Beef,
  Apple,
  ShoppingBasket,
  Layers,
  Monitor,
  Mic,
  MicOff,
  Keyboard,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const ICONS: Record<string, LucideIcon> = {
  ShoppingBasket,
  CupSoda,
  Milk,
  Croissant,
  SprayCan,
  Cookie,
  Beef,
  Apple,
  Layers,
};
import type { MockProducto } from "@/data/mockData";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { Cart } from "@/components/pos/Cart";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { TicketModal, type TicketData } from "@/components/pos/TicketModal";
import { DescuentoModal } from "@/components/pos/DescuentoModal";
import { ServicioModal, type ServicioResultado, type ServicioTipo } from "@/components/pos/ServicioModal";
import { useServiciosPOS } from "@/hooks/useServiciosPOS";
import { usePOSCart } from "@/hooks/usePOSCart";
import { toast } from "sonner";
import { formatPEN } from "@/lib/format";
import { useCatalog } from "@/hooks/useCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { registrarVenta } from "@/lib/ventas";
import { broadcastCart, broadcastPagado, openCustomerDisplay } from "@/lib/customerDisplay";
import { supabase } from "@/integrations/supabase/client";
import { useLicencia } from "@/hooks/useLicencia";
import { LicenciaBloqueo } from "@/components/LicenciaBloqueo";
import { useCajaAbierta } from "@/hooks/useCajaAbierta";
import { Link } from "@tanstack/react-router";
import { Wallet, LockOpen } from "lucide-react";

const COMBOS_CAT_ID = "__combos__";
type ComboRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_combo: number;
  activo: boolean;
  temporal: boolean;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  combo_items: Array<{ producto_id: string; cantidad: number; descuenta_stock: boolean }>;
};

export const Route = createFileRoute("/_app/pos")({
  head: () => ({ meta: [{ title: "Punto de Venta — POS Minimarket" }] }),
  component: POSPage,
});

function POSPage() {
  const cart = usePOSCart();
  const { productos: allProductos, categorias, refresh } = useCatalog();
  const { user, profile, isDemo, role, isAdminMaestro } = useAuth();
  const { bloqueada, estado } = useLicencia();
  const { caja: cajaAbierta, loading: cajaLoading } = useCajaAbierta(user?.id);
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [descuentoOpen, setDescuentoOpen] = useState(false);
  const [servicioTipo, setServicioTipo] = useState<ServicioTipo | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [kiosko, setKiosko] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);

  // Cargar combos activos
  useEffect(() => {
    if (isDemo || !user) { setCombos([]); return; }
    (async () => {
      const { data } = await supabase
        .from("combos")
        .select("id,nombre,descripcion,precio_combo,activo,temporal,fecha_inicio,fecha_fin,combo_items(producto_id,cantidad,descuenta_stock)")
        .eq("activo", true)
        .order("nombre");
      const hoy = new Intl.DateTimeFormat("es-PE", { 
        timeZone: "America/Lima", 
        year: "numeric", 
        month: "2-digit", 
        day: "2-digit" 
      }).format(new Date()).split("/").reverse().join("-");
      const vigentes = (data ?? []).filter((c: any) =>
        !c.temporal ||
        ((!c.fecha_inicio || c.fecha_inicio <= hoy) && (!c.fecha_fin || c.fecha_fin >= hoy)),
      );
      setCombos(vigentes as any);
    })();
  }, [isDemo, user?.id]);

  // Pantalla cliente: emitir cambios del carrito
  useEffect(() => {
    broadcastCart(cart.items, cart.totales);
  }, [cart.items, cart.totales]);

  // Modo Kiosco: oculta sidebar/header y entra a pantalla completa
  useEffect(() => {
    const html = document.documentElement;
    if (kiosko) {
      html.classList.add("kiosk");
      html.requestFullscreen?.().catch(() => {});
    } else {
      html.classList.remove("kiosk");
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
    const onFs = () => {
      if (!document.fullscreenElement) {
        html.classList.remove("kiosk");
        setKiosko(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      html.classList.remove("kiosk");
    };
  }, [kiosko]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (cart.items.length > 0) setCheckoutOpen(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        toggleVoz();
      } else if (e.key === "F4") {
        e.preventDefault();
        openCustomerDisplay();
      } else if (e.key === "F8") {
        e.preventDefault();
        cart.clear();
      } else if (e.key === "F9") {
        e.preventDefault();
        setAyudaOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items.length]);

  // Reconocimiento de voz (Web Speech API)
  const toggleVoz = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Tu navegador no soporta reconocimiento de voz"); return; }
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
      recRef.current = null;
      setEscuchando(false);
      return;
    }
    const rec = new SR();
    rec.lang = "es-PE"; rec.continuous = true; rec.interimResults = false;
    rec.onresult = (e: any) => {
      const txt = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
      const num = txt.match(/(\d+)/)?.[1];
      if (txt.includes("cobrar") || txt.includes("pagar")) {
        if (cart.items.length) setCheckoutOpen(true);
      } else if (txt.includes("limpiar") || txt.includes("borrar todo")) {
        cart.clear(); toast.info("Carrito limpiado");
      } else if (num) {
        const p = allProductos.find((x) => x.codigo_barras === num);
        if (p) { cart.add(p); toast.success(`+ ${p.nombre}`); }
        else toast.error(`Sin producto con código ${num}`);
      } else {
        const p = allProductos.find((x) => x.nombre.toLowerCase().includes(txt));
        if (p) { cart.add(p); toast.success(`+ ${p.nombre}`); }
      }
    };
    rec.onerror = () => { setEscuchando(false); recRef.current = null; };
    rec.onend = () => { setEscuchando(false); recRef.current = null; };
    rec.start();
    recRef.current = rec;
    setEscuchando(true);
    toast.success("Escuchando… di 'cobrar', 'limpiar' o el nombre del producto");
  };

  // Lector código de barras: input rápido seguido de Enter
  useEffect(() => {
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      if (isInput) return;
      const now = Date.now();
      if (now - last > 100) buf = "";
      last = now;
      if (e.key === "Enter" && buf.length >= 6) {
        const p = allProductos.find((x) => x.codigo_barras === buf);
        if (p) {
          cart.add(p);
          toast.success(`+ ${p.nombre}`);
        } else {
          toast.error("Código no encontrado");
        }
        buf = "";
      } else if (e.key.length === 1) {
        buf += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, allProductos]);

  const productos = useMemo(() => {
    let list = allProductos;
    if (cat) list = list.filter((p) => p.categoria_id === cat);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.codigo_barras.includes(q),
      );
    }
    return list;
  }, [query, cat, allProductos]);

  // Combos visibles según filtro
  const combosVisibles = useMemo(() => {
    if (cat && cat !== COMBOS_CAT_ID) return [];
    const q = query.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      (c.descripcion ?? "").toLowerCase().includes(q),
    );
  }, [combos, cat, query]);

  const mostrarSoloCombos = cat === COMBOS_CAT_ID;

  const handlePick = (p: MockProducto) => {
    if ((p.stock ?? 0) <= 0) {
      toast.error(`${p.nombre} sin stock`);
      return;
    }
    const ok = cart.add(p);
    if (!ok) toast.warning(`Stock máximo alcanzado: ${p.stock} ${p.unidad}`);
  };

  // ---- Accesos rápidos: servicios (recarga, pago de servicio, bolsa) ----
  const { servicios } = useServiciosPOS(!!user && !isDemo);

  // Los servicios NO controlan stock ni dependen de la BD: si el producto de
  // servicio no existe, se usa una línea virtual (no afecta compras ni kardex).
  const abrirServicio = (tipo: ServicioTipo) => {
    setServicioTipo(tipo);
  };

  const agregarServicio = (r: ServicioResultado) => {
    const base = servicios[r.tipo];
    const linea: MockProducto = {
      ...base,
      id: `${base.id}::${Date.now()}`,
      servicio_id: base.id.startsWith("virtual-") ? undefined : base.id,
      nombre: r.descripcion,
      precio_venta: r.total,
      es_servicio: true,
      stock: 999999,
    };
    cart.add(linea, 1);
    toast.success(`${r.descripcion} · ${formatPEN(r.total)}`);
  };

  const agregarBolsa = () => {
    const base = servicios.bolsa;
    const linea: MockProducto = {
      ...base,
      servicio_id: base.id.startsWith("virtual-") ? undefined : base.id,
      es_servicio: true,
      stock: 999999,
    };
    cart.add(linea, 1);
    toast.success(`Bolsa plástica agregada · ${formatPEN(base.precio_venta)}`);
  };

  // Agregar combo: expande componentes y aplica descuentos para igualar precio_combo
  const handlePickCombo = (c: ComboRow) => {
    const lineas = (c.combo_items ?? []).map((it) => {
      const prod = allProductos.find((p) => p.id === it.producto_id);
      return { it, prod };
    });
    if (lineas.some((l) => !l.prod)) { toast.error("Combo con productos no encontrados"); return; }
    // Validar stock
    for (const l of lineas) {
      const enCarrito = cart.items.find((x) => x.producto.id === l.prod!.id)?.cantidad ?? 0;
      if ((l.prod!.stock ?? 0) - enCarrito < l.it.cantidad) {
        toast.error(`Sin stock suficiente de ${l.prod!.nombre}`);
        return;
      }
    }
    const totalIndiv = lineas.reduce((s, l) => s + l.prod!.precio_venta * l.it.cantidad, 0);
    const descTotal = Math.max(0, totalIndiv - Number(c.precio_combo));
    let descRest = descTotal;
    lineas.forEach((l, idx) => {
      cart.add(l.prod!, l.it.cantidad);
      const lineaTotal = l.prod!.precio_venta * l.it.cantidad;
      const desc = idx === lineas.length - 1
        ? descRest
        : Math.round((descTotal * (lineaTotal / totalIndiv)) * 100) / 100;
      descRest = Math.round((descRest - desc) * 100) / 100;
      const existing = cart.items.find((x) => x.producto.id === l.prod!.id)?.descuento ?? 0;
      cart.setDescuento(l.prod!.id, existing + desc);
    });
    toast.success(`Combo agregado: ${c.nombre}`);
  };

  const confirmarVenta = async (data: {
    tipo_comprobante: string;
    serie: string;
    documento_cliente?: string;
    nombre_cliente?: string;
    pagos: { metodo: string; monto: number }[];
  }) => {
    if (procesandoVenta) return;
    if (bloqueada && !isDemo) {
      toast.error("Licencia vencida — Llamar al creador Kevin MG Solutions");
      setCheckoutOpen(false);
      return;
    }

    setProcesandoVenta(true);
    try {
      const metodoPrincipal = data.pagos.length > 1
        ? "MIXTO"
        : (data.pagos[0]?.metodo ?? "EFECTIVO");
      
      const baseTicket = {
        tipo: data.tipo_comprobante as TicketData["tipo"],
        serie: data.serie,
        fecha: new Date(new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date())),
        items: cart.items,
        subtotal: cart.totales.subtotal,
        igv: cart.totales.igv,
        total: cart.totales.total,
        metodoPago: metodoPrincipal.replace("_", " "),
        pagos: data.pagos,
        documentoCliente: data.documento_cliente,
        cliente: data.nombre_cliente,
        descuento: cart.totales.descuentoAplicado,
        bruto: cart.totales.bruto,
        cajero:
          profile?.nombre ??
          (user?.user_metadata?.["nombre"] as string | undefined) ??
          (user?.user_metadata?.["full_name"] as string | undefined) ??
          (user?.email?.split("@")[0]) ??
          (isDemo ? "Demo" : undefined),
        caja: cajaAbierta ? `#${cajaAbierta.numero}` : undefined,
        turno: cajaAbierta?.turno ?? undefined,
        descuentoMotivo: cart.descuentoInfo
          ? cart.descuentoInfo.motivo === "Otro"
            ? cart.descuentoInfo.motivoTexto
            : cart.descuentoInfo.motivo
          : undefined,
      };

      if (isDemo || !user) {
        setCheckoutOpen(false);
        const correlativo = Math.floor(Math.random() * 9000 + 1000);
        setTicket({ ...baseTicket, correlativo });
        cart.clear();
        toast.success(
          `Venta demo · ${data.tipo_comprobante} ${data.serie}-${correlativo}`,
        );
        return;
      }

      const venta = await registrarVenta({
        items: cart.items,
        tipo_comprobante: data.tipo_comprobante as "BOLETA" | "FACTURA" | "TICKET",
        serie: data.serie,
        pagos: data.pagos,
        subtotal: cart.totales.bruto - cart.totales.descuentoAplicado - cart.totales.igv,
        igv: cart.totales.igv,
        total: cart.totales.total,
        cajero_id: user.id,
        caja_id: cajaAbierta?.id ?? null,
        descuento_info: cart.descuentoInfo
          ? {
              ...cart.descuentoInfo,
              montoDescuento: cart.totales.descuentoAplicado,
            }
          : cart.totales.descuentoAplicado > 0
            ? {
                tipo: "monto",
                valor: cart.totales.descuentoAplicado,
                aplicadoA: "total",
                montoDescuento: cart.totales.descuentoAplicado,
                motivo: "Descuento en Venta",
              }
            : null,
        observaciones: data.nombre_cliente
          ? `Cliente: ${data.nombre_cliente}${data.documento_cliente ? ` · Doc: ${data.documento_cliente}` : ""}`
          : undefined,
      });

      setCheckoutOpen(false);
      const ticketData = { ...baseTicket, correlativo: venta.correlativo };
      setTicket(ticketData);

      const recibido = data.pagos.reduce((s, p) => s + (p.monto || 0), 0);
      broadcastPagado(cart.totales.total, Math.max(0, recibido - cart.totales.total));
      cart.clear();
      refresh();
      toast.success(
        `Venta registrada · ${venta.serie}-${String(venta.correlativo).padStart(8, "0")}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar la venta");
    } finally {
      setProcesandoVenta(false);
    }
  };

  if (bloqueada && !isDemo) {
    return <LicenciaBloqueo estado={estado} />;
  }

  if (!isDemo && user && !cajaLoading && !cajaAbierta) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
        <div className="max-w-md w-full rounded-2xl border-2 border-amber-500/60 bg-amber-50 p-8 shadow-xl text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
            <Wallet className="w-9 h-9 text-amber-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-amber-800 mb-2">Caja cerrada</h2>
          <p className="text-amber-900/80 mb-5">
            No puedes vender hasta abrir una caja. Registra tu fondo inicial para comenzar el turno.
          </p>
          <Link to="/caja">
            <Button size="lg" className="w-full">
              <LockOpen className="w-4 h-4 mr-2" /> Ir a Caja y abrir turno
            </Button>
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className={cn("flex flex-col lg:flex-row h-full overflow-hidden bg-muted/30 relative", procesandoVenta && "pointer-events-none opacity-80")}>
      {procesandoVenta && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/20 backdrop-blur-[2px]">
          <div className="bg-card p-6 rounded-2xl shadow-2xl border-2 border-primary animate-pulse flex flex-col items-center gap-4">
            <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xl font-black text-primary uppercase tracking-widest">Procesando Venta...</p>
          </div>
        </div>
      )}
      {/* Columna productos */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-5 pt-4 pb-3 space-y-3">
          {/* Toolbar superior */}
          <div className="flex items-center justify-between gap-3 relative">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="h-11 px-4 border-2 border-amber-400/70 text-amber-600 hover:bg-amber-50 hover:text-amber-700 font-bold rounded-xl"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pausar Ticket
              </Button>
            </div>

            {kiosko && (
              <div className="hidden lg:flex flex-col items-center absolute left-1/2 -translate-x-1/2 bg-primary/10 px-6 py-1.5 rounded-xl border-2 border-primary/40 shadow-sm animate-in fade-in zoom-in duration-300 z-10">
                <span className="text-[9px] uppercase tracking-[0.2em] text-primary font-black leading-none mb-0.5 opacity-90">Vendedor Activo</span>
                <span className="text-lg font-black text-foreground leading-none tracking-tighter uppercase">
                  {(user?.user_metadata?.["nombre"] as string | undefined) || user?.email?.split('@')[0] || (isDemo ? "Modo demo" : "")}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-11 px-3 border-2 font-bold rounded-xl"
                onClick={() => setAyudaOpen(true)}
                title="Atajos (F9)"
              >
                <Keyboard className="h-4 w-4 mr-2" />Atajos
              </Button>
              <Button
                variant="outline"
                className={`h-11 px-3 border-2 font-bold rounded-xl ${escuchando ? "bg-red-500 text-white border-red-500 animate-pulse hover:bg-red-600" : ""}`}
                onClick={toggleVoz}
                title="Voz (F3)"
              >
                {escuchando ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                {escuchando ? "Escuchando" : "Voz"}
              </Button>
              <Button
                variant="outline"
                className="h-11 px-3 border-2 font-bold rounded-xl"
                onClick={openCustomerDisplay}
                title="Pantalla cliente (F4)"
              >
                <Monitor className="h-4 w-4 mr-2" />Pantalla cliente
              </Button>
            <Button
              variant="outline"
              className={cn(
                "h-11 px-4 border-2 font-bold rounded-xl transition-all",
                kiosko 
                  ? "bg-primary text-primary-foreground border-primary shadow-inner" 
                  : "border-primary/30 text-primary hover:bg-primary/5"
              )}
              onClick={() => setKiosko((k) => !k)}
              title={kiosko ? "Salir de Modo Kiosko" : "Activar Modo Kiosko"}
            >
              {kiosko ? (
                <>
                  <Minimize2 className="h-4 w-4 mr-2" />
                  Salir Kiosco
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4 mr-2" />
                  Modo Kiosco
                </>
              )}
            </Button>
            </div>
          </div>

          {/* Barcode bar */}
          <div className="relative">
            <ScanLine className="h-6 w-6 absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escanea o ingresa código de barras y presiona Enter"
              className="pl-12 h-14 text-base font-medium rounded-xl border-2 border-primary/30 focus-visible:border-primary bg-card"
            />
          </div>

          {/* Categorías (dark pills con icono) */}
          <div className="flex flex-wrap gap-1.5 pb-1">
            <CategoryPill
              label="Todas"
              icon={ShoppingBag}
              active={cat === null}
              onClick={() => setCat(null)}
            />
            {combos.length > 0 && (
              <CategoryPill
                label={`Combos (${combos.length})`}
                icon={Layers}
                active={cat === COMBOS_CAT_ID}
                onClick={() => setCat(COMBOS_CAT_ID)}
              />
            )}
            {categorias.map((c) => {
              const Icon = ICONS[c.icono] ?? Package;
              return (
                <CategoryPill
                  key={c.id}
                  label={c.nombre}
                  icon={Icon}
                  active={cat === c.id}
                  onClick={() => setCat(c.id)}
                />
              );
            })}
          </div>

          {/* Buscador + accesos rápidos */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto (nombre, marca, categoría)…"
                className="pl-10 h-11 rounded-xl bg-card"
              />
            </div>
            <QuickAction
              icon={Smartphone}
              label="Recarga Celular"
              color="text-purple-600"
              onClick={() => abrirServicio("recarga")}
            />
            <QuickAction
              icon={Zap}
              label="Pago de Servicio"
              color="text-blue-600"
              onClick={() => abrirServicio("pago")}
            />
            <QuickAction
              icon={ShoppingBag}
              label="Bolsa Plástica"
              color="text-emerald-600"
              onClick={agregarBolsa}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {mostrarSoloCombos ? (
            <ComboGrid combos={combosVisibles} productos={allProductos} onPick={handlePickCombo} />
          ) : (
            <>
              {combosVisibles.length > 0 && !cat && (
                <div className="mb-4">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Combos disponibles
                  </div>
                  <ComboGrid combos={combosVisibles} productos={allProductos} onPick={handlePickCombo} />
                </div>
              )}
              <ProductGrid productos={productos} onPick={handlePick} />
            </>
          )}
        </div>

        <div className="border-t bg-card px-5 py-2 text-xs font-semibold text-muted-foreground flex items-center justify-between">
          <span>Atajos: F1 buscar · F2 cobrar · Escanea para agregar</span>
          <span>
            {productos.length} producto{productos.length !== 1 && "s"} ·{" "}
            {formatPEN(cart.totales.total)} en carrito
          </span>
        </div>
      </div>

      {/* Columna carrito */}
      <div className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l">
      <Cart
        items={cart.items}
        onInc={(id) => {
          const it = cart.items.find((i) => i.producto.id === id);
          if (!it) return;
          const ok = cart.setCantidad(id, it.cantidad + 1);
          if (!ok) toast.warning(`Stock máximo: ${it.producto.stock} ${it.producto.unidad}`);
        }}
        onDec={(id) => {
          const it = cart.items.find((i) => i.producto.id === id);
          if (it) cart.setCantidad(id, it.cantidad - 1);
        }}
        onRemove={cart.remove}
        totales={cart.totales}
        onCheckout={() => setCheckoutOpen(true)}
        onClear={cart.clear}
        onDescuento={() => setDescuentoOpen(true)}
        descuentoInfo={cart.descuentoInfo}
        onQuitarDescuento={cart.quitarDescuento}
      />
      </div>

      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={cart.totales.total}
        onConfirm={confirmarVenta}
      />

      <DescuentoModal
        open={descuentoOpen}
        onOpenChange={setDescuentoOpen}
        items={cart.items}
        totalBruto={cart.totales.bruto}
        descuentoActual={cart.descuentoInfo}
        onAplicar={cart.aplicarDescuento}
        onQuitar={cart.quitarDescuento}
        role={role}
        isAdminMaestro={isAdminMaestro}
        usuarioEmail={user?.email}
      />

      <ServicioModal
        open={servicioTipo !== null}
        onOpenChange={(o) => !o && setServicioTipo(null)}
        tipo={servicioTipo ?? "recarga"}
        onConfirm={agregarServicio}
      />

      <TicketModal
        open={!!ticket}
        onOpenChange={(o) => !o && setTicket(null)}
        ticket={ticket}
      />

      {/* Modal de atajos */}
      {ayudaOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setAyudaOpen(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Keyboard className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-extrabold">Atajos de teclado</h2>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["F1", "Enfocar barra de búsqueda / código"],
                ["F2", "Abrir cobro / Cobrar"],
                ["F3", "Activar / desactivar voz"],
                ["F4", "Abrir pantalla del cliente"],
                ["F8", "Limpiar carrito"],
                ["F9", "Mostrar esta ayuda"],
                ["Enter", "Confirmar código de barras escaneado"],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between border-b last:border-0 py-2">
                  <span>{d}</span>
                  <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-muted rounded border">{k}</kbd>
                </div>
              ))}
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Comandos de voz</div>
              <div className="text-sm space-y-1">
                <div>· "<span className="font-semibold">cobrar</span>" / "pagar" → abre cobro</div>
                <div>· "<span className="font-semibold">limpiar</span>" → vacía el carrito</div>
                <div>· Di un <span className="font-semibold">número</span> → busca por código</div>
                <div>· Di el <span className="font-semibold">nombre</span> → agrega el producto</div>
              </div>
            </div>
            <Button onClick={() => setAyudaOpen(false)} className="w-full h-11 font-bold">Cerrar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryPill({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1 px-2.5 h-8 rounded-md text-[11px] font-bold whitespace-nowrap border transition active:scale-95 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md"
          : "bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 hidden md:inline-flex items-center gap-2 h-11 px-3 rounded-xl bg-card border text-sm font-bold hover:bg-muted transition"
      title={label}
    >
      <Icon className={`h-4 w-4 ${color}`} />
      {label}
    </button>
  );
}

function ComboGrid({
  combos,
  productos,
  onPick,
}: {
  combos: ComboRow[];
  productos: MockProducto[];
  onPick: (c: ComboRow) => void;
}) {
  if (combos.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-16 text-sm">
        No hay combos disponibles.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {combos.map((c) => {
        const totalIndiv = (c.combo_items ?? []).reduce((s, it) => {
          const p = productos.find((x) => x.id === it.producto_id);
          return s + (p?.precio_venta ?? 0) * it.cantidad;
        }, 0);
        const ahorro = Math.max(0, totalIndiv - Number(c.precio_combo));
        return (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className="relative rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-3 transition shadow-sm hover:shadow-lg hover:border-emerald-500 active:scale-[0.98] flex flex-col text-left"
          >
            <span className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500 text-white shadow-md">
              COMBO
            </span>
            <div className="aspect-square rounded-xl bg-emerald-100/60 grid place-items-center mb-2">
              <Layers className="h-12 w-12 text-emerald-600" strokeWidth={2.2} />
            </div>
            <div className="text-sm font-extrabold leading-tight line-clamp-2 min-h-[2.4rem]">
              {c.nombre}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-2 min-h-[1.6rem]">
              {(c.combo_items ?? []).map((it) => {
                const p = productos.find((x) => x.id === it.producto_id);
                return `${it.cantidad}× ${p?.nombre ?? "?"}`;
              }).join(" + ")}
            </div>
            <div className="mt-1 flex items-end justify-between">
              <div>
                <div className="font-extrabold text-lg text-emerald-600 tabular-nums leading-none">
                  {formatPEN(c.precio_combo)}
                </div>
                {ahorro > 0 && (
                  <div className="text-[10px] font-bold text-emerald-700">
                    Ahorras {formatPEN(ahorro)}
                  </div>
                )}
              </div>
              <span className="h-9 w-9 rounded-full bg-emerald-500 text-white grid place-items-center shadow-md">
                <Plus className="h-5 w-5" strokeWidth={3} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Wallet, LockOpen, Lock, ArrowUpRight, ArrowDownRight, BanknoteArrowDown,
  Calculator, Printer, FileDown, FileSpreadsheet, RefreshCw, Eye, Clock,
  AlertTriangle, TrendingUp, TrendingDown, CircleDollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatPEN } from "@/lib/format";
import { exportToCSV, printHTML, printTicket } from "@/lib/exporters";

export const Route = createFileRoute("/_app/caja")({
  head: () => ({ meta: [{ title: "Caja — POS Minimarket" }] }),
  component: CajaPage,
});

type Caja = {
  id: string; numero: number; cajero_id: string | null; estado: string;
  monto_apertura: number; monto_cierre: number | null;
  total_ventas: number; total_ingresos: number; total_egresos: number; total_retiros: number;
  monto_esperado: number | null; diferencia: number | null;
  abierta_en: string; cerrada_en: string | null;
  sucursal: string | null; turno: string | null; equipo: string | null; ip: string | null;
  observacion_apertura: string | null; observacion_cierre: string | null;
  arqueo: any;
};
type Mov = {
  id: string; caja_id: string; tipo: string; metodo_pago: string | null;
  monto: number; concepto: string; documento: string | null; referencia: string | null;
  saldo: number | null; creado_en: string; usuario_id: string | null;
};

const METODOS = ["EFECTIVO","YAPE","PLIN","TARJETA_DEBITO","TARJETA_CREDITO","TRANSFERENCIA"];
// Turnos: por ahora solo "DIA" (turno único). En el futuro se pueden habilitar
// múltiples turnos activando la opción en el modal de apertura.
const TURNOS_SIMPLE = [{ v: "DIA", label: "Día" }];
const TURNOS_MULTI = [
  { v: "MANANA", label: "Mañana" },
  { v: "TARDE", label: "Tarde" },
  { v: "NOCHE", label: "Noche" },
];
const DENOM_MONEDAS = [0.10, 0.20, 0.50, 1, 2, 5];
const DENOM_BILLETES = [10, 20, 50, 100, 200];

const turnoAutoMulti = () => {
  const h = new Date().getHours();
  if (h < 13) return "MANANA";
  if (h < 19) return "TARDE";
  return "NOCHE";
};

function CajaPage() {
  const { user, isDemo } = useAuth();
  const [caja, setCaja] = useState<Caja | null>(null);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [historial, setHistorial] = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  // Modales
  const [openAp, setOpenAp] = useState(false);
  const [openMov, setOpenMov] = useState<"INGRESO" | "EGRESO" | "RETIRO" | null>(null);
  const [openCi, setOpenCi] = useState(false);
  const [detalle, setDetalle] = useState<Caja | null>(null);
  const [detalleMovs, setDetalleMovs] = useState<Mov[]>([]);

  // Formularios
  const [fondo, setFondo] = useState("");
  const [ultimoFondo, setUltimoFondo] = useState<number | null>(null);
  const [multiTurno, setMultiTurno] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("caja_multi_turno") === "1";
  });
  const [turno, setTurno] = useState<string>("DIA");
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("caja_multi_turno", multiTurno ? "1" : "0");
    }
    setTurno(multiTurno ? turnoAutoMulti() : "DIA");
  }, [multiTurno]);
  const [sucursal, setSucursal] = useState("Principal");
  const [obsAp, setObsAp] = useState("");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [obsMov, setObsMov] = useState("");

  // Arqueo
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [obsCi, setObsCi] = useState("");
  const totalContado = useMemo(() =>
    Object.entries(conteo).reduce((s, [k, v]) => s + Number(k) * (Number(v) || 0), 0),
    [conteo],
  );

  const load = async () => {
    if (isDemo || !user) { setLoading(false); return; }
    setLoading(true);
    const { data: ab } = await supabase.from("cajas").select("*")
      .eq("cajero_id", user.id).eq("estado", "ABIERTA")
      .order("abierta_en", { ascending: false }).limit(1).maybeSingle();
    const cajaAb = (ab as any) ?? null;
    setCaja(cajaAb);
    if (cajaAb) {
      const { data: m } = await supabase.from("movimientos_caja").select("*")
        .eq("caja_id", cajaAb.id).order("creado_en", { ascending: true });
      setMovs((m ?? []) as any);
    } else setMovs([]);
    const { data: h } = await supabase.from("cajas").select("*")
      .order("abierta_en", { ascending: false }).limit(30);
    setHistorial((h ?? []) as any);
    // último fondo
    const { data: u } = await supabase.from("cajas").select("monto_apertura")
      .eq("cajero_id", user.id).order("abierta_en", { ascending: false }).limit(1).maybeSingle();
    setUltimoFondo(u ? Number((u as any).monto_apertura) : null);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id, isDemo]);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Realtime subscription for movimientos
  useEffect(() => {
    if (!caja?.id) return;
    const ch = supabase
      .channel(`mov-caja-${caja.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos_caja", filter: `caja_id=eq.${caja.id}` },
        () => { void load(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cajas", filter: `id=eq.${caja.id}` },
        () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja?.id]);

  // Totales por método de pago (solo VENTAS)
  const porMetodo = useMemo(() => {
    const m: Record<string, number> = {};
    movs.filter(x => x.tipo === "VENTA").forEach(x => {
      const k = x.metodo_pago || "OTRO";
      m[k] = (m[k] || 0) + Number(x.monto);
    });
    return m;
  }, [movs]);

  const cantVentas = useMemo(() =>
    new Set(movs.filter(x => x.tipo === "VENTA" && x.documento).map(x => x.documento)).size,
    [movs]);

  const efectivoEsperado = useMemo(() => {
    if (!caja) return 0;
    const ventasEfectivo = porMetodo["EFECTIVO"] || 0;
    return Number(caja.monto_apertura || 0) + ventasEfectivo
      + Number(caja.total_ingresos || 0)
      - Number(caja.total_egresos || 0)
      - Number(caja.total_retiros || 0);
  }, [caja, porMetodo]);

  const duracion = (desde: string, hasta?: string | null) => {
    const a = new Date(desde).getTime();
    const b = hasta ? new Date(hasta).getTime() : Date.now();
    void tick;
    const min = Math.max(0, Math.floor((b - a) / 60000));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  };

  // ------- ACCIONES -------
  const abrir = async () => {
    if (!user) return;
    const equipo = typeof navigator !== "undefined" ? navigator.userAgent.split(")")[0].split("(")[1] || "Web" : "Web";
    const { data, error } = await supabase.from("cajas").insert({
      cajero_id: user.id, monto_apertura: Number(fondo) || 0, estado: "ABIERTA",
      turno, sucursal, equipo, observacion_apertura: obsAp || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    // Movimiento de apertura (registro auditable)
    if (data?.id && (Number(fondo) || 0) > 0) {
      await supabase.from("movimientos_caja").insert({
        caja_id: data.id, tipo: "APERTURA", metodo_pago: "EFECTIVO",
        monto: Number(fondo) || 0, concepto: "Apertura de caja — fondo inicial",
        usuario_id: user.id,
      });
    }
    toast.success("Caja abierta"); setOpenAp(false);
    setFondo(""); setObsAp(""); void load();
  };

  const registrarMov = async () => {
    if (!caja || !openMov) return;
    const m = Number(monto);
    if (!(m > 0)) return toast.error("Monto inválido");
    if (!concepto.trim()) return toast.error("Concepto obligatorio");
    const { error } = await supabase.from("movimientos_caja").insert({
      caja_id: caja.id, tipo: openMov,
      metodo_pago: openMov === "RETIRO" ? "EFECTIVO" : metodo,
      monto: m, concepto, referencia: obsMov || null, usuario_id: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success(`${openMov} registrado`);
    setOpenMov(null); setMonto(""); setConcepto(""); setObsMov(""); setMetodo("EFECTIVO");
    void load();
  };

  const cerrar = async () => {
    if (!caja) return;
    const esperado = Number(efectivoEsperado.toFixed(2));
    const contado = Number(totalContado.toFixed(2));
    const diff = Number((contado - esperado).toFixed(2));
    if (Math.abs(diff) > 0.005 && !obsCi.trim()) {
      return toast.error("Diferencia detectada. Ingresa una observación.");
    }
    const { error } = await supabase.from("cajas").update({
      estado: "CERRADA",
      monto_cierre: contado,
      monto_esperado: esperado,
      diferencia: diff,
      arqueo: conteo,
      observacion_cierre: obsCi || null,
      cerrada_en: new Date().toISOString(),
    }).eq("id", caja.id);
    if (error) return toast.error(error.message);
    await supabase.from("movimientos_caja").insert({
      caja_id: caja.id, tipo: "CIERRE", metodo_pago: "EFECTIVO",
      monto: contado, concepto: `Cierre de caja · dif ${formatPEN(diff)}`,
      usuario_id: user?.id ?? null,
    });
    toast.success("Caja cerrada");
    // Imprimir cierre automáticamente
    const cerrada = { ...caja, monto_cierre: contado, monto_esperado: esperado, diferencia: diff, cerrada_en: new Date().toISOString() };
    imprimirCierre(cerrada);
    setOpenCi(false); setConteo({}); setObsCi("");
    void load();
  };

  // ------- IMPRESIONES / EXPORT -------
  const imprimirCierre = (c: any) => {
    const filas = movs.map(m => `<tr>
      <td>${new Date(m.creado_en).toLocaleTimeString("es-PE")}</td>
      <td>${m.tipo}</td>
      <td>${m.metodo_pago ?? "-"}</td>
      <td class="right">${formatPEN(m.monto)}</td>
    </tr>`).join("");
    const metRows = Object.entries(porMetodo).map(([k,v]) =>
      `<div>${k.padEnd(14)} ${formatPEN(v)}</div>`).join("");
    printTicket(`Cierre Caja #${c.numero}`, `
      <h1>CIERRE DE CAJA</h1>
      <div class="meta">Caja #${c.numero} · ${c.sucursal ?? "-"}<br/>
      ${new Date(c.abierta_en).toLocaleString("es-PE")}<br/>
      Cierre: ${new Date(c.cerrada_en ?? Date.now()).toLocaleString("es-PE")}</div>
      <div class="sep"></div>
      <div>Fondo inicial: <b>${formatPEN(c.monto_apertura)}</b></div>
      <div>Ventas: <b>${formatPEN(c.total_ventas)}</b></div>
      <div>Ingresos: ${formatPEN(c.total_ingresos)}</div>
      <div>Egresos: ${formatPEN(c.total_egresos)}</div>
      <div>Retiros: ${formatPEN(c.total_retiros)}</div>
      <div class="sep"></div>
      <div><b>Por método</b></div>
      ${metRows}
      <div class="sep"></div>
      <div>Esperado: <b>${formatPEN(c.monto_esperado ?? 0)}</b></div>
      <div>Contado: <b>${formatPEN(c.monto_cierre ?? 0)}</b></div>
      <div class="total">Diferencia: ${formatPEN(c.diferencia ?? 0)}</div>
      <div class="sep"></div>
      <div><b>Movimientos</b></div>
      <table><thead><tr><th>Hora</th><th>Tipo</th><th>Mét</th><th class="right">Monto</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <div class="center" style="margin-top:8px">— MG Solutions —</div>
    `);
  };

  const exportLibroCSV = () => {
    if (!caja) return;
    exportToCSV(`libro-caja-${caja.numero}`,
      movs.map(m => ({
        Hora: new Date(m.creado_en).toLocaleString("es-PE"),
        Tipo: m.tipo,
        Metodo: m.metodo_pago ?? "",
        Documento: m.documento ?? "",
        Concepto: m.concepto,
        Monto: m.monto,
        Saldo: m.saldo ?? "",
      })));
  };

  const exportHistorialCSV = () => {
    exportToCSV(`historial-cajas`,
      historial.map(c => ({
        Numero: c.numero, Estado: c.estado,
        Apertura: new Date(c.abierta_en).toLocaleString("es-PE"),
        Cierre: c.cerrada_en ? new Date(c.cerrada_en).toLocaleString("es-PE") : "",
        Fondo: c.monto_apertura, Ventas: c.total_ventas,
        Ingresos: c.total_ingresos, Egresos: c.total_egresos, Retiros: c.total_retiros,
        Esperado: c.monto_esperado ?? "", Contado: c.monto_cierre ?? "", Diferencia: c.diferencia ?? "",
      })));
  };

  const verDetalle = async (c: Caja) => {
    setDetalle(c);
    const { data } = await supabase.from("movimientos_caja").select("*")
      .eq("caja_id", c.id).order("creado_en", { ascending: true });
    setDetalleMovs((data ?? []) as any);
  };

  const imprimirHistorial = (c: Caja, mv: Mov[]) => {
    const filas = mv.map(m => `<tr>
      <td>${new Date(m.creado_en).toLocaleTimeString("es-PE")}</td>
      <td>${m.tipo}</td><td>${m.metodo_pago ?? "-"}</td>
      <td>${m.documento ?? ""}</td><td>${m.concepto}</td>
      <td class="right">${formatPEN(m.monto)}</td>
      <td class="right">${m.saldo != null ? formatPEN(m.saldo) : ""}</td>
    </tr>`).join("");
    printHTML(`Caja #${c.numero}`, `
      <h1>Detalle de caja #${c.numero}</h1>
      <div class="meta">${c.sucursal ?? ""} · ${c.turno ?? ""} · ${new Date(c.abierta_en).toLocaleString("es-PE")} → ${c.cerrada_en ? new Date(c.cerrada_en).toLocaleString("es-PE") : "abierta"}</div>
      <table><thead><tr>
        <th>Hora</th><th>Tipo</th><th>Método</th><th>Doc</th><th>Concepto</th>
        <th class="right">Monto</th><th class="right">Saldo</th></tr></thead>
      <tbody>${filas}</tbody></table>
      <p class="total">Ventas: ${formatPEN(c.total_ventas)} · Ingresos: ${formatPEN(c.total_ingresos)} · Egresos: ${formatPEN(c.total_egresos)} · Retiros: ${formatPEN(c.total_retiros)}</p>
      <p>Esperado: ${formatPEN(c.monto_esperado ?? 0)} · Contado: ${formatPEN(c.monto_cierre ?? 0)} · <b>Diferencia: ${formatPEN(c.diferencia ?? 0)}</b></p>
    `);
  };

  // ------- RENDER -------
  if (loading) return <div className="p-10 text-center text-muted-foreground">Cargando caja…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Caja
          </h1>
          <p className="text-muted-foreground text-sm">Apertura · Movimientos · Arqueo · Cierre</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </div>

      {isDemo && (
        <Card className="p-4 text-sm border-amber-500/30 bg-amber-500/5">
          Modo demo · las funciones de caja requieren sesión real
        </Card>
      )}

      {!caja ? (
        <Card className="p-10 text-center space-y-3 border-dashed">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
          <div className="text-lg font-semibold">No tienes una caja abierta</div>
          <p className="text-sm text-muted-foreground">Abre tu caja para poder vender.</p>
          <Button size="lg" onClick={() => { setFondo(ultimoFondo ? String(ultimoFondo) : ""); setTurno(multiTurno ? turnoAutoMulti() : "DIA"); setOpenAp(true); }} disabled={isDemo || !user}>
            <LockOpen className="h-4 w-4 mr-1" /> Abrir caja
          </Button>
        </Card>
      ) : (
        <>
          {/* Estado principal */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <StatCard label="Estado" value="ABIERTA" tone="ok" icon={<CircleDollarSign className="h-4 w-4" />} />
            <StatCard label={`Caja #${caja.numero}`} value={caja.turno ? caja.turno : "—"} sub={caja.sucursal ?? ""} />
            <StatCard label="Tiempo abierta" value={duracion(caja.abierta_en)} icon={<Clock className="h-4 w-4" />} />
            <StatCard label="Fondo inicial" value={formatPEN(caja.monto_apertura)} />
            <StatCard label="Ventas" value={formatPEN(caja.total_ventas)} sub={`${cantVentas} tickets`} icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} />
            <StatCard label="Efectivo esperado" value={formatPEN(efectivoEsperado)} tone="info" />
          </div>

          {/* Acciones rápidas */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { setOpenMov("INGRESO"); setMetodo("EFECTIVO"); }}>
              <ArrowDownRight className="h-4 w-4 mr-1 text-emerald-600" /> Ingreso
            </Button>
            <Button variant="outline" onClick={() => { setOpenMov("EGRESO"); setMetodo("EFECTIVO"); }}>
              <ArrowUpRight className="h-4 w-4 mr-1 text-destructive" /> Egreso
            </Button>
            <Button variant="outline" onClick={() => { setOpenMov("RETIRO"); }}>
              <BanknoteArrowDown className="h-4 w-4 mr-1 text-orange-600" /> Retiro parcial
            </Button>
            <Button variant="destructive" className="ml-auto" onClick={() => { setConteo({}); setObsCi(""); setOpenCi(true); }}>
              <Calculator className="h-4 w-4 mr-1" /> Arqueo y cierre
            </Button>
          </div>

          <Tabs defaultValue="dashboard">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="libro">Libro de caja</TabsTrigger>
              <TabsTrigger value="metodos">Métodos de pago</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            {/* Dashboard */}
            <TabsContent value="dashboard" className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Ingresos manuales" value={formatPEN(caja.total_ingresos)} tone="ok" />
                <StatCard label="Egresos" value={formatPEN(caja.total_egresos)} tone="warn" icon={<TrendingDown className="h-4 w-4 text-destructive" />} />
                <StatCard label="Retiros" value={formatPEN(caja.total_retiros)} tone="warn" />
                <StatCard label="Movimientos" value={String(movs.length)} />
              </div>
              <Card className="p-4">
                <div className="text-sm font-semibold mb-2">Últimos movimientos</div>
                <MovTable movs={movs.slice(-8).reverse()} />
              </Card>
              {(caja.total_retiros > (caja.total_ventas || 1) * 0.5 || duracion(caja.abierta_en).startsWith("2") || duracion(caja.abierta_en).match(/^([2-9]\d|\d{3,})h/)) && (
                <Card className="p-3 bg-amber-50 border-amber-200 flex items-center gap-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Alerta: caja abierta hace {duracion(caja.abierta_en)} o retiros elevados.
                </Card>
              )}
            </TabsContent>

            {/* Libro */}
            <TabsContent value="libro">
              <Card className="overflow-hidden">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-semibold">Libro de caja · saldo corrido</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={exportLibroCSV}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
                    <Button size="sm" variant="outline" onClick={() => imprimirHistorial(caja, movs)}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
                  </div>
                </div>
                <MovTable movs={movs} full />
              </Card>
            </TabsContent>

            {/* Métodos */}
            <TabsContent value="metodos">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {METODOS.map(m => (
                  <Card key={m} className="p-4">
                    <div className="text-xs text-muted-foreground">{m.replace("_", " ")}</div>
                    <div className="text-xl font-bold">{formatPEN(porMetodo[m] || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {movs.filter(x => x.tipo === "VENTA" && x.metodo_pago === m).length} ventas
                    </div>
                  </Card>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">Solo el efectivo participa en el arqueo.</div>
            </TabsContent>

            {/* Historial */}
            <TabsContent value="historial">
              <Card className="overflow-hidden">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="font-semibold">Historial de cajas</div>
                  <Button size="sm" variant="outline" onClick={exportHistorialCSV}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />Exportar
                  </Button>
                </div>
                <HistorialTable data={historial} onDetalle={verDetalle} />
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!caja && historial.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-3 font-semibold border-b flex items-center justify-between">
            <span>Historial de cajas</span>
            <Button size="sm" variant="outline" onClick={exportHistorialCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />Exportar
            </Button>
          </div>
          <HistorialTable data={historial} onDetalle={verDetalle} />
        </Card>
      )}

      {/* Modal: Apertura */}
      <Dialog open={openAp} onOpenChange={setOpenAp}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Apertura de caja</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Sucursal</Label><Input value={sucursal} onChange={e => setSucursal(e.target.value)} /></div>
            <div>
              <Label>Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TURNOS.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Fondo inicial (S/)</Label>
              <Input type="number" step="0.01" value={fondo} onChange={e => setFondo(e.target.value)} />
              {ultimoFondo != null && (
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                  Último fondo utilizado: {formatPEN(ultimoFondo)}
                  <Button size="sm" variant="ghost" onClick={() => setFondo(String(ultimoFondo))}>Usar mismo</Button>
                </div>
              )}
            </div>
            <div className="col-span-2">
              <Label>Observación (opcional)</Label>
              <Textarea value={obsAp} onChange={e => setObsAp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAp(false)}>Cancelar</Button>
            <Button onClick={abrir}><LockOpen className="h-4 w-4 mr-1" />Abrir caja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Movimiento */}
      <Dialog open={!!openMov} onOpenChange={(o) => !o && setOpenMov(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openMov === "INGRESO" ? "Nuevo ingreso" : openMov === "EGRESO" ? "Nuevo egreso" : "Retiro parcial"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Monto</Label><Input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} /></div>
            {openMov !== "RETIRO" && (
              <div>
                <Label>Método</Label>
                <Select value={metodo} onValueChange={setMetodo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METODOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{openMov === "RETIRO" ? "Motivo" : "Concepto"}</Label>
              <Input value={concepto} onChange={e => setConcepto(e.target.value)}
                placeholder={openMov === "RETIRO" ? "Ej: Depósito bancario" : "Ej: Reintegro caja chica"} />
            </div>
            <div><Label>Observación / responsable</Label>
              <Textarea value={obsMov} onChange={e => setObsMov(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMov(null)}>Cancelar</Button>
            <Button onClick={registrarMov}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Cierre con arqueo */}
      <Dialog open={openCi} onOpenChange={setOpenCi}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Arqueo y cierre de caja</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold mb-2">Monedas</div>
              <div className="space-y-1">
                {DENOM_MONEDAS.map(d => (
                  <div key={d} className="flex items-center gap-2 text-sm">
                    <div className="w-14 font-mono">S/ {d.toFixed(2)}</div>
                    <Input type="number" min={0} className="h-8" value={conteo[String(d)] || ""}
                      onChange={e => setConteo({ ...conteo, [String(d)]: Number(e.target.value) })} />
                    <div className="w-24 text-right font-mono text-xs">
                      {formatPEN(d * (conteo[String(d)] || 0))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm font-semibold mt-3 mb-2">Billetes</div>
              <div className="space-y-1">
                {DENOM_BILLETES.map(d => (
                  <div key={d} className="flex items-center gap-2 text-sm">
                    <div className="w-14 font-mono">S/ {d}</div>
                    <Input type="number" min={0} className="h-8" value={conteo[String(d)] || ""}
                      onChange={e => setConteo({ ...conteo, [String(d)]: Number(e.target.value) })} />
                    <div className="w-24 text-right font-mono text-xs">
                      {formatPEN(d * (conteo[String(d)] || 0))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <ResumenLine k="Fondo inicial" v={caja?.monto_apertura || 0} />
              <ResumenLine k="Ventas efectivo" v={porMetodo["EFECTIVO"] || 0} />
              <ResumenLine k="Ingresos" v={caja?.total_ingresos || 0} />
              <ResumenLine k="Egresos" v={-(caja?.total_egresos || 0)} />
              <ResumenLine k="Retiros" v={-(caja?.total_retiros || 0)} />
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total esperado</span><span>{formatPEN(efectivoEsperado)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total contado</span><span>{formatPEN(totalContado)}</span>
              </div>
              <div className={`flex justify-between text-lg font-extrabold ${Math.abs(totalContado - efectivoEsperado) < 0.005 ? "text-emerald-600" : (totalContado > efectivoEsperado ? "text-blue-600" : "text-destructive")}`}>
                <span>Diferencia</span><span>{formatPEN(totalContado - efectivoEsperado)}</span>
              </div>
              <div>
                <Label>Observación {Math.abs(totalContado - efectivoEsperado) > 0.005 && <span className="text-destructive">(obligatoria)</span>}</Label>
                <Textarea value={obsCi} onChange={e => setObsCi(e.target.value)} />
              </div>
              <div className="text-xs text-muted-foreground">
                Otras ventas: {formatPEN((caja?.total_ventas || 0) - (porMetodo["EFECTIVO"] || 0))} en tarjeta/digital.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCi(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={cerrar}>
              <Lock className="h-4 w-4 mr-1" /> Cerrar caja e imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalle de caja histórica */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Caja #{detalle?.numero} — Detalle</DialogTitle></DialogHeader>
          {detalle && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <Info k="Sucursal" v={detalle.sucursal ?? "-"} />
                <Info k="Turno" v={detalle.turno ?? "-"} />
                <Info k="Apertura" v={new Date(detalle.abierta_en).toLocaleString("es-PE")} />
                <Info k="Cierre" v={detalle.cerrada_en ? new Date(detalle.cerrada_en).toLocaleString("es-PE") : "—"} />
                <Info k="Fondo" v={formatPEN(detalle.monto_apertura)} />
                <Info k="Ventas" v={formatPEN(detalle.total_ventas)} />
                <Info k="Ingresos" v={formatPEN(detalle.total_ingresos)} />
                <Info k="Egresos" v={formatPEN(detalle.total_egresos)} />
                <Info k="Retiros" v={formatPEN(detalle.total_retiros)} />
                <Info k="Esperado" v={formatPEN(detalle.monto_esperado ?? 0)} />
                <Info k="Contado" v={formatPEN(detalle.monto_cierre ?? 0)} />
                <Info k="Diferencia" v={formatPEN(detalle.diferencia ?? 0)}
                  tone={(detalle.diferencia ?? 0) === 0 ? "ok" : "warn"} />
              </div>
              <div className="max-h-80 overflow-auto border rounded">
                <MovTable movs={detalleMovs} full />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => exportToCSV(`caja-${detalle.numero}`, detalleMovs.map(m => ({
                  Hora: new Date(m.creado_en).toLocaleString("es-PE"), Tipo: m.tipo, Metodo: m.metodo_pago ?? "",
                  Documento: m.documento ?? "", Concepto: m.concepto, Monto: m.monto, Saldo: m.saldo ?? "",
                })))}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
                <Button variant="outline" size="sm" onClick={() => imprimirHistorial(detalle, detalleMovs)}>
                  <FileDown className="h-4 w-4 mr-1" />PDF / Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={() => imprimirCierre({ ...detalle })}>
                  <Printer className="h-4 w-4 mr-1" />Ticket 80mm
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, sub, tone, icon }: {
  label: string; value: string; sub?: string; tone?: "ok" | "warn" | "info";
  icon?: React.ReactNode;
}) {
  const t = tone === "ok" ? "border-emerald-200 bg-emerald-50"
    : tone === "warn" ? "border-orange-200 bg-orange-50"
    : tone === "info" ? "border-blue-200 bg-blue-50"
    : "";
  return (
    <Card className={`p-3 ${t}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-xl font-extrabold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function MovTable({ movs, full }: { movs: Mov[]; full?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/50 text-xs uppercase">
        <tr>
          <th className="px-3 py-2 text-left">Hora</th>
          <th className="px-3 py-2">Tipo</th>
          <th className="px-3 py-2">Método</th>
          {full && <th className="px-3 py-2">Documento</th>}
          <th className="px-3 py-2 text-left">Concepto</th>
          <th className="px-3 py-2 text-right">Monto</th>
          {full && <th className="px-3 py-2 text-right">Saldo</th>}
        </tr>
      </thead>
      <tbody>
        {movs.length === 0 ? (
          <tr><td colSpan={full ? 7 : 5} className="p-6 text-center text-muted-foreground">Sin movimientos</td></tr>
        ) : movs.map(m => {
          const neg = m.tipo === "EGRESO" || m.tipo === "GASTO" || m.tipo === "RETIRO" || m.tipo === "ANULACION";
          return (
            <tr key={m.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(m.creado_en).toLocaleString("es-PE")}</td>
              <td className="px-3 py-2 text-center">
                <Badge variant={neg ? "destructive" : m.tipo === "VENTA" ? "default" : "secondary"}>{m.tipo}</Badge>
              </td>
              <td className="px-3 py-2 text-center text-xs">{m.metodo_pago ?? "—"}</td>
              {full && <td className="px-3 py-2 text-xs">{m.documento ?? ""}</td>}
              <td className="px-3 py-2">{m.concepto}</td>
              <td className={`px-3 py-2 text-right font-mono ${neg ? "text-destructive" : ""}`}>
                {neg ? "-" : ""}{formatPEN(m.monto)}
              </td>
              {full && <td className="px-3 py-2 text-right font-mono">{m.saldo != null ? formatPEN(m.saldo) : ""}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function HistorialTable({ data, onDetalle }: { data: Caja[]; onDetalle: (c: Caja) => void }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/50 text-xs uppercase">
        <tr>
          <th className="px-3 py-2 text-left">N°</th>
          <th className="px-3 py-2">Estado</th>
          <th className="px-3 py-2">Turno</th>
          <th className="px-3 py-2">Apertura</th>
          <th className="px-3 py-2">Cierre</th>
          <th className="px-3 py-2 text-right">Ventas</th>
          <th className="px-3 py-2 text-right">Diferencia</th>
          <th className="px-3 py-2 text-right">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sin historial</td></tr>
        ) : data.map(c => (
          <tr key={c.id} className="border-t hover:bg-muted/30">
            <td className="px-3 py-2 font-bold">#{c.numero}</td>
            <td className="px-3 py-2 text-center">
              <Badge className={c.estado === "ABIERTA" ? "bg-emerald-500" : "bg-slate-400"}>{c.estado}</Badge>
            </td>
            <td className="px-3 py-2 text-center text-xs">{c.turno ?? "—"}</td>
            <td className="px-3 py-2 text-xs">{new Date(c.abierta_en).toLocaleString("es-PE")}</td>
            <td className="px-3 py-2 text-xs">{c.cerrada_en ? new Date(c.cerrada_en).toLocaleString("es-PE") : "—"}</td>
            <td className="px-3 py-2 text-right font-mono">{formatPEN(c.total_ventas)}</td>
            <td className={`px-3 py-2 text-right font-mono ${Math.abs(c.diferencia ?? 0) > 0.005 ? "text-orange-600 font-bold" : ""}`}>
              {c.diferencia != null ? formatPEN(c.diferencia) : "—"}
            </td>
            <td className="px-3 py-2 text-right">
              <Button size="sm" variant="ghost" onClick={() => onDetalle(c)}>
                <Eye className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResumenLine({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-mono ${v < 0 ? "text-destructive" : ""}`}>{formatPEN(v)}</span>
    </div>
  );
}

function Info({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{k}</div>
      <div className={`font-semibold ${tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-orange-600" : ""}`}>{v}</div>
    </div>
  );
}

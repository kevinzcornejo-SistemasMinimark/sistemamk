import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingCart, CheckCircle2 } from "lucide-react";
import { subscribeDisplay, type DisplayPayload } from "@/lib/customerDisplay";
import { formatPEN } from "@/lib/format";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";

export const Route = createFileRoute("/_app/cliente-display")({
  head: () => ({ meta: [{ title: "Pantalla Cliente — POS" }] }),
  component: ClienteDisplayPage,
});

function ClienteDisplayPage() {
  const [d, setD] = useState<DisplayPayload | null>(null);
  const [hora, setHora] = useState(new Date());
  const biz = useBusinessInfo();

  useEffect(() => {
    const unsub = subscribeDisplay(setD);
    const t = setInterval(() => setHora(new Date()), 1000);
    document.documentElement.classList.add("kiosk");
    return () => { unsub(); clearInterval(t); document.documentElement.classList.remove("kiosk"); };
  }, []);

  const pagado = d?.estado === "pagado";

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-10 py-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-4">
          {biz.logo && <img src={biz.logo} alt="logo" className="h-14 w-14 rounded-lg object-cover" />}
          <div>
            <div className="text-3xl font-extrabold tracking-tight">{biz.nombre}</div>
            <div className="text-sm text-white/60">RUC {biz.ruc}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-bold">{hora.toLocaleTimeString("es-PE")}</div>
          <div className="text-sm text-white/60">{hora.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
      </div>

      {pagado ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <CheckCircle2 className="h-40 w-40 text-emerald-400 animate-pulse" />
          <div className="text-6xl font-extrabold text-emerald-300">¡GRACIAS POR SU COMPRA!</div>
          <div className="mt-6 text-center">
            <div className="text-xl text-white/70">Total pagado</div>
            <div className="text-7xl font-extrabold mt-2">{formatPEN(d.total)}</div>
            {!!d.vuelto && d.vuelto > 0 && (
              <div className="mt-4 text-3xl text-amber-300">Su vuelto: <span className="font-extrabold">{formatPEN(d.vuelto)}</span></div>
            )}
          </div>
        </div>
      ) : !d || d.estado === "vacio" ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40">
          <ShoppingCart className="h-32 w-32 mb-6" />
          <div className="text-4xl font-bold">Bienvenido</div>
          <div className="text-xl mt-2">Esperando productos…</div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[1fr_420px] overflow-hidden">
          {/* Lista de productos */}
          <div className="overflow-y-auto p-8 space-y-2">
            <div className="grid grid-cols-[60px_1fr_120px_140px] text-xs uppercase tracking-wider text-white/40 px-4 pb-2 border-b border-white/10">
              <span>Cant</span><span>Producto</span><span className="text-right">P. Unit</span><span className="text-right">Subtotal</span>
            </div>
            {d.items.slice().reverse().map((i, idx) => (
              <div key={i.id} className={`grid grid-cols-[60px_1fr_120px_140px] items-center px-4 py-3 rounded-xl text-lg ${idx === 0 ? "bg-emerald-500/20 ring-2 ring-emerald-400/50" : "bg-white/5"}`}>
                <span className="font-extrabold text-emerald-300">×{i.cantidad}</span>
                <span className="font-semibold truncate">{i.nombre}</span>
                <span className="text-right text-white/70">{formatPEN(i.precio)}</span>
                <span className="text-right font-bold">{formatPEN(i.subtotal)}</span>
              </div>
            ))}
          </div>
          {/* Totales */}
          <div className="bg-black/30 backdrop-blur-sm p-8 flex flex-col justify-between border-l border-white/10">
            <div className="space-y-3">
              <div className="text-white/60 text-lg">Productos</div>
              <div className="text-5xl font-extrabold">{d.cantidadItems}</div>
              <div className="h-px bg-white/10 my-6" />
              <div className="flex justify-between text-lg text-white/70"><span>Subtotal</span><span>{formatPEN(d.subtotal)}</span></div>
              <div className="flex justify-between text-lg text-white/70"><span>IGV (18%)</span><span>{formatPEN(d.igv)}</span></div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-6 shadow-2xl">
              <div className="text-white/80 text-lg font-semibold">TOTAL A PAGAR</div>
              <div className="text-7xl font-extrabold mt-2 tabular-nums">{formatPEN(d.total)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="px-10 py-3 border-t border-white/10 text-center text-xs text-white/40">
        Conserve su comprobante · Cambios o devoluciones con ticket
      </div>
    </div>
  );
}

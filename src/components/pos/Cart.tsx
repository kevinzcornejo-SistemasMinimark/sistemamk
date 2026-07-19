import { Minus, Plus, Trash2, ShoppingCart, CreditCard, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPEN } from "@/lib/format";
import type { CartItem } from "@/hooks/usePOSCart";

export function Cart({
  items,
  onInc,
  onDec,
  onRemove,
  totales,
  onCheckout,
  onClear,
  onDescuento,
}: {
  items: CartItem[];
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  totales: { subtotal: number; igv: number; total: number; cantidadItems: number };
  onCheckout: () => void;
  onClear: () => void;
  onDescuento?: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-card border-l">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="font-extrabold text-lg">Carrito</span>
          {totales.cantidadItems > 0 && (
            <span className="h-6 min-w-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-extrabold grid place-items-center">
              {totales.cantidadItems}
            </span>
          )}
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs font-semibold text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg"
          >
            <Trash2 className="h-3.5 w-3.5" /> Vaciar
          </button>
        )}
      </div>

      {/* Totales (arriba, como la foto) */}
      <div className="px-3 pb-3 border-b space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Subtotal</span>
          <span className="font-extrabold tabular-nums">{formatPEN(totales.subtotal + totales.igv)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-black">TOTAL</span>
          <span className="text-2xl font-black text-primary tabular-nums">
            {formatPEN(totales.total)}
          </span>
        </div>
        <Button
          className="w-full h-12 text-base font-extrabold rounded-xl shadow-md bg-primary hover:bg-primary/90"
          disabled={items.length === 0}
          onClick={onCheckout}
        >
          <CreditCard className="h-5 w-5 mr-2" />
          Cobrar
        </Button>
        <Button
          variant="outline"
          className="w-full h-10 text-sm font-bold rounded-xl border-2"
          disabled={items.length === 0}
          onClick={onDescuento}
        >
          <Percent className="h-4 w-4 mr-2" />
          Descuento
        </Button>
      </div>

      {/* Items abajo */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-base text-muted-foreground py-20 px-4">
            <ShoppingCart className="h-16 w-16 mx-auto mb-3 opacity-20" />
            Toca un producto para agregarlo
          </div>
        ) : (
          items.map((i) => (
            <div
              key={i.producto.id}
              className="rounded-xl border bg-card p-3 flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-lg bg-muted grid place-items-center shrink-0 text-xs font-black text-muted-foreground">
                {i.producto.imagen ? (
                  <img src={i.producto.imagen} alt={i.producto.nombre} className="h-full w-full object-cover rounded-lg" />
                ) : (
                  i.producto.nombre.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold truncate">{i.producto.nombre}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatPEN(i.producto.precio_venta)} c/u
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onDec(i.producto.id)}
                      className="h-9 w-9 rounded-lg border bg-card grid place-items-center hover:bg-muted active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-base font-extrabold tabular-nums">
                      {i.cantidad}
                    </span>
                    <button
                      onClick={() => onInc(i.producto.id)}
                      className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center hover:bg-primary/90 active:scale-95"
                    >
                      <Plus className="h-4 w-4" strokeWidth={3} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-primary tabular-nums">
                      {formatPEN(i.producto.precio_venta * i.cantidad - i.descuento)}
                    </span>
                    <button
                      onClick={() => onRemove(i.producto.id)}
                      className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive grid place-items-center hover:bg-destructive/20"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
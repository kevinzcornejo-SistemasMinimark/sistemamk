import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Database,
  RefreshCw,
  ShoppingCart,
  Package,
  Layers,
  Boxes,
  Truck,
  Users,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  UserCog,
  Tag,
  ClipboardList,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/guia")({
  head: () => ({
    meta: [
      { title: "Guía del sistema — POS Minimarket" },
      {
        name: "description",
        content:
          "Tutorial paso a paso para usar el sistema POS Minimarket y monitor de uso de base de datos.",
      },
    ],
  }),
  component: GuiaPage,
});

type Paso = {
  titulo: string;
  descripcion: string;
  icon: any;
  color: string;
};

const PASOS: Paso[] = [
  {
    titulo: "1. Configura tu negocio",
    descripcion:
      "Ve a Configuración → Negocio y registra RUC, razón social, dirección y la licencia del sistema (30/60/90 días, 1/5/10 años).",
    icon: Settings,
    color: "text-blue-500",
  },
  {
    titulo: "2. Crea usuarios y permisos",
    descripcion:
      "En Usuarios agrega vendedores/gerente con correo y contraseña. Asigna qué módulos puede ver cada rol.",
    icon: UserCog,
    color: "text-purple-500",
  },
  {
    titulo: "3. Registra proveedores",
    descripcion:
      "En Proveedores agrega los datos de tus suministradores (RUC, contacto, teléfono).",
    icon: Truck,
    color: "text-orange-500",
  },
  {
    titulo: "4. Crea categorías y productos",
    descripcion:
      "Primero las Categorías (Abarrotes, Bebidas, etc.) y luego los Productos con código de barras, precio de compra, precio de venta y foto.",
    icon: Package,
    color: "text-emerald-500",
  },
  {
    titulo: "5. Registra compras (ingresa stock)",
    descripcion:
      "En Compras registra la factura del proveedor. El stock aumenta automáticamente, se genera el lote y se guarda en Kardex.",
    icon: ClipboardList,
    color: "text-amber-500",
  },
  {
    titulo: "6. Controla lotes y vencimientos",
    descripcion:
      "En Lotes revisa fechas de caducidad y usa Sincronizar stock para cuadrar productos con lotes.",
    icon: Layers,
    color: "text-red-500",
  },
  {
    titulo: "7. Crea combos y etiquetas",
    descripcion:
      "En Combos arma packs promocionales. En Etiquetas imprime códigos de barras para góndola.",
    icon: Tag,
    color: "text-pink-500",
  },
  {
    titulo: "8. Abre caja",
    descripcion:
      "En Caja registra el monto de apertura del día. Sin caja abierta no se pueden cobrar ventas.",
    icon: Wallet,
    color: "text-green-500",
  },
  {
    titulo: "9. Vende en Punto de Venta",
    descripcion:
      "Escanea o busca productos, elige tipo de comprobante (Boleta/Factura/Ticket), cobra con Efectivo/Yape/Plin/Tarjeta y entrega el ticket 80 mm.",
    icon: ShoppingCart,
    color: "text-primary",
  },
  {
    titulo: "10. Gestiona clientes",
    descripcion:
      "En Clientes registra DNI/RUC para emitir comprobantes electrónicos.",
    icon: Users,
    color: "text-sky-500",
  },
  {
    titulo: "11. Registra gastos",
    descripcion:
      "En Gastos anota alquiler, servicios, sueldos. Se descuentan del arqueo de caja.",
    icon: Receipt,
    color: "text-rose-500",
  },
  {
    titulo: "12. Revisa Kardex e Inventario",
    descripcion:
      "En Kardex ves cada movimiento (entrada/salida/ajuste). En Inventario haces conteo físico y ajustes.",
    icon: Boxes,
    color: "text-indigo-500",
  },
  {
    titulo: "13. Analiza reportes",
    descripcion:
      "En Reportes revisa ventas por día, productos más vendidos, utilidad y stock crítico. Exporta a Excel o PDF.",
    icon: BarChart3,
    color: "text-violet-500",
  },
  {
    titulo: "14. Cierra caja",
    descripcion:
      "Al final del día cierra caja: el sistema calcula ventas, gastos y saldo esperado vs. contado.",
    icon: ShieldCheck,
    color: "text-teal-500",
  },
];

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function GuiaPage() {
  const [dbSize, setDbSize] = useState<{
    total_bytes: number;
    total_pretty: string;
    tablas_bytes: number;
    tablas_pretty: string;
  } | null>(null);
  const [tablas, setTablas] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [errorDb, setErrorDb] = useState<string | null>(null);

  const cargarDb = async () => {
    setLoadingDb(true);
    setErrorDb(null);
    try {
      const { data: size, error: e1 } = await supabase.rpc("get_db_size");
      if (e1) throw e1;
      const row = Array.isArray(size) ? size[0] : size;
      setDbSize(row);
      const { data: tbls, error: e2 } = await supabase.rpc(
        "get_db_tables_size",
      );
      if (e2) throw e2;
      setTablas(Array.isArray(tbls) ? tbls : []);
    } catch (err: any) {
      setErrorDb(
        err?.message ??
          "No se pudo consultar. Ejecuta sql/db-size.sql en Supabase.",
      );
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    cargarDb();
  }, []);

  // Supabase free tier ~ 500MB
  const LIMITE_MB = 500;
  const usadoMB = dbSize ? dbSize.total_bytes / (1024 * 1024) : 0;
  const porcentaje = Math.min(100, (usadoMB / LIMITE_MB) * 100);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Guía del sistema
          </h1>
          <p className="text-muted-foreground text-sm">
            Tutorial paso a paso y monitor de uso de base de datos
          </p>
        </div>
      </div>

      {/* Monitor de base de datos */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold flex items-center gap-2">
                Uso de la base de datos
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-xs text-muted-foreground">
                Actualizado en tiempo real desde Supabase
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={cargarDb}
            disabled={loadingDb}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${loadingDb ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>

        {errorDb ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <div className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
              Falta configurar
            </div>
            <p className="text-muted-foreground">
              Ejecuta{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">
                sql/db-size.sql
              </code>{" "}
              en Supabase SQL Editor para habilitar el monitor.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Detalle: {errorDb}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border p-4 bg-card">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tamaño total
                </div>
                <div className="text-2xl font-extrabold mt-1">
                  {dbSize?.total_pretty ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dbSize ? formatBytes(dbSize.total_bytes) : ""}
                </div>
              </div>
              <div className="rounded-lg border p-4 bg-card">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Tablas (public)
                </div>
                <div className="text-2xl font-extrabold mt-1">
                  {dbSize?.tablas_pretty ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tablas.length} tablas activas
                </div>
              </div>
              <div className="rounded-lg border p-4 bg-card">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Plan gratuito
                </div>
                <div className="text-2xl font-extrabold mt-1">
                  {usadoMB.toFixed(1)} / {LIMITE_MB} MB
                </div>
                <div className="text-xs text-muted-foreground">
                  {porcentaje.toFixed(1)}% usado
                </div>
              </div>
            </div>

            <Progress value={porcentaje} className="h-2 mb-4" />

            {tablas.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide">
                  Detalle por tabla
                </div>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase text-left">
                      <tr>
                        <th className="px-4 py-2">Tabla</th>
                        <th className="px-4 py-2 text-right">Filas</th>
                        <th className="px-4 py-2 text-right">Tamaño</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablas.slice(0, 20).map((t) => (
                        <tr key={t.tabla} className="border-t">
                          <td className="px-4 py-2 font-mono text-xs">
                            {t.tabla}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {Number(t.filas).toLocaleString("es-PE")}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {t.tamano}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Tutorial paso a paso */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">
            Tutorial
          </Badge>
          <h2 className="text-lg font-bold">Cómo usar el sistema paso a paso</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PASOS.map((p) => {
            const Icon = p.icon;
            return (
              <Card
                key={p.titulo}
                className="p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className={`h-5 w-5 ${p.color}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{p.titulo}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {p.descripcion}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="text-sm">
          <span className="font-semibold">¿Necesitas ayuda?</span>{" "}
          <span className="text-muted-foreground">
            Contacta al creador — Kevin MG Solutions.
          </span>
        </div>
      </Card>
    </div>
  );
}

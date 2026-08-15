import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Layers,
  Warehouse,
  CalendarClock,
  ClipboardList,
  Printer,
  Truck,
  Users,
  Wallet,
  Receipt,
  BarChart3,
  UserCog,
  Settings,
  Cog,
  BookOpen,
  Store,
  X,
  Boxes,
  Percent,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";
import { StorageWidget } from "./StorageWidget";
import { LicenseWidget } from "./LicenseWidget";
import { AlertasPanel } from "./AlertasPanel";

type Item = {
  to: string;
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Section = {
  title: string;
  color: string;
  items: Item[];
};

const sections: Section[] = [
  {
    title: "Principal",
    color: "text-primary",
    items: [
      { to: "/dashboard", key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pos", key: "pos", label: "Punto de Venta", icon: ShoppingCart },
    ],
  },
  {
    title: "Inventario",
    color: "text-emerald-400",
    items: [
      { to: "/productos", key: "productos", label: "Productos", icon: Package },
      { to: "/categorias", key: "categorias", label: "Categorías", icon: Tags },
      { to: "/combos", key: "combos", label: "Combos", icon: Layers },
      { to: "/inventario", key: "inventario", label: "Inventario", icon: Warehouse },
      { to: "/lotes", key: "lotes", label: "Lotes", icon: CalendarClock },
      { to: "/kardex", key: "kardex", label: "Kardex", icon: ClipboardList },
      { to: "/etiquetas", key: "etiquetas", label: "Etiquetas", icon: Printer },
    ],
  },
  {
    title: "Compras",
    color: "text-amber-400",
    items: [
      { to: "/compras", key: "compras", label: "Compras", icon: Boxes },
      { to: "/proveedores", key: "proveedores", label: "Proveedores", icon: Truck },
    ],
  },
  {
    title: "Clientes",
    color: "text-sky-400",
    items: [{ to: "/clientes", key: "clientes", label: "Clientes", icon: Users }],
  },
  {
    title: "Caja",
    color: "text-rose-400",
    items: [
      { to: "/caja", key: "caja", label: "Caja", icon: Wallet },
      { to: "/gastos", key: "gastos", label: "Gastos", icon: Receipt },
      { to: "/tickets", key: "tickets", label: "Tickets", icon: ClipboardList },
    ],
  },
  {
    title: "Reportes",
    color: "text-violet-400",
    items: [
      { to: "/reportes", key: "reportes", label: "Reportes", icon: BarChart3 },
      { to: "/reportes2", key: "reportes2", label: "Comparativo", icon: BarChart3 },
      { to: "/descuentos", key: "descuentos", label: "Descuentos", icon: Percent },
    ],
  },
  {
    title: "Sistema",
    color: "text-fuchsia-400",
    items: [
      { to: "/usuarios", key: "usuarios", label: "Usuarios", icon: UserCog },
      { to: "/ajustes", key: "ajustes", label: "Ajustes", icon: Settings },
      { to: "/configuracion", key: "configuracion", label: "Configuración", icon: Cog },
      { to: "/guia", key: "guia", label: "Guía", icon: BookOpen },
    ],
  },
];

export function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [alertasOpen, setAlertasOpen] = useState(false);
  const { can } = useAuth();
  const biz = useBusinessInfo();

  const visibles = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => can(it.key)) }))
    .filter((s) => s.items.length > 0);

  const content = (
    <nav className="h-full flex flex-col py-4 px-3">
      <div className="flex-1 overflow-y-auto space-y-5">
      <div className="flex items-center gap-2 px-2 mb-2">
        <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center text-primary-foreground overflow-hidden">
          {biz.logo ? (
            <img src={biz.logo} alt="logo" className="h-full w-full object-cover" />
          ) : (
            <Store className="h-5 w-5" />
          )}
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-extrabold text-sidebar-foreground truncate max-w-[140px]">
              {biz.nombre}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              POS Perú
            </div>
          </div>
        )}
      </div>

      {visibles.map((sec) => (
        <div key={sec.title}>
          {!collapsed && (
            <div
              className={cn(
                "px-2 mb-1 text-[10px] uppercase tracking-wider font-bold",
                sec.color,
              )}
            >
              {sec.title}
            </div>
          )}
          <div className="space-y-1">
            {sec.items.map((it) => {
              const active =
                pathname === it.to ||
                (it.to !== "/dashboard" && pathname.startsWith(it.to));
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={onCloseMobile}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  title={collapsed ? it.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      </div>
      <div className="pt-3 mt-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => setAlertasOpen(true)}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
            "text-rose-500 hover:bg-rose-50 font-bold"
          )}
          title={collapsed ? "Alertas Críticas" : undefined}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">Alertas Críticas</span>}
        </button>
        <AlertasPanel open={alertasOpen} onClose={() => setAlertasOpen(false)} />
        <LicenseWidget collapsed={collapsed} />
        <StorageWidget collapsed={collapsed} />
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:block bg-sidebar border-r border-sidebar-border shrink-0 transition-all",
          collapsed ? "w-14" : "w-52",
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <button
              className="absolute top-3 right-3 text-sidebar-foreground/70"
              onClick={onCloseMobile}
            >
              <X className="h-5 w-5" />
            </button>
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

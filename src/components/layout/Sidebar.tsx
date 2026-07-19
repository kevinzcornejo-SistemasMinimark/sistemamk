import { Link, useRouterState } from "@tanstack/react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  to: string;
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
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pos", label: "Punto de Venta", icon: ShoppingCart },
    ],
  },
  {
    title: "Inventario",
    color: "text-emerald-400",
    items: [
      { to: "/productos", label: "Productos", icon: Package },
      { to: "/categorias", label: "Categorías", icon: Tags },
      { to: "/combos", label: "Combos", icon: Layers },
      { to: "/inventario", label: "Inventario", icon: Warehouse },
      { to: "/lotes", label: "Lotes", icon: CalendarClock },
      { to: "/kardex", label: "Kardex", icon: ClipboardList },
      { to: "/etiquetas", label: "Etiquetas", icon: Printer },
    ],
  },
  {
    title: "Compras",
    color: "text-amber-400",
    items: [
      { to: "/compras", label: "Compras", icon: Boxes },
      { to: "/proveedores", label: "Proveedores", icon: Truck },
    ],
  },
  {
    title: "Clientes",
    color: "text-sky-400",
    items: [{ to: "/clientes", label: "Clientes", icon: Users }],
  },
  {
    title: "Caja",
    color: "text-rose-400",
    items: [
      { to: "/caja", label: "Caja", icon: Wallet },
      { to: "/gastos", label: "Gastos", icon: Receipt },
      { to: "/tickets", label: "Tickets", icon: ClipboardList },
    ],
  },
  {
    title: "Reportes",
    color: "text-violet-400",
    items: [{ to: "/reportes", label: "Reportes", icon: BarChart3 }],
  },
  {
    title: "Sistema",
    color: "text-fuchsia-400",
    items: [
      { to: "/usuarios", label: "Usuarios", icon: UserCog },
      { to: "/ajustes", label: "Ajustes", icon: Settings },
      { to: "/configuracion", label: "Configuración", icon: Cog },
      { to: "/guia", label: "Guía", icon: BookOpen },
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

  const content = (
    <nav className="h-full overflow-y-auto py-4 px-3 space-y-5">
      <div className="flex items-center gap-2 px-2 mb-2">
        <div className="h-9 w-9 rounded-xl bg-primary grid place-items-center text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-extrabold text-sidebar-foreground">Minimarket</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              POS Perú
            </div>
          </div>
        )}
      </div>

      {sections.map((sec) => (
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
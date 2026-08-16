import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "administrador"
  | "gerente"
  | "cajero"
  | "almacenero"
  | "vendedor"
  | "contador"
  | "supervisor";

export const ADMIN_MAESTRO_EMAIL = "kevincoorporativa@gmail.com";

export const MODULOS: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "pos", label: "Punto de Venta" },
  { key: "productos", label: "Productos" },
  { key: "categorias", label: "Categorías" },
  { key: "combos", label: "Combos" },
  { key: "inventario", label: "Inventario" },
  { key: "lotes", label: "Lotes" },
  { key: "kardex", label: "Kardex" },
  { key: "etiquetas", label: "Etiquetas" },
  { key: "compras", label: "Compras" },
  { key: "proveedores", label: "Proveedores" },
  { key: "clientes", label: "Clientes" },
  { key: "caja", label: "Caja" },
  { key: "gastos", label: "Gastos" },
  { key: "tickets", label: "Tickets" },
  { key: "reportes", label: "Reportes" },
  { key: "reportes2", label: "Reportes Comparativo" },
  { key: "descuentos", label: "Descuentos" },
  { key: "usuarios", label: "Usuarios" },
  { key: "ajustes", label: "Ajustes" },
  { key: "configuracion", label: "Configuración" },
  { key: "guia", label: "Guía" },
];

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { nombre: string | null; correo: string | null } | null;
  permisos: string[];
  isAdmin: boolean;
  isAdminMaestro: boolean;
  isDemo: boolean;
  loading: boolean;
  can: (modulo: string) => boolean;
  refreshPermisos: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ nombre: string | null; correo: string | null } | null>(null);
  const [permisos, setPermisos] = useState<string[]>([]);
  const [isDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndPerms = useCallback(async (u: User) => {
    const esAdminMaestro = (u.email ?? "").toLowerCase() === ADMIN_MAESTRO_EMAIL;
    try {
      const [{ data: r }, { data: prof }] = await Promise.all([
        supabase
          .from("roles_usuario")
          .select("rol")
          .eq("usuario_id", u.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("perfiles")
          .select("nombre, correo")
          .eq("id", u.id)
          .maybeSingle()
      ]);
      setRole(((r?.rol as AppRole) ?? (esAdminMaestro ? "administrador" : "cajero")));
      setProfile(prof || { nombre: u.email?.split('@')[0] || null, correo: u.email || null });

      const { data: p } = await supabase
        .from("permisos_usuario")
        .select("modulo")
        .eq("usuario_id", u.id);
      const lista = (p ?? []).map((x: any) => x.modulo);
      if (esAdminMaestro) {
        setPermisos(MODULOS.map((m) => m.key));
      } else {
        setPermisos(lista);
      }
    } catch {
      setRole(esAdminMaestro ? "administrador" : "cajero");
      setPermisos(esAdminMaestro ? MODULOS.map((m) => m.key) : []);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchRoleAndPerms(sess.user), 0);
      } else {
        setRole(null);
        setProfile(null);
        setPermisos([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchRoleAndPerms(data.session.user);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [fetchRoleAndPerms]);

  const refreshPermisos = useCallback(async () => {
    if (user) await fetchRoleAndPerms(user);
  }, [user, fetchRoleAndPerms]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setProfile(null);
    setPermisos([]);
  };

  const isAdminMaestro =
    (user?.email ?? "").toLowerCase() === ADMIN_MAESTRO_EMAIL;
  const isAdmin = role === "administrador" || isDemo || isAdminMaestro;

  const can = (modulo: string) => {
    if (isDemo || isAdminMaestro) return true;
    if (isAdmin) return true;
    return permisos.includes(modulo);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        profile,
        permisos,
        isAdmin,
        isAdminMaestro,
        isDemo,
        loading,
        can,
        refreshPermisos,
        signIn,
        
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

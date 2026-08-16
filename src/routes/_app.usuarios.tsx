import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCog,
  Plus,
  Shield,
  Trash2,
  Pencil,
  Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseSignup } from "@/integrations/supabase/signupClient";
import { updateUserPassword } from "@/lib/usuarios.functions";
import {
  useAuth,
  MODULOS,
  ADMIN_MAESTRO_EMAIL,
  type AppRole,
} from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios — POS Minimarket" }] }),
  component: UsuariosPage,
});

const ROLES: AppRole[] = [
  "administrador",
  "gerente",
  "supervisor",
  "cajero",
  "almacenero",
  "vendedor",
  "contador",
];

type UsuarioRow = {
  usuario_id: string;
  correo: string | null;
  nombre: string | null;
  rol: string | null;
  permisos: string[];
  creado_en: string | null;
};

function UsuariosPage() {
  const { isAdmin, isAdminMaestro, user, isDemo, refreshPermisos } = useAuth();
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<UsuarioRow | null>(null);

  // Formulario nuevo usuario
  const [nEmail, setNEmail] = useState("");
  const [nPass, setNPass] = useState("");
  const [nNombre, setNNombre] = useState("");
  const [nRol, setNRol] = useState<AppRole>("vendedor");
  const [nModulos, setNModulos] = useState<string[]>([
    "pos",
    "productos",
  ]);
  const [saving, setSaving] = useState(false);

  // Formulario editar
  const [eNombre, setENombre] = useState("");
  const [eRol, setERol] = useState<AppRole>("cajero");
  const [eModulos, setEModulos] = useState<string[]>([]);
  const [ePass, setEPass] = useState("");
  const [verPass, setVerPass] = useState(false);

  const puedeGestionar = isAdmin;

  const cargar = async () => {
    setLoading(true);
    // Base: perfiles (así aparecen todos, incluso sin rol asignado)
    const { data: perfiles, error: ePerf } = await supabase
      .from("perfiles")
      .select("id,nombre,correo,creado_en")
      .order("creado_en", { ascending: false });
    if (ePerf) {
      console.error("[usuarios] perfiles:", ePerf);
      toast.error("Perfiles: " + ePerf.message);
    }

    const ids = (perfiles ?? []).map((p: any) => p.id);
    let rolesMap: Record<string, string> = {};
    let permisosMap: Record<string, string[]> = {};

    if (ids.length) {
      const { data: roles, error: eRoles } = await supabase
        .from("roles_usuario")
        .select("usuario_id,rol")
        .in("usuario_id", ids);
      if (eRoles) {
        console.error("[usuarios] roles:", eRoles);
        toast.error("Roles: " + eRoles.message);
      }
      (roles ?? []).forEach((r: any) => (rolesMap[r.usuario_id] = r.rol));

      const { data: perms, error: ePerms } = await supabase
        .from("permisos_usuario")
        .select("usuario_id,modulo")
        .in("usuario_id", ids);
      if (ePerms) {
        console.error("[usuarios] permisos:", ePerms);
        toast.error("Permisos: " + ePerms.message);
      }
      (perms ?? []).forEach((x: any) => {
        permisosMap[x.usuario_id] = permisosMap[x.usuario_id] || [];
        permisosMap[x.usuario_id].push(x.modulo);
      });
    }

    setRows(
      (perfiles ?? []).map((p: any) => ({
        usuario_id: p.id,
        rol: rolesMap[p.id] ?? null,
        creado_en: p.creado_en,
        correo: p.correo,
        nombre: p.nombre,
        permisos: permisosMap[p.id] ?? [],
      })),
    );
    setLoading(false);
  };


  useEffect(() => {
    if (isDemo) {
      setRows([]);
      setLoading(false);
      return;
    }
    cargar();
  }, [isDemo]);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const resetNuevo = () => {
    setNEmail("");
    setNPass("");
    setNNombre("");
    setNRol("vendedor");
    setNModulos(["pos", "productos"]);
  };

  const crearUsuario = async () => {
    if (!nEmail || !nPass) {
      toast.error("Correo y contraseña son obligatorios");
      return;
    }
    if (nPass.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (nEmail.toLowerCase() === ADMIN_MAESTRO_EMAIL) {
      toast.error("Ese correo está reservado para el administrador maestro");
      return;
    }
    setSaving(true);
    try {
      // Usar cliente sin persistencia para no reemplazar la sesión del admin
      // Nota: Si el registro requiere confirmación de email en Supabase, 
      // el usuario aparecerá como no confirmado hasta que se cambie el ajuste en el Dashboard.
      const { data, error } = await supabaseSignup.auth.signUp({
        email: nEmail,
        password: nPass,
        options: {
          data: { 
            nombre: nNombre,
            email_confirmed: true // Intentar forzar confirmación si la política lo permite
          },
        },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("No se pudo obtener el ID del usuario");

      // Perfil
      const { error: e1 } = await supabase
        .from("perfiles")
        .upsert({ id: uid, correo: nEmail, nombre: nNombre || nEmail.split("@")[0] });
      if (e1) throw new Error("Perfil: " + e1.message);

      // Rol
      await supabase.from("roles_usuario").delete().eq("usuario_id", uid);
      const { error: e2 } = await supabase
        .from("roles_usuario")
        .insert({ usuario_id: uid, rol: nRol });
      if (e2) throw new Error("Rol: " + e2.message);

      // Permisos
      await supabase.from("permisos_usuario").delete().eq("usuario_id", uid);
      if (nModulos.length) {
        const { error: e3 } = await supabase.from("permisos_usuario").insert(
          nModulos.map((m) => ({ usuario_id: uid, modulo: m })),
        );
        if (e3) throw new Error("Permisos: " + e3.message);
      }

      toast.success("Usuario creado. Ya puede ingresar con su correo y contraseña.");
      resetNuevo();
      setOpenNew(false);
      await cargar();
    } catch (e: any) {
      console.error("[crearUsuario]", e);
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };


  const abrirEditar = (r: UsuarioRow) => {
    setENombre(r.nombre || "");
    setERol((r.rol as AppRole) ?? "cajero");
    setEModulos(r.permisos ?? []);
    setEPass("");
    setVerPass(false);
    setOpenEdit(r);
  };

  const guardarEditar = async () => {
    if (!openEdit) return;
    if (openEdit.correo?.toLowerCase() === ADMIN_MAESTRO_EMAIL) {
      toast.error("No se puede modificar al administrador maestro");
      return;
    }
    setSaving(true);
    try {
      // 1. Actualizar Perfil (Nombre)
      await supabase
        .from("perfiles")
        .update({ nombre: eNombre })
        .eq("id", openEdit.usuario_id);

      // 2. Actualizar Password (si se ingresó algo)
      if (ePass.trim()) {
        if (ePass.length < 6) throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
        await updateUserPassword({ data: { usuario_id: openEdit.usuario_id, password: ePass } });
      }

      // 3. Roles
      await supabase
        .from("roles_usuario")
        .delete()
        .eq("usuario_id", openEdit.usuario_id);
      await supabase
        .from("roles_usuario")
        .insert({ usuario_id: openEdit.usuario_id, rol: eRol });

      // 4. Permisos
      await supabase
        .from("permisos_usuario")
        .delete()
        .eq("usuario_id", openEdit.usuario_id);
      if (eModulos.length) {
        await supabase
          .from("permisos_usuario")
          .insert(eModulos.map((m) => ({ usuario_id: openEdit.usuario_id, modulo: m })));
      }
      toast.success("Cambios guardados");
      setOpenEdit(null);
      await cargar();
      if (user?.id === openEdit.usuario_id) await refreshPermisos();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const quitarAcceso = async (r: UsuarioRow) => {
    if (r.correo?.toLowerCase() === ADMIN_MAESTRO_EMAIL) {
      toast.error("No se puede quitar acceso al administrador maestro");
      return;
    }
    if (!confirm(`¿Quitar todos los accesos a ${r.correo}?`)) return;
    try {
      await supabase.from("permisos_usuario").delete().eq("usuario_id", r.usuario_id);
      await supabase.from("roles_usuario").delete().eq("usuario_id", r.usuario_id);
      toast.success("Accesos removidos");
      await cargar();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    }
  };

  const esAdminMaestroLogin = (user?.email ?? "").toLowerCase() === ADMIN_MAESTRO_EMAIL;

  if (!puedeGestionar) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center space-y-3">
          <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-bold">Solo administradores</h2>
          <p className="text-sm text-muted-foreground">
            Esta sección es exclusiva para el administrador ({ADMIN_MAESTRO_EMAIL}).
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Usuarios y permisos
          </h1>
          <p className="text-muted-foreground">
            Crea cuentas para los vendedores (<b>Carlos, Sonia, Carmen, Luisa, Soledad</b>). Usa correos ficticios como <b>nombre@lacoop.com</b> y asegúrate de desactivar "Confirm Email" en Supabase Auth.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={cargar}>
            Refrescar
          </Button>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo usuario
          </Button>
        </div>
      </div>




      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase">
            <tr>
              <th className="px-4 py-2">Correo</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Módulos</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Sin usuarios registrados
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const esMaestro = r.correo?.toLowerCase() === ADMIN_MAESTRO_EMAIL;
                return (
                  <tr key={r.usuario_id} className="border-t align-top">
                    <td className="px-4 py-2 font-medium">
                      {r.correo ?? r.usuario_id.slice(0, 8)}
                      {esMaestro && (
                        <Badge className="ml-2 bg-primary text-primary-foreground">
                          <Shield className="h-3 w-3 mr-1" /> Admin maestro
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">{r.nombre ?? "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary">{r.rol ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1 max-w-[420px]">
                        {esMaestro ? (
                          <Badge variant="outline">Todos</Badge>
                        ) : r.permisos.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin accesos</span>
                        ) : (
                          r.permisos.map((m) => (
                            <Badge key={m} variant="outline" className="text-[10px]">
                              {MODULOS.find((x) => x.key === m)?.label ?? m}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={esMaestro && !esAdminMaestroLogin}
                          onClick={() => abrirEditar(r)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={esMaestro}
                          onClick={() => quitarAcceso(r)}
                          title="Quitar acceso"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Nuevo usuario */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Correo *</Label>
              <Input
                type="email"
                value={nEmail}
                onChange={(e) => {
                  const val = e.target.value;
                  setNEmail(val);
                  // Si el nombre está vacío, sugerir uno basado en el correo
                  if (!nNombre && val.includes("@")) {
                    const sugerencia = val.split("@")[0];
                    setNNombre(sugerencia.charAt(0).toUpperCase() + sugerencia.slice(1));
                  }
                }}
                placeholder="vendedor@lacoop.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña *</Label>
              <Input
                type="text"
                value={nPass}
                onChange={(e) => setNPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={nNombre} onChange={(e) => setNNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={nRol} onValueChange={(v) => setNRol(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Módulos con acceso</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNModulos(MODULOS.map((m) => m.key))}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNModulos([])}
                >
                  Ninguno
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto p-2 border rounded-md">
              {MODULOS.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={nModulos.includes(m.key)}
                    onCheckedChange={() => setNModulos((l) => toggle(l, m.key))}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>
              Cancelar
            </Button>
            <Button onClick={crearUsuario} disabled={saving}>
              {saving ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar */}
      <Dialog open={!!openEdit} onOpenChange={(o) => !o && setOpenEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar accesos — {openEdit?.correo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre completo</Label>
                <Input value={eNombre} onChange={(e) => setENombre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={eRol} onValueChange={(v) => setERol(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 border rounded-md bg-muted/20 space-y-2">
              <Label className="text-primary font-bold flex items-center gap-2">
                <Lock className="h-4 w-4" /> Cambiar Contraseña (Opcional)
              </Label>
              <div className="relative">
                <Input
                  type={verPass ? "text" : "password"}
                  placeholder="Nueva contraseña (dejar vacío para no cambiar)"
                  value={ePass}
                  onChange={(e) => setEPass(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setVerPass(!verPass)}
                >
                  {verPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Si el usuario olvidó su contraseña, puedes establecer una nueva aquí.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Módulos con acceso</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEModulos(MODULOS.map((m) => m.key))}
                  >
                    Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEModulos([])}
                  >
                    Ninguno
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-auto p-2 border rounded-md">
                {MODULOS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={eModulos.includes(m.key)}
                      onCheckedChange={() => setEModulos((l) => toggle(l, m.key))}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarEditar} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

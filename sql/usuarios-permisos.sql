-- ============================================================
-- Gestión de usuarios y permisos por módulo
-- Admin único: kevincoorporativa@gmail.com
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 0) Quitar triggers de protección antes de reparar/re-ejecutar el script
DO $$
BEGIN
  IF to_regclass('public.roles_usuario') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_protege_admin_roles ON public.roles_usuario;
  END IF;
  IF to_regclass('public.permisos_usuario') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS tr_protege_admin_permisos ON public.permisos_usuario;
  END IF;
END $$;

-- 1) Tabla perfiles (por si no existe)
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text,
  correo text,
  creado_en timestamptz NOT NULL DEFAULT now()
);
-- Si la tabla ya existía con otra estructura, agregar las columnas que usa el sistema
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nombre text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS correo text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS creado_en timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT, UPDATE ON public.perfiles TO authenticated;
GRANT ALL ON public.perfiles TO service_role;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perfiles_all ON public.perfiles;
CREATE POLICY perfiles_all ON public.perfiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Tabla roles_usuario
CREATE TABLE IF NOT EXISTS public.roles_usuario (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'cajero',
  creado_en timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles_usuario TO authenticated;
GRANT ALL ON public.roles_usuario TO service_role;
ALTER TABLE public.roles_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_usuario_all ON public.roles_usuario;
CREATE POLICY roles_usuario_all ON public.roles_usuario
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) Tabla de permisos por módulo
CREATE TABLE IF NOT EXISTS public.permisos_usuario (
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, modulo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permisos_usuario TO authenticated;
GRANT ALL ON public.permisos_usuario TO service_role;
ALTER TABLE public.permisos_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permisos_usuario_all ON public.permisos_usuario;
CREATE POLICY permisos_usuario_all ON public.permisos_usuario
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Trigger: al crearse un usuario en auth.users, crear perfil y asignar rol.
--    kevincoorporativa@gmail.com => administrador con todos los módulos.
--    Cualquier otro => cajero sin módulos (el admin asigna después).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  es_admin boolean;
  m text;
  modulos text[] := ARRAY[
    'dashboard','pos','productos','categorias','combos','inventario','lotes',
    'kardex','etiquetas','compras','proveedores','clientes','caja','gastos',
    'tickets','reportes','usuarios','ajustes','configuracion','guia'
  ];
BEGIN
  es_admin := lower(NEW.email) = 'kevincoorporativa@gmail.com';

  INSERT INTO public.perfiles (id, nombre, correo)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), NEW.email)
  ON CONFLICT (id) DO UPDATE SET correo = EXCLUDED.correo;

  INSERT INTO public.roles_usuario (usuario_id, rol)
  VALUES (NEW.id, CASE WHEN es_admin THEN 'administrador' ELSE 'cajero' END)
  ON CONFLICT DO NOTHING;

  IF es_admin THEN
    FOREACH m IN ARRAY modulos LOOP
      INSERT INTO public.permisos_usuario (usuario_id, modulo)
      VALUES (NEW.id, m)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5) Reforzar admin y permisos para usuarios ya existentes
DO $$
DECLARE
  u record;
  m text;
  modulos text[] := ARRAY[
    'dashboard','pos','productos','categorias','combos','inventario','lotes',
    'kardex','etiquetas','compras','proveedores','clientes','caja','gastos',
    'tickets','reportes','usuarios','ajustes','configuracion','guia'
  ];
BEGIN
  FOR u IN SELECT id, email FROM auth.users LOOP
    INSERT INTO public.perfiles (id, nombre, correo)
    VALUES (u.id, split_part(u.email, '@', 1), u.email)
    ON CONFLICT (id) DO UPDATE SET correo = EXCLUDED.correo;

    IF lower(u.email) = 'kevincoorporativa@gmail.com' THEN
      DELETE FROM public.roles_usuario WHERE usuario_id = u.id;
      INSERT INTO public.roles_usuario (usuario_id, rol) VALUES (u.id, 'administrador');
      FOREACH m IN ARRAY modulos LOOP
        INSERT INTO public.permisos_usuario (usuario_id, modulo)
        VALUES (u.id, m)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 6) Proteger al admin único: no permitir cambiarle rol ni quitarle permisos.
CREATE OR REPLACE FUNCTION public.protege_admin_maestro()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  correo text;
BEGIN
  SELECT email INTO correo FROM auth.users WHERE id = COALESCE(OLD.usuario_id, NEW.usuario_id);
  IF lower(correo) = 'kevincoorporativa@gmail.com' THEN
    RAISE EXCEPTION 'No se puede modificar los permisos/rol del administrador maestro';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tr_protege_admin_roles ON public.roles_usuario;
CREATE TRIGGER tr_protege_admin_roles
  BEFORE UPDATE OR DELETE ON public.roles_usuario
  FOR EACH ROW EXECUTE FUNCTION public.protege_admin_maestro();

DROP TRIGGER IF EXISTS tr_protege_admin_permisos ON public.permisos_usuario;
CREATE TRIGGER tr_protege_admin_permisos
  BEFORE DELETE ON public.permisos_usuario
  FOR EACH ROW EXECUTE FUNCTION public.protege_admin_maestro();

NOTIFY pgrst, 'reload schema';

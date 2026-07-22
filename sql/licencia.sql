-- ==========================================================
-- LICENCIA DEL SISTEMA - Minimarket POS
-- Ejecutar en Supabase SQL Editor
-- ==========================================================

-- 1) Tabla de licencia
CREATE TABLE IF NOT EXISTS public.licencia (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           text NOT NULL DEFAULT 'demo',      -- demo | 30d | 60d | 90d | 1a | 5a | 10a | custom
  estado         text NOT NULL DEFAULT 'activa',    -- activa | vencida | suspendida
  duracion_dias  integer NOT NULL DEFAULT 30,
  fecha_inicio   date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  clave          text,
  notas          text,
  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

-- Compatibilidad si ya existía
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS duracion_dias integer;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS fecha_inicio date;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS clave text;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS creada_en timestamptz DEFAULT now();
ALTER TABLE public.licencia ADD COLUMN IF NOT EXISTS actualizada_en timestamptz DEFAULT now();

-- 2) Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licencia TO authenticated;
GRANT ALL ON public.licencia TO service_role;

-- 3) RLS: cualquier usuario autenticado puede leer/gestionar (o restringe a admin si prefieres)
ALTER TABLE public.licencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS licencia_todos ON public.licencia;
CREATE POLICY licencia_todos ON public.licencia
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Trigger para actualizar 'actualizada_en'
CREATE OR REPLACE FUNCTION public.trg_licencia_upd()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizada_en := now();
  -- Recalcular estado según fecha
  IF NEW.fecha_vencimiento < CURRENT_DATE THEN
    NEW.estado := 'vencida';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tr_licencia_upd ON public.licencia;
CREATE TRIGGER tr_licencia_upd BEFORE UPDATE ON public.licencia
FOR EACH ROW EXECUTE FUNCTION public.trg_licencia_upd();

-- 5) Semilla: crear una licencia inicial de 30 días si no existe
INSERT INTO public.licencia (tipo, estado, duracion_dias, fecha_inicio, fecha_vencimiento, notas)
SELECT 'demo', 'activa', 30, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 'Licencia inicial de prueba'
WHERE NOT EXISTS (SELECT 1 FROM public.licencia);

NOTIFY pgrst, 'reload schema';

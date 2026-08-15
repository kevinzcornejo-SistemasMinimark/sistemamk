-- Crear tabla de configuración de alertas si no existe
CREATE TABLE IF NOT EXISTS public.configuracion_alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sucursal_id UUID,
    dias_advertencia INTEGER DEFAULT 15,
    dias_critico INTEGER DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(usuario_id)
);

-- Habilitar RLS
ALTER TABLE public.configuracion_alertas ENABLE ROW LEVEL SECURITY;

-- Permisos
GRANT SELECT, INSERT, UPDATE ON public.configuracion_alertas TO authenticated;
GRANT ALL ON public.configuracion_alertas TO service_role;

-- Políticas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'config_alertas_select') THEN
        CREATE POLICY config_alertas_select ON public.configuracion_alertas FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'config_alertas_insert') THEN
        CREATE POLICY config_alertas_insert ON public.configuracion_alertas FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'config_alertas_update') THEN
        CREATE POLICY config_alertas_update ON public.configuracion_alertas FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
    END IF;
END $$;

-- Asegurar columnas en productos si no existen (proveedor_id y ubicacion son comunes pero pueden faltar)
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS proveedor_id UUID;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS ubicacion TEXT;

-- Crear tabla proveedores si no existe para el filtro
CREATE TABLE IF NOT EXISTS public.proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    contacto TEXT,
    telefono TEXT,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT ON public.proveedores TO authenticated;
GRANT ALL ON public.proveedores TO service_role;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'proveedores_select_public') THEN
        CREATE POLICY proveedores_select_public ON public.proveedores FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

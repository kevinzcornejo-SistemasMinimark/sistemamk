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

GRANT SELECT, INSERT, UPDATE ON public.configuracion_alertas TO authenticated;
GRANT ALL ON public.configuracion_alertas TO service_role;

ALTER TABLE public.configuracion_alertas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Los usuarios pueden ver su propia configuración') THEN
        CREATE POLICY "Los usuarios pueden ver su propia configuración"
        ON public.configuracion_alertas FOR SELECT
        TO authenticated
        USING (auth.uid() = usuario_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Los usuarios pueden insertar su propia configuración') THEN
        CREATE POLICY "Los usuarios pueden insertar su propia configuración"
        ON public.configuracion_alertas FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = usuario_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Los usuarios pueden actualizar su propia configuración') THEN
        CREATE POLICY "Los usuarios pueden actualizar su propia configuración"
        ON public.configuracion_alertas FOR UPDATE
        TO authenticated
        USING (auth.uid() = usuario_id);
    END IF;
END $$;

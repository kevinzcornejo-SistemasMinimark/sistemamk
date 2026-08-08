-- SQL para asegurar que la columna de descuento existe y es accesible
-- Ejecutar en el Editor SQL de Supabase

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ventas' AND column_name = 'descuento') THEN
        ALTER TABLE public.ventas ADD COLUMN descuento NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

-- Otorgar permisos si es necesario
GRANT SELECT, INSERT, UPDATE ON public.ventas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ventas TO service_role;

-- Comprobar si existe la tabla de auditoría de descuentos
CREATE TABLE IF NOT EXISTS public.descuentos_auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en TIMESTAMPTZ DEFAULT now(),
    venta_id UUID REFERENCES public.ventas(id),
    usuario_id UUID,
    tipo TEXT, -- 'porcentaje', 'monto'
    aplicado_a TEXT, -- 'total', 'producto'
    producto_id UUID,
    valor NUMERIC(10,2),
    monto_descuento NUMERIC(10,2),
    motivo TEXT,
    motivo_texto TEXT,
    autorizado_por TEXT
);

-- Permisos para la tabla de auditoría
GRANT ALL ON public.descuentos_auditoria TO authenticated;
GRANT ALL ON public.descuentos_auditoria TO service_role;
GRANT SELECT ON public.descuentos_auditoria TO anon;

-- Habilitar RLS
ALTER TABLE public.descuentos_auditoria ENABLE ROW LEVEL SECURITY;

-- Política para que usuarios autenticados puedan ver y crear
CREATE POLICY "Permitir todo a autenticados en auditoria" ON public.descuentos_auditoria
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Asegurar que la tabla de auditoría de descuentos existe y tiene los permisos correctos
CREATE TABLE IF NOT EXISTS public.descuentos_auditoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en timestamptz DEFAULT now(),
    venta_id uuid REFERENCES public.ventas(id) ON DELETE CASCADE,
    producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
    usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo text NOT NULL CHECK (tipo IN ('porcentaje', 'monto')),
    aplicado_a text NOT NULL CHECK (aplicado_a IN ('total', 'item')),
    valor numeric(12,2) NOT NULL,
    monto_descuento numeric(12,2) NOT NULL,
    motivo text NOT NULL,
    motivo_texto text,
    autorizado_por text
);

-- Habilitar RLS
ALTER TABLE public.descuentos_auditoria ENABLE ROW LEVEL SECURITY;

-- Permisos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.descuentos_auditoria TO authenticated;
GRANT ALL ON public.descuentos_auditoria TO service_role;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir lectura a usuarios autenticados' AND tablename = 'descuentos_auditoria') THEN
        CREATE POLICY "Permitir lectura a usuarios autenticados" ON public.descuentos_auditoria FOR SELECT TO authenticated USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir inserción a usuarios autenticados' AND tablename = 'descuentos_auditoria') THEN
        CREATE POLICY "Permitir inserción a usuarios autenticados" ON public.descuentos_auditoria FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
END $$;

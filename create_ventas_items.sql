-- 1. Crear la tabla ventas_items si no existe
CREATE TABLE IF NOT EXISTS public.ventas_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id uuid REFERENCES public.ventas(id) ON DELETE CASCADE NOT NULL,
    producto_id uuid REFERENCES public.productos(id) NOT NULL,
    cantidad numeric(12,2) NOT NULL DEFAULT 0,
    precio_unitario numeric(12,2) NOT NULL DEFAULT 0,
    descuento numeric(12,2) NOT NULL DEFAULT 0,
    total numeric(12,2) NOT NULL DEFAULT 0,
    creada_en timestamptz DEFAULT now()
);

-- 2. Otorgar permisos (Indispensable para que la API funcione)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas_items TO authenticated;
GRANT ALL ON public.ventas_items TO service_role;
GRANT SELECT ON public.ventas_items TO anon;

-- 3. Habilitar RLS
ALTER TABLE public.ventas_items ENABLE ROW LEVEL SECURITY;

-- 4. Crear política básica para que usuarios autenticados puedan ver los datos
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.ventas_items FOR SELECT 
TO authenticated 
USING (true);

-- 5. Crear política básica para insertar (necesario para el POS)
CREATE POLICY "Permitir inserción a usuarios autenticados" 
ON public.ventas_items FOR INSERT 
TO authenticated 
WITH CHECK (true);

COMMENT ON TABLE public.ventas_items IS 'Detalle de productos por cada venta';

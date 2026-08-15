-- Asegurar que la tabla y sus relaciones existan y sean visibles
ALTER TABLE IF EXISTS public.ventas_items ENABLE ROW LEVEL SECURITY;

-- Refrescar permisos para el rol autenticado
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas_items TO authenticated;
GRANT ALL ON public.ventas_items TO service_role;
GRANT SELECT ON public.ventas_items TO anon;

-- Forzar refresco de caché con un comentario estático (evita error de sintaxis ||)
COMMENT ON TABLE public.ventas_items IS 'Tabla de detalles de venta - Actualizada para refresco de cache';

-- Regenerate relationships and permissions for ventas_items
DO $$ 
BEGIN
    -- Check if foreign key to ventas exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_items_venta_id_fkey' 
        AND table_name = 'ventas_items'
    ) THEN
        ALTER TABLE public.ventas_items 
        ADD CONSTRAINT ventas_items_venta_id_fkey 
        FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE CASCADE;
    END IF;

    -- Check if foreign key to productos exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_items_producto_id_fkey' 
        AND table_name = 'ventas_items'
    ) THEN
        ALTER TABLE public.ventas_items 
        ADD CONSTRAINT ventas_items_producto_id_fkey 
        FOREIGN KEY (producto_id) REFERENCES public.productos(id);
    END IF;
END $$;

-- Ensure proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas_items TO authenticated;
GRANT ALL ON public.ventas_items TO service_role;
GRANT SELECT ON public.ventas_items TO anon;

-- Force a schema cache refresh by adding and removing a dummy column if possible, 
-- but a simple NOTIFY is often enough for PostgREST if configured, 
-- or just waiting a few seconds after DDL.
COMMENT ON TABLE public.ventas_items IS 'Detalle de los productos vendidos en cada comprobante';


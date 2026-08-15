-- Ensure foreign key exists from ventas_items to ventas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_items_venta_id_fkey'
    ) THEN
        ALTER TABLE public.ventas_items 
        ADD CONSTRAINT ventas_items_venta_id_fkey 
        FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Ensure foreign key exists from ventas_items to productos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_items_producto_id_fkey'
    ) THEN
        ALTER TABLE public.ventas_items 
        ADD CONSTRAINT ventas_items_producto_id_fkey 
        FOREIGN KEY (producto_id) REFERENCES public.productos(id);
    END IF;
END
$$;

-- Ensure foreign key exists from ventas to clientes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_cliente_id_fkey'
    ) THEN
        ALTER TABLE public.ventas 
        ADD CONSTRAINT ventas_cliente_id_fkey 
        FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
    END IF;
END
$$;

-- Ensure foreign key exists from ventas to auth.users (cajero_id)
-- Note: Cajero_id often refers to profiles table which refers to auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ventas_cajero_id_fkey'
    ) THEN
        ALTER TABLE public.ventas 
        ADD CONSTRAINT ventas_cajero_id_fkey 
        FOREIGN KEY (cajero_id) REFERENCES public.profiles(id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Table profiles might not exist or column names might differ
    NULL;
END
$$;

-- Re-grant permissions to ensure Data API can see relationships
GRANT ALL ON public.ventas TO authenticated, service_role;
GRANT ALL ON public.ventas_items TO authenticated, service_role;
GRANT ALL ON public.productos TO authenticated, service_role;
GRANT ALL ON public.clientes TO authenticated, service_role;

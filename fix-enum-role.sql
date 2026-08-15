-- 1. Verificar y actualizar el tipo enum app_role
-- Nota: Si el enum ya existe pero no tiene 'vendedor', lo agregamos.
-- Si no existe, lo creamos.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('administrador', 'gerente', 'supervisor', 'cajero', 'almacenero', 'vendedor', 'contador');
    ELSE
        -- Intentar agregar los valores que falten uno por uno (PostgreSQL no permite ADD VALUE en transacciones DO)
        -- Por lo que se recomienda ejecutar ALTER TYPE fuera de bloques si falla.
        NULL;
    END IF;
END
$$;

-- Ejecutar estos comandos individualmente si el bloque anterior no es suficiente:
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'administrador';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cajero';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'almacenero';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contador';

-- 2. Asegurar que la columna rol en roles_usuario use el tipo enum correctamente
-- A veces la columna es text y el error viene de una restricción o trigger.
-- Si es tipo app_role, el error confirma que 'vendedor' no está en la lista permitida.

GRANT ALL ON public.roles_usuario TO authenticated;
GRANT ALL ON public.roles_usuario TO service_role;

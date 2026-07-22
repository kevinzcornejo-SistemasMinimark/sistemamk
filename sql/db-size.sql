-- ==========================================================
-- Función para consultar el tamaño de la base de datos
-- Ejecutar en Supabase SQL Editor
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS TABLE (
  total_bytes    bigint,
  total_pretty   text,
  tablas_bytes   bigint,
  tablas_pretty  text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pg_database_size(current_database())                                    AS total_bytes,
    pg_size_pretty(pg_database_size(current_database()))                    AS total_pretty,
    COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0)::bigint AS tablas_bytes,
    pg_size_pretty(COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))), 0)::bigint) AS tablas_pretty
  FROM pg_tables
  WHERE schemaname = 'public';
$$;

GRANT EXECUTE ON FUNCTION public.get_db_size() TO authenticated;

-- Detalle por tabla (opcional)
CREATE OR REPLACE FUNCTION public.get_db_tables_size()
RETURNS TABLE (
  tabla        text,
  filas        bigint,
  bytes        bigint,
  tamano       text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.tablename::text                                                                AS tabla,
    COALESCE(c.reltuples, 0)::bigint                                                 AS filas,
    pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::bigint AS bytes,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))) AS tamano
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename)) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_db_tables_size() TO authenticated;

NOTIFY pgrst, 'reload schema';

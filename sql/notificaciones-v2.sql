-- Añadir columna de gestión a la auditoría de notificaciones si no existe
-- Nota: Como las notificaciones son dinámicas desde tablas base, la trazabilidad se basa en el estado del registro original.
-- Pero para tener un log de "resuelto", creamos una tabla dedicada si no existe.

CREATE TABLE IF NOT EXISTS public.notificaciones_gestion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notificacion_id TEXT NOT NULL,
    gestionado_por UUID REFERENCES auth.users(id),
    gestionado_en TIMESTAMPTZ DEFAULT now(),
    comentario TEXT,
    UNIQUE(notificacion_id)
);

GRANT SELECT, INSERT, UPDATE ON public.notificaciones_gestion TO authenticated;
GRANT ALL ON public.notificaciones_gestion TO service_role;

ALTER TABLE public.notificaciones_gestion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver gestión de notificaciones"
ON public.notificaciones_gestion FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Usuarios pueden insertar gestión"
ON public.notificaciones_gestion FOR INSERT TO authenticated
WITH CHECK (auth.uid() = gestionado_por);

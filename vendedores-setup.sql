-- Script para registrar perfiles, roles y permisos para los nuevos vendedores
-- Esto asume que los usuarios ya existen en auth.users (si falló el registro masivo por rate limit,
-- el administrador deberá crearlos manualmente en la interfaz de "Nuevo usuario" 
-- usando estos nombres y correos).

-- Si ya existen algunos registros, este script los vincula correctamente.

DO $$
DECLARE
    seller_record RECORD;
    v_id UUID;
    vendedores JSONB := '[
        {"nombre": "CARLOS", "email": "carlos@coopvibisc.com"},
        {"nombre": "SONIA", "email": "sonia@coopvibisc.com"},
        {"nombre": "CARMEN", "email": "carmen@coopvibisc.com"},
        {"nombre": "LUISA", "email": "luisa@coopvibisc.com"},
        {"nombre": "SOLEDAD", "email": "soledad@coopvibisc.com"}
    ]';
BEGIN
    FOR seller_record IN SELECT * FROM jsonb_to_recordset(vendedores) AS x(nombre TEXT, email TEXT)
    LOOP
        -- Buscar el ID en auth.users
        SELECT id INTO v_id FROM auth.users WHERE email = seller_record.email;
        
        IF v_id IS NOT NULL THEN
            -- 1. Asegurar Perfil
            INSERT INTO public.perfiles (id, nombre, correo)
            VALUES (v_id, seller_record.nombre, seller_record.email)
            ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;
            
            -- 2. Asignar Rol 'vendedor'
            INSERT INTO public.roles_usuario (usuario_id, rol)
            VALUES (v_id, 'vendedor')
            ON CONFLICT (usuario_id) DO UPDATE SET rol = 'vendedor';
            
            -- 3. Asignar Permisos Básicos (POS, Productos, Dashboard)
            DELETE FROM public.permisos_usuario WHERE usuario_id = v_id;
            INSERT INTO public.permisos_usuario (usuario_id, modulo)
            VALUES 
                (v_id, 'dashboard'),
                (v_id, 'pos'),
                (v_id, 'productos'),
                (v_id, 'clientes'),
                (v_id, 'caja');
        END IF;
    END LOOP;
END $$;

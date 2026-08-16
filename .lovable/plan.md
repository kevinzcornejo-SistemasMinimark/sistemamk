---
title: Gestión de Usuarios y Cambio de Contraseña
description: Implementar la funcionalidad de cambio de nombre y restablecimiento de contraseña para usuarios desde el panel de administración.
type: feature
---

## Objetivo
Permitir que el administrador pueda editar el nombre de los usuarios y restablecer sus contraseñas en caso de olvido, directamente desde la interfaz de "Usuarios y permisos".

## Cambios propuestos

### Frontend (`src/routes/_app.usuarios.tsx`)
1.  **Estado para el nombre en edición:** Añadir un estado local `eNombre` para manejar el nombre del usuario en el modal de edición.
2.  **Estado para la nueva contraseña:** Añadir estados `ePass` y `mostrarPass` para permitir el cambio de contraseña.
3.  **Interfaz de usuario del modal de edición:**
    *   Incluir un campo de texto para editar el **Nombre**.
    *   Incluir una sección de **Cambio de Contraseña** (opcional) con un botón para mostrar/ocultar el campo.
4.  **Lógica de guardado (`guardarEditar`):**
    *   Actualizar la tabla `perfiles` con el nuevo nombre.
    *   Llamar a una nueva función de servidor para actualizar la contraseña en Supabase Auth si se proporciona una.

### Backend (Server Function)
1.  **Crear `src/lib/usuarios.functions.ts`:**
    *   Implementar `updateUserPassword` usando `createServerFn`.
    *   Utilizar `supabaseAdmin` para realizar la actualización administrativa de la contraseña sin requerir la sesión del usuario.
    *   **Seguridad:** Validar que el solicitante tenga rol de 'administrador'.

### Configuración de Supabase (`supabaseAdmin`)
1.  **Crear `src/integrations/supabase/admin.ts`:**
    *   Configurar un cliente de Supabase usando la `SERVICE_ROLE_KEY` (necesaria para `auth.admin`).

## Consideraciones de Seguridad
*   Solo los usuarios con el rol `administrador` o el `ADMIN_MAESTRO_EMAIL` podrán realizar estas acciones.
*   El `SERVICE_ROLE_KEY` debe estar configurado en las variables de entorno del servidor.

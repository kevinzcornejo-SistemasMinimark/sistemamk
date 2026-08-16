# Plan de Implementación: Módulo de Gestión de Créditos y Cuentas por Cobrar

Este plan describe la creación de un nuevo módulo para gestionar las ventas al crédito, permitiendo realizar un seguimiento de las deudas de los clientes y registrar abonos.

## Cambios sugeridos

### Backend (Base de Datos)
- Crear la tabla `creditos` para almacenar las deudas asociadas a una venta.
- Crear la tabla `creditos_abonos` para registrar los pagos parciales o totales realizados por los clientes.
- Configurar Row Level Security (RLS) y permisos para que los roles autorizados puedan gestionar los créditos.

### Frontend (Interfaz de Usuario)
- **Nueva Ruta:** Crear `src/routes/_app.creditos.tsx` para la gestión de deudas.
- **Componentes:**
    - Tabla de créditos pendientes con filtros por cliente y estado.
    - Modal para registrar abonos.
    - Vista detallada del historial de pagos por crédito.
    - Exportación de reportes (Excel/PDF) de deudas vigentes.
- **Sidebar:** Agregar el acceso al módulo de "Créditos" en la sección de "Caja" o "Clientes".
- **POS Integration:** (Opcional en esta fase) Permitir seleccionar "Crédito" como método de pago en el Punto de Venta.

## Detalles técnicos
- **Tabla `creditos`:** `id`, `venta_id`, `cliente_id`, `monto_total`, `monto_pagado`, `estado` (PENDIENTE, PAGADO), `fecha_vencimiento`.
- **Tabla `creditos_abonos`:** `id`, `credito_id`, `monto`, `fecha`, `metodo_pago`, `nota`.
- **Hooks/Functions:** Crear funciones para calcular el saldo pendiente y actualizar el estado del crédito automáticamente al completar el pago.
- **Permisos:** El módulo estará disponible para roles con acceso administrativo o de caja.

## Por qué este módulo
La gestión de créditos es una de las funcionalidades más solicitadas en minimarkets y negocios minoristas para fidelizar clientes ("fiado") manteniendo un control estricto del flujo de caja.

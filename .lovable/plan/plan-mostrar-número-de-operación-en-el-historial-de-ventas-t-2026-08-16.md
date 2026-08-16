# Plan: Mostrar Número de Operación en el Historial de Ventas (Tickets)

El usuario solicita que el **N° de Operación** (referencia de pago) sea visible en el historial de tickets (`src/routes/_app.tickets.tsx`), similar a cómo se hizo recientemente en el reporte de descuentos.

## Cambios propuestos

### 1. Interfaz y Tipos
- Actualizar el tipo `Venta` en `src/routes/_app.tickets.tsx` para incluir la propiedad `operacion` (o similar) que contendrá la referencia del pago.

### 2. Consulta de Datos
- Modificar la función `cargar` en `src/routes/_app.tickets.tsx` para obtener los números de operación asociados a cada venta desde la tabla `venta_pagos`.
- Dado que las ventas pueden tener múltiples pagos, concatenaremos las referencias si existen.

### 3. Interfaz de Usuario (Tabla)
- Añadir una nueva columna **"Operación"** en la tabla de ventas de `src/routes/_app.tickets.tsx`.
- Mostrar el número de operación con un estilo distintivo (posiblemente una insignia o texto resaltado en azul/cyan) para pagos electrónicos (Yape, Plin, Transferencia, Tarjetas).

### 4. Reportes y Exportación
- Asegurar que el número de operación se incluya en la exportación a **Excel** y **PDF**.
- Actualizar el **Reporte 80mm** (`construirReporteHtml`) para incluir el número de operación en el listado de tickets.

## Detalles Técnicos
- La consulta a `ventas` se ampliará para incluir una subconsulta o una consulta separada a `venta_pagos` para obtener las referencias sin romper la paginación/filtrado actual.
- Se usará un mapeo eficiente para asociar las operaciones a las filas de la tabla.

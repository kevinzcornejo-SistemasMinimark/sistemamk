# Mejora del Reporte de Descuentos con Vista Previa de Ticket

Este plan describe los cambios necesarios para integrar la funcionalidad de vista previa de tickets en el reporte de descuentos, permitiendo a los usuarios auditar las ventas asociadas directamente desde esta pantalla.

## Cambios en el Frontend

### Reporte de Descuentos (`src/routes/_app.descuentos.tsx`)
1.  **Integración de TicketModal**: Importar y configurar el componente `TicketModal` para mostrar el comprobante de venta.
2.  **Lógica de Reimpresión**: Implementar una función `reimprimir` que recupere los detalles de la venta (ítems, productos, etc.) desde Supabase y prepare los datos para el modal.
3.  **Nueva Columna "Acciones"**: Añadir una columna a la tabla con un botón de "Vista previa" para cada fila que tenga una venta asociada.
4.  **Mejoras Visuales**:
    *   Actualizar los encabezados de la tabla para que sean más legibles y estilizados.
    *   Añadir estados de carga visuales para el botón de vista previa.
    *   Asegurar que los montos de descuento se resalten adecuadamente (ej. en rojo o esmeralda).

## Detalles Técnicos
*   Utilizar `maybeSingle()` al buscar auditorías de descuento para evitar errores si no existe un registro detallado.
*   Manejar correctamente el mapeo de cajeros/usuarios para mostrar el nombre en el ticket.
*   Asegurar que la zona horaria `America/Lima` se mantenga consistente en la visualización de la fecha del ticket.

## Verificación
1.  Navegar a `/descuentos`.
2.  Verificar que aparezca la nueva columna "Acciones".
3.  Hacer clic en "Vista previa" y confirmar que se abre el modal con el ticket correcto.
4.  Verificar que los datos del ticket (ítems, subtotal, IGV, total y descuento) coincidan con la venta.
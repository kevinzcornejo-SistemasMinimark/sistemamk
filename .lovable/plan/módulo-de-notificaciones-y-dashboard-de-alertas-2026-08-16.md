# Módulo de Notificaciones y Dashboard de Alertas

Implementación de una nueva sección "Notificación" dentro del menú Inventario, que incluye un Dashboard completo para monitorear stock crítico, vencimientos y métricas de ventas.

## Cambios sugeridos

### Backend (SQL)
- No se requieren nuevas tablas, pero se verificará el uso de `productos`, `lotes`, `ventas` y `venta_items`.
- Se asume la existencia de la tabla `lotes` con `fecha_vencimiento` y `productos` con `stock_minimo`.

### Frontend
- **Sidebar**: Agregar el ítem "Notificación" dentro de la sección "Inventario".
- **Nueva Ruta**: Crear `src/routes/_app.notificaciones.tsx`.
- **Dashboard de Notificaciones**:
    - **Tarjetas de Estado**: Stock crítico, bajo, agotados, sobrestock, sin movimiento, próximos a vencer, vencidos, por reponer.
    - **Análisis de Ventas**: Top 10 más vendidos, menos vendidos, mayor facturación, tendencias.
    - **Filtros Temporales**: Hoy, 7 días, 30 días, mes, año y personalizado.
    - **Gestión de Lotes**: Visualización FEFO (First Expired, First Out).

## Detalles técnicos
- Uso de `Recharts` para las gráficas de ventas y tendencias.
- Consultas optimizadas a Supabase para calcular el sobrestock (ej: stock > stock_minimo * 5) y productos sin movimiento (sin ventas en los últimos 30 días).
- Lógica FEFO aplicada en la vista de lotes por vencer.
- Diseño minimalista y profesional alineado con el estilo "Apple-like" del proyecto.

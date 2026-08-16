# Plan de Implementación: Dashboard de Alertas

Crear un nuevo módulo de **Dashboard de Alertas** para el monitoreo integral de stock, vencimientos y rendimiento de ventas.

## 1. Estructura de Datos (Frontend)
- **Ruta:** `src/routes/_app.alertas.tsx`.
- **Estado Local:** Manejo de filtros (hoy, 7d, 30d, mes, año, personalizado) y datos cargados desde Supabase.
- **Consultas (Supabase):**
  - `productos`: Para stock crítico, bajo, agotado y sobrestock.
  - `lotes`: Para vencimientos y próximos a vencer.
  - `ventas` y `venta_items`: Para rendimiento (más/menos vendidos, facturación, tendencias).
  - `notificaciones_gestion`: Para alertas pendientes.

## 2. Componentes de UI
- **Tarjetas de KPI:** 10 tarjetas con colores e iconos específicos (rojo para crítico/vencido, naranja para bajo/próximo, etc.).
- **Sección de Rendimiento:**
  - Tabla/Lista Top 10 más vendidos.
  - Lista de productos con mayor facturación.
  - Indicadores de tendencia (Aumento/Descenso) comparando periodos.
- **Sección de Inventario y Vencimientos:**
  - Tablas detalladas filtrables para cada estado de stock.
- **Filtros Temporales:** Selector de rango de fechas con integración en las consultas.

## 3. Integración en Navegación
- **Sidebar:** Añadir "Alertas" en la sección "Principal" después del Dashboard actual.
- **Icono:** `BellRing` o `AlertTriangle`.

## 4. Detalles Técnicos
- Utilizar `recharts` para visualizaciones rápidas si es necesario (tendencias).
- Optimizar consultas para evitar sobrecarga (usar `useMemo` para cálculos pesados).
- Respetar el esquema de colores del proyecto (Tailwind v4).

## 5. Verificación
- Confirmar que los datos coinciden con el inventario actual.
- Validar el funcionamiento de los filtros de fecha.
- Probar la responsividad en móviles y escritorio.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getNotificacionesAlertas = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    diasVencimiento: z.number().optional(),
    categoriaId: z.string().optional(),
    proveedorId: z.string().optional(),
    ubicacion: z.string().optional()
  }).optional().parse(data))
  .handler(async ({ data }) => {
    try {
      const alerts: any[] = [];
      const client = supabase;
      
      const { data: { user } } = await client.auth.getUser();
      
      // Obtener configuración de alertas para el usuario
      let config = { dias_advertencia: 30, dias_critico: 7 };
      if (user) {
        const { data: configData } = await client
          .from("configuracion_alertas")
          .select("dias_advertencia, dias_critico")
          .eq("usuario_id", user.id)
          .maybeSingle();
        
        if (configData) {
          config = configData;
        }
      }

      // Usar días del filtro si están presentes, si no usar config
      const diasLimite = data?.diasVencimiento || config.dias_advertencia;
      const diasCritico = config.dias_critico;

      // 1. Productos (Stock Mínimo)
      let prodsQuery = client
        .from("productos")
        .select("id, nombre, stock, stock_minimo, activo, unidad, categoria_id, proveedor_id, ubicacion");
      
      if (data?.categoriaId) prodsQuery = prodsQuery.eq("categoria_id", data.categoriaId);
      // Asumimos que existen proveedor_id y ubicacion en productos
      if (data?.proveedorId) prodsQuery = prodsQuery.eq("proveedor_id", data.proveedorId);
      if (data?.ubicacion) prodsQuery = prodsQuery.ilike("ubicacion", `%${data.ubicacion}%`);

      const { data: prodsStock, error: prodsError } = await prodsQuery;
      
      if (prodsError) throw prodsError;

      // 2. Lotes
      let lotesQuery = client
        .from("lotes")
        .select("id, fecha_vencimiento, producto_id, productos(nombre, unidad, categoria_id, proveedor_id, ubicacion), cantidad_actual, numero_lote");

      const { data: lotes, error: lotesError } = await lotesQuery;

      if (lotesError) console.error("Error lotes:", lotesError);

      const { data: gestionadas } = await client
        .from("notificaciones_gestion")
        .select("notificacion_id");

      const gestionadasIds = new Set(gestionadas?.map((g: any) => g.notificacion_id) || []);

      // Procesar productos
      if (prodsStock) {
        prodsStock.forEach((p: any) => {
          if (!p.activo) return;
          const stockActual = Number(p.stock || 0);
          const stockMin = Number(p.stock_minimo || 0);
          if (stockMin > 0 && stockActual < stockMin) {
            const id = `stock-${p.id}`;
            if (!gestionadasIds.has(id)) {
              alerts.push({
                id,
                tipo: "stock",
                titulo: "Stock Mínimo",
                mensaje: `El producto ${p.nombre} tiene stock bajo: ${stockActual} (mínimo ${stockMin}).`,
                stock: stockActual,
                unidad: p.unidad || "unid",
                fecha: new Date().toISOString(),
                prioridad: 1,
                urgenciaLabel: "Crítico",
                diasRestantes: null,
                producto_id: p.id,
                categoria_id: p.categoria_id,
                proveedor_id: p.proveedor_id,
                ubicacion: p.ubicacion
              });
            }
          }
        });
      }

      // Procesar lotes
      if (lotes) {
        const hoy = new Date();
        lotes.forEach((l: any) => {
          const stockLote = Number(l.cantidad_actual || 0);
          if (stockLote <= 0) return;
          
          const fVenc = l.fecha_vencimiento ? new Date(l.fecha_vencimiento) : null;
          const diffMs = fVenc ? fVenc.getTime() - hoy.getTime() : null;
          const diffDays = diffMs !== null ? Math.ceil(diffMs / (1000 * 3600 * 24)) : NaN;
          
          const prod = l.productos as any;
          
          // Aplicar filtros de lotes si no se filtraron en productos
          if (data?.categoriaId && prod?.categoria_id !== data.categoriaId) return;
          if (data?.proveedorId && prod?.proveedor_id !== data.proveedorId) return;
          if (data?.ubicacion && !prod?.ubicacion?.toLowerCase().includes(data.ubicacion.toLowerCase())) return;

          if (isNaN(diffDays) || diffDays <= diasLimite) {
            const id = `venc-${l.id}`;
            if (!gestionadasIds.has(id)) {
              let titulo = isNaN(diffDays) ? "En riesgo" : diffDays <= 0 ? "Vencido" : "Próximo a Vencer";
              let urgenciaLabel = isNaN(diffDays) ? "Info" : diffDays <= 0 ? "Vencido" : diffDays <= diasCritico ? "Crítico" : "Advertencia";
              let prioridad = isNaN(diffDays) ? 1 : diffDays <= 0 ? 0 : diffDays <= diasCritico ? 1 : 2;
              
              alerts.push({
                id,
                tipo: "vencimiento",
                titulo,
                mensaje: `${prod?.nombre || "Producto"} · Lote ${l.numero_lote || 'N/A'} ${isNaN(diffDays) ? '' : (diffDays <= 0 ? '(Vencido)' : `(Vence en ${diffDays} días)`)}`,
                stock: stockLote,
                unidad: prod?.unidad || "unid",
                fecha: new Date().toISOString(),
                diasRestantes: isNaN(diffDays) ? null : diffDays,
                prioridad,
                urgenciaLabel,
                producto_id: l.producto_id,
                categoria_id: prod?.categoria_id,
                proveedor_id: prod?.proveedor_id,
                ubicacion: prod?.ubicacion
              });
            }
          }
        });
      }

      return { 
        alerts: alerts.sort((a, b) => a.prioridad - b.prioridad),
        config
      };
    } catch (err: any) {
      return { alerts: [], config: { dias_advertencia: 30, dias_critico: 7 } };
    }
  });

export const resolverNotificacion = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string(), motivo: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const client = supabase;
    const { error } = await client
      .from("notificaciones_gestion")
      .upsert({ 
        notificacion_id: data.id,
        motivo: data.motivo || 'Gestionado'
      }, { onConflict: 'notificacion_id' });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const saveAlertConfig = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    dias_advertencia: z.number(),
    dias_critico: z.number()
  }).parse(data))
  .handler(async ({ data }) => {
    const client = supabase;
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { error } = await client
      .from("configuracion_alertas")
      .upsert({
        usuario_id: user.id,
        dias_advertencia: data.dias_advertencia,
        dias_critico: data.dias_critico,
        updated_at: new Date().toISOString()
      }, { onConflict: 'usuario_id' });

    if (error) throw new Error(error.message);
    return { success: true };
  });
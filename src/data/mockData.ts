export interface MockProducto {
  id: string;
  codigo_barras: string;
  nombre: string;
  precio_venta: number;
  precio_compra: number;
  stock: number;
  stock_minimo: number;
  unidad: string;
  categoria_id: string;
  imagen?: string;
  igv: boolean;
  /** Producto de servicio (recarga, pago de servicio, bolsa): no controla stock */
  es_servicio?: boolean;
  /** UUID real del producto en BD cuando la línea usa un id sintético */
  servicio_id?: string;
}

export interface MockCategoria {
  id: string;
  nombre: string;
  icono: string;
  color: string;
}

export const mockCategorias: MockCategoria[] = [
  { id: "c1", nombre: "Abarrotes", icono: "ShoppingBasket", color: "#16a34a" },
  { id: "c2", nombre: "Bebidas", icono: "CupSoda", color: "#0ea5e9" },
  { id: "c3", nombre: "Lácteos", icono: "Milk", color: "#f59e0b" },
  { id: "c4", nombre: "Panadería", icono: "Croissant", color: "#d97706" },
  { id: "c5", nombre: "Limpieza", icono: "SprayCan", color: "#a855f7" },
  { id: "c6", nombre: "Snacks", icono: "Cookie", color: "#ef4444" },
  { id: "c7", nombre: "Embutidos", icono: "Beef", color: "#dc2626" },
  { id: "c8", nombre: "Frutas", icono: "Apple", color: "#65a30d" },
];

export const mockProductos: MockProducto[] = [
  { id: "p1", codigo_barras: "7750885001234", nombre: "Arroz Costeño 5kg", precio_venta: 28.9, precio_compra: 24, stock: 45, stock_minimo: 10, unidad: "BLS", categoria_id: "c1", igv: true },
  { id: "p2", codigo_barras: "7750885002001", nombre: "Aceite Primor 1L", precio_venta: 12.5, precio_compra: 10.2, stock: 60, stock_minimo: 15, unidad: "UND", categoria_id: "c1", igv: true },
  { id: "p3", codigo_barras: "7750885002345", nombre: "Azúcar Rubia 1kg", precio_venta: 4.8, precio_compra: 3.9, stock: 80, stock_minimo: 20, unidad: "BLS", categoria_id: "c1", igv: true },
  { id: "p4", codigo_barras: "7750885002346", nombre: "Fideos Don Vittorio 500g", precio_venta: 3.9, precio_compra: 2.8, stock: 120, stock_minimo: 30, unidad: "UND", categoria_id: "c1", igv: true },
  { id: "p5", codigo_barras: "7750885003001", nombre: "Inca Kola 1.5L", precio_venta: 7.5, precio_compra: 5.8, stock: 50, stock_minimo: 12, unidad: "BOT", categoria_id: "c2", igv: true },
  { id: "p6", codigo_barras: "7750885003002", nombre: "Coca Cola 1.5L", precio_venta: 8.0, precio_compra: 6.2, stock: 48, stock_minimo: 12, unidad: "BOT", categoria_id: "c2", igv: true },
  { id: "p7", codigo_barras: "7750885003010", nombre: "Agua Cielo 625ml", precio_venta: 2.0, precio_compra: 1.2, stock: 100, stock_minimo: 24, unidad: "BOT", categoria_id: "c2", igv: true },
  { id: "p8", codigo_barras: "7750885003020", nombre: "Cusqueña 620ml", precio_venta: 9.5, precio_compra: 7.2, stock: 36, stock_minimo: 12, unidad: "BOT", categoria_id: "c2", igv: true },
  { id: "p9", codigo_barras: "7750885004001", nombre: "Leche Gloria 400g", precio_venta: 4.2, precio_compra: 3.3, stock: 70, stock_minimo: 20, unidad: "TRA", categoria_id: "c3", igv: true },
  { id: "p10", codigo_barras: "7750885004002", nombre: "Yogurt Laive 1L", precio_venta: 9.9, precio_compra: 7.5, stock: 30, stock_minimo: 8, unidad: "UND", categoria_id: "c3", igv: true },
  { id: "p11", codigo_barras: "7750885005001", nombre: "Pan Francés (und)", precio_venta: 0.3, precio_compra: 0.18, stock: 200, stock_minimo: 50, unidad: "UND", categoria_id: "c4", igv: false },
  { id: "p12", codigo_barras: "7750885005002", nombre: "Pan de Molde Bimbo", precio_venta: 8.9, precio_compra: 6.5, stock: 18, stock_minimo: 5, unidad: "UND", categoria_id: "c4", igv: true },
  { id: "p13", codigo_barras: "7750885006001", nombre: "Detergente Ariel 750g", precio_venta: 14.5, precio_compra: 11.2, stock: 25, stock_minimo: 6, unidad: "BLS", categoria_id: "c5", igv: true },
  { id: "p14", codigo_barras: "7750885006002", nombre: "Lejía Clorox 1L", precio_venta: 5.9, precio_compra: 4.3, stock: 40, stock_minimo: 10, unidad: "BOT", categoria_id: "c5", igv: true },
  { id: "p15", codigo_barras: "7750885007001", nombre: "Chizitos Doritos", precio_venta: 2.5, precio_compra: 1.6, stock: 90, stock_minimo: 20, unidad: "UND", categoria_id: "c6", igv: true },
  { id: "p16", codigo_barras: "7750885007002", nombre: "Galleta Oreo", precio_venta: 1.5, precio_compra: 0.95, stock: 150, stock_minimo: 30, unidad: "UND", categoria_id: "c6", igv: true },
  { id: "p17", codigo_barras: "7750885008001", nombre: "Jamonada San Fernando", precio_venta: 11.9, precio_compra: 8.5, stock: 22, stock_minimo: 6, unidad: "KG", categoria_id: "c7", igv: true },
  { id: "p18", codigo_barras: "7750885009001", nombre: "Plátano de seda", precio_venta: 4.5, precio_compra: 2.8, stock: 30, stock_minimo: 8, unidad: "KG", categoria_id: "c8", igv: false },
  { id: "p19", codigo_barras: "7750885009002", nombre: "Manzana Israel", precio_venta: 6.9, precio_compra: 4.5, stock: 25, stock_minimo: 6, unidad: "KG", categoria_id: "c8", igv: false },
  { id: "p20", codigo_barras: "7750885009003", nombre: "Palta Fuerte", precio_venta: 12.5, precio_compra: 8.9, stock: 18, stock_minimo: 5, unidad: "KG", categoria_id: "c8", igv: false },
];

export const mockBusiness = {
  ruc: "20123456789",
  razon_social: "Minimarket La Esquina S.A.C.",
  nombre_comercial: "Minimarket La Esquina",
  direccion: "Av. Los Próceres 123, Lima",
  moneda: "PEN",
  igv: 18,
};
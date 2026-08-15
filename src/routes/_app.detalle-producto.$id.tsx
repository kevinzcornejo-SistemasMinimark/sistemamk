import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/detalle-producto/$id")({
  component: DetalleProducto,
});

function DetalleProducto() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Detalle del Producto: {id}</h1>
      <p className="text-muted-foreground mb-4">Funcionalidad de historial y movimientos en construcción...</p>
      <button 
        onClick={() => navigate({ to: "/productos" })}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
      >
        Volver
      </button>
    </div>
  );
}

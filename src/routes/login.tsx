import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Sparkles, Phone, MapPin, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useBusinessInfo } from "@/hooks/useBusinessInfo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — POS Minimarket" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, enterDemo, isDemo, loading } = useAuth();
  const navigate = useNavigate();
  const biz = useBusinessInfo();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && (user || isDemo)) {
      navigate({ to: "/pos" });
    }
  }, [user, isDemo, loading, navigate]);

  const handle = async () => {
    if (!email || !password) {
      toast.error("Ingresa email y contraseña");
      return;
    }
    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);
    if (res.error) toast.error(res.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/15 via-background to-accent/10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        <div className="hidden md:block space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-white text-primary grid place-items-center shadow-lg overflow-hidden border border-border/50">
              {biz.logo ? (
                <img src={biz.logo} alt="logo" className="h-full w-full object-contain p-1" />
              ) : (
                <Store className="h-7 w-7" />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{biz.nombre}</h1>
              <p className="text-muted-foreground">Punto de venta para tu bodega PE</p>
            </div>
          </div>
          <div className="space-y-4 bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-border/40 shadow-sm">
            <h3 className="font-bold text-lg text-primary flex items-center gap-2">
              <Store className="h-5 w-5" /> Información de la Empresa
            </h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">R.U.C.</p>
                  <p className="font-semibold">{biz.ruc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Dirección</p>
                  <p className="font-semibold">{biz.direccion}</p>
                </div>
              </div>
              {biz.telefono && (
                <div className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none">Teléfono</p>
                    <p className="font-semibold">{biz.telefono}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            {[
              "Ventas rápidas con lector de código de barras",
              "Boletas, facturas y tickets con IGV 18%",
              "Yape, Plin, efectivo, tarjeta y pago MIXTO",
              "Inventario, caja, compras y reportes en un solo lugar",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="md:hidden space-y-4 bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-border/40 mb-2">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <Store className="h-4 w-4" /> {biz.nombre}
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-primary" />
                <span className="font-semibold">{biz.ruc}</span>
              </div>
              {biz.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-primary" />
                  <span className="font-semibold">{biz.telefono}</span>
                </div>
              )}
            </div>
          </div>
          
          <Card className="p-6 md:p-8 shadow-xl border-border/60">
            <h2 className="text-xl font-bold mb-1">Bienvenido</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Inicia sesión con tu correo y contraseña. Las nuevas cuentas las crea el administrador.
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                onKeyDown={(e) => e.key === "Enter" && handle()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handle()}
              />
            </div>
            <Button className="w-full" disabled={submitting} onClick={handle}>
              {submitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </div>

          {/* El botón de modo demo ha sido removido a petición del usuario para evitar confusiones */}
          </Card>
        </div>
      </div>
    </div>
  );
}

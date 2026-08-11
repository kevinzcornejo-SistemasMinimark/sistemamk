import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Sparkles } from "lucide-react";
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
            <div className="h-14 w-14 rounded-2xl bg-[#9333ea] text-primary-foreground grid place-items-center shadow-lg overflow-hidden">
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
          <ul className="space-y-3 text-sm">
            {[
              "Ventas rápidas con lector de código de barras",
              "Boletas, facturas y tickets con IGV 18%",
              "Yape, Plin, efectivo, tarjeta y pago MIXTO",
              "Inventario, caja, compras y reportes en un solo lugar",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-[#9333ea]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
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
            <Button className="w-full bg-[#9333ea] hover:bg-[#7e22ce]" disabled={submitting} onClick={handle}>
              {submitting ? "Ingresando…" : "Ingresar"}
            </Button>
          </div>

          <Button
            variant="secondary"
            className="w-full mt-4"
            onClick={() => {
              enterDemo();
              toast.success("Modo demo activado");
              navigate({ to: "/pos" });
            }}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Entrar en modo demo
          </Button>
        </Card>
      </div>
    </div>
  );
}

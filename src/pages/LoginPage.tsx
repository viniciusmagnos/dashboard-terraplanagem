import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { beginLogin } from "../lib/oauth";
import { MantaLogo } from "../components/shell/Branding";

/**
 * Tela de login — SSO "Entrar com Manta Hub" (OAuth 2.1 + PKCE).
 * Se já houver sessão, redireciona ao destino preservado (deep-link) ou "/".
 */
export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [indo, setIndo] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (isAuthenticated) return <Navigate to={from} replace />;

  const entrar = () => {
    setIndo(true);
    void beginLogin(from);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <MantaLogo size={44} />
        </div>
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">
            Dashboard de Terraplenagem
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de terraplenagem (Brückner, seções, geotecnia, cenários e
            orçamento) com dados sob demanda do Manta Hub.
          </p>
          <button
            onClick={entrar}
            disabled={indo}
            className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-manta hover:bg-manta-hover disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {indo ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            Entrar com Manta Hub
          </button>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Usa a sua conta do Manta Hub — se já estiver logado lá, entra sem
            digitar a senha de novo.
          </p>
        </div>
      </div>
    </div>
  );
}

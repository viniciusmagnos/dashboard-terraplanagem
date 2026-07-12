import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { exchangeCode, takeReturnTo, beginLogin } from "../lib/oauth";
import { finishOAuthLogin } from "../lib/auth";

/**
 * Callback do OAuth: troca o `code` por tokens, popula o usuário e redireciona
 * ao destino preservado (deep-link) ou "/".
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const rodou = useRef(false);

  useEffect(() => {
    if (rodou.current) return; // StrictMode monta 2x em dev
    rodou.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthErr = params.get("error");

    void (async () => {
      if (oauthErr) {
        setErro(params.get("error_description") || oauthErr);
        return;
      }
      if (!code || !state) {
        setErro("Resposta de autorização incompleta.");
        return;
      }
      try {
        const tokens = await exchangeCode(code, state);
        await finishOAuthLogin(tokens);
        const dest = takeReturnTo() || "/";
        navigate(dest, { replace: true });
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {erro ? (
        <div className="w-full max-w-sm bg-surface border border-border rounded-xl p-6 text-center">
          <AlertCircle className="mx-auto text-danger" size={28} />
          <p className="mt-3 text-sm text-foreground">Falha ao entrar</p>
          <p className="mt-1 text-xs text-muted-foreground break-words">{erro}</p>
          <button
            onClick={() => void beginLogin("/")}
            className="mt-5 px-4 py-2 rounded-lg bg-manta hover:bg-manta-hover text-white text-sm font-medium transition-colors"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" /> Concluindo o login…
        </div>
      )}
    </div>
  );
}

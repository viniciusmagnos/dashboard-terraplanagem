import { useState } from "react";
import { ChevronDown, ChevronRight, Inbox } from "lucide-react";

/**
 * Estado "aguardando dados" — usado pelas abas cujo bloco de dado é OPCIONAL
 * (cronograma, tempo_caminho, otimizacoes, analise_simultaneidade, recursos…).
 * Nada é hardcoded: quando o bloco não vem no .mtp.json, mostramos o que
 * precisa ser incluído + (opcional) um esqueleto colável do formato esperado.
 */
export function EmptyStateAguardando({
  bloco,
  descricao,
  exemplo,
}: {
  /** Caminho/nome do bloco esperado no .mtp.json (ex.: "cronograma"). */
  bloco: string;
  descricao?: string;
  /** Esqueleto JSON do formato esperado (colável). */
  exemplo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="bg-surface border border-dashed border-border rounded-lg p-8 text-center">
      <Inbox className="mx-auto text-muted-foreground" size="28" />
      <p className="mt-3 text-sm font-medium text-foreground">
        Aguardando dados
      </p>
      <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
        {descricao ?? (
          <>
            Inclua o bloco{" "}
            <code className="px-1 py-0.5 rounded bg-muted/40 text-manta">
              {bloco}
            </code>{" "}
            no pacote <code>.mtp.json</code> para preencher esta aba. Futuramente
            o AskCAD do Manta Hub poderá gerá-lo automaticamente.
          </>
        )}
      </p>
      {exemplo ? (
        <div className="mt-4 max-w-lg mx-auto text-left">
          <button
            onClick={() => setAberto((a) => !a)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {aberto ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
            Formato esperado
          </button>
          {aberto ? (
            <pre className="mt-2 text-[11px] leading-relaxed bg-background border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground">
              {exemplo}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Chrome padrão dos blocos dinâmicos: título + chip IA + remover, faixa de
// aviso (binding indisponível) e nota de rodapé. O visual segue os cards
// existentes (bg-surface, border-border, rounded-lg).
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ChipIa, BotaoRemoverBloco } from "./ChipIa";

export function BlocoFrame({
  blocoId,
  titulo,
  subtitulo,
  nota,
  aviso,
  children,
}: {
  blocoId: string;
  titulo?: string;
  subtitulo?: string;
  nota?: string;
  /** Mensagem de degradação (ex.: "fonte de dados indisponível: …"). */
  aviso?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border-subtle">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {titulo || "Bloco do assistente"}
          </div>
          {subtitulo && (
            <div className="text-[11px] text-muted-foreground truncate">{subtitulo}</div>
          )}
        </div>
        <ChipIa />
        <BotaoRemoverBloco blocoId={blocoId} />
      </div>
      {aviso && (
        <div className="px-3 py-1.5 text-[11px] flex items-center gap-1.5 bg-warning/10 text-warning border-b border-warning/20">
          <AlertTriangle size={11} className="shrink-0" /> {aviso}
        </div>
      )}
      <div className="p-3">{children}</div>
      {nota && (
        <div className="px-3 pb-2 text-[11px] text-muted-foreground">{nota}</div>
      )}
    </div>
  );
}

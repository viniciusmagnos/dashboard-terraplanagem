// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Proveniência visual dos itens criados pelo assistente: chip "IA" + botão
// de remover (a remoção persiste via endpoint granular — rev+1 no layout).
import { Sparkles, X } from "lucide-react";
import { useLayoutSeguro } from "./LayoutContext";

export function ChipIa() {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium border border-manta/40 text-manta select-none"
      title="Criado pelo assistente IA"
    >
      <Sparkles size={9} /> IA
    </span>
  );
}

export function BotaoRemoverBloco({ blocoId }: { blocoId: string }) {
  const layout = useLayoutSeguro();
  if (!layout) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("Remover este bloco do dashboard?")) {
          void layout.removerBloco(blocoId);
        }
      }}
      className="p-0.5 rounded text-muted-foreground hover:text-danger hover:bg-surface-hover"
      title="Remover bloco"
      aria-label="Remover bloco"
    >
      <X size={12} />
    </button>
  );
}

/** Chip + remover juntos (cabe no slot `chip` do KpiCard). */
export function ChipIaRemover({ blocoId }: { blocoId: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <ChipIa />
      <BotaoRemoverBloco blocoId={blocoId} />
    </span>
  );
}

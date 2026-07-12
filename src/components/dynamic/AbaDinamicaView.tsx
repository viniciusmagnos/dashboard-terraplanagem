// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Conteúdo de uma sub-aba criada pelo assistente: grid dos blocos da aba +
// ações (remover a aba inteira). Renderizada pelo fallback do registro de
// sub-abas do EstudoShell quando o id ativo é de uma aba dinâmica.
import { Sparkles, Trash2 } from "lucide-react";
import { useLayout } from "./LayoutContext";
import { GridBlocos } from "./DynamicBlock";

export function AbaDinamicaView({ abaId }: { abaId: string }) {
  const { spec, removerAba } = useLayout();
  const aba = spec.abas.find((a) => a.id === abaId);
  const blocos = spec.blocos.filter(
    (b) => b.local.tipo === "aba" && b.local.abaId === abaId,
  );

  if (!aba) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta aba do assistente não existe mais.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-manta" />
        <p className="text-xs text-muted-foreground flex-1">
          Aba criada pelo assistente IA — os blocos abaixo vivem no estudo e
          aparecem para todos os participantes.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Remover a aba "${aba.titulo}" e todos os blocos dela?`)) {
              void removerAba(abaId, true);
            }
          }}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:text-danger hover:border-danger/40"
          title="Remover esta aba e seus blocos"
        >
          <Trash2 size={11} /> Remover aba
        </button>
      </div>
      {blocos.length > 0 ? (
        <GridBlocos blocos={blocos} />
      ) : (
        <p className="text-sm text-muted-foreground">
          A aba ainda não tem blocos — peça ao assistente para adicioná-los.
        </p>
      )}
    </div>
  );
}

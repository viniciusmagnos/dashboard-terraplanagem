import { Download, FileText, Package } from "lucide-react";
import { fmt } from "../../lib/format";
import { BotaoExportarExcel } from "../landxml/BotaoExportarExcel";
import { BotaoExportarHtml } from "../landxml/BotaoExportarHtml";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Relatório completo: exportações formatadas (HTML + Excel) do estudo. */
export function RelatorioCompletoTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={FileText}
        titulo="Relatório completo"
        subtitulo="Relatório formatado (HTML para impressão/PDF) e planilha do cenário ativo"
      />
      <section className="bg-surface border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Gera o relatório completo do estudo <strong>{pacote.projeto.nome}</strong> com KPIs,
          Brückner, orçamento e comparativo do cenário ativo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <BotaoExportarHtml />
          <BotaoExportarExcel />
        </div>
      </section>
    </div>
  );
}

/** Exportar pacote: metadados + download do .mtp.json. */
export function ExportarPacoteTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();

  const baixarPacote = () => {
    const blob = new Blob([JSON.stringify(pacote)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pacote.projeto.id}.mtp.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Package}
        titulo="Exportar pacote"
        subtitulo={`${pacote.schema} v${pacote.schema_version}`}
        right={<ProvChip prov="extracted" />}
      />
      <section className="bg-surface border border-border rounded-lg p-4">
        <dl className="text-sm grid gap-1 md:grid-cols-2">
          <Item termo="Projeto" valor={`${pacote.projeto.nome} (${pacote.projeto.id})`} />
          <Item termo="Cliente" valor={pacote.projeto.cliente} />
          <Item termo="Eixos" valor={String(pacote.eixos.length)} />
          <Item termo="Seções (bins)" valor={fmt(pacote.bins.length)} />
        </dl>
        <div className="mt-3">
          <button
            onClick={baixarPacote}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-hover transition-colors"
          >
            <Download size={14} /> Baixar pacote .mtp.json
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          O mesmo arquivo pode ser reaberto em “Meus projetos → Já tenho um pacote”, com todos os
          blocos opcionais (cronograma, tempo_caminho, otimizacoes, recursos…).
        </p>
      </section>
    </div>
  );
}

function Item({ termo, valor }: { termo: string; valor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="text-right truncate">{valor || "—"}</dd>
    </div>
  );
}

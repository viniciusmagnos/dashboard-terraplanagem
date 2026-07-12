import { useMemo } from "react";
import { FileSearch } from "lucide-react";
import type { Provenance } from "../../lib/mtp";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Rastreabilidade: gerador, arquivos-fonte e proveniência de cada bloco. */
export function RastreabilidadeTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const g = pacote.generator;
  const provs = useMemo(
    () => Object.entries(pacote.provenance ?? {}) as [string, Provenance][],
    [pacote],
  );

  const geradoEm = (() => {
    try {
      return new Date(pacote.generated_at).toLocaleString("pt-BR");
    } catch {
      return pacote.generated_at;
    }
  })();

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={FileSearch}
        titulo="Rastreabilidade"
        subtitulo={`${pacote.schema} v${pacote.schema_version} · gerado em ${geradoEm}`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium">Gerador</h3>
          <dl className="mt-2 text-sm space-y-1">
            <Item termo="Ferramenta" valor={g?.tool} />
            <Item termo="Modo" valor={g?.mode} />
            <Item termo="Cliente" valor={pacote.projeto.cliente} />
            <Item termo="Projeto" valor={`${pacote.projeto.nome} (${pacote.projeto.id})`} />
          </dl>
        </section>

        <section className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium">
            Arquivos-fonte ({g?.source_files?.length ?? 0})
          </h3>
          <ul className="mt-2 text-xs text-muted-foreground space-y-1">
            {(g?.source_files ?? []).map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono">{f.filename}</span>
                <span className="shrink-0">{(f.size_bytes / 1e6).toFixed(1)} MB</span>
              </li>
            ))}
            {(g?.source_files?.length ?? 0) === 0 ? (
              <li>Sem arquivos-fonte registrados.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
          Proveniência dos blocos de dados
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {provs.map(([bloco, prov]) => (
                <tr key={bloco} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{bloco}</td>
                  <td className="px-4 py-2 text-right">
                    <ProvChip prov={prov} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Validação de dados: foco em QUALIDADE — o que está declarado mas ausente, o
// que carrega ressalva, o que é demonstração e quais avisos o processamento
// emitiu. O catálogo campo-a-campo (origem, transformação, escopo) vive na aba
// Rastreabilidade; aqui não se repete.
import { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import {
  camposDoPacote,
  contagemProveniencia,
  exemplosNaTela,
} from "../../lib/linhagem";
import type { Provenance } from "../../lib/mtp";
import { PROV_ESTILO } from "../landxml/ProvChip";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { subExiste, useNavegacao } from "../shell/NavegacaoContext";

export function ValidacaoDadosTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const nav = useNavegacao();

  const campos = useMemo(() => camposDoPacote(pacote), [pacote]);
  const contagem = useMemo(() => contagemProveniencia(pacote), [pacote]);
  const ausentes = useMemo(
    () => campos.filter((c) => c.situacao === "ausente"),
    [campos],
  );
  const comRessalva = useMemo(
    () => campos.filter((c) => c.situacao === "presente" && c.campo?.caveat),
    [campos],
  );
  const demo = useMemo(() => exemplosNaTela(pacote), [pacote]);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={ShieldCheck}
        titulo="Validação de dados"
        subtitulo={`${campos.length} campos rastreados · ${ausentes.length} sem dado · ${comRessalva.length} com ressalva · ${pacote.warnings.length} aviso(s)`}
      >
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROV_ESTILO) as Provenance[]).map((p) =>
            contagem[p] ? (
              <span
                key={p}
                className={`text-xs px-2 py-1 rounded border ${PROV_ESTILO[p].classe}`}
              >
                {contagem[p]} {PROV_ESTILO[p].rotulo}
              </span>
            ) : null,
          )}
        </div>
      </SecaoHeaderCard>

      {demo.length > 0 ? (
        <div className="bg-surface border border-warning/50 rounded-lg p-4">
          <p className="text-sm font-medium text-warning">
            {demo.length} bloco(s) de demonstração com dado na tela
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Marcados como <code className="font-mono">example</code> no pacote —
            os painéis que os consomem exibem número que não é deste projeto:{" "}
            {demo.map((b) => (
              <code key={b} className="font-mono">
                {" "}
                {b}
              </code>
            ))}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ListaBlocos
          titulo="Declarados no pacote, sem dado"
          vazio="Todo bloco declarado tem conteúdo."
          descricao="O pacote reserva a chave de proveniência mas não traz o bloco. Os painéis correspondentes ficam vazios — não há número de demonstração ali."
          itens={ausentes}
        />
        <ListaBlocos
          titulo="Com ressalva de interpretação"
          vazio="Nenhuma ressalva registrada."
          descricao="Dados presentes cuja leitura exige contexto (escopo, método de obtenção, base de premissa). Clique no chip para ler a ressalva."
          itens={comRessalva}
        />
      </div>

      {pacote.warnings.length > 0 ? (
        <div className="bg-surface border border-warning/40 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle size={15} /> Avisos do processamento
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {pacote.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhum aviso registrado no pacote.
        </p>
      )}

      {nav && subExiste("rastreabilidade") ? (
        <button
          onClick={() => nav.irParaSub("rastreabilidade")}
          className="text-xs text-manta hover:underline"
        >
          Catálogo completo de origem e transformação em Rastreabilidade →
        </button>
      ) : null}
    </div>
  );
}

function ListaBlocos({
  titulo,
  descricao,
  vazio,
  itens,
}: {
  titulo: string;
  descricao: string;
  vazio: string;
  itens: ReturnType<typeof camposDoPacote>;
}) {
  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-sm font-medium">
          {titulo} ({itens.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {descricao}
        </p>
      </div>
      {itens.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-muted-foreground">
          {vazio}
        </p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {itens.map((l) => (
              <tr key={l.chave} className="border-t border-border">
                <td className="px-4 py-2">
                  <span className="block text-foreground">
                    {l.campo?.rotulo ?? l.chave}
                  </span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {l.chave}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <ChipFonte bloco={l.chave} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

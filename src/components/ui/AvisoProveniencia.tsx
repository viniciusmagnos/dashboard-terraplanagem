// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Aviso destacado quando o painel está exibindo dado que NÃO vem do projeto:
// bloco marcado como `example` (demonstração) presente no pacote. Quando o
// bloco simplesmente não vem no pacote, o próprio painel mostra
// `EmptyStateAguardando` — nesse caso não há número na tela para desmentir e o
// aviso ficaria alarmista, então não é renderizado.
import { FlaskConical } from "lucide-react";
import { blocoPresente, campoDoCatalogo } from "../../lib/linhagem";
import { provenanceDe } from "../../lib/mtp";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { subExiste, useNavegacao } from "../shell/NavegacaoContext";

/**
 * Envolve o conteúdo de uma aba, prefixando o aviso quando algum dos blocos que
 * a alimentam for dado de demonstração de fato presente no pacote.
 */
export function AvisoProveniencia({ blocos }: { blocos: string[] }) {
  const { pacote } = useEstudo();
  const nav = useNavegacao();

  const demo = blocos.filter(
    (b) => provenanceDe(pacote, b) === "example" && blocoPresente(pacote, b),
  );
  if (demo.length === 0) return null;

  const rotulos = demo.map((b) => campoDoCatalogo(b)?.rotulo ?? b);

  return (
    <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 flex gap-2.5">
      <FlaskConical size={16} className="shrink-0 mt-0.5 text-warning" />
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-medium text-warning">
          Dados de DEMONSTRAÇÃO — não vêm deste projeto
        </p>
        <p className="mt-1 text-muted-foreground">
          {rotulos.length === 1 ? "O bloco" : "Os blocos"}{" "}
          {demo.map((b, i) => (
            <span key={b}>
              {i > 0 ? (i === demo.length - 1 ? " e " : ", ") : ""}
              <code className="font-mono text-foreground">{b}</code>
            </span>
          ))}{" "}
          {rotulos.length === 1 ? "está marcado" : "estão marcados"} como{" "}
          <code className="font-mono">example</code> no pacote{" "}
          <code className="font-mono">.mtp.json</code>. Os números abaixo servem
          para exercitar a interface — não use para decisão de projeto.
        </p>
        {nav && subExiste("rastreabilidade") ? (
          <button
            onClick={() => nav.irParaSub("rastreabilidade")}
            className="mt-1.5 text-manta hover:underline"
          >
            Ver a rastreabilidade completa →
          </button>
        ) : null}
      </div>
    </div>
  );
}

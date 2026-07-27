import { CheckCircle2, XCircle, Activity } from "lucide-react";
import { fmt } from "../../lib/format";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

/**
 * Validação de execução física: fecha o balanço de massas do cenário ativo
 * (corte = compensado + bota-fora; aterro = compensado + empréstimo).
 */
export function ValidacaoFisicaTab({ accent }: { accent: string }) {
  const { pacote, ativo } = useEstudo();
  const br = ativo.bruckner ?? pacote.bruckner ?? null;

  if (!br) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={Activity} titulo="Validação exec. física" />
        <EmptyStateAguardando
          bloco="bruckner"
          descricao="O fechamento físico depende do resultado Brückner (corte/aterro/compensado)."
        />
      </div>
    );
  }

  const t = br.totals;
  const somaCorte = t.volume_compensado + t.sobra_bota_fora;
  const somaAterro = t.volume_compensado + t.falta_emprestimo;
  const difCorte = t.v_corte - somaCorte;
  const difAterro = t.v_aterro - somaAterro;
  const tol = 0.01;
  const okCorte = Math.abs(difCorte) / Math.max(t.v_corte, 1) < tol;
  const okAterro = Math.abs(difAterro) / Math.max(t.v_aterro, 1) < tol;

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Activity}
        titulo="Validação exec. física"
        subtitulo="Fechamento do balanço de massas do cenário ativo"
        right={<ChipFonte prov="computed" bloco="bruckner" />}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Identidade
          titulo="Corte = Compensado + Bota-fora"
          ok={okCorte}
          esquerda={{ rot: "Corte total", v: t.v_corte }}
          parcelas={[
            { rot: "Volume compensado", v: t.volume_compensado },
            { rot: "Sobra → bota-fora", v: t.sobra_bota_fora },
          ]}
          dif={difCorte}
        />
        <Identidade
          titulo="Aterro = Compensado + Empréstimo"
          ok={okAterro}
          esquerda={{ rot: "Aterro (m³c)", v: t.v_aterro }}
          parcelas={[
            { rot: "Volume compensado", v: t.volume_compensado },
            { rot: "Falta → empréstimo (jazida)", v: t.falta_emprestimo },
          ]}
          dif={difAterro}
        />
      </div>

      <div className="bg-surface border border-border rounded-lg p-3 text-xs text-muted-foreground">
        DMT média do transporte compensado:{" "}
        <strong className="text-foreground">{fmt(t.dmt_medio_m)} m</strong> · Momento:{" "}
        <strong className="text-foreground">{fmt(t.momento_m3km)} m³·km</strong>
      </div>
    </div>
  );
}

function Identidade({
  titulo,
  ok,
  esquerda,
  parcelas,
  dif,
}: {
  titulo: string;
  ok: boolean;
  esquerda: { rot: string; v: number };
  parcelas: { rot: string; v: number }[];
  dif: number;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{titulo}</h3>
        {ok ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={14} /> consistente
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-danger">
            <XCircle size={14} /> divergência
          </span>
        )}
      </div>
      <table className="w-full text-sm mt-3">
        <tbody>
          <tr>
            <td className="py-1 font-medium">{esquerda.rot}</td>
            <td className="py-1 text-right font-medium">{fmt(esquerda.v)} m³</td>
          </tr>
          {parcelas.map((p) => (
            <tr key={p.rot} className="text-muted-foreground">
              <td className="py-1 pl-3">{p.rot}</td>
              <td className="py-1 text-right">{fmt(p.v)} m³</td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <td className="py-1">Diferença</td>
            <td className={`py-1 text-right ${ok ? "text-success" : "text-danger"}`}>
              {fmt(dif)} m³
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

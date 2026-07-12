import { GitBranch } from "lucide-react";
import { fmt, fmtBRLCompacto, fmtKm } from "../../lib/format";
import { KpiCard } from "../landxml/KpiCard";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

const pct = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a != null && b != null && b !== 0 ? ((a - b) / b) * 100 : null;
const frac = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Visão do cenário ativo: premissas + KPIs + economia vs caso base. */
export function CenarioVisaoTab({ accent }: { accent: string }) {
  const { ativo, casoBase, ativoEconomia, cenarioAtivoId } = useEstudo();
  const ehBase = cenarioAtivoId === null;
  const pr = ativo.def.premissas;
  const bk = ativo.def.bruckner;

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={GitBranch}
        titulo={ativo.def.nome}
        subtitulo={ativo.def.descricao ?? (ehBase ? "Parâmetros e premissas do pacote" : "Cenário derivado")}
        right={<ProvChip prov={ehBase ? "default" : "manual"} />}
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          rotulo="Orçamento total"
          valor={ativo.orcamento.total}
          formato={fmtBRLCompacto}
          deltaPct={ehBase ? null : pct(ativo.orcamento.total, casoBase.orcamento.total)}
        />
        <KpiCard
          rotulo="Momento"
          valor={ativo.momento.total}
          sufixo="m³·km"
          deltaPct={ehBase ? null : pct(ativo.momento.total, casoBase.momento.total)}
        />
        <KpiCard
          rotulo="Empréstimo"
          valor={ativo.volumes.jazidaTotal}
          sufixo="m³"
          deltaPct={ehBase ? null : pct(ativo.volumes.jazidaTotal, casoBase.volumes.jazidaTotal)}
        />
        <KpiCard
          rotulo="Economia"
          valor={ativoEconomia ? ativoEconomia.total : null}
          formato={fmtBRLCompacto}
          rodape={
            ativoEconomia
              ? `${ativoEconomia.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs base`
              : "referência"
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Premissas do cenário
          </div>
          <table className="w-full text-sm">
            <tbody>
              <Prem rot="CFT (% do base)" v={frac(pr.cftPercent)} />
              <Prem rot="Alargamento de corte" v={frac(pr.alargamentoCortePercent)} />
              <Prem rot="Alargamento de aterro" v={frac(pr.alargamentoAterroPercent)} />
              <Prem rot="DMT corte→aterro" v={fmtKm(pr.dmtCorteAterro)} />
              <Prem rot="DMT jazida (na/fora faixa)" v={`${fmtKm(pr.dmtJazidaNaFaixa)} / ${fmtKm(pr.dmtJazidaForaFaixa)}`} />
              <Prem rot="DMT bota-fora (na/fora)" v={`${fmtKm(pr.dmtBFNaFaixa)} / ${fmtKm(pr.dmtBFForaFaixa)}`} />
              <Prem rot="DMT CFT / solo mole" v={`${fmtKm(pr.dmtCFT)} / ${fmtKm(pr.dmtSoloMole)}`} />
            </tbody>
          </table>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Parâmetros Brückner
          </div>
          <table className="w-full text-sm">
            <tbody>
              <Prem rot="Fator de homogeneização" v={fmt(bk.fillFactor, 2)} />
              <Prem rot="Linha de distribuição" v={bk.baseline === "median" ? "mediana" : "início"} />
              <Prem rot="Barreiras ativas" v={String(bk.barreirasAtivas.length)} />
              <Prem rot="Barreiras extras" v={String(bk.barreirasExtras.length)} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Prem({ rot, v }: { rot: string; v: string }) {
  return (
    <tr className="border-t border-border first:border-t-0">
      <td className="px-4 py-2 text-muted-foreground">{rot}</td>
      <td className="px-4 py-2 text-right tabular-nums">{v}</td>
    </tr>
  );
}

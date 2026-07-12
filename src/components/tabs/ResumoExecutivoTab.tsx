import { ClipboardList } from "lucide-react";
import { fmt, fmtBRL, fmtBRLCompacto } from "../../lib/format";
import { KpiCard } from "../landxml/KpiCard";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

const pct = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a != null && b != null && b !== 0 ? ((a - b) / b) * 100 : null;

/** Resumo executivo: KPIs do cenário ativo com delta vs caso base. */
export function ResumoExecutivoTab({ accent }: { accent: string }) {
  const { pacote, ativo, casoBase, ativoEconomia, cenarioAtivoId } = useEstudo();
  const v = ativo.volumes;
  const vb = casoBase.volumes;
  const ehBase = cenarioAtivoId === null;

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={ClipboardList}
        titulo="Resumo executivo"
        subtitulo={
          <>
            Cenário ativo: <strong>{ativo.def.nome}</strong>
            {ehBase ? " (referência)" : " — comparado ao caso base"}
          </>
        }
        right={<ProvChip prov="computed" />}
      />

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          rotulo="Orçamento total"
          valor={ativo.orcamento.total}
          formato={fmtBRLCompacto}
          deltaPct={ehBase ? null : pct(ativo.orcamento.total, casoBase.orcamento.total)}
        />
        <KpiCard
          rotulo="Momento de transporte"
          valor={ativo.momento.total}
          sufixo="m³·km"
          deltaPct={ehBase ? null : pct(ativo.momento.total, casoBase.momento.total)}
        />
        <KpiCard
          rotulo="Corte total"
          valor={v.corteTotal}
          sufixo="m³"
          deltaPct={ehBase ? null : pct(v.corteTotal, vb.corteTotal)}
          deltaBomQuandoNegativo={false}
        />
        <KpiCard
          rotulo="Aterro (m³c)"
          valor={v.aterroFc}
          sufixo="m³"
          deltaPct={ehBase ? null : pct(v.aterroFc, vb.aterroFc)}
          deltaBomQuandoNegativo={false}
        />
        <KpiCard
          rotulo="Empréstimo (jazida)"
          valor={v.jazidaTotal}
          sufixo="m³"
          deltaPct={ehBase ? null : pct(v.jazidaTotal, vb.jazidaTotal)}
        />
        <KpiCard
          rotulo="Bota-fora"
          valor={v.bfTotal}
          sufixo="m³"
          deltaPct={ehBase ? null : pct(v.bfTotal, vb.bfTotal)}
        />
        <KpiCard
          rotulo="Extensão"
          valor={pacote.extensoes.total}
          formato={(x) => fmt(x, 2)}
          sufixo="km"
        />
        <KpiCard
          rotulo="Economia vs caso base"
          valor={ativoEconomia ? ativoEconomia.total : null}
          formato={fmtBRLCompacto}
          rodape={
            ativoEconomia
              ? `${ativoEconomia.percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do caso base`
              : "cenário de referência"
          }
        />
      </div>

      {ativoEconomia ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Decomposição da economia
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                <Linha rot="CFT — escavação" v={ativoEconomia.cft.escavacao} />
                <Linha rot="CFT — compactação" v={ativoEconomia.cft.compactacao} />
                <Linha rot="CFT — transporte" v={ativoEconomia.cft.transporte} />
                <Linha rot="Royalty — jazida" v={ativoEconomia.royalty.jazida} />
                <Linha rot="Royalty — bota-fora" v={ativoEconomia.royalty.botaFora} />
                <Linha rot="Transporte (DMT)" v={ativoEconomia.transporte} />
                <tr className="border-t border-border font-medium bg-surface-hover/40">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">{fmtBRL(ativoEconomia.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Linha({ rot, v }: { rot: string; v: number }) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2 text-muted-foreground">{rot}</td>
      <td className={`px-4 py-2 text-right ${v >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
        {fmtBRL(v)}
      </td>
    </tr>
  );
}

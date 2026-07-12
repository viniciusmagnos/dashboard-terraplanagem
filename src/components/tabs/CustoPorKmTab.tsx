import { Ruler } from "lucide-react";
import { fmt, fmtBRL, fmtBRLCompacto } from "../../lib/format";
import { KpiCard } from "../landxml/KpiCard";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Custo por km do cenário ativo, por grupo de serviço. */
export function CustoPorKmTab({ accent }: { accent: string }) {
  const { pacote, ativo } = useEstudo();
  const o = ativo.orcamento;
  const kmTotal = pacote.extensoes.total || 0;
  const kmComServico = pacote.extensoes.comServico || kmTotal;

  const grupos = [
    { rot: "Escavação", total: o.escavacao.subtotal },
    { rot: "Transporte", total: o.transporte.custo },
    { rot: "Compactação", total: o.compactacao.subtotal },
    { rot: "Royalty", total: o.royalty.subtotal },
    { rot: "Conformação BF", total: o.conformacaoBF.subtotal },
  ];
  const porKm = (v: number) => (kmTotal > 0 ? v / kmTotal : null);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Ruler}
        titulo="Custo por km"
        subtitulo={`Cenário: ${ativo.def.nome} · ${fmt(kmTotal, 2)} km (${fmt(kmComServico, 2)} km com serviço)`}
        right={<ProvChip prov="computed" />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard rotulo="Custo total" valor={o.total} formato={fmtBRLCompacto} />
        <KpiCard
          rotulo="Custo por km (total)"
          valor={porKm(o.total)}
          formato={fmtBRLCompacto}
          sufixo="/km"
        />
        <KpiCard
          rotulo="Custo por km (com serviço)"
          valor={kmComServico > 0 ? o.total / kmComServico : null}
          formato={fmtBRLCompacto}
          sufixo="/km"
        />
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Grupo</th>
                <th className="px-4 py-2 text-right">Custo total</th>
                <th className="px-4 py-2 text-right">Custo por km</th>
                <th className="px-4 py-2 text-right">% do total</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((gp) => (
                <tr key={gp.rot} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-2">{gp.rot}</td>
                  <td className="px-4 py-2 text-right">{fmtBRL(gp.total)}</td>
                  <td className="px-4 py-2 text-right">{fmtBRL(porKm(gp.total))}</td>
                  <td className="px-4 py-2 text-right">
                    {o.total > 0 ? fmt((gp.total / o.total) * 100, 1) : "0"}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium bg-surface-hover/40">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{fmtBRL(o.total)}</td>
                <td className="px-4 py-2 text-right">{fmtBRL(porKm(o.total))}</td>
                <td className="px-4 py-2 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

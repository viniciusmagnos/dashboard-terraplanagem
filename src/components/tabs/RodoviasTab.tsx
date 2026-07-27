import { Route } from "lucide-react";
import { fmt } from "../../lib/format";
import { staToKmLabel } from "../../lib/mtp";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Tabela de eixos/rodovias do projeto (dados extraídos do LandXML). */
export function RodoviasTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const eixos = pacote.eixos;
  const totCorte = eixos.reduce((s, e) => s + (e.volumes.corte_total ?? 0), 0);
  const totAterro = eixos.reduce((s, e) => s + (e.volumes.aterro ?? 0), 0);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Route}
        titulo="Rodovias e eixos"
        subtitulo={`${eixos.length} eixos · ${fmt(pacote.extensoes.total, 2)} km de extensão`}
        right={<ChipFonte pacote={pacote} bloco="eixos" />}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi rot="Eixos" val={String(eixos.length)} />
        <Kpi rot="Corte total" val={`${fmt(totCorte)} m³`} />
        <Kpi rot="Aterro total" val={`${fmt(totAterro)} m³`} />
        <Kpi rot="Extensão" val={`${fmt(pacote.extensoes.total, 2)} km`} />
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Eixo</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-center">Serviço</th>
                <th className="px-4 py-2 text-right">Extensão (km)</th>
                <th className="px-4 py-2 text-right">Estacas</th>
                <th className="px-4 py-2 text-right">Corte (m³)</th>
                <th className="px-4 py-2 text-right">Aterro (m³)</th>
                <th className="px-4 py-2 text-right">Empréstimo (m³)</th>
                <th className="px-4 py-2 text-right">Bota-fora (m³)</th>
              </tr>
            </thead>
            <tbody>
              {eixos.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-2">
                    {e.nome}
                    <span className="block text-[11px] text-muted-foreground">
                      {staToKmLabel(e.sta_inicio_m)} → {staToKmLabel(e.sta_fim_m)}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">{e.tipo}</td>
                  <td className="px-4 py-2 text-center">{e.tem_servico ? "sim" : "—"}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.extensao_m / 1000, 2)}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.n_estacas)}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.volumes.corte_total)}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.volumes.aterro)}</td>
                  <td className="px-4 py-2 text-right text-manta">{fmt(e.volumes.jazida)}</td>
                  <td className="px-4 py-2 text-right text-warning">{fmt(e.volumes.bf_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium bg-surface-hover/40">
                <td className="px-4 py-2" colSpan={5}>
                  Total
                </td>
                <td className="px-4 py-2 text-right">{fmt(totCorte)}</td>
                <td className="px-4 py-2 text-right">{fmt(totAterro)}</td>
                <td className="px-4 py-2 text-right" />
                <td className="px-4 py-2 text-right" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ rot, val }: { rot: string; val: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{rot}</p>
      <p className="text-base font-semibold mt-1 tabular-nums">{val}</p>
    </div>
  );
}

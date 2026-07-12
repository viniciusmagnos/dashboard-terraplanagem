import { fmt } from "../../lib/format";
import { staToKmLabel } from "../../lib/mtp";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SlotBlocos } from "../dynamic/SlotBlocos";

/** Visão geral: KPIs do projeto + tabela de eixos + warnings do pacote. */
export function VisaoTab() {
  const { pacote } = useEstudo();
  const vb = pacote.volumes_base;
  const br = pacote.bruckner ?? null;

  const kpis = [
    { rot: "Corte", val: `${fmt(vb.corteTotal)} m³`, chip: "volumes_base.corteTotal" },
    { rot: "Aterro (m³c)", val: `${fmt(vb.aterroFc)} m³`, chip: "volumes_base.aterroFc" },
    { rot: "Pavimento", val: `${fmt(vb.pavimento ?? null)} m³`, chip: "bins" },
    {
      rot: "Momento",
      val: `${fmt(br?.totals["momento_m3km"] as number | null)} m³·km`,
      chip: "bruckner",
    },
    {
      rot: "DMT média",
      val: `${fmt(br?.totals["dmt_medio_m"] as number | null)} m`,
      chip: "bruckner",
    },
    { rot: "Extensão", val: `${fmt(pacote.extensoes.total, 2)} km`, chip: "extensoes" },
  ];

  return (
    <div className="space-y-4">
      <SlotBlocos slot="visao.topo" />
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.rot} className="bg-surface border border-border rounded-lg p-3">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs text-muted-foreground">{kpi.rot}</p>
              <ProvChip pacote={pacote} bloco={kpi.chip} />
            </div>
            <p className="text-base font-semibold mt-1">{kpi.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-sm font-medium">
          Eixos do projeto <ProvChip pacote={pacote} bloco="eixos" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Eixo</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Extensão (km)</th>
                <th className="px-4 py-2 text-right">Estacas</th>
                <th className="px-4 py-2 text-right">Corte (m³)</th>
                <th className="px-4 py-2 text-right">Aterro (m³)</th>
                <th className="px-4 py-2 text-right">Empréstimo (m³)</th>
                <th className="px-4 py-2 text-right">Bota-fora (m³)</th>
              </tr>
            </thead>
            <tbody>
              {pacote.eixos.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-2">
                    {e.nome}
                    <span className="block text-[11px] text-muted-foreground">
                      {staToKmLabel(e.sta_inicio_m)} → {staToKmLabel(e.sta_fim_m)}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">{e.tipo}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.extensao_m / 1000, 2)}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.n_estacas)}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.volumes.corte_total)}</td>
                  <td className="px-4 py-2 text-right">{fmt(e.volumes.aterro)}</td>
                  <td className="px-4 py-2 text-right text-manta">{fmt(e.volumes.jazida)}</td>
                  <td className="px-4 py-2 text-right text-warning">{fmt(e.volumes.bf_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pacote.warnings.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          {pacote.warnings.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}

      <SlotBlocos slot="visao.rodape" />
    </div>
  );
}

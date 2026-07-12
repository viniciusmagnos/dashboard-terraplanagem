import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { fmt } from "../../lib/format";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

/**
 * Matriz DMT — distribuição do volume compensado e do momento por faixa de
 * distância média de transporte (bandas DNIT do resultado Brückner).
 */
export function MatrizDmtTab({ accent }: { accent: string }) {
  const { pacote, ativo } = useEstudo();
  const br = ativo.bruckner ?? pacote.bruckner ?? null;

  const linhas = useMemo(() => {
    if (!br) return [];
    const vol = br.faixas ?? {};
    const mom = br.faixas_momento ?? {};
    const bandas = Object.keys(vol);
    const totalVol = bandas.reduce((s, k) => s + (vol[k] ?? 0), 0) || 1;
    return bandas.map((k) => ({
      banda: k,
      volume: vol[k] ?? 0,
      momento: mom[k] ?? 0,
      pct: ((vol[k] ?? 0) / totalVol) * 100,
    }));
  }, [br]);

  if (!br || linhas.length === 0) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={BarChart3} titulo="Análise (Matriz DMT)" />
        <EmptyStateAguardando
          bloco="bruckner"
          descricao="A matriz DMT depende do resultado Brückner (pacote com bins de rodovia). Este estudo não tem faixas de distância calculadas."
        />
      </div>
    );
  }

  const maxVol = Math.max(...linhas.map((l) => l.volume), 1);
  const totalVol = linhas.reduce((s, l) => s + l.volume, 0);
  const totalMom = linhas.reduce((s, l) => s + l.momento, 0);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={BarChart3}
        titulo="Análise (Matriz DMT)"
        subtitulo={`${linhas.length} faixas · ${fmt(totalVol)} m³ compensados · ${fmt(totalMom)} m³·km`}
        right={<ProvChip prov="computed" />}
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Faixa DMT (m)</th>
                <th className="px-4 py-2 text-right">Volume (m³)</th>
                <th className="px-4 py-2 text-right">% do total</th>
                <th className="px-4 py-2 w-1/3">Distribuição</th>
                <th className="px-4 py-2 text-right">Momento (m³·km)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.banda} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-2 tabular-nums">{l.banda}</td>
                  <td className="px-4 py-2 text-right">{fmt(l.volume)}</td>
                  <td className="px-4 py-2 text-right">{fmt(l.pct, 1)}%</td>
                  <td className="px-4 py-2">
                    <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(l.volume / maxVol) * 100}%`,
                          background: accent,
                        }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">{fmt(l.momento)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium bg-surface-hover/40">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{fmt(totalVol)}</td>
                <td className="px-4 py-2 text-right">100%</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right">{fmt(totalMom)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

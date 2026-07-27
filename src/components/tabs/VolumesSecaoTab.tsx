import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Boxes } from "lucide-react";
import { fmt } from "../../lib/format";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Volumes por seção (bins de 20 m), agregados por eixo. */
export function VolumesSecaoTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();

  const linhas = useMemo(() => {
    const nomes = new Map(pacote.eixos.map((e) => [e.id, e.nome]));
    const agg = new Map<
      string,
      { eixo: string; corte: number; aterro: number; pavimento: number; nBins: number }
    >();
    for (const b of pacote.bins) {
      const cur =
        agg.get(b.eixo_id) ??
        { eixo: nomes.get(b.eixo_id) ?? b.eixo_id, corte: 0, aterro: 0, pavimento: 0, nBins: 0 };
      cur.corte += b.v_corte ?? 0;
      cur.aterro += b.v_aterro ?? 0;
      cur.pavimento += b.v_pavimento ?? 0;
      cur.nBins += 1;
      agg.set(b.eixo_id, cur);
    }
    return [...agg.values()].sort((a, b) => b.corte + b.aterro - (a.corte + a.aterro));
  }, [pacote]);

  const larguraBin = pacote.bins_meta?.largura_m ?? 20;

  if (pacote.bins.length === 0) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={Boxes} titulo="Volumes por seção" />
        <p className="text-sm text-muted-foreground">Pacote sem bins de volume.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Boxes}
        titulo="Volumes por seção"
        subtitulo={`${fmt(pacote.bins.length)} seções de ${larguraBin} m · ${linhas.length} eixos`}
        right={<ChipFonte pacote={pacote} bloco="bins" />}
      />

      <div className="bg-surface border border-border rounded-lg p-3">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={linhas} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="eixo"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={70}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v) => fmt(v / 1000)}
              label={{ value: "mil m³", angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <Tooltip
              formatter={(v) => `${fmt(Number(v))} m³`}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="corte" name="Corte" fill="#C8601F" radius={[3, 3, 0, 0]} />
            <Bar dataKey="aterro" name="Aterro" fill="#4E7C59" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Eixo</th>
                <th className="px-4 py-2 text-right">Seções</th>
                <th className="px-4 py-2 text-right">Corte (m³)</th>
                <th className="px-4 py-2 text-right">Aterro (m³)</th>
                <th className="px-4 py-2 text-right">Pavimento (m³)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.eixo} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-2">{l.eixo}</td>
                  <td className="px-4 py-2 text-right">{fmt(l.nBins)}</td>
                  <td className="px-4 py-2 text-right">{fmt(l.corte)}</td>
                  <td className="px-4 py-2 text-right">{fmt(l.aterro)}</td>
                  <td className="px-4 py-2 text-right">{fmt(l.pavimento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

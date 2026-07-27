import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Route } from "lucide-react";
import { tempoCaminhoDe } from "../../lib/pacote-ext";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

const EXEMPLO = `"tempo_caminho": {
  "versao": 1,
  "eixo_x": "Caminho (km)",
  "eixo_y": "Tempo (min)",
  "series": [
    { "rotulo": "Corte 3 → Aterro 5",
      "pontos": [ { "caminho_km": 0, "tempo_min": 0 },
                  { "caminho_km": 2.5, "tempo_min": 12 } ] }
  ]
}`;

const CORES = ["#C8601F", "#4E7C59", "#8B5E34", "#B07D22", "#7A5230", "#9A5B2A"];

export function TempoCaminhoTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const tc = tempoCaminhoDe(pacote);

  const dados = useMemo(() => {
    if (!tc) return [];
    const xs = new Set<number>();
    for (const s of tc.series) for (const p of s.pontos) xs.add(p.caminho_km);
    const eixoX = [...xs].sort((a, b) => a - b);
    return eixoX.map((x) => {
      const row: Record<string, number> = { caminho_km: x };
      for (const s of tc.series) {
        const p = s.pontos.find((pt) => pt.caminho_km === x);
        if (p) row[s.rotulo] = p.tempo_min;
      }
      return row;
    });
  }, [tc]);

  if (!tc) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={Route} titulo="Tempo × caminho" />
        <EmptyStateAguardando bloco="tempo_caminho" exemplo={EXEMPLO} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Route}
        titulo="Tempo × caminho"
        subtitulo={`${tc.series.length} série(s)`}
        right={<ChipFonte pacote={pacote} bloco="tempo_caminho" />}
      />

      <div className="bg-surface border border-border rounded-lg p-3">
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="caminho_km"
              type="number"
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              label={{ value: tc.eixo_x ?? "Caminho (km)", position: "insideBottom", offset: -12, fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              label={{ value: tc.eixo_y ?? "Tempo (min)", angle: -90, position: "insideLeft", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {tc.series.map((s, i) => (
              <Line
                key={s.rotulo}
                type="monotone"
                dataKey={s.rotulo}
                stroke={s.cor ?? CORES[i % CORES.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

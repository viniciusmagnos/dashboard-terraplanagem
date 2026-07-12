/**
 * BrucknerChart — curva de Brückner (ordenada acumulada m³ × km) com as
 * barreiras (OAEs) marcadas. Recebe a curva pronta (do pacote ou do
 * recálculo do simulador) em estações absolutas (m).
 */
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MtpBarreira } from "../../lib/mtp";

/** Série extra sobreposta à curva (ex.: hipóteses do assistente IA). Cada
 * série carrega a própria curva — a amostragem não precisa casar com a
 * principal (o eixo X é numérico compartilhado). */
export interface BrucknerSerieExtra {
  id: string;
  nome: string;
  cor?: string;
  tracejada?: boolean;
  curve: [number, number][];
}

const fmtM3 = (v: number) =>
  Math.abs(v) >= 1e6
    ? `${(v / 1e6).toFixed(1)}M`
    : Math.abs(v) >= 1e3
      ? `${(v / 1e3).toFixed(0)}k`
      : v.toFixed(0);

interface BrucknerChartProps {
  curve: [number, number][]; // (estação m, ordenada m³)
  barreiras?: MtpBarreira[];
  altura?: number;
  /** Clique na curva → estação (m) — usado p/ abrir a seção transversal. */
  onStationClick?: (staM: number) => void;
  /** Séries adicionais (retrocompatível — sem elas o gráfico é idêntico). */
  seriesExtras?: BrucknerSerieExtra[];
}

const CORES_EXTRAS = ["#C8601F", "#8B5CF6", "#22C55E", "#EAB308", "#EC4899"];

export function BrucknerChart({
  curve,
  barreiras = [],
  altura = 320,
  onStationClick,
  seriesExtras,
}: BrucknerChartProps) {
  const data = curve.map(([sta, y]) => ({ km: sta / 1000, ordenada: y }));
  const extras = (seriesExtras ?? []).filter((s) => s.curve.length > 0);
  if (!data.length) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center">
        Sem curva de Brückner no pacote.
      </div>
    );
  }
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart
          margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
          onClick={(st) => {
            if (onStationClick && st?.activeLabel != null) {
              onStationClick(Number(st.activeLabel) * 1000);
            }
          }}
          style={onStationClick ? { cursor: "pointer" } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
          <XAxis
            dataKey="km"
            type="number"
            domain={["dataMin", "dataMax"]}
            allowDuplicatedCategory={false}
            tickFormatter={(v: number) => v.toFixed(1)}
            fontSize={11}
            label={{ value: "km", position: "insideBottomRight", offset: -2, fontSize: 11 }}
          />
          <YAxis tickFormatter={fmtM3} fontSize={11} width={56} />
          <Tooltip
            formatter={(v, name) => [
              `${Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m³`,
              String(name ?? "Ordenada"),
            ]}
            labelFormatter={(km) => `km ${Number(km ?? 0).toFixed(3)}`}
            contentStyle={{ fontSize: 12 }}
          />
          {extras.length > 0 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
          {barreiras.map((b) => (
            <ReferenceLine
              key={b.sta_m}
              x={b.sta_m / 1000}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              label={{
                value: b.nome || b.tipo,
                position: "top",
                fontSize: 10,
                fill: "#f59e0b",
              }}
            />
          ))}
          <Line
            data={data}
            type="monotone"
            dataKey="ordenada"
            name="Ordenada"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {extras.map((s, i) => (
            <Line
              key={s.id}
              data={s.curve.map(([sta, y]) => ({ km: sta / 1000, ordenada: y }))}
              type="monotone"
              dataKey="ordenada"
              name={s.nome || s.id}
              stroke={s.cor || CORES_EXTRAS[i % CORES_EXTRAS.length]}
              strokeWidth={2}
              strokeDasharray={s.tracejada === false ? undefined : "6 4"}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-1 px-1">
        Curva sobe em corte e desce em aterro; trechos entre cruzamentos do zero são
        ondas de compensação. Linhas âmbar = barreiras (material não cruza).
      </p>
    </div>
  );
}

export default BrucknerChart;

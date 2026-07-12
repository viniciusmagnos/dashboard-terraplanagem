// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Bloco de gráfico dinâmico (Recharts) no padrão visual do BrucknerChart:
// grid pontilhado em var(--color-border), fontes 11px, paleta iniciando no
// acento Manta. Variantes line/area usam eixo X numérico com data por série
// (amostragens independentes); bar mescla as séries por x (categorias).
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { useSeriesResolvidas } from "../../lib/dashboard-bindings";
import type { BlocoChart } from "../../lib/dashboard-spec";
import { BlocoFrame } from "./BlocoFrame";
import { PALETA_DINAMICA, formatador } from "./formatos";

export function DynChart({ bloco }: { bloco: BlocoChart }) {
  const series = Array.isArray(bloco.series) ? bloco.series : [];
  const resolvidas = useSeriesResolvidas(series);

  const erros = series
    .map((s) => {
      const r = resolvidas.get(s.id);
      return r?.erro ? `${s.nome || s.id}: ${r.erro}` : null;
    })
    .filter((e): e is string => e != null);

  const emKm = bloco.eixoX?.emKm === true;
  const fatorX = emKm ? 1 / 1000 : 1;
  const fmtY = formatador(bloco.eixoY?.formato);
  const altura = bloco.altura && bloco.altura >= 120 ? Math.min(bloco.altura, 640) : 280;

  const comDados = series
    .map((s, i) => ({
      spec: s,
      cor: s.cor || PALETA_DINAMICA[i % PALETA_DINAMICA.length],
      pontos: resolvidas.get(s.id)?.valor ?? null,
    }))
    .filter((s): s is typeof s & { pontos: [number, number][] } => s.pontos != null);

  // Barras: mescla séries por x (categoria) — Recharts BarChart não aceita
  // data independente por <Bar>.
  const dataBarras = useMemo(() => {
    if (bloco.variante !== "bar") return [];
    const porX = new Map<number, Record<string, number>>();
    for (const s of comDados) {
      for (const [x, y] of s.pontos) {
        const key = x * fatorX;
        const row = porX.get(key) ?? {};
        row[s.spec.id] = y;
        porX.set(key, row);
      }
    }
    return [...porX.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([x, valores]) => ({ x, ...valores }));
  }, [bloco.variante, comDados, fatorX]);

  const aviso =
    erros.length > 0
      ? `fonte indisponível — ${erros.join("; ")}`
      : comDados.length === 0
        ? "sem séries com dados"
        : null;

  const eixos = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
      <XAxis
        dataKey="x"
        type="number"
        domain={["dataMin", "dataMax"]}
        allowDuplicatedCategory={false}
        fontSize={11}
        tickFormatter={(v: number) => (emKm ? v.toFixed(1) : String(v))}
        label={
          bloco.eixoX?.label
            ? { value: bloco.eixoX.label, position: "insideBottomRight", offset: -2, fontSize: 11 }
            : undefined
        }
      />
      <YAxis fontSize={11} width={56} tickFormatter={(v: number) => fmtY(v)} />
      <Tooltip
        formatter={(v, name) => [fmtY(Number(v ?? 0)), String(name ?? "")]}
        labelFormatter={(x) =>
          bloco.eixoX?.label
            ? `${bloco.eixoX.label} ${Number(x ?? 0).toLocaleString("pt-BR")}`
            : String(x)
        }
        contentStyle={{ fontSize: 12 }}
      />
      {comDados.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
      {(bloco.refLines ?? []).map((r, i) =>
        r.x != null || r.y != null ? (
          <ReferenceLine
            key={i}
            x={r.x != null ? r.x * fatorX : undefined}
            y={r.y ?? undefined}
            stroke={r.cor || "var(--color-muted-foreground)"}
            strokeDasharray="4 4"
            label={r.label ? { value: r.label, fontSize: 10, position: "top" } : undefined}
          />
        ) : null,
      )}
    </>
  );

  return (
    <BlocoFrame
      blocoId={bloco.id}
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      nota={bloco.nota}
      aviso={aviso}
    >
      {comDados.length > 0 && (
        <ResponsiveContainer width="100%" height={altura}>
          {bloco.variante === "bar" ? (
            <BarChart data={dataBarras} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              {eixos}
              {comDados.map((s) => (
                <Bar
                  key={s.spec.id}
                  dataKey={s.spec.id}
                  name={s.spec.nome || s.spec.id}
                  fill={s.cor}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : bloco.variante === "area" ? (
            <AreaChart margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              {eixos}
              {comDados.map((s) => (
                <Area
                  key={s.spec.id}
                  data={s.pontos.map(([x, y]) => ({ x: x * fatorX, y }))}
                  dataKey="y"
                  name={s.spec.nome || s.spec.id}
                  stroke={s.cor}
                  fill={s.cor}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              {eixos}
              {comDados.map((s) => (
                <Line
                  key={s.spec.id}
                  data={s.pontos.map(([x, y]) => ({ x: x * fatorX, y }))}
                  dataKey="y"
                  name={s.spec.nome || s.spec.id}
                  stroke={s.cor}
                  strokeWidth={2}
                  strokeDasharray={s.spec.tracejada ? "6 4" : undefined}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </BlocoFrame>
  );
}

/**
 * PerfilLongitudinalChart — greide × terreno do eixo (recharts): área entre
 * as curvas indica corte (terreno acima) / aterro (greide acima); barreiras
 * e estação ativa marcadas; clique navega a estação.
 */
import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt } from "../../../lib/format";
import type { MtpBarreira, MtpGeoPerfil } from "../../../lib/mtp";

export function PerfilLongitudinalChart({
  perfil,
  zOffset,
  barreiras,
  estacaoAtiva,
  onStationClick,
  altura = 260,
}: {
  perfil: MtpGeoPerfil;
  zOffset: number;
  barreiras?: MtpBarreira[];
  estacaoAtiva?: number | null;
  onStationClick?: (staM: number) => void;
  altura?: number;
}) {
  const dados = useMemo(() => {
    const n = Math.max(perfil.greide_z.length, perfil.terreno_z.length);
    const out: { km: number; greide: number | null; terreno: number | null }[] = [];
    for (let i = 0; i < n; i++) {
      const g = perfil.greide_z[i];
      const t = perfil.terreno_z[i];
      if (g == null && t == null) continue;
      out.push({
        km: (perfil.sta0_m + i * perfil.passo_m) / 1000,
        greide: g == null ? null : g + zOffset,
        terreno: t == null ? null : t + zOffset,
      });
    }
    return out;
  }, [perfil, zOffset]);

  if (dados.length < 2) {
    return <p className="text-sm text-muted-foreground">Eixo sem perfil.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <ComposedChart
        data={dados}
        margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
        onClick={(e) => {
          const km = e?.activeLabel;
          if (km != null && onStationClick) onStationClick(Number(km) * 1000);
        }}
        style={onStationClick ? { cursor: "pointer" } : undefined}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#33415555" />
        <XAxis
          dataKey="km"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v: number) => `km ${Math.round(v)}`}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={52}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => fmt(v, 0)}
        />
        <Tooltip
          formatter={(v, nome) => [`${fmt(Number(v), 2)} m`, nome === "greide" ? "greide" : "terreno"]}
          labelFormatter={(km) => `km ${fmt(Number(km), 3)}`}
        />
        {(barreiras ?? []).map((b) => (
          <ReferenceLine
            key={b.sta_m}
            x={b.sta_m / 1000}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: b.nome || b.tipo, fontSize: 9, fill: "#f59e0b", position: "top" }}
          />
        ))}
        {estacaoAtiva != null && (
          <ReferenceLine x={estacaoAtiva / 1000} stroke="#22d3ee" strokeWidth={1.5} />
        )}
        <Line type="monotone" dataKey="terreno" stroke="#10b981" dot={false} strokeWidth={1.75} connectNulls={false} name="terreno" />
        <Line type="monotone" dataKey="greide" stroke="#ef4444" dot={false} strokeWidth={1.75} connectNulls={false} name="greide" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

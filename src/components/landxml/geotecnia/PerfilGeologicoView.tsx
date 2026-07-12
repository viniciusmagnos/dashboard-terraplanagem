/**
 * PerfilGeologicoView — horizontes geológicos oficiais extraídos do DWG de
 * perfil (bloco `perfil_geologico`). Mostra, por eixo, o perfil longitudinal
 * com terreno/greide e os topos de rocha RAM (2ª cat) e RAD (3ª cat) + NA, e
 * uma comparação do corte por categoria HORIZONTE × FURO (transparência da
 * origem do número que entra na economia).
 */
import { useMemo, useState } from "react";
import { Layers, Mountain } from "lucide-react";
import { fmt } from "../../../lib/format";
import { staToKmLabel } from "../../../lib/mtp";
import type {
  MtpGeotecnia,
  MtpLinhaHorizonte,
  MtpPerfilEixo,
  MtpPerfilGeologico,
} from "../../../lib/mtp";

export function PerfilGeologicoView({
  perfil,
  geo,
}: {
  perfil: MtpPerfilGeologico;
  geo: MtpGeotecnia | null;
}) {
  const [eixoId, setEixoId] = useState<string>(
    perfil.eixos[0]?.eixo_id ?? "",
  );
  const eixo = perfil.eixos.find((e) => e.eixo_id === eixoId) ?? perfil.eixos[0];

  // corte por categoria via furo (materiais) para comparar com o horizonte
  const furoPorEixo = useMemo(() => {
    const m = new Map<string, { c1: number; c2: number; c3: number }>();
    for (const e of geo?.materiais?.por_eixo ?? []) {
      m.set(e.eixo_id, { c1: e.corte_1cat, c2: e.corte_2cat, c3: e.corte_3cat });
    }
    return m;
  }, [geo]);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Mountain size={14} className="text-amber-400" />
            Perfil geológico — horizontes oficiais do projeto
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Topo de rocha interpretado pelo geólogo no DWG de perfil (RAM = 2ª
            cat, RAD/RS = 3ª cat). Onde há painel, o corte por categoria usa
            estes horizontes em vez de extrapolar o furo mais próximo.
          </p>
        </div>
        <select
          value={eixoId}
          onChange={(e) => setEixoId(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1 text-xs"
        >
          {perfil.eixos.map((e) => (
            <option key={e.eixo_id} value={e.eixo_id}>
              {e.eixo_id}
            </option>
          ))}
        </select>
      </div>

      {eixo && <PerfilSVG eixo={eixo} />}

      {/* comparação horizonte × furo */}
      <div className="border-t border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Eixo</th>
              <th className="px-3 py-2 text-right">Corte coberto</th>
              <th className="px-3 py-2 text-right text-emerald-400">1ª (horiz.)</th>
              <th className="px-3 py-2 text-right text-amber-400">2ª (horiz.)</th>
              <th className="px-3 py-2 text-right text-rose-400">3ª (horiz.)</th>
              <th className="px-3 py-2 text-right text-muted-foreground">
                2ª/3ª por furo
              </th>
            </tr>
          </thead>
          <tbody>
            {perfil.categorias_por_eixo.map((c) => {
              const f = furoPorEixo.get(c.eixo_id);
              const cob =
                c.v_corte_total > 0
                  ? Math.round((c.v_corte_coberto / c.v_corte_total) * 100)
                  : 0;
              return (
                <tr key={c.eixo_id} className="border-t border-border">
                  <td className="px-3 py-1.5">{c.eixo_id}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {cob}%
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(c.corte_1cat)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(c.corte_2cat)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(c.corte_3cat)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {f ? `${fmt(f.c2)} / ${fmt(f.c3)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {perfil.warnings.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground space-y-0.5">
          {perfil.warnings.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── SVG do perfil longitudinal com horizontes ─────────────── */

function PerfilSVG({ eixo }: { eixo: MtpPerfilEixo }) {
  const cena = useMemo(() => {
    const W = 900;
    const H = 260;
    const padX = 46;
    const padY = 16;

    const all: [number, number][] = [
      ...eixo.terreno,
      ...eixo.greide,
      ...eixo.topo_2cat.flatMap((l) => l.pts),
      ...eixo.topo_3cat.flatMap((l) => l.pts),
    ];
    if (all.length < 2) return null;
    const sMin = Math.min(...all.map((p) => p[0]));
    const sMax = Math.max(...all.map((p) => p[0]));
    const zMin = Math.min(...all.map((p) => p[1])) - 3;
    const zMax = Math.max(...all.map((p) => p[1])) + 3;
    const X = (s: number) =>
      padX + ((s - sMin) / Math.max(sMax - sMin, 1)) * (W - padX * 2);
    const Y = (z: number) =>
      H - padY - ((z - zMin) / Math.max(zMax - zMin, 1)) * (H - padY * 2);
    const path = (pts: [number, number][]) =>
      pts.length
        ? pts
            .map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`)
            .join("")
        : "";
    const paths = (lines: MtpLinhaHorizonte[]) => lines.map((l) => path(l.pts));
    return { W, H, X, Y, sMin, sMax, zMin, zMax, path, paths };
  }, [eixo]);

  if (!cena) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Sem geometria suficiente para plotar o perfil de {eixo.eixo_id}.
      </div>
    );
  }

  // ticks de cota
  const ticks: number[] = [];
  const step = Math.max(5, Math.round((cena.zMax - cena.zMin) / 6 / 5) * 5);
  for (let z = Math.ceil(cena.zMin / step) * step; z <= cena.zMax; z += step) {
    ticks.push(z);
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-1 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-emerald-500" /> terreno
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-cyan-400" /> greide
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-amber-400" /> topo RAM (2ª cat)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-rose-500" /> topo RAD/RS (3ª cat)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 border-t border-dashed border-sky-400" />{" "}
          NA
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Layers size={11} /> {staToKmLabel(eixo.sta_min_m)} →{" "}
          {staToKmLabel(eixo.sta_max_m)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${cena.W} ${cena.H}`}
        className="w-full h-auto bg-slate-900 rounded"
      >
        {ticks.map((z) => (
          <g key={z}>
            <line
              x1={cena.X(cena.sMin)}
              y1={cena.Y(z)}
              x2={cena.X(cena.sMax)}
              y2={cena.Y(z)}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <text x={4} y={cena.Y(z) + 3} fontSize={9} fill="#64748b">
              {z}
            </text>
          </g>
        ))}
        {/* greide + terreno */}
        <path d={cena.path(eixo.greide)} fill="none" stroke="#22d3ee" strokeWidth={1.3} />
        <path d={cena.path(eixo.terreno)} fill="none" stroke="#10b981" strokeWidth={1.5} />
        {/* horizontes de rocha */}
        {cena.paths(eixo.topo_3cat).map((d, i) => (
          <path key={`rad${i}`} d={d} fill="none" stroke="#f43f5e" strokeWidth={2} />
        ))}
        {cena.paths(eixo.topo_2cat).map((d, i) => (
          <path key={`ram${i}`} d={d} fill="none" stroke="#f59e0b" strokeWidth={2} />
        ))}
        {/* NA */}
        {cena.paths(eixo.na).map((d, i) => (
          <path
            key={`na${i}`}
            d={d}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        ))}
      </svg>
    </div>
  );
}

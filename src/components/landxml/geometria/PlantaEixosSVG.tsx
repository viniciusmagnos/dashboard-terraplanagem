/**
 * PlantaEixosSVG — traçados em planta (E/N do pacote v2, aspecto 1:1):
 * eixos coloridos por tipo, barreiras (OAE) e marcador da estação ativa.
 */
import { useMemo } from "react";
import { TracadoFrame } from "../../../lib/mtp-geometry";
import type { MtpBarreira, MtpGeometria, MtpPacote } from "../../../lib/mtp";
import { staToKmLabel } from "../../../lib/mtp";

const COR_TIPO: Record<string, string> = {
  rodovia: "#06b6d4",
  acesso: "#a78bfa",
  rotatoria: "#f472b6",
  transicao: "#94a3b8",
};

/** Ponto avulso na planta (ex.: furo de sondagem) — E/N já − world_offset. */
export interface PlantaPonto {
  id: string;
  e: number;
  n: number;
  cor?: string;
  rotulo?: string;
}

export function PlantaEixosSVG({
  pacote,
  geometria,
  eixoAtivoId,
  estacaoAtiva,
  barreiras,
  pontos,
  pontoAtivoId,
  altura = 300,
  onEixoClick,
  onPontoClick,
}: {
  pacote: MtpPacote;
  geometria: MtpGeometria;
  eixoAtivoId: string | null;
  estacaoAtiva: number | null;
  barreiras?: MtpBarreira[];
  /** Pontos avulsos (furos de sondagem etc.) plotados sobre os traçados. */
  pontos?: PlantaPonto[];
  pontoAtivoId?: string | null;
  altura?: number;
  onEixoClick?: (eixoId: string) => void;
  onPontoClick?: (id: string) => void;
}) {
  const W = 900;
  const tipoDe = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of pacote.eixos) m.set(e.id, e.tipo);
    return m;
  }, [pacote.eixos]);

  const geom = useMemo(() => {
    const eixos = geometria.eixos.filter((e) => (e.tracado?.en.length ?? 0) >= 4);
    if (!eixos.length) return null;
    let eMin = Infinity, eMax = -Infinity, nMin = Infinity, nMax = -Infinity;
    for (const ge of eixos) {
      const en = ge.tracado!.en;
      for (let i = 0; i + 1 < en.length; i += 2) {
        eMin = Math.min(eMin, en[i]);
        eMax = Math.max(eMax, en[i]);
        nMin = Math.min(nMin, en[i + 1]);
        nMax = Math.max(nMax, en[i + 1]);
      }
    }
    const pad = 20;
    const spanE = Math.max(eMax - eMin, 1);
    const spanN = Math.max(nMax - nMin, 1);
    const s = Math.min((W - pad * 2) / spanE, (altura - pad * 2) / spanN);
    const X = (e: number) => pad + (e - eMin) * s + ((W - pad * 2) - spanE * s) / 2;
    const Y = (n: number) => altura - pad - (n - nMin) * s - ((altura - pad * 2) - spanN * s) / 2;

    const paths = eixos.map((ge) => {
      const en = ge.tracado!.en;
      let d = "";
      for (let i = 0; i + 1 < en.length; i += 2) {
        d += `${i ? "L" : "M"}${X(en[i]).toFixed(1)},${Y(en[i + 1]).toFixed(1)}`;
      }
      return { id: ge.eixo_id, d, tipo: tipoDe.get(ge.eixo_id) ?? "rodovia" };
    });

    // marcador da estação ativa (no eixo ativo)
    let marcador: { x: number; y: number } | null = null;
    if (eixoAtivoId != null && estacaoAtiva != null) {
      const ge = eixos.find((e) => e.eixo_id === eixoAtivoId);
      if (ge?.tracado) {
        const frame = new TracadoFrame(ge.tracado);
        if (frame.valido) {
          const p = frame.locate(estacaoAtiva);
          marcador = { x: X(p.e), y: Y(p.n) };
        }
      }
    }

    // barreiras: ancoradas no eixo rodovia que contém a estação
    const marcasBarreira: { x: number; y: number; nome: string }[] = [];
    for (const b of barreiras ?? []) {
      for (const ge of eixos) {
        if ((tipoDe.get(ge.eixo_id) ?? "rodovia") !== "rodovia") continue;
        const t = ge.tracado!;
        const staFim = t.sta0_m + (t.en.length / 2 - 1) * t.passo_m;
        if (b.sta_m >= t.sta0_m && b.sta_m <= staFim) {
          const frame = new TracadoFrame(t);
          const p = frame.locate(b.sta_m);
          marcasBarreira.push({ x: X(p.e), y: Y(p.n), nome: b.nome || b.tipo });
          break;
        }
      }
    }
    const pts = (pontos ?? []).map((p) => ({
      ...p,
      x: X(p.e),
      y: Y(p.n),
    }));
    return { paths, marcador, marcasBarreira, pts };
  }, [geometria, altura, tipoDe, eixoAtivoId, estacaoAtiva, barreiras, pontos]);

  if (!geom) {
    return (
      <p className="text-sm text-muted-foreground">Pacote sem traçados em planta.</p>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${altura}`} className="w-full h-auto bg-slate-900 rounded-lg">
      {geom.paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={COR_TIPO[p.tipo] ?? "#06b6d4"}
          strokeWidth={p.id === eixoAtivoId ? 3 : 1.5}
          strokeOpacity={p.id === eixoAtivoId ? 1 : 0.6}
          className={onEixoClick ? "cursor-pointer" : undefined}
          onClick={() => onEixoClick?.(p.id)}
        >
          <title>{p.id}</title>
        </path>
      ))}
      {geom.pts.map((p) => (
        <g
          key={p.id}
          className={onPontoClick ? "cursor-pointer" : undefined}
          onClick={() => onPontoClick?.(p.id)}
        >
          <circle
            cx={p.x}
            cy={p.y}
            r={p.id === pontoAtivoId ? 5 : 3}
            fill={p.cor ?? "#34d399"}
            fillOpacity={p.id === pontoAtivoId ? 1 : 0.75}
            stroke={p.id === pontoAtivoId ? "#f8fafc" : "none"}
            strokeWidth={1}
          />
          <title>{p.rotulo ?? p.id}</title>
        </g>
      ))}
      {geom.marcasBarreira.map((m, i) => (
        <g key={i}>
          <circle cx={m.x} cy={m.y} r={5} fill="none" stroke="#f59e0b" strokeWidth={2} />
          <title>{m.nome}</title>
        </g>
      ))}
      {geom.marcador && (
        <g>
          <circle cx={geom.marcador.x} cy={geom.marcador.y} r={6} fill="#22d3ee" fillOpacity={0.9} />
          <circle cx={geom.marcador.x} cy={geom.marcador.y} r={10} fill="none" stroke="#22d3ee" strokeOpacity={0.5} />
          {estacaoAtiva != null && (
            <text x={geom.marcador.x + 12} y={geom.marcador.y - 8} fontSize={10} fill="#22d3ee">
              {staToKmLabel(estacaoAtiva)}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * DiagramaLinearEixos — planta linear do projeto a partir dos bins do
 * pacote: um strip SVG por eixo (corte para cima em laranja, aterro para
 * baixo em verde), régua de km, barreiras (OAEs) e a faixa de segmentos do
 * Brückner com o residual de cada segmento (sobra→BF / falta→empréstimo).
 */
import { useMemo } from "react";
import { fmt } from "../../lib/format";
import { staToKmLabel, type MtpBarreira, type MtpBin, type MtpEixo, type MtpPacote } from "../../lib/mtp";
import type { BrucknerResult } from "../../lib/bruckner";

const COR_CORTE = "#f97316";
const COR_ATERRO = "#22c55e";
const COR_BARREIRA = "#f59e0b";
const W = 1000;

function niceStep(alvo: number): number {
  const candidatos = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  for (const c of candidatos) if (c >= alvo) return c;
  return candidatos[candidatos.length - 1];
}

function Regua({
  sta0,
  sta1,
  sx,
  y,
}: {
  sta0: number;
  sta1: number;
  sx: (s: number) => number;
  y: number;
}) {
  const ext = sta1 - sta0;
  const step = niceStep(ext / 8);
  const ticks: number[] = [];
  for (let s = Math.ceil(sta0 / step) * step; s <= sta1 + 1e-6; s += step) {
    ticks.push(s);
  }
  return (
    <g>
      <line x1={0} y1={y} x2={W} y2={y} stroke="#475569" strokeWidth={0.75} />
      {ticks.map((s) => (
        <g key={s}>
          <line x1={sx(s)} y1={y} x2={sx(s)} y2={y + 4} stroke="#475569" strokeWidth={0.75} />
          <text x={sx(s)} y={y + 13} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {staToKmLabel(s)}
          </text>
        </g>
      ))}
    </g>
  );
}

function EixoStrip({
  eixo,
  bins,
  barreiras,
}: {
  eixo: MtpEixo;
  bins: MtpBin[];
  barreiras: MtpBarreira[];
}) {
  const principal = eixo.tipo === "rodovia";
  const hMeia = principal ? 34 : 20;
  const yCentro = hMeia + 14;
  const hTotal = yCentro + hMeia + 22;

  const sta0 = Math.min(eixo.sta_inicio_m, bins[0]?.sta_a ?? eixo.sta_inicio_m);
  const sta1 = Math.max(eixo.sta_fim_m, bins[bins.length - 1]?.sta_b ?? eixo.sta_fim_m);
  const span = Math.max(sta1 - sta0, 1);
  const sx = (s: number) => ((s - sta0) / span) * W;

  const vmax = useMemo(
    () => Math.max(1, ...bins.map((b) => Math.max(b.v_corte, b.v_aterro))),
    [bins],
  );

  const barreirasDoEixo = barreiras.filter(
    (b) => b.sta_m >= sta0 - 1 && b.sta_m <= sta1 + 1,
  );

  return (
    <div className="px-4 py-3 border-t border-border first:border-t-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-sm">
          {eixo.nome}{" "}
          <span className="text-xs text-muted-foreground capitalize">
            ({eixo.tipo} · {fmt(eixo.extensao_m / 1000, 2)} km)
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          corte {fmt(eixo.volumes.corte_total)} m³ · aterro{" "}
          {fmt(eixo.volumes.aterro)} m³
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${hTotal}`} className="w-full h-auto block">
        {/* rótulos corte/aterro */}
        <text x={2} y={10} fontSize={8.5} fill={COR_CORTE}>
          CORTE ↑
        </text>
        <text x={2} y={yCentro + hMeia - 2} fontSize={8.5} fill={COR_ATERRO}>
          ATERRO ↓
        </text>
        {/* barras por bin */}
        {bins.map((b, i) => {
          const x = sx(b.sta_a);
          const w = Math.max(sx(b.sta_b) - x, 0.4);
          const hc = (b.v_corte / vmax) * hMeia;
          const ha = (b.v_aterro / vmax) * hMeia;
          return (
            <g key={i}>
              <title>
                {`${staToKmLabel(b.sta_a)} → ${staToKmLabel(b.sta_b)}\ncorte ${fmt(b.v_corte, 1)} m³ · aterro ${fmt(b.v_aterro, 1)} m³`}
              </title>
              {b.v_corte > 0 && (
                <rect x={x} y={yCentro - hc} width={w} height={hc} fill={COR_CORTE} fillOpacity={0.85} />
              )}
              {b.v_aterro > 0 && (
                <rect x={x} y={yCentro} width={w} height={ha} fill={COR_ATERRO} fillOpacity={0.85} />
              )}
            </g>
          );
        })}
        {/* linha do eixo */}
        <line x1={0} y1={yCentro} x2={W} y2={yCentro} stroke="#64748b" strokeWidth={1} />
        {/* barreiras */}
        {barreirasDoEixo.map((b) => (
          <g key={b.sta_m}>
            <line
              x1={sx(b.sta_m)}
              y1={4}
              x2={sx(b.sta_m)}
              y2={yCentro + hMeia}
              stroke={COR_BARREIRA}
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
            <title>{`${b.nome || b.tipo} — ${staToKmLabel(b.sta_m)}`}</title>
          </g>
        ))}
        <Regua sta0={sta0} sta1={sta1} sx={sx} y={yCentro + hMeia + 4} />
      </svg>
    </div>
  );
}

function FaixaSegmentos({
  bruckner,
  sta0,
  sta1,
  barreiras,
}: {
  bruckner: BrucknerResult;
  sta0: number;
  sta1: number;
  barreiras: MtpBarreira[];
}) {
  const span = Math.max(sta1 - sta0, 1);
  const sx = (s: number) => ((s - sta0) / span) * W;
  const H = 52;
  return (
    <div className="px-4 py-3">
      <p className="text-sm mb-1">
        Segmentos de compensação (Brückner do cenário ativo)
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
        {bruckner.segments.map((s, i) => {
          const x = sx(s.sta_start);
          const w = Math.max(sx(s.sta_end) - x, 2);
          const sobra = s.residual_m3 >= 0;
          return (
            <g key={i}>
              <rect
                x={x}
                y={10}
                width={w}
                height={22}
                rx={3}
                fill={sobra ? "#f59e0b" : "#06b6d4"}
                fillOpacity={0.14}
                stroke={sobra ? "#f59e0b" : "#06b6d4"}
                strokeOpacity={0.5}
                strokeWidth={0.75}
              />
              <title>
                {`${staToKmLabel(s.sta_start)} → ${staToKmLabel(s.sta_end)} (${s.reason_start} → ${s.reason_end})\nmomento ${fmt(s.momento_m3km, 1)} m³·km · DMT ${fmt(s.dmt_medio_m)} m\nresidual ${fmt(s.residual_m3)} m³ (${sobra ? "sobra → bota-fora" : "falta → empréstimo"})`}
              </title>
              {w > 70 && (
                <text
                  x={x + w / 2}
                  y={24}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill={sobra ? "#f59e0b" : "#06b6d4"}
                >
                  {sobra ? "sobra → BF " : "falta ← EMP "}
                  {fmt(Math.abs(s.residual_m3))} m³
                </text>
              )}
            </g>
          );
        })}
        {barreiras.map((b) => (
          <g key={b.sta_m}>
            <line
              x1={sx(b.sta_m)}
              y1={4}
              x2={sx(b.sta_m)}
              y2={38}
              stroke={COR_BARREIRA}
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
            {(() => {
              const x = sx(b.sta_m);
              const anchor = x < 60 ? "start" : x > W - 60 ? "end" : "middle";
              return (
                <text x={x} y={48} textAnchor={anchor} fontSize={8.5} fill={COR_BARREIRA}>
                  {b.nome || b.tipo}
                </text>
              );
            })()}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DiagramaLinearEixos({
  pacote,
  bruckner,
  barreirasVisiveis,
}: {
  pacote: MtpPacote;
  /** Brückner do cenário ativo (ou o embutido no pacote). */
  bruckner: BrucknerResult | null;
  barreirasVisiveis?: MtpBarreira[];
}) {
  const barreiras = barreirasVisiveis ?? pacote.barreiras;

  const binsPorEixo = useMemo(() => {
    const map = new Map<string, MtpBin[]>();
    for (const b of pacote.bins) {
      const lista = map.get(b.eixo_id);
      if (lista) lista.push(b);
      else map.set(b.eixo_id, [b]);
    }
    for (const lista of map.values()) lista.sort((a, b) => a.sta_a - b.sta_a);
    return map;
  }, [pacote.bins]);

  const eixosOrdenados = useMemo(() => {
    const peso = (t: string) => (t === "rodovia" ? 0 : t === "acesso" ? 1 : 2);
    return [...pacote.eixos].sort(
      (a, b) => peso(a.tipo) - peso(b.tipo) || a.nome.localeCompare(b.nome),
    );
  }, [pacote.eixos]);

  const rodovias = eixosOrdenados.filter((e) => e.tipo === "rodovia");
  const faixaSta0 = Math.min(...rodovias.map((e) => e.sta_inicio_m));
  const faixaSta1 = Math.max(...rodovias.map((e) => e.sta_fim_m));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm" style={{ background: COR_CORTE }} />
          corte (para cima)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm" style={{ background: COR_ATERRO }} />
          aterro (para baixo)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0 border-t-2 border-dashed" style={{ borderColor: COR_BARREIRA }} />
          barreira (OAE)
        </span>
        <span className="text-[11px]">
          altura das barras ∝ volume por estaca de {pacote.bins_meta.largura_m} m
          (escala própria por eixo)
        </span>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {bruckner && rodovias.length > 0 && (
          <FaixaSegmentos
            bruckner={bruckner}
            sta0={faixaSta0}
            sta1={faixaSta1}
            barreiras={barreiras}
          />
        )}
        {eixosOrdenados.map((e) => {
          const bins = binsPorEixo.get(e.id) ?? [];
          if (!bins.length) return null;
          return <EixoStrip key={e.id} eixo={e} bins={bins} barreiras={barreiras} />;
        })}
      </div>
    </div>
  );
}

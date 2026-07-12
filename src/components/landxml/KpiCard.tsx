/**
 * KpiCard — cartão de indicador com valor animado (count-up), chip de
 * proveniência opcional e delta % vs caso base (verde/vermelho).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "../../lib/format";

function useValorAnimado(alvo: number | null, duracaoMs = 350): number | null {
  const [v, setV] = useState<number | null>(alvo);
  const atual = useRef<number | null>(alvo);
  useEffect(() => {
    if (alvo == null || atual.current == null) {
      atual.current = alvo;
      setV(alvo);
      return;
    }
    const de = atual.current;
    if (de === alvo) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duracaoMs);
      const e = 1 - (1 - k) ** 3; // easeOutCubic
      const val = de + (alvo - de) * e;
      atual.current = val;
      setV(val);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracaoMs]);
  return v;
}

export function KpiCard({
  rotulo,
  valor,
  formato,
  sufixo,
  chip,
  deltaPct,
  deltaBomQuandoNegativo = true,
  rodape,
}: {
  rotulo: string;
  valor: number | null;
  /** Formatador do número animado (default: fmt pt-BR inteiro). */
  formato?: (v: number) => string;
  sufixo?: string;
  chip?: ReactNode;
  /** Delta % vs caso base; omitido quando null/undefined ou ~0. */
  deltaPct?: number | null;
  /** true (default): delta negativo = melhora (custos/momento). */
  deltaBomQuandoNegativo?: boolean;
  rodape?: ReactNode;
}) {
  const animado = useValorAnimado(valor);
  const f = formato ?? ((v: number) => fmt(v));
  const mostraDelta =
    deltaPct != null && Number.isFinite(deltaPct) && Math.abs(deltaPct) >= 0.05;
  const deltaBom = mostraDelta
    ? deltaBomQuandoNegativo
      ? deltaPct! < 0
      : deltaPct! > 0
    : false;
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center justify-between gap-1">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        {chip}
      </div>
      <p className="text-base font-semibold mt-1 tabular-nums">
        {animado == null ? "—" : f(animado)}
        {sufixo ? (
          <span className="text-xs font-normal text-muted-foreground">
            {" "}
            {sufixo}
          </span>
        ) : null}
        {mostraDelta && (
          <span
            className={`ml-1.5 text-xs font-medium ${
              deltaBom ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {deltaPct! > 0 ? "+" : ""}
            {deltaPct!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        )}
      </p>
      {rodape ? (
        <div className="text-[11px] text-muted-foreground mt-0.5">{rodape}</div>
      ) : null}
    </div>
  );
}

/**
 * UmidadeMaterialView — volumes de corte por faixa de UMIDADE NATURAL do
 * material, cruzando os ensaios de laboratório dos furos (w_nat por intervalo
 * de profundidade) com os bins de corte de 20 m. Mostra a tabela eixo × faixa
 * e os TRECHOS contíguos acima de um limiar ("≥50% do km A ao km B: N m³").
 */
import { useMemo, useState } from "react";
import { Droplets } from "lucide-react";
import {
  rotuloBanda,
  trechosUmidade,
  umidadeCortePorEixo,
} from "../../../lib/geotecnia-analise";
import { fmt } from "../../../lib/format";
import { geotecniaDe, staToKmLabel, type MtpPacote } from "../../../lib/mtp";

const LIMIARES = [30, 40, 50];

export function UmidadeMaterialView({
  pacote,
  onIrParaSecao,
}: {
  pacote: MtpPacote;
  onIrParaSecao?: (eixoId: string, staM: number) => void;
}) {
  const [limiar, setLimiar] = useState(40);

  const r = useMemo(() => {
    const geo = geotecniaDe(pacote);
    if (!geo) return null;
    return umidadeCortePorEixo(pacote.bins, geo, pacote.geometria ?? null);
  }, [pacote]);

  const trechos = useMemo(
    () => (r ? trechosUmidade(r.rows, limiar) : []),
    [r, limiar],
  );

  if (!r) return null;
  const nb = r.bandas.length + 1;
  const pctCoberto =
    r.total.v_corte_total > 0
      ? Math.round((100 * r.total.v_coberto) / r.total.v_corte_total)
      : 0;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Droplets size={14} className="text-sky-400" />
          Umidade natural do material escavado (m³ por faixa)
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Ensaios de laboratório ({r.n_amostras} amostras de {r.n_furos_ensaio}{" "}
          furos) cruzados com o corte por bin de 20 m — furo ensaiado mais
          próximo (≤ 300 m), rateio pela profundidade amostrada; a amostra mais
          funda é extrapolada até o fundo do corte. Cobertura:{" "}
          {fmt(r.total.v_coberto, 0)} m³ ({pctCoberto}% do corte), w̄{" "}
          {r.total.w_medio?.toFixed(1) ?? "—"}%
          {r.total.dw_ot != null && (
            <> · {r.total.dw_ot >= 0 ? "+" : ""}{r.total.dw_ot.toFixed(1)} p.p. acima da ótima</>
          )}
          .
        </p>
      </div>

      {/* eixo × faixa */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-3 py-2">Eixo</th>
              <th className="px-3 py-2 text-right">Corte (m³)</th>
              {Array.from({ length: nb }, (_, i) => (
                <th key={i} className="px-3 py-2 text-right whitespace-nowrap">
                  {rotuloBanda(i, r.bandas)}
                </th>
              ))}
              <th className="px-3 py-2 text-right">s/ ensaio</th>
              <th className="px-3 py-2 text-right">s/ furo</th>
              <th className="px-3 py-2 text-right">w̄ (%)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Δ ótima</th>
            </tr>
          </thead>
          <tbody>
            {[...r.porEixo, r.total].map((a) => {
              const total = a.eixo_id === "TOTAL";
              return (
                <tr
                  key={a.eixo_id}
                  className={
                    total
                      ? "border-t-2 border-border font-medium"
                      : "border-t border-border/40"
                  }
                >
                  <td className="px-3 py-1.5">{total ? "TOTAL" : a.eixo_id}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmt(a.v_corte_total, 0)}
                  </td>
                  {a.porBanda.map((v, i) => (
                    <td
                      key={i}
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        v > 0.5 && i >= nb - 2 ? "text-sky-300" : ""
                      } ${v > 0.5 ? "" : "text-muted-foreground/50"}`}
                    >
                      {v > 0.5 ? fmt(v, 0) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {a.v_sem_ensaio > 0.5 ? fmt(a.v_sem_ensaio, 0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {a.v_sem_furo > 0.5 ? fmt(a.v_sem_furo, 0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {a.w_medio != null ? a.w_medio.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {a.dw_ot != null
                      ? `${a.dw_ot >= 0 ? "+" : ""}${a.dw_ot.toFixed(1)}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* trechos acima do limiar */}
      <div className="px-4 py-2.5 border-t border-border flex items-center gap-2">
        <p className="text-xs font-medium">Regiões com umidade elevada</p>
        <div className="flex gap-1 ml-2">
          {LIMIARES.map((w) => (
            <button
              key={w}
              onClick={() => setLimiar(w)}
              className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
                limiar === w
                  ? "border-sky-400 text-sky-300 bg-sky-400/10"
                  : "border-border text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              ≥{w}%
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {trechos.length} trecho{trechos.length === 1 ? "" : "s"}
        </span>
      </div>
      {trechos.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-3 py-2">Eixo</th>
                <th className="px-3 py-2">Trecho</th>
                <th className="px-3 py-2 text-right">Ext. (m)</th>
                <th className="px-3 py-2 text-right">m³ (w ≥ {limiar}%)</th>
                <th className="px-3 py-2 text-right">extrapolado</th>
                <th className="px-3 py-2 text-right">w (%)</th>
                <th className="px-3 py-2">Furos</th>
              </tr>
            </thead>
            <tbody>
              {trechos.map((t, i) => (
                <tr
                  key={i}
                  className={`border-t border-border/40 ${
                    onIrParaSecao ? "cursor-pointer hover:bg-surface-hover" : ""
                  }`}
                  onClick={() =>
                    onIrParaSecao?.(t.eixo_id, (t.sta_a + t.sta_b) / 2)
                  }
                  title={onIrParaSecao ? "Ver seção no meio do trecho" : undefined}
                >
                  <td className="px-3 py-1.5">{t.eixo_id}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {staToKmLabel(t.sta_a)} → {staToKmLabel(t.sta_b)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmt(t.sta_b - t.sta_a, 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-sky-300">
                    {fmt(t.v_m3 + t.v_extrap_m3, 0)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {t.v_extrap_m3 > 0.5 ? fmt(t.v_extrap_m3, 0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">
                    {t.w_min === t.w_max
                      ? t.w_medio.toFixed(1)
                      : `${t.w_min.toFixed(1)}–${t.w_max.toFixed(1)} (${t.w_medio.toFixed(1)})`}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    {t.furos.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Nenhum trecho com umidade ≥ {limiar}% no corte coberto pelos ensaios.
        </p>
      )}
      <p className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
        "Δ ótima" = w natural − w ótima do Proctor (p.p.; positivo = material
        mais úmido que a ótima de compactação). Volumes "extrapolados" estendem
        a última amostra do furo até o fundo do corte — trate como indicativo.
      </p>
    </div>
  );
}

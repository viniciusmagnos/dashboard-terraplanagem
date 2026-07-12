import { useMemo } from "react";
import { X } from "lucide-react";
import { fmt } from "../../lib/format";
import { staToKmLabel } from "../../lib/mtp";
import { BrucknerChart } from "../landxml/BrucknerChart";
import { BrucknerLegenda } from "../landxml/BrucknerLegenda";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { useLayoutSeguro } from "../dynamic/LayoutContext";
import { useSeriesResolvidas } from "../../lib/dashboard-bindings";
import { ChipIa } from "../dynamic/ChipIa";

/** Brückner e DMT: curva de massas + segmentos/residuais + faixas de DMT. */
export function BrucknerTab({
  onIrParaSecao,
}: {
  onIrParaSecao?: (sta: number) => void;
}) {
  const { pacote } = useEstudo();
  const br = pacote.bruckner ?? null;

  // Séries extras do assistente (overlays da Dashboard Spec, grafico="bruckner").
  const layout = useLayoutSeguro();
  const overlays = useMemo(
    () => (layout?.spec.overlays ?? []).filter((o) => o.grafico === "bruckner"),
    [layout?.spec.overlays],
  );
  const resolvidas = useSeriesResolvidas(overlays);
  const seriesExtras = useMemo(
    () =>
      overlays.map((o) => ({
        id: o.id,
        nome: o.nome || o.id,
        cor: o.cor,
        tracejada: o.tracejada,
        curve: resolvidas.get(o.id)?.valor ?? [],
      })),
    [overlays, resolvidas],
  );
  const overlaysComErro = overlays
    .map((o) => {
      const erro = resolvidas.get(o.id)?.erro;
      return erro ? `${o.nome || o.id}: ${erro}` : null;
    })
    .filter((e): e is string => e != null);

  const totais = useMemo(() => {
    if (!br) return { vol: 0, mom: 0 };
    return {
      vol: Object.values(br.faixas).reduce((a, v) => a + v, 0),
      mom: Object.values(br.faixas_momento).reduce((a, v) => a + v, 0),
    };
  }, [br]);

  if (!br) {
    return (
      <p className="text-sm text-muted-foreground">Pacote sem resultado Brückner.</p>
    );
  }

  return (
    <div className="space-y-4">
      <BrucknerChart
        curve={br.curve}
        barreiras={pacote.barreiras}
        onStationClick={pacote.geometria ? onIrParaSecao : undefined}
        seriesExtras={seriesExtras}
      />

      {overlays.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <ChipIa />
          <span className="text-muted-foreground">Séries do assistente:</span>
          {overlays.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-0.5"
            >
              {o.nome || o.id}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remover a série "${o.nome || o.id}"?`)) {
                    void layout?.removerSerie("bruckner", o.id);
                  }
                }}
                className="text-muted-foreground hover:text-danger"
                title="Remover série"
                aria-label={`Remover série ${o.nome || o.id}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {overlaysComErro.length > 0 && (
            <span className="text-warning">
              (indisponíveis: {overlaysComErro.join("; ")})
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Segmentos e residuais
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Trecho</th>
                  <th className="px-3 py-2 text-right">Compensado</th>
                  <th className="px-3 py-2 text-right">Momento (m³·km)</th>
                  <th className="px-3 py-2 text-right">DMT (m)</th>
                  <th className="px-3 py-2 text-right">Residual</th>
                </tr>
              </thead>
              <tbody>
                {br.segments.map((s, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {staToKmLabel(s.sta_start)} → {staToKmLabel(s.sta_end)}
                      <span className="block text-[11px] text-muted-foreground">
                        {s.reason_start} → {s.reason_end}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(s.volume_compensado)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.momento_m3km, 1)}</td>
                    <td className="px-3 py-2 text-right">{fmt(s.dmt_medio_m)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={s.residual_m3 >= 0 ? "text-warning" : "text-info"}>
                        {fmt(s.residual_m3)}
                        <span className="block text-[11px]">
                          {s.residual_m3 >= 0 ? "sobra → BF" : "falta → empréstimo"}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Faixas de DMT (bandas DNIT — insumo p/ preço SICRO)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Faixa (m)</th>
                  <th className="px-3 py-2 text-right">Volume (m³)</th>
                  <th className="px-3 py-2 text-right">Momento (m³·km)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(br.faixas)
                  .sort((a, b) => parseFloat(a) - parseFloat(b))
                  .map((faixa) => (
                    <tr key={faixa} className="border-t border-border">
                      <td className="px-3 py-2">{faixa}</td>
                      <td className="px-3 py-2 text-right">{fmt(br.faixas[faixa])}</td>
                      <td className="px-3 py-2 text-right">
                        {fmt(br.faixas_momento[faixa] ?? 0, 2)}
                      </td>
                    </tr>
                  ))}
                <tr className="border-t border-border font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{fmt(totais.vol)}</td>
                  <td className="px-3 py-2 text-right">{fmt(totais.mom, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BrucknerLegenda />
    </div>
  );
}

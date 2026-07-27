/**
 * LitologiaCorteView — corte em rocha DETALHADO POR LITOLOGIA (argilito /
 * arenito / basalto…), cruzando as rachuras do perfil geológico (estratos com
 * litologia + categoria) com o corte por bin. Responde "km A até km B: X m³
 * de argilito e Y m³ de arenito" para a 3ª (e 2ª) categoria.
 */
import { useMemo } from "react";
import { Mountain } from "lucide-react";
import {
  litologiaCortePorEixo,
  trechosLitologia,
  type LitologiaEixo,
  type TrechoLitologia,
} from "../../../lib/geotecnia-analise";
import { fmt } from "../../../lib/format";
import {
  perfilGeologicoDe,
  staToKmLabel,
  type MtpPacote,
} from "../../../lib/mtp";

const COR_CAT: Record<number, string> = { 1: "#34d399", 2: "#f59e0b", 3: "#f43f5e" };

export function LitologiaCorteView({
  pacote,
  onIrParaSecao,
}: {
  pacote: MtpPacote;
  onIrParaSecao?: (eixoId: string, staM: number) => void;
}) {
  const dados = useMemo(() => {
    const pg = perfilGeologicoDe(pacote);
    if (!pg) return null;
    const eixos: LitologiaEixo[] = [];
    const trechos: TrechoLitologia[] = [];
    for (const pe of pg.eixos) {
      const r = litologiaCortePorEixo(pe, pacote.bins);
      if (!r) continue;
      eixos.push(r);
      trechos.push(...trechosLitologia(r.rows, 3), ...trechosLitologia(r.rows, 2));
    }
    if (!eixos.length) return null;
    trechos.sort(
      (a, b) =>
        b.categoria - a.categoria ||
        a.eixo_id.localeCompare(b.eixo_id) ||
        a.sta_a - b.sta_a,
    );
    return { pg, eixos, trechos };
  }, [pacote]);

  if (!dados) return null;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Mountain size={14} className="text-rose-400" />
          Corte em rocha por litologia (2ª/3ª categoria)
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Rachuras do perfil geológico (litologia × grau de alteração) cruzadas
          com o corte por bin de 20 m — detalha O QUE é a rocha de cada trecho
          (SR = solo residual → 1ª; RAM → 2ª; RAD/RS → 3ª).
        </p>
      </div>

      {/* totais por eixo × litologia */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-3 py-2">Eixo</th>
              <th className="px-3 py-2 text-right">Corte (m³)</th>
              <th className="px-3 py-2">Por litologia (m³)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">
                Σ 3ª cat
              </th>
              <th className="px-3 py-2 text-right whitespace-nowrap">
                3ª horizontes
              </th>
            </tr>
          </thead>
          <tbody>
            {dados.eixos.map((e) => {
              const c3 = e.totais
                .filter((t) => t.categoria === 3)
                .reduce((s, t) => s + t.v_m3, 0);
              const hz = dados.pg.categorias_por_eixo.find(
                (c) => c.eixo_id === e.eixo_id,
              );
              const rocha = e.totais.filter((t) => t.categoria >= 2);
              return (
                <tr key={e.eixo_id} className="border-t border-border/40 align-top">
                  <td className="px-3 py-1.5 font-medium">{e.eixo_id}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmt(e.v_corte_total, 0)}
                  </td>
                  <td className="px-3 py-1.5">
                    {rocha.length === 0 ? (
                      <span className="text-muted-foreground text-xs">
                        sem rocha no corte (tudo 1ª cat)
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {rocha.map((t) => (
                          <span
                            key={`${t.litologia}|${t.categoria}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-xs tabular-nums"
                            style={{ color: COR_CAT[t.categoria] }}
                          >
                            {t.categoria}ª {t.litologia}: {fmt(t.v_m3, 0)}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td
                    className="px-3 py-1.5 text-right tabular-nums"
                    style={{ color: COR_CAT[3] }}
                  >
                    {c3 > 0.5 ? fmt(c3, 0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {hz ? fmt(hz.corte_3cat, 0) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* trechos */}
      {dados.trechos.length > 0 && (
        <>
          <p className="px-4 py-2.5 border-t border-border text-xs font-medium">
            Trechos com rocha no corte
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-3 py-2">Cat.</th>
                  <th className="px-3 py-2">Eixo</th>
                  <th className="px-3 py-2">Trecho</th>
                  <th className="px-3 py-2 text-right">Ext. (m)</th>
                  <th className="px-3 py-2 text-right">m³</th>
                  <th className="px-3 py-2">Por litologia</th>
                </tr>
              </thead>
              <tbody>
                {dados.trechos.map((t, i) => (
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
                    <td
                      className="px-3 py-1.5 font-medium"
                      style={{ color: COR_CAT[t.categoria] }}
                    >
                      {t.categoria}ª
                    </td>
                    <td className="px-3 py-1.5">{t.eixo_id}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {staToKmLabel(t.sta_a)} → {staToKmLabel(t.sta_b)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {fmt(t.sta_b - t.sta_a, 0)}
                    </td>
                    <td
                      className="px-3 py-1.5 text-right tabular-nums"
                      style={{ color: COR_CAT[t.categoria] }}
                    >
                      {fmt(t.v_total_m3, 0)}
                    </td>
                    <td className="px-3 py-1.5 text-xs">
                      {t.porLito
                        .map((l) => `${fmt(l.v_m3, 0)} m³ ${l.litologia}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
        Cobre os eixos com painel no DWG de perfil geológico. "3ª horizontes" =
        método do topo de rocha (RAM/RAD) para conferência — os dois devem
        convergir; a litologia detalha a composição.
      </p>
    </div>
  );
}

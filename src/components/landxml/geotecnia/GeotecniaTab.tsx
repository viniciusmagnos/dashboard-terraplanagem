/**
 * GeotecniaTab — sondagens do projeto (bloco `sondagens` do .mtp.json).
 *
 * Fontes: PDFs de sondagem extraídos pelo backend sondagem
 * (`scripts/extract_sondagens.py`) e projetados nos eixos pelo builder do
 * pacote. A aba mostra: KPIs, planta com os furos, perfil longitudinal com
 * "palitos" SPT (cota → cota − profundidade, solo mole em âmbar, NA em
 * azul), tabela filtrável e ocorrências de solo mole para alimentar as
 * premissas dos cenários.
 */
import { useMemo, useState } from "react";
import { FileSpreadsheet, FlaskConical } from "lucide-react";
import { fmt } from "../../../lib/format";
import { urlExportEstudo } from "../../../lib/estudo-api";
import { useEstudo } from "../cenarios/EstudoContext";
import {
  geotecniaDe,
  perfilGeologicoDe,
  staToKmLabel,
  type MtpEnsaioLab,
  type MtpGeometria,
  type MtpPacote,
  type MtpSondagem,
} from "../../../lib/mtp";
import { terrenoAt } from "../../../lib/mtp-geometry";
import { KpiCard } from "../KpiCard";
import { ProvChip } from "../ProvChip";
import { PlantaEixosSVG, type PlantaPonto } from "../geometria/PlantaEixosSVG";
import { PerfilGeologicoView } from "./PerfilGeologicoView";

const COR_TIPO: Record<string, string> = {
  percussao: "#34d399",
  trado: "#fbbf24",
  mista: "#a78bfa",
  poco: "#38bdf8",
  desconhecido: "#94a3b8",
};

const ROTULO_TIPO: Record<string, string> = {
  percussao: "Percussão (SPT)",
  trado: "Trado",
  mista: "Mista",
  poco: "Poço de inspeção",
  desconhecido: "Desconhecido",
};

export function GeotecniaTab({
  pacote,
  onIrParaSecao,
}: {
  pacote: MtpPacote;
  onIrParaSecao?: (eixoId: string, staM: number) => void;
}) {
  const geo = geotecniaDe(pacote);
  const perfilGeo = perfilGeologicoDe(pacote);
  const { estudoId } = useEstudo();
  const [filtroEixo, setFiltroEixo] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [ativa, setAtiva] = useState<string | null>(null);

  const exportarFuro = (sondagemId: string) => {
    if (!estudoId) return;
    const a = document.createElement("a");
    a.href = urlExportEstudo(estudoId, "geotecnia", { sondagemId });
    a.download = "";
    a.click();
  };

  const eixosComFuro = useMemo(() => {
    if (!geo) return [];
    const ids = new Set(
      geo.sondagens.filter((s) => s.eixo_id).map((s) => s.eixo_id as string),
    );
    return pacote.eixos.filter((e) => ids.has(e.id)).map((e) => e.id);
  }, [geo, pacote.eixos]);

  const visiveis = useMemo(() => {
    if (!geo) return [];
    return geo.sondagens.filter((s) => {
      if (filtroTipo !== "todos" && s.tipo !== filtroTipo) return false;
      if (filtroEixo === "todos") return true;
      if (filtroEixo === "sem-posicao") return !s.eixo_id;
      return s.eixo_id === filtroEixo;
    });
  }, [geo, filtroEixo, filtroTipo]);

  const soloMole = useMemo(
    () =>
      (geo?.sondagens ?? [])
        .filter((s) => s.solo_mole_ate_m != null && s.eixo_id)
        .sort(
          (a, b) =>
            (a.eixo_id ?? "").localeCompare(b.eixo_id ?? "") ||
            (a.sta_m ?? 0) - (b.sta_m ?? 0),
        ),
    [geo],
  );

  const pontosPlanta = useMemo<PlantaPonto[]>(() => {
    const g = pacote.geometria;
    if (!geo || !g) return [];
    const [we, wn] = g.world_offset;
    return geo.sondagens
      .filter((s) => s.este != null && s.norte != null && s.eixo_id)
      .map((s) => ({
        id: s.id,
        e: (s.este as number) - we,
        n: (s.norte as number) - wn,
        cor: COR_TIPO[s.tipo] ?? COR_TIPO.desconhecido,
        rotulo: `${s.id} · ${ROTULO_TIPO[s.tipo] ?? s.tipo}${
          s.prof_total_m ? ` · ${fmt(s.prof_total_m, 1)} m` : ""
        }`,
      }));
  }, [geo, pacote.geometria]);

  if (!geo) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-sm text-muted-foreground space-y-2">
        <p className="flex items-center gap-2 text-foreground font-medium">
          <FlaskConical size={16} className="text-emerald-400" />
          Este pacote não tem o bloco de sondagens.
        </p>
        <p>
          Extraia os boletins PDF com{" "}
          <code>python scripts/extract_sondagens.py --pdf "…/*.pdf" --out sondagens.json</code>{" "}
          e gere o pacote com <code>--sondagens-json sondagens.json</code> (CLI) — ou
          anexe o <code>sondagens.json</code> no formulário de geração do dashboard.
        </p>
      </div>
    );
  }

  const r = geo.resumo;
  const furoAtivo = geo.sondagens.find((s) => s.id === ativa) ?? null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          rotulo="Sondagens"
          valor={r.n_total}
          chip={<ProvChip pacote={pacote} bloco="sondagens" />}
          rodape={Object.entries(r.por_tipo)
            .map(([t, n]) => `${n} ${t}`)
            .join(" · ")}
        />
        <KpiCard
          rotulo="No corredor"
          valor={r.n_posicionadas}
          rodape={`${r.n_com_coordenada} com coordenada UTM`}
        />
        <KpiCard
          rotulo="Prof. média"
          valor={r.prof_media_m}
          formato={(v) => fmt(v, 1)}
          sufixo="m"
        />
        <KpiCard
          rotulo="NA médio"
          valor={r.na_medio_m}
          formato={(v) => fmt(v, 1)}
          sufixo="m"
        />
        <KpiCard
          rotulo="Com solo mole"
          valor={r.n_com_solo_mole}
          rodape="SPT ≤ 4 no topo"
        />
        <KpiCard
          rotulo="Com impenetrável"
          valor={r.n_com_impenetravel}
          rodape="N ≥ 50 (indício 2ª/3ª cat.)"
        />
        {(r.n_com_ensaios ?? 0) > 0 && (
          <KpiCard
            rotulo="Com ensaio lab"
            valor={r.n_com_ensaios ?? 0}
            rodape={`${r.n_amostras_lab ?? 0} amostras (CBR, umidade, MCT…)`}
          />
        )}
      </div>

      {/* Categorias de escavação inferidas */}
      {geo.categorias && (
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">
              Categorias de escavação (inferidas das camadas amostradas)
              <ProvChip pacote={pacote} bloco="categorias" />
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fmt(geo.categorias.espessura_total_m, 0)} m de camadas em{" "}
              {geo.categorias.n_furos} furos ({geo.categorias.fonte}) — pré-preenche
              as % nas entradas do cenário; edite lá se discordar
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {(
              [
                ["1ª cat (solo)", geo.categorias.pct_1cat, "#34d399"],
                ["2ª cat (rocha alterada / N≥50)", geo.categorias.pct_2cat, "#f59e0b"],
                ["3ª cat (rocha sã)", geo.categorias.pct_3cat, "#f43f5e"],
              ] as const
            ).map(([rot, pct, cor]) => (
              <div key={rot} className="flex-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{rot}</span>
                  <span className="tabular-nums">
                    {(pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded mt-1 overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{ width: `${Math.max(pct * 100, pct > 0 ? 2 : 0)}%`, background: cor }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            ⚠ Percentuais por espessura amostrada dos furos, não por volume de
            corte: rocha profunda abaixo do greide entra na amostra mesmo quando
            a escavação não a alcança (tende a SUPERestimar 2ª/3ª), e furos que
            param no impenetrável subamostram a rocha (tende a SUBestimar).
            Use como ponto de partida e refine nas entradas do cenário.
          </p>
        </div>
      )}

      {/* Materiais no corte por eixo (furo × profundidade de escavação) */}
      {geo.materiais && geo.materiais.por_eixo.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-sm font-medium">
              Material escavado por eixo (furo mais próximo × profundidade de
              corte, bin a bin)
              <ProvChip pacote={pacote} bloco="volumes_base.corte3Cat" />
            </p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(geo.materiais.cobertura_corte * 100)}% do volume de
              corte com furo a ≤ {fmt(geo.materiais.max_dist_m, 0)} m — esse
              volume usa as camadas reais; o restante usa o % global acima.
              Estes valores pré-preenchem corte 1ª/2ª/3ª e solo mole no cenário.
            </p>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Eixo</th>
                  <th className="px-3 py-2 text-right">Furos</th>
                  <th className="px-3 py-2 text-right">Corte (m³)</th>
                  <th className="px-3 py-2 text-right">Coberto</th>
                  <th className="px-3 py-2 text-right text-emerald-400">1ª (m³)</th>
                  <th className="px-3 py-2 text-right text-amber-400">2ª (m³)</th>
                  <th className="px-3 py-2 text-right text-rose-400">3ª (m³)</th>
                  <th className="px-3 py-2 text-right">Aterro s/ solo mole</th>
                </tr>
              </thead>
              <tbody>
                {geo.materiais.por_eixo.map((m) => (
                  <tr key={m.eixo_id} className="border-t border-border hover:bg-surface-hover">
                    <td className="px-3 py-1.5">{m.eixo_id}</td>
                    <td className="px-3 py-1.5 text-right">{m.n_furos}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(m.v_corte_total)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">
                      {m.v_corte_total > 0
                        ? `${Math.round((m.v_corte_coberto / m.v_corte_total) * 100)}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">{fmt(m.corte_1cat)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(m.corte_2cat)}</td>
                    <td className="px-3 py-1.5 text-right">{fmt(m.corte_3cat)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {m.aterro_solo_mole_m > 0 ? (
                        <span className="text-amber-400">
                          {fmt(m.aterro_solo_mole_m / 1000, 2)} km ·{" "}
                          {fmt(m.v_solo_mole)} m³
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border font-medium">
                  <td className="px-3 py-1.5">Total (coberto)</td>
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5" />
                  <td className="px-3 py-1.5 text-right text-muted-foreground">
                    {Math.round(geo.materiais.cobertura_corte * 100)}%
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(geo.materiais.corte_1cat)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(geo.materiais.corte_2cat)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(geo.materiais.corte_3cat)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {geo.materiais.v_solo_mole > 0
                      ? `${fmt(geo.materiais.aterro_solo_mole_km, 2)} km · ${fmt(geo.materiais.v_solo_mole)} m³`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Perfil geológico — horizontes oficiais do DWG */}
      {perfilGeo && <PerfilGeologicoView perfil={perfilGeo} geo={geo} />}

      {/* Planta com furos */}
      {pacote.geometria && pontosPlanta.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Furos na planta</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {Object.entries(ROTULO_TIPO)
                .filter(([t]) => (r.por_tipo[t] ?? 0) > 0)
                .map(([t, rot]) => (
                  <span key={t} className="flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: COR_TIPO[t] }}
                    />
                    {rot}
                  </span>
                ))}
            </div>
          </div>
          <PlantaEixosSVG
            pacote={pacote}
            geometria={pacote.geometria as MtpGeometria}
            eixoAtivoId={furoAtivo?.eixo_id ?? null}
            estacaoAtiva={furoAtivo?.sta_m ?? null}
            pontos={pontosPlanta}
            pontoAtivoId={ativa}
            onPontoClick={setAtiva}
            altura={320}
          />
        </div>
      )}

      {/* Perfil com palitos */}
      <PerfilFuros
        pacote={pacote}
        sondagens={geo.sondagens}
        eixoId={
          filtroEixo !== "todos" && filtroEixo !== "sem-posicao"
            ? filtroEixo
            : eixosComFuro[0] ?? null
        }
        ativa={ativa}
        onAtiva={setAtiva}
      />

      {/* Filtros + tabela */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap text-sm">
          <span className="font-medium">Laudos ({visiveis.length})</span>
          <select
            value={filtroEixo}
            onChange={(e) => setFiltroEixo(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
          >
            <option value="todos">Todos os eixos</option>
            {eixosComFuro.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
            <option value="sem-posicao">Fora do corredor / sem coordenada</option>
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
          >
            <option value="todos">Todos os tipos</option>
            {Object.entries(ROTULO_TIPO)
              .filter(([t]) => (r.por_tipo[t] ?? 0) > 0)
              .map(([t, rot]) => (
                <option key={t} value={t}>
                  {rot}
                </option>
              ))}
          </select>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Furo</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Eixo · estaca</th>
                <th className="px-3 py-2 text-right">Offset (m)</th>
                <th className="px-3 py-2 text-right">Cota (m)</th>
                <th className="px-3 py-2 text-right">Prof. (m)</th>
                <th className="px-3 py-2 text-right">NA (m)</th>
                <th className="px-3 py-2 text-right">Solo mole (m)</th>
                <th className="px-3 py-2 text-right">Impenetr. (m)</th>
                <th className="px-3 py-2" aria-label="Exportar" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((s) => (
                <tr
                  key={s.id + s.arquivo}
                  onClick={() => setAtiva(s.id)}
                  className={`border-t border-border cursor-pointer ${
                    ativa === s.id ? "bg-manta/10" : "hover:bg-surface-hover"
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                    {s.id}
                    {(s.ensaios?.length ?? 0) > 0 && (
                      <FlaskConical
                        size={11}
                        className="inline-block ml-1.5 text-sky-400 align-[-1px]"
                        aria-label={`${s.ensaios!.length} ensaios de laboratório`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ background: COR_TIPO[s.tipo] ?? COR_TIPO.desconhecido }}
                    />
                    {s.tipo}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {s.eixo_id ? (
                      <>
                        {s.eixo_id}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {s.sta_m != null ? staToKmLabel(s.sta_m) : "—"}
                        </span>
                        {onIrParaSecao && s.sta_m != null && (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onIrParaSecao(s.eixo_id as string, s.sta_m as number);
                            }}
                            className="ml-2 text-[11px] text-manta hover:underline"
                          >
                            ver seção
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {s.norte != null ? "fora do corredor" : "sem coordenada"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(s.offset_m, 1)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {fmt(s.cota_m, 2)}
                    {s.cota_fonte === "rt_locada" && (
                      <span
                        className="ml-1 text-[9px] text-manta/80 align-top"
                        title="Cota locada (RT de investigações)"
                      >
                        loc
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(s.prof_total_m, 1)}</td>
                  <td className="px-3 py-1.5 text-right">
                    {s.na_seco ? (
                      <span className="text-muted-foreground text-xs">seco</span>
                    ) : (
                      fmt(s.na_m, 2)
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {s.solo_mole_ate_m != null ? (
                      <span className="text-amber-400">{fmt(s.solo_mole_ate_m, 1)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {s.impenetravel_m != null ? (
                      <span className="text-rose-400">{fmt(s.impenetravel_m, 1)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {estudoId && (
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          exportarFuro(s.id);
                        }}
                        title={`Exportar ${s.id} (.xlsx)`}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                      >
                        <FileSpreadsheet size={11} /> xlsx
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalhe do furo ativo */}
      {furoAtivo && furoAtivo.camadas.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-sm font-medium">
              Camadas — {furoAtivo.id}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                ({furoAtivo.arquivo})
              </span>
            </p>
            {(furoAtivo.esp_solo_m != null ||
              furoAtivo.esp_rocha_m != null ||
              furoAtivo.motivo_paralisacao) && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {furoAtivo.esp_solo_m != null && (
                  <>solo {fmt(furoAtivo.esp_solo_m, 2)} m</>
                )}
                {furoAtivo.esp_rocha_m != null && (
                  <> · rocha {fmt(furoAtivo.esp_rocha_m, 2)} m</>
                )}
                {furoAtivo.motivo_paralisacao && (
                  <> · paralisação: {furoAtivo.motivo_paralisacao}</>
                )}
              </p>
            )}
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Prof. (m)</th>
                  <th className="px-3 py-2 text-right">N (SPT)</th>
                  <th className="px-3 py-2 text-center">Cat.</th>
                  <th className="px-3 py-2">Material</th>
                </tr>
              </thead>
              <tbody>
                {furoAtivo.camadas.map((c, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {fmt(c.de_m, 2)} – {fmt(c.a_m, 2)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right ${
                        c.n_spt != null && c.n_spt <= 4
                          ? "text-amber-400"
                          : c.n_spt != null && c.n_spt >= 50
                            ? "text-rose-400"
                            : ""
                      }`}
                    >
                      {c.n_spt ?? "—"}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-center text-xs font-medium ${
                        c.categoria === 3
                          ? "text-rose-400"
                          : c.categoria === 2
                            ? "text-amber-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {c.categoria != null ? `${c.categoria}ª` : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-xs">{c.material || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ensaios de laboratório do furo ativo */}
      {furoAtivo && (furoAtivo.ensaios?.length ?? 0) > 0 && (
        <EnsaiosLabFuro furo={furoAtivo} />
      )}

      {/* Ocorrências de solo mole (insumo p/ premissas) */}
      {soloMole.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Ocorrências de solo mole no corredor ({soloMole.length})
            <span className="block text-[11px] text-muted-foreground font-normal">
              SPT ≤ 4 na sequência superficial — use como evidência para o volume
              de solo mole nas entradas do cenário (aba Cenários e premissas)
            </span>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Eixo</th>
                  <th className="px-3 py-2">Estaca</th>
                  <th className="px-3 py-2">Furo</th>
                  <th className="px-3 py-2 text-right">Espessura mole (m)</th>
                  <th className="px-3 py-2 text-right">NA (m)</th>
                </tr>
              </thead>
              <tbody>
                {soloMole.map((s) => (
                  <tr
                    key={s.id + s.arquivo}
                    className="border-t border-border hover:bg-surface-hover cursor-pointer"
                    onClick={() => setAtiva(s.id)}
                  >
                    <td className="px-3 py-1.5">{s.eixo_id}</td>
                    <td className="px-3 py-1.5">
                      {s.sta_m != null ? staToKmLabel(s.sta_m) : "—"}
                    </td>
                    <td className="px-3 py-1.5">{s.id}</td>
                    <td className="px-3 py-1.5 text-right text-amber-400">
                      {fmt(s.solo_mole_ate_m, 1)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {s.na_seco ? "seco" : fmt(s.na_m, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {geo.warnings.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          {geo.warnings.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Perfil longitudinal com palitos de sondagem ───────────── */

function PerfilFuros({
  pacote,
  sondagens,
  eixoId,
  ativa,
  onAtiva,
}: {
  pacote: MtpPacote;
  sondagens: MtpSondagem[];
  eixoId: string | null;
  ativa: string | null;
  onAtiva: (id: string) => void;
}) {
  const g = pacote.geometria;
  const ge = g?.eixos.find((e) => e.eixo_id === eixoId);
  const perfil = ge?.perfil ?? null;

  const furos = useMemo(
    () =>
      sondagens.filter(
        (s) => s.eixo_id === eixoId && s.sta_m != null,
      ),
    [sondagens, eixoId],
  );

  const cena = useMemo(() => {
    if (!perfil || !g || furos.length === 0) return null;
    const W = 900;
    const H = 240;
    const padX = 44;
    const padY = 16;
    const zOff = g.z_offset_m;

    const stas: number[] = [];
    const zs: number[] = [];
    const linhas: {
      km: number[];
      terreno: (number | null)[];
      greide: (number | null)[];
    } = { km: [], terreno: [], greide: [] };
    for (let i = 0; i < perfil.terreno_z.length; i++) {
      const sta = perfil.sta0_m + i * perfil.passo_m;
      const t = perfil.terreno_z[i];
      const gr = perfil.greide_z[i];
      linhas.km.push(sta);
      linhas.terreno.push(t == null ? null : t + zOff);
      linhas.greide.push(gr == null ? null : gr + zOff);
      if (t != null) {
        stas.push(sta);
        zs.push(t + zOff);
      }
    }
    // palitos definem o alcance vertical também (cota − prof)
    const palitos = furos.map((s) => {
      const sta = s.sta_m as number;
      const zTerreno = terrenoAt(perfil, sta);
      const zTopo =
        s.cota_m ?? (zTerreno == null ? null : zTerreno + zOff);
      const prof = s.prof_total_m ?? 1;
      return { s, sta, zTopo, zBase: zTopo == null ? null : zTopo - prof };
    });
    for (const p of palitos) {
      if (p.zTopo != null) {
        stas.push(p.sta);
        zs.push(p.zTopo);
        zs.push(p.zBase as number);
      }
    }
    if (stas.length < 2) return null;
    const sMin = Math.min(...stas);
    const sMax = Math.max(...stas);
    const zMin = Math.min(...zs) - 3;
    const zMax = Math.max(...zs) + 3;
    const X = (sta: number) =>
      padX + ((sta - sMin) / Math.max(sMax - sMin, 1)) * (W - padX * 2);
    const Y = (z: number) =>
      H - padY - ((z - zMin) / Math.max(zMax - zMin, 1)) * (H - padY * 2);

    const path = (vals: (number | null)[]): string => {
      let d = "";
      let pen = false;
      for (let i = 0; i < vals.length; i++) {
        const z = vals[i];
        const sta = linhas.km[i];
        if (z == null || sta < sMin - 1 || sta > sMax + 1) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${X(sta).toFixed(1)},${Y(z).toFixed(1)}`;
        pen = true;
      }
      return d;
    };

    return {
      W,
      H,
      X,
      Y,
      dTerreno: path(linhas.terreno),
      dGreide: path(linhas.greide),
      palitos,
      sMin,
      sMax,
    };
  }, [perfil, g, furos]);

  if (!eixoId || furos.length === 0) return null;
  if (!cena) {
    return (
      <div className="bg-surface border border-border rounded-lg p-3 text-sm text-muted-foreground">
        {furos.length} furos no eixo {eixoId}, mas o pacote não tem perfil de
        geometria para plotá-los (gere com “Incluir geometria”).
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">
          Perfil com sondagens — {eixoId}{" "}
          <span className="text-xs text-muted-foreground font-normal">
            ({furos.length} furos · {staToKmLabel(cena.sMin)} →{" "}
            {staToKmLabel(cena.sMax)})
          </span>
        </p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-emerald-500" /> terreno
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-manta" /> greide
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-amber-400" /> solo mole
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-sky-400" /> NA
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${cena.W} ${cena.H}`}
        className="w-full h-auto bg-slate-900 rounded"
      >
        <path d={cena.dTerreno} fill="none" stroke="#10b981" strokeWidth={1.2} />
        <path d={cena.dGreide} fill="none" stroke="#22d3ee" strokeWidth={1.2} />
        {cena.palitos.map(({ s, sta, zTopo, zBase }) => {
          if (zTopo == null || zBase == null) return null;
          const x = cena.X(sta);
          const sel = s.id === ativa;
          const cor = COR_TIPO[s.tipo] ?? COR_TIPO.desconhecido;
          return (
            <g
              key={s.id + s.arquivo}
              className="cursor-pointer"
              onClick={() => onAtiva(s.id)}
            >
              <line
                x1={x}
                y1={cena.Y(zTopo)}
                x2={x}
                y2={cena.Y(zBase)}
                stroke={cor}
                strokeWidth={sel ? 3.5 : 2}
                strokeOpacity={sel ? 1 : 0.85}
              />
              {s.solo_mole_ate_m != null && (
                <line
                  x1={x}
                  y1={cena.Y(zTopo)}
                  x2={x}
                  y2={cena.Y(zTopo - s.solo_mole_ate_m)}
                  stroke="#f59e0b"
                  strokeWidth={sel ? 5 : 4}
                  strokeOpacity={0.9}
                />
              )}
              {s.na_m != null && (
                <circle
                  cx={x}
                  cy={cena.Y(zTopo - s.na_m)}
                  r={sel ? 3.5 : 2.5}
                  fill="#38bdf8"
                />
              )}
              <circle cx={x} cy={cena.Y(zTopo)} r={sel ? 3 : 2} fill={cor} />
              {sel && (
                <text
                  x={x + 5}
                  y={cena.Y(zTopo) - 6}
                  fontSize={10}
                  fill="#e2e8f0"
                >
                  {s.id}
                </text>
              )}
              <title>
                {s.id} · {fmt(s.prof_total_m, 1)} m
                {s.na_m != null ? ` · NA ${fmt(s.na_m, 1)} m` : ""}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Ensaios de laboratório do furo ativo ──────────────────────────── */

function EnsaiosLabFuro({ furo }: { furo: MtpSondagem }) {
  const ensaios = furo.ensaios ?? [];
  const cel = (v: number | null | undefined, dec = 1) =>
    v == null ? <span className="text-muted-foreground">—</span> : fmt(v, dec);
  const atterberg = (e: MtpEnsaioLab) =>
    e.ll_pct == null && e.lp_pct == null && e.ip_pct == null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      `${e.ll_pct ?? "–"}/${e.lp_pct ?? "–"}/${e.ip_pct ?? "–"}`
    );

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <FlaskConical size={14} className="text-sky-400" />
          Ensaios de laboratório — {furo.id}
          <span className="text-xs text-muted-foreground font-normal">
            ({ensaios.length} amostra{ensaios.length > 1 ? "s" : ""})
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Caracterização de amostras deformadas — umidade natural, Proctor,
          CBR e classe MCT (fonte: consolidado de ensaios do projeto)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-surface">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Amostra (m)</th>
              <th className="px-3 py-2">Energia</th>
              <th className="px-3 py-2 text-right">w nat (%)</th>
              <th className="px-3 py-2 text-right">w ót (%)</th>
              <th className="px-3 py-2 text-right">γd (kN/m³)</th>
              <th className="px-3 py-2 text-right">CBR (%)</th>
              <th className="px-3 py-2 text-right">Exp. (%)</th>
              <th className="px-3 py-2 text-right">LL/LP/IP</th>
              <th className="px-3 py-2">HRB</th>
              <th className="px-3 py-2">USCS</th>
              <th className="px-3 py-2">MCT</th>
              <th className="px-3 py-2 text-right" title="% passa na #200">
                Finos (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {ensaios.map((e, i) => (
              <tr key={e.registro + i} className="border-t border-border">
                <td className="px-3 py-1.5">
                  {e.prof_de_m != null && e.prof_a_m != null
                    ? `${fmt(e.prof_de_m, 2)} – ${fmt(e.prof_a_m, 2)}`
                    : e.ident || "—"}
                </td>
                <td className="px-3 py-1.5">
                  {e.energia ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-1.5 text-right text-sky-300">
                  {cel(e.w_nat_pct)}
                </td>
                <td className="px-3 py-1.5 text-right">{cel(e.w_ot_pct)}</td>
                <td className="px-3 py-1.5 text-right">
                  {cel(e.gamma_d_max_knm3, 2)}
                </td>
                <td className="px-3 py-1.5 text-right text-emerald-300">
                  {cel(e.cbr_pct)}
                </td>
                <td className="px-3 py-1.5 text-right">{cel(e.expansao_pct)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {atterberg(e)}
                </td>
                <td className="px-3 py-1.5">
                  {e.hrb ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-1.5">
                  {e.uscs ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-1.5">
                  {e.mct ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {cel(e.granulometria?.["#200"], 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

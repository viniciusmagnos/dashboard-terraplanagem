/**
 * Aba Seções — viewer geométrico do pacote v2: seção transversal interativa
 * (terreno × plataforma, hachura corte/aterro, overlay de alargamento),
 * navegação por estaca, planta dos eixos e perfil longitudinal.
 */
import { useEffect, useMemo, useState } from "react";
import { fmt } from "../../../lib/format";
import {
  eixosComGeometria,
  nearestSecao,
} from "../../../lib/mtp-geometry";
import {
  geotecniaDe,
  perfilGeologicoDe,
  type MtpBarreira,
  type MtpPacote,
} from "../../../lib/mtp";
import { areaMateriaisCorte, furoPerfilMaisProximo } from "../../../lib/perfil-materiais";
import { useEstudo } from "../cenarios/EstudoContext";
import { EstacaoPicker } from "./EstacaoPicker";
import { PerfilLongitudinalChart } from "./PerfilLongitudinalChart";
import { PlantaEixosSVG } from "./PlantaEixosSVG";
import { SecaoTransversalSVG } from "./SecaoTransversalSVG";

export interface GeoSel {
  eixoId: string | null;
  sta: number | null;
}

const CAT_COR: Record<number, string> = { 1: "#34d399", 2: "#f59e0b", 3: "#f43f5e" };
function rotuloN(nMin: number | null, nMax: number | null): string {
  if (nMin == null) return "—";
  return nMin === nMax ? String(nMin) : `${nMin}–${nMax}`;
}

function rotuloFonte(fonte: string): string {
  const synth = fonte.includes("synthTN");
  const base = fonte.split("+")[0];
  const nome =
    base === "terrain_datum"
      ? "seção absoluta (TN + DATUM)"
      : base === "talude_inferred_reconstructed"
        ? "reconstruída (greide + links)"
        : base === "material_polygons"
          ? "polígonos de material"
          : base === "talude_inferred"
            ? "talude inferido"
            : base || "—";
  return synth ? `${nome} · terreno do TIN` : nome;
}

export function SecoesTab({
  pacote,
  sel,
  onSel,
}: {
  pacote: MtpPacote;
  sel: GeoSel;
  onSel: (s: GeoSel) => void;
}) {
  const { ativo } = useEstudo();
  const geometria = pacote.geometria ?? null;
  const [exagero, setExagero] = useState(1);
  const premissaAlarg = ativo.def.premissas.alargamentoCortePercent;
  const [alargPct, setAlargPct] = useState(premissaAlarg);
  useEffect(() => setAlargPct(premissaAlarg), [premissaAlarg]);

  const eixos = useMemo(
    () => (geometria ? eixosComGeometria(geometria) : []),
    [geometria],
  );
  const eixoAtivo = useMemo(() => {
    const comSecoes = eixos.filter((e) => e.secoes.length > 0);
    return (
      eixos.find((e) => e.eixo_id === sel.eixoId) ??
      comSecoes[0] ??
      eixos[0] ??
      null
    );
  }, [eixos, sel.eixoId]);

  const stas = useMemo(
    () => (eixoAtivo ? eixoAtivo.secoes.map((s) => s.sta_m) : []),
    [eixoAtivo],
  );
  const indice = useMemo(() => {
    if (!stas.length) return 0;
    if (sel.sta == null) return Math.floor(stas.length / 2);
    let best = 0;
    for (let i = 1; i < stas.length; i++) {
      if (Math.abs(stas[i] - sel.sta) < Math.abs(stas[best] - sel.sta)) best = i;
    }
    return best;
  }, [stas, sel.sta]);

  const secao = useMemo(() => {
    if (!eixoAtivo || !eixoAtivo.secoes.length) return null;
    if (sel.sta != null) return nearestSecao(eixoAtivo, sel.sta);
    return eixoAtivo.secoes[indice] ?? null;
  }, [eixoAtivo, sel.sta, indice]);

  // Furo de sondagem mais próximo da seção ativa (mesmo eixo, ≤ 250 m)
  const furoProximo = useMemo(() => {
    const geo = geotecniaDe(pacote);
    if (!geo || !eixoAtivo || !secao) return null;
    let best: { sondagem: (typeof geo.sondagens)[number]; dist_m: number } | null =
      null;
    for (const s of geo.sondagens) {
      if (s.eixo_id !== eixoAtivo.eixo_id || s.sta_m == null || !s.camadas.length)
        continue;
      const d = Math.abs(s.sta_m - secao.sta_m);
      if (d <= 250 && (best == null || d < best.dist_m)) {
        best = { sondagem: s, dist_m: d };
      }
    }
    return best;
  }, [pacote, eixoAtivo, secao]);

  // Furo do PERFIL geológico mais próximo (mesmo eixo) → área por material no corte
  const perfilGeo = useMemo(() => perfilGeologicoDe(pacote), [pacote]);
  const furoPerfil = useMemo(() => {
    if (!eixoAtivo || !secao || !perfilGeo) return null;
    const ep = perfilGeo.eixos.find((e) => e.eixo_id === eixoAtivo.eixo_id);
    return furoPerfilMaisProximo(ep?.sondagens, secao.sta_m, 300);
  }, [perfilGeo, eixoAtivo, secao]);
  const areaMat = useMemo(() => {
    if (!secao || !furoPerfil || (secao.area_corte ?? 0) <= 0.1) return null;
    return areaMateriaisCorte(secao, furoPerfil.furo, furoPerfil.dist_m);
  }, [secao, furoPerfil]);

  // cota absoluta do NA (lençol) − z_offset: preferir o furo do perfil, senão o UTM
  const naCotaRel = useMemo(() => {
    if (!geometria) return null;
    const fp = furoPerfil?.furo;
    if (fp?.na_m != null && fp.cota_topo_m != null) {
      return fp.cota_topo_m - fp.na_m - geometria.z_offset_m;
    }
    const fu = furoProximo?.sondagem;
    if (fu?.na_m != null && fu.cota_m != null) {
      return fu.cota_m - fu.na_m - geometria.z_offset_m;
    }
    return null;
  }, [furoPerfil, furoProximo, geometria]);

  const barreirasVisiveis: MtpBarreira[] = useMemo(
    () => [
      ...pacote.barreiras.filter((b) =>
        ativo.def.bruckner.barreirasAtivas.includes(b.sta_m),
      ),
      ...ativo.def.bruckner.barreirasExtras.map((b) => ({
        sta_m: b.sta_m,
        nome: b.nome,
        tipo: "manual",
      })),
    ],
    [pacote.barreiras, ativo.def.bruckner],
  );

  if (!geometria || !eixos.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-2">
        <p className="text-sm font-medium">Este pacote não contém geometria</p>
        <p className="text-xs text-muted-foreground max-w-lg mx-auto">
          Regere o pacote marcando "Incluir geometria (seções e 3D)" no upload
          — ou pela CLI com a flag <code>--geometria</code>:
          <code className="block mt-1 text-[11px]">
            python scripts/build_dashboard_package.py --xml "..." --geometria …
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* controles */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            Eixo:
            <select
              value={eixoAtivo?.eixo_id ?? ""}
              onChange={(e) => onSel({ eixoId: e.target.value, sta: null })}
              className="bg-background border border-border rounded px-2.5 py-1.5 text-sm"
            >
              {eixos.map((e) => (
                <option key={e.eixo_id} value={e.eixo_id}>
                  {e.eixo_id} ({e.secoes.length} seções)
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Exagero vertical: {exagero.toFixed(1)}×
            <input
              type="range"
              min={1}
              max={5}
              step={0.5}
              value={exagero}
              onChange={(e) => setExagero(Number(e.target.value))}
              className="w-36 accent-cyan-500"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Alargamento de corte: {Math.round(alargPct * 100)}%
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={Math.round(alargPct * 100)}
              onChange={(e) => setAlargPct(Number(e.target.value) / 100)}
              className="w-36 accent-amber-500"
            />
          </label>
          <span className="text-[11px] text-muted-foreground">
            premissa do cenário ativo: {Math.round(premissaAlarg * 100)}% (edite
            na aba Cenários)
          </span>
        </div>
        {stas.length > 0 && (
          <EstacaoPicker
            stas={stas}
            indice={indice}
            onIndice={(i) =>
              onSel({ eixoId: eixoAtivo!.eixo_id, sta: stas[i] })
            }
          />
        )}
      </div>

      {/* seção transversal */}
      {secao ? (
        <div className="space-y-1.5">
          <SecaoTransversalSVG
            secao={secao}
            zOffset={geometria.z_offset_m}
            exagero={exagero}
            alargamentoPct={alargPct}
            furo={furoProximo}
            bandasMaterial={areaMat?.bandas ?? null}
            naCotaRel={naCotaRel}
          />
          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span>
              fonte:{" "}
              <span className="text-foreground">{rotuloFonte(secao.fonte)}</span>
              {furoProximo && (
                <>
                  {" · "}sondagem{" "}
                  <span className="text-foreground">
                    {furoProximo.sondagem.id}
                  </span>{" "}
                  a {fmt(furoProximo.dist_m, 0)} m (
                  <span className="text-emerald-400">1ª</span>/
                  <span className="text-amber-400">2ª</span>/
                  <span className="text-rose-400">3ª</span> cat. na coluna)
                </>
              )}
            </span>
            {alargPct > 0 && secao.area_corte > 0 && (
              <span className="text-amber-400">
                alargamento {Math.round(alargPct * 100)}% ⇒ ~
                {fmt(alargPct * secao.area_corte, 1)} m³/m de jazida na faixa
                nesta seção
              </span>
            )}
          </div>

          {/* Fase 2 — área de cada material no corte (furo do perfil × seção) */}
          {areaMat && areaMat.itens.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-3 mt-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <p className="text-sm font-medium">
                  Material escavado no corte desta seção
                </p>
                <span className="text-[11px] text-muted-foreground">
                  furo <span className="text-foreground">{areaMat.furo_id}</span> a{" "}
                  {fmt(areaMat.dist_m, 0)} m · corte {fmt(secao.area_corte, 1)} m²
                  {areaMat.area_corte_m2 > 0 &&
                    ` · cobertura ${Math.round(
                      (100 * areaMat.area_coberta_m2) / areaMat.area_corte_m2,
                    )}%`}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="pr-3 py-1">Material</th>
                      <th className="pr-3 py-1 text-right">SPT</th>
                      <th className="pr-3 py-1 text-right">Cat.</th>
                      <th className="pr-3 py-1 text-right">Área (m²)</th>
                      <th className="pr-3 py-1 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaMat.itens.map((it, i) => (
                      <tr key={i} className="border-t border-border align-top">
                        <td className="pr-3 py-1">
                          {it.material}
                          {it.extrapolado && (
                            <span className="text-muted-foreground"> (extrapolado)</span>
                          )}
                        </td>
                        <td className="pr-3 py-1 text-right tabular-nums text-muted-foreground">
                          {rotuloN(it.n_min, it.n_max)}
                        </td>
                        <td
                          className="pr-3 py-1 text-right font-medium"
                          style={{
                            color: it.categoria ? CAT_COR[it.categoria] : undefined,
                          }}
                        >
                          {it.categoria ? `${it.categoria}ª` : "—"}
                        </td>
                        <td className="pr-3 py-1 text-right tabular-nums">
                          {fmt(it.fracao * secao.area_corte, 1)}
                        </td>
                        <td className="pr-3 py-1 text-right tabular-nums text-muted-foreground">
                          {Math.round(it.fracao * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Composição por profundidade abaixo do terreno (pilha de camadas do
                furo do perfil × corte da seção), rateada ao corte oficial da seção.
                Abaixo do fim do furo, a última camada é extrapolada.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          Este eixo não tem seções no pacote (só traçado/perfil).
        </div>
      )}

      {/* planta + perfil */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-2">Planta dos eixos</p>
          <PlantaEixosSVG
            pacote={pacote}
            geometria={geometria}
            eixoAtivoId={eixoAtivo?.eixo_id ?? null}
            estacaoAtiva={secao?.sta_m ?? null}
            barreiras={barreirasVisiveis}
            onEixoClick={(id) => onSel({ eixoId: id, sta: null })}
          />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-2">
            Perfil longitudinal — greide × terreno
          </p>
          {eixoAtivo?.perfil ? (
            <PerfilLongitudinalChart
              perfil={eixoAtivo.perfil}
              zOffset={geometria.z_offset_m}
              barreiras={barreirasVisiveis}
              estacaoAtiva={secao?.sta_m ?? null}
              onStationClick={(sta) =>
                onSel({ eixoId: eixoAtivo.eixo_id, sta })
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Eixo sem perfil.</p>
          )}
        </div>
      </div>
    </div>
  );
}

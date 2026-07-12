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
import { geotecniaDe, type MtpBarreira, type MtpPacote } from "../../../lib/mtp";
import { useEstudo } from "../cenarios/EstudoContext";
import { EstacaoPicker } from "./EstacaoPicker";
import { PerfilLongitudinalChart } from "./PerfilLongitudinalChart";
import { PlantaEixosSVG } from "./PlantaEixosSVG";
import { SecaoTransversalSVG } from "./SecaoTransversalSVG";

export interface GeoSel {
  eixoId: string | null;
  sta: number | null;
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
              className="w-36 accent-manta"
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

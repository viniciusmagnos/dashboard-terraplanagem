/**
 * DrenagemTab — dispositivos de drenagem do projeto (bloco `drenagem`).
 *
 * Fontes: pranchas do projeto executivo de drenagem (H1 = planta de bacias
 * com as travessias de talvegue; H2 = plantas 1:1000 com os rótulos
 * `CÓDIGO C=comprimento`; DWG/DXF = linework georreferenciado do corredor),
 * extraídas por `scripts/extract_drenagem.py` e projetadas nos eixos. A aba
 * sintetiza (KPIs, por família, planta, travessias) e o dado bruto sai no
 * export XLSX tipo `drenagem` (1 linha por dispositivo).
 */
import { useMemo, useState } from "react";
import { Droplets, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { fmt } from "../../../lib/format";
import { urlExportEstudo } from "../../../lib/estudo-api";
import { useEstudo } from "../cenarios/EstudoContext";
import {
  drenagemDe,
  staToKmLabel,
  type MtpDispositivoDrenagem,
  type MtpPacote,
  type MtpTravessiaDrenagem,
} from "../../../lib/mtp";
import { KpiCard } from "../KpiCard";
import { ProvChip } from "../ProvChip";
import { PlantaEixosSVG, type PlantaPonto } from "../geometria/PlantaEixosSVG";

const COR_FAMILIA: Record<string, string> = {
  sarjeta: "#22d3ee",
  valeta: "#34d399",
  dreno: "#a78bfa",
  descida: "#fbbf24",
  dissipador: "#fb923c",
  bueiro: "#f87171",
  boca_caixa: "#38bdf8",
  meio_fio: "#94a3b8",
  outros: "#64748b",
};

const ROTULO_FAMILIA: Record<string, string> = {
  sarjeta: "Sarjetas",
  valeta: "Valetas",
  dreno: "Drenos",
  descida: "Descidas d'água",
  dissipador: "Dissipadores",
  bueiro: "Bueiros (greide)",
  boca_caixa: "Bocas e caixas",
  meio_fio: "Meio-fio",
  outros: "Outros",
};

const ROTULO_STATUS: Record<string, string> = {
  projetado: "Projetado",
  existente: "Existente",
  prolongamento: "Prolongamento",
  asu: "A utilizar (A.S.U)",
  asd: "A demolir (A.S.D)",
};

const ROTULO_FONTE: Record<string, string> = {
  pdf_planta: "prancha PDF",
  dwg: "DWG",
  "pdf_planta+dwg": "PDF + DWG",
  h1: "estudo hidrológico",
};

export function DrenagemTab({
  pacote,
  onIrParaSecao,
}: {
  pacote: MtpPacote;
  onIrParaSecao?: (eixoId: string, staM: number) => void;
}) {
  const dre = drenagemDe(pacote);
  const { estudoId } = useEstudo();
  const [filtroFamilia, setFiltroFamilia] = useState<string>("todas");
  const [filtroEixo, setFiltroEixo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState<string | null>(null);

  const eixosComDisp = useMemo(() => {
    if (!dre) return [];
    const ids = new Set(
      dre.dispositivos.filter((d) => d.eixo_id).map((d) => d.eixo_id as string),
    );
    return pacote.eixos.filter((e) => ids.has(e.id)).map((e) => e.id);
  }, [dre, pacote.eixos]);

  const visiveis = useMemo(() => {
    if (!dre) return [];
    const q = busca.trim().toUpperCase();
    return dre.dispositivos.filter((d) => {
      if (filtroFamilia !== "todas" && d.familia !== filtroFamilia) return false;
      if (filtroEixo !== "todos" && d.eixo_id !== filtroEixo) return false;
      if (filtroStatus !== "todos" && d.status !== filtroStatus) return false;
      if (q && !`${d.id} ${d.tipo_codigo} ${d.folha ?? ""}`.toUpperCase().includes(q))
        return false;
      return true;
    });
  }, [dre, filtroFamilia, filtroEixo, filtroStatus, busca]);

  const pontosPlanta = useMemo<PlantaPonto[]>(() => {
    const g = pacote.geometria;
    if (!dre || !g) return [];
    const [we, wn] = g.world_offset;
    const pts: PlantaPonto[] = [];
    for (const t of dre.travessias) {
      if (t.e == null || t.n == null) continue;
      pts.push({
        id: t.id,
        e: t.e - we,
        n: t.n - wn,
        cor: COR_FAMILIA.bueiro,
        rotulo: `${t.tipo || "bueiro"}${t.dimensoes?.secao ? ` ${t.dimensoes.secao}` : ""}${
          t.km ? ` · km ${t.km}` : ""
        } · ${ROTULO_STATUS[t.status] ?? t.status}`,
      });
    }
    for (const d of dre.dispositivos) {
      if (d.e == null || d.n == null || d.familia === "bueiro") continue;
      if (filtroFamilia !== "todas" && d.familia !== filtroFamilia) continue;
      pts.push({
        id: d.id,
        e: d.e - we,
        n: d.n - wn,
        cor: COR_FAMILIA[d.familia] ?? COR_FAMILIA.outros,
        rotulo: `${d.tipo_codigo}${d.extensao_m ? ` · ${fmt(d.extensao_m, 0)} m` : ""}`,
      });
    }
    return pts;
  }, [dre, pacote.geometria, filtroFamilia]);

  if (!dre) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-sm text-muted-foreground space-y-2">
        <p className="flex items-center gap-2 text-foreground font-medium">
          <Droplets size={16} className="text-cyan-400" />
          Este pacote não tem o bloco de drenagem.
        </p>
        <p>
          Extraia as pranchas com{" "}
          <code>
            python scripts/extract_drenagem.py --h1-pdf "…H1-001.pdf" --pdf-glob
            "…H2-0*.pdf" --dxf "…H2.dxf" --out drenagem.json
          </code>{" "}
          e aplique no estudo com <code>POST /api/estudos/&#123;id&#125;/drenagem</code> —
          ou gere o pacote com <code>--drenagem-json</code>.
        </p>
      </div>
    );
  }

  const r = dre.resumo;
  const cob = r.cobertura;
  const dispositivoAtivo = dre.dispositivos.find((d) => d.id === ativo) ?? null;
  const nExistentes =
    (r.por_status.existente ?? 0) + (r.por_status.asu ?? 0) + (r.por_status.asd ?? 0);

  return (
    <div className="space-y-4">
      {/* Banner de cobertura parcial */}
      {(cob.folhas_ausentes.length > 0 || cob.sentidos.serie) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <span className="font-medium">Cobertura parcial das pranchas.</span>{" "}
            {Object.entries(cob.sentidos)
              .map(([s, txt]) => (s === "serie" ? txt : `${s}: ${txt}`))
              .join(" · ")}
            {cob.folhas_ausentes.length > 0 && (
              <span className="block text-xs opacity-80">
                Folhas ausentes: {cob.folhas_ausentes.slice(0, 12).join(", ")}
                {cob.folhas_ausentes.length > 12 &&
                  ` … (+${cob.folhas_ausentes.length - 12})`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          rotulo="Dispositivos"
          valor={r.n_dispositivos}
          chip={<ProvChip pacote={pacote} bloco="drenagem" />}
          rodape={r.por_familia
            .slice(0, 3)
            .map((f) => `${f.n} ${ROTULO_FAMILIA[f.familia] ?? f.familia}`)
            .join(" · ")}
        />
        <KpiCard
          rotulo="Extensão linear"
          valor={r.extensao_total_m / 1000}
          formato={(v) => fmt(v, 1)}
          sufixo="km"
          rodape="sarjetas, valetas, drenos, meio-fio…"
        />
        <KpiCard
          rotulo="Travessias / bueiros"
          valor={r.n_travessias}
          rodape={Object.entries(r.travessias_por_tipo)
            .map(([t, n]) => `${n} ${t || "s/ tipo"}`)
            .join(" · ")}
        />
        <KpiCard
          rotulo="Bacias de contribuição"
          valor={r.n_bacias}
          rodape="estudo hidrológico (H1)"
        />
        <KpiCard
          rotulo="Existentes / a demolir"
          valor={nExistentes}
          rodape={Object.entries(r.por_status)
            .filter(([s]) => s !== "projetado")
            .map(([s, n]) => `${n} ${ROTULO_STATUS[s] ?? s}`)
            .join(" · ")}
        />
        <KpiCard
          rotulo="Fontes"
          valor={Object.values(cob.fontes).reduce((a, b) => a + b, 0)}
          rodape={Object.entries(cob.fontes)
            .map(([f, n]) => `${n} ${ROTULO_FONTE[f] ?? f}`)
            .join(" · ")}
        />
      </div>

      {/* Por família + por eixo */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Por família{" "}
            <span className="text-xs text-muted-foreground">(clique filtra a tabela)</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Família</th>
                <th className="px-3 py-2 text-right">Qtde</th>
                <th className="px-3 py-2 text-right">Extensão (m)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {r.por_familia.map((f) => (
                <tr
                  key={f.familia}
                  onClick={() =>
                    setFiltroFamilia(filtroFamilia === f.familia ? "todas" : f.familia)
                  }
                  className={`border-t border-border cursor-pointer ${
                    filtroFamilia === f.familia ? "bg-cyan-500/10" : "hover:bg-surface-hover"
                  }`}
                >
                  <td className="px-3 py-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ background: COR_FAMILIA[f.familia] ?? COR_FAMILIA.outros }}
                    />
                    {ROTULO_FAMILIA[f.familia] ?? f.familia}
                  </td>
                  <td className="px-3 py-1.5 text-right">{f.n}</td>
                  <td className="px-3 py-1.5 text-right">
                    {f.extensao_m ? fmt(f.extensao_m, 0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                    {f.unidade}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
            Por eixo
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Eixo</th>
                <th className="px-3 py-2 text-right">Dispositivos</th>
                <th className="px-3 py-2 text-right">Extensão (m)</th>
              </tr>
            </thead>
            <tbody>
              {r.por_eixo.map((e) => (
                <tr key={e.eixo_id} className="border-t border-border">
                  <td className="px-3 py-1.5">{e.eixo_id}</td>
                  <td className="px-3 py-1.5 text-right">{e.n_dispositivos}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(e.extensao_m, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Planta com dispositivos */}
      {pacote.geometria && pontosPlanta.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-sm">
            <span className="font-medium">Planta</span>
            <span className="text-xs text-muted-foreground">
              {pontosPlanta.length} pontos · bueiros em vermelho; dispositivos lineares
              plotados no ponto médio
            </span>
          </div>
          <PlantaEixosSVG
            pacote={pacote}
            geometria={pacote.geometria}
            eixoAtivoId={null}
            estacaoAtiva={null}
            barreiras={pacote.barreiras}
            pontos={pontosPlanta}
            pontoAtivoId={ativo}
            onPontoClick={(id) => setAtivo(id)}
          />
        </div>
      )}

      {/* Travessias */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
          Travessias e bueiros ({dre.travessias.length})
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Seção</th>
                <th className="px-3 py-2">km / estaca</th>
                <th className="px-3 py-2 text-right">Compr. (m)</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Fontes</th>
                <th className="px-3 py-2">Obs</th>
              </tr>
            </thead>
            <tbody>
              {dre.travessias.map((t: MtpTravessiaDrenagem) => (
                <tr key={t.id} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                    {t.tipo || "—"}
                    {t.n_linhas > 1 && (
                      <span className="text-xs text-muted-foreground"> ×{t.n_linhas}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {t.dimensoes?.secao ?? "—"}
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {t.km ?? (t.sta_m != null ? staToKmLabel(t.sta_m) : "—")}
                    {onIrParaSecao && t.eixo_id && t.sta_m != null && (
                      <button
                        onClick={() => onIrParaSecao(t.eixo_id as string, t.sta_m as number)}
                        className="ml-2 text-[11px] text-cyan-400 hover:underline"
                      >
                        ver seção
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">{fmt(t.comprimento_m, 1)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    {t.fontes.map((f) => ROTULO_FONTE[f] ?? f).join(" + ")}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{t.obs || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispositivos (tabela filtrável) */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap text-sm">
          <span className="font-medium">Dispositivos ({visiveis.length})</span>
          <select
            value={filtroFamilia}
            onChange={(e) => setFiltroFamilia(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
          >
            <option value="todas">Todas as famílias</option>
            {r.por_familia.map((f) => (
              <option key={f.familia} value={f.familia}>
                {ROTULO_FAMILIA[f.familia] ?? f.familia}
              </option>
            ))}
          </select>
          <select
            value={filtroEixo}
            onChange={(e) => setFiltroEixo(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
          >
            <option value="todos">Todos os eixos</option>
            {eixosComDisp.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-background border border-border rounded px-2 py-1 text-xs"
          >
            <option value="todos">Todos os status</option>
            {Object.entries(r.por_status).map(([s]) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s] ?? s}
              </option>
            ))}
          </select>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar código/folha…"
            className="bg-background border border-border rounded px-2 py-1 text-xs w-40"
          />
          {estudoId && (
            <a
              href={urlExportEstudo(estudoId, "drenagem")}
              download
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
            >
              <FileSpreadsheet size={11} /> exportar tudo (xlsx)
            </a>
          )}
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Família</th>
                <th className="px-3 py-2">Eixo · estaca</th>
                <th className="px-3 py-2">Lado</th>
                <th className="px-3 py-2 text-right">Extensão (m)</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Folha</th>
                <th className="px-3 py-2">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.slice(0, 800).map((d: MtpDispositivoDrenagem) => (
                <tr
                  key={d.id}
                  onClick={() => setAtivo(d.id)}
                  className={`border-t border-border cursor-pointer ${
                    ativo === d.id ? "bg-cyan-500/10" : "hover:bg-surface-hover"
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ background: COR_FAMILIA[d.familia] ?? COR_FAMILIA.outros }}
                    />
                    {d.tipo_codigo}
                  </td>
                  <td className="px-3 py-1.5">{ROTULO_FAMILIA[d.familia] ?? d.familia}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {d.eixo_id ? (
                      <>
                        {d.eixo_id}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {d.sta_ini_m != null ? staToKmLabel(d.sta_ini_m) : "—"}
                        </span>
                        {onIrParaSecao && d.sta_ini_m != null && (
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onIrParaSecao(d.eixo_id as string, d.sta_ini_m as number);
                            }}
                            className="ml-2 text-[11px] text-cyan-400 hover:underline"
                          >
                            ver seção
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">sem eixo</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">{d.lado ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right">
                    {d.unidade === "un" ? `${d.quantidade} un` : fmt(d.extensao_m, 1)}
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    {d.folha || "—"}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    {ROTULO_FONTE[d.fonte] ?? d.fonte}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visiveis.length > 800 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Mostrando 800 de {visiveis.length} — refine os filtros ou exporte o XLSX.
            </p>
          )}
        </div>
      </div>

      {/* Detalhe do dispositivo ativo */}
      {dispositivoAtivo && (
        <div className="bg-surface border border-border rounded-lg p-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{
                background: COR_FAMILIA[dispositivoAtivo.familia] ?? COR_FAMILIA.outros,
              }}
            />
            <span className="font-medium">{dispositivoAtivo.id}</span>
            <StatusBadge status={dispositivoAtivo.status} />
          </div>
          <dl className="grid gap-x-6 gap-y-1 md:grid-cols-3 lg:grid-cols-4 text-xs">
            {(
              [
                ["Família", ROTULO_FAMILIA[dispositivoAtivo.familia] ?? dispositivoAtivo.familia],
                ["Eixo", dispositivoAtivo.eixo_id ?? "—"],
                [
                  "Estaca",
                  dispositivoAtivo.sta_ini_m != null
                    ? `${staToKmLabel(dispositivoAtivo.sta_ini_m)}${
                        dispositivoAtivo.sta_fim_m != null
                          ? ` → ${staToKmLabel(dispositivoAtivo.sta_fim_m)}`
                          : ""
                      }`
                    : "—",
                ],
                [
                  "Extensão",
                  dispositivoAtivo.unidade === "un"
                    ? `${dispositivoAtivo.quantidade} un`
                    : `${fmt(dispositivoAtivo.extensao_m, 1)} m`,
                ],
                ["Lado", dispositivoAtivo.lado ?? "—"],
                ["Dimensões", dispositivoAtivo.dimensoes?.secao ?? "—"],
                ["Offset", dispositivoAtivo.offset_m != null ? `${fmt(dispositivoAtivo.offset_m, 1)} m` : "—"],
                ["Folha", dispositivoAtivo.folha || "—"],
                ["Fonte", ROTULO_FONTE[dispositivoAtivo.fonte] ?? dispositivoAtivo.fonte],
                ["E / N", dispositivoAtivo.e != null ? `${fmt(dispositivoAtivo.e, 1)} / ${fmt(dispositivoAtivo.n, 1)}` : "—"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {dispositivoAtivo.obs && (
            <p className="mt-2 text-xs text-muted-foreground">{dispositivoAtivo.obs}</p>
          )}
        </div>
      )}

      {/* Avisos da extração */}
      {dre.warnings.length > 0 && (
        <details className="bg-surface border border-border rounded-lg px-4 py-2.5 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Avisos da extração ({dre.warnings.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {dre.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cores: Record<string, string> = {
    projetado: "bg-cyan-500/15 text-cyan-300",
    existente: "bg-slate-500/20 text-slate-300",
    prolongamento: "bg-emerald-500/15 text-emerald-300",
    asu: "bg-sky-500/15 text-sky-300",
    asd: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${
        cores[status] ?? "bg-slate-500/20 text-slate-300"
      }`}
    >
      {ROTULO_STATUS[status] ?? status}
    </span>
  );
}

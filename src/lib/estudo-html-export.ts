// =====================================================
// Exportação de um RELATÓRIO HTML autocontido do dashboard
// de terraplenagem, COM TODOS OS DADOS + GRÁFICOS embutidos.
//
// O arquivo .html gerado reproduz o visual do dashboard (tema
// escuro, abas, gráficos SVG: Brückner, planta linear, seções
// transversais, perfil, planta E/N, composição do orçamento) e
// carrega, embutido num <script type="application/json">, TODO o
// estudo (pacote .mtp.json + estado + orçamentos calculados por
// cenário) — pronto para abrir no navegador ou enviar a outra IA.
//
// Funções PURAS (sem DOM/Date/Math.random) — o componente injeta
// `geradoEm`. Testadas em estudo-html-export.test.ts.
// =====================================================

import type {
  CenarioComputado,
  CenarioDef,
  Economia,
  EntradasProjeto,
} from "./cenario";
import { CUSTOS_REFERENCIA, calcularDME } from "./cenario";
import {
  brucknerChartSvg,
  diagramaLinearSvg,
  orcamentoBarsSvg,
  perfilLongitudinalSvg,
  plantaEixosSvg,
  secaoTransversalSvg,
  type PlantaPonto,
} from "./estudo-html-charts";
import { fmt, fmtBRL, fmtKm } from "./format";
import {
  geotecniaDe,
  staToKmLabel,
  type MtpGeometria,
  type MtpGeotecnia,
  type MtpPacote,
  type Provenance,
} from "./mtp";

/* ── Entrada (tudo vem do EstudoContext) ──────────────────── */

export interface DadosEstudoInput {
  pacote: MtpPacote;
  entradas: EntradasProjeto;
  cenarios: CenarioDef[];
  cenarioAtivoId: string | null;
  casoBase: CenarioComputado;
  computados: Map<string, CenarioComputado>;
  economias: Map<string, Economia>;
  ativo: CenarioComputado;
  ativoEconomia: Economia | null;
  estudoId: string | null;
  estudoRole: string | null;
  /** ISO string — injetada pelo componente (funções aqui são puras). */
  geradoEm: string;
}

export interface OpcoesExport {
  /** Embute o bloco de geometria (traçado/perfil/seções) — arquivos maiores. */
  incluirGeometria: boolean;
}

/** Máx. de seções transversais pré-renderizadas no seletor (as demais ficam no JSON). */
const MAX_SECOES = 200;

/* ── Rótulos didáticos ────────────────────────────────────── */

const PROV_ROTULO: Record<Provenance, string> = {
  extracted: "dados do projeto",
  computed: "calculado",
  manual: "entrada manual",
  default: "premissa editável",
  example: "dados de exemplo",
};

const BASELINE_ROTULO: Record<string, string> = {
  start: "a partir do início",
  median: "mediana",
};

/* ── Linha unificada de cenário (caso base + nomeados) ────── */

interface CenarioLinha {
  id: string;
  nome: string;
  isCasoBase: boolean;
  isAtivo: boolean;
  comp: CenarioComputado;
  economia: Economia | null;
}

function linhasCenarios(input: DadosEstudoInput): CenarioLinha[] {
  const linhas: CenarioLinha[] = [];
  const baseId = input.casoBase.def.id || "caso-base";
  linhas.push({
    id: baseId,
    nome: input.casoBase.def.nome || "Caso base",
    isCasoBase: true,
    isAtivo: input.cenarioAtivoId == null,
    comp: input.casoBase,
    economia: null,
  });
  for (const c of input.cenarios) {
    const comp = input.computados.get(c.id);
    if (!comp) continue;
    linhas.push({
      id: c.id,
      nome: c.nome,
      isCasoBase: false,
      isAtivo: input.cenarioAtivoId === c.id,
      comp,
      economia: input.economias.get(c.id) ?? null,
    });
  }
  return linhas;
}

function entradasPendentes(e: EntradasProjeto): string[] {
  const out: string[] = [];
  if (e.cftBase == null)
    out.push(
      "CFT base (m³) — camada final de terraplenagem não extraível do LandXML; informar manualmente",
    );
  if (e.soloMole == null)
    out.push("Solo mole (m³) — informar se houver remoção/substituição");
  return out;
}

/* ── Objeto de DADOS COMPLETOS (o que vai embutido/baixado) ── */

function stripGeometria(pacote: MtpPacote): MtpPacote {
  const { geometria: _drop, ...rest } = pacote;
  return rest as MtpPacote;
}

export function montarDadosCompletos(
  input: DadosEstudoInput,
  opts: OpcoesExport,
): Record<string, unknown> {
  const p = input.pacote;
  const incGeo = opts.incluirGeometria && !!p.geometria;
  const pacoteExport = incGeo ? p : stripGeometria(p);
  const geo = geotecniaDe(p);
  const br = p.bruckner?.totals ?? null;
  const vb = p.volumes_base;
  const linhas = linhasCenarios(input);

  return {
    meta: {
      gerado_em: input.geradoEm,
      ferramenta: "Manta Hub — Dashboard de Terraplenagem",
      descricao:
        "Pacote de dados de um estudo de terraplenagem (Civil 3D LandXML → " +
        "Brückner + premissas Motiva + custos SICRO). O campo `pacote` é o " +
        "arquivo .mtp.json original; `cenarios_computados` traz volumes, " +
        "momento de transporte, orçamento e economia já calculados por cenário.",
      schema: p.schema,
      schema_version: p.schema_version,
      estudo_id: input.estudoId,
      estudo_role: input.estudoRole,
      cenario_ativo_id: input.cenarioAtivoId,
      inclui_geometria: incGeo,
      projeto: p.projeto,
      fontes: (p.generator?.source_files ?? []).map((s) => s.filename),
    },
    resumo: {
      kpis: {
        corte_total_m3: vb.corteTotal ?? null,
        aterro_fc_m3: vb.aterroFc ?? null,
        pavimento_m3: vb.pavimento ?? null,
        momento_m3km: br?.momento_m3km ?? null,
        dmt_medio_m: br?.dmt_medio_m ?? null,
        emprestimo_m3: input.casoBase.volumes.jazidaTotal,
        bota_fora_m3: input.casoBase.volumes.bfTotal,
        extensao_km: p.extensoes?.total ?? null,
        orcamento_caso_base: input.casoBase.orcamento.total,
        orcamento_cenario_ativo: input.ativo.orcamento.total,
      },
      extensoes: p.extensoes ?? null,
      n_eixos: p.eixos?.length ?? 0,
      n_cenarios: input.cenarios.length,
      n_sondagens: geo?.resumo?.n_total ?? 0,
      tem_geometria: !!p.geometria,
      tem_geotecnia: !!geo,
      custos_referencia: CUSTOS_REFERENCIA,
      custos_editados: input.entradas.custosEditados,
      entradas_pendentes: entradasPendentes(input.entradas),
      provenance: p.provenance ?? {},
      warnings: p.warnings ?? [],
    },
    // Estado do estudo — mesmo shape do localStorage / store server-side.
    estado: {
      v: 2,
      entradas: input.entradas,
      cenarios: input.cenarios,
      cenarioAtivoId: input.cenarioAtivoId,
    },
    cenarios_computados: linhas.map((l) => {
      let bruckner: unknown = null;
      if (l.comp.bruckner) {
        // A curva (array grande) fica só no `pacote.bruckner`; aqui mantemos
        // totais/segmentos/faixas por cenário sem duplicá-la.
        const { curve: _curve, ...rest } = l.comp.bruckner;
        bruckner = rest;
      }
      return {
        id: l.id,
        nome: l.nome,
        is_caso_base: l.isCasoBase,
        is_ativo: l.isAtivo,
        criado_em: l.comp.def.criadoEm ?? null,
        bruckner_params: l.comp.def.bruckner,
        premissas: l.comp.def.premissas,
        bruckner,
        volumes: l.comp.volumes,
        volumes_calculados: l.comp.volumesCalc,
        momento: l.comp.momento,
        orcamento: l.comp.orcamento,
        economia: l.economia,
      };
    }),
    // Pacote .mtp.json completo (com/sem geometria conforme a opção).
    pacote: pacoteExport,
  };
}

/* ── Helpers de HTML ──────────────────────────────────────── */

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** m³ com fallback "—". */
const m3 = (v: number | null | undefined): string =>
  v == null ? "—" : `${fmt(v)} m³`;

interface Col {
  t: string;
  r?: boolean;
}

/** Tabela; células são HTML CRU (o chamador escapa texto, números via fmt). */
function tabela(cols: Col[], linhas: string[][], tfoot?: string[]): string {
  const thead = `<thead><tr>${cols
    .map((c) => `<th class="${c.r ? "r" : ""}">${esc(c.t)}</th>`)
    .join("")}</tr></thead>`;
  const body = linhas
    .map(
      (row) =>
        `<tr>${row
          .map((cell, i) => `<td class="${cols[i]?.r ? "r" : ""}">${cell}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  const foot = tfoot
    ? `<tfoot><tr>${tfoot
        .map((cell, i) => `<td class="${cols[i]?.r ? "r" : ""}">${cell}</td>`)
        .join("")}</tr></tfoot>`
    : "";
  return `<div class="tbl-wrap"><table>${thead}<tbody>${body}</tbody>${foot}</table></div>`;
}

function kpiCard(rotulo: string, valor: string, sub?: string): string {
  return `<div class="kpi"><div class="kpi-rot">${esc(rotulo)}</div><div class="kpi-val">${esc(
    valor,
  )}</div>${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ""}</div>`;
}

function card(titulo: string, corpo: string, desc?: string): string {
  return `<div class="card"><div class="card-h">${esc(titulo)}</div>${
    desc ? `<p class="desc">${esc(desc)}</p>` : ""
  }<div class="card-b">${corpo}</div></div>`;
}

function nomeEixo(pacote: MtpPacote, id: string): string {
  const e = (pacote.eixos ?? []).find((x) => x.id === id);
  return e?.nome || id;
}

/* ── Tabs (uma seção por aba do dashboard) ────────────────── */

function tabVisao(input: DadosEstudoInput): string {
  const p = input.pacote;
  const vb = p.volumes_base;
  const br = p.bruckner?.totals ?? null;
  const eco = input.ativoEconomia;
  const ativoNome = input.ativo.def.nome || "cenário ativo";
  const cards = [
    kpiCard("Corte total", m3(vb.corteTotal)),
    kpiCard("Aterro compactado", `${fmt(vb.aterroFc)} m³c`),
    kpiCard("Pavimento", m3(vb.pavimento ?? null)),
    kpiCard("Momento", `${fmt(br?.momento_m3km ?? null)} m³·km`),
    kpiCard("DMT médio", `${fmt(br?.dmt_medio_m ?? null)} m`),
    kpiCard("Extensão", fmtKm(p.extensoes?.total ?? null)),
    kpiCard("Orçamento — caso base", fmtBRL(input.casoBase.orcamento.total)),
    kpiCard(
      `Orçamento — ${ativoNome}`,
      fmtBRL(input.ativo.orcamento.total),
      eco && !input.ativo.def.id.startsWith("caso")
        ? `economia ${fmtBRL(eco.total)} (${fmt(eco.percent, 1)}%)`
        : "cenário base",
    ),
  ].join("");

  const cols: Col[] = [
    { t: "Eixo" },
    { t: "Tipo" },
    { t: "Extensão", r: true },
    { t: "Corte (m³)", r: true },
    { t: "Aterro (m³)", r: true },
    { t: "Pavimento (m³)", r: true },
    { t: "Empréstimo (m³)", r: true },
    { t: "Bota-fora (m³)", r: true },
  ];
  const linhas = (p.eixos ?? []).map((e) => [
    esc(e.nome || e.id),
    esc(e.tipo ?? ""),
    fmtKm(e.extensao_m != null ? e.extensao_m / 1000 : null),
    fmt(e.volumes?.corte_total ?? null),
    fmt(e.volumes?.aterro ?? null),
    fmt(e.volumes?.pavimento ?? null),
    `<span class="cy">${fmt(e.volumes?.jazida ?? null)}</span>`,
    `<span class="am">${fmt(e.volumes?.bf_total ?? null)}</span>`,
  ]);
  const warns = (p.warnings ?? []).map((w) => `<li>${esc(w)}</li>`).join("");

  return [
    `<div class="kpi-grid">${cards}</div>`,
    card(`Eixos (${(p.eixos ?? []).length})`, tabela(cols, linhas)),
    warns ? card("Avisos do pacote", `<ul class="warn">${warns}</ul>`) : "",
  ].join("");
}

function tabBruckner(input: DadosEstudoInput): string {
  const brRes =
    input.ativo.bruckner ?? input.casoBase.bruckner ?? input.pacote.bruckner ?? null;
  if (!brRes)
    return card(
      "Diagrama de Brückner",
      '<p class="empty">O pacote não tem Brückner (sem bins de eixos "rodovia" nem bloco embutido).</p>',
    );
  const t = brRes.totals;
  const kpis = [
    kpiCard("Volume compensado", m3(t.volume_compensado)),
    kpiCard("Momento", `${fmt(t.momento_m3km)} m³·km`),
    kpiCard("DMT médio", `${fmt(t.dmt_medio_m ?? null)} m`),
    kpiCard("Sobra → bota-fora", m3(t.sobra_bota_fora)),
    kpiCard("Falta → empréstimo", m3(t.falta_emprestimo)),
  ].join("");

  const segCols: Col[] = [
    { t: "Trecho" },
    { t: "Corte (m³)", r: true },
    { t: "Aterro (m³)", r: true },
    { t: "Residual (m³)", r: true },
    { t: "Momento (m³·km)", r: true },
    { t: "DMT (m)", r: true },
  ];
  const segLinhas = brRes.segments.map((s) => [
    esc(`${staToKmLabel(s.sta_start)} – ${staToKmLabel(s.sta_end)}`),
    fmt(s.v_corte),
    fmt(s.v_aterro),
    `<span class="${s.residual_m3 >= 0 ? "am" : "cy"}">${fmt(s.residual_m3)}</span>`,
    fmt(s.momento_m3km),
    fmt(s.dmt_medio_m ?? null),
  ]);

  const faixaCols: Col[] = [
    { t: "Faixa de DMT" },
    { t: "Volume (m³)", r: true },
    { t: "Momento (m³·km)", r: true },
  ];
  const faixaLinhas = Object.entries(brRes.faixas ?? {}).map(([f, vol]) => [
    esc(f),
    fmt(vol),
    fmt(brRes.faixas_momento?.[f] ?? null),
  ]);

  return [
    `<div class="kpi-grid small">${kpis}</div>`,
    card(
      `Curva de Brückner — ${esc(input.ativo.def.nome)}`,
      brucknerChartSvg(brRes.curve, input.pacote.barreiras ?? []),
      "Ordenada = volume acumulado (m³). Linhas âmbar tracejadas = barreiras (OAE).",
    ),
    card("Ondas de compensação (segmentos)", tabela(segCols, segLinhas)),
    faixaLinhas.length
      ? card("Distribuição por faixa de DMT (DNIT)", tabela(faixaCols, faixaLinhas))
      : "",
  ].join("");
}

function tabPlanta(input: DadosEstudoInput): string {
  const brRes = input.ativo.bruckner ?? input.casoBase.bruckner ?? input.pacote.bruckner;
  const svg = diagramaLinearSvg(input.pacote, brRes ?? null);
  return card(
    "Planta linear dos eixos",
    svg || '<p class="empty">Sem bins no pacote.</p>',
    "Corte (laranja, para cima) e aterro (verde, para baixo) por trecho; régua em km; barreiras em âmbar.",
  );
}

function tabSecoes(input: DadosEstudoInput): {
  html: string;
  mapa: Record<string, string>;
} {
  const geo = input.pacote.geometria;
  if (!geo || !geo.eixos?.length)
    return {
      html: card(
        "Seções",
        '<p class="empty">Geometria não incluída neste arquivo. Use a opção "Relatório HTML (com dados)" para embutir traçado, perfil e seções.</p>',
      ),
      mapa: {},
    };
  const zOff = geo.z_offset_m || 0;
  const barreiras = input.pacote.barreiras ?? [];

  const planta = plantaEixosSvg(geo, input.pacote.eixos ?? []);

  const perfis = geo.eixos
    .filter((ge) => ge.perfil)
    .map(
      (ge) =>
        `<div class="strip"><div class="strip-t">${esc(nomeEixo(input.pacote, ge.eixo_id))} — perfil longitudinal</div>${perfilLongitudinalSvg(ge, zOff, barreiras)}</div>`,
    )
    .join("");

  // Seletor de seções (mapa pré-renderizado, cap MAX_SECOES).
  const mapa: Record<string, string> = {};
  let optgroups = "";
  let primeira: string | null = null;
  let mostradas = 0;
  const total = geo.eixos.reduce((a, ge) => a + (ge.secoes?.length ?? 0), 0);
  for (const ge of geo.eixos) {
    const secs = ge.secoes ?? [];
    if (!secs.length) continue;
    const quota = total <= MAX_SECOES ? secs.length : Math.max(1, Math.round((MAX_SECOES * secs.length) / total));
    const step = Math.max(1, Math.ceil(secs.length / quota));
    let opts = "";
    for (let i = 0; i < secs.length; i += step) {
      const sec = secs[i];
      const key = `${ge.eixo_id}|${sec.sta_m}`;
      mapa[key] = secaoTransversalSvg(sec, zOff);
      opts += `<option value="${esc(key)}">${esc(staToKmLabel(sec.sta_m))}</option>`;
      if (primeira == null) primeira = key;
      mostradas++;
    }
    optgroups += `<optgroup label="${esc(nomeEixo(input.pacote, ge.eixo_id))}">${opts}</optgroup>`;
  }

  const primeiraSvg = primeira ? mapa[primeira] : "";
  const nota =
    mostradas < total
      ? `<p class="ref">Seletor com ${mostradas} de ${total} seções (amostradas); todas as ${total} estão no bloco de dados JSON.</p>`
      : "";

  const secaoBloco = primeira
    ? `<div class="picker"><label>Seção transversal:</label> <select id="sec-pick">${optgroups}</select></div><div id="sec-svg">${primeiraSvg}</div>${nota}`
    : '<p class="empty">Sem seções transversais no pacote.</p>';

  return {
    html: [
      card("Planta dos eixos (E/N)", planta),
      perfis ? card("Perfis longitudinais", perfis) : "",
      card("Seção transversal", secaoBloco),
    ].join(""),
    mapa,
  };
}

function tabGeotecnia(
  input: DadosEstudoInput,
  geo: MtpGeotecnia,
  incGeo: boolean,
): string {
  const r = geo.resumo;
  const kpis = [
    kpiCard("Sondagens", fmt(r.n_total)),
    kpiCard("Posicionadas", fmt(r.n_posicionadas)),
    kpiCard("Prof. média", r.prof_media_m == null ? "—" : `${fmt(r.prof_media_m, 1)} m`),
    kpiCard("NA médio", r.na_medio_m == null ? "—" : `${fmt(r.na_medio_m, 1)} m`),
    kpiCard("Com solo mole", fmt(r.n_com_solo_mole)),
    kpiCard("Com impenetrável", fmt(r.n_com_impenetravel)),
  ].join("");

  // Planta com furos (quando há geometria + coordenadas).
  let plantaBloco = "";
  const geom: MtpGeometria | null | undefined = incGeo ? input.pacote.geometria : null;
  if (geom && geom.eixos?.length) {
    const [wx, wy] = geom.world_offset ?? [0, 0];
    const pontos: PlantaPonto[] = geo.sondagens
      .filter((f) => f.este != null && f.norte != null)
      .map((f) => ({
        e: (f.este as number) - wx,
        n: (f.norte as number) - wy,
        rotulo: `${f.id} · ${f.tipo}`,
      }));
    if (pontos.length)
      plantaBloco = card(
        "Sondagens na planta",
        plantaEixosSvg(geom, input.pacote.eixos ?? [], pontos),
      );
  }

  let catBloco = "";
  if (geo.categorias) {
    const c = geo.categorias;
    catBloco = card(
      "Categorias de escavação inferidas",
      tabela(
        [{ t: "Categoria" }, { t: "Fração", r: true }],
        [
          ["1ª categoria (solo)", `${fmt(c.pct_1cat * 100, 1)}%`],
          ["2ª categoria (rocha alterada)", `${fmt(c.pct_2cat * 100, 1)}%`],
          ["3ª categoria (rocha sã)", `${fmt(c.pct_3cat * 100, 1)}%`],
        ],
      ) + `<p class="ref">Fonte: ${esc(c.fonte)} · ${fmt(c.n_furos)} furos · ${fmt(c.espessura_total_m, 1)} m amostrados.</p>`,
    );
  }

  const LIM = 120;
  const furos = geo.sondagens.slice(0, LIM);
  const furoCols: Col[] = [
    { t: "Furo" },
    { t: "Tipo" },
    { t: "Eixo" },
    { t: "Estaca", r: true },
    { t: "Offset (m)", r: true },
    { t: "Prof. (m)", r: true },
    { t: "NA (m)", r: true },
    { t: "Solo mole (m)", r: true },
    { t: "Impen. (m)", r: true },
    { t: "Camadas", r: true },
  ];
  const furoLinhas = furos.map((f) => [
    esc(f.id),
    esc(f.tipo),
    esc(f.eixo_id ?? "—"),
    f.sta_m == null ? "—" : esc(staToKmLabel(f.sta_m)),
    fmt(f.offset_m ?? null, 1),
    fmt(f.prof_total_m ?? null, 1),
    f.na_seco ? "seco" : fmt(f.na_m ?? null, 1),
    fmt(f.solo_mole_ate_m ?? null, 1),
    fmt(f.impenetravel_m ?? null, 1),
    fmt(f.camadas?.length ?? 0),
  ]);
  const nota =
    geo.sondagens.length > LIM
      ? `<p class="ref">Mostrando ${LIM} de ${geo.sondagens.length} furos — os demais estão no bloco JSON.</p>`
      : "";

  return [
    `<div class="kpi-grid small">${kpis}</div>`,
    plantaBloco,
    catBloco,
    card("Sondagens", tabela(furoCols, furoLinhas) + nota),
  ].join("");
}

function tabCenarios(input: DadosEstudoInput): string {
  const linhas = linhasCenarios(input);
  const premCols: Col[] = [
    { t: "Cenário" },
    { t: "Fator homog.", r: true },
    { t: "Linha de distribuição" },
    { t: "CFT %", r: true },
    { t: "Alarg. corte %", r: true },
    { t: "Alarg. aterro %", r: true },
    { t: "DMT jazida fora (km)", r: true },
    { t: "DMT BF fora (km)", r: true },
  ];
  const premLinhas = linhas.map((l) => {
    const b = l.comp.def.bruckner;
    const pr = l.comp.def.premissas;
    return [
      esc(l.nome) + (l.isAtivo ? ' <span class="tag on">ativo</span>' : ""),
      fmt(b.fillFactor, 2),
      esc(BASELINE_ROTULO[b.baseline] ?? b.baseline),
      fmt(pr.cftPercent * 100, 0),
      fmt(pr.alargamentoCortePercent * 100, 0),
      fmt(pr.alargamentoAterroPercent * 100, 0),
      fmt(pr.dmtJazidaForaFaixa, 1),
      fmt(pr.dmtBFForaFaixa, 1),
    ];
  });

  const ent = input.entradas;
  const entCols: Col[] = [{ t: "Entrada de projeto" }, { t: "Valor", r: true }];
  const entLinhas = [
    ["CFT base", ent.cftBase == null ? "—" : m3(ent.cftBase)],
    ["Solo mole", ent.soloMole == null ? "—" : m3(ent.soloMole)],
    ["3ª categoria (rocha)", `${fmt(ent.pct3Cat * 100, 1)}%`],
    ["2ª categoria", `${fmt(ent.pct2Cat * 100, 1)}%`],
    [
      "Custos unitários",
      `${esc(CUSTOS_REFERENCIA)}${ent.custosEditados ? " (editados)" : ""}`,
    ],
  ];

  return [
    card(
      `Cenários (${linhas.length})`,
      tabela(premCols, premLinhas),
      "Caso base (imutável) × cenários — parâmetros físicos do Brückner e premissas econômicas.",
    ),
    card("Entradas de projeto (compartilhadas)", tabela(entCols, entLinhas)),
  ].join("");
}

function tabOrcamento(input: DadosEstudoInput): string {
  const o = input.ativo.orcamento;
  const vb = input.ativo.volumes;
  const vc = input.ativo.volumesCalc;
  const m = input.ativo.momento;
  const cu = input.entradas.custos;
  const cb = input.casoBase.orcamento;

  const grupos = [
    { grupo: "Escavação", base: cb.escavacao.subtotal, ativo: o.escavacao.subtotal },
    { grupo: "Transporte", base: cb.transporte.custo, ativo: o.transporte.custo },
    { grupo: "Compactação", base: cb.compactacao.subtotal, ativo: o.compactacao.subtotal },
    { grupo: "Royalty", base: cb.royalty.subtotal, ativo: o.royalty.subtotal },
    { grupo: "Conform. BF", base: cb.conformacaoBF.subtotal, ativo: o.conformacaoBF.subtotal },
  ];
  const mostrarAtivo = input.cenarioAtivoId != null;
  const barSvg = orcamentoBarsSvg(grupos, mostrarAtivo, input.ativo.def.nome);

  const row = (
    rot: string,
    qtd: number | null,
    unid: string,
    unit: number | null,
    custo: number | null,
  ) =>
    `<tr><td class="pad">${esc(rot)}</td><td class="r">${
      qtd == null ? "" : fmt(qtd)
    }</td><td>${esc(unid)}</td><td class="r">${
      unit == null ? "" : fmtBRL(unit, 2)
    }</td><td class="r">${custo == null ? "" : fmtBRL(custo, 2)}</td></tr>`;
  const grp = (nome: string) => `<tr class="grp"><td colspan="5">${esc(nome)}</td></tr>`;
  const sub = (nome: string, val: number) =>
    `<tr class="sub"><td colspan="4">Subtotal ${esc(nome)}</td><td class="r">${fmtBRL(val, 2)}</td></tr>`;

  const rows = [
    grp("Escavação"),
    row("Corte 1ª+2ª categoria", vb.corte12Cat, "m³", cu.escavacao12, o.escavacao.corte12),
    row("Corte 3ª categoria (rocha)", vb.corte3Cat, "m³", cu.escavacao3, o.escavacao.corte3),
    row("CFT", vc.cftVolume, "m³", cu.escavacaoCFT, o.escavacao.cft),
    row("Empréstimo na faixa", vc.jazidaNaFaixa, "m³", cu.escavacaoJazida, o.escavacao.jazidaNaFaixa),
    row("Empréstimo fora da faixa", vc.jazidaForaFaixa, "m³", cu.escavacaoJazida, o.escavacao.jazidaForaFaixa),
    row("Solo mole", vb.soloMole, "m³", cu.escavacaoSoloMole, o.escavacao.soloMole),
    sub("escavação", o.escavacao.subtotal),
    grp("Transporte"),
    row("Momento de transporte", m.total, "m³·km", cu.transporte, o.transporte.custo),
    sub("transporte", o.transporte.custo),
    grp("Compactação"),
    row("Aterro compactado", vb.aterroFc, "m³c", cu.compactacaoAterro, o.compactacao.aterro),
    row("CFT", vc.cftVolume, "m³c", cu.compactacaoCFT, o.compactacao.cft),
    row("Solo mole compactado", vb.soloMoleCompactado, "m³c", cu.compactacaoSoloMole, o.compactacao.soloMole),
    sub("compactação", o.compactacao.subtotal),
    grp("Royalty (só fora da faixa)"),
    row("Empréstimo fora da faixa", vc.jazidaForaFaixa, "m³", cu.royalty, o.royalty.jazidaForaFaixa),
    row("Bota-fora fora da faixa", vc.bfForaFaixa, "m³", cu.royalty, o.royalty.bfForaFaixa),
    row("Bota-fora 3ª categoria", vc.bf3Cat, "m³", cu.royalty, o.royalty.bf3Cat),
    sub("royalty", o.royalty.subtotal),
    grp("Conformação de bota-fora"),
    row("Na faixa (alargamento)", vc.bfNaFaixa, "m³", cu.conformacaoBF, o.conformacaoBF.naFaixa),
    row("Fora da faixa", vc.bfForaFaixa, "m³", cu.conformacaoBF, o.conformacaoBF.foraFaixa),
    row("3ª categoria", vc.bf3Cat, "m³", cu.conformacaoBF, o.conformacaoBF.bf3Cat),
    sub("conformação", o.conformacaoBF.subtotal),
    `<tr class="total"><td colspan="4">TOTAL</td><td class="r">${fmtBRL(o.total, 2)}</td></tr>`,
  ].join("");
  const orcTable = `<div class="tbl-wrap"><table><thead><tr><th>Item</th><th class="r">Quantidade</th><th>Unid.</th><th class="r">Custo unit.</th><th class="r">Custo</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  const dme = calcularDME(cu);
  const rotulos: Record<string, string> = {
    jazida: "Empréstimo (jazida externa)",
    alargamento: "Alargamento × jazida",
    botaFora: "Bota-fora externo",
  };
  const dmeLinhas = Object.entries(dme).map(([k, info]) => [
    esc(rotulos[k] ?? k),
    esc(info.resultado),
    esc(info.interpretacao),
  ]);

  return [
    card(
      "Composição do custo por grupo",
      barSvg,
      mostrarAtivo ? "Cinza = caso base · ciano = cenário ativo." : "Caso base.",
    ),
    card(
      `Orçamento — ${esc(input.ativo.def.nome)}`,
      orcTable +
        `<p class="ref">Custos: ${esc(CUSTOS_REFERENCIA)}${input.entradas.custosEditados ? " (editados manualmente)" : ""}.</p>`,
    ),
    card(
      "Distância Máxima Econômica (DME)",
      tabela([{ t: "Caso" }, { t: "DME", r: true }, { t: "Interpretação" }], dmeLinhas),
    ),
  ].join("");
}

function tabComparativo(input: DadosEstudoInput): string {
  const linhas = linhasCenarios(input);
  const cols: Col[] = [
    { t: "Cenário" },
    { t: "Ativo" },
    { t: "Orçamento", r: true },
    { t: "Momento (m³·km)", r: true },
    { t: "Empréstimo (m³)", r: true },
    { t: "Bota-fora (m³)", r: true },
    { t: "Economia", r: true },
    { t: "%", r: true },
  ];
  const compLinhas = linhas.map((l) => [
    esc(l.nome) + (l.isCasoBase ? ' <span class="tag">base</span>' : ""),
    l.isAtivo ? "●" : "",
    fmtBRL(l.comp.orcamento.total),
    fmt(l.comp.momento.total),
    fmt(l.comp.volumes.jazidaTotal),
    fmt(l.comp.volumes.bfTotal),
    l.economia ? `<span class="em">${fmtBRL(l.economia.total)}</span>` : "—",
    l.economia ? `<span class="em">${fmt(l.economia.percent, 1)}%</span>` : "—",
  ]);

  // Economia detalhada (vetores)
  const alt = linhas.filter((l) => l.economia);
  let vetores = "";
  if (alt.length) {
    const vCols: Col[] = [
      { t: "Cenário" },
      { t: "CFT (R$)", r: true },
      { t: "Royalty (R$)", r: true },
      { t: "Transporte (R$)", r: true },
      { t: "Total (R$)", r: true },
    ];
    const vLinhas = alt.map((l) => {
      const e = l.economia!;
      return [
        esc(l.nome),
        fmtBRL(e.cft.total),
        fmtBRL(e.royalty.total),
        fmtBRL(e.transporte),
        `<span class="em">${fmtBRL(e.total)}</span>`,
      ];
    });
    vetores = card("Economia por vetor (vs caso base)", tabela(vCols, vLinhas));
  }

  return [
    card(
      "Comparativo de cenários",
      tabela(cols, compLinhas),
      "A economia é medida contra o caso base.",
    ),
    vetores,
  ].join("");
}

function tabDados(input: DadosEstudoInput, incGeo: boolean): string {
  const p = input.pacote;
  const prov = p.provenance ?? {};
  const chips = Object.entries(prov)
    .map(
      ([bloco, pv]) =>
        `<span class="chip">${esc(bloco)}: <b>${esc(PROV_ROTULO[pv as Provenance] ?? pv)}</b></span>`,
    )
    .join("");
  const pend = entradasPendentes(input.entradas)
    .map((w) => `<li>${esc(w)}</li>`)
    .join("");

  return [
    `<div class="ai-note">
      <strong>📦 Todos os dados do estudo estão embutidos nesta página.</strong>
      Baixe/copie o JSON e envie para outra IA. Campos de topo: <code>meta</code>,
      <code>resumo</code>, <code>estado</code> (entradas + cenários),
      <code>cenarios_computados</code> (volumes, momento, orçamento e economia por cenário)
      e <code>pacote</code> (o .mtp.json original${incGeo ? ", com geometria" : ", <b>sem</b> geometria"}).
      <div class="actions">
        <button id="btn-download">⬇ Baixar dados (JSON)</button>
        <button id="btn-copy">⧉ Copiar dados para IA</button>
      </div>
    </div>`,
    chips ? card("Proveniência dos dados", `<div class="chips">${chips}</div>`) : "",
    pend ? card("Entradas pendentes", `<ul class="warn">${pend}</ul>`) : "",
    card(
      "Não incluído nesta página",
      '<p class="desc">As abas "3D do corredor" e "Prazo" do dashboard interativo não são reproduzidas neste HTML estático (dependem de WebGL/simulação em tempo real). Todos os dados necessários para recriá-las estão no JSON.</p>',
    ),
  ].join("");
}

/* ── CSS + JS embutidos ───────────────────────────────────── */

const CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0F1117;color:#EDEAE5;line-height:1.5;font-size:14px;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:20px 18px 90px}
header.top{margin-bottom:16px}
header.top .brand{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#06b6d4}
header.top h1{margin:4px 0 2px;font-size:22px;font-weight:600}
header.top .meta{margin:0;font-size:12px;color:#8B919A;word-break:break-word}
.ai-note{background:#181B23;border:1px solid #2A2E37;border-radius:12px;padding:14px 16px;font-size:13px;color:#EDEAE5}
.ai-note code{background:#0F1117;border:1px solid #2A2E37;padding:1px 6px;border-radius:5px;font-size:12px;color:#22d3ee}
.ai-note .actions{margin-top:12px;display:flex;gap:10px;flex-wrap:wrap}
.ai-note button{cursor:pointer;border:0;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:600;background:#0891b2;color:#fff}
.ai-note button:hover{background:#06b6d4}
.tabbar{display:flex;gap:2px;border-bottom:1px solid #2A2E37;margin:14px 0 18px;overflow-x:auto}
.tabbar button{cursor:pointer;background:none;border:0;border-bottom:2px solid transparent;color:#8B919A;padding:9px 14px;font-size:13px;white-space:nowrap;margin-bottom:-1px}
.tabbar button:hover{color:#EDEAE5}
.tabbar button.on{color:#EDEAE5;border-bottom-color:#06b6d4;font-weight:500}
.tab{display:none}
.tab.on{display:block}
h2.tabtitle{font-size:16px;margin:0 0 12px;color:#EDEAE5}
.card{background:#181B23;border:1px solid #2A2E37;border-radius:12px;margin-bottom:16px;overflow:hidden}
.card-h{padding:10px 16px;border-bottom:1px solid #2A2E37;font-size:13px;font-weight:600}
.card-b{padding:14px 16px}
p.desc{margin:0;padding:8px 16px 0;font-size:12px;color:#8B919A}
.card .card-b p.desc{padding:0 0 10px}
p.ref{margin:8px 0 0;font-size:11.5px;color:#8B919A}
.kpi-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-bottom:16px}
.kpi-grid.small{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.kpi{background:#181B23;border:1px solid #2A2E37;border-radius:12px;padding:12px}
.kpi-rot{font-size:12px;color:#8B919A}
.kpi-val{font-size:16px;font-weight:600;color:#EDEAE5;margin-top:4px;font-variant-numeric:tabular-nums}
.kpi-sub{font-size:11px;color:#22d3ee;margin-top:2px}
.tbl-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th,td{padding:6px 10px;border-bottom:1px solid #22252D;text-align:left;white-space:nowrap}
th{color:#8B919A;font-weight:600;font-size:12px}
td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
td.pad{padding-left:22px}
tbody tr:hover{background:#1F2330}
tr.grp td{background:#1F2330;color:#22d3ee;font-weight:600}
tr.sub td{background:#181B23;font-weight:600;border-top:1px solid #2A2E37}
tr.total td{background:#0891b2;color:#fff;font-weight:700}
.cy{color:#22d3ee}.am{color:#fbbf24}.em{color:#34d399}
.tag{display:inline-block;font-size:10px;background:#2A2E37;color:#8B919A;border-radius:4px;padding:1px 5px;vertical-align:middle}
.tag.on{background:rgba(6,182,212,.15);color:#67e8f9}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{font-size:11.5px;background:#1F2330;border:1px solid #2A2E37;border-radius:6px;padding:3px 9px;color:#8B919A}
ul.warn{margin:4px 0;padding-left:20px;font-size:12.5px;color:#8B919A}
svg.chart{width:100%;height:auto;display:block;margin:4px 0}
.strip{margin-bottom:14px}
.strip-t{font-size:12px;color:#8B919A;margin-bottom:2px}
.strip .mut{color:#6b7280}
.picker{margin-bottom:10px;font-size:13px;color:#8B919A}
.picker select{background:#1F2330;color:#EDEAE5;border:1px solid #2A2E37;border-radius:6px;padding:5px 8px;font-size:13px;max-width:100%}
.empty{color:#8B919A;font-size:13px;padding:20px;text-align:center}
footer{text-align:center;color:#6b7280;font-size:11.5px;margin-top:24px}
#manta-dados,#manta-secoes{display:none}
@media print{.tabbar{display:none}.tab{display:block!important}.ai-note .actions{display:none}.card{break-inside:avoid}}
`;

const APP_JS = `
(function(){
  var btns=[].slice.call(document.querySelectorAll('[data-tab]'));
  var tabs=[].slice.call(document.querySelectorAll('.tab'));
  function show(id){
    var found=false;
    tabs.forEach(function(t){var on=t.id==='tab-'+id; t.classList.toggle('on',on); if(on)found=true;});
    btns.forEach(function(b){b.classList.toggle('on',b.getAttribute('data-tab')===id);});
    return found;
  }
  btns.forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-tab'); if(show(id)){try{history.replaceState(null,'','#'+id);}catch(e){}}});});
  var initial=(location.hash||'').replace('#','');
  if(!initial||!show(initial))show('visao');

  var pick=document.getElementById('sec-pick');
  var box=document.getElementById('sec-svg');
  var mapEl=document.getElementById('manta-secoes');
  if(pick&&box&&mapEl){
    var MAP={}; try{MAP=JSON.parse(mapEl.textContent);}catch(e){}
    pick.addEventListener('change',function(){var s=MAP[pick.value]; if(s)box.innerHTML=s;});
  }

  var el=document.getElementById('manta-dados');
  var fn=document.body.getAttribute('data-json-filename')||'estudo-dados.json';
  var dl=document.getElementById('btn-download');
  var cp=document.getElementById('btn-copy');
  if(dl&&el)dl.addEventListener('click',function(){
    var blob=new Blob([el.textContent],{type:'application/json'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href);},1500);
  });
  if(cp&&el)cp.addEventListener('click',function(){
    var t=el.textContent;var ok=function(){var o=cp.textContent;cp.textContent='Copiado!';setTimeout(function(){cp.textContent=o;},1600);};
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,function(){});}
    else{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');ok();}catch(e){}document.body.removeChild(ta);}
  });
})();
`;

/** Nome de arquivo seguro derivado do id do projeto. */
export function nomeArquivo(pacote: MtpPacote, ext: string, sufixo = ""): string {
  const base = (pacote.projeto?.id || pacote.projeto?.nome || "estudo")
    .toString()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  return `${base || "estudo"}${sufixo}.${ext}`;
}

/** Escapa "<" para "\\u003c": impede fechar </script> e continua JSON válido. */
function jsonScriptSafe(text: string): string {
  return text.replace(/</g, "\\u003c");
}

/* ── Documento completo ───────────────────────────────────── */

export function gerarHtmlDashboard(
  input: DadosEstudoInput,
  opts: OpcoesExport,
): string {
  const p = input.pacote;
  const dados = montarDadosCompletos(input, opts);
  const incGeo = opts.incluirGeometria && !!p.geometria;
  const geo = geotecniaDe(p);
  const secoes = incGeo
    ? tabSecoes(input)
    : {
        html: card(
          "Seções",
          '<p class="empty">Traçado, perfil e seções omitidos nesta versão leve. Use "Relatório HTML (com dados)" para incluí-los.</p>',
        ),
        mapa: {} as Record<string, string>,
      };

  const geradoLabel = (() => {
    try {
      return new Date(input.geradoEm).toLocaleString("pt-BR");
    } catch {
      return input.geradoEm;
    }
  })();
  const fontes = (p.generator?.source_files ?? []).map((s) => s.filename).join(", ");
  const jsonFilename = nomeArquivo(p, "json", "-dados");

  // Compacto: o JSON embutido é para máquina (outra IA); a página é a parte
  // legível. Pretty-print só inflaria um documento que já pode ter vários MB.
  const jsonSeguro = jsonScriptSafe(JSON.stringify(dados));
  const secoesMapSeguro = jsonScriptSafe(JSON.stringify(secoes.mapa));

  const abas: { id: string; rotulo: string; corpo: string }[] = [
    { id: "visao", rotulo: "Visão geral", corpo: tabVisao(input) },
    { id: "bruckner", rotulo: "Brückner e DMT", corpo: tabBruckner(input) },
    { id: "planta", rotulo: "Planta linear", corpo: tabPlanta(input) },
    { id: "secoes", rotulo: "Seções", corpo: secoes.html },
    ...(geo
      ? [
          {
            id: "geotecnia",
            rotulo: `Geotecnia (${geo.resumo.n_total})`,
            corpo: tabGeotecnia(input, geo, incGeo),
          },
        ]
      : []),
    { id: "cenarios", rotulo: "Cenários e premissas", corpo: tabCenarios(input) },
    { id: "orcamento", rotulo: "Orçamento e DME", corpo: tabOrcamento(input) },
    { id: "comparativo", rotulo: "Comparativo", corpo: tabComparativo(input) },
    { id: "dados", rotulo: "Dados (IA)", corpo: tabDados(input, incGeo) },
  ];

  const tabbar = abas
    .map((a) => `<button data-tab="${esc(a.id)}">${esc(a.rotulo)}</button>`)
    .join("");
  const paineis = abas
    .map(
      (a) =>
        `<section class="tab" id="tab-${esc(a.id)}"><h2 class="tabtitle">${esc(a.rotulo)}</h2>${a.corpo}</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="Manta Hub — Dashboard de Terraplenagem">
<title>${esc(p.projeto?.nome || "Estudo de terraplenagem")} — dashboard</title>
<style>${CSS}</style>
</head>
<body data-json-filename="${esc(jsonFilename)}">
<div class="wrap">
  <header class="top">
    <div class="brand">Manta Hub · Dashboard de Terraplenagem</div>
    <h1>${esc(p.projeto?.nome || "Estudo de terraplenagem")}</h1>
    <p class="meta">Pacote ${esc(p.schema)} v${esc(p.schema_version)} · gerado em ${esc(geradoLabel)}${
      fontes ? ` · fontes: ${esc(fontes)}` : ""
    }${input.cenarioAtivoId ? ` · cenário ativo: ${esc(input.ativo.def.nome)}` : ""}</p>
  </header>
  <nav class="tabbar">${tabbar}</nav>
  ${paineis}
  <footer>Gerado por Manta Hub · ${esc(geradoLabel)}${
    input.estudoId ? ` · estudo ${esc(input.estudoId)}` : ""
  } · dados embutidos em #manta-dados</footer>
</div>
<script type="application/json" id="manta-dados">${jsonSeguro}</script>
<script type="application/json" id="manta-secoes">${secoesMapSeguro}</script>
<script>${APP_JS}</script>
</body>
</html>`;
}

// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Rastreabilidade: responde "de onde vem cada dado" deste estudo.
// Tudo é resolvido a partir do pacote carregado + da API de fontes brutas —
// nada é fixado por projeto, então qualquer estudo ganha a mesma auditoria.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileSearch,
  Layers,
  Search,
  X,
} from "lucide-react";
import {
  ORIGEM_ROTULO,
  cadeiaDeOrigem,
  camposDoPacote,
  catalogoParaCsv,
  catalogoParaMarkdown,
  contagemProveniencia,
  fontesDoPacote,
  geometriaDe,
  metodoExplicacao,
  metodoRotulo,
  metodosPorEixo,
  type LinhagemResolvida,
} from "../../lib/linhagem";
import { CUSTOS_REFERENCIA, custosDoPacote } from "../../lib/cenario";
import { fmt } from "../../lib/format";
import type { Provenance } from "../../lib/mtp";
import { listarFontesXml, type FontesResponse } from "../../lib/fontes-api";
import { PROV_ESTILO } from "../landxml/ProvChip";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { useNavegacao } from "../shell/NavegacaoContext";

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Nome de arquivo comparável (o pacote e o upload podem divergir no caminho). */
function chaveArquivo(nome: string): string {
  return nome.split(/[\\/]/).pop()!.trim().toLowerCase();
}

const STATUS_FONTES: Record<string, string> = {
  sem_fontes: "nenhum LandXML bruto anexado",
  pendente: "índice pendente",
  building: "construindo índice…",
  ready: "índice pronto",
  failed: "falha no índice",
  stale: "índice desatualizado",
};

export function RastreabilidadeTab({ accent }: { accent: string }) {
  const { pacote, estudoId, entradas } = useEstudo();
  const nav = useNavegacao();

  const fontes = useMemo(() => fontesDoPacote(pacote), [pacote]);
  const cadeia = useMemo(() => cadeiaDeOrigem(pacote), [pacote]);
  const campos = useMemo(() => camposDoPacote(pacote), [pacote]);
  const metodos = useMemo(() => metodosPorEixo(pacote), [pacote]);
  const contagem = useMemo(() => contagemProveniencia(pacote), [pacote]);

  const geradoEm = useMemo(() => {
    try {
      return new Date(pacote.generated_at).toLocaleString("pt-BR");
    } catch {
      return pacote.generated_at;
    }
  }, [pacote.generated_at]);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={FileSearch}
        titulo="Rastreabilidade dos dados"
        subtitulo={`${pacote.schema} v${pacote.schema_version} · gerado em ${geradoEm} · ${campos.length} campos rastreados`}
      >
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROV_ESTILO) as Provenance[]).map((p) =>
            contagem[p] ? (
              <span
                key={p}
                className={`text-xs px-2 py-1 rounded border ${PROV_ESTILO[p].classe}`}
              >
                {contagem[p]} {PROV_ESTILO[p].rotulo}
              </span>
            ) : null,
          )}
        </div>
      </SecaoHeaderCard>

      <CadeiaDeOrigem cadeia={cadeia} />
      <ArquivosFonte
        estudoId={estudoId}
        declarados={fontes.arquivos}
        onIrParaFontes={
          nav ? () => nav.irParaSub("fontes-xml") : undefined
        }
      />
      <CatalogoCampos campos={campos} titulo={pacote.projeto.nome} />
      {metodos.length > 0 ? <MetodoPorSecao metodos={metodos} /> : null}
      <PremissasECustos
        modo={pacote.categorias?.modo ?? "—"}
        pct2={pacote.categorias?.pct_2cat_default ?? null}
        pct3={pacote.categorias?.pct_3cat_default ?? null}
        nEvidencias={pacote.categorias?.evidencias?.length ?? 0}
        custosEditados={entradas.custosEditados}
        custosDoPacoteTem={pacote.custos != null}
        transporte={custosDoPacote(pacote).transporte}
      />
      <AvisosEPendencias />
    </div>
  );
}

/* ── 1. Cadeia de origem ──────────────────────────────────── */

function CadeiaDeOrigem({
  cadeia,
}: {
  cadeia: { rotulo: string; detalhe: string }[];
}) {
  return (
    <section className="bg-surface border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium">Cadeia de origem</h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        O caminho que cada número percorre do CAD até a tela.
      </p>
      <ol className="mt-3 space-y-0">
        {cadeia.map((e, i) => (
          <li key={e.rotulo} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="grid place-items-center w-6 h-6 rounded-full text-[11px] font-medium border border-border bg-background text-muted-foreground shrink-0"
                aria-hidden
              >
                {i + 1}
              </span>
              {i < cadeia.length - 1 ? (
                <span className="w-px flex-1 bg-border my-1" />
              ) : null}
            </div>
            <div className={i < cadeia.length - 1 ? "pb-3 min-w-0" : "min-w-0"}>
              <p className="text-sm text-foreground">{e.rotulo}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {e.detalhe}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── 2. Arquivos-fonte: declarados × anexados ─────────────── */

function ArquivosFonte({
  estudoId,
  declarados,
  onIrParaFontes,
}: {
  estudoId: string | null;
  declarados: { filename: string; size_bytes: number }[];
  onIrParaFontes?: () => void;
}) {
  const [dados, setDados] = useState<FontesResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!estudoId) return;
    try {
      setDados(await listarFontesXml(estudoId));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [estudoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const anexados = dados?.fontes ?? [];
  const porNome = new Map(anexados.map((f) => [chaveArquivo(f.filename), f]));
  const declaradosSet = new Set(declarados.map((d) => chaveArquivo(d.filename)));
  const extras = anexados.filter(
    (f) => !declaradosSet.has(chaveArquivo(f.filename)),
  );
  const status = dados?.index_status.status ?? (estudoId ? undefined : "sem_fontes");

  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">
            Arquivos-fonte ({declarados.length} declarado
            {declarados.length === 1 ? "" : "s"} no pacote)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {status ? STATUS_FONTES[status] ?? status : "consultando fontes…"}
            {dados?.index_status.n_sections
              ? ` · ${fmt(dados.index_status.n_sections)} seções indexadas`
              : ""}
          </p>
        </div>
        {onIrParaFontes ? (
          <button
            onClick={onIrParaFontes}
            className="text-xs text-manta hover:underline"
          >
            Gerenciar fontes brutas →
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="px-4 py-2 text-xs text-danger">{erro}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2">Arquivo</th>
              <th className="px-4 py-2 text-right">Tamanho</th>
              <th className="px-4 py-2">Bruto anexado</th>
            </tr>
          </thead>
          <tbody>
            {declarados.map((d, i) => {
              const anexo = porNome.get(chaveArquivo(d.filename));
              return (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-4 py-2 font-mono text-xs break-all">
                    {d.filename}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {fmtBytes(d.size_bytes)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {anexo ? (
                      <span className="flex items-center gap-1 text-success">
                        <Check size={13} />
                        <span className="font-mono text-[11px]">
                          sha256 {anexo.sha256.slice(0, 12)}…
                        </span>
                      </span>
                    ) : (
                      <span className="flex items-start gap-1 text-warning">
                        <X size={13} className="mt-0.5 shrink-0" />
                        <span>
                          não anexado — os números não são reconferíveis no bruto
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {extras.map((f) => (
              <tr key={f.fonte_id} className="border-t border-border align-top">
                <td className="px-4 py-2 font-mono text-xs break-all">
                  {f.filename}
                </td>
                <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                  {fmtBytes(f.bytes)}
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  anexado, fora da lista do pacote — não participou destes números
                </td>
              </tr>
            ))}
            {declarados.length === 0 && extras.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Nenhum arquivo-fonte registrado no pacote.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── 3. Catálogo de campos ────────────────────────────────── */

const FILTROS: { id: string; rotulo: string; teste: (l: LinhagemResolvida) => boolean }[] =
  [
    { id: "todos", rotulo: "Todos", teste: () => true },
    {
      id: "projeto",
      rotulo: "Do projeto",
      teste: (l) => l.prov === "extracted",
    },
    {
      id: "calculado",
      rotulo: "Calculado",
      teste: (l) => l.prov === "computed",
    },
    {
      id: "premissa",
      rotulo: "Premissa / manual",
      teste: (l) => l.prov === "default" || l.prov === "manual",
    },
    {
      id: "ausente",
      rotulo: "Sem dado",
      teste: (l) => l.situacao === "ausente",
    },
    {
      id: "ressalva",
      rotulo: "Com ressalva",
      teste: (l) => l.campo?.caveat != null,
    },
  ];

function CatalogoCampos({
  campos,
  titulo,
}: {
  campos: LinhagemResolvida[];
  titulo: string;
}) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [copiado, setCopiado] = useState(false);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const f = FILTROS.find((x) => x.id === filtro) ?? FILTROS[0];
    return campos.filter((l) => {
      if (!f.teste(l)) return false;
      if (!t) return true;
      return [
        l.chave,
        l.campo?.rotulo,
        l.campo?.origem,
        l.campo?.transformacao,
        l.valor,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(t));
    });
  }, [campos, busca, filtro]);

  const copiarMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        catalogoParaMarkdown(visiveis, titulo),
      );
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      /* clipboard bloqueado — o botão de CSV cobre o caso */
    }
  }, [visiveis, titulo]);

  const baixarCsv = useCallback(() => {
    const blob = new Blob(["﻿" + catalogoParaCsv(visiveis)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rastreabilidade-campos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [visiveis]);

  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">
            Catálogo de campos ({visiveis.length}
            {visiveis.length !== campos.length ? ` de ${campos.length}` : ""})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void copiarMd()}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
            >
              {copiado ? <Check size={12} /> : <Copy size={12} />}
              {copiado ? "copiado" : "Markdown"}
            </button>
            <button
              onClick={baixarCsv}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
            >
              <Download size={12} /> CSV
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar campo, origem, transformação…"
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  filtro === f.id
                    ? "border-manta text-manta bg-manta/10"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 min-w-[180px]">Dado</th>
              <th className="px-4 py-2 min-w-[130px]">Valor atual</th>
              <th className="px-4 py-2 min-w-[220px]">Origem</th>
              <th className="px-4 py-2 min-w-[280px]">Como é obtido</th>
              <th className="px-4 py-2">Onde aparece</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.chave} className="border-t border-border align-top">
                <td className="px-4 py-2.5">
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <span className="text-foreground">
                      {l.campo?.rotulo ?? l.chave}
                    </span>
                    <ChipFonte bloco={l.chave} />
                  </div>
                  <span className="block mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {l.chave}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums">
                  {l.situacao === "ausente" ? (
                    <span className="text-muted-foreground">
                      bloco ausente do pacote
                    </span>
                  ) : l.valor != null ? (
                    l.valor
                  ) : l.prov === "computed" ? (
                    <span className="text-muted-foreground">
                      resolvido no cenário ativo
                    </span>
                  ) : l.campo?.origemTipo === "manual" ? (
                    <span className="text-muted-foreground">
                      aguardando o projetista
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {l.campo ? (
                    <>
                      <span className="block text-foreground">
                        {ORIGEM_ROTULO[l.campo.origemTipo]}
                      </span>
                      {l.campo.origem}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">
                  {l.campo?.transformacao ?? "—"}
                  {l.campo?.escopo ? (
                    <span className="block mt-1 text-foreground/80">
                      Escopo: {l.campo.escopo}
                    </span>
                  ) : null}
                  {l.campo?.caveat ? (
                    <span className="mt-1 flex gap-1 text-warning">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      {l.campo.caveat}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground">
                  {(l.campo?.abas ?? []).join(", ") || "—"}
                </td>
              </tr>
            ))}
            {visiveis.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  Nenhum campo para este filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── 4. Método por seção ──────────────────────────────────── */

function MetodoPorSecao({
  metodos,
}: {
  metodos: ReturnType<typeof metodosPorEixo>;
}) {
  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Layers size={14} /> Método por seção
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cada seção registra como foi obtida. É a rastreabilidade mais fina
          disponível — responde de onde veio uma seção específica, e portanto o
          volume daquele trecho.
        </p>
      </div>
      <div className="divide-y divide-border">
        {metodos.map((m) => (
          <div key={m.eixoId} className="px-4 py-3">
            <p className="text-sm text-foreground">
              {m.eixoId}{" "}
              <span className="text-xs text-muted-foreground">
                · {fmt(m.total)} seções
              </span>
            </p>
            <ul className="mt-2 space-y-2">
              {m.porFonte.map((f) => (
                <li key={f.fonte} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground">{metodoRotulo(f.fonte)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmt(f.n)} ({fmt(f.pct, 1)}%)
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-muted/40 overflow-hidden">
                    <div
                      className="h-full bg-manta"
                      style={{ width: `${Math.max(f.pct, 0.5)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    {metodoExplicacao(f.fonte)}
                  </p>
                  {f.faixas.length > 0 ? (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {f.faixas.join(" · ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── 5. Premissas e custos ────────────────────────────────── */

function PremissasECustos({
  modo,
  pct2,
  pct3,
  nEvidencias,
  custosEditados,
  custosDoPacoteTem,
  transporte,
}: {
  modo: string;
  pct2: number | null;
  pct3: number | null;
  nEvidencias: number;
  custosEditados: boolean;
  custosDoPacoteTem: boolean;
  transporte: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="bg-surface border border-border rounded-lg p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          Categorias de escavação <ChipFonte bloco="categorias" />
        </h3>
        <dl className="mt-2 text-sm space-y-1">
          <Item termo="Modo" valor={modo} />
          <Item
            termo="2ª categoria"
            valor={pct2 == null ? "—" : `${fmt(pct2 * 100, 1)}%`}
          />
          <Item
            termo="3ª categoria"
            valor={pct3 == null ? "—" : `${fmt(pct3 * 100, 1)}%`}
          />
          <Item termo="Evidências" valor={`${nEvidencias}`} />
        </dl>
        {nEvidencias === 0 ? (
          <p className="mt-2 flex gap-1.5 text-xs text-warning leading-relaxed">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Sem evidência de campo: os percentuais são hipótese do adaptador, não
            levantamento. Categoria é o parâmetro que mais move o orçamento.
          </p>
        ) : null}
      </section>

      <section className="bg-surface border border-border rounded-lg p-4">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          Custos unitários{" "}
          <ChipFonte bloco="custos" prov={custosEditados ? "manual" : undefined} />
        </h3>
        <dl className="mt-2 text-sm space-y-1">
          <Item termo="Referência" valor={CUSTOS_REFERENCIA} />
          <Item
            termo="No pacote"
            valor={custosDoPacoteTem ? "sim" : "não — defaults SICRO"}
          />
          <Item termo="Editados neste estudo" valor={custosEditados ? "sim" : "não"} />
          <Item
            termo="Transporte"
            valor={`R$ ${fmt(transporte, 2)} / m³·km`}
          />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Custo direto de referência para comparar cenários — sem BDI,
          desoneração ou reajuste. Não é orçamento de licitação.
        </p>
      </section>
    </div>
  );
}

/* ── 6. Avisos e lacunas ──────────────────────────────────── */

function AvisosEPendencias() {
  const { pacote, entradas } = useEstudo();
  const geo = geometriaDe(pacote);
  const avisos = [
    ...(pacote.warnings ?? []),
    ...(geo?.warnings ?? []).map((w) => `[geometria] ${w}`),
  ];
  const pendentes = [
    entradas.cftBase == null ? "cftBase" : null,
    entradas.soloMole == null ? "soloMole" : null,
  ].filter(Boolean) as string[];

  return (
    <section className="bg-surface border border-border rounded-lg p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <AlertTriangle size={14} /> Avisos do processamento e lacunas
      </h3>
      {avisos.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {avisos.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhum aviso registrado no pacote.
        </p>
      )}
      {pendentes.length > 0 ? (
        <p className="mt-3 text-xs text-warning">
          Entradas pendentes (não extraíveis do LandXML, aguardando o
          projetista): {pendentes.map((p) => (
            <code key={p} className="font-mono">
              {" "}
              {p}
            </code>
          ))}
        </p>
      ) : null}
    </section>
  );
}

function Item({ termo, valor }: { termo: string; valor?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{termo}</dt>
      <dd className="text-right truncate">{valor || "—"}</dd>
    </div>
  );
}

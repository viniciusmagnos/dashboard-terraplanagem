/**
 * Botão "Exportar HTML" do dashboard de terraplenagem — gera, no próprio
 * navegador, um relatório HTML autocontido COM TODOS OS DADOS embutidos
 * (pacote .mtp.json + estado + orçamentos calculados por cenário), pronto
 * para abrir, imprimir ou enviar a outra IA. Também baixa os mesmos dados
 * como JSON puro.
 *
 * Um seletor de abas permite exportar SÓ os dados de algumas abas (ex.: só
 * Cenários, ou só Geotecnia, ou só Drenagem) — o recorte vale tanto para o
 * relatório visual quanto para o JSON embutido/baixado.
 *
 * Ao contrário do Excel (server-side), tudo vem do EstudoContext em memória
 * — não depende de sincronização com o backend.
 */
import { useState } from "react";
import { Braces, ChevronDown, FileCode2, Loader2 } from "lucide-react";
import {
  ABAS_EXPORT,
  gerarHtmlDashboard,
  montarDadosCompletos,
  nomeArquivo,
  type AbaExport,
  type DadosEstudoInput,
} from "../../lib/estudo-html-export";
import { drenagemDe, geotecniaDe } from "../../lib/mtp";
import { useEstudo } from "./cenarios/EstudoContext";

type Acao = "html" | "html-leve" | "json";

function baixar(nome: string, conteudo: string, mime: string) {
  const blob = new Blob([conteudo], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export function BotaoExportarHtml() {
  const ctx = useEstudo();
  const [open, setOpen] = useState(false);
  const [gerando, setGerando] = useState<Acao | null>(null);

  const temGeometria = !!ctx.pacote.geometria?.eixos?.length;
  const temGeotecnia = !!geotecniaDe(ctx.pacote)?.sondagens?.length;
  const temDrenagem = !!drenagemDe(ctx.pacote)?.dispositivos?.length;

  // Abas que fazem sentido para ESTE pacote (geotecnia/drenagem só se houver bloco).
  const disponiveis = ABAS_EXPORT.filter((a) =>
    a.requer === "geotecnia"
      ? temGeotecnia
      : a.requer === "drenagem"
        ? temDrenagem
        : true,
  );
  const idsDisponiveis = disponiveis.map((a) => a.id);

  // Seleção de abas — inicia com todas; ressincroniza se o pacote mudar.
  const [chave, setChave] = useState(idsDisponiveis.join(","));
  const [selecionadas, setSelecionadas] = useState<Set<AbaExport>>(
    () => new Set(idsDisponiveis),
  );
  if (chave !== idsDisponiveis.join(",")) {
    setChave(idsDisponiveis.join(","));
    setSelecionadas(new Set(idsDisponiveis));
  }

  const nSel = selecionadas.size;
  const nDisp = disponiveis.length;
  const parcial = nSel > 0 && nSel < nDisp;

  const alternar = (id: AbaExport) =>
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const marcarTodas = () => setSelecionadas(new Set(idsDisponiveis));
  const limpar = () => setSelecionadas(new Set());

  const montarInput = (): DadosEstudoInput => ({
    pacote: ctx.pacote,
    entradas: ctx.entradas,
    cenarios: ctx.cenarios,
    cenarioAtivoId: ctx.cenarioAtivoId,
    casoBase: ctx.casoBase,
    computados: ctx.computados,
    economias: ctx.economias,
    ativo: ctx.ativo,
    ativoEconomia: ctx.ativoEconomia,
    estudoId: ctx.estudoId,
    estudoRole: ctx.estudoRole,
    geradoEm: new Date().toISOString(),
  });

  /** Recorte de abas para as funções de export (undefined = todas). */
  const abasSelecionadas = (): AbaExport[] | undefined =>
    parcial ? idsDisponiveis.filter((id) => selecionadas.has(id)) : undefined;

  /** Sufixo de arquivo que identifica o recorte (uma aba → o id; várias → "-selecao"). */
  const sufixoRecorte = (): string => {
    if (!parcial) return "";
    const ids = idsDisponiveis.filter((id) => selecionadas.has(id));
    return ids.length === 1 ? `-${ids[0]}` : "-selecao";
  };

  const executar = (acao: Acao) => {
    if (gerando || nSel === 0) return;
    setGerando(acao);
    // setTimeout(0): deixa o spinner pintar antes de montar a string (pacotes
    // com geometria podem ter alguns MB).
    window.setTimeout(() => {
      try {
        const input = montarInput();
        const abas = abasSelecionadas();
        const recorte = sufixoRecorte();
        if (acao === "json") {
          const dados = montarDadosCompletos(input, {
            incluirGeometria: temGeometria,
            abas,
          });
          baixar(
            nomeArquivo(ctx.pacote, "json", `-dados${recorte}`),
            JSON.stringify(dados, null, temGeometria ? undefined : 2),
            "application/json;charset=utf-8",
          );
        } else {
          const incluirGeometria = acao === "html";
          const html = gerarHtmlDashboard(input, { incluirGeometria, abas });
          baixar(
            nomeArquivo(ctx.pacote, "html", `${incluirGeometria ? "" : "-leve"}${recorte}`),
            html,
            "text/html;charset=utf-8",
          );
        }
      } finally {
        setGerando(null);
        setOpen(false);
      }
    }, 30);
  };

  const opcoes: {
    acao: Acao;
    Icone: typeof FileCode2;
    rotulo: string;
    detalhe: string;
    oculto?: boolean;
    divisor?: boolean;
  }[] = [
    {
      acao: "html",
      Icone: FileCode2,
      rotulo: "Relatório HTML (com dados)",
      detalhe: temGeometria
        ? "Página única com relatório + todos os dados (inclui geometria)"
        : "Página única com relatório + todos os dados embutidos",
    },
    {
      acao: "html-leve",
      Icone: FileCode2,
      rotulo: "Relatório HTML leve",
      detalhe: "Menor — omite o traçado/seções (geometria)",
      oculto: !temGeometria,
    },
    {
      acao: "json",
      Icone: Braces,
      rotulo: "Dados completos (JSON)",
      detalhe: "Pacote + estado + orçamentos calculados por cenário",
      divisor: true,
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Exportar relatório HTML autocontido (para abrir ou enviar a outra IA)"
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-hover transition-colors"
      >
        <FileCode2 size={14} /> Exportar HTML <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-surface border border-border rounded-lg shadow-xl py-1">
            {/* Seletor de abas */}
            <div className="px-3 pt-1.5 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Abas incluídas ({nSel}/{nDisp})
                </span>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <button onClick={marcarTodas} className="text-manta hover:underline">
                    Todas
                  </button>
                  <span className="text-border">·</span>
                  <button onClick={limpar} className="text-manta hover:underline">
                    Nenhuma
                  </button>
                </span>
              </div>
              <div className="mt-1.5 grid gap-0.5 max-h-52 overflow-y-auto pr-0.5">
                {disponiveis.map((a) => {
                  const on = selecionadas.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 px-1.5 py-1 rounded text-[12.5px] cursor-pointer hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => alternar(a.id)}
                        className="accent-manta"
                      />
                      <span className={on ? "" : "text-muted-foreground"}>{a.rotulo}</span>
                    </label>
                  );
                })}
              </div>
              {nSel === 0 && (
                <p className="mt-1 text-[11px] text-manta">Selecione ao menos uma aba.</p>
              )}
            </div>

            {/* Ações */}
            {opcoes
              .filter((op) => !op.oculto)
              .map((op) => {
                const desabilitado =
                  nSel === 0 || (!!gerando && gerando !== op.acao);
                return (
                  <button
                    key={op.acao}
                    onClick={() => executar(op.acao)}
                    disabled={desabilitado}
                    className={`w-full px-3 py-2 text-left transition-colors ${
                      desabilitado
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-surface-hover"
                    } ${op.divisor ? "border-t border-border" : ""}`}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {gerando === op.acao ? (
                        <Loader2 size={13} className="animate-spin shrink-0" />
                      ) : (
                        <op.Icone size={13} className="shrink-0 text-muted-foreground" />
                      )}
                      {op.rotulo}
                      {parcial && (
                        <span className="ml-auto text-[10px] text-manta shrink-0">
                          {nSel} aba{nSel > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                    <span className="block pl-[21px] text-[11px] text-muted-foreground">
                      {op.detalhe}
                    </span>
                  </button>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

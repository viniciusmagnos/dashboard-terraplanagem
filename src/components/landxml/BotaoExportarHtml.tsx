/**
 * Botão "Exportar HTML" do dashboard de terraplenagem — gera, no próprio
 * navegador, um relatório HTML autocontido COM TODOS OS DADOS embutidos
 * (pacote .mtp.json + estado + orçamentos calculados por cenário), pronto
 * para abrir, imprimir ou enviar a outra IA. Também baixa os mesmos dados
 * como JSON puro.
 *
 * Ao contrário do Excel (server-side), tudo vem do EstudoContext em memória
 * — não depende de sincronização com o backend.
 */
import { useState } from "react";
import { Braces, ChevronDown, FileCode2, Loader2 } from "lucide-react";
import {
  gerarHtmlDashboard,
  montarDadosCompletos,
  nomeArquivo,
  type DadosEstudoInput,
} from "../../lib/estudo-html-export";
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

  const executar = (acao: Acao) => {
    if (gerando) return;
    setGerando(acao);
    // setTimeout(0): deixa o spinner pintar antes de montar a string (pacotes
    // com geometria podem ter alguns MB).
    window.setTimeout(() => {
      try {
        const input = montarInput();
        if (acao === "json") {
          const dados = montarDadosCompletos(input, {
            incluirGeometria: temGeometria,
          });
          baixar(
            nomeArquivo(ctx.pacote, "json", "-dados"),
            JSON.stringify(dados, null, temGeometria ? undefined : 2),
            "application/json;charset=utf-8",
          );
        } else {
          const incluirGeometria = acao === "html";
          const html = gerarHtmlDashboard(input, { incluirGeometria });
          baixar(
            nomeArquivo(ctx.pacote, "html", incluirGeometria ? "" : "-leve"),
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
            {opcoes
              .filter((op) => !op.oculto)
              .map((op) => {
                const desabilitado = !!gerando && gerando !== op.acao;
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

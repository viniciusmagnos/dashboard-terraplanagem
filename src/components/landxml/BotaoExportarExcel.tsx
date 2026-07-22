/**
 * Botão "Exportar Excel" do dashboard de terraplenagem — dropdown com um
 * XLSX por assunto (GET /api/estudos/{id}/export/{tipo}), para o cliente
 * receber só a parte que interessa, ou o workbook completo.
 */
import { useState } from "react";
import { ChevronDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { urlExportEstudo, type ExportTipo } from "../../lib/estudo-api";
import { drenagemDe, geotecniaDe } from "../../lib/mtp";
import { useEstudo } from "./cenarios/EstudoContext";

/** Espera o push debounced (300 ms) do EstudoContext chegar ao servidor. */
const ATRASO_SYNC_MS = 650;

interface Opcao {
  tipo: ExportTipo;
  rotulo: string;
  detalhe: string;
  /** Motivo quando o pacote não tem o bloco (item desabilitado). */
  indisponivel?: string | null;
}

export function BotaoExportarExcel() {
  const { pacote, estudoId, syncStatus, cenarioAtivoId, ativo } = useEstudo();
  const [open, setOpen] = useState(false);
  const [baixando, setBaixando] = useState<ExportTipo | null>(null);

  const temGeometria = !!pacote.geometria?.eixos?.length;
  const temSondagens = !!geotecniaDe(pacote)?.sondagens?.length;
  const temDrenagem = !!drenagemDe(pacote)?.dispositivos?.length;
  const temBruckner = ativo.bruckner != null;

  const opcoes: Opcao[] = [
    { tipo: "geral", rotulo: "Dados gerais", detalhe: "KPIs, extensões e eixos" },
    {
      tipo: "tracado",
      rotulo: "Traçado da pista",
      detalhe: "Planta E/N, perfil longitudinal e seções",
      indisponivel: temGeometria ? null : "Pacote sem bloco de geometria",
    },
    {
      tipo: "bruckner",
      rotulo: "Diagrama de Brückner",
      detalhe: "Ondas, faixas de DMT e curva",
      indisponivel: temBruckner ? null : "Cenário ativo sem Brückner",
    },
    {
      tipo: "volumes",
      rotulo: "Volumes de corte e aterro",
      detalhe: "Por grandeza, por eixo e por trecho",
    },
    {
      tipo: "geotecnia",
      rotulo: "Sondagens (todas)",
      detalhe: "Furos, camadas e materiais por eixo",
      indisponivel: temSondagens ? null : "Pacote sem sondagens",
    },
    {
      tipo: "drenagem",
      rotulo: "Drenagem",
      detalhe: "Dispositivos (bruto), travessias e bacias",
      indisponivel: temDrenagem ? null : "Pacote sem bloco de drenagem",
    },
    {
      tipo: "orcamento",
      rotulo: "Orçamento e DME",
      detalhe: "Cenário ativo: memória de cálculo, momento e custos",
    },
    {
      tipo: "comparativo",
      rotulo: "Comparativo de cenários",
      detalhe: "Caso base × cenários + vetores de economia",
    },
    {
      tipo: "completo",
      rotulo: "Completo (tudo)",
      detalhe: "Workbook único com todas as planilhas",
    },
  ];

  const pronto = !!estudoId && syncStatus === "ok";

  const baixar = (tipo: ExportTipo) => {
    if (!estudoId || baixando) return;
    setBaixando(tipo);
    // Dá tempo do push debounced do estado (300 ms) chegar ao servidor —
    // o export lê o estudo server-side.
    window.setTimeout(() => {
      const a = document.createElement("a");
      a.href = urlExportEstudo(estudoId, tipo, { cenarioId: cenarioAtivoId });
      a.download = "";
      a.click();
      setBaixando(null);
      setOpen(false);
    }, ATRASO_SYNC_MS);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!pronto}
        title={
          pronto
            ? "Exportar planilhas Excel por assunto"
            : syncStatus === "offline"
              ? "Estudo não sincronizado (faça login / verifique o backend landxml)"
              : "Sincronizando estudo…"
        }
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-hover disabled:opacity-40 transition-colors"
      >
        <FileSpreadsheet size={14} /> Exportar Excel <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-surface border border-border rounded-lg shadow-xl py-1">
            {opcoes.map((op) => {
              const desabilitado = !!op.indisponivel || (!!baixando && baixando !== op.tipo);
              return (
                <button
                  key={op.tipo}
                  onClick={() => baixar(op.tipo)}
                  disabled={desabilitado}
                  title={op.indisponivel ?? undefined}
                  className={`w-full px-3 py-2 text-left transition-colors ${
                    desabilitado
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-surface-hover"
                  } ${op.tipo === "completo" ? "border-t border-border" : ""}`}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {baixando === op.tipo ? (
                      <Loader2 size={13} className="animate-spin shrink-0" />
                    ) : (
                      <FileSpreadsheet size={13} className="shrink-0 text-muted-foreground" />
                    )}
                    {op.rotulo}
                  </span>
                  <span className="block pl-[21px] text-[11px] text-muted-foreground">
                    {op.indisponivel ?? op.detalhe}
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

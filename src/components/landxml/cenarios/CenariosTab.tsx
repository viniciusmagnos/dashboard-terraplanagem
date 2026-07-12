/**
 * Aba Cenários — simulador com premissas editáveis (substitui o antigo
 * SimuladorBruckner): barra de cenários (caso base + N), parâmetros físicos
 * (Brückner) + premissas econômicas (Motiva) + entradas do projeto, KPIs ao
 * vivo com delta vs caso base e curva recalculada.
 */
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { fmt, fmtBRLCompacto, fmtPct } from "../../../lib/format";
import type { MtpBarreira } from "../../../lib/mtp";
import { BrucknerChart } from "../BrucknerChart";
import { BrucknerLegenda } from "../BrucknerLegenda";
import { KpiCard } from "../KpiCard";
import { ProvChip } from "../ProvChip";
import { useEstudo } from "./EstudoContext";
import { PainelEntradasProjeto } from "./PainelEntradasProjeto";
import { PainelParametrosBruckner } from "./PainelParametrosBruckner";
import { PainelPremissas } from "./PainelPremissas";

function deltaPct(atual: number | null | undefined, base: number | null | undefined) {
  if (atual == null || base == null || Math.abs(base) < 1e-9) return null;
  return (atual / base - 1) * 100;
}

function BarraCenarios() {
  const {
    cenarios,
    cenarioAtivoId,
    setCenarioAtivoId,
    criarCenario,
    duplicarCenario,
    renomearCenario,
    removerCenario,
  } = useEstudo();

  const chip = (ativo: boolean) =>
    `px-3 py-1.5 rounded-full text-sm border transition-colors ${
      ativo
        ? "bg-cyan-600 border-cyan-600 text-white font-medium"
        : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
    }`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className={chip(cenarioAtivoId === null)} onClick={() => setCenarioAtivoId(null)}>
        Caso base
      </button>
      {cenarios.map((c) => (
        <button
          key={c.id}
          className={chip(cenarioAtivoId === c.id)}
          onClick={() => setCenarioAtivoId(c.id)}
        >
          {c.nome}
        </button>
      ))}
      <button
        onClick={() => {
          const nome = window.prompt(
            "Nome do cenário:",
            `Cenário ${cenarios.length + 1}`,
          );
          if (nome !== null) criarCenario(nome);
        }}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
      >
        <Plus size={14} /> Novo cenário
      </button>
      {cenarioAtivoId && (
        <span className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => {
              const c = cenarios.find((x) => x.id === cenarioAtivoId);
              const nome = window.prompt("Renomear cenário:", c?.nome ?? "");
              if (nome) renomearCenario(cenarioAtivoId, nome);
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            title="Renomear"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => duplicarCenario(cenarioAtivoId)}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            title="Duplicar"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => {
              if (window.confirm("Excluir este cenário?"))
                removerCenario(cenarioAtivoId);
            }}
            className="p-1.5 text-muted-foreground hover:text-rose-400"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

export function CenariosTab() {
  const { pacote, entradas, casoBase, ativo, ativoEconomia, cenarioAtivoId } =
    useEstudo();

  const brAtivo = ativo.bruckner;
  const brBase = casoBase.bruckner;

  const barreirasVisiveis: MtpBarreira[] = [
    ...pacote.barreiras.filter((b) =>
      ativo.def.bruckner.barreirasAtivas.includes(b.sta_m),
    ),
    ...ativo.def.bruckner.barreirasExtras.map((b) => ({
      sta_m: b.sta_m,
      nome: b.nome,
      tipo: "manual",
    })),
  ];

  return (
    <div className="space-y-4">
      <BarraCenarios />

      <div className="grid gap-4 lg:grid-cols-2">
        <PainelParametrosBruckner />
        <PainelPremissas />
      </div>

      <PainelEntradasProjeto />

      {/* KPIs do cenário ativo */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          rotulo="Momento de transporte"
          valor={ativo.momento.total}
          sufixo="m³·km"
          deltaPct={
            cenarioAtivoId
              ? deltaPct(ativo.momento.total, casoBase.momento.total)
              : null
          }
          chip={<ProvChip pacote={pacote} bloco="bruckner" />}
          rodape={
            ativo.momento.corteAterroFonte === "bruckner"
              ? "corte→aterro do Brückner + acessos"
              : "todo por premissa (sem Brückner)"
          }
        />
        <KpiCard
          rotulo="DMT real (Brückner)"
          valor={brAtivo?.totals.dmt_medio_m ?? null}
          sufixo="m"
          deltaPct={
            cenarioAtivoId
              ? deltaPct(
                  brAtivo?.totals.dmt_medio_m,
                  brBase?.totals.dmt_medio_m,
                )
              : null
          }
          chip={<ProvChip pacote={pacote} bloco="bruckner" />}
        />
        <KpiCard
          rotulo="Custo total"
          valor={ativo.orcamento.total}
          formato={fmtBRLCompacto}
          deltaPct={
            cenarioAtivoId
              ? deltaPct(ativo.orcamento.total, casoBase.orcamento.total)
              : null
          }
          chip={
            <ProvChip
              pacote={pacote}
              prov={entradas.custosEditados ? "manual" : undefined}
              bloco="custos"
            />
          }
        />
        <KpiCard
          rotulo="Sobra → bota-fora"
          valor={brAtivo?.totals.sobra_bota_fora ?? ativo.volumes.bfTotal}
          sufixo="m³"
          deltaPct={
            cenarioAtivoId
              ? deltaPct(
                  brAtivo?.totals.sobra_bota_fora,
                  brBase?.totals.sobra_bota_fora,
                )
              : null
          }
        />
        <KpiCard
          rotulo="Falta → empréstimo"
          valor={brAtivo?.totals.falta_emprestimo ?? ativo.volumes.jazidaTotal}
          sufixo="m³"
          deltaPct={
            cenarioAtivoId
              ? deltaPct(
                  brAtivo?.totals.falta_emprestimo,
                  brBase?.totals.falta_emprestimo,
                )
              : null
          }
        />
        <KpiCard
          rotulo="Economia vs caso base"
          valor={ativoEconomia?.total ?? null}
          formato={fmtBRLCompacto}
          rodape={
            ativoEconomia
              ? `${fmtPct(ativoEconomia.percent)} do caso base`
              : "selecione um cenário"
          }
        />
      </div>

      {/* Resumo de reclassificação (alargamentos) */}
      {(ativo.volumesCalc.jazidaNaFaixa > 0 || ativo.volumesCalc.bfNaFaixa > 0) && (
        <div className="bg-surface border border-border rounded-lg p-3 text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
          <span>
            Jazida na faixa (alargamento):{" "}
            <span className="text-emerald-400 font-medium">
              {fmt(ativo.volumesCalc.jazidaNaFaixa)} m³
            </span>{" "}
            sem royalty
          </span>
          <span>
            BF na faixa (alargamento):{" "}
            <span className="text-emerald-400 font-medium">
              {fmt(ativo.volumesCalc.bfNaFaixa)} m³
            </span>{" "}
            sem royalty
          </span>
          <span>
            Royalty evitado:{" "}
            <span className="text-emerald-400 font-medium">
              {fmtBRLCompacto(
                (ativo.volumesCalc.jazidaNaFaixa + ativo.volumesCalc.bfNaFaixa) *
                  entradas.custos.royalty,
              )}
            </span>
          </span>
        </div>
      )}

      {/* Curva do cenário ativo */}
      {brAtivo ? (
        <BrucknerChart curve={brAtivo.curve} barreiras={barreirasVisiveis} altura={280} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Pacote sem bins de eixos principais — simulação só com premissas.
        </p>
      )}

      <BrucknerLegenda compacta />
    </div>
  );
}

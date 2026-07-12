/**
 * Aba Orçamento e DME — orçamento detalhado do cenário ativo (5 grupos:
 * escavação/transporte/compactação/royalty/conformação), composição vs caso
 * base (BarChart), quadro origem×destino, momento por fluxo e painel DME.
 */
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt, fmtBRL, fmtBRLCompacto, fmtPct } from "../../../lib/format";
import { KpiCard } from "../KpiCard";
import { ProvChip } from "../ProvChip";
import { useEstudo } from "./EstudoContext";
import { DmePanel } from "./DmePanel";
import { MomentoPorFluxo } from "./MomentoPorFluxo";
import { QuadroOrigemDestino } from "./QuadroOrigemDestino";

function SeletorCenario() {
  const { cenarios, cenarioAtivoId, setCenarioAtivoId } = useEstudo();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Cenário:</span>
      <select
        value={cenarioAtivoId ?? ""}
        onChange={(e) => setCenarioAtivoId(e.target.value || null)}
        className="bg-background border border-border rounded px-2.5 py-1.5 text-sm"
      >
        <option value="">Caso base</option>
        {cenarios.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

interface LinhaOrc {
  rotulo: string;
  volume: number;
  unidade: string;
  unitario: number;
  subtotal: number;
  nota?: string;
}

function GrupoOrcamento({
  titulo,
  linhas,
  subtotal,
  subtotalBase,
}: {
  titulo: string;
  linhas: LinhaOrc[];
  subtotal: number;
  /** Subtotal do caso base — mostra o delta do grupo (o que mudou e o que não). */
  subtotalBase?: number | null;
}) {
  const visiveis = linhas.filter((l) => l.volume > 0 || l.subtotal > 0);
  if (!visiveis.length && subtotal <= 0) return null;
  const pct =
    subtotalBase != null && Math.abs(subtotalBase) > 1e-9
      ? (subtotal / subtotalBase - 1) * 100
      : null;
  return (
    <>
      <tr className="border-t border-border bg-surface-hover/40">
        <td className="px-3 py-1.5 font-medium" colSpan={4}>
          {titulo}
        </td>
        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
          {fmtBRL(subtotal)}
          {pct != null &&
            (Math.abs(pct) >= 0.05 ? (
              <span
                className={`block text-[10px] font-normal ${
                  pct < 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {pct > 0 ? "+" : ""}
                {fmt(pct, 1)}% vs caso base
              </span>
            ) : (
              <span className="block text-[10px] font-normal text-muted-foreground">
                = caso base
              </span>
            ))}
        </td>
      </tr>
      {visiveis.map((l) => (
        <tr key={`${titulo}:${l.rotulo}`} className="border-t border-border/60">
          <td className="px-3 py-1.5 pl-6 text-muted-foreground">
            {l.rotulo}
            {l.nota && (
              <span className="block text-[10px] text-muted-foreground/70">
                {l.nota}
              </span>
            )}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums">{fmt(l.volume)}</td>
          <td className="px-3 py-1.5 text-muted-foreground">{l.unidade}</td>
          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
            {fmtBRL(l.unitario, 2)}
          </td>
          <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(l.subtotal)}</td>
        </tr>
      ))}
    </>
  );
}

export function OrcamentoTab() {
  const { pacote, entradas, casoBase, ativo, ativoEconomia, cenarioAtivoId } =
    useEstudo();
  const orc = ativo.orcamento;
  const vb = ativo.volumes;
  const vc = ativo.volumesCalc;
  const c = entradas.custos;

  const extKm = pacote.extensoes.comServico || pacote.extensoes.total || null;
  const custoPorKm = extKm ? orc.total / extKm : null;
  const custoPorM3Aterro = vb.aterroFc > 0 ? orc.total / vb.aterroFc : null;

  const nomeAtivo = cenarioAtivoId ? ativo.def.nome : "Caso base";
  const dadosComposicao = useMemo(() => {
    const grupos: [string, number, number][] = [
      ["Escavação", casoBase.orcamento.escavacao.subtotal, orc.escavacao.subtotal],
      ["Transporte", casoBase.orcamento.transporte.custo, orc.transporte.custo],
      ["Compactação", casoBase.orcamento.compactacao.subtotal, orc.compactacao.subtotal],
      ["Royalty", casoBase.orcamento.royalty.subtotal, orc.royalty.subtotal],
      ["Conform. BF", casoBase.orcamento.conformacaoBF.subtotal, orc.conformacaoBF.subtotal],
    ];
    return grupos.map(([grupo, base, atual]) => ({
      grupo,
      "Caso base": Math.round(base),
      ...(cenarioAtivoId ? { [nomeAtivo]: Math.round(atual) } : {}),
    }));
  }, [casoBase.orcamento, orc, cenarioAtivoId, nomeAtivo]);

  const faltamEntradas =
    (entradas.cftBase == null || entradas.cftBase <= 0) &&
    (entradas.soloMole == null || entradas.soloMole <= 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SeletorCenario />
        <ProvChip
          pacote={pacote}
          prov={entradas.custosEditados ? "manual" : undefined}
          bloco="custos"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard
          rotulo="Custo total de terraplenagem"
          valor={orc.total}
          formato={fmtBRLCompacto}
          deltaPct={
            cenarioAtivoId && casoBase.orcamento.total > 0
              ? (orc.total / casoBase.orcamento.total - 1) * 100
              : null
          }
        />
        <KpiCard
          rotulo="Custo por km (com serviço)"
          valor={custoPorKm}
          formato={fmtBRLCompacto}
          rodape={extKm ? `${fmt(extKm, 2)} km` : "extensão indisponível"}
        />
        <KpiCard
          rotulo="Custo por m³ de aterro"
          valor={custoPorM3Aterro}
          formato={(v) => fmtBRL(v, 2)}
        />
        <KpiCard
          rotulo="Economia vs caso base"
          valor={ativoEconomia?.total ?? null}
          formato={fmtBRLCompacto}
          rodape={
            ativoEconomia ? fmtPct(ativoEconomia.percent) : "selecione um cenário"
          }
        />
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-sm font-medium mb-2">Composição do custo por grupo</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dadosComposicao} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#33415555" />
            <XAxis dataKey="grupo" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => fmtBRLCompacto(v)}
              width={80}
            />
            <Tooltip formatter={(v) => fmtBRL(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Caso base" fill="#64748b" radius={[3, 3, 0, 0]} />
            {cenarioAtivoId && (
              <Bar dataKey={nomeAtivo} fill="#06b6d4" radius={[3, 3, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Orçamento detalhado — {nomeAtivo}</p>
          {faltamEntradas && (
            <p className="text-[11px] text-amber-400">
              CFT/solo mole não informados — preencha em Cenários → Entradas do
              projeto
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2 text-right">Volume</th>
                <th className="px-3 py-2">Un</th>
                <th className="px-3 py-2 text-right">Unitário</th>
                <th className="px-3 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <GrupoOrcamento
                titulo="Escavação"
                subtotal={orc.escavacao.subtotal}
                subtotalBase={
                  cenarioAtivoId ? casoBase.orcamento.escavacao.subtotal : null
                }
                linhas={[
                  { rotulo: "Corte 1ª/2ª categoria", volume: vb.corte12Cat, unidade: "m³", unitario: c.escavacao12, subtotal: orc.escavacao.corte12 },
                  { rotulo: "Corte 3ª categoria (rocha)", volume: vb.corte3Cat, unidade: "m³", unitario: c.escavacao3, subtotal: orc.escavacao.corte3 },
                  { rotulo: "CFT — camada final", volume: vc.cftVolume, unidade: "m³", unitario: c.escavacaoCFT, subtotal: orc.escavacao.cft },
                  { rotulo: "Jazida na faixa (alargamento)", volume: vc.jazidaNaFaixa, unidade: "m³", unitario: c.escavacaoJazida, subtotal: orc.escavacao.jazidaNaFaixa, nota: "sem royalty" },
                  { rotulo: "Jazida fora da faixa", volume: vc.jazidaForaFaixa, unidade: "m³", unitario: c.escavacaoJazida, subtotal: orc.escavacao.jazidaForaFaixa },
                  { rotulo: "Solo mole", volume: vb.soloMole, unidade: "m³", unitario: c.escavacaoSoloMole, subtotal: orc.escavacao.soloMole },
                ]}
              />
              <GrupoOrcamento
                titulo="Transporte"
                subtotal={orc.transporte.custo}
                subtotalBase={
                  cenarioAtivoId ? casoBase.orcamento.transporte.custo : null
                }
                linhas={[
                  { rotulo: "Momento total", volume: orc.transporte.momento, unidade: "m³·km", unitario: c.transporte, subtotal: orc.transporte.custo },
                ]}
              />
              <GrupoOrcamento
                titulo="Compactação"
                subtotal={orc.compactacao.subtotal}
                subtotalBase={
                  cenarioAtivoId ? casoBase.orcamento.compactacao.subtotal : null
                }
                linhas={[
                  { rotulo: "Aterro", volume: vb.aterroFc, unidade: "m³c", unitario: c.compactacaoAterro, subtotal: orc.compactacao.aterro },
                  { rotulo: "CFT", volume: vc.cftVolume, unidade: "m³c", unitario: c.compactacaoCFT, subtotal: orc.compactacao.cft },
                  { rotulo: "Solo mole compactado", volume: vb.soloMoleCompactado, unidade: "m³c", unitario: c.compactacaoSoloMole, subtotal: orc.compactacao.soloMole },
                ]}
              />
              <GrupoOrcamento
                titulo="Royalty (fora da faixa)"
                subtotal={orc.royalty.subtotal}
                subtotalBase={
                  cenarioAtivoId ? casoBase.orcamento.royalty.subtotal : null
                }
                linhas={[
                  { rotulo: "Jazida fora da faixa", volume: vc.jazidaForaFaixa, unidade: "m³", unitario: c.royalty, subtotal: orc.royalty.jazidaForaFaixa },
                  { rotulo: "BF fora da faixa", volume: vc.bfForaFaixa, unidade: "m³", unitario: c.royalty, subtotal: orc.royalty.bfForaFaixa },
                  { rotulo: "BF 3ª categoria", volume: vc.bf3Cat, unidade: "m³", unitario: c.royalty, subtotal: orc.royalty.bf3Cat },
                ]}
              />
              <GrupoOrcamento
                titulo="Conformação de bota-fora"
                subtotal={orc.conformacaoBF.subtotal}
                subtotalBase={
                  cenarioAtivoId
                    ? casoBase.orcamento.conformacaoBF.subtotal
                    : null
                }
                linhas={[
                  { rotulo: "BF na faixa (alargamento)", volume: vc.bfNaFaixa, unidade: "m³", unitario: c.conformacaoBF, subtotal: orc.conformacaoBF.naFaixa, nota: "sem royalty" },
                  { rotulo: "BF fora da faixa", volume: vc.bfForaFaixa, unidade: "m³", unitario: c.conformacaoBF, subtotal: orc.conformacaoBF.foraFaixa },
                  { rotulo: "BF 3ª categoria", volume: vc.bf3Cat, unidade: "m³", unitario: c.conformacaoBF, subtotal: orc.conformacaoBF.bf3Cat },
                ]}
              />
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-3 py-2">TOTAL</td>
                <td colSpan={3} />
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtBRL(orc.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuadroOrigemDestino />
        <MomentoPorFluxo />
      </div>

      <DmePanel />
    </div>
  );
}

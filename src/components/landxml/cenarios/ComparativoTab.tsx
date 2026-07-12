/**
 * Aba Comparativo — quadro caso base × N cenários gerado dinamicamente:
 * física (Brückner), volumes reclassificados, orçamento por grupo, custo/km
 * e vetores de economia, com deltas absolutos e % coloridos.
 */
import { useMemo, useState } from "react";
import { fmt, fmtBRL, fmtPct } from "../../../lib/format";
import type { CenarioComputado, Economia } from "../../../lib/cenario";
import { useEstudo } from "./EstudoContext";

type Formato = (v: number) => string;

interface LinhaDef {
  rotulo: string;
  get: (c: CenarioComputado) => number | null;
  formato?: Formato;
  /** true (default): menor é melhor (verde quando cai vs base). */
  menorMelhor?: boolean;
  /** sem delta (ex.: premissas). */
  semDelta?: boolean;
}

interface GrupoDef {
  titulo: string;
  linhas: LinhaDef[];
}

const fmtInt: Formato = (v) => fmt(v);
const fmtMoney: Formato = (v) => fmtBRL(v);

function celula(
  def: LinhaDef,
  comp: CenarioComputado,
  base: CenarioComputado,
  ehBase: boolean,
) {
  const v = def.get(comp);
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const f = def.formato ?? fmtInt;
  if (ehBase || def.semDelta) return <>{f(v)}</>;
  const b = def.get(base);
  if (b == null || Math.abs(b) < 1e-9)
    return (
      <>
        {f(v)}
      </>
    );
  const pct = (v / b - 1) * 100;
  if (Math.abs(pct) < 0.05) return <>{f(v)}</>;
  const bom = (def.menorMelhor ?? true) ? pct < 0 : pct > 0;
  return (
    <>
      {f(v)}
      <span
        className={`block text-[10px] ${bom ? "text-emerald-400" : "text-rose-400"}`}
      >
        {pct > 0 ? "+" : ""}
        {fmt(pct, 1)}% ({pct > 0 ? "+" : "−"}
        {f(Math.abs(v - b))})
      </span>
    </>
  );
}

export function ComparativoTab() {
  const { pacote, cenarios, casoBase, computados, economias } = useEstudo();
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(cenarios.map((c) => c.id)),
  );

  const colunas = useMemo(() => {
    const cols: { id: string | null; nome: string; comp: CenarioComputado; eco: Economia | null }[] = [
      { id: null, nome: "Caso base", comp: casoBase, eco: null },
    ];
    for (const c of cenarios) {
      if (!selecionados.has(c.id)) continue;
      const comp = computados.get(c.id);
      if (comp) cols.push({ id: c.id, nome: c.nome, comp, eco: economias.get(c.id) ?? null });
    }
    return cols;
  }, [cenarios, selecionados, casoBase, computados, economias]);

  const extKm = pacote.extensoes.comServico || pacote.extensoes.total || 0;

  const grupos: GrupoDef[] = [
    {
      titulo: "Física (Brückner)",
      linhas: [
        { rotulo: "Momento Brückner (m³·km)", get: (c) => c.bruckner?.totals.momento_m3km ?? null },
        { rotulo: "DMT real (m)", get: (c) => c.bruckner?.totals.dmt_medio_m ?? null },
        { rotulo: "Volume compensado (m³)", get: (c) => c.bruckner?.totals.volume_compensado ?? null, menorMelhor: false },
        { rotulo: "Sobra → bota-fora (m³)", get: (c) => c.bruckner?.totals.sobra_bota_fora ?? c.volumes.bfTotal },
        { rotulo: "Falta → empréstimo (m³)", get: (c) => c.bruckner?.totals.falta_emprestimo ?? c.volumes.jazidaTotal },
      ],
    },
    {
      titulo: "Volumes do cenário",
      linhas: [
        { rotulo: "Corte total (m³)", get: (c) => c.volumes.corteTotal, semDelta: true },
        { rotulo: "Aterro (m³c)", get: (c) => c.volumes.aterroFc, semDelta: true },
        { rotulo: "CFT executada (m³)", get: (c) => c.volumesCalc.cftVolume },
        { rotulo: "Jazida na faixa (m³)", get: (c) => c.volumesCalc.jazidaNaFaixa, menorMelhor: false },
        { rotulo: "Jazida fora da faixa (m³)", get: (c) => c.volumesCalc.jazidaForaFaixa },
        { rotulo: "BF na faixa (m³)", get: (c) => c.volumesCalc.bfNaFaixa, menorMelhor: false },
        { rotulo: "BF fora da faixa (m³)", get: (c) => c.volumesCalc.bfForaFaixa },
        { rotulo: "BF 3ª categoria (m³)", get: (c) => c.volumesCalc.bf3Cat },
      ],
    },
    {
      titulo: "Premissas",
      linhas: [
        { rotulo: "Fator de homogeneização", get: (c) => c.def.bruckner.fillFactor, formato: (v) => fmt(v, 2), semDelta: true },
        { rotulo: "Barreiras ativas", get: (c) => c.def.bruckner.barreirasAtivas.length + c.def.bruckner.barreirasExtras.length, semDelta: true },
        { rotulo: "Alargamento de corte (%)", get: (c) => c.def.premissas.alargamentoCortePercent * 100, formato: (v) => fmt(v, 0), semDelta: true },
        { rotulo: "Alargamento de aterro (%)", get: (c) => c.def.premissas.alargamentoAterroPercent * 100, formato: (v) => fmt(v, 0), semDelta: true },
        { rotulo: "CFT executada (%)", get: (c) => c.def.premissas.cftPercent * 100, formato: (v) => fmt(v, 0), semDelta: true },
        { rotulo: "DMT jazida fora (km)", get: (c) => c.def.premissas.dmtJazidaForaFaixa, formato: (v) => fmt(v, 2), semDelta: true },
        { rotulo: "DMT BF fora (km)", get: (c) => c.def.premissas.dmtBFForaFaixa, formato: (v) => fmt(v, 2), semDelta: true },
      ],
    },
    {
      titulo: "Momento e orçamento",
      linhas: [
        { rotulo: "Momento total c/ acessos (m³·km)", get: (c) => c.momento.total },
        { rotulo: "Escavação", get: (c) => c.orcamento.escavacao.subtotal, formato: fmtMoney },
        { rotulo: "Transporte", get: (c) => c.orcamento.transporte.custo, formato: fmtMoney },
        { rotulo: "Compactação", get: (c) => c.orcamento.compactacao.subtotal, formato: fmtMoney },
        { rotulo: "Royalty", get: (c) => c.orcamento.royalty.subtotal, formato: fmtMoney },
        { rotulo: "Conformação BF", get: (c) => c.orcamento.conformacaoBF.subtotal, formato: fmtMoney },
        { rotulo: "TOTAL", get: (c) => c.orcamento.total, formato: fmtMoney },
        { rotulo: "Custo por km", get: (c) => (extKm > 0 ? c.orcamento.total / extKm : null), formato: fmtMoney },
        { rotulo: "Custo por m³ de aterro", get: (c) => (c.volumes.aterroFc > 0 ? c.orcamento.total / c.volumes.aterroFc : null), formato: (v) => fmtBRL(v, 2) },
      ],
    },
  ];

  if (!cenarios.length) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
        Nenhum cenário criado ainda — crie cenários na aba "Cenários e
        premissas" para compará-los ao caso base.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-muted-foreground">Comparar:</span>
        {cenarios.map((c) => (
          <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selecionados.has(c.id)}
              onChange={(e) =>
                setSelecionados((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  return next;
                })
              }
              className="accent-manta"
            />
            {c.nome}
          </label>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 min-w-[220px]">Métrica</th>
                {colunas.map((col) => (
                  <th key={col.id ?? "base"} className="px-3 py-2 text-right min-w-[150px]">
                    {col.nome}
                    {col.id === null && (
                      <span className="block text-[10px] font-normal">referência</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <GrupoLinhas key={g.titulo} grupo={g} colunas={colunas} base={casoBase} />
              ))}
              {/* Economia (vetores Motiva) */}
              <tr className="border-t border-border bg-surface-hover/40">
                <td className="px-3 py-1.5 font-medium" colSpan={1 + colunas.length}>
                  Economia vs caso base
                </td>
              </tr>
              {(
                [
                  ["Economia total", (e: Economia) => e.total, fmtMoney],
                  ["Economia (%)", (e: Economia) => e.percent, (v: number) => fmtPct(v)],
                  ["Vetor CFT", (e: Economia) => e.cft.total, fmtMoney],
                  ["Vetor royalty evitado", (e: Economia) => e.royalty.total, fmtMoney],
                  ["Vetor transporte", (e: Economia) => e.transporte, fmtMoney],
                ] as [string, (e: Economia) => number, Formato][]
              ).map(([rotulo, get, formato]) => (
                <tr key={rotulo} className="border-t border-border/60">
                  <td className="px-3 py-1.5 pl-6 text-muted-foreground">{rotulo}</td>
                  {colunas.map((col) => (
                    <td key={col.id ?? "base"} className="px-3 py-1.5 text-right tabular-nums">
                      {col.eco == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={get(col.eco) > 0 ? "text-emerald-400" : get(col.eco) < 0 ? "text-rose-400" : ""}>
                          {formato(get(col.eco))}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Deltas em verde = melhora vs caso base (menor custo/momento; mais
        material aproveitado na faixa). O caso base usa o Brückner embutido no
        pacote e as premissas default.
      </p>
    </div>
  );
}

function GrupoLinhas({
  grupo,
  colunas,
  base,
}: {
  grupo: GrupoDef;
  colunas: { id: string | null; nome: string; comp: CenarioComputado }[];
  base: CenarioComputado;
}) {
  return (
    <>
      <tr className="border-t border-border bg-surface-hover/40">
        <td className="px-3 py-1.5 font-medium" colSpan={1 + colunas.length}>
          {grupo.titulo}
        </td>
      </tr>
      {grupo.linhas.map((l) => (
        <tr key={l.rotulo} className="border-t border-border/60">
          <td className="px-3 py-1.5 pl-6 text-muted-foreground">{l.rotulo}</td>
          {colunas.map((col) => (
            <td key={col.id ?? "base"} className="px-3 py-1.5 text-right tabular-nums">
              {celula(l, col.comp, base, col.id === null)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

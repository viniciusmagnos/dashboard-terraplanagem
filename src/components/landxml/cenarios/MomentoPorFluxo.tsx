/**
 * Momento de transporte por fluxo do cenário ativo: volume × DMT = momento
 * → custo (momento × R$/m³·km). O fluxo corte→aterro é marcado como
 * "Brückner real" quando vem da curva (não é premissa).
 */
import { fmt, fmtBRL } from "../../../lib/format";
import { useEstudo } from "./EstudoContext";

interface Fluxo {
  rotulo: string;
  volume: number;
  dmtKm: number | null;
  momento: number;
  nota?: string;
}

export function MomentoPorFluxo() {
  const { ativo, entradas } = useEstudo();
  const m = ativo.momento;
  const vc = ativo.volumesCalc;
  const vb = ativo.volumes;
  const pr = ativo.def.premissas;
  const br = ativo.bruckner;

  const volumeMovidoBruckner = br
    ? br.totals.volume_compensado +
      br.totals.sobra_bota_fora +
      br.totals.falta_emprestimo
    : null;

  const fluxos: Fluxo[] = [
    {
      rotulo: "Corte → aterro (dentro do eixo)",
      volume:
        m.corteAterroFonte === "bruckner"
          ? (volumeMovidoBruckner ?? vb.aterroFc)
          : vb.aterroFc,
      dmtKm:
        m.corteAterroFonte === "bruckner"
          ? br?.totals.dmt_medio_m != null
            ? br.totals.dmt_medio_m / 1000
            : null
          : pr.dmtCorteAterro,
      momento: m.corteAterro,
      nota:
        m.corteAterroFonte === "bruckner"
          ? "Brückner real — compensação + arraste dos residuais"
          : "premissa (pacote sem Brückner)",
    },
    {
      rotulo: "Jazida na faixa → aterro (acesso)",
      volume: vc.jazidaNaFaixa,
      dmtKm: pr.dmtJazidaNaFaixa,
      momento: m.jazidaNaFaixa,
      nota: "alargamento de corte, sem royalty",
    },
    {
      rotulo: "Jazida fora da faixa → aterro (acesso)",
      volume: vc.jazidaForaFaixa,
      dmtKm: pr.dmtJazidaForaFaixa,
      momento: m.jazidaForaFaixa,
    },
    {
      rotulo: "Corte → BF na faixa (acesso)",
      volume: vc.bfNaFaixa,
      dmtKm: pr.dmtBFNaFaixa,
      momento: m.bfNaFaixa,
      nota: "alargamento de aterro, sem royalty",
    },
    {
      rotulo: "Corte → BF fora da faixa (acesso)",
      volume: vc.bfForaFaixa,
      dmtKm: pr.dmtBFForaFaixa,
      momento: m.bfForaFaixa,
    },
    {
      rotulo: "Rocha → BF 3ª categoria (acesso)",
      volume: vc.bf3Cat,
      dmtKm: pr.dmtBFForaFaixa,
      momento: m.bf3Cat,
    },
    {
      rotulo: "CFT (interno)",
      volume: vc.cftVolume,
      dmtKm: pr.dmtCFT,
      momento: m.cft,
    },
    {
      rotulo: "Solo mole → depósito",
      volume: vb.soloMole,
      dmtKm: pr.dmtSoloMole,
      momento: m.soloMole,
    },
  ].filter((f) => f.momento > 0 || f.volume > 0);

  const t = entradas.custos.transporte;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
        Momento de transporte por fluxo
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Fluxo</th>
              <th className="px-3 py-2 text-right">Volume (m³)</th>
              <th className="px-3 py-2 text-right">DMT (km)</th>
              <th className="px-3 py-2 text-right">Momento (m³·km)</th>
              <th className="px-3 py-2 text-right">Custo (× R$ {t.toFixed(2)})</th>
            </tr>
          </thead>
          <tbody>
            {fluxos.map((f) => (
              <tr key={f.rotulo} className="border-t border-border">
                <td className="px-3 py-2">
                  {f.rotulo}
                  {f.nota && (
                    <span className="block text-[10px] text-muted-foreground">
                      {f.nota}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(f.volume)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f.dmtKm == null ? "—" : fmt(f.dmtKm, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(f.momento)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtBRL(f.momento * t)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">{fmt(m.total)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {fmtBRL(m.total * t)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

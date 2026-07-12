/**
 * Quadro Origem × Destino de volumes do cenário ativo (port data-driven do
 * Motiva): de onde o material sai e para onde vai, com o saldo físico
 * (corte + empréstimo = aterro×fh + bota-fora) como selo de sanidade.
 */
import { fmt } from "../../../lib/format";
import { useEstudo } from "./EstudoContext";

const COR_CORTE = "text-orange-400";
const COR_ATERRO = "text-emerald-400";

function Linha({
  rotulo,
  valor,
  cor,
  nota,
}: {
  rotulo: string;
  valor: number;
  cor?: string;
  nota?: string;
}) {
  if (valor <= 0) return null;
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-1.5">
        {rotulo}
        {nota && (
          <span className="block text-[10px] text-muted-foreground">{nota}</span>
        )}
      </td>
      <td className={`px-3 py-1.5 text-right tabular-nums ${cor ?? ""}`}>
        {fmt(valor)}
      </td>
    </tr>
  );
}

export function QuadroOrigemDestino() {
  const { ativo } = useEstudo();
  const vb = ativo.volumes;
  const vc = ativo.volumesCalc;
  const fh = ativo.def.bruckner.fillFactor;

  const totalOrigens = vb.corteTotal + vc.jazidaTotal + vc.cftVolume + vb.soloMole;
  const totalDestinos = vb.aterroFc * fh + vc.bfTotal + vc.cftVolume + vb.soloMole;
  const saldo = totalOrigens - totalDestinos;
  const saldoOk = Math.abs(saldo) <= Math.max(1, totalOrigens) * 0.02;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Quadro origem × destino (m³)</p>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded border ${
            saldoOk
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
          }`}
          title="corte + empréstimo + CFT + solo mole vs aterro×fh + bota-fora + CFT + solo mole"
        >
          saldo {saldo >= 0 ? "+" : ""}
          {fmt(saldo)} m³
        </span>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="border-b md:border-b-0 md:border-r border-border">
          <p className={`px-3 pt-2.5 pb-1 text-xs font-medium ${COR_CORTE}`}>
            ORIGENS (de onde o material sai)
          </p>
          <table className="w-full text-sm">
            <tbody>
              <Linha rotulo="Corte 1ª/2ª categoria" valor={vb.corte12Cat} cor={COR_CORTE} />
              <Linha rotulo="Corte 3ª categoria (rocha)" valor={vb.corte3Cat} cor={COR_CORTE} />
              <Linha
                rotulo="Jazida na faixa (alargamento de corte)"
                valor={vc.jazidaNaFaixa}
                cor={COR_CORTE}
                nota="sem royalty · CBR ≥ 5%"
              />
              <Linha
                rotulo="Jazida fora da faixa"
                valor={vc.jazidaForaFaixa}
                cor={COR_CORTE}
                nota="com royalty"
              />
              <Linha rotulo="Escavação CFT" valor={vc.cftVolume} cor={COR_CORTE} />
              <Linha rotulo="Remoção de solo mole" valor={vb.soloMole} cor={COR_CORTE} />
            </tbody>
          </table>
        </div>
        <div>
          <p className={`px-3 pt-2.5 pb-1 text-xs font-medium ${COR_ATERRO}`}>
            DESTINOS (para onde o material vai)
          </p>
          <table className="w-full text-sm">
            <tbody>
              <Linha
                rotulo={`Aterro compactado (×${fh.toFixed(2)} solto)`}
                valor={vb.aterroFc}
                cor={COR_ATERRO}
                nota="m³c"
              />
              <Linha
                rotulo="BF na faixa (alargamento de aterro)"
                valor={vc.bfNaFaixa}
                cor={COR_ATERRO}
                nota="sem royalty"
              />
              <Linha
                rotulo="BF fora da faixa"
                valor={vc.bfForaFaixa}
                cor={COR_ATERRO}
                nota="com royalty"
              />
              <Linha
                rotulo="BF 3ª categoria (rocha)"
                valor={vc.bf3Cat}
                cor={COR_ATERRO}
                nota="sempre fora da faixa"
              />
              <Linha rotulo="Camada final (CFT)" valor={vc.cftVolume} cor={COR_ATERRO} />
              <Linha
                rotulo="Solo mole compactado"
                valor={vb.soloMoleCompactado}
                cor={COR_ATERRO}
                nota="m³c"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

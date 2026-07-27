import { Pickaxe } from "lucide-react";
import { fmt, fmtBRL, fmtKm } from "../../lib/format";
import { KpiCard } from "../landxml/KpiCard";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { jazidasDe } from "../../lib/pacote-ext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Jazidas (empréstimo): volumes calculados + cadastro opcional (recursos.jazidas). */
export function JazidasTab({ accent }: { accent: string }) {
  const { pacote, ativo } = useEstudo();
  const vc = ativo.volumesCalc;
  const jazidas = jazidasDe(pacote);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Pickaxe}
        titulo="Jazidas (empréstimo)"
        subtitulo={`Cenário: ${ativo.def.nome}`}
        right={<ChipFonte prov="computed" bloco="volumes_base.jazidaTotal" />}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard rotulo="Empréstimo total" valor={ativo.volumes.jazidaTotal} sufixo="m³" />
        <KpiCard rotulo="Na faixa de domínio" valor={vc.jazidaNaFaixa} sufixo="m³" />
        <KpiCard rotulo="Fora da faixa" valor={vc.jazidaForaFaixa} sufixo="m³" />
      </div>

      {jazidas.length > 0 ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium flex items-center gap-2">
            Cadastro de jazidas ({jazidas.length}) <ChipFonte pacote={pacote} bloco="recursos" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Jazida</th>
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2 text-right">CBR (%)</th>
                  <th className="px-4 py-2 text-right">Volume disp. (m³)</th>
                  <th className="px-4 py-2 text-right">DMT</th>
                  <th className="px-4 py-2 text-right">Royalty (R$/m³)</th>
                </tr>
              </thead>
              <tbody>
                {jazidas.map((j) => (
                  <tr key={j.id} className="border-t border-border hover:bg-surface-hover">
                    <td className="px-4 py-2">{j.nome}</td>
                    <td className="px-4 py-2">{j.material ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{j.cbr_pct != null ? fmt(j.cbr_pct, 1) : "—"}</td>
                    <td className="px-4 py-2 text-right">{fmt(j.volume_disp_m3 ?? null)}</td>
                    <td className="px-4 py-2 text-right">{j.dmt_km != null ? fmtKm(j.dmt_km) : "—"}</td>
                    <td className="px-4 py-2 text-right">{j.royalty_rs_m3 != null ? fmtBRL(j.royalty_rs_m3, 2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sem cadastro de jazidas no pacote (bloco <code>recursos.jazidas</code>). Os valores acima
          são calculados a partir do balanço do cenário. Inclua <code>recursos.jazidas</code> para
          detalhar localização, CBR, volume disponível e royalty.
        </p>
      )}
    </div>
  );
}

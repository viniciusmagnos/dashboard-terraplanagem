import { Trash2 } from "lucide-react";
import { fmt, fmtKm } from "../../lib/format";
import { KpiCard } from "../landxml/KpiCard";
import { ChipFonte } from "../ui/ChipFonte";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { botaForasDe } from "../../lib/pacote-ext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Bota-foras (sobra): volumes calculados + cadastro opcional (recursos.botaForas). */
export function BotaForasTab({ accent }: { accent: string }) {
  const { pacote, ativo } = useEstudo();
  const vc = ativo.volumesCalc;
  const bfs = botaForasDe(pacote);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Trash2}
        titulo="Bota-foras (sobra)"
        subtitulo={`Cenário: ${ativo.def.nome}`}
        right={<ChipFonte prov="computed" bloco="volumes_base.bfTotal" />}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard rotulo="Bota-fora total" valor={ativo.volumes.bfTotal} sufixo="m³" />
        <KpiCard rotulo="Na faixa de domínio" valor={vc.bfNaFaixa} sufixo="m³" />
        <KpiCard rotulo="Fora da faixa" valor={vc.bfForaFaixa} sufixo="m³" />
        <KpiCard rotulo="3ª categoria" valor={vc.bf3Cat} sufixo="m³" />
      </div>

      {bfs.length > 0 ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-sm font-medium flex items-center gap-2">
            Cadastro de bota-foras ({bfs.length}) <ChipFonte pacote={pacote} bloco="recursos" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Bota-fora</th>
                  <th className="px-4 py-2 text-right">Capacidade (m³)</th>
                  <th className="px-4 py-2 text-right">DMT</th>
                </tr>
              </thead>
              <tbody>
                {bfs.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-surface-hover">
                    <td className="px-4 py-2">{b.nome}</td>
                    <td className="px-4 py-2 text-right">{fmt(b.capacidade_m3 ?? null)}</td>
                    <td className="px-4 py-2 text-right">{b.dmt_km != null ? fmtKm(b.dmt_km) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sem cadastro de bota-foras no pacote (bloco <code>recursos.botaForas</code>). Os valores
          acima são calculados a partir do balanço do cenário. Inclua <code>recursos.botaForas</code>{" "}
          para detalhar localização, capacidade e DMT.
        </p>
      )}
    </div>
  );
}

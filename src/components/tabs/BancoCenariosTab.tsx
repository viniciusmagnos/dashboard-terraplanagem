import { Database } from "lucide-react";
import { fmtBRL, fmtPct } from "../../lib/format";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Banco de dados de cenários salvos do estudo (estado persistido). */
export function BancoCenariosTab({ accent }: { accent: string }) {
  const {
    cenarios,
    computados,
    economias,
    casoBase,
    cenarioAtivoId,
    setCenarioAtivoId,
  } = useEstudo();

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Database}
        titulo="Banco de dados de cenários"
        subtitulo={`${cenarios.length} cenário(s) salvo(s) + caso base`}
        right={<ProvChip prov="computed" />}
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Cenário</th>
                <th className="px-4 py-2">Criado em</th>
                <th className="px-4 py-2 text-right">Orçamento total</th>
                <th className="px-4 py-2 text-right">Economia</th>
                <th className="px-4 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              <tr
                className={`border-t border-border ${cenarioAtivoId === null ? "bg-surface-hover/50" : "hover:bg-surface-hover"}`}
              >
                <td className="px-4 py-2 font-medium">Caso base</td>
                <td className="px-4 py-2 text-muted-foreground">—</td>
                <td className="px-4 py-2 text-right">{fmtBRL(casoBase.orcamento.total)}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">referência</td>
                <td className="px-4 py-2 text-right">
                  {cenarioAtivoId === null ? (
                    <span className="text-xs" style={{ color: accent }}>
                      ativo
                    </span>
                  ) : (
                    <BotaoAtivar onClick={() => setCenarioAtivoId(null)} accent={accent} />
                  )}
                </td>
              </tr>
              {cenarios.map((c) => {
                const comp = computados.get(c.id);
                const eco = economias.get(c.id);
                const ativo = c.id === cenarioAtivoId;
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-border ${ativo ? "bg-surface-hover/50" : "hover:bg-surface-hover"}`}
                  >
                    <td className="px-4 py-2 font-medium">{c.nome}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(c.criadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 text-right">{fmtBRL(comp?.orcamento.total ?? null)}</td>
                    <td
                      className={`px-4 py-2 text-right ${eco && eco.total >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      {eco ? `${fmtBRL(eco.total)} (${fmtPct(eco.percent)})` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {ativo ? (
                        <span className="text-xs" style={{ color: accent }}>
                          ativo
                        </span>
                      ) : (
                        <BotaoAtivar onClick={() => setCenarioAtivoId(c.id)} accent={accent} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {cenarios.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Crie e salve cenários na aba <strong>Otimizações → Simulador (dados reais)</strong>.
        </p>
      ) : null}
    </div>
  );
}

function BotaoAtivar({ onClick, accent }: { onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border border-border hover:bg-surface-hover transition-colors"
      style={{ color: accent }}
    >
      Tornar ativo
    </button>
  );
}

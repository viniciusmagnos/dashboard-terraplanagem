import { GitCompare, Layers } from "lucide-react";
import { useEstudo } from "../landxml/cenarios/EstudoContext";

/**
 * Barra de troca de cenário ativo, no topo da seção "Cenários". As sub-abas de
 * cenário leem `ativo` do EstudoContext; esta barra controla qual cenário está
 * ativo (o `BarraCenarios` interno do CenariosTab é privado ao componente).
 */
export function SeletorCenarioBar({ accent }: { accent: string }) {
  const { cenarios, cenarioAtivoId, setCenarioAtivoId, economias } = useEstudo();

  const pill = (ativo: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap transition-colors ${
      ativo
        ? "font-medium"
        : "border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
    }`;

  const estiloAtivo = (ativo: boolean) =>
    ativo
      ? {
          borderColor: accent,
          color: accent,
          background: `color-mix(in srgb, ${accent} 10%, var(--color-surface))`,
        }
      : undefined;

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 flex items-center gap-2 overflow-x-auto">
      <span className="text-xs text-muted-foreground shrink-0 mr-1">Cenário ativo:</span>
      <button
        onClick={() => setCenarioAtivoId(null)}
        className={pill(cenarioAtivoId === null)}
        style={estiloAtivo(cenarioAtivoId === null)}
      >
        <Layers size={13} /> Caso base
      </button>
      {cenarios.map((c) => {
        const ativo = c.id === cenarioAtivoId;
        const eco = economias.get(c.id);
        return (
          <button
            key={c.id}
            onClick={() => setCenarioAtivoId(c.id)}
            className={pill(ativo)}
            style={estiloAtivo(ativo)}
            title={c.descricao}
          >
            <GitCompare size={13} /> {c.nome}
            {eco && Math.abs(eco.percent) >= 0.05 ? (
              <span
                className={`text-[11px] ${eco.total > 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {eco.total > 0 ? "−" : "+"}
                {Math.abs(eco.percent).toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            ) : null}
          </button>
        );
      })}
      {cenarios.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          nenhum cenário salvo — crie um na aba “Simulador (dados reais)”
        </span>
      ) : null}
    </div>
  );
}

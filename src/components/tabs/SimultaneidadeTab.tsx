import { useMemo } from "react";
import { Workflow } from "lucide-react";
import { simultaneidadeDe } from "../../lib/pacote-ext";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

const EXEMPLO = `"analise_simultaneidade": {
  "versao": 1,
  "recurso_rotulo": "escavadeiras",
  "frentes": [
    { "id": "f1", "nome": "Frente Norte", "inicio_dia": 0,
      "fim_dia": 120, "equipe": "Equipe A", "recurso_pico": 3 }
  ]
}`;

export function SimultaneidadeTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const sim = simultaneidadeDe(pacote);

  const maxDia = useMemo(
    () => Math.max(1, ...(sim?.frentes ?? []).map((f) => f.fim_dia)),
    [sim],
  );

  if (!sim) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={Workflow} titulo="Análise de simultaneidade" />
        <EmptyStateAguardando bloco="analise_simultaneidade" exemplo={EXEMPLO} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Workflow}
        titulo="Análise de simultaneidade"
        subtitulo={`${sim.frentes.length} frentes concorrentes · ${maxDia} dias`}
        right={<ProvChip pacote={pacote} bloco="analise_simultaneidade" />}
      />

      <div className="bg-surface border border-border rounded-lg p-4 space-y-2 overflow-x-auto">
        {sim.frentes.map((f) => {
          const left = (f.inicio_dia / maxDia) * 100;
          const width = Math.max(0.5, ((f.fim_dia - f.inicio_dia) / maxDia) * 100);
          const cor = f.cor ?? accent;
          return (
            <div key={f.id} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-xs truncate" title={f.nome}>
                {f.equipe ? (
                  <span className="text-[10px] text-muted-foreground block">{f.equipe}</span>
                ) : null}
                {f.nome}
              </div>
              <div className="relative flex-1 h-6 min-w-[240px] rounded bg-muted/30">
                <div
                  className="absolute top-0 h-full rounded flex items-center justify-center text-[10px] text-white/90"
                  style={{ left: `${left}%`, width: `${width}%`, background: cor }}
                  title={`dias ${f.inicio_dia}–${f.fim_dia}`}
                >
                  {f.recurso_pico != null ? `${f.recurso_pico}×` : ""}
                </div>
              </div>
              <div className="w-24 shrink-0 text-right text-[11px] text-muted-foreground">
                {f.inicio_dia}–{f.fim_dia} d
              </div>
            </div>
          );
        })}
        {sim.recurso_rotulo ? (
          <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
            Pico de recurso ({sim.recurso_rotulo}) indicado em cada frente (ex.: 3×).
          </p>
        ) : null}
      </div>
    </div>
  );
}

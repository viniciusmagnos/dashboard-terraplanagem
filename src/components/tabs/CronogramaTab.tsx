import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { cronogramaDe, type CronoTarefa } from "../../lib/pacote-ext";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

const EXEMPLO = `"cronograma": {
  "versao": 1,
  "t0": "2026-02-01",
  "tarefas": [
    { "id": "t1", "nome": "Corte SP-342", "grupo": "Frente 1",
      "inicio_dia": 0, "duracao_dias": 90, "progresso_pct": 40 },
    { "id": "t2", "nome": "Aterro SP-342", "grupo": "Frente 1",
      "inicio_dia": 60, "duracao_dias": 120, "dependencias": ["t1"] }
  ],
  "marcos": [{ "dia": 180, "nome": "Entrega Lote 1" }]
}`;

export function CronogramaTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const crono = cronogramaDe(pacote);
  const [varId, setVarId] = useState<string>("base");

  const opcoes = useMemo(() => {
    if (!crono) return [];
    return [
      { id: "base", nome: "Cronograma base", tarefas: crono.tarefas },
      ...(crono.variantes ?? []).map((v) => ({ id: v.id, nome: v.nome, tarefas: v.tarefas })),
    ];
  }, [crono]);

  const tarefas: CronoTarefa[] =
    opcoes.find((o) => o.id === varId)?.tarefas ?? crono?.tarefas ?? [];

  const maxDia = useMemo(
    () => Math.max(1, ...tarefas.map((t) => t.inicio_dia + t.duracao_dias)),
    [tarefas],
  );

  if (!crono) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={CalendarRange} titulo="Cronograma Gantt" />
        <EmptyStateAguardando bloco="cronograma" exemplo={EXEMPLO} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={CalendarRange}
        titulo="Cronograma Gantt"
        subtitulo={`${tarefas.length} tarefas · ${maxDia} dias${crono.t0 ? ` · início ${new Date(crono.t0).toLocaleDateString("pt-BR")}` : ""}`}
        right={<ProvChip pacote={pacote} bloco="cronograma" />}
      />

      {opcoes.length > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Variante:</span>
          <select
            value={varId}
            onChange={(e) => setVarId(e.target.value)}
            className="bg-surface border border-border rounded px-2 py-1 text-sm"
          >
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="bg-surface border border-border rounded-lg p-4 space-y-1.5 overflow-x-auto">
        {tarefas.map((t) => {
          const left = (t.inicio_dia / maxDia) * 100;
          const width = Math.max(0.5, (t.duracao_dias / maxDia) * 100);
          const cor = t.cor ?? accent;
          return (
            <div key={t.id} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-xs truncate" title={t.nome}>
                {t.grupo ? (
                  <span className="text-[10px] text-muted-foreground block">{t.grupo}</span>
                ) : null}
                {t.nome}
              </div>
              <div className="relative flex-1 h-5 min-w-[240px] rounded bg-muted/30">
                <div
                  className="absolute top-0 h-full rounded flex items-center"
                  style={{ left: `${left}%`, width: `${width}%`, background: `color-mix(in srgb, ${cor} 35%, var(--color-surface))` }}
                  title={`${t.duracao_dias} dias`}
                >
                  {t.progresso_pct != null ? (
                    <div
                      className="h-full rounded-l"
                      style={{ width: `${Math.min(100, t.progresso_pct)}%`, background: cor }}
                    />
                  ) : null}
                </div>
              </div>
              <div className="w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                {t.progresso_pct != null ? `${t.progresso_pct}%` : `${t.duracao_dias}d`}
              </div>
            </div>
          );
        })}

        {crono.marcos?.length ? (
          <div className="pt-3 mt-2 border-t border-border flex flex-wrap gap-2">
            {crono.marcos.map((m, i) => (
              <span
                key={i}
                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground"
              >
                ◆ dia {m.dia} — {m.nome}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

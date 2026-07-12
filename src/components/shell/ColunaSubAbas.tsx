import { Fragment } from "react";
import { Sparkles } from "lucide-react";
import type { SubTab } from "./nav";

/**
 * Coluna vertical de sub-abas (estilo Motiva), colorida pela cor de acento da
 * seção. A sub-aba ativa ganha fundo claro + borda esquerda no acento. Com
 * muitas sub-abas, agrupa por `grupo` (divisória) e rola dentro da coluna.
 */
export function ColunaSubAbas({
  subs,
  active,
  accent,
  onChange,
}: {
  subs: SubTab[];
  active: string;
  accent: string;
  onChange: (id: string) => void;
}) {
  return (
    <aside className="w-full lg:w-56 shrink-0">
      <div
        className="lg:sticky lg:top-[7.5rem] rounded-lg border border-border overflow-hidden lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto"
        style={{ background: `color-mix(in srgb, ${accent} 6%, var(--color-surface))` }}
      >
        {subs.map((s, i) => {
          const ativo = s.id === active;
          const grupoNovo = s.grupo && s.grupo !== subs[i - 1]?.grupo;
          return (
            <Fragment key={s.id}>
              {grupoNovo ? (
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.grupo}
                </div>
              ) : null}
              <button
                onClick={() => onChange(s.id)}
                className={`w-full text-left px-4 py-2.5 text-sm border-l-2 transition-colors ${
                  ativo
                    ? "bg-surface font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-surface/60"
                }`}
                style={ativo ? { borderColor: accent, color: accent } : undefined}
              >
                {s.label}
                {s.badge === "ia" && (
                  <span
                    className="ml-1.5 inline-flex items-center gap-0.5 align-middle rounded px-1 py-px text-[9px] font-medium border border-manta/40 text-manta"
                    title="Aba criada pelo assistente IA"
                  >
                    <Sparkles size={8} /> IA
                  </span>
                )}
              </button>
            </Fragment>
          );
        })}
      </div>
    </aside>
  );
}

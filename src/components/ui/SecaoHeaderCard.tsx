import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Card de header de seção (padrão Motiva), com gradiente derivado da cor de
 * acento da seção (tons de terra Manta). Abre cada sub-aba com título +
 * subtítulo e um slot à direita (chip de proveniência, ações, KPIs).
 */
export function SecaoHeaderCard({
  accent,
  titulo,
  subtitulo,
  icon: Icon,
  right,
  children,
}: {
  accent: string;
  titulo: string;
  subtitulo?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-border p-4"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 20%, var(--color-surface)) 0%, var(--color-surface) 72%)`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          {Icon ? (
            <span
              className="shrink-0 mt-0.5 grid place-items-center w-9 h-9 rounded-lg"
              style={{
                background: `color-mix(in srgb, ${accent} 18%, var(--color-surface))`,
                color: accent,
              }}
            >
              <Icon size={18} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground truncate">
              {titulo}
            </h2>
            {subtitulo ? (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>
            ) : null}
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

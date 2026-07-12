import { NAV, type TopTabId } from "./nav";

/**
 * Top-nav horizontal (6 abas), estilo Motiva. A aba ativa ganha um sublinhado
 * na cor de acento da seção (tons de terra Manta).
 */
export function MainNavigation({
  active,
  onChange,
}: {
  active: TopTabId;
  onChange: (id: TopTabId) => void;
}) {
  return (
    <nav className="sticky top-14 z-20 bg-surface/90 backdrop-blur border-b border-border">
      <div className="max-w-[1400px] mx-auto px-4 flex gap-1 overflow-x-auto">
        {NAV.map((t) => {
          const Icon = t.icon;
          const ativo = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
                ativo
                  ? "font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              style={ativo ? { borderColor: t.accent, color: t.accent } : undefined}
            >
              <Icon size={16} style={ativo ? { color: t.accent } : undefined} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

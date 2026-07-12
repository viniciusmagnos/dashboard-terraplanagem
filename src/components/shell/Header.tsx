import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth, logout } from "../../lib/auth";
import { MantaLogo } from "./Branding";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Cabeçalho do app (casca Motiva): branding Manta à esquerda, título do
 * projeto ao centro, ações + usuário à direita.
 */
export function Header({
  title,
  subtitle,
  right,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-border">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/" className="shrink-0" title="Meus projetos">
          <MantaLogo size={30} />
        </Link>

        {title && (
          <div className="min-w-0 flex-1 text-center hidden md:block">
            <h1 className="text-sm font-semibold text-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {!title && <div className="flex-1" />}

        <div className="flex items-center gap-2 shrink-0">
          {right}
          <ThemeToggle />
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-border">
            <span className="text-xs text-muted-foreground hidden sm:block max-w-[140px] truncate">
              {user?.display_name || user?.username || ""}
            </span>
            <button
              onClick={() => void logout()}
              title="Sair"
              className="p-1.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

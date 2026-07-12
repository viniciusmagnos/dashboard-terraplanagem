import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { loadTheme, setTheme, type Theme } from "../../lib/theme";

/**
 * Alternância de tema (claro / escuro / sistema). Cicla nessa ordem e mostra o
 * ícone da preferência atual. O padrão é "sistema" (segue o SO).
 */
const ORDEM: Theme[] = ["system", "light", "dark"];
const ICONE: Record<Theme, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};
const ROTULO: Record<Theme, string> = {
  system: "Tema: sistema",
  light: "Tema: claro",
  dark: "Tema: escuro",
};

export function ThemeToggle() {
  const [tema, setTema] = useState<Theme>(() => loadTheme());
  const Icon = ICONE[tema];

  const proximo = () => {
    const alvo = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length];
    setTheme(alvo);
    setTema(alvo);
  };

  return (
    <button
      onClick={proximo}
      title={`${ROTULO[tema]} — clique para alternar`}
      aria-label={ROTULO[tema]}
      className="p-1.5 rounded hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-colors"
    >
      <Icon size={15} />
    </button>
  );
}

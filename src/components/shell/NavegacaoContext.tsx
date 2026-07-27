// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Navegação entre sub-abas exposta como contexto, para que componentes
// profundos (chips de fonte, avisos de proveniência) possam mandar o usuário
// para outra aba sem que cada aba precise repassar callbacks.
import { createContext, useContext } from "react";
import { secaoDaSub } from "./nav";

export interface NavegacaoValue {
  /** Navega para uma sub-aba pelo id (resolve a seção de topo sozinho). */
  irParaSub: (subId: string) => void;
  /** Sub-aba ativa no momento. */
  subAtiva: string;
}

const NavegacaoCtx = createContext<NavegacaoValue | null>(null);

export const NavegacaoProvider = NavegacaoCtx.Provider;

/** null quando fora do provider (ex.: render de export) — o chamador degrada. */
export function useNavegacao(): NavegacaoValue | null {
  return useContext(NavegacaoCtx);
}

/** Confere se a sub-aba existe no NAV estático antes de oferecer o atalho. */
export function subExiste(subId: string): boolean {
  return secaoDaSub(subId) != null;
}

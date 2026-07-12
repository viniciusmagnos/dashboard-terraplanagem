// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Estado do LAYOUT dinâmico (Dashboard Spec) no cliente. Carrega junto do
// estudo e re-busca:
//  - em polling leve 30s + focus/visibility (GET /layout?since_rev= responde
//    {changed:false} barato quando nada mudou);
//  - sob demanda via recarregarLayout() — o AssistentePanel chama quando uma
//    tool dashboard_* termina (refresh reativo durante o turno do agente).
// Mutações do usuário (remover bloco/série/aba) usam os endpoints granulares
// — nunca reescrevem a spec inteira, então não há 409 na prática.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  obterLayout,
  removerAbaLayout,
  removerBlocoLayout,
  removerSerieLayout,
} from "../../lib/layout-api";
import {
  especVazia,
  parseDashboardSpec,
  type DashboardSpec,
} from "../../lib/dashboard-spec";
import { useEstudo } from "../landxml/cenarios/EstudoContext";

interface LayoutContextValue {
  spec: DashboardSpec;
  layoutRev: number;
  /** Re-busca imediata (usada pelo painel do assistente e pós-remoção). */
  recarregarLayout: () => Promise<void>;
  removerBloco: (blocoId: string) => Promise<void>;
  removerSerie: (grafico: string, serieId: string) => Promise<void>;
  removerAba: (abaId: string, force?: boolean) => Promise<void>;
}

const LayoutCtx = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { estudoId } = useEstudo();
  const [spec, setSpec] = useState<DashboardSpec>(especVazia);
  const [layoutRev, setLayoutRev] = useState(0);
  const revRef = useRef(0);
  const carregandoRef = useRef(false);

  const recarregarLayout = useCallback(async () => {
    if (!estudoId || carregandoRef.current) return;
    carregandoRef.current = true;
    try {
      const res = await obterLayout(estudoId, revRef.current);
      if (res.changed && res.spec !== undefined) {
        revRef.current = res.layout_rev;
        setLayoutRev(res.layout_rev);
        setSpec(parseDashboardSpec(res.spec));
      } else if (!res.changed) {
        revRef.current = res.layout_rev;
      }
    } catch {
      // offline/401 transitório — o próximo poll tenta de novo
    } finally {
      carregandoRef.current = false;
    }
  }, [estudoId]);

  // Carga inicial (since_rev=0 → servidor com layout vazio responde
  // {changed:false}; com layout existente responde a spec).
  useEffect(() => {
    revRef.current = 0;
    setSpec(especVazia());
    setLayoutRev(0);
    if (estudoId) void recarregarLayout();
  }, [estudoId, recarregarLayout]);

  // Polling leve + focus/visibility (mesmos gatilhos do EstudoContext).
  useEffect(() => {
    if (!estudoId) return;
    const aoFocar = () => void recarregarLayout();
    const aoVisibilidade = () => {
      if (document.visibilityState === "visible") void recarregarLayout();
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoVisibilidade);
    const t = window.setInterval(() => void recarregarLayout(), 30_000);
    return () => {
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoVisibilidade);
      window.clearInterval(t);
    };
  }, [estudoId, recarregarLayout]);

  const removerBloco = useCallback(
    async (blocoId: string) => {
      if (!estudoId) return;
      await removerBlocoLayout(estudoId, blocoId);
      revRef.current = 0; // força adoção da spec fresca
      await recarregarLayout();
    },
    [estudoId, recarregarLayout],
  );

  const removerSerie = useCallback(
    async (grafico: string, serieId: string) => {
      if (!estudoId) return;
      await removerSerieLayout(estudoId, grafico, serieId);
      revRef.current = 0;
      await recarregarLayout();
    },
    [estudoId, recarregarLayout],
  );

  const removerAba = useCallback(
    async (abaId: string, force = false) => {
      if (!estudoId) return;
      await removerAbaLayout(estudoId, abaId, force);
      revRef.current = 0;
      await recarregarLayout();
    },
    [estudoId, recarregarLayout],
  );

  const value = useMemo(
    () => ({ spec, layoutRev, recarregarLayout, removerBloco, removerSerie, removerAba }),
    [spec, layoutRev, recarregarLayout, removerBloco, removerSerie, removerAba],
  );

  return <LayoutCtx.Provider value={value}>{children}</LayoutCtx.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutCtx);
  if (!ctx) throw new Error("useLayout precisa estar dentro de <LayoutProvider>");
  return ctx;
}

/** Variante segura para componentes que podem renderizar fora do provider
 * (ex.: abas vendoradas) — devolve null em vez de lançar. */
export function useLayoutSeguro(): LayoutContextValue | null {
  return useContext(LayoutCtx);
}

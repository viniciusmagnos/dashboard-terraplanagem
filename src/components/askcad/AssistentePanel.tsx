// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Host do assistente IA embutido (gabarito: DashboardAssistente do hub).
// O agente lê/muta o ESTUDO server-side direto (tools estudo_*); aqui só
// tratamos as propostas de UI local (trocar aba, destacar estação, selecionar
// cenário) e re-puxamos o estado:
//  - reativamente, no instante em que uma tool MUTADORA termina (onToolResult
//    do stream SSE — "tempo real" percebido durante o turno);
//  - ao fim de cada turno (onTurnComplete);
//  - polling leve enquanto o drawer está aberto (cobre mutações via MCP).
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import type { ProposalData } from "./ProposalCard";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { useLayoutSeguro } from "../dynamic/LayoutContext";
import { obterDigest, type EstudoDigest } from "../../lib/estudo-api";
import { navComDinamicas, type AbaDinamicaNav, type TopTabId } from "../shell/nav";

// react-markdown + o corpo do chat só entram no bundle quando o drawer abre
// (mesmo padrão do three.js/leaflet nas abas 3D/mapa).
const AskCadDrawer = lazy(() =>
  import("./AskCadDrawer").then((m) => ({ default: m.AskCadDrawer })),
);

/** Ids canônicos de aba que o prompt do modo landxml_dashboard usa → destino
 * (top, sub) na casca deste app. Qualquer sub-id real do NAV também é aceito. */
const ABA_CANONICA: Record<string, { top: TopTabId; sub: string }> = {
  visao: { top: "dashboard", sub: "visao" },
  bruckner: { top: "dashboard", sub: "bruckner" },
  planta: { top: "dashboard", sub: "diagrama-planta" },
  secoes: { top: "dados", sub: "secoes" },
  geotecnia: { top: "geotecnia", sub: "geotecnia" },
  cenarios: { top: "otimizacoes", sub: "sim-real" },
  orcamento: { top: "dashboard", sub: "orcamento-total" },
  comparativo: { top: "cenarios", sub: "cen-comparativo" },
};

function resolverAba(
  aba: string,
  abasDinamicas: AbaDinamicaNav[],
): { top: TopTabId; sub: string } | null {
  const canonica = ABA_CANONICA[aba];
  if (canonica) return canonica;
  // Sub-id real da casca (ex.: "matriz-dmt", "cen-jazidas") ou aba dinâmica
  // criada pelo próprio agente ("ia-…").
  for (const t of navComDinamicas(abasDinamicas)) {
    if (t.subs.some((s) => s.id === aba)) return { top: t.id, sub: aba };
  }
  return null;
}

/** Tools que mutam o estudo/layout server-side — disparam refresh reativo. */
const MUTATING_TOOL_RE =
  /^(dashboard_|estudo_(atualizar|criar|remover|renomear|duplicar|set_|restaurar|importar))/;

export function AssistentePanel({
  onNavigate,
  onIrParaSecao,
}: {
  onNavigate: (top: TopTabId, sub: string) => void;
  onIrParaSecao: (sta: number, eixoId?: string | null) => void;
}) {
  const { estudoId, syncStatus, recarregarDoServidor, setCenarioAtivoId } = useEstudo();
  const layout = useLayoutSeguro();
  const [open, setOpen] = useState(false);
  const [digest, setDigest] = useState<EstudoDigest | null>(null);

  useEffect(() => {
    if (!open || !estudoId || digest) return;
    obterDigest(estudoId)
      .then(setDigest)
      .catch(() => setDigest({ estudo_id: estudoId, nome: "", rev: 0 }));
  }, [open, estudoId, digest]);

  // Polling leve com o drawer aberto — cobre mutações vindas de fora do chat
  // (MCP/outro usuário). obterEstado(since_rev) responde {changed:false} barato.
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => void recarregarDoServidor(), 20_000);
    return () => window.clearInterval(t);
  }, [open, recarregarDoServidor]);

  // Refresh reativo com throttle (~500ms leading + trailing) para rajadas de
  // tools mutadoras no mesmo turno.
  const lastRefreshRef = useRef(0);
  const trailingRef = useRef<number | null>(null);
  const refreshThrottled = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastRefreshRef.current;
    if (elapsed >= 500) {
      lastRefreshRef.current = now;
      void recarregarDoServidor();
      return;
    }
    if (trailingRef.current == null) {
      trailingRef.current = window.setTimeout(() => {
        trailingRef.current = null;
        lastRefreshRef.current = Date.now();
        void recarregarDoServidor();
      }, 500 - elapsed);
    }
  }, [recarregarDoServidor]);

  useEffect(
    () => () => {
      if (trailingRef.current != null) window.clearTimeout(trailingRef.current);
    },
    [],
  );

  const handleToolResult = useCallback(
    (name: string, _result: unknown, isError: boolean) => {
      if (isError) return;
      if (!MUTATING_TOOL_RE.test(name)) return;
      refreshThrottled();
      // Tools de layout mudam a Dashboard Spec — re-busca imediata para a
      // aba/card aparecer enquanto o agente ainda fala.
      if (name.startsWith("dashboard_")) void layout?.recarregarLayout();
    },
    [refreshThrottled, layout],
  );

  const aplicarProposta = useCallback(
    async (p: ProposalData) => {
      switch (p.actionType) {
        case "landxml_dashboard.trocar_aba": {
          const alvo = String(p.payload.aba ?? "");
          const destino = resolverAba(alvo, layout?.spec.abas ?? []);
          if (!destino) throw new Error(`Aba desconhecida: ${alvo}`);
          onNavigate(destino.top, destino.sub);
          return;
        }
        case "landxml_dashboard.destacar_estacao": {
          const sta = Number(p.payload.sta_m);
          if (!Number.isFinite(sta)) throw new Error("payload.sta_m inválido");
          const eixoId = typeof p.payload.eixo_id === "string" ? p.payload.eixo_id : null;
          onIrParaSecao(sta, eixoId);
          return;
        }
        case "landxml_dashboard.selecionar_cenario": {
          const cid = p.payload.cenario_id;
          setCenarioAtivoId(cid == null || cid === "caso-base" ? null : String(cid));
          return;
        }
        default:
          throw new Error(`Ação não suportada no dashboard: ${p.actionType}`);
      }
    },
    [onNavigate, onIrParaSecao, setCenarioAtivoId, layout],
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!estudoId}
        title={
          estudoId
            ? "Converse com a IA sobre este estudo"
            : syncStatus === "offline"
              ? "Estudo não sincronizado (verifique login/servidor)"
              : "Sincronizando estudo…"
        }
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-manta/50 text-manta rounded-md hover:bg-manta/10 disabled:opacity-40 transition-colors"
      >
        <Sparkles size={14} /> Assistente
      </button>
      {/* Montado a partir da 1ª abertura (digest só é buscado ao abrir) e
          mantido montado ao fechar — preserva a conversa e a sessão. */}
      {estudoId && digest && (
        <Suspense fallback={null}>
          <AskCadDrawer
            service="landxml_dashboard"
            peerSessionId={estudoId}
            peerFilename={`estudo-${estudoId}.mtp.json`}
            peerSummary={digest}
            personaSlug="askterra"
            onApplyProposal={aplicarProposta}
            onTurnComplete={() => {
              void recarregarDoServidor();
              void layout?.recarregarLayout();
            }}
            onToolResult={handleToolResult}
            open={open}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}

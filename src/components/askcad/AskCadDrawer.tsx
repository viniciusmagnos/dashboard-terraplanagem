// APP-LOCAL — não adicionar ao sync-from-hub (port adaptado do manta-hub).
//
// Diferenças vs. hub: sem Knowledge/Skills pickers e sem skill drafts (gestão
// que vive no hub), sem seleção de entidades DXF; nova prop `onToolResult`
// para o host reagir DURANTE o turno (refresh reativo quando uma tool
// mutadora termina); tema nos tokens Manta.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Sparkles, X } from "lucide-react";
import {
  createAskCadFromPeer,
  streamChat,
  submitFormResponse,
  type AgentEvent,
  type FormFieldSchema,
  type FromPeerResponse,
  type PeerService,
} from "../../lib/askcad-api";
import { ChatMessage, type ChatTurnData, type ToolCall } from "./ChatMessage";
import type { ProposalData } from "./ProposalCard";
import type { FormRequestData } from "./InputFormCard";
import { ModelPicker } from "./ModelPicker";
import { readStoredModel, writeStoredModel, type AskCadModel } from "../../lib/askcad-models";

interface AskCadDrawerProps {
  service: PeerService;
  peerSessionId: string;
  peerFilename?: string;
  peerCandidates?: Record<string, unknown>;
  peerSummary?: Record<string, unknown>;
  /** Persona aplicada na criação da sessão (ex.: "askterra"). */
  personaSlug?: string;
  onApplyProposal: (proposal: ProposalData) => Promise<void>;
  /** Called after each agent turn finishes (stream ended) — hosts whose data
   * the agent can mutate server-side use this to re-pull their state. */
  onTurnComplete?: () => void;
  /** Called as soon as each tool finishes DURING the turn. Hosts use it to
   * refresh reactively quando uma tool mutadora (estudo_* e dashboard_*)
   * termina, sem esperar o fim do turno. */
  onToolResult?: (name: string, result: unknown, isError: boolean) => void;
  open: boolean;
  onClose: () => void;
}

export function AskCadDrawer({
  service,
  peerSessionId,
  peerFilename,
  peerCandidates,
  peerSummary,
  personaSlug,
  onApplyProposal,
  onTurnComplete,
  onToolResult,
  open,
  onClose,
}: AskCadDrawerProps) {
  const [askcadSessionId, setAskcadSessionId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurnData[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [model, setModel] = useState<AskCadModel>(() => readStoredModel());
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Correlaciona tool_use_id → nome da tool: o evento `tool_result` do SSE não
  // carrega `name`, só o id — o `tool_call` anterior carrega.
  const toolNamesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    writeStoredModel(model);
  }, [model]);

  useEffect(() => {
    if (!open || askcadSessionId) return;
    let cancelled = false;
    createAskCadFromPeer({
      service,
      peer_session_id: peerSessionId,
      peer_filename: peerFilename,
      peer_candidates: peerCandidates,
      peer_summary: peerSummary,
      persona_slug: personaSlug,
    })
      .then((res: FromPeerResponse) => {
        if (!cancelled) {
          setAskcadSessionId(res.session_id);
          setSessionTitle(res.title ?? null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setInitError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, askcadSessionId, service, peerSessionId, peerFilename, peerCandidates, peerSummary, personaSlug]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const consumeStream = useCallback(
    async (events: AsyncGenerator<AgentEvent, void, unknown>) => {
      for await (const event of events) {
        if (event.kind === "tool_call") {
          const id = String(event.data.tool_use_id ?? "");
          const name = String(event.data.name ?? "?");
          if (id) toolNamesRef.current.set(id, name);
        }
        applyEventToTurn(setTurns, event);
        if (event.kind === "tool_result") {
          const id = String(event.data.tool_use_id ?? "");
          const name = toolNamesRef.current.get(id) ?? "?";
          onToolResult?.(name, event.data.result, Boolean(event.data.is_error));
        }
      }
    },
    [onToolResult],
  );

  const sendMessage = useCallback(
    async (question: string) => {
      if (!askcadSessionId || !question.trim() || busy) return;
      setStreamError(null);

      const userTurn: ChatTurnData = { role: "user", text: question };
      const assistantTurn: ChatTurnData = {
        role: "assistant",
        text: "",
        thinking: "",
        tools: [],
        proposals: [],
        stopReason: null,
      };
      setTurns((prev) => [...prev, userTurn, assistantTurn]);
      setBusy(true);

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        await consumeStream(streamChat(askcadSessionId, question, model, abort.signal));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStreamError((err as Error).message);
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
        onTurnComplete?.();
      }
    },
    [askcadSessionId, busy, model, consumeStream, onTurnComplete],
  );

  const send = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    void sendMessage(q);
  }, [input, sendMessage]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleApply = useCallback(
    async (p: ProposalData) => {
      try {
        await onApplyProposal(p);
        setTurns((prev) =>
          prev.map((t) => ({
            ...t,
            proposals: t.proposals?.map((pp) =>
              pp.id === p.id ? { ...pp, status: "applied" as const } : pp,
            ),
          })),
        );
      } catch (err) {
        setStreamError(`Falha ao aplicar: ${(err as Error).message}`);
      }
    },
    [onApplyProposal],
  );

  const handleEdit = useCallback(
    async (p: ProposalData, editedPayload: Record<string, unknown>) => {
      const edited: ProposalData = { ...p, payload: editedPayload };
      await handleApply(edited);
    },
    [handleApply],
  );

  const handleInstruct = useCallback(
    async (p: ProposalData, instruction: string) => {
      setTurns((prev) =>
        prev.map((t) => ({
          ...t,
          proposals: t.proposals?.map((pp) =>
            pp.id === p.id
              ? { ...pp, status: "revising" as const, statusDetail: `Ajuste pedido: "${instruction}"` }
              : pp,
          ),
        })),
      );
      const followUp = `Ajuste na proposta anterior: ${instruction}`;
      await sendMessage(followUp);
    },
    [sendMessage],
  );

  const markFormStatus = useCallback(
    (formId: string, status: "submitted" | "cancelled", values?: Record<string, unknown>) => {
      setTurns((prev) =>
        prev.map((turn) => {
          if (!turn.forms || turn.forms.length === 0) return turn;
          let touched = false;
          const forms = turn.forms.map((f) => {
            if (f.id !== formId) return f;
            touched = true;
            return { ...f, status, values: values ?? f.values };
          });
          return touched ? { ...turn, forms } : turn;
        }),
      );
    },
    [],
  );

  const runFormResponse = useCallback(
    async (formId: string, values: Record<string, unknown>, cancelled: boolean) => {
      if (!askcadSessionId || busy) return;
      markFormStatus(formId, cancelled ? "cancelled" : "submitted", cancelled ? undefined : values);
      const assistantTurn: ChatTurnData = {
        role: "assistant",
        text: "",
        thinking: "",
        tools: [],
        proposals: [],
        stopReason: null,
      };
      setTurns((prev) => [...prev, assistantTurn]);
      setBusy(true);
      const abort = new AbortController();
      abortRef.current = abort;
      try {
        await consumeStream(
          submitFormResponse(askcadSessionId, formId, values, cancelled, abort.signal),
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setStreamError((err as Error).message);
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
        onTurnComplete?.();
      }
    },
    [askcadSessionId, busy, markFormStatus, consumeStream, onTurnComplete],
  );

  const handleFormSubmit = useCallback(
    (formId: string, values: Record<string, unknown>) => runFormResponse(formId, values, false),
    [runFormResponse],
  );

  const handleFormCancel = useCallback(
    (formId: string) => runFormResponse(formId, {}, true),
    [runFormResponse],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[440px] bg-surface border-l border-border shadow-xl flex flex-col">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Sparkles className="text-manta" size={16} />
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold text-foreground truncate"
            title={sessionTitle || undefined}
          >
            {sessionTitle || "Assistente do estudo"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            conectado ao estudo
            {peerFilename && (
              <>
                {" · "}
                <span title={peerFilename}>{peerFilename}</span>
              </>
            )}
          </div>
        </div>
        <ModelPicker value={model} onChange={setModel} disabled={busy} compact />
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-foreground hover:bg-surface-hover"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>
      </div>

      {initError && (
        <div className="m-3 p-2 text-xs rounded bg-danger/10 border border-danger/40 text-danger">
          Erro ao iniciar: {initError}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-border-subtle">
        {turns.length === 0 && !initError && (
          <div className="p-4 text-xs text-muted-foreground">
            {askcadSessionId ? (
              <>
                Pronto. Pergunte sobre o estudo ou peça mudanças — o dashboard
                reflete na hora.
                <div className="mt-2 text-muted-foreground/70">Exemplos:</div>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>Qual o orçamento do cenário ativo?</li>
                  <li>Crie um cenário com fill factor 1,4</li>
                  <li>Compare os cenários e resuma as economias</li>
                </ul>
              </>
            ) : (
              "Carregando…"
            )}
          </div>
        )}
        {turns.map((t, i) => (
          <ChatMessage
            key={i}
            turn={t}
            onApplyProposal={handleApply}
            onEditProposal={handleEdit}
            onInstructProposal={handleInstruct}
            onSubmitForm={handleFormSubmit}
            onCancelForm={handleFormCancel}
          />
        ))}
        {streamError && (
          <div className="m-3 p-2 text-xs rounded bg-danger/10 border border-danger/40 text-danger">
            {streamError}
          </div>
        )}
      </div>

      <form
        className="border-t border-border p-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="flex-1 resize-none rounded border border-border bg-background text-foreground px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-manta"
          rows={2}
          placeholder={askcadSessionId ? "Pergunte…" : "Aguarde…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy || !askcadSessionId}
        />
        {busy ? (
          <button
            type="button"
            onClick={stop}
            className="px-3 py-1 rounded bg-danger text-white text-xs hover:opacity-90"
          >
            Parar
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || !askcadSessionId}
            className="px-3 py-1 rounded bg-manta text-white text-xs hover:bg-manta-hover disabled:opacity-50"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </form>
    </div>
  );
}

function applyEventToTurn(
  setTurns: React.Dispatch<React.SetStateAction<ChatTurnData[]>>,
  event: AgentEvent,
) {
  setTurns((prev) => {
    if (prev.length === 0) return prev;
    const copy = [...prev];
    const last = { ...copy[copy.length - 1] };
    if (last.role !== "assistant") return prev;

    const data = event.data;
    switch (event.kind) {
      case "thinking":
        last.thinking = (last.thinking ?? "") + ((data.text as string) || "");
        break;
      case "text":
        last.text = (last.text ?? "") + ((data.text as string) || "");
        break;
      case "tool_call": {
        const newCall: ToolCall = {
          id: String(data.tool_use_id ?? Math.random()),
          name: String(data.name ?? "?"),
          input: (data.input as Record<string, unknown>) ?? {},
          running: true,
        };
        last.tools = [...(last.tools ?? []), newCall];
        break;
      }
      case "tool_result": {
        const id = String(data.tool_use_id ?? "");
        last.tools = (last.tools ?? []).map((t) =>
          t.id === id
            ? { ...t, result: data.result, isError: Boolean(data.is_error), running: false }
            : t,
        );
        break;
      }
      case "proposal": {
        const p: ProposalData = {
          id: String(data.proposal_id ?? Math.random()),
          actionType: String(data.action_type ?? "?"),
          payload: (data.payload as Record<string, unknown>) ?? {},
          confidence: (data.confidence as number | null | undefined) ?? null,
          justification: String(data.justification ?? ""),
          status: "pending",
          focusHandles: Array.isArray(data.focus_handles)
            ? (data.focus_handles as string[])
            : [],
        };
        last.proposals = [...(last.proposals ?? []), p];
        break;
      }
      case "form_request": {
        const form: FormRequestData = {
          id: String(data.form_id ?? Math.random()),
          formTitle: String(data.form_title ?? ""),
          contextMessage: String(data.context_message ?? ""),
          fields: Array.isArray(data.fields) ? (data.fields as FormFieldSchema[]) : [],
          submitLabel: String(data.submit_label ?? "Enviar"),
          cancelLabel: String(data.cancel_label ?? "Cancelar"),
          status: "pending",
        };
        last.forms = [...(last.forms ?? []), form];
        break;
      }
      case "stop":
        last.stopReason = (data.reason as string) ?? "end_turn";
        break;
      case "error":
        last.text = (last.text ?? "") + `\n\n**Erro:** ${String(data.message ?? "")}`;
        break;
      default:
        // skill_draft / persona_draft / memory_added / start / turn_end:
        // sem UI dedicada neste app — ignorados de propósito.
        break;
    }
    copy[copy.length - 1] = last;
    return copy;
  });
}

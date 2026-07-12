// APP-LOCAL — não adicionar ao sync-from-hub (port adaptado do manta-hub).
//
// Diferenças vs. hub: sem foco de entidades DXF (não há viewer CAD aqui) e
// cores mapeadas para os tokens do tema Manta.
import { useState, type MouseEvent, type KeyboardEvent } from "react";
import { Check, Edit2, MessageSquare } from "lucide-react";

export type ProposalStatus = "pending" | "applied" | "rejected" | "revising";

export interface ProposalData {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  confidence?: number | null;
  justification: string;
  status: ProposalStatus;
  statusDetail?: string;
  /** Mantido por compatibilidade com o evento SSE; não usado neste app. */
  focusHandles?: string[];
}

interface ProposalCardProps {
  proposal: ProposalData;
  /** Optional — when omitted the Apply button is hidden. */
  onApply?: (p: ProposalData) => void | Promise<void>;
  /** Optional — when omitted the Edit button is hidden. */
  onEdit?: (p: ProposalData, editedPayload: Record<string, unknown>) => void | Promise<void>;
  /** Optional — when omitted the "Dizer ao assistente" button is hidden. */
  onInstruct?: (p: ProposalData, instruction: string) => void | Promise<void>;
}

type Mode = "collapsed" | "editing" | "instructing";

const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

export function ProposalCard({ proposal, onApply, onEdit, onInstruct }: ProposalCardProps) {
  const [mode, setMode] = useState<Mode>("collapsed");
  const [editedJson, setEditedJson] = useState<string>(
    () => JSON.stringify(proposal.payload, null, 2),
  );
  const [instruction, setInstruction] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const isPending = proposal.status === "pending";
  const borderColor =
    proposal.status === "applied"
      ? "border-success/60"
      : proposal.status === "rejected"
        ? "border-border"
        : "border-warning/60";

  const confidencePct =
    typeof proposal.confidence === "number"
      ? Math.round(proposal.confidence * 100)
      : null;

  const handleSaveEdit = async () => {
    if (!onEdit) return;
    try {
      const parsed = JSON.parse(editedJson);
      setJsonError(null);
      await onEdit(proposal, parsed);
      setMode("collapsed");
    } catch (e) {
      setJsonError((e as Error).message);
    }
  };

  const handleSendInstruction = async () => {
    if (!onInstruct) return;
    const text = instruction.trim();
    if (!text) return;
    await onInstruct(proposal, text);
    setInstruction("");
    setMode("collapsed");
  };

  return (
    <div className={`my-2 border-2 ${borderColor} rounded-lg bg-surface overflow-hidden`}>
      <div className="px-3 py-2 bg-warning/10 flex items-center gap-2">
        <span className="text-lg">💡</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            Proposta: {proposal.actionType}
          </div>
          {confidencePct !== null && (
            <div className="text-xs text-muted-foreground">
              Confiança: {confidencePct}%
            </div>
          )}
        </div>
        {proposal.status !== "pending" && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              proposal.status === "applied"
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {proposal.status === "applied"
              ? "aplicada"
              : proposal.status === "rejected"
                ? "dispensada"
                : "revisando"}
          </span>
        )}
      </div>

      <div className="px-3 py-2 text-sm text-foreground/90 border-b border-border-subtle">
        {proposal.justification}
      </div>

      <details
        className="px-3 py-2 text-xs border-b border-border-subtle"
        onClick={stop}
      >
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          ver payload
        </summary>
        <pre className="mt-2 font-mono bg-elevated p-2 rounded overflow-x-auto whitespace-pre-wrap break-all text-foreground/90">
          {JSON.stringify(proposal.payload, null, 2)}
        </pre>
      </details>

      {mode === "editing" && (
        <div className="px-3 py-2 space-y-2 border-b border-border-subtle" onClick={stop}>
          <div className="text-xs text-muted-foreground">Edite o JSON do payload:</div>
          <textarea
            className="w-full font-mono text-xs rounded border border-border bg-background text-foreground p-2 focus:outline-none focus:ring-2 focus:ring-manta"
            rows={8}
            value={editedJson}
            onChange={(e) => setEditedJson(e.target.value)}
            onClick={stop}
          />
          {jsonError && (
            <div className="text-xs text-danger">JSON inválido: {jsonError}</div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleSaveEdit();
              }}
              className="px-3 py-1 text-xs rounded bg-manta text-white hover:bg-manta-hover"
            >
              Salvar e aplicar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("collapsed");
                setJsonError(null);
              }}
              className="px-3 py-1 text-xs rounded border border-border text-foreground hover:bg-surface-hover"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mode === "instructing" && (
        <div className="px-3 py-2 space-y-2 border-b border-border-subtle" onClick={stop}>
          <div className="text-xs text-muted-foreground">
            O que quer ajustar? (o assistente vai refazer a proposta)
          </div>
          <textarea
            className="w-full text-xs rounded border border-border bg-background text-foreground p-2 focus:outline-none focus:ring-2 focus:ring-manta"
            rows={3}
            placeholder="ex: use o cenário B como base"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onClick={stop}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleSendInstruction();
              }}
              disabled={!instruction.trim()}
              className="px-3 py-1 text-xs rounded bg-manta text-white hover:bg-manta-hover disabled:opacity-50"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("collapsed");
              }}
              className="px-3 py-1 text-xs rounded border border-border text-foreground hover:bg-surface-hover"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isPending && mode === "collapsed" && (onApply || onEdit || onInstruct) && (
        <div className="px-3 py-2 flex flex-wrap gap-2">
          {onApply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onApply(proposal);
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-success text-white hover:opacity-90"
            >
              <Check size={12} /> Aplicar
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("editing");
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded border border-border text-foreground hover:bg-surface-hover"
            >
              <Edit2 size={12} /> Editar
            </button>
          )}
          {onInstruct && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("instructing");
              }}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded border border-border text-foreground hover:bg-surface-hover"
            >
              <MessageSquare size={12} /> Dizer ao assistente
            </button>
          )}
        </div>
      )}

      {proposal.statusDetail && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border-subtle">
          {proposal.statusDetail}
        </div>
      )}
    </div>
  );
}

// APP-LOCAL — não adicionar ao sync-from-hub (port adaptado do manta-hub).
//
// Diferenças vs. hub: sem links `handles:`/`pdf-page:` (não há viewer CAD/PDF
// aqui), sem skill drafts e sem chips de anexos; cores nos tokens do tema.
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download } from "lucide-react";
import { getArtifactDownloadUrl } from "../../lib/askcad-api";
import { ProposalCard, type ProposalData } from "./ProposalCard";
import { SenderAvatar } from "./SenderAvatar";
import { InputFormCard, type FormRequestData } from "./InputFormCard";

interface ArtifactInfo {
  downloadPath: string;
  filename: string;
  kind: "excel" | "json";
  rows?: number;
  sheets?: string[];
  sizeBytes?: number;
}

function extractArtifact(result: unknown): ArtifactInfo | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const path = typeof r.download_path === "string" ? r.download_path : null;
  if (!path) return null;
  const filename =
    (typeof r.filename === "string" && r.filename) || path.split("/").pop() || "download";
  const kind: ArtifactInfo["kind"] = filename.toLowerCase().endsWith(".json")
    ? "json"
    : "excel";
  return {
    downloadPath: path,
    filename,
    kind,
    rows: typeof r.rows === "number" ? r.rows : undefined,
    sheets: Array.isArray(r.sheets) ? (r.sheets as string[]) : undefined,
    sizeBytes: typeof r.size_bytes === "number" ? r.size_bytes : undefined,
  };
}

function formatSize(bytes?: number): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  running?: boolean;
}

export interface ChatTurnData {
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  tools?: ToolCall[];
  proposals?: ProposalData[];
  forms?: FormRequestData[];
  stopReason?: string | null;
  /** Quem enviou este turno (chats compartilhados). ``null``/ausente = o
   *  próprio usuário desta janela. */
  authorId?: number | null;
  authorName?: string | null;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "\n... [truncado]";
}

export function ToolCallDisplay({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const inputPreview = formatJson(call.input);
  const resultPreview =
    call.result !== undefined ? truncate(formatJson(call.result), 800) : "";
  const artifact =
    call.result !== undefined && !call.isError ? extractArtifact(call.result) : null;

  return (
    <div className="my-1 rounded-md border border-border-subtle overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-2 py-1 text-left text-xs bg-elevated hover:bg-surface-hover text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span className="select-none">{open ? "▾" : "▸"}</span>
        <span
          className={
            call.running ? "text-warning" : call.isError ? "text-danger" : "text-success"
          }
        >
          {call.running ? "●" : call.isError ? "✕" : "✓"}
        </span>
        <span className="font-mono font-semibold">{call.name}</span>
        {!open && (
          <span className="font-mono text-muted-foreground truncate">
            ({Object.keys(call.input).join(", ") || "—"})
          </span>
        )}
      </button>
      {artifact && (
        <div className="px-2 py-2 border-t border-border-subtle bg-success/10">
          <a
            href={getArtifactDownloadUrl(artifact.downloadPath)}
            download={artifact.filename}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded bg-success text-white text-xs font-medium hover:opacity-90"
            title={`Baixar ${artifact.filename}`}
          >
            <Download size={14} />
            <span>Baixar {artifact.filename}</span>
            {artifact.rows != null && (
              <span className="opacity-80">({artifact.rows} linhas)</span>
            )}
            {artifact.rows == null && artifact.sizeBytes != null && (
              <span className="opacity-80">({formatSize(artifact.sizeBytes)})</span>
            )}
          </a>
          {artifact.sheets && artifact.sheets.length > 1 && (
            <div className="mt-1 text-[10px] text-success">
              Abas: {artifact.sheets.join(", ")}
            </div>
          )}
        </div>
      )}
      {open && (
        <div className="px-2 py-2 space-y-2 text-xs bg-surface">
          <div>
            <div className="text-muted-foreground mb-1">entrada:</div>
            <pre className="font-mono bg-elevated p-2 rounded overflow-x-auto whitespace-pre-wrap break-all text-foreground/90">
              {inputPreview}
            </pre>
          </div>
          {call.result !== undefined && (
            <div>
              <div className="text-muted-foreground mb-1">
                resultado{call.isError ? " (erro)" : ""}:
              </div>
              <pre className="font-mono bg-elevated p-2 rounded overflow-x-auto whitespace-pre-wrap break-all text-foreground/90">
                {resultPreview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;
  return (
    <div className="my-1 text-xs">
      <button
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span>{open ? "▾" : "▸"}</span>
        <span className="italic">raciocínio ({text.length} chars)</span>
      </button>
      {open && (
        <pre className="mt-1 pl-3 border-l-2 border-border italic text-muted-foreground whitespace-pre-wrap break-words">
          {text}
        </pre>
      )}
    </div>
  );
}

function STOP_REASON_MESSAGES(): Record<string, string> {
  return {
    end_turn: "",
    max_turns: "Parei por atingir o limite de turnos.",
    duplicate_tool: "Parei porque fiz a mesma ação duas vezes sem ganho.",
    no_progress: "Parei porque os últimos turnos não trouxeram novidade.",
    budget_exceeded: "Parei porque o orçamento de custos foi atingido.",
    tool_error: "Parei porque houve um erro na execução.",
  };
}

export function StopReasonBanner({ reason }: { reason: string | null | undefined }) {
  if (!reason) return null;
  const messages = STOP_REASON_MESSAGES();
  const msg = messages[reason];
  if (!msg) return null;
  return (
    <div className="my-2 text-xs px-2 py-1 rounded bg-warning/10 text-warning border border-warning/30">
      {msg}
    </div>
  );
}

export function ChatMessage({
  turn,
  currentUserId,
  onApplyProposal,
  onEditProposal,
  onInstructProposal,
  onSubmitForm,
  onCancelForm,
}: {
  turn: ChatTurnData;
  /** ID do usuário logado, usado pra rotular as próprias mensagens como "Você". */
  currentUserId?: number | null;
  onApplyProposal?: (p: ProposalData) => void | Promise<void>;
  onEditProposal?: (p: ProposalData, editedPayload: Record<string, unknown>) => void | Promise<void>;
  onInstructProposal?: (p: ProposalData, instruction: string) => void | Promise<void>;
  onSubmitForm?: (formId: string, values: Record<string, unknown>) => void | Promise<void>;
  onCancelForm?: (formId: string) => void | Promise<void>;
}) {
  const isUser = turn.role === "user";
  // Turnos criados localmente não carregam authorId — são sempre do próprio
  // usuário desta janela.
  const isSelf =
    isUser &&
    (turn.authorId == null ||
      (currentUserId != null && turn.authorId === currentUserId));
  const showAvatar = isUser && turn.authorId != null && !isSelf;
  const userHeaderLabel = isUser
    ? isSelf
      ? "Você"
      : (turn.authorName && turn.authorName.trim()) || `Usuário #${turn.authorId ?? "?"}`
    : "Assistente";
  return (
    <div className={`px-4 py-3 ${isUser ? "bg-elevated/50" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {showAvatar && (
          <SenderAvatar userId={turn.authorId ?? null} name={userHeaderLabel} size={18} />
        )}
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {userHeaderLabel}
        </div>
      </div>
      {turn.thinking && <ThinkingBlock text={turn.thinking} />}
      {turn.tools && turn.tools.length > 0 && (
        <div className="mb-2">
          {turn.tools.map((t) => (
            <ToolCallDisplay key={t.id} call={t} />
          ))}
        </div>
      )}
      {turn.proposals && turn.proposals.length > 0 && (
        <div className="mb-2">
          {turn.proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onApply={onApplyProposal}
              onEdit={onEditProposal}
              onInstruct={onInstructProposal}
            />
          ))}
        </div>
      )}
      {turn.forms && turn.forms.length > 0 && (
        <div className="mb-2">
          {turn.forms.map((f) => (
            <InputFormCard key={f.id} form={f} onSubmit={onSubmitForm} onCancel={onCancelForm} />
          ))}
        </div>
      )}
      {turn.text &&
        (isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words text-foreground">
            {turn.text}
          </div>
        ) : (
          <MarkdownContent text={turn.text} />
        ))}
      <StopReasonBanner reason={turn.stopReason} />
    </div>
  );
}

/**
 * Strip `<thinking>...</thinking>` blocks (and similar XML reasoning tags)
 * from the agent's text output — the thinking already rendered via the
 * dedicated SSE channel; dropping it here avoids duplication.
 */
function stripThinkingTags(text: string): string {
  let out = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  out = out.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  out = out.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, "");
  out = out.replace(/<thinking>[\s\S]*$/i, "");
  out = out.replace(/<reasoning>[\s\S]*$/i, "");
  return out.trim();
}

function MarkdownContent({ text }: { text: string }) {
  const effectiveText = stripThinkingTags(text);
  return (
    <div className="text-sm text-foreground leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-3 my-2 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="font-mono text-[0.85em] bg-elevated px-1 py-0.5 rounded text-manta"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`font-mono text-xs ${className || ""}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="font-mono text-xs bg-elevated p-3 rounded my-2 overflow-x-auto">
              {children}
            </pre>
          ),
          a: ({ href, children }) => {
            const isSafeExternal =
              href != null &&
              (href.startsWith("http://") ||
                href.startsWith("https://") ||
                href.startsWith("mailto:"));
            if (!isSafeExternal) {
              return <span className="font-medium">{children}</span>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-manta hover:underline"
              >
                {children}
              </a>
            );
          },
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-elevated">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-border-subtle">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-semibold border border-border-subtle">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border border-border-subtle align-top">{children}</td>
          ),
          hr: () => <hr className="my-3 border-border-subtle" />,
        }}
      >
        {effectiveText}
      </ReactMarkdown>
    </div>
  );
}

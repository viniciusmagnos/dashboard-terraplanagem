// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Bloco de texto/análise em markdown. IMPORTANTE: este componente é
// carregado via React.lazy no DynamicBlock — react-markdown só entra no
// bundle quando algum bloco markdown existe no layout.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BlocoMarkdown } from "../../lib/dashboard-spec";
import { BlocoFrame } from "./BlocoFrame";

export function DynMarkdown({ bloco }: { bloco: BlocoMarkdown }) {
  const corpo = typeof bloco.corpo === "string" ? bloco.corpo : "";
  return (
    <BlocoFrame
      blocoId={bloco.id}
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      nota={bloco.nota}
      aviso={corpo ? null : "bloco markdown sem corpo"}
    >
      <div className="text-sm text-foreground leading-relaxed break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>,
            h2: ({ children }) => <h3 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h3>,
            h3: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>,
            p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
            code: ({ children }) => (
              <code className="font-mono text-[0.85em] bg-elevated px-1 py-0.5 rounded text-manta">
                {children}
              </code>
            ),
            a: ({ href, children }) =>
              href && /^https?:/i.test(href) ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-manta hover:underline">
                  {children}
                </a>
              ) : (
                <span className="font-medium">{children}</span>
              ),
            table: ({ children }) => (
              <div className="my-2 overflow-x-auto">
                <table className="min-w-full text-xs border-collapse">{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className="px-2 py-1 text-left font-semibold border border-border-subtle">{children}</th>
            ),
            td: ({ children }) => (
              <td className="px-2 py-1 border border-border-subtle align-top">{children}</td>
            ),
          }}
        >
          {corpo}
        </ReactMarkdown>
      </div>
    </BlocoFrame>
  );
}

export default DynMarkdown;

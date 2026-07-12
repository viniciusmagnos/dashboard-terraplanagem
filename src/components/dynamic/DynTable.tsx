// APP-LOCAL — não adicionar ao sync-from-hub.
import { useMemo } from "react";
import type { BlocoTable } from "../../lib/dashboard-spec";
import { BlocoFrame } from "./BlocoFrame";
import { formatador } from "./formatos";

export function DynTable({ bloco }: { bloco: BlocoTable }) {
  const colunas = Array.isArray(bloco.colunas) ? bloco.colunas : [];
  const linhas = Array.isArray(bloco.linhas) ? bloco.linhas : [];
  const fmts = useMemo(
    () => new Map(colunas.map((c) => [c.key, formatador(c.formato)])),
    [colunas],
  );
  const aviso =
    colunas.length === 0 ? "tabela sem colunas" : linhas.length === 0 ? "tabela sem linhas" : null;

  return (
    <BlocoFrame
      blocoId={bloco.id}
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      nota={bloco.nota}
      aviso={aviso}
    >
      {colunas.length > 0 && linhas.length > 0 && (
        <div className="overflow-x-auto -m-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                {colunas.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 ${c.alinhamento === "right" ? "text-right" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, i) => (
                <tr key={i} className="border-t border-border">
                  {colunas.map((c) => {
                    const v = linha?.[c.key];
                    const texto =
                      typeof v === "number" ? (fmts.get(c.key) ?? String)(v) : (v ?? "—");
                    return (
                      <td
                        key={c.key}
                        className={`px-3 py-2 ${
                          c.alinhamento === "right" || typeof v === "number" ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {texto}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BlocoFrame>
  );
}

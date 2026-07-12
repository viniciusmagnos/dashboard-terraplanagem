import { useMemo } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { Provenance } from "../../lib/mtp";
import { ProvChip, PROV_ESTILO } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Validação de dados: proveniência por bloco + avisos do pacote. */
export function ValidacaoDadosTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const entradas = useMemo(
    () => Object.entries(pacote.provenance ?? {}) as [string, Provenance][],
    [pacote],
  );

  const contagem = useMemo(() => {
    const c: Partial<Record<Provenance, number>> = {};
    for (const [, p] of entradas) c[p] = (c[p] ?? 0) + 1;
    return c;
  }, [entradas]);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={ShieldCheck}
        titulo="Validação de dados"
        subtitulo={`${entradas.length} blocos rastreados · ${pacote.warnings.length} aviso(s)`}
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(PROV_ESTILO) as Provenance[]).map((p) =>
          contagem[p] ? (
            <span
              key={p}
              className={`text-xs px-2 py-1 rounded border ${PROV_ESTILO[p].classe}`}
            >
              {contagem[p]} {PROV_ESTILO[p].rotulo}
            </span>
          ) : null,
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
          Proveniência por bloco
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {entradas.map(([bloco, prov]) => (
                <tr key={bloco} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{bloco}</td>
                  <td className="px-4 py-2 text-right">
                    <ProvChip prov={prov} />
                  </td>
                </tr>
              ))}
              {entradas.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground text-sm">
                    Pacote sem mapa de proveniência.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {pacote.warnings.length > 0 ? (
        <div className="bg-surface border border-warning/40 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle size={15} /> Avisos do processamento
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {pacote.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum aviso registrado no pacote.</p>
      )}
    </div>
  );
}

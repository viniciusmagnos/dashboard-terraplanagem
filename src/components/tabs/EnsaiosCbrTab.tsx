import { useMemo } from "react";
import { FlaskConical } from "lucide-react";
import { fmt } from "../../lib/format";
import { geotecniaDe } from "../../lib/mtp";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/** Ensaios de CBR extraídos dos laudos de sondagem (bloco sondagens). */
export function EnsaiosCbrTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const geo = geotecniaDe(pacote);

  const ensaios = useMemo(() => {
    if (!geo) return [];
    return geo.sondagens
      .flatMap((s) => (s.ensaios ?? []).map((e) => ({ ...e, furo: s.id })))
      .filter((e) => e.cbr_pct != null);
  }, [geo]);

  if (!geo) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={FlaskConical} titulo="Ensaios CBR" />
        <p className="text-sm text-muted-foreground">
          Pacote sem bloco de sondagens. Anexe os laudos na aba{" "}
          <strong>Geotecnia → Importar sondagens</strong>.
        </p>
      </div>
    );
  }

  const cbrMedio =
    ensaios.length > 0
      ? ensaios.reduce((s, e) => s + (e.cbr_pct ?? 0), 0) / ensaios.length
      : null;

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={FlaskConical}
        titulo="Ensaios CBR"
        subtitulo={`${ensaios.length} ensaio(s) com CBR · média ${fmt(cbrMedio, 1)}%`}
        right={<ProvChip pacote={pacote} bloco="sondagens" />}
      />

      {ensaios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum ensaio de CBR nos laudos deste pacote.
        </p>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">Furo</th>
                  <th className="px-4 py-2">Amostra</th>
                  <th className="px-4 py-2 text-right">Prof. (m)</th>
                  <th className="px-4 py-2 text-right">CBR (%)</th>
                  <th className="px-4 py-2 text-right">Expansão (%)</th>
                  <th className="px-4 py-2">MCT</th>
                  <th className="px-4 py-2">HRB</th>
                  <th className="px-4 py-2">USCS</th>
                </tr>
              </thead>
              <tbody>
                {ensaios.map((e, i) => (
                  <tr key={`${e.furo}-${i}`} className="border-t border-border hover:bg-surface-hover">
                    <td className="px-4 py-2 font-mono text-xs">{e.furo}</td>
                    <td className="px-4 py-2">{e.ident || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {e.prof_de_m != null ? `${fmt(e.prof_de_m, 1)}–${fmt(e.prof_a_m, 1)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{fmt(e.cbr_pct, 1)}</td>
                    <td className="px-4 py-2 text-right">{fmt(e.expansao_pct, 1)}</td>
                    <td className="px-4 py-2">{e.mct ?? "—"}</td>
                    <td className="px-4 py-2">{e.hrb ?? "—"}</td>
                    <td className="px-4 py-2">{e.uscs ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

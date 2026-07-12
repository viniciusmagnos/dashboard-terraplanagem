import { useMemo } from "react";
import { Layers3 } from "lucide-react";
import { fmt } from "../../lib/format";
import { geotecniaDe } from "../../lib/mtp";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

interface AggEixo {
  eixo: string;
  n: number;
  profSoma: number;
  profN: number;
  naSoma: number;
  naN: number;
  nSoloMole: number;
  nImpenetravel: number;
}

/** Resumo das sondagens agregado por rodovia/eixo. */
export function ResumoRodoviaGeoTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const geo = geotecniaDe(pacote);

  const linhas = useMemo(() => {
    if (!geo) return [];
    const nomes = new Map(pacote.eixos.map((e) => [e.id, e.nome]));
    const agg = new Map<string, AggEixo>();
    for (const s of geo.sondagens) {
      const key = s.eixo_id ?? "—";
      const cur =
        agg.get(key) ??
        {
          eixo: s.eixo_id ? (nomes.get(s.eixo_id) ?? s.eixo_id) : "Sem eixo",
          n: 0,
          profSoma: 0,
          profN: 0,
          naSoma: 0,
          naN: 0,
          nSoloMole: 0,
          nImpenetravel: 0,
        };
      cur.n += 1;
      if (s.prof_total_m != null) {
        cur.profSoma += s.prof_total_m;
        cur.profN += 1;
      }
      if (s.na_m != null) {
        cur.naSoma += s.na_m;
        cur.naN += 1;
      }
      if (s.solo_mole_ate_m != null) cur.nSoloMole += 1;
      if (s.impenetravel_m != null) cur.nImpenetravel += 1;
      agg.set(key, cur);
    }
    return [...agg.values()].sort((a, b) => b.n - a.n);
  }, [geo, pacote]);

  if (!geo) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={Layers3} titulo="Resumo por rodovia" />
        <p className="text-sm text-muted-foreground">Pacote sem bloco de sondagens.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Layers3}
        titulo="Resumo por rodovia"
        subtitulo={`${geo.resumo.n_total} sondagens · ${geo.resumo.n_posicionadas} posicionadas em ${linhas.length} eixos`}
        right={<ProvChip pacote={pacote} bloco="sondagens" />}
      />

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Eixo</th>
                <th className="px-4 py-2 text-right">Sondagens</th>
                <th className="px-4 py-2 text-right">Prof. média (m)</th>
                <th className="px-4 py-2 text-right">NA médio (m)</th>
                <th className="px-4 py-2 text-right">Solo mole</th>
                <th className="px-4 py-2 text-right">Impenetrável</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.eixo} className="border-t border-border hover:bg-surface-hover">
                  <td className="px-4 py-2">{l.eixo}</td>
                  <td className="px-4 py-2 text-right">{l.n}</td>
                  <td className="px-4 py-2 text-right">
                    {l.profN ? fmt(l.profSoma / l.profN, 1) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {l.naN ? fmt(l.naSoma / l.naN, 1) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">{l.nSoloMole || "—"}</td>
                  <td className="px-4 py-2 text-right">{l.nImpenetravel || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

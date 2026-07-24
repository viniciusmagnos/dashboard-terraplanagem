/**
 * ComparativoCategoriasView — total de corte por categoria (m³) por eixo,
 * estimado por TRÊS fontes independentes, lado a lado:
 *   • Horizontes (geólogo)   — topo de rocha RAM/RAD do DWG de perfil;
 *   • Furo SPT (laudos)      — furos UTM projetados, por bin (atribuir_materiais);
 *   • Seção × furo do perfil — materiais da seção × furo do perfil (Fase 2).
 * Divergências refletem a fonte do dado, não erro de cálculo.
 */
import { useMemo } from "react";
import { Scale } from "lucide-react";
import { fmt } from "../../../lib/format";
import { corteCategoriaPorEixoSecao } from "../../../lib/perfil-materiais";
import type {
  MtpGeometria,
  MtpGeotecnia,
  MtpPerfilGeologico,
} from "../../../lib/mtp";

const COR_CAT: Record<number, string> = { 1: "#34d399", 2: "#f59e0b", 3: "#f43f5e" };

interface MetodoLinha {
  nome: string;
  hint: string;
  c1: number | null;
  c2: number | null;
  c3: number | null;
}
interface EixoLinha {
  eixo_id: string;
  metodos: MetodoLinha[];
}

export function ComparativoCategoriasView({
  perfil,
  geo,
  geometria,
}: {
  perfil: MtpPerfilGeologico;
  geo: MtpGeotecnia | null;
  geometria: MtpGeometria | null;
}) {
  const linhas = useMemo<EixoLinha[]>(() => {
    if (!geometria) return [];
    const out: EixoLinha[] = [];
    for (const ge of geometria.eixos) {
      const pe = perfil.eixos.find((e) => e.eixo_id === ge.eixo_id);
      if (!pe?.sondagens?.length) continue;
      const secM = corteCategoriaPorEixoSecao(ge, pe.sondagens);
      if (!secM) continue;
      const hz = perfil.categorias_por_eixo.find((c) => c.eixo_id === ge.eixo_id);
      const fu = geo?.materiais?.por_eixo.find((m) => m.eixo_id === ge.eixo_id);
      out.push({
        eixo_id: ge.eixo_id,
        metodos: [
          {
            nome: "Horizontes (geólogo)",
            hint: "topo de rocha RAM/RAD do DWG",
            c1: hz?.corte_1cat ?? null,
            c2: hz?.corte_2cat ?? null,
            c3: hz?.corte_3cat ?? null,
          },
          {
            nome: "Furo SPT (laudos)",
            hint: "furos UTM projetados, por bin",
            c1: fu?.corte_1cat ?? null,
            c2: fu?.corte_2cat ?? null,
            c3: fu?.corte_3cat ?? null,
          },
          {
            nome: "Seção × furo do perfil",
            hint: "materiais da seção × furo do perfil (esta ferramenta)",
            // camadas sem classificação (material vazio + sem SPT) contam como 1ª
            c1: secM.corte_1cat + secM.sem_cat,
            c2: secM.corte_2cat,
            c3: secM.corte_3cat,
          },
        ],
      });
    }
    return out;
  }, [perfil, geo, geometria]);

  if (!linhas.length) return null;

  const cel = (v: number | null) =>
    v == null ? <span className="text-muted-foreground">—</span> : fmt(v, 0);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Scale size={14} className="text-amber-400" />
          Corte por categoria — comparação de métodos (m³)
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Volume de corte por categoria de escavação por eixo, estimado por três
          fontes independentes. Diferenças refletem a fonte do dado (interpretação
          do geólogo × furos × geometria da seção), não erro de cálculo.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-3 py-2">Eixo</th>
              <th className="px-3 py-2">Método</th>
              <th className="px-3 py-2 text-right" style={{ color: COR_CAT[1] }}>
                1ª cat
              </th>
              <th className="px-3 py-2 text-right" style={{ color: COR_CAT[2] }}>
                2ª cat
              </th>
              <th className="px-3 py-2 text-right" style={{ color: COR_CAT[3] }}>
                3ª cat
              </th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Rocha (2ª+3ª)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((L) =>
              L.metodos.map((m, mi) => {
                const temTudo = m.c1 != null || m.c2 != null || m.c3 != null;
                const tot = (m.c1 ?? 0) + (m.c2 ?? 0) + (m.c3 ?? 0);
                const rocha = (m.c2 ?? 0) + (m.c3 ?? 0);
                return (
                  <tr
                    key={L.eixo_id + m.nome}
                    className={
                      mi === 0
                        ? "border-t-2 border-border"
                        : "border-t border-border/40"
                    }
                  >
                    <td className="px-3 py-1.5 font-medium align-top">
                      {mi === 0 ? L.eixo_id : ""}
                    </td>
                    <td className="px-3 py-1.5">
                      {m.nome}
                      <span className="block text-[10px] text-muted-foreground">
                        {m.hint}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{cel(m.c1)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{cel(m.c2)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{cel(m.c3)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {temTudo ? fmt(tot, 0) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {temTudo && tot > 0
                        ? `${fmt(rocha, 0)} (${Math.round((100 * rocha) / tot)}%)`
                        : "—"}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
        "Seção × furo do perfil": integra, ao longo do eixo, a composição do corte
        de cada seção (furo do perfil mais próximo, ≤ 300 m). Camadas sem
        classificação (material vazio + sem SPT) contam como 1ª.
      </p>
    </div>
  );
}

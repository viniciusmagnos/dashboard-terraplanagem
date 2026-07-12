// APP-LOCAL — não adicionar ao sync-from-hub.
import { KpiCard } from "../landxml/KpiCard";
import { useNumeroResolvido } from "../../lib/dashboard-bindings";
import type { BlocoKpi } from "../../lib/dashboard-spec";
import { formatador, sufixoDefault } from "./formatos";
import { ChipIaRemover } from "./ChipIa";

export function DynKpi({ bloco }: { bloco: BlocoKpi }) {
  const { valor, erro } = useNumeroResolvido(bloco.valor);
  return (
    <KpiCard
      rotulo={bloco.titulo || bloco.id}
      valor={valor}
      formato={formatador(bloco.formato)}
      sufixo={bloco.sufixo ?? sufixoDefault(bloco.formato)}
      deltaPct={bloco.deltaPct}
      chip={<ChipIaRemover blocoId={bloco.id} />}
      rodape={
        erro ? (
          <span className="text-warning">fonte indisponível: {erro}</span>
        ) : (
          bloco.nota
        )
      }
    />
  );
}

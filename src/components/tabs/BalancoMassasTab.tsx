import { Scale } from "lucide-react";
import { fmt } from "../../lib/format";
import { ProvChip } from "../landxml/ProvChip";
import { BrucknerChart } from "../landxml/BrucknerChart";
import { QuadroOrigemDestino } from "../landxml/cenarios/QuadroOrigemDestino";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

/** Balanço de massas: curva de Brückner + quadro origem/destino do cenário. */
export function BalancoMassasTab({ accent }: { accent: string }) {
  const { pacote, ativo } = useEstudo();
  const br = ativo.bruckner ?? pacote.bruckner ?? null;

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Scale}
        titulo="Balanço de massas"
        subtitulo={
          br
            ? `Corte ${fmt(br.totals.v_corte)} m³ · Aterro ${fmt(br.totals.v_aterro)} m³ · Compensado ${fmt(br.totals.volume_compensado)} m³`
            : undefined
        }
        right={<ProvChip prov="computed" />}
      />

      {br ? (
        <BrucknerChart curve={br.curve} barreiras={pacote.barreiras} />
      ) : (
        <EmptyStateAguardando
          bloco="bruckner"
          descricao="A curva de massas depende do resultado Brückner (pacote com bins de rodovia)."
        />
      )}

      <QuadroOrigemDestino />
    </div>
  );
}

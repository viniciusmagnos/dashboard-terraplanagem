import { SlidersHorizontal } from "lucide-react";
import { PainelParametrosBruckner } from "../landxml/cenarios/PainelParametrosBruckner";
import { PainelPremissas } from "../landxml/cenarios/PainelPremissas";
import { PainelEntradasProjeto } from "../landxml/cenarios/PainelEntradasProjeto";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/**
 * Premissas do estudo: parâmetros Brückner + premissas econômicas do cenário
 * ativo + entradas de projeto (compartilhadas). Reúne os painéis do core.
 */
export function PremissasTab({ accent }: { accent: string }) {
  const { ativo } = useEstudo();
  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={SlidersHorizontal}
        titulo="Premissas"
        subtitulo={`Parâmetros e premissas do cenário: ${ativo.def.nome}`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <PainelParametrosBruckner />
        <PainelPremissas />
      </div>
      <PainelEntradasProjeto />
    </div>
  );
}

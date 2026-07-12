import { DiagramaLinearEixos } from "../landxml/DiagramaLinearEixos";
import { useEstudo } from "../landxml/cenarios/EstudoContext";

/** Planta linear alimentada pelo Brückner do cenário ativo. */
export function PlantaTab() {
  const { pacote, ativo } = useEstudo();
  const barreirasVisiveis = [
    ...pacote.barreiras.filter((b) =>
      ativo.def.bruckner.barreirasAtivas.includes(b.sta_m),
    ),
    ...ativo.def.bruckner.barreirasExtras.map((b) => ({
      sta_m: b.sta_m,
      nome: b.nome,
      tipo: "manual",
    })),
  ];
  return (
    <DiagramaLinearEixos
      pacote={pacote}
      bruckner={ativo.bruckner}
      barreirasVisiveis={barreirasVisiveis}
    />
  );
}

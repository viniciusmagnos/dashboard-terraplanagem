// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Registro dos GRÁFICOS NOMEADOS que aceitam séries extras do assistente
// (overlays da spec). Cada aba dona de um gráfico nomeado resolve os
// overlays do seu id e injeta no componente (ex.: BrucknerTab →
// <BrucknerChart seriesExtras=...>). Ao registrar um novo gráfico aqui,
// espelhar em GRAFICOS_NOMEADOS no backend (estudos/layout.py).
export interface GraficoNomeado {
  /** Unidade do eixo X das séries extras (como o agente deve mandar). */
  unidadeX: string;
  unidadeY: string;
  descricao: string;
}

export const GRAFICOS_NOMEADOS: Record<string, GraficoNomeado> = {
  bruckner: {
    unidadeX: "m (estação absoluta)",
    unidadeY: "m³ (ordenada acumulada)",
    descricao: "Curva de Brückner da aba Dashboard → Brückner e DMT",
  },
};

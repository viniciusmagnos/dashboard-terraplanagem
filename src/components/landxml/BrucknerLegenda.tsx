/**
 * BrucknerLegenda — como ler o diagrama de massas e o que a "linha de
 * distribuição" muda (didática portada do dashboard Motiva).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

export function BrucknerLegenda({ compacta = false }: { compacta?: boolean }) {
  const [aberta, setAberta] = useState(!compacta);
  return (
    <div className="bg-surface border border-border rounded-lg text-sm">
      <button
        onClick={() => setAberta((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left font-medium"
      >
        {aberta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <Info size={15} className="text-cyan-500" />
        Como ler o diagrama de Brückner
      </button>
      {aberta && (
        <div className="px-4 pb-4 space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            A curva acumula, estaca a estaca,{" "}
            <span className="text-foreground">
              corte − (fator de homogeneização × aterro)
            </span>
            . <span className="text-orange-400">Ordenada subindo</span> = excesso
            de corte (material sobrando);{" "}
            <span className="text-emerald-400">ordenada descendo</span> = déficit
            (aterro consumindo material).
          </p>
          <p>
            <span className="text-foreground">Pontos de equilíbrio</span>: onde a
            curva cruza a linha de distribuição — ali o corte acumulado é igual
            ao aterro acumulado. Cada "onda" entre dois cruzamentos é um bloco de
            compensação: a área entre a curva e a linha é o{" "}
            <span className="text-foreground">momento de transporte (m³·km)</span>{" "}
            e momento ÷ volume dá a <span className="text-foreground">DMT</span>.
          </p>
          <p>
            <span className="text-foreground">Linha de distribuição</span> — a
            horizontal de onde os desvios são medidos:{" "}
            <span className="text-foreground">"início do segmento"</span> ancora
            a linha na ordenada inicial (nada cruza o início; todo o desequilíbrio
            acumula numa ponta só → residual no fim);{" "}
            <span className="text-foreground">"mediana"</span> posiciona a linha
            na mediana ponderada da curva — é a posição que{" "}
            <span className="text-foreground">minimiza o momento total</span>,
            mas admite empréstimo/bota-fora nas DUAS pontas do segmento.
          </p>
          <p>
            <span className="text-amber-400">Barreiras (OAEs)</span>: pontes e
            viadutos que o material não cruza — dividem a curva em segmentos
            independentes. O residual de cada segmento vira{" "}
            <span className="text-amber-400">sobra → bota-fora</span> ou{" "}
            <span className="text-cyan-400">falta → empréstimo</span>.
          </p>
        </div>
      )}
    </div>
  );
}

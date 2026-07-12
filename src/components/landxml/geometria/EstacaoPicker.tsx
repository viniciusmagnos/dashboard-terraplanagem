/**
 * EstacaoPicker — navegação por estaca dentro das seções de um eixo:
 * slider (índice da seção) + botões anterior/próxima + rótulo km.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { staToKmLabel } from "../../../lib/mtp";

export function EstacaoPicker({
  stas,
  indice,
  onIndice,
}: {
  stas: number[];
  indice: number;
  onIndice: (i: number) => void;
}) {
  if (!stas.length) return null;
  const i = Math.min(Math.max(indice, 0), stas.length - 1);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onIndice(Math.max(0, i - 1))}
        disabled={i <= 0}
        className="p-1.5 border border-border rounded hover:bg-surface-hover disabled:opacity-30"
        title="Seção anterior"
      >
        <ChevronLeft size={15} />
      </button>
      <input
        type="range"
        min={0}
        max={stas.length - 1}
        step={1}
        value={i}
        onChange={(e) => onIndice(Number(e.target.value))}
        className="flex-1 accent-manta"
      />
      <button
        onClick={() => onIndice(Math.min(stas.length - 1, i + 1))}
        disabled={i >= stas.length - 1}
        className="p-1.5 border border-border rounded hover:bg-surface-hover disabled:opacity-30"
        title="Próxima seção"
      >
        <ChevronRight size={15} />
      </button>
      <span className="text-sm font-medium tabular-nums w-28 text-right">
        {staToKmLabel(stas[i])}
      </span>
      <span className="text-xs text-muted-foreground w-20 text-right">
        {i + 1}/{stas.length}
      </span>
    </div>
  );
}

// APP-LOCAL — não adicionar ao sync-from-hub.
import { fmt, fmtBRL, fmtKm, fmtPct } from "../../lib/format";
import type { FormatoNumero } from "../../lib/dashboard-spec";

export function formatador(f?: FormatoNumero): (v: number) => string {
  switch (f) {
    case "moeda":
      return (v) => fmtBRL(v);
    case "pct":
      return (v) => fmtPct(v);
    case "km":
      return (v) => fmtKm(v);
    default:
      return (v) => fmt(v);
  }
}

/** Sufixo default por formato (usado quando o bloco não define `sufixo`). */
export function sufixoDefault(f?: FormatoNumero): string | undefined {
  switch (f) {
    case "m3":
      return "m³";
    case "m3km":
      return "m³·km";
    case "m":
      return "m";
    default:
      return undefined;
  }
}

export const PALETA_DINAMICA = [
  "#C8601F",
  "#8B5CF6",
  "#22C55E",
  "#06B6D4",
  "#EAB308",
  "#EC4899",
  "#3B82F6",
  "#F97316",
];

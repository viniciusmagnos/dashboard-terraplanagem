/** Formatadores pt-BR compartilhados pelo dashboard de terraplenagem. */

export const fmt = (v: number | null | undefined, dec = 0): string =>
  v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: dec });

export const fmtBRL = (v: number | null | undefined, dec = 0): string =>
  v == null ? "—" : `R$ ${fmt(v, dec)}`;

/** R$ 506,2 M · R$ 54,7 M · R$ 950 mil — para KPIs. */
export const fmtBRLCompacto = (v: number | null | undefined): string => {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${fmt(v / 1e6, 1)} M`;
  if (abs >= 1e3) return `R$ ${fmt(v / 1e3, 0)} mil`;
  return `R$ ${fmt(v, 0)}`;
};

export const fmtKm = (v: number | null | undefined, dec = 2): string =>
  v == null ? "—" : `${fmt(v, dec)} km`;

/** Percentual já em escala 0–100 (ex.: economia.percent). */
export const fmtPct = (v: number | null | undefined, dec = 1): string =>
  v == null ? "—" : `${fmt(v, dec)}%`;

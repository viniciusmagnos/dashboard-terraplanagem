/**
 * Helpers client-side sobre o bloco `geometria` do pacote v2:
 * - TracadoFrame — station → (e, n) + normal direita (port do AlignmentFrame;
 *   offset+ = LADO DIREITO do estaqueamento);
 * - interpolação de perfil (greide/terreno) em grade uniforme com nulls;
 * - busca de seção mais próxima e interpolação de linha por offset.
 *
 * Coordenadas já vêm com world_offset/z_offset aplicados (float32-safe).
 */
import type {
  MtpGeoEixo,
  MtpGeoPerfil,
  MtpGeoSecao,
  MtpGeometria,
} from "./mtp";

export class TracadoFrame {
  private e: number[];
  private n: number[];
  readonly sta0: number;
  readonly passo: number;
  readonly staFim: number;

  constructor(tracado: { passo_m: number; sta0_m: number; en: number[] }) {
    this.e = [];
    this.n = [];
    for (let i = 0; i + 1 < tracado.en.length; i += 2) {
      this.e.push(tracado.en[i]);
      this.n.push(tracado.en[i + 1]);
    }
    this.sta0 = tracado.sta0_m;
    this.passo = tracado.passo_m;
    this.staFim = this.sta0 + (this.e.length - 1) * this.passo;
  }

  get valido(): boolean {
    return this.e.length >= 2;
  }

  /** Ponto no plano + normal unitária à DIREITA do estaqueamento. */
  locate(station: number): { e: number; n: number; ne: number; nn: number } {
    const { e, n, sta0, passo } = this;
    const last = e.length - 2;
    const t = Math.min(Math.max((station - sta0) / passo, 0), e.length - 1);
    const i = Math.min(Math.max(Math.floor(t), 0), last);
    const f = t - i;
    const pe = e[i] + f * (e[i + 1] - e[i]);
    const pn = n[i] + f * (n[i + 1] - n[i]);
    let de = e[i + 1] - e[i];
    let dn = n[i + 1] - n[i];
    const norm = Math.hypot(de, dn) || 1;
    de /= norm;
    dn /= norm;
    // normal direita: rotação de −90° no plano (E, N)
    return { e: pe, n: pn, ne: dn, nn: -de };
  }

  xyAt(station: number, offset: number): { e: number; n: number } {
    const p = this.locate(station);
    return { e: p.e + p.ne * offset, n: p.n + p.nn * offset };
  }
}

/** Interpolação linear numa série uniforme com nulls (null fora/entre nulls). */
function serieAt(
  perfil: MtpGeoPerfil,
  serie: (number | null)[],
  station: number,
): number | null {
  if (!serie.length) return null;
  const t = (station - perfil.sta0_m) / perfil.passo_m;
  if (t < 0 || t > serie.length - 1) return null;
  const i = Math.min(Math.floor(t), serie.length - 2);
  const a = serie[i];
  const b = serie[Math.min(i + 1, serie.length - 1)];
  if (a == null || b == null) return a ?? b ?? null;
  return a + (t - i) * (b - a);
}

export const greideAt = (perfil: MtpGeoPerfil, sta: number) =>
  serieAt(perfil, perfil.greide_z, sta);
export const terrenoAt = (perfil: MtpGeoPerfil, sta: number) =>
  serieAt(perfil, perfil.terreno_z, sta);

/** Seção mais próxima da estação (busca binária). */
export function nearestSecao(
  eixo: MtpGeoEixo,
  station: number,
): MtpGeoSecao | null {
  const s = eixo.secoes;
  if (!s.length) return null;
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].sta_m <= station) lo = mid;
    else hi = mid;
  }
  return Math.abs(s[lo].sta_m - station) <= Math.abs(s[hi].sta_m - station)
    ? s[lo]
    : s[hi];
}

/** z na linha flat [off, z, ...] por offset (null fora do domínio). */
export function interpLinha(flat: number[], off: number): number | null {
  const n = flat.length >> 1;
  if (n < 2) return null;
  if (off < flat[0] || off > flat[(n - 1) * 2]) return null;
  for (let i = 0; i < n - 1; i++) {
    const x0 = flat[i * 2];
    const x1 = flat[(i + 1) * 2];
    if (off >= x0 && off <= x1) {
      const z0 = flat[i * 2 + 1];
      const z1 = flat[(i + 1) * 2 + 1];
      const t = x1 > x0 ? (off - x0) / (x1 - x0) : 0;
      return z0 + t * (z1 - z0);
    }
  }
  return flat[(n - 1) * 2 + 1];
}

export interface SecaoBounds {
  offMin: number;
  offMax: number;
  zMin: number;
  zMax: number;
}

export function secaoBounds(secao: MtpGeoSecao): SecaoBounds {
  let offMin = Infinity;
  let offMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const flat of [secao.terreno, secao.plataforma, secao.cft ?? []]) {
    for (let i = 0; i + 1 < flat.length; i += 2) {
      offMin = Math.min(offMin, flat[i]);
      offMax = Math.max(offMax, flat[i]);
      zMin = Math.min(zMin, flat[i + 1]);
      zMax = Math.max(zMax, flat[i + 1]);
    }
  }
  return { offMin, offMax, zMin, zMax };
}

/** Eixos com geometria útil, rodovias primeiro. */
export function eixosComGeometria(g: MtpGeometria): MtpGeoEixo[] {
  return [...g.eixos]
    .filter((e) => (e.tracado?.en.length ?? 0) >= 4 || e.secoes.length > 0)
    .sort((a, b) => b.secoes.length - a.secoes.length);
}

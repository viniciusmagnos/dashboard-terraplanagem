// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Resolver de bindings da Dashboard Spec — 100% client-side, sobre o que o
// EstudoContext já computa. Bindings re-resolvem quando cenário/entradas
// mudam (hooks useMemo sobre o contexto), então um card/série "vivo"
// acompanha o estudo. Binding inválido degrada em {valor:null, erro} — o
// renderer mostra aviso no card, nunca crash.
//
// A variante {fonte:"bruckner.curve", params:{...}} computa uma HIPÓTESE
// client-side (computarCenario + binsMainline, motor vendorado) — necessária
// porque estudo_simular não devolve a curva pela rede.
import { useMemo } from "react";
import {
  useEstudo,
  type EstudoContextValue,
} from "../components/landxml/cenarios/EstudoContext";
import {
  computarCenario,
  type CenarioComputado,
  type CenarioDef,
} from "./cenario";
import type { BrucknerResult } from "./bruckner";
import type { MtpPacote } from "./mtp";
import type { Binding, BrucknerParamsBinding, Dado } from "./dashboard-spec";

export interface Resolvido<T> {
  valor: T | null;
  erro: string | null;
}

type Ctx = Pick<
  EstudoContextValue,
  "pacote" | "binsMainline" | "entradas" | "casoBase" | "computados" | "ativo"
>;

/* ── Núcleo puro ───────────────────────────────────────────── */

function alvoComputado(ctx: Ctx, cenario: string | undefined): CenarioComputado | string {
  const alvo = cenario ?? "ativo";
  if (alvo === "ativo") return ctx.ativo;
  if (alvo === "caso-base") return ctx.casoBase;
  const comp = ctx.computados.get(alvo);
  if (comp) return comp;
  return `cenário "${alvo}" não existe mais`;
}

function dotPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const parte of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[parte];
  }
  return cur;
}

function serieValida(v: unknown): v is [number, number][] {
  if (!Array.isArray(v)) return false;
  for (let i = 0; i < Math.min(v.length, 5); i++) {
    const p = v[i];
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      return false;
    }
  }
  return true;
}

// Cache das hipóteses por pacote (o Brückner é o custo dominante; o motor já
// deduplica por chave fillFactor|baseline|barreiras via o cache passado).
const _cachePorPacote = new WeakMap<MtpPacote, Map<string, BrucknerResult>>();

function cacheDe(pacote: MtpPacote): Map<string, BrucknerResult> {
  let c = _cachePorPacote.get(pacote);
  if (!c) {
    c = new Map();
    _cachePorPacote.set(pacote, c);
  }
  return c;
}

function curvaHipotetica(
  ctx: Ctx,
  base: CenarioComputado,
  params: BrucknerParamsBinding,
): Resolvido<[number, number][]> {
  if (!ctx.binsMainline.length) {
    return { valor: null, erro: "estudo sem bins de Brückner (pacote escalar)" };
  }
  const bruckner = { ...base.def.bruckner };
  if (params.fillFactor != null) bruckner.fillFactor = params.fillFactor;
  if (params.baseline != null) bruckner.baseline = params.baseline;
  if (params.barreirasAtivas != null) bruckner.barreirasAtivas = params.barreirasAtivas;
  if (params.barreirasExtras != null) {
    bruckner.barreirasExtras = params.barreirasExtras.map((b) => ({
      sta_m: b.sta_m,
      nome: b.nome ?? "",
    }));
  }
  const def: CenarioDef = {
    ...base.def,
    id: "hipotese-binding",
    nome: "Hipótese",
    bruckner,
  };
  try {
    const comp = computarCenario({
      pacote: ctx.pacote,
      binsMainline: ctx.binsMainline,
      entradas: ctx.entradas,
      def,
      cache: cacheDe(ctx.pacote),
    });
    const curve = comp.bruckner?.curve;
    if (!curve || !curve.length) return { valor: null, erro: "hipótese sem curva" };
    return { valor: curve, erro: null };
  } catch (e) {
    return { valor: null, erro: `falha ao computar hipótese: ${(e as Error).message}` };
  }
}

export function resolverSerie(
  dado: Dado<[number, number][]> | undefined,
  ctx: Ctx,
): Resolvido<[number, number][]> {
  if (!dado || typeof dado !== "object") return { valor: null, erro: "sem dados" };
  if ("inline" in dado) {
    return serieValida(dado.inline)
      ? { valor: dado.inline, erro: null }
      : { valor: null, erro: "dados inline não são pares [x,y] numéricos" };
  }
  const b = dado.binding as Binding | undefined;
  if (!b || typeof b !== "object") return { valor: null, erro: "binding ausente" };

  if (b.fonte === "bruckner.curve") {
    const alvo = alvoComputado(ctx, b.cenario);
    if (typeof alvo === "string") return { valor: null, erro: alvo };
    if (b.params && Object.keys(b.params).length > 0) {
      return curvaHipotetica(ctx, alvo, b.params);
    }
    const curve = alvo.bruckner?.curve;
    if (!curve || !curve.length) {
      return { valor: null, erro: "cenário sem curva de Brückner" };
    }
    return { valor: curve, erro: null };
  }

  // computado/pacote/entradas com path que aponte para uma série
  const r = resolverValor(b, ctx);
  if (r.erro) return { valor: null, erro: r.erro };
  return serieValida(r.valor)
    ? { valor: r.valor as [number, number][], erro: null }
    : { valor: null, erro: `"${fontePath(b)}" não é uma série de pares [x,y]` };
}

function fontePath(b: Binding): string {
  return "path" in b ? `${b.fonte}.${b.path}` : b.fonte;
}

function resolverValor(b: Binding, ctx: Ctx): Resolvido<unknown> {
  switch (b.fonte) {
    case "computado": {
      const alvo = alvoComputado(ctx, b.cenario);
      if (typeof alvo === "string") return { valor: null, erro: alvo };
      const v = dotPath(alvo, b.path);
      return v === undefined
        ? { valor: null, erro: `path "computado.${b.path}" não existe` }
        : { valor: v, erro: null };
    }
    case "pacote": {
      const v = dotPath(ctx.pacote, b.path);
      return v === undefined
        ? { valor: null, erro: `path "pacote.${b.path}" não existe` }
        : { valor: v, erro: null };
    }
    case "entradas": {
      const v = dotPath(ctx.entradas, b.path);
      return v === undefined
        ? { valor: null, erro: `path "entradas.${b.path}" não existe` }
        : { valor: v, erro: null };
    }
    case "bruckner.curve":
      return { valor: null, erro: "bruckner.curve é uma série — use num bloco chart/overlay" };
    default:
      return { valor: null, erro: `fonte de binding desconhecida: ${(b as { fonte?: string }).fonte}` };
  }
}

export function resolverNumero(
  dado: Dado<number> | undefined,
  ctx: Ctx,
): Resolvido<number> {
  if (!dado || typeof dado !== "object") return { valor: null, erro: "sem valor" };
  if ("inline" in dado) {
    return typeof dado.inline === "number" && Number.isFinite(dado.inline)
      ? { valor: dado.inline, erro: null }
      : { valor: null, erro: "valor inline não é numérico" };
  }
  const b = dado.binding as Binding | undefined;
  if (!b || typeof b !== "object") return { valor: null, erro: "binding ausente" };
  const r = resolverValor(b, ctx);
  if (r.erro) return { valor: null, erro: r.erro };
  return typeof r.valor === "number" && Number.isFinite(r.valor)
    ? { valor: r.valor, erro: null }
    : { valor: null, erro: `"${fontePath(b)}" não é um número` };
}

/* ── Hooks ─────────────────────────────────────────────────── */

export function useNumeroResolvido(dado: Dado<number> | undefined): Resolvido<number> {
  const { pacote, binsMainline, entradas, casoBase, computados, ativo } = useEstudo();
  return useMemo(
    () => resolverNumero(dado, { pacote, binsMainline, entradas, casoBase, computados, ativo }),
    [dado, pacote, binsMainline, entradas, casoBase, computados, ativo],
  );
}

export function useSerieResolvida(
  dado: Dado<[number, number][]> | undefined,
): Resolvido<[number, number][]> {
  const { pacote, binsMainline, entradas, casoBase, computados, ativo } = useEstudo();
  return useMemo(
    () => resolverSerie(dado, { pacote, binsMainline, entradas, casoBase, computados, ativo }),
    [dado, pacote, binsMainline, entradas, casoBase, computados, ativo],
  );
}

/** Resolve várias séries de uma vez (blocos chart / overlays). */
export function useSeriesResolvidas(
  series: { id: string; dados: Dado<[number, number][]> }[],
): Map<string, Resolvido<[number, number][]>> {
  const { pacote, binsMainline, entradas, casoBase, computados, ativo } = useEstudo();
  return useMemo(() => {
    const ctx = { pacote, binsMainline, entradas, casoBase, computados, ativo };
    const out = new Map<string, Resolvido<[number, number][]>>();
    for (const s of series) out.set(s.id, resolverSerie(s.dados, ctx));
    return out;
  }, [series, pacote, binsMainline, entradas, casoBase, computados, ativo]);
}

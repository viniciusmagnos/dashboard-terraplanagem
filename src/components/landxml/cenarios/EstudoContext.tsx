/**
 * EstudoContext — estado do estudo de cenários do dashboard de
 * terraplenagem (nível projeto).
 *
 * - `entradas` (projeto): CFT, solo mole, % categorias e custos unitários —
 *   compartilhadas por todos os cenários.
 * - `cenarios` (N): parâmetros Brückner (fator, linha de distribuição,
 *   barreiras) + premissas econômicas, recomputados ao vivo com cache.
 * - Caso base: usa o bloco `bruckner` EMBUTIDO no pacote (sem recomputar) +
 *   `premissas_default` — é a referência dos deltas/economias.
 * - Persistência: localStorage `manta:landxml:estudo:{projetoId}` (v2), com
 *   migração automática do formato v1 (`manta:landxml:cenarios:{projetoId}`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { rebinBins, type BrucknerResult } from "../../../lib/bruckner";
import {
  calcularEconomia,
  computarCenario,
  custosDoPacote,
  premissasDoPacote,
  type BinSimples,
  type BrucknerParams,
  type CenarioComputado,
  type CenarioDef,
  type CustosUnitarios,
  type Economia,
  type EntradasProjeto,
  type EstudoPersistido,
  type PremissasCenario,
} from "../../../lib/cenario";
import {
  chaveVinculoEstudo,
  criarEstudo,
  listarEstudos,
  obterEstado,
  putEstado,
  type EstudoRole,
} from "../../../lib/estudo-api";
import type { MtpPacote } from "../../../lib/mtp";

const chaveEstudo = (projetoId: string) => `manta:landxml:estudo:${projetoId}`;
const chaveCenariosV1 = (projetoId: string) =>
  `manta:landxml:cenarios:${projetoId}`;

/** Estado da sincronização com o store server-side (backend landxml). */
export type SyncStatus = "boot" | "ok" | "offline";

/** Formato v1 (SimuladorBruckner legado) — só para migração. */
interface CenarioSalvoV1 {
  id: string;
  nome: string;
  criadoEm: string;
  params: {
    fillFactor: number;
    baseline: "start" | "median";
    barriers: number[];
    custoTransporte: number;
  };
}

function entradasDoPacote(pacote: MtpPacote): EntradasProjeto {
  return {
    cftBase: pacote.volumes_base.cftBase ?? null,
    soloMole: pacote.volumes_base.soloMole ?? null,
    soloMoleCompactado: pacote.volumes_base.soloMoleCompactado ?? null,
    pct3Cat: pacote.categorias.pct_3cat_default,
    pct2Cat: pacote.categorias.pct_2cat_default,
    custos: custosDoPacote(pacote),
    custosEditados: false,
  };
}

function casoBaseParams(pacote: MtpPacote): BrucknerParams {
  const p = pacote.bruckner?.params;
  return {
    fillFactor: p?.fill_factor ?? 1.0,
    baseline: p?.baseline === "median" ? "median" : "start",
    barreirasAtivas: p?.barriers ?? pacote.barreiras.map((b) => b.sta_m),
    barreirasExtras: [],
  };
}

function carregarEstado(pacote: MtpPacote): {
  estado: EstudoPersistido;
  migrouDeV1: boolean;
} {
  const projetoId = pacote.projeto.id;
  const fresco: EstudoPersistido = {
    v: 2,
    entradas: entradasDoPacote(pacote),
    cenarios: [],
    cenarioAtivoId: null,
  };
  try {
    const rawV2 = localStorage.getItem(chaveEstudo(projetoId));
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as EstudoPersistido;
      if (parsed?.v === 2 && Array.isArray(parsed.cenarios)) {
        // merge defensivo: campos novos de custos/premissas ganham default
        const base = entradasDoPacote(pacote);
        const entradas: EntradasProjeto = {
          ...base,
          ...parsed.entradas,
          custos: { ...base.custos, ...(parsed.entradas?.custos ?? {}) },
        };
        const premissasBase = premissasDoPacote(pacote);
        const cenarios = parsed.cenarios.map((c) => ({
          ...c,
          bruckner: {
            ...c.bruckner,
            barreirasExtras: c.bruckner.barreirasExtras ?? [],
          },
          premissas: { ...premissasBase, ...c.premissas },
        }));
        return {
          estado: {
            v: 2,
            entradas,
            cenarios,
            cenarioAtivoId: parsed.cenarioAtivoId ?? null,
          },
          migrouDeV1: false,
        };
      }
    }
  } catch {
    /* estado corrompido → recomeça */
  }
  // Migração v1 → v2
  try {
    const rawV1 = localStorage.getItem(chaveCenariosV1(projetoId));
    if (rawV1) {
      const antigos = JSON.parse(rawV1) as CenarioSalvoV1[];
      if (Array.isArray(antigos) && antigos.length) {
        const premissas = premissasDoPacote(pacote);
        const cenarios: CenarioDef[] = antigos.map((c) => ({
          id: c.id,
          nome: c.nome,
          criadoEm: c.criadoEm,
          bruckner: {
            fillFactor: c.params.fillFactor,
            baseline: c.params.baseline,
            barreirasAtivas: c.params.barriers,
            barreirasExtras: [],
          },
          premissas: { ...premissas },
        }));
        const entradas = entradasDoPacote(pacote);
        // custoTransporte era por cenário no v1; vira custo do projeto (o
        // último salvo ganha, quando difere do default do pacote).
        const ultimo = antigos[antigos.length - 1];
        if (
          Number.isFinite(ultimo.params.custoTransporte) &&
          ultimo.params.custoTransporte !== entradas.custos.transporte
        ) {
          entradas.custos = {
            ...entradas.custos,
            transporte: ultimo.params.custoTransporte,
          };
          entradas.custosEditados = true;
        }
        return {
          estado: { v: 2, entradas, cenarios, cenarioAtivoId: null },
          migrouDeV1: true,
        };
      }
    }
  } catch {
    /* v1 ilegível → ignora */
  }
  return { estado: fresco, migrouDeV1: false };
}

let _seq = 0;
const novoId = () => `cen-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

/* ── Contexto ─────────────────────────────────────────────── */

export interface EstudoContextValue {
  pacote: MtpPacote;
  binsMainline: BinSimples[];
  entradas: EntradasProjeto;
  atualizarEntradas: (patch: Partial<EntradasProjeto>) => void;
  atualizarCusto: (chave: keyof CustosUnitarios, valor: number) => void;
  restaurarCustos: () => void;

  cenarios: CenarioDef[];
  cenarioAtivoId: string | null; // null = caso base
  setCenarioAtivoId: (id: string | null) => void;
  criarCenario: (nome?: string, aPartirDeId?: string | null) => string;
  duplicarCenario: (id: string) => string;
  renomearCenario: (id: string, nome: string) => void;
  removerCenario: (id: string) => void;
  atualizarPremissas: (id: string, patch: Partial<PremissasCenario>) => void;
  atualizarBruckner: (id: string, patch: Partial<BrucknerParams>) => void;

  casoBase: CenarioComputado;
  computados: Map<string, CenarioComputado>;
  economias: Map<string, Economia>;
  /** Cenário ativo computado (caso base quando cenarioAtivoId = null). */
  ativo: CenarioComputado;
  ativoEconomia: Economia | null;

  /** Estudo server-side vinculado (null enquanto boot/offline). */
  estudoId: string | null;
  /** Papel do usuário no estudo — "editor" quando foi compartilhado com ele. */
  estudoRole: EstudoRole | null;
  syncStatus: SyncStatus;
  /** Puxa o estado do servidor (since_rev) — chamado após turno do agente. */
  recarregarDoServidor: () => Promise<void>;
}

const EstudoCtx = createContext<EstudoContextValue | null>(null);

export function EstudoProvider({
  pacote,
  children,
}: {
  pacote: MtpPacote;
  children: ReactNode;
}) {
  const [inicial] = useState(() => carregarEstado(pacote));
  const [entradas, setEntradas] = useState<EntradasProjeto>(
    inicial.estado.entradas,
  );
  const [cenarios, setCenarios] = useState<CenarioDef[]>(
    inicial.estado.cenarios,
  );
  const [cenarioAtivoId, setCenarioAtivoId] = useState<string | null>(
    inicial.estado.cenarioAtivoId,
  );
  const brucknerCache = useRef(new Map<string, BrucknerResult>());

  // ── Sync com o store server-side (backend landxml /api/estudos) ──
  const [estudoId, setEstudoId] = useState<string | null>(null);
  const [estudoRole, setEstudoRole] = useState<EstudoRole | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("boot");
  const revRef = useRef(0);
  // pula UM ciclo do push debounced quando o setState veio do servidor
  const adotandoRef = useRef(false);

  const adotarEstadoServidor = useCallback((estado: EstudoPersistido) => {
    adotandoRef.current = true;
    setEntradas(estado.entradas);
    setCenarios(estado.cenarios);
    setCenarioAtivoId(estado.cenarioAtivoId);
  }, []);

  // Bootstrap: adota o estudo existente (server-wins — o agente/MCP pode ter
  // mutado desde a última visita) ou cria um novo com o estado local. O
  // binding sticky (LS projeto → estudo_id) tem precedência: é o que mantém
  // um estudo COMPARTILHADO aberto no estudo do dono, e não num próprio.
  useEffect(() => {
    let vivo = true;
    const vincular = (id: string, role: EstudoRole | null) => {
      setEstudoId(id);
      setEstudoRole(role);
      try {
        localStorage.setItem(chaveVinculoEstudo(pacote.projeto.id), id);
      } catch {
        /* noop */
      }
    };
    void (async () => {
      try {
        // 1) binding sticky (estudo aberto anteriormente — próprio ou compartilhado)
        let sticky: string | null = null;
        try {
          sticky = localStorage.getItem(chaveVinculoEstudo(pacote.projeto.id));
        } catch {
          /* noop */
        }
        if (sticky) {
          try {
            const res = await obterEstado(sticky);
            if (!vivo) return;
            revRef.current = res.rev;
            if (res.estado) adotarEstadoServidor(res.estado);
            vincular(sticky, res.role ?? null);
            setSyncStatus("ok");
            return;
          } catch {
            // acesso revogado / estudo deletado → esquece o binding
            try {
              localStorage.removeItem(chaveVinculoEstudo(pacote.projeto.id));
            } catch {
              /* noop */
            }
          }
        }
        // 2) estudo existente do projeto (próprios vêm primeiro na lista)
        const lista = await listarEstudos(pacote.projeto.id);
        if (!vivo) return;
        if (lista.length > 0) {
          const meta = lista[0];
          const res = await obterEstado(meta.estudo_id);
          if (!vivo) return;
          revRef.current = res.rev;
          if (res.estado) adotarEstadoServidor(res.estado);
          vincular(meta.estudo_id, res.role ?? meta.role ?? null);
        } else {
          // 3) primeiro acesso → cria com o estado local
          const criado = await criarEstudo(JSON.stringify(pacote), {
            nome: pacote.projeto.nome,
            estado: inicial.estado,
          });
          if (!vivo) return;
          revRef.current = criado.rev;
          vincular(criado.estudo_id, "owner");
        }
        setSyncStatus("ok");
      } catch {
        // sem login / backend fora do ar → o estudo segue 100% local (LS)
        if (vivo) setSyncStatus("offline");
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacote.projeto.id]);

  const recarregarDoServidor = useCallback(async () => {
    if (!estudoId) return;
    try {
      const res = await obterEstado(estudoId, revRef.current);
      if (res.changed && res.estado) {
        revRef.current = res.rev;
        adotarEstadoServidor(res.estado);
      }
      if (res.role) setEstudoRole(res.role);
      setSyncStatus("ok");
    } catch {
      setSyncStatus("offline");
    }
  }, [estudoId, adotarEstadoServidor]);

  // Colaboração: estudos compartilhados podem ser mutados por outro usuário
  // (ou pelo agente/MCP) a qualquer momento — puxa o estado ao focar a janela
  // e num polling leve (since_rev responde {changed:false} barato).
  useEffect(() => {
    if (!estudoId) return;
    const aoFocar = () => void recarregarDoServidor();
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === "visible") void recarregarDoServidor();
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void recarregarDoServidor();
    }, 30_000);
    return () => {
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.clearInterval(t);
    };
  }, [estudoId, recarregarDoServidor]);

  // Remove a chave v1 depois que a migração persistir no formato novo.
  useEffect(() => {
    if (inicial.migrouDeV1) {
      try {
        localStorage.removeItem(chaveCenariosV1(pacote.projeto.id));
      } catch {
        /* noop */
      }
    }
  }, [inicial.migrouDeV1, pacote.projeto.id]);

  // Persistência debounced: localStorage (cache offline) + push ao servidor
  // com optimistic concurrency (409 → adota o estado do servidor).
  useEffect(() => {
    const veioDoServidor = adotandoRef.current;
    adotandoRef.current = false;
    const t = window.setTimeout(() => {
      const payload: EstudoPersistido = {
        v: 2,
        entradas,
        cenarios,
        cenarioAtivoId,
      };
      try {
        localStorage.setItem(
          chaveEstudo(pacote.projeto.id),
          JSON.stringify(payload),
        );
      } catch {
        /* quota — segue em memória */
      }
      if (estudoId && !veioDoServidor) {
        void (async () => {
          try {
            const res = await putEstado(estudoId, payload, revRef.current);
            if (res.conflict) {
              // agente/MCP escreveu no meio — server-wins
              revRef.current = res.rev;
              adotarEstadoServidor(res.estado);
            } else {
              revRef.current = res.rev;
            }
            setSyncStatus("ok");
          } catch {
            setSyncStatus("offline");
          }
        })();
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [
    entradas,
    cenarios,
    cenarioAtivoId,
    pacote.projeto.id,
    estudoId,
    adotarEstadoServidor,
  ]);

  const binsMainline = useMemo<BinSimples[]>(() => {
    const rodoviaIds = new Set(
      pacote.eixos.filter((e) => e.tipo === "rodovia").map((e) => e.id),
    );
    return rebinBins(
      pacote.bins.filter((b) => rodoviaIds.has(b.eixo_id)),
      pacote.bins_meta.largura_m,
    );
  }, [pacote]);

  const casoBaseDef = useMemo<CenarioDef>(
    () => ({
      id: "caso-base",
      nome: "Caso base",
      descricao: "Parâmetros e premissas do pacote (referência)",
      criadoEm: pacote.generated_at,
      bruckner: casoBaseParams(pacote),
      premissas: premissasDoPacote(pacote),
    }),
    [pacote],
  );

  const casoBase = useMemo(
    () =>
      computarCenario({
        pacote,
        binsMainline,
        entradas,
        def: casoBaseDef,
        brucknerPronto: pacote.bruckner ?? null,
      }),
    [pacote, binsMainline, entradas, casoBaseDef],
  );

  const computados = useMemo(() => {
    const out = new Map<string, CenarioComputado>();
    for (const def of cenarios) {
      out.set(
        def.id,
        computarCenario({
          pacote,
          binsMainline,
          entradas,
          def,
          cache: brucknerCache.current,
        }),
      );
    }
    return out;
  }, [pacote, binsMainline, entradas, cenarios]);

  const economias = useMemo(() => {
    const out = new Map<string, Economia>();
    for (const [id, comp] of computados) {
      out.set(
        id,
        calcularEconomia(
          casoBase.orcamento,
          comp.orcamento,
          casoBase.volumes,
          comp.volumesCalc,
          entradas.custos,
          comp.def.premissas,
        ),
      );
    }
    return out;
  }, [computados, casoBase, entradas.custos]);

  const ativo = cenarioAtivoId
    ? (computados.get(cenarioAtivoId) ?? casoBase)
    : casoBase;
  const ativoEconomia = cenarioAtivoId
    ? (economias.get(cenarioAtivoId) ?? null)
    : null;

  const value: EstudoContextValue = {
    pacote,
    binsMainline,
    entradas,
    atualizarEntradas: (patch) => setEntradas((e) => ({ ...e, ...patch })),
    atualizarCusto: (chave, valor) =>
      setEntradas((e) => ({
        ...e,
        custos: { ...e.custos, [chave]: valor },
        custosEditados: true,
      })),
    restaurarCustos: () =>
      setEntradas((e) => ({
        ...e,
        custos: custosDoPacote(pacote),
        custosEditados: false,
      })),

    cenarios,
    cenarioAtivoId,
    setCenarioAtivoId,
    criarCenario: (nome, aPartirDeId) => {
      const origem =
        (aPartirDeId && cenarios.find((c) => c.id === aPartirDeId)) ||
        (cenarioAtivoId && cenarios.find((c) => c.id === cenarioAtivoId)) ||
        casoBaseDef;
      const id = novoId();
      const def: CenarioDef = {
        id,
        nome: nome?.trim() || `Cenário ${cenarios.length + 1}`,
        criadoEm: new Date().toISOString(),
        bruckner: {
          ...origem.bruckner,
          barreirasAtivas: [...origem.bruckner.barreirasAtivas],
          barreirasExtras: origem.bruckner.barreirasExtras.map((b) => ({
            ...b,
          })),
        },
        premissas: { ...origem.premissas },
      };
      setCenarios((cs) => [...cs, def]);
      setCenarioAtivoId(id);
      return id;
    },
    duplicarCenario: (idOrigem) => {
      const origem = cenarios.find((c) => c.id === idOrigem);
      if (!origem) return idOrigem;
      const id = novoId();
      setCenarios((cs) => [
        ...cs,
        {
          ...origem,
          id,
          nome: `${origem.nome} (cópia)`,
          criadoEm: new Date().toISOString(),
          bruckner: {
            ...origem.bruckner,
            barreirasAtivas: [...origem.bruckner.barreirasAtivas],
            barreirasExtras: origem.bruckner.barreirasExtras.map((b) => ({
              ...b,
            })),
          },
          premissas: { ...origem.premissas },
        },
      ]);
      setCenarioAtivoId(id);
      return id;
    },
    renomearCenario: (id, nome) =>
      setCenarios((cs) =>
        cs.map((c) => (c.id === id ? { ...c, nome: nome.trim() || c.nome } : c)),
      ),
    removerCenario: (id) => {
      setCenarios((cs) => cs.filter((c) => c.id !== id));
      setCenarioAtivoId((cur) => (cur === id ? null : cur));
    },
    atualizarPremissas: (id, patch) =>
      setCenarios((cs) =>
        cs.map((c) =>
          c.id === id ? { ...c, premissas: { ...c.premissas, ...patch } } : c,
        ),
      ),
    atualizarBruckner: (id, patch) =>
      setCenarios((cs) =>
        cs.map((c) =>
          c.id === id ? { ...c, bruckner: { ...c.bruckner, ...patch } } : c,
        ),
      ),

    casoBase,
    computados,
    economias,
    ativo,
    ativoEconomia,

    estudoId,
    estudoRole,
    syncStatus,
    recarregarDoServidor,
  };

  return <EstudoCtx.Provider value={value}>{children}</EstudoCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEstudo(): EstudoContextValue {
  const ctx = useContext(EstudoCtx);
  if (!ctx) throw new Error("useEstudo fora do <EstudoProvider>");
  return ctx;
}

/**
 * Aba Prazo — simulador de produtividade e praticabilidade (modelo do
 * SimuladorTab da Motiva, 100% alimentado por inputs + volumes do cenário
 * ativo): produtividade por serviço × turnos × equipes × dias úteis
 * (praticabilidade climática mensal) → duração estimada.
 */
import { useEffect, useMemo, useState } from "react";
import { fmt } from "../../../lib/format";
import { KpiCard } from "../KpiCard";
import { ProvChip } from "../ProvChip";
import { useEstudo } from "./EstudoContext";

interface MesBase {
  mes: string;
  dias: number;
  chuvoso: boolean;
}

// Calendário-tipo (região SE — ajuste pela praticabilidade dos sliders)
const MESES: MesBase[] = [
  { mes: "Jan", dias: 31, chuvoso: true },
  { mes: "Fev", dias: 28, chuvoso: true },
  { mes: "Mar", dias: 31, chuvoso: true },
  { mes: "Abr", dias: 30, chuvoso: false },
  { mes: "Mai", dias: 31, chuvoso: false },
  { mes: "Jun", dias: 30, chuvoso: false },
  { mes: "Jul", dias: 31, chuvoso: false },
  { mes: "Ago", dias: 31, chuvoso: false },
  { mes: "Set", dias: 30, chuvoso: false },
  { mes: "Out", dias: 31, chuvoso: true },
  { mes: "Nov", dias: 30, chuvoso: true },
  { mes: "Dez", dias: 31, chuvoso: true },
];

interface ServicoDef {
  id: string;
  rotulo: string;
  unidade: string;
  produtividade: number; // unid/dia por equipe, 1 turno
  equipes: number;
  incluir: boolean;
}

interface PrazoParams {
  v: 1;
  turnos: number;
  diasSemanais: number;
  pratChuvoso: number; // %
  pratSeco: number; // %
  servicos: ServicoDef[];
  modo: "paralelo" | "sequencial";
}

const chavePrazo = (projetoId: string) => `manta:landxml:prazo:${projetoId}`;

function defaultServicos(): ServicoDef[] {
  return [
    {
      id: "escavacao",
      rotulo: "Terraplenagem — escavação + transporte",
      unidade: "m³",
      produtividade: 2500,
      equipes: 1,
      incluir: true,
    },
    {
      id: "aterro",
      rotulo: "Aterro — espalhamento + compactação",
      unidade: "m³c",
      produtividade: 2500,
      equipes: 1,
      incluir: true,
    },
    {
      id: "pavimento",
      rotulo: "Pavimentação (volume)",
      unidade: "m³",
      produtividade: 1500,
      equipes: 1,
      incluir: false,
    },
  ];
}

function defaultParams(): PrazoParams {
  return {
    v: 1,
    turnos: 1,
    diasSemanais: 6,
    pratChuvoso: 40,
    pratSeco: 90,
    servicos: defaultServicos(),
    modo: "paralelo",
  };
}

function carregarParams(projetoId: string): PrazoParams {
  try {
    const raw = localStorage.getItem(chavePrazo(projetoId));
    if (raw) {
      const p = JSON.parse(raw) as PrazoParams;
      if (p?.v === 1 && Array.isArray(p.servicos)) {
        const base = defaultParams();
        return {
          ...base,
          ...p,
          servicos: base.servicos.map(
            (s) => p.servicos.find((x) => x.id === s.id) ?? s,
          ),
        };
      }
    }
  } catch {
    /* recomeça */
  }
  return defaultParams();
}

export function PrazoTab() {
  const { pacote, ativo } = useEstudo();
  const [params, setParams] = useState<PrazoParams>(() =>
    carregarParams(pacote.projeto.id),
  );
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(chavePrazo(pacote.projeto.id), JSON.stringify(params));
      } catch {
        /* quota */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [params, pacote.projeto.id]);

  // Volumes do cenário ativo por serviço
  const vb = ativo.volumes;
  const vc = ativo.volumesCalc;
  const volumes: Record<string, number> = useMemo(
    () => ({
      escavacao: vb.corteTotal + vc.jazidaTotal + vb.soloMole,
      aterro: vb.aterroFc + vc.cftVolume + vb.soloMoleCompactado,
      pavimento: pacote.volumes_base.pavimento ?? 0,
    }),
    [vb, vc, pacote.volumes_base.pavimento],
  );

  // Praticabilidade mensal → dias úteis
  const meses = useMemo(
    () =>
      MESES.map((m) => {
        const prat = m.chuvoso ? params.pratChuvoso : params.pratSeco;
        return {
          ...m,
          prat,
          diasUteis: Math.round(((m.dias * prat) / 100) * (params.diasSemanais / 7)),
        };
      }),
    [params.pratChuvoso, params.pratSeco, params.diasSemanais],
  );
  const diasUteisAno = meses.reduce((a, m) => a + m.diasUteis, 0);
  const pratMedia =
    (meses.reduce((a, m) => a + m.diasUteis, 0) /
      meses.reduce((a, m) => a + m.dias, 0)) *
    100;

  // Duração por serviço
  const linhas = useMemo(
    () =>
      params.servicos
        .filter((s) => s.incluir && (volumes[s.id] ?? 0) > 0)
        .map((s) => {
          const volume = volumes[s.id] ?? 0;
          const porDia = s.produtividade * params.turnos * s.equipes;
          const porAno = porDia * diasUteisAno;
          const meses_ = porAno > 0 ? (volume / porAno) * 12 : Infinity;
          return { ...s, volume, porDia, porAno, meses: meses_ };
        }),
    [params.servicos, params.turnos, volumes, diasUteisAno],
  );
  const prazoMeses = linhas.length
    ? params.modo === "paralelo"
      ? Math.max(...linhas.map((l) => l.meses))
      : linhas.reduce((a, l) => a + l.meses, 0)
    : 0;

  const setServico = (id: string, patch: Partial<ServicoDef>) =>
    setParams((p) => ({
      ...p,
      servicos: p.servicos.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ProvChip prov="default" />
        Produtividades, turnos e praticabilidade são premissas suas — os
        volumes vêm do cenário ativo ({ativo.def.nome}).
      </div>

      {/* Parâmetros gerais */}
      <div className="bg-surface border border-border rounded-lg p-4 grid gap-5 md:grid-cols-4">
        <div>
          <label className="text-sm font-medium">
            Turnos: {params.turnos} ({params.turnos * 8}h/dia)
          </label>
          <input
            type="range"
            min={1}
            max={3}
            step={1}
            value={params.turnos}
            onChange={(e) => setParams((p) => ({ ...p, turnos: Number(e.target.value) }))}
            className="w-full mt-2 accent-manta"
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            Dias por semana: {params.diasSemanais}
          </label>
          <input
            type="range"
            min={5}
            max={7}
            step={1}
            value={params.diasSemanais}
            onChange={(e) =>
              setParams((p) => ({ ...p, diasSemanais: Number(e.target.value) }))
            }
            className="w-full mt-2 accent-manta"
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            Praticabilidade meses chuvosos: {params.pratChuvoso}%
          </label>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={params.pratChuvoso}
            onChange={(e) =>
              setParams((p) => ({ ...p, pratChuvoso: Number(e.target.value) }))
            }
            className="w-full mt-2 accent-amber-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            Praticabilidade meses secos: {params.pratSeco}%
          </label>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={params.pratSeco}
            onChange={(e) =>
              setParams((p) => ({ ...p, pratSeco: Number(e.target.value) }))
            }
            className="w-full mt-2 accent-amber-500"
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard rotulo="Dias úteis por ano" valor={diasUteisAno} sufixo="dias" />
        <KpiCard
          rotulo="Praticabilidade média"
          valor={pratMedia}
          formato={(v) => `${fmt(v, 0)}%`}
        />
        <KpiCard
          rotulo={`Prazo estimado (${params.modo})`}
          valor={prazoMeses}
          formato={(v) => `${fmt(v, 1)} meses`}
          rodape={prazoMeses > 0 ? `≈ ${fmt(prazoMeses / 12, 1)} anos` : undefined}
        />
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Frentes de serviço</p>
          <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={params.modo === "paralelo"}
              onChange={() => setParams((p) => ({ ...p, modo: "paralelo" }))}
              className="accent-manta"
            />
            paralelas (prazo = maior serviço)
          </label>
          <label className="flex items-center gap-2 mt-1 text-sm cursor-pointer">
            <input
              type="radio"
              checked={params.modo === "sequencial"}
              onChange={() => setParams((p) => ({ ...p, modo: "sequencial" }))}
              className="accent-manta"
            />
            sequenciais (prazo = soma)
          </label>
        </div>
      </div>

      {/* Serviços */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
          Serviços — produtividade e equipes
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2 text-right">Volume</th>
                <th className="px-3 py-2 text-right">Produtiv. (un/dia·equipe)</th>
                <th className="px-3 py-2 text-right">Equipes</th>
                <th className="px-3 py-2 text-right">Produção/dia</th>
                <th className="px-3 py-2 text-right">Produção/ano</th>
                <th className="px-3 py-2 text-right">Duração</th>
              </tr>
            </thead>
            <tbody>
              {params.servicos.map((s) => {
                const l = linhas.find((x) => x.id === s.id);
                const volume = volumes[s.id] ?? 0;
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.incluir}
                          onChange={(e) => setServico(s.id, { incluir: e.target.checked })}
                          className="accent-manta"
                        />
                        {s.rotulo}
                      </label>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(volume)} {s.unidade}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        step={100}
                        value={s.produtividade}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n > 0)
                            setServico(s.id, { produtividade: n });
                        }}
                        className="w-24 bg-background border border-border rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        step={1}
                        value={s.equipes}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isFinite(n) && n >= 1)
                            setServico(s.id, { equipes: Math.round(n) });
                        }}
                        className="w-16 bg-background border border-border rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l ? fmt(l.porDia) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {l ? fmt(l.porAno) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {l ? `${fmt(l.meses, 1)} meses` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Praticabilidade mensal */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border text-sm font-medium">
          Dias úteis por mês (praticabilidade climática)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead>
              <tr className="text-xs text-muted-foreground">
                {meses.map((m) => (
                  <th key={m.mes} className="px-2 py-2">{m.mes}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {meses.map((m) => (
                  <td
                    key={m.mes}
                    className="px-2 py-2 tabular-nums"
                    style={{
                      background: `color-mix(in srgb, ${m.chuvoso ? "#f59e0b" : "#22c55e"} ${Math.round(m.prat / 2.2)}%, transparent)`,
                    }}
                    title={`${m.prat}% de praticabilidade`}
                  >
                    {m.diasUteis}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-muted-foreground">
          dias úteis = dias do mês × praticabilidade × (dias/semana ÷ 7). Âmbar
          = meses chuvosos, verde = secos (calendário-tipo região SE).
        </p>
      </div>
    </div>
  );
}

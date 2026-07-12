/**
 * Chip de proveniência de dado (extraído do projeto / calculado / entrada
 * manual / premissa editável / exemplo) — usado em KPIs, tabelas e painéis
 * do dashboard de terraplenagem.
 */
import { provenanceDe, type MtpPacote, type Provenance } from "../../lib/mtp";

export const PROV_ESTILO: Record<
  Provenance,
  { rotulo: string; classe: string }
> = {
  extracted: {
    rotulo: "dados do projeto",
    classe: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  computed: {
    rotulo: "calculado",
    classe: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  },
  manual: {
    rotulo: "entrada manual",
    classe: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  default: {
    rotulo: "premissa editável",
    classe: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  example: {
    rotulo: "dados de exemplo",
    classe: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  },
};

export function ProvChip({
  pacote,
  bloco,
  prov,
}: {
  pacote?: MtpPacote | null;
  bloco?: string;
  /** Proveniência direta (vence a consulta ao pacote) — ex.: custos editados. */
  prov?: Provenance;
}) {
  const p = prov ?? provenanceDe(pacote ?? null, bloco ?? "");
  const cfg = PROV_ESTILO[p];
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${cfg.classe}`}
    >
      {cfg.rotulo}
    </span>
  );
}

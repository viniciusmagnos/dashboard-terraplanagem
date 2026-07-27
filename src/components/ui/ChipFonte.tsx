// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Chip de proveniência CLICÁVEL: mesma aparência do `ProvChip` vendorado
// (paleta reaproveitada de PROV_ESTILO), mas abre um painel com a LINHAGEM do
// dado — arquivo-fonte, entidade LandXML, transformação, escopo e ressalvas.
//
// Drop-in: aceita as mesmas props do ProvChip (`pacote`, `bloco`, `prov`).
// Quando `prov` é passado junto com `bloco`, a classe exibida vem de `prov` e a
// ficha de linhagem vem do catálogo de `bloco`.
import { useRef, useState, type ReactNode } from "react";
import { linhagemDe } from "../../lib/linhagem";
import type { MtpPacote, Provenance } from "../../lib/mtp";
import { PROV_ESTILO } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { PainelLinhagem, Popover } from "./PainelLinhagem";

/** Resolve a linhagem e o rótulo, respeitando um `prov` explícito. */
function useLinhagem(
  pacoteProp: MtpPacote | null | undefined,
  bloco: string | undefined,
  provProp: Provenance | undefined,
) {
  const { pacote: pacoteCtx } = useEstudo();
  const pacote = pacoteProp ?? pacoteCtx;
  const base = linhagemDe(pacote, bloco ?? "");
  return provProp ? { ...base, prov: provProp } : base;
}

/** Bloco reservado no `provenance` mas ausente do pacote — não é "exemplo". */
const SEM_DADO = {
  rotulo: "sem dado no pacote",
  classe: "bg-muted/30 text-muted-foreground border-border border-dashed",
};

export function ChipFonte({
  pacote,
  bloco,
  prov,
}: {
  pacote?: MtpPacote | null;
  /** Chave de proveniência (ex.: "volumes_base.corteTotal", "bruckner"). */
  bloco?: string;
  /** Proveniência explícita — vence a consulta ao pacote (igual ao ProvChip). */
  prov?: Provenance;
}) {
  const linhagem = useLinhagem(pacote, bloco, prov);
  // Sem `prov` explícito e sem o bloco no pacote, o rótulo de classe mentiria
  // ("dados de exemplo" ao lado de um painel vazio) — dizemos o que é.
  const cfg =
    prov == null && bloco && linhagem.situacao === "ausente"
      ? SEM_DADO
      : PROV_ESTILO[linhagem.prov];
  const ref = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        title="De onde vem este dado"
        className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap cursor-help transition-opacity hover:opacity-80 ${cfg.classe}`}
      >
        {cfg.rotulo}
      </button>
      <Popover ancora={ref.current} aberto={aberto} onFechar={() => setAberto(false)}>
        <PainelLinhagem linhagem={linhagem} />
      </Popover>
    </>
  );
}

/**
 * Envolve um valor exibido (número, texto) com o mesmo painel de linhagem, sem
 * ocupar espaço com um chip. Sublinhado pontilhado sinaliza que é clicável.
 */
export function ValorComFonte({
  bloco,
  prov,
  pacote,
  children,
}: {
  bloco?: string;
  prov?: Provenance;
  pacote?: MtpPacote | null;
  children: ReactNode;
}) {
  const linhagem = useLinhagem(pacote, bloco, prov);
  const ref = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        title="De onde vem este dado"
        className="cursor-help underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 hover:decoration-manta"
      >
        {children}
      </button>
      <Popover ancora={ref.current} aberto={aberto} onFechar={() => setAberto(false)}>
        <PainelLinhagem linhagem={linhagem} />
      </Popover>
    </>
  );
}

// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Popover ancorado (em portal, para não ser cortado por `overflow-hidden` dos
// cards nem pelo scroll horizontal das tabelas) + o painel de LINHAGEM que ele
// mostra: de onde vem aquele dado, com que transformação e sob que ressalva.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, FileCode2, FunctionSquare, Ruler } from "lucide-react";
import { ORIGEM_ROTULO, type LinhagemResolvida } from "../../lib/linhagem";
import { PROV_ESTILO } from "../landxml/ProvChip";
import { useNavegacao, subExiste } from "../shell/NavegacaoContext";

/* ── Popover ──────────────────────────────────────────────── */

const MARGEM = 8;

export function Popover({
  ancora,
  aberto,
  onFechar,
  largura = 340,
  children,
}: {
  ancora: HTMLElement | null;
  aberto: boolean;
  onFechar: () => void;
  largura?: number;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const reposicionar = useCallback(() => {
    if (!ancora) return;
    const r = ancora.getBoundingClientRect();
    const w = Math.min(largura, window.innerWidth - 2 * MARGEM);
    // Alinha à direita da âncora e recua para dentro da viewport.
    let left = r.right - w;
    left = Math.min(Math.max(left, MARGEM), window.innerWidth - w - MARGEM);
    // Abre abaixo; se não couber, abre acima.
    const abaixo = r.bottom + 6;
    const top = abaixo + 240 > window.innerHeight ? undefined : abaixo;
    setPos({ top: top ?? Math.max(MARGEM, r.top - 6 - 240), left });
  }, [ancora, largura]);

  useLayoutEffect(() => {
    if (aberto) reposicionar();
  }, [aberto, reposicionar]);

  useEffect(() => {
    if (!aberto) return;
    const fecharEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    const foraDaqui = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ancora?.contains(t)) return;
      if ((t as HTMLElement)?.closest?.("[data-popover-linhagem]")) return;
      onFechar();
    };
    window.addEventListener("keydown", fecharEsc);
    window.addEventListener("mousedown", foraDaqui);
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      window.removeEventListener("keydown", fecharEsc);
      window.removeEventListener("mousedown", foraDaqui);
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto, ancora, onFechar, reposicionar]);

  if (!aberto || !pos) return null;

  return createPortal(
    <div
      data-popover-linhagem
      role="dialog"
      aria-label="De onde vem este dado"
      className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl p-3 text-left"
      style={{
        top: pos.top,
        left: pos.left,
        width: Math.min(largura, window.innerWidth - 2 * MARGEM),
        maxHeight: "min(70vh, 460px)",
        overflowY: "auto",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ── Painel de linhagem ───────────────────────────────────── */

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Linha({
  icon: Icon,
  termo,
  children,
}: {
  icon?: typeof Ruler;
  termo: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon size={11} /> : null}
        {termo}
      </p>
      <div className="text-xs text-foreground mt-0.5 leading-relaxed">{children}</div>
    </div>
  );
}

export function PainelLinhagem({ linhagem }: { linhagem: LinhagemResolvida }) {
  const { chave, campo, prov, arquivos, avisos, valor } = linhagem;
  const nav = useNavegacao();
  const estilo = PROV_ESTILO[prov];
  const podeIr = nav != null && subExiste("rastreabilidade");

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {campo?.rotulo ?? chave}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground truncate">
            {chave}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${estilo.classe}`}
        >
          {estilo.rotulo}
          {linhagem.provInferida ? "*" : ""}
        </span>
      </div>

      {linhagem.provInferida ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
          * O pacote não declara proveniência para esta chave — a classe foi
          deduzida do catálogo pelo tipo de origem, não afirmada pelo pacote.
        </p>
      ) : null}

      {valor ? (
        <p className="mt-2 text-xs tabular-nums text-foreground">{valor}</p>
      ) : null}

      {linhagem.situacao === "ausente" ? (
        <div className="mt-2 rounded border border-dashed border-border bg-muted/20 p-2">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            O pacote <strong>reserva</strong> a chave{" "}
            <code className="font-mono">{chave.split(".")[0]}</code> com
            proveniência <code className="font-mono">{prov}</code>, mas{" "}
            <strong>não traz o bloco de dado</strong>. Nada deste tipo está no
            estudo — o painel correspondente fica vazio de propósito.
          </p>
        </div>
      ) : null}

      {campo ? (
        <>
          <Linha icon={FileCode2} termo={ORIGEM_ROTULO[campo.origemTipo]}>
            {campo.origem}
          </Linha>
          <Linha icon={FunctionSquare} termo="Como é obtido">
            {campo.transformacao}
          </Linha>
          {campo.escopo ? (
            <Linha icon={Ruler} termo="Escopo">
              {campo.escopo}
            </Linha>
          ) : null}
          {campo.aoVivo ? (
            <p className="mt-2 text-[11px] text-cyan-400">
              Recalculado no navegador — muda com as premissas e o cenário ativo.
            </p>
          ) : null}
          {campo.caveat ? (
            <div className="mt-2.5 flex gap-1.5 rounded border border-warning/40 bg-warning/5 p-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5 text-warning" />
              <p className="text-[11px] leading-relaxed text-warning">
                {campo.caveat}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Este dado não tem ficha no catálogo de linhagem — a classe acima vem do
          mapa de proveniência do pacote.
        </p>
      )}

      {avisos.length > 0 ? (
        <Linha icon={AlertTriangle} termo="Avisos do processamento">
          <ul className="space-y-0.5 text-warning">
            {avisos.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </Linha>
      ) : null}

      {arquivos.length > 0 ? (
        <Linha termo={`Arquivos-fonte do pacote (${arquivos.length})`}>
          <ul className="space-y-0.5 text-muted-foreground">
            {arquivos.slice(0, 3).map((a, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate font-mono text-[10px]">{a.filename}</span>
                <span className="shrink-0 text-[10px]">{fmtBytes(a.size_bytes)}</span>
              </li>
            ))}
            {arquivos.length > 3 ? (
              <li className="text-[10px]">
                + {arquivos.length - 3} arquivo(s)
              </li>
            ) : null}
          </ul>
        </Linha>
      ) : null}

      <div className="mt-3 pt-2 border-t border-border">
        {podeIr ? (
          <button
            onClick={() => nav!.irParaSub("rastreabilidade")}
            className="text-[11px] text-manta hover:underline"
          >
            Ver o catálogo completo em Rastreabilidade →
          </button>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Catálogo completo em Relatório → Rastreabilidade.
          </p>
        )}
      </div>
    </>
  );
}

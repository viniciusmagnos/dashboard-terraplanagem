/**
 * GeometriaTab — aba "3D do corredor" (carregada via lazy import: o three.js
 * só entra no bundle quando o usuário abre a aba). Sincroniza a estação com
 * a aba Seções e usa o alargamento % do cenário ativo como overlay.
 */
import { useMemo } from "react";
import type { MtpBarreira, MtpPacote } from "../../../lib/mtp";
import { useEstudo } from "../cenarios/EstudoContext";
import CorredorViewer3D from "./CorredorViewer3D";
import type { GeoSel } from "./SecoesTab";
import { staToKmLabel } from "../../../lib/mtp";

export default function GeometriaTab({
  pacote,
  sel,
  onSel,
}: {
  pacote: MtpPacote;
  sel: GeoSel;
  onSel: (s: GeoSel) => void;
}) {
  const { ativo } = useEstudo();
  const alargamentoPct = ativo.def.premissas.alargamentoCortePercent;

  const barreirasVisiveis: MtpBarreira[] = useMemo(
    () => [
      ...pacote.barreiras.filter((b) =>
        ativo.def.bruckner.barreirasAtivas.includes(b.sta_m),
      ),
      ...ativo.def.bruckner.barreirasExtras.map((b) => ({
        sta_m: b.sta_m,
        nome: b.nome,
        tipo: "manual",
      })),
    ],
    [pacote.barreiras, ativo.def.bruckner],
  );

  if (!pacote.geometria) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-2">
        <p className="text-sm font-medium">Este pacote não contém geometria</p>
        <p className="text-xs text-muted-foreground max-w-lg mx-auto">
          Regere o pacote marcando "Incluir geometria (seções e 3D)" no upload
          — ou pela CLI com a flag <code>--geometria</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CorredorViewer3D
        pacote={pacote}
        sel={sel}
        onSel={onSel}
        alargamentoPct={alargamentoPct}
        barreiras={barreirasVisiveis}
      />
      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
        <span>
          Plataforma colorida por <span className="text-orange-400">corte</span>{" "}
          / <span className="text-emerald-400">aterro</span> (intensidade ∝
          profundidade). Terreno = fita cinza na largura amostrada das seções.
        </span>
        <span>
          {sel.sta != null && sel.eixoId
            ? `estação ativa: ${sel.eixoId} · ${staToKmLabel(sel.sta)}`
            : "clique no corredor ou use a aba Seções para escolher a estaca"}
          {alargamentoPct > 0 &&
            ` · alargamento do cenário ativo: ${Math.round(alargamentoPct * 100)}%`}
        </span>
      </div>
    </div>
  );
}

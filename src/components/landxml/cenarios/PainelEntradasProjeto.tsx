/**
 * Entradas de nível PROJETO (compartilhadas por todos os cenários):
 * CFT base, solo mole, % de categorias de corte e a grade dos 11 custos
 * unitários (SICRO default editável).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { fmt } from "../../../lib/format";
import { CUSTOS_REFERENCIA, type CustosUnitarios } from "../../../lib/cenario";
import { ProvChip } from "../ProvChip";
import { useEstudo } from "./EstudoContext";

const ROTULOS_CUSTOS: Record<keyof CustosUnitarios, string> = {
  escavacao12: "Escavação 1ª/2ª cat (R$/m³)",
  escavacao3: "Escavação 3ª cat — rocha (R$/m³)",
  escavacaoCFT: "Escavação CFT (R$/m³)",
  escavacaoSoloMole: "Escavação solo mole (R$/m³)",
  escavacaoJazida: "Escavação jazida (R$/m³)",
  transporte: "Transporte (R$/m³·km)",
  compactacaoAterro: "Compactação aterro (R$/m³c)",
  compactacaoCFT: "Compactação CFT (R$/m³c)",
  compactacaoSoloMole: "Compactação solo mole (R$/m³c)",
  royalty: "Royalty fora da faixa (R$/m³)",
  conformacaoBF: "Conformação bota-fora (R$/m³)",
};

function InputNulavel({
  valor,
  onChange,
  placeholder,
  sufixo = "m³",
}: {
  valor: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  sufixo?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={valor ?? ""}
        placeholder={placeholder ?? "não extraído"}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {sufixo}
      </span>
    </div>
  );
}

export function PainelEntradasProjeto() {
  const { pacote, entradas, atualizarEntradas, atualizarCusto, restaurarCustos } =
    useEstudo();
  const [aberto, setAberto] = useState(false);
  const corte3Derivado = Math.round(
    pacote.volumes_base.corteTotal * entradas.pct3Cat,
  );

  return (
    <div className="bg-surface border border-border rounded-lg">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium"
      >
        {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        Entradas do projeto (CFT, solo mole, categorias e custos)
        <span className="ml-auto flex items-center gap-1.5">
          <ProvChip
            pacote={pacote}
            prov={entradas.custosEditados ? "manual" : undefined}
            bloco="custos"
          />
        </span>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Valem para o caso base e para TODOS os cenários. Campos vazios não
            entram no orçamento (as linhas somem).
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">
                CFT base — camada final (m³)
              </label>
              <InputNulavel
                valor={entradas.cftBase}
                onChange={(v) => atualizarEntradas({ cftBase: v })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Solo mole — remoção (m³)
              </label>
              <InputNulavel
                valor={entradas.soloMole}
                onChange={(v) => atualizarEntradas({ soloMole: v })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Solo mole compactado (m³c)
              </label>
              <InputNulavel
                valor={entradas.soloMoleCompactado}
                onChange={(v) => atualizarEntradas({ soloMoleCompactado: v })}
                placeholder={
                  entradas.soloMole != null
                    ? `auto: ${fmt(Math.round(entradas.soloMole * 1.25))}`
                    : "auto: solo mole × 1,25"
                }
                sufixo="m³c"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">
                Corte em 3ª categoria — rocha (%)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(entradas.pct3Cat * 100)}
                  onChange={(e) =>
                    atualizarEntradas({
                      pct3Cat: Math.max(0, Number(e.target.value) || 0) / 100,
                    })
                  }
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ≈ {fmt(corte3Derivado)} m³ do corte total
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Corte em 2ª categoria (%)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(entradas.pct2Cat * 100)}
                  onChange={(e) =>
                    atualizarEntradas({
                      pct2Cat: Math.max(0, Number(e.target.value) || 0) / 100,
                    })
                  }
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                modo: {pacote.categorias.modo}{" "}
                <ProvChip pacote={pacote} bloco="categorias" />
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium">
                Custos unitários{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({CUSTOS_REFERENCIA} — editáveis)
                </span>
              </p>
              <button
                onClick={restaurarCustos}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-surface-hover transition-colors"
                title="Restaurar tabela do pacote/SICRO"
              >
                <RotateCcw size={12} /> Restaurar
              </button>
            </div>
            <div className="grid gap-x-3 gap-y-2 md:grid-cols-3 sm:grid-cols-2">
              {(Object.keys(ROTULOS_CUSTOS) as (keyof CustosUnitarios)[]).map(
                (k) => (
                  <div key={k}>
                    <label className="text-[11px] text-muted-foreground">
                      {ROTULOS_CUSTOS[k]}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.05}
                      value={entradas.custos[k]}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) atualizarCusto(k, n);
                      }}
                      className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

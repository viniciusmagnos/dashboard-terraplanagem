/**
 * Parâmetros FÍSICOS do cenário ativo (camada Brückner): fator de
 * homogeneização, linha de distribuição (início/mediana), barreiras do
 * pacote (liga/desliga) e barreiras extras manuais.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { staToKmLabel } from "../../../lib/mtp";
import { useEstudo } from "./EstudoContext";

function parseBarreiraExtra(texto: string): { sta_m: number; nome: string } | null {
  const t = texto.trim();
  if (!t) return null;
  const [sta, ...resto] = t.split(":");
  const v = Number(sta.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(v) || v < 0) return null;
  return { sta_m: v, nome: resto.join(":").trim() || "barreira manual" };
}

export function PainelParametrosBruckner() {
  const { pacote, cenarioAtivoId, ativo, atualizarBruckner } = useEstudo();
  const [novaBarreira, setNovaBarreira] = useState("");
  const editavel = cenarioAtivoId != null;
  const params = ativo.def.bruckner;

  const set = (patch: Parameters<typeof atualizarBruckner>[1]) => {
    if (cenarioAtivoId) atualizarBruckner(cenarioAtivoId, patch);
  };

  const toggleBarreira = (staM: number, ligada: boolean) => {
    const ativas = new Set(params.barreirasAtivas);
    if (ligada) ativas.add(staM);
    else ativas.delete(staM);
    set({ barreirasAtivas: [...ativas].sort((a, b) => a - b) });
  };

  const adicionarExtra = () => {
    const b = parseBarreiraExtra(novaBarreira);
    if (!b) return;
    set({ barreirasExtras: [...params.barreirasExtras, b] });
    setNovaBarreira("");
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <p className="text-sm font-medium">Parâmetros do Brückner (física)</p>
      {!editavel && (
        <p className="text-xs text-muted-foreground bg-background border border-border rounded px-3 py-2">
          O caso base é a referência (parâmetros do pacote). Crie um cenário
          para simular mudanças.
        </p>
      )}

      <div>
        <label className="text-sm">
          Fator de homogeneização: {params.fillFactor.toFixed(2)}
        </label>
        <input
          type="range"
          min={1.0}
          max={1.5}
          step={0.01}
          value={params.fillFactor}
          disabled={!editavel}
          onChange={(e) => set({ fillFactor: Number(e.target.value) })}
          className="w-full mt-1.5 accent-cyan-500 disabled:opacity-40"
        />
        <p className="text-xs text-muted-foreground">
          m³ de corte por 1 m³c de aterro (empolamento)
        </p>
      </div>

      <div>
        <label className="text-sm">Linha de distribuição</label>
        <label className="flex items-center gap-2 mt-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={params.baseline === "median"}
            disabled={!editavel}
            onChange={(e) =>
              set({ baseline: e.target.checked ? "median" : "start" })
            }
            className="accent-cyan-500"
          />
          {params.baseline === "median"
            ? "Mediana (mín. momento)"
            : "Início do segmento"}
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Mediana minimiza o momento, mas admite empréstimo/bota-fora nas duas
          pontas do segmento
        </p>
      </div>

      <div>
        <label className="text-sm">Barreiras (OAEs) — material não cruza</label>
        <div className="mt-1.5 space-y-1">
          {pacote.barreiras.length === 0 && params.barreirasExtras.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma no pacote</p>
          )}
          {pacote.barreiras.map((b) => (
            <label
              key={b.sta_m}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={params.barreirasAtivas.includes(b.sta_m)}
                disabled={!editavel}
                onChange={(e) => toggleBarreira(b.sta_m, e.target.checked)}
                className="accent-amber-500"
              />
              {b.nome || b.tipo || "barreira"} — {staToKmLabel(b.sta_m)}
            </label>
          ))}
          {params.barreirasExtras.map((b, i) => (
            <div key={`${b.sta_m}-${i}`} className="flex items-center gap-2 text-sm">
              <span className="w-3.5 h-3.5 rounded-sm bg-amber-500/30 border border-amber-500/60 shrink-0" />
              <span className="flex-1">
                {b.nome} — {staToKmLabel(b.sta_m)}
                <span className="text-[10px] text-amber-400 ml-1.5">manual</span>
              </span>
              {editavel && (
                <button
                  onClick={() =>
                    set({
                      barreirasExtras: params.barreirasExtras.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  className="text-muted-foreground hover:text-rose-400"
                  title="Remover barreira"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        {editavel && (
          <div className="flex items-center gap-2 mt-2">
            <input
              value={novaBarreira}
              onChange={(e) => setNovaBarreira(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionarExtra()}
              placeholder="estação em m — ex.: 595800:OAE Nova"
              className="flex-1 bg-background border border-border rounded px-2.5 py-1.5 text-xs"
            />
            <button
              onClick={adicionarExtra}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded hover:bg-surface-hover transition-colors"
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

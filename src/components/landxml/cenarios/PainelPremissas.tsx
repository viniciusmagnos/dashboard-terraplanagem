/**
 * Premissas ECONÔMICAS do cenário ativo (camada Motiva): CFT %, alargamentos
 * de corte/aterro (% do volume que vira jazida/BF NA FAIXA — sem royalty) e
 * DMTs de acesso além do eixo.
 */
import { fmt } from "../../../lib/format";
import { useNumericInput } from "../../../lib/useNumericInput";
import { useEstudo } from "./EstudoContext";

function InputKm({
  valor,
  onChange,
  disabled,
}: {
  valor: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const { inputProps } = useNumericInput(valor, onChange, 0);
  return (
    <div className="flex items-center gap-1.5">
      <input
        {...inputProps}
        type="number"
        step={0.25}
        min={0}
        disabled={disabled}
        className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-sm disabled:opacity-40"
      />
      <span className="text-xs text-muted-foreground">km</span>
    </div>
  );
}

function SliderPct({
  rotulo,
  valor,
  max = 50,
  onChange,
  disabled,
  detalhe,
}: {
  rotulo: string;
  valor: number; // fração 0–1
  max?: number; // % máximo do slider
  onChange: (fracao: number) => void;
  disabled?: boolean;
  detalhe?: string;
}) {
  const pct = Math.round(valor * 100);
  return (
    <div>
      <label className="text-sm">
        {rotulo}: <span className="font-medium">{pct}%</span>
      </label>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full mt-1.5 accent-amber-500 disabled:opacity-40"
      />
      {detalhe && <p className="text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

export function PainelPremissas() {
  const { cenarioAtivoId, ativo, atualizarPremissas } = useEstudo();
  const editavel = cenarioAtivoId != null;
  const pr = ativo.def.premissas;
  const vc = ativo.volumesCalc;
  const dmtRealKm =
    ativo.bruckner?.totals.dmt_medio_m != null
      ? ativo.bruckner.totals.dmt_medio_m / 1000
      : null;

  const set = (patch: Partial<typeof pr>) => {
    if (cenarioAtivoId) atualizarPremissas(cenarioAtivoId, patch);
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <p className="text-sm font-medium">Premissas econômicas</p>

      <SliderPct
        rotulo="Alargamento de corte → jazida na faixa"
        valor={pr.alargamentoCortePercent}
        onChange={(v) => set({ alargamentoCortePercent: v })}
        disabled={!editavel}
        detalhe={
          pr.alargamentoCortePercent > 0
            ? `disponível ${fmt(vc.alargamentoCorteDisponivel)} m³ · usado ${fmt(vc.jazidaNaFaixa)} m³ (sem royalty, CBR ≥ 5%)`
            : "% do corte total escavável a mais nos taludes, usado como jazida sem royalty (exige CBR ≥ 5%)"
        }
      />
      <SliderPct
        rotulo="Alargamento de aterro → bota-fora na faixa"
        valor={pr.alargamentoAterroPercent}
        onChange={(v) => set({ alargamentoAterroPercent: v })}
        disabled={!editavel}
        detalhe={
          pr.alargamentoAterroPercent > 0
            ? `disponível ${fmt(vc.alargamentoAterroDisponivel)} m³ · usado ${fmt(vc.bfNaFaixa)} m³ (sem royalty)`
            : "% do aterro alargável para receber bota-fora dentro da faixa de domínio"
        }
      />
      <SliderPct
        rotulo="CFT executada"
        valor={pr.cftPercent}
        max={100}
        onChange={(v) => set({ cftPercent: v })}
        disabled={!editavel}
        detalhe={
          ativo.volumes.cftBase > 0
            ? `volume: ${fmt(vc.cftVolume)} m³ de ${fmt(ativo.volumes.cftBase)} m³ base`
            : "sem efeito — informe o CFT base nas entradas do projeto"
        }
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-1">
        <div className="col-span-2">
          <label className="text-sm">DMT corte → aterro</label>
          <div className="flex items-center gap-2 mt-1">
            {ativo.momento.corteAterroFonte === "bruckner" ? (
              <p className="text-sm bg-background border border-border rounded px-2.5 py-1.5 flex-1 text-muted-foreground">
                DMT real (Brückner):{" "}
                <span className="text-cyan-400 font-medium">
                  {dmtRealKm != null ? `${fmt(dmtRealKm, 2)} km` : "—"}
                </span>{" "}
                — calculado da curva, não é premissa
              </p>
            ) : (
              <InputKm
                valor={pr.dmtCorteAterro}
                onChange={(v) => set({ dmtCorteAterro: v })}
                disabled={!editavel}
              />
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Acesso jazida na faixa
          </label>
          <InputKm
            valor={pr.dmtJazidaNaFaixa}
            onChange={(v) => set({ dmtJazidaNaFaixa: v })}
            disabled={!editavel}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Acesso jazida fora da faixa
          </label>
          <InputKm
            valor={pr.dmtJazidaForaFaixa}
            onChange={(v) => set({ dmtJazidaForaFaixa: v })}
            disabled={!editavel}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Acesso BF na faixa
          </label>
          <InputKm
            valor={pr.dmtBFNaFaixa}
            onChange={(v) => set({ dmtBFNaFaixa: v })}
            disabled={!editavel}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Acesso BF fora da faixa
          </label>
          <InputKm
            valor={pr.dmtBFForaFaixa}
            onChange={(v) => set({ dmtBFForaFaixa: v })}
            disabled={!editavel}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">DMT CFT</label>
          <InputKm
            valor={pr.dmtCFT}
            onChange={(v) => set({ dmtCFT: v })}
            disabled={!editavel}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">DMT solo mole</label>
          <InputKm
            valor={pr.dmtSoloMole}
            onChange={(v) => set({ dmtSoloMole: v })}
            disabled={!editavel}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Os DMTs de jazida/BF são distâncias de ACESSO além do eixo — o percurso
        dentro do eixo já está no momento de Brückner.
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border pt-2">
        <span className="text-amber-400">Como o alargamento economiza:</span>{" "}
        ele troca a ORIGEM do empréstimo (alargar o corte na faixa em vez de
        abrir jazida externa) — o volume escavado total não muda, então a
        linha "Escavação" fica igual. O ganho aparece no{" "}
        <span className="text-foreground">royalty</span> (só incide fora da
        faixa) e no <span className="text-foreground">transporte</span> (DMT
        0,75 km vs 7–10 km). Já o volume de empréstimo em si muda com a física:
        fator de homogeneização, linha de distribuição e barreiras.
      </p>
    </div>
  );
}

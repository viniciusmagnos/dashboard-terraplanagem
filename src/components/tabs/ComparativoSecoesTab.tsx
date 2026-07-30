import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ScanSearch, Scissors } from "lucide-react";
import { fmt } from "../../lib/format";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { comparativoSecoesDe, type CompSecaoEixo } from "../../lib/pacote-ext";

/** Conferência das áreas de seção do dashboard contra as do Civil 3D. */
export function ComparativoSecoesTab({
  accent,
  onIrParaSecao,
}: {
  accent: string;
  onIrParaSecao?: (sta: number, eixoId?: string) => void;
}) {
  const { pacote } = useEstudo();
  const comp = comparativoSecoesDe(pacote);
  const [eixoSel, setEixoSel] = useState<string | null>(null);
  const [incluirTrunc, setIncluirTrunc] = useState(true);

  const eixo: CompSecaoEixo | null = useMemo(() => {
    if (!comp) return null;
    return comp.eixos.find((e) => e.eixo_id === eixoSel) ?? comp.eixos[0];
  }, [comp, eixoSel]);

  if (!comp) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard
          accent={accent}
          icon={ScanSearch}
          titulo="Conferência Civil 3D"
        />
        <p className="text-sm text-muted-foreground">
          Este pacote não traz o bloco <code>comparativo_secoes</code>. Ele é
          gerado quando o projetista exporta o LandXML com as{" "}
          <em>sample lines</em> carregando as superfícies do corredor (terreno +
          DATUM) — sem elas não há referência do Civil 3D para comparar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={ScanSearch}
        titulo="Conferência Civil 3D"
        subtitulo={`${comp.eixos.length} eixo(s) com seções de referência · fonte: ${comp.fonte}`}
      />

      {comp.convencao && (
        <div className="bg-surface border border-border rounded-lg p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Convenção da referência: </strong>
          {comp.convencao}
        </div>
      )}

      {!!comp.avisos?.length && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
          {comp.avisos.map((a, i) => (
            <p key={i} className="text-sm flex gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{a}</span>
            </p>
          ))}
        </div>
      )}

      {/* Totais por eixo */}
      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 font-medium">Eixo</th>
              <th className="p-2 font-medium text-right">Corte ref. (m³)</th>
              <th className="p-2 font-medium text-right">Corte pacote (m³)</th>
              <th className="p-2 font-medium text-right">Δ corte</th>
              <th className="p-2 font-medium text-right">Aterro ref. (m³)</th>
              <th className="p-2 font-medium text-right">Aterro pacote (m³)</th>
              <th className="p-2 font-medium text-right">Δ aterro</th>
              <th className="p-2 font-medium text-right">Seções</th>
            </tr>
          </thead>
          <tbody>
            {comp.eixos.map((e) => (
              <tr
                key={e.eixo_id}
                onClick={() => setEixoSel(e.eixo_id)}
                className={`border-b border-border/50 cursor-pointer hover:bg-muted/40 ${
                  e.eixo_id === eixo?.eixo_id ? "bg-muted/60" : ""
                }`}
              >
                <td className="p-2 font-medium">{e.eixo_id}</td>
                <td className="p-2 text-right">{fmt(e.v_ref.corte)}</td>
                <td className="p-2 text-right">{fmt(e.v_dash.corte)}</td>
                <td className="p-2 text-right">
                  <Delta a={e.v_dash.corte} b={e.v_ref.corte} />
                </td>
                <td className="p-2 text-right">{fmt(e.v_ref.aterro)}</td>
                <td className="p-2 text-right">{fmt(e.v_dash.aterro)}</td>
                <td className="p-2 text-right">
                  <Delta a={e.v_dash.aterro} b={e.v_ref.aterro} />
                </td>
                <td className="p-2 text-right text-muted-foreground">
                  {e.n}
                  {e.n_trunc > 0 && (
                    <span title={`${e.n_trunc} seções truncadas pela sample line`}>
                      {" "}
                      · <Scissors size={11} className="inline -mt-0.5" />
                      {e.n_trunc}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Volumes TIN x TIN do próprio Civil 3D */}
      {!!comp.surf_volumes?.length && (
        <div className="bg-surface border border-border rounded-lg p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Corroboração — &lt;SurfVolumes&gt; do Civil 3D (TIN × TIN, método
            independente das seções)
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            {comp.surf_volumes.map((s) => (
              <span key={s.nome}>
                <strong>{s.nome}</strong>: corte {fmt(s.corte)} m³ · aterro{" "}
                {fmt(s.aterro)} m³
              </span>
            ))}
          </div>
        </div>
      )}

      {eixo && (
        <EixoDetalhe
          eixo={eixo}
          accent={accent}
          incluirTrunc={incluirTrunc}
          onToggleTrunc={() => setIncluirTrunc((v) => !v)}
          onIrParaSecao={onIrParaSecao}
        />
      )}
    </div>
  );
}

function Delta({ a, b }: { a: number; b: number }) {
  if (!b) return <span className="text-muted-foreground">—</span>;
  const d = a - b;
  const pct = (d / b) * 100;
  const cor =
    Math.abs(pct) < 1
      ? "text-muted-foreground"
      : pct < 0
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";
  return (
    <span className={cor}>
      {d > 0 ? "+" : ""}
      {fmt(d)} ({pct > 0 ? "+" : ""}
      {fmt(pct, 1)}%)
    </span>
  );
}

function EixoDetalhe({
  eixo,
  accent,
  incluirTrunc,
  onToggleTrunc,
  onIrParaSecao,
}: {
  eixo: CompSecaoEixo;
  accent: string;
  incluirTrunc: boolean;
  onToggleTrunc: () => void;
  onIrParaSecao?: (sta: number, eixoId?: string) => void;
}) {
  const linhas = useMemo(
    () => eixo.linhas.filter((l) => incluirTrunc || !l.trunc),
    [eixo, incluirTrunc],
  );

  const dados = useMemo(
    () =>
      linhas.map((l) => ({
        sta: l.sta,
        est: l.est,
        c_ref: l.c_ref,
        f_ref: -l.f_ref,
        dC: (l.vc_dash ?? 0) - (l.vc_ref ?? 0),
        dF: (l.vf_dash ?? 0) - (l.vf_ref ?? 0),
        trunc: l.trunc,
        extrap: l.extrap,
      })),
    [linhas],
  );

  // Piores desvios de volume, para a tabela.
  const piores = useMemo(() => {
    const comDelta = linhas
      .map((l) => ({
        l,
        dC: (l.vc_dash ?? 0) - (l.vc_ref ?? 0),
        dF: (l.vf_dash ?? 0) - (l.vf_ref ?? 0),
      }))
      .filter((r) => r.l.vc_dash != null || r.l.vf_dash != null);
    comDelta.sort(
      (a, b) => Math.abs(b.dC) + Math.abs(b.dF) - (Math.abs(a.dC) + Math.abs(a.dF)),
    );
    return comDelta.slice(0, 30);
  }, [linhas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{eixo.eixo_id} — estaca a estaca</h3>
        <div className="flex items-center gap-3 text-xs">
          {eixo.n_trunc > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirTrunc}
                onChange={onToggleTrunc}
              />
              incluir as {eixo.n_trunc} seções truncadas
            </label>
          )}
          {!!eixo.estacas_extrap.length && (
            <span className="text-muted-foreground">
              descartadas: {eixo.estacas_extrap.join(", ")}
            </span>
          )}
        </div>
      </div>

      {eixo.n_trunc > 0 && (
        <p className="text-xs text-muted-foreground flex gap-2">
          <Scissors size={13} className="shrink-0 mt-0.5" />
          <span>
            {eixo.n_trunc} de {eixo.n} seções têm o DATUM alcançando a borda do
            terreno amostrado — a <em>swath</em> da sample line cortou a seção
            antes do <em>offset</em> onde o talude encontra o terreno. Nessas
            estacas a área de referência está <strong>subestimada</strong>
            {eixo.frac_aterro_trunc != null &&
              ` (elas concentram ${fmt(eixo.frac_aterro_trunc * 100, 0)}% da área de aterro deste eixo)`}
            , portanto o Δ ali não mede erro do dashboard — e o dashboard{" "}
            <strong>deve</strong> ficar acima dela, porque reprojeta o talude do
            corredor até o terreno da TIN para recuperar o que a swath cortou.
          </span>
        </p>
      )}

      {eixo.v_ref_bruto &&
        eixo.v_ref_bruto.corte !== eixo.v_ref.corte && (
          <p className="text-xs text-muted-foreground">
            Referência sem descartar as extrapoladas: corte{" "}
            {fmt(eixo.v_ref_bruto.corte)} m³ (
            {fmt(eixo.v_ref_bruto.corte - eixo.v_ref.corte)} m³ vinham de{" "}
            {eixo.n_extrap} seção(ões) extrapolada(s)).
          </p>
        )}

      {/* Áreas de referência: corte acima do eixo, aterro abaixo */}
      <div className="bg-surface border border-border rounded-lg p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Áreas de referência (Civil 3D) — corte ↑ / aterro ↓, m²
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={dados} margin={{ top: 6, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="sta"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v) => fmt(v)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v) => fmt(v)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                fontSize: 12,
              }}
              formatter={(v, n) => [`${fmt(Math.abs(Number(v)))} m²`, String(n)]}
              labelFormatter={(v) => `Estaca ${fmt(Number(v))} m`}
            />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <Bar dataKey="c_ref" name="corte ref." fill={accent} />
            <Bar dataKey="f_ref" name="aterro ref." fill="#4E7C59" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Divergência de volume por estaca */}
      <div className="bg-surface border border-border rounded-lg p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Divergência por estaca — pacote menos referência, m³ (negativo = o
          dashboard conta menos)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={dados} margin={{ top: 6, right: 12, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="sta"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v) => fmt(v)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickFormatter={(v) => fmt(v)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                fontSize: 12,
              }}
              formatter={(v, n) => [`${fmt(Number(v))} m³`, String(n)]}
              labelFormatter={(v) => `Estaca ${fmt(Number(v))} m`}
            />
            <ReferenceLine y={0} stroke="var(--color-border)" />
            <Line
              dataKey="dC"
              name="Δ corte"
              stroke="#C8601F"
              dot={false}
              strokeWidth={1.6}
            />
            <Line
              dataKey="dF"
              name="Δ aterro"
              stroke="#4E7C59"
              dot={false}
              strokeWidth={1.6}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela dos piores desvios */}
      <div className="bg-surface border border-border rounded-lg overflow-x-auto">
        <p className="text-xs uppercase tracking-wide text-muted-foreground p-3 pb-2">
          30 maiores divergências de volume
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 font-medium">Estaca</th>
              <th className="p-2 font-medium text-right">A corte ref. (m²)</th>
              <th className="p-2 font-medium text-right">A corte c/ CFT (m²)</th>
              <th className="p-2 font-medium text-right">A Lista Mat. (m²)</th>
              <th className="p-2 font-medium text-right">V corte ref. (m³)</th>
              <th className="p-2 font-medium text-right">V corte pacote</th>
              <th className="p-2 font-medium text-right">Δ corte</th>
              <th className="p-2 font-medium text-right">Δ aterro</th>
              <th className="p-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {piores.map(({ l, dC, dF }) => (
              <tr
                key={l.sta}
                className={`border-b border-border/50 hover:bg-muted/40 ${
                  onIrParaSecao ? "cursor-pointer" : ""
                }`}
                onClick={() => onIrParaSecao?.(l.sta, eixo.eixo_id)}
                title={
                  onIrParaSecao ? "Abrir esta estaca em Seções transversais" : undefined
                }
              >
                <td className="p-2 font-mono text-xs">{l.est}</td>
                <td className="p-2 text-right">{fmt(l.c_ref, 1)}</td>
                <td className="p-2 text-right text-muted-foreground">
                  {fmt(l.c_cft, 1)}
                </td>
                <td className="p-2 text-right text-muted-foreground">
                  {fmt(l.c_mat, 1)}
                </td>
                <td className="p-2 text-right">{fmt(l.vc_ref)}</td>
                <td className="p-2 text-right">{fmt(l.vc_dash)}</td>
                <td className="p-2 text-right">
                  <span className={dC < 0 ? "text-red-600 dark:text-red-400" : ""}>
                    {dC > 0 ? "+" : ""}
                    {fmt(dC)}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <span className={dF < 0 ? "text-red-600 dark:text-red-400" : ""}>
                    {dF > 0 ? "+" : ""}
                    {fmt(dF)}
                  </span>
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {l.trunc && (
                    <span title="seção truncada pela swath da sample line">
                      truncada
                    </span>
                  )}
                  {l.trunc && l.extrap && " · "}
                  {l.extrap && <span title="extrapolação do corredor">extrapolada</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

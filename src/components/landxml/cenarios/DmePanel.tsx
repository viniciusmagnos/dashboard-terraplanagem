/**
 * DME — Distância Máxima Econômica (didática, derivada dos custos ATIVOS):
 * cards com fórmula/cálculo/interpretação, gráfico custo × distância e as
 * hierarquias de origem/destino por menor custo (modelo Motiva).
 */
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcularDME, type DmeInfo } from "../../../lib/cenario";
import { fmt } from "../../../lib/format";
import { useEstudo } from "./EstudoContext";

function CardDme({ titulo, info }: { titulo: string; info: DmeInfo }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3 space-y-1.5">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-lg font-semibold text-cyan-400">{info.resultado}</p>
      <p className="text-[11px] text-muted-foreground">
        <span className="text-foreground">{info.formula}</span>
        <br />
        {info.calculo}
      </p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {info.interpretacao}
      </p>
    </div>
  );
}

export function DmePanel() {
  const { entradas } = useEstudo();
  const custos = entradas.custos;
  const dme = useMemo(() => calcularDME(custos), [custos]);

  const dadosGrafico = useMemo(() => {
    const maxD = Math.max(2, Math.ceil(dme.jazida.dmeKm * 1.4));
    const pts: { d: number; corte: number; jazida: number }[] = [];
    for (let d = 0; d <= maxD + 1e-9; d += 0.5) {
      pts.push({
        d,
        corte: custos.transporte * d,
        jazida: custos.escavacaoJazida + custos.royalty,
      });
    }
    return pts;
  }, [custos, dme.jazida.dmeKm]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <CardDme titulo="DME — jazida externa" info={dme.jazida} />
        <CardDme titulo="DME — alargamento vs jazida externa" info={dme.alargamento} />
        <CardDme titulo="DME — bota-fora na faixa vs externo" info={dme.botaFora} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-surface border border-border rounded-lg p-4">
          <p className="text-sm font-medium mb-2">
            Custo de suprir 1 m³ × distância de transporte
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dadosGrafico} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#33415555" />
              <XAxis
                dataKey="d"
                tick={{ fontSize: 11 }}
                label={{ value: "km", position: "insideBottomRight", offset: -2, fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `R$${fmt(v)}`}
                width={56}
              />
              <Tooltip
                formatter={(v) => `R$ ${fmt(Number(v), 2)}/m³`}
                labelFormatter={(d) => `${fmt(Number(d), 1)} km`}
              />
              <ReferenceLine
                x={Math.round(dme.jazida.dmeKm * 2) / 2}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: `DME ${fmt(dme.jazida.dmeKm, 2)} km`, fontSize: 10, fill: "#f59e0b", position: "top" }}
              />
              <Line
                type="monotone"
                dataKey="corte"
                name="Transportar material do corte"
                stroke="#f97316"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="jazida"
                name="Abrir jazida externa (escav. + royalty)"
                stroke="#06b6d4"
                dot={false}
                strokeWidth={2}
                strokeDasharray="6 3"
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-1">
            Abaixo do cruzamento, compensa transportar o corte; acima, abrir
            jazida perto do aterro.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 text-sm space-y-3">
          <div>
            <p className="text-xs font-medium text-orange-400 mb-1.5">
              HIERARQUIA DE ORIGENS (menor custo primeiro)
            </p>
            <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
              <li>
                <span className="text-foreground">Corte principal</span> — escavação
                R$ {fmt(custos.escavacao12, 2)}/m³ · sem royalty · transporte pela
                curva de Brückner
              </li>
              <li>
                <span className="text-foreground">
                  Alargamento de corte (jazida na faixa)
                </span>{" "}
                — escavação R$ {fmt(custos.escavacaoJazida, 2)}/m³ · sem royalty ·
                exige CBR ≥ 5% no material
              </li>
              <li>
                <span className="text-foreground">Jazida fora da faixa</span> —
                escavação R$ {fmt(custos.escavacaoJazida, 2)} + royalty R${" "}
                {fmt(custos.royalty, 2)}/m³ + transporte de acesso
              </li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-400 mb-1.5">
              HIERARQUIA DE DESTINOS (menor custo primeiro)
            </p>
            <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
              <li>
                <span className="text-foreground">Aterro</span> — compactação R${" "}
                {fmt(custos.compactacaoAterro, 2)}/m³c (destino produtivo)
              </li>
              <li>
                <span className="text-foreground">
                  BF na faixa (alargamento de aterro)
                </span>{" "}
                — conformação R$ {fmt(custos.conformacaoBF, 2)}/m³ · sem royalty
              </li>
              <li>
                <span className="text-foreground">BF fora da faixa</span> —
                conformação R$ {fmt(custos.conformacaoBF, 2)} + royalty R${" "}
                {fmt(custos.royalty, 2)}/m³ + transporte de acesso
              </li>
            </ol>
          </div>
          <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
            Custo/m³ evitado ao usar a faixa ≈ royalty ({fmt(custos.royalty, 2)}) +
            transporte extra − conformação — é o vetor de economia dos
            alargamentos.
          </p>
        </div>
      </div>
    </div>
  );
}

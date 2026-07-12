import { Lightbulb } from "lucide-react";
import { fmt, fmtBRLCompacto } from "../../lib/format";
import { otimizacoesDe, type OtimCard } from "../../lib/pacote-ext";
import { KpiCard } from "../landxml/KpiCard";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";
import { EmptyStateAguardando } from "../ui/EmptyStateAguardando";

const EXEMPLO = `"otimizacoes": {
  "versao": 1,
  "sem_geometria": [
    { "id": "o1", "titulo": "CFT -50%", "economia_rs": 1200000,
      "economia_pct": 3.5, "complexidade": "baixa", "status": "recomendado" }
  ],
  "com_geometria": []
}`;

export function OtimizacoesTab({
  accent,
  variante,
}: {
  accent: string;
  variante: "sem" | "com";
}) {
  const { pacote } = useEstudo();
  const otim = otimizacoesDe(pacote);
  const cards: OtimCard[] =
    (variante === "sem" ? otim?.sem_geometria : otim?.com_geometria) ?? [];

  const titulo =
    variante === "sem" ? "Sem mudança de geometria" : "Com mudança de geometria";

  if (!otim || cards.length === 0) {
    return (
      <div className="space-y-4">
        <SecaoHeaderCard accent={accent} icon={Lightbulb} titulo={titulo} />
        <EmptyStateAguardando
          bloco={`otimizacoes.${variante === "sem" ? "sem_geometria" : "com_geometria"}`}
          exemplo={EXEMPLO}
        />
      </div>
    );
  }

  const economiaTotal = cards.reduce((s, c) => s + (c.economia_rs ?? 0), 0);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Lightbulb}
        titulo={titulo}
        subtitulo={`${cards.length} oportunidade(s) de otimização`}
        right={<ProvChip pacote={pacote} bloco="otimizacoes" />}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <KpiCard rotulo="Oportunidades" valor={cards.length} />
        <KpiCard rotulo="Economia potencial" valor={economiaTotal} formato={fmtBRLCompacto} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium">{c.titulo}</h3>
              {c.status ? (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded border shrink-0"
                  style={{ borderColor: accent, color: accent }}
                >
                  {c.status}
                </span>
              ) : null}
            </div>
            {c.descricao ? (
              <p className="text-xs text-muted-foreground">{c.descricao}</p>
            ) : null}
            <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
              {c.economia_rs != null ? (
                <Metric rot="Economia" val={fmtBRLCompacto(c.economia_rs)} bom />
              ) : null}
              {c.economia_pct != null ? (
                <Metric rot="Redução" val={`${fmt(c.economia_pct, 1)}%`} bom />
              ) : null}
              {c.delta_momento_m3km != null ? (
                <Metric rot="Δ Momento" val={`${fmt(c.delta_momento_m3km)} m³·km`} />
              ) : null}
              {c.delta_prazo_meses != null ? (
                <Metric rot="Δ Prazo" val={`${fmt(c.delta_prazo_meses, 1)} meses`} />
              ) : null}
              {c.complexidade ? <Metric rot="Complexidade" val={String(c.complexidade)} /> : null}
            </div>
            {c.premissa ? (
              <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
                {c.premissa}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ rot, val, bom }: { rot: string; val: string; bom?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{rot}</p>
      <p className={`font-medium ${bom ? "text-emerald-400" : "text-foreground"}`}>{val}</p>
    </div>
  );
}

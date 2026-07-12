// APP-LOCAL — não adicionar ao sync-from-hub.
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { fmt } from "../../lib/format";
import type { BlocoPie } from "../../lib/dashboard-spec";
import { BlocoFrame } from "./BlocoFrame";
import { PALETA_DINAMICA } from "./formatos";

export function DynPie({ bloco }: { bloco: BlocoPie }) {
  const fatias = (Array.isArray(bloco.fatias) ? bloco.fatias : []).filter(
    (f) => f && typeof f.valor === "number" && Number.isFinite(f.valor) && f.valor > 0,
  );
  const aviso = fatias.length === 0 ? "sem fatias com valor positivo" : null;
  return (
    <BlocoFrame
      blocoId={bloco.id}
      titulo={bloco.titulo}
      subtitulo={bloco.subtitulo}
      nota={bloco.nota}
      aviso={aviso}
    >
      {fatias.length > 0 && (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={fatias}
              dataKey="valor"
              nameKey="nome"
              innerRadius={bloco.donut ? "55%" : 0}
              outerRadius="85%"
              isAnimationActive={false}
              stroke="var(--color-surface)"
            >
              {fatias.map((f, i) => (
                <Cell key={i} fill={f.cor || PALETA_DINAMICA[i % PALETA_DINAMICA.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, name) => [`${fmt(Number(v ?? 0))}`, String(name ?? "")]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </BlocoFrame>
  );
}

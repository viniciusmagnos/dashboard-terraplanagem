// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Dispatcher dos blocos dinâmicos por `tipo` + grid compartilhado. Bloco de
// tipo desconhecido/malformado (BlocoInvalido do parser) degrada num card de
// aviso — o resto do dashboard segue intacto.
import { Suspense, lazy } from "react";
import { AlertTriangle } from "lucide-react";
import {
  isBlocoInvalido,
  type Bloco,
  type BlocoInvalido,
} from "../../lib/dashboard-spec";
import { BlocoFrame } from "./BlocoFrame";
import { DynChart } from "./DynChart";
import { DynKpi } from "./DynKpi";
import { DynPie } from "./DynPie";
import { DynTable } from "./DynTable";

// react-markdown só entra no bundle quando existe bloco markdown no layout.
const DynMarkdown = lazy(() => import("./DynMarkdown"));

function AvisoBloco({ bloco }: { bloco: BlocoInvalido }) {
  return (
    <BlocoFrame blocoId={bloco.id} titulo={bloco.titulo || bloco.id}>
      <div className="flex items-start gap-2 text-xs text-warning">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
        <span>{bloco.motivo}</span>
      </div>
    </BlocoFrame>
  );
}

export function DynamicBlock({ bloco }: { bloco: Bloco | BlocoInvalido }) {
  if (isBlocoInvalido(bloco)) return <AvisoBloco bloco={bloco} />;
  switch (bloco.tipo) {
    case "kpi":
      return <DynKpi bloco={bloco} />;
    case "chart":
      return <DynChart bloco={bloco} />;
    case "table":
      return <DynTable bloco={bloco} />;
    case "pie":
      return <DynPie bloco={bloco} />;
    case "markdown":
      return (
        <Suspense fallback={<div className="bg-surface border border-border rounded-lg p-3 text-xs text-muted-foreground">Carregando…</div>}>
          <DynMarkdown bloco={bloco} />
        </Suspense>
      );
  }
}

/** Classes estáticas de col-span (Tailwind JIT precisa vê-las literais). */
function spanClasses(bloco: Bloco | BlocoInvalido): string {
  const span = isBlocoInvalido(bloco) ? 2 : (bloco.span ?? (bloco.tipo === "kpi" ? 1 : 2));
  switch (span) {
    case 1:
      return "";
    case 2:
      return "md:col-span-2";
    case 3:
      return "md:col-span-2 xl:col-span-3";
    default:
      return "md:col-span-2 xl:col-span-4";
  }
}

/** Grid responsivo de 4 colunas usado por abas dinâmicas e slots. */
export function GridBlocos({ blocos }: { blocos: (Bloco | BlocoInvalido)[] }) {
  if (!blocos.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {blocos.map((b) => (
        <div key={b.id} className={spanClasses(b)}>
          <DynamicBlock bloco={b} />
        </div>
      ))}
    </div>
  );
}

// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Ponto de extensão dentro de abas EXISTENTES: renderiza os blocos dinâmicos
// posicionados no slot (ex.: cards extras no topo da Visão consolidada).
// Renderiza nada quando o slot está vazio — custo zero no layout padrão.
import type { SlotId } from "../../lib/dashboard-spec";
import { useLayoutSeguro } from "./LayoutContext";
import { GridBlocos } from "./DynamicBlock";

export function SlotBlocos({ slot }: { slot: SlotId }) {
  const layout = useLayoutSeguro();
  if (!layout) return null;
  const blocos = layout.spec.blocos.filter(
    (b) => b.local.tipo === "slot" && b.local.slot === slot,
  );
  if (!blocos.length) return null;
  return <GridBlocos blocos={blocos} />;
}

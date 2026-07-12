import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Share2, Users } from "lucide-react";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { chaveVinculoEstudo } from "../../lib/estudo-api";
import { BotaoExportarExcel } from "../landxml/BotaoExportarExcel";
import { BotaoExportarHtml } from "../landxml/BotaoExportarHtml";
import { EstudoShareDialog } from "../landxml/EstudoShareDialog";

/** Relatório: exportações (Excel/HTML/pacote) + compartilhamento do estudo. */
export function RelatorioTab() {
  const { pacote, estudoId, estudoRole, syncStatus } = useEstudo();
  const navigate = useNavigate();
  const [share, setShare] = useState(false);

  const baixarPacote = () => {
    const blob = new Blob([JSON.stringify(pacote)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${pacote.projeto.id}.mtp.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sair = useCallback(() => {
    try {
      localStorage.removeItem(chaveVinculoEstudo(pacote.projeto.id));
    } catch {
      /* noop */
    }
    navigate("/");
  }, [pacote.projeto.id, navigate]);

  const ehEditor = estudoRole === "editor";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium">Exportar</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Planilhas e relatório do estudo (cenário ativo).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <BotaoExportarExcel />
            <BotaoExportarHtml />
            <button
              onClick={baixarPacote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-hover transition-colors"
            >
              <Download size={14} /> Pacote .mtp.json
            </button>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium">Compartilhamento</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ehEditor
              ? "Estudo compartilhado com você — veja os participantes."
              : "Convide colegas para ver e editar este estudo."}
          </p>
          <div className="mt-3">
            <button
              onClick={() => setShare(true)}
              disabled={!estudoId || !estudoRole}
              title={
                estudoId
                  ? undefined
                  : syncStatus === "offline"
                    ? "Estudo não sincronizado"
                    : "Sincronizando…"
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-surface-hover disabled:opacity-40 transition-colors"
            >
              {ehEditor ? <Users size={14} /> : <Share2 size={14} />}
              {ehEditor ? "Participantes" : "Compartilhar"}
            </button>
          </div>
        </section>
      </div>

      {share && estudoId && estudoRole && (
        <EstudoShareDialog
          estudoId={estudoId}
          role={estudoRole}
          onClose={() => setShare(false)}
          onLeft={sair}
        />
      )}
    </div>
  );
}

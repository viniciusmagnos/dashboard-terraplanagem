import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileJson,
  FlaskConical,
  Loader2,
  Upload,
} from "lucide-react";
import type { MtpPacote } from "../../lib/mtp";
import { validarPacote } from "../../lib/mtp";
import { obterPacoteTexto } from "../../lib/estudo-api";
import {
  importarSondagensEstudo,
  reportParaLaudo,
  type LaudoSondagem,
} from "../../lib/estudo-sondagens-api";
import {
  extractSondagem,
  uploadSondagemFiles,
} from "../../lib/sondagem-api";
import { useEstudo } from "../landxml/cenarios/EstudoContext";

/**
 * Importa sondagens em um projeto já existente e projeta os furos nos eixos.
 * Fontes: um sondagens.json (laudos) ou PDFs de boletins SPT (extraídos pelo
 * serviço sondagem do Manta Hub — "outra ferramenta"). Ao concluir, o pacote é
 * recarregado e a aba Geotecnia passa a exibir os furos.
 */
export function ImportarSondagensTab({
  pacote,
  onImportado,
}: {
  pacote: MtpPacote;
  onImportado: (p: MtpPacote) => void;
}) {
  const { estudoId, estudoRole, recarregarDoServidor } = useEstudo();
  const [laudos, setLaudos] = useState<LaudoSondagem[] | null>(null);
  const [origem, setOrigem] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const inputJson = useRef<HTMLInputElement>(null);
  const inputPdf = useRef<HTMLInputElement>(null);

  const podeEditar = estudoRole === "owner";

  const lerJson = useCallback(async (file: File) => {
    setErro("");
    setOk("");
    try {
      const dados = JSON.parse(await file.text()) as unknown;
      if (!Array.isArray(dados)) {
        throw new Error("O arquivo deve ser uma lista de laudos (sondagens.json).");
      }
      setLaudos(dados as LaudoSondagem[]);
      setOrigem(`${file.name} (${dados.length} laudos)`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const lerPdfs = useCallback(async (files: File[]) => {
    setErro("");
    setOk("");
    setBusy("Extraindo boletins (serviço sondagem)…");
    try {
      const up = await uploadSondagemFiles(files);
      const ext = await extractSondagem(up.session_id);
      const mapeados = ext.reports.map(reportParaLaudo);
      setLaudos(mapeados);
      setOrigem(`${files.length} PDF(s) → ${mapeados.length} laudos`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const importar = useCallback(async () => {
    if (!estudoId || !laudos) return;
    setErro("");
    setOk("");
    setBusy("Projetando os furos nos eixos e salvando…");
    try {
      const r = await importarSondagensEstudo(estudoId, laudos, { replace });
      // recarrega o pacote (bloco sondagens atualizado) + o estado do servidor
      const texto = await obterPacoteTexto(estudoId);
      onImportado(validarPacote(texto));
      await recarregarDoServidor();
      setOk(
        `Importado: ${r.n_posicionadas}/${r.n_total} furos posicionados nos eixos.` +
          (r.warnings.length ? ` (${r.warnings.length} aviso[s])` : ""),
      );
      setLaudos(null);
      setOrigem("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [estudoId, laudos, replace, onImportado, recarregarDoServidor]);

  const temGeometria = !!pacote.geometria && pacote.geometria.eixos.length > 0;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Importar sondagens</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Anexe sondagens a este projeto — os furos são projetados nos eixos da
          geometria e aparecem na aba Geotecnia (com perfil geológico e nas
          seções).
        </p>
      </div>

      {!temGeometria && (
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 text-warning rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Este pacote não tem geometria embutida — os furos não podem ser
          projetados nos eixos. Gere o projeto com a opção "Incluir geometria".
        </div>
      )}

      {!podeEditar && (
        <div className="flex items-start gap-2 bg-info/10 border border-info/30 text-info rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Só o dono do estudo pode importar sondagens.
        </div>
      )}

      {erro && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="break-all">{erro}</span>
        </div>
      )}
      {ok && (
        <div className="flex items-start gap-2 bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          {ok}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!podeEditar || !!busy}
          onClick={() => inputJson.current?.click()}
          className="flex flex-col items-center gap-2 p-5 bg-surface border border-border rounded-lg text-sm hover:border-manta/60 disabled:opacity-50 transition-colors"
        >
          <FileJson size={22} className="text-manta" />
          Arquivo sondagens.json
          <span className="text-[11px] text-muted-foreground">
            saída do extract_sondagens.py
          </span>
        </button>
        <button
          type="button"
          disabled={!podeEditar || !!busy}
          onClick={() => inputPdf.current?.click()}
          className="flex flex-col items-center gap-2 p-5 bg-surface border border-border rounded-lg text-sm hover:border-manta/60 disabled:opacity-50 transition-colors"
        >
          <Upload size={22} className="text-manta" />
          Boletins SPT em PDF
          <span className="text-[11px] text-muted-foreground">
            extraídos pelo serviço sondagem do Hub
          </span>
        </button>
        <input
          ref={inputJson}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void lerJson(f);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={inputPdf}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) void lerPdfs(fs);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {laudos && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <FlaskConical size={16} className="text-success" />
            <span className="font-medium">{laudos.length} laudos prontos</span>
            <span className="text-muted-foreground text-xs">— {origem}</span>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="accent-manta"
            />
            Substituir as sondagens atuais (em vez de mesclar)
          </label>
          <button
            onClick={() => void importar()}
            disabled={!podeEditar || !!busy || !temGeometria}
            className="flex items-center gap-2 px-4 py-2 bg-manta hover:bg-manta-hover disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
            {busy ?? "Importar para o projeto"}
          </button>
        </div>
      )}

      {busy && !laudos && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> {busy}
        </div>
      )}
    </div>
  );
}

// APP-LOCAL — não adicionar ao sync-from-hub.
//
// Gestão das FONTES LandXML brutas do estudo: são elas que habilitam o
// assistente IA a explorar o bruto (cota exata via TIN, seções cruas, SQL de
// agregações, volumes por trecho). Upload multipart com dedupe por sha256;
// índice reconstruído em background (status visível aqui).
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Database,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  anexarFonteXml,
  listarFontesXml,
  reindexarFontes,
  removerFonteXml,
  type FontesResponse,
} from "../../lib/fontes-api";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const STATUS_LABEL: Record<string, string> = {
  sem_fontes: "sem fontes anexadas",
  pendente: "índice pendente",
  building: "construindo índice…",
  ready: "índice pronto",
  failed: "falha no índice",
  stale: "índice desatualizado",
};

export function FontesXmlTab({ accent }: { accent: string }) {
  const { estudoId, estudoRole } = useEstudo();
  const [dados, setDados] = useState<FontesResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ehDono = estudoRole === "owner";

  const carregar = useCallback(async () => {
    if (!estudoId) return;
    try {
      setDados(await listarFontesXml(estudoId));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [estudoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Enquanto o índice constrói, acompanha o status.
  const status = dados?.index_status.status;
  useEffect(() => {
    if (status !== "building" && status !== "pendente" && status !== "stale") return;
    const t = window.setInterval(() => void carregar(), 5000);
    return () => window.clearInterval(t);
  }, [status, carregar]);

  const enviar = useCallback(
    async (files: FileList | null) => {
      if (!estudoId || !files?.length) return;
      setErro(null);
      for (const file of Array.from(files)) {
        setEnviando(file.name);
        try {
          await anexarFonteXml(estudoId, file);
        } catch (e) {
          setErro(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
      }
      setEnviando(null);
      void carregar();
    },
    [estudoId, carregar],
  );

  if (!estudoId) {
    return (
      <p className="text-sm text-muted-foreground">
        Estudo não sincronizado com o servidor — as fontes brutas ficam no Manta Hub.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={Database}
        titulo="LandXML bruto (fontes da IA)"
        subtitulo="Os .xml originais habilitam o assistente a calcular cotas, seções e volumes que o dashboard não mostra"
      />

      <div className="bg-surface border border-border rounded-lg p-3 flex flex-wrap items-center gap-3 text-sm">
        <Sparkles size={15} className="text-manta shrink-0" />
        <div className="flex-1 min-w-[220px]">
          <span className="text-foreground font-medium">
            {STATUS_LABEL[status ?? "sem_fontes"] ?? status}
          </span>
          {dados?.index_status.n_sections ? (
            <span className="text-muted-foreground">
              {" "}
              · {dados.index_status.n_sections.toLocaleString("pt-BR")} seções indexadas
            </span>
          ) : null}
          {dados?.index_status.error && (
            <span className="block text-xs text-danger">{dados.index_status.error}</span>
          )}
        </div>
        {(status === "building" || enviando) && (
          <Loader2 size={15} className="animate-spin text-muted-foreground" />
        )}
        {ehDono && dados && dados.fontes.length > 0 && (
          <button
            onClick={() => estudoId && void reindexarFontes(estudoId).then(carregar)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground"
            title="Reconstruir o índice de agregados"
          >
            <RefreshCw size={12} /> Reindexar
          </button>
        )}
        {ehDono && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,.landxml"
              multiple
              className="hidden"
              onChange={(e) => {
                void enviar(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={enviando != null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-manta text-white hover:bg-manta-hover disabled:opacity-50"
            >
              <FileUp size={13} />
              {enviando ? `Enviando ${enviando}…` : "Anexar LandXML"}
            </button>
          </>
        )}
      </div>

      {erro && (
        <div className="bg-danger/10 border border-danger/40 rounded-lg p-3 text-xs text-danger">
          {erro}
        </div>
      )}

      {dados && dados.fontes.length > 0 ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2">Arquivo</th>
                <th className="px-3 py-2 text-right">Tamanho</th>
                <th className="px-3 py-2">Anexado em</th>
                {ehDono && <th className="px-3 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {dados.fontes.map((f) => (
                <tr key={f.fonte_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {f.filename}
                    <span className="block text-[11px] text-muted-foreground font-mono">
                      sha256 {f.sha256.slice(0, 12)}…
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBytes(f.bytes)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleString("pt-BR")}
                  </td>
                  {ehDono && (
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remover "${f.filename}"? A IA perde o acesso ao bruto deste recorte.`,
                            )
                          ) {
                            void removerFonteXml(estudoId, f.fonte_id).then(carregar);
                          }
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-danger"
                        title="Remover fonte"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        dados && (
          <div className="bg-surface border border-border rounded-lg p-6 text-sm text-muted-foreground space-y-2">
            <p>
              Nenhum LandXML bruto anexado. Sem as fontes, o assistente responde só
              com o que o pacote do dashboard contém (bins, Brückner, geometria
              decimada).
            </p>
            <p>
              Estudos criados pelo próprio dashboard anexam as fontes automaticamente;
              para estudos antigos ou importados de .mtp.json,{" "}
              {ehDono ? "use o botão acima." : "peça ao dono do estudo."}
            </p>
          </div>
        )
      )}
    </div>
  );
}

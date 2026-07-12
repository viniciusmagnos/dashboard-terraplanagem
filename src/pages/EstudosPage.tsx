import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  FileCode2,
  FilePlus2,
  FlaskConical,
  FolderOpen,
  Loader2,
  Package,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  criarEstudo,
  listarEstudos,
  type EstudoResumo,
} from "../lib/estudo-api";
import { getUsersByIds } from "../lib/users-search-api";
import { exportDashboardPackage, uploadFile } from "../lib/landxml-api";
import { adotarFontesDeSessao } from "../lib/fontes-api";
import { validarPacote } from "../lib/mtp";
import { fmt } from "../lib/format";
import { Header } from "../components/shell/Header";
import { Footer } from "../components/shell/Footer";
import { Watermark } from "../components/shell/Watermark";

function slugify(nome: string): string {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "projeto"
  );
}

function parseBarreiras(texto: string): { sta_m: number; nome: string }[] {
  const out: { sta_m: number; nome: string }[] = [];
  for (const tok of texto.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const [sta, ...resto] = t.split(":");
    const v = Number(sta.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v)) continue;
    out.push({ sta_m: v, nome: resto.join(":").trim() });
  }
  return out;
}

interface ProgressoArquivo {
  nome: string;
  status: "aguardando" | "enviando" | "ok" | "erro";
  detalhe?: string;
}

export function EstudosPage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [progresso, setProgresso] = useState<ProgressoArquivo[]>([]);
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState("");

  const [nomeProjeto, setNomeProjeto] = useState("");
  const [barreirasTexto, setBarreirasTexto] = useState("");
  const [fillFactor, setFillFactor] = useState(1.0);
  const [incluirGeometria, setIncluirGeometria] = useState(true);
  const [sondagensRaw, setSondagensRaw] = useState<unknown[] | null>(null);
  const [sondagensNome, setSondagensNome] = useState("");

  const [estudos, setEstudos] = useState<EstudoResumo[] | null>(null);
  const [donos, setDonos] = useState<Map<number, string>>(new Map());
  const [abrindo, setAbrindo] = useState<string | null>(null);

  const inputXml = useRef<HTMLInputElement>(null);
  const inputMtp = useRef<HTMLInputElement>(null);
  const inputSond = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const lista = await listarEstudos();
        if (!vivo) return;
        setEstudos(lista);
        const idsDonos = Array.from(
          new Set(lista.filter((e) => e.role === "editor").map((e) => e.owner_id)),
        );
        if (idsDonos.length) {
          const users = await getUsersByIds(idsDonos);
          if (!vivo) return;
          setDonos(new Map(users.map((u) => [u.id, u.display_name || u.username])));
        }
      } catch {
        if (vivo) setEstudos([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const adicionarArquivos = (lista: FileList | null) => {
    if (!lista) return;
    const novos = Array.from(lista).filter((f) => /\.(xml|landxml)$/i.test(f.name));
    setArquivos((prev) => {
      const nomes = new Set(prev.map((f) => f.name));
      return [...prev, ...novos.filter((f) => !nomes.has(f.name))];
    });
  };

  const importarSondagens = useCallback(async (file: File) => {
    setErro("");
    try {
      const dados = JSON.parse(await file.text()) as unknown;
      if (!Array.isArray(dados)) {
        throw new Error(
          "sondagens.json deve ser uma lista de laudos (saída do scripts/extract_sondagens.py)",
        );
      }
      setSondagensRaw(dados);
      setSondagensNome(`${file.name} (${dados.length} laudos)`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const gerar = useCallback(async () => {
    if (!arquivos.length) return;
    setErro("");
    setProcessando(true);
    const prog: ProgressoArquivo[] = arquivos.map((f) => ({
      nome: f.name,
      status: "aguardando",
    }));
    setProgresso([...prog]);
    try {
      const sessionIds: string[] = [];
      for (let i = 0; i < arquivos.length; i++) {
        prog[i] = { ...prog[i], status: "enviando" };
        setProgresso([...prog]);
        setEtapa(`Processando ${i + 1}/${arquivos.length}: ${arquivos[i].name}`);
        const resp = await uploadFile(arquivos[i]);
        sessionIds.push(resp.session_id);
        prog[i] = {
          ...prog[i],
          status: "ok",
          detalhe: `${resp.n_alignments} eixos · ${resp.n_cross_sections} seções`,
        };
        setProgresso([...prog]);
      }
      setEtapa("Consolidando eixos, calculando Brückner e montando o pacote…");
      const nome =
        nomeProjeto.trim() || arquivos[0].name.replace(/\.(xml|landxml)$/i, "");
      const bruto = await exportDashboardPackage({
        session_ids: sessionIds,
        projeto: { id: slugify(nome), nome },
        barriers: parseBarreiras(barreirasTexto),
        fill_factor: fillFactor,
        geometria: incluirGeometria,
        sondagens: sondagensRaw ?? undefined,
      });
      const texto = JSON.stringify(bruto);
      const p = validarPacote(bruto);
      const { estudo_id } = await criarEstudo(texto, { nome: p.projeto.nome });
      // Adota os .xml BRUTOS das sessões recém-usadas como fontes do estudo
      // (habilita o assistente IA a explorar cotas/seções/volumes no bruto).
      // Best-effort: falha aqui não bloqueia a criação — dá para anexar depois.
      try {
        setEtapa("Anexando os LandXML brutos ao estudo (fontes da IA)…");
        await adotarFontesDeSessao(estudo_id, sessionIds);
      } catch {
        /* anexável depois na aba Dados → LandXML bruto */
      }
      navigate(`/estudo/${estudo_id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setProcessando(false);
      setEtapa("");
    }
  }, [
    arquivos,
    nomeProjeto,
    barreirasTexto,
    fillFactor,
    incluirGeometria,
    sondagensRaw,
    navigate,
  ]);

  const importarMtp = useCallback(
    async (file: File) => {
      setErro("");
      try {
        const texto = await file.text();
        const p = validarPacote(texto);
        const { estudo_id } = await criarEstudo(texto, { nome: p.projeto.nome });
        navigate(`/estudo/${estudo_id}`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    },
    [navigate],
  );

  const abrir = (e: EstudoResumo) => {
    setAbrindo(e.estudo_id);
    navigate(`/estudo/${e.estudo_id}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Watermark />
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Package className="text-manta" size={24} />
            Meus projetos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Abra um estudo existente da sua conta do Manta Hub, ou crie um novo a
            partir de arquivos LandXML (Civil 3D). Tudo sob demanda — sem
            reprocessar.
          </p>
        </div>

        {erro && (
          <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span className="break-all">{erro}</span>
          </div>
        )}

        {/* Estudos no servidor */}
        {estudos === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" /> Carregando seus estudos…
          </div>
        ) : estudos.length > 0 ? (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-sm font-medium">
              <FolderOpen size={15} className="text-manta" />
              Estudos no servidor
            </div>
            <div className="divide-y divide-border">
              {estudos.map((e) => (
                <div key={e.estudo_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{e.nome}</span>
                      {e.role === "editor" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-manta/15 text-manta border border-manta/30 shrink-0">
                          <Users size={10} />
                          {donos.get(e.owner_id)
                            ? `de ${donos.get(e.owner_id)}`
                            : "compartilhado"}
                        </span>
                      ) : e.is_shared ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-info/15 text-info border border-info/30 shrink-0"
                          title={`${e.n_participantes} participante(s) além de você`}
                        >
                          <Users size={10} /> compartilhado
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {e.n_cenarios} cenário{e.n_cenarios === 1 ? "" : "s"} · corte{" "}
                      {fmt(e.kpis.corte_total_m3)} m³ · atualizado em{" "}
                      {new Date(e.updated_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <button
                    onClick={() => abrir(e)}
                    disabled={abrindo !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded hover:bg-surface-hover disabled:opacity-40 transition-colors shrink-0"
                  >
                    {abrindo === e.estudo_id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <FolderOpen size={13} />
                    )}
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Novo projeto a partir de LandXML */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Novo projeto
          </h2>

          <div
            className="bg-surface border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-manta/60 transition-colors"
            onClick={() => inputXml.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              adicionarArquivos(e.dataTransfer.files);
            }}
          >
            <Upload className="mx-auto text-muted-foreground" size={28} />
            <p className="mt-2 text-sm">
              Arraste os arquivos <code>.xml/.landxml</code> aqui ou clique para escolher
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vários recortes do mesmo projeto são consolidados
            </p>
            <input
              ref={inputXml}
              type="file"
              multiple
              accept=".xml,.landxml"
              className="hidden"
              onChange={(e) => {
                adicionarArquivos(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {arquivos.length > 0 && (
            <div className="bg-surface border border-border rounded-lg divide-y divide-border">
              {arquivos.map((f, i) => {
                const st = progresso[i];
                return (
                  <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileCode2 size={16} className="text-manta shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(f.size / 1e6).toFixed(0)} MB
                    </span>
                    {processando ? (
                      st?.status === "ok" ? (
                        <span className="text-xs text-success">{st.detalhe}</span>
                      ) : st?.status === "enviando" ? (
                        <Loader2 size={14} className="animate-spin text-manta" />
                      ) : (
                        <span className="text-xs text-muted-foreground">na fila</span>
                      )
                    ) : (
                      <button
                        onClick={() =>
                          setArquivos((prev) => prev.filter((x) => x.name !== f.name))
                        }
                        className="text-muted-foreground hover:text-danger"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-surface border border-border rounded-lg p-4 grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Nome do projeto</label>
              <input
                value={nomeProjeto}
                onChange={(e) => setNomeProjeto(e.target.value)}
                placeholder="ex.: BR-376 Contorno PG"
                className="w-full mt-1.5 bg-background border border-border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Barreiras (OAEs) — estação em m</label>
              <input
                value={barreirasTexto}
                onChange={(e) => setBarreirasTexto(e.target.value)}
                placeholder="594300:OAE Rio, 596500:Viaduto"
                className="w-full mt-1.5 bg-background border border-border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Fator de homogeneização: {fillFactor.toFixed(2)}
              </label>
              <input
                type="range"
                min={1.0}
                max={1.5}
                step={0.01}
                value={fillFactor}
                onChange={(e) => setFillFactor(Number(e.target.value))}
                className="w-full mt-2 accent-manta"
              />
            </div>
            <div className="md:col-span-3 flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirGeometria}
                  onChange={(e) => setIncluirGeometria(e.target.checked)}
                  className="accent-manta"
                />
                Incluir geometria (seções transversais e 3D do corredor)
              </label>
            </div>
            <div className="md:col-span-3 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => inputSond.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors"
              >
                <FlaskConical size={14} className="text-success" />
                {sondagensRaw ? "Trocar sondagens" : "Anexar sondagens (opcional)"}
              </button>
              {sondagensRaw ? (
                <span className="flex items-center gap-1.5 text-xs text-success">
                  {sondagensNome}
                  <button
                    onClick={() => {
                      setSondagensRaw(null);
                      setSondagensNome("");
                    }}
                    className="text-muted-foreground hover:text-danger"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  sondagens.json (boletins SPT) — ou importe depois, na aba Geotecnia
                </span>
              )}
              <input
                ref={inputSond}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importarSondagens(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={() => void gerar()}
              disabled={!arquivos.length || processando}
              className="flex items-center gap-2 px-4 py-2 bg-manta hover:bg-manta-hover disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {processando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Package size={16} />
              )}
              {processando ? etapa || "Processando…" : "Gerar dashboard"}
            </button>

            <button
              onClick={() => inputMtp.current?.click()}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors"
            >
              <FilePlus2 size={15} />
              Já tenho um pacote (.mtp.json)
            </button>
            <input
              ref={inputMtp}
              type="file"
              accept=".json,.mtp.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importarMtp(f);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

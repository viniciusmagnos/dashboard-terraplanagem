import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2, RefreshCw, CheckCircle2, CloudOff } from "lucide-react";
import { obterPacoteTexto, chaveVinculoEstudo } from "../lib/estudo-api";
import { validarPacote, geotecniaDe, type MtpPacote } from "../lib/mtp";
import {
  EstudoProvider,
  useEstudo,
  type SyncStatus,
} from "../components/landxml/cenarios/EstudoContext";
import { Header } from "../components/shell/Header";
import { MainNavigation } from "../components/shell/MainNavigation";
import { ColunaSubAbas } from "../components/shell/ColunaSubAbas";
import { Watermark } from "../components/shell/Watermark";
import { Footer } from "../components/shell/Footer";
import { NAV, type TopTabId } from "../components/shell/nav";

// Abas app-local existentes
import { VisaoTab } from "../components/tabs/VisaoTab";
import { BrucknerTab } from "../components/tabs/BrucknerTab";
import { PlantaTab } from "../components/tabs/PlantaTab";
import { RelatorioTab } from "../components/tabs/RelatorioTab";
import { ImportarSondagensTab } from "../components/tabs/ImportarSondagensTab";
// Abas app-local novas (dirigidas pelo pacote / blocos opcionais)
import { RodoviasTab } from "../components/tabs/RodoviasTab";
import { VolumesSecaoTab } from "../components/tabs/VolumesSecaoTab";
import { BancoCenariosTab } from "../components/tabs/BancoCenariosTab";
import { MatrizDmtTab } from "../components/tabs/MatrizDmtTab";
import { ResumoExecutivoTab } from "../components/tabs/ResumoExecutivoTab";
import { BalancoMassasTab } from "../components/tabs/BalancoMassasTab";
import { ValidacaoDadosTab } from "../components/tabs/ValidacaoDadosTab";
import { ValidacaoFisicaTab } from "../components/tabs/ValidacaoFisicaTab";
import { CenarioVisaoTab } from "../components/tabs/CenarioVisaoTab";
import { CustoPorKmTab } from "../components/tabs/CustoPorKmTab";
import { JazidasTab } from "../components/tabs/JazidasTab";
import { BotaForasTab } from "../components/tabs/BotaForasTab";
import { EnsaiosCbrTab } from "../components/tabs/EnsaiosCbrTab";
import { ResumoRodoviaGeoTab } from "../components/tabs/ResumoRodoviaGeoTab";
import { RastreabilidadeTab } from "../components/tabs/RastreabilidadeTab";
import { PremissasTab } from "../components/tabs/PremissasTab";
import { CronogramaTab } from "../components/tabs/CronogramaTab";
import { TempoCaminhoTab } from "../components/tabs/TempoCaminhoTab";
import { OtimizacoesTab } from "../components/tabs/OtimizacoesTab";
import { SimultaneidadeTab } from "../components/tabs/SimultaneidadeTab";
import { RelatorioCompletoTab, ExportarPacoteTab } from "../components/tabs/RelatorioExtras";
// Painéis do core (vendorados) reutilizados como sub-abas
import { SecoesTab, type GeoSel } from "../components/landxml/geometria/SecoesTab";
import { GeotecniaTab } from "../components/landxml/geotecnia/GeotecniaTab";
import { CenariosTab } from "../components/landxml/cenarios/CenariosTab";
import { OrcamentoTab } from "../components/landxml/cenarios/OrcamentoTab";
import { ComparativoTab } from "../components/landxml/cenarios/ComparativoTab";
import { PrazoTab } from "../components/landxml/cenarios/PrazoTab";
import { QuadroOrigemDestino } from "../components/landxml/cenarios/QuadroOrigemDestino";
import { MomentoPorFluxo } from "../components/landxml/cenarios/MomentoPorFluxo";
import { DmePanel } from "../components/landxml/cenarios/DmePanel";
// Primitivos app-local
import { SeletorCenarioBar } from "../components/ui/SeletorCenarioBar";
import { EmptyStateAguardando } from "../components/ui/EmptyStateAguardando";

// three.js só entra no bundle quando a aba 3D abre
const GeometriaTab = lazy(
  () => import("../components/landxml/geometria/GeometriaTab"),
);
// Leaflet só entra no bundle quando o mapa geotécnico abre
const MapaGeotecniaTab = lazy(
  () => import("../components/tabs/MapaGeotecniaTab"),
);

/**
 * Carrega o estudo (por id) do servidor e monta o dashboard. É o mesmo caminho
 * usado ao abrir da lista, ao gerar/importar e no DEEP-LINK do caminho reverso
 * (o Manta Hub abre /estudo/:id aqui).
 */
export function EstudoShell() {
  const { id } = useParams<{ id: string }>();
  const [pacote, setPacote] = useState<MtpPacote | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setErro(null);
    try {
      const texto = await obterPacoteTexto(id);
      const p = validarPacote(texto);
      // Fixa o vínculo projeto → estudo_id ANTES de montar o provider, para o
      // bootstrap do EstudoContext adotar ESTE estudo (essencial p/ estudos
      // compartilhados / deep-link do dono).
      try {
        localStorage.setItem(chaveVinculoEstudo(p.projeto.id), id);
      } catch {
        /* noop */
      }
      setPacote(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    setPacote(null);
    void carregar();
  }, [carregar]);

  if (erro) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-md mx-auto mt-20 bg-surface border border-border rounded-xl p-6 text-center">
          <AlertCircle className="mx-auto text-danger" size={28} />
          <p className="mt-3 text-sm text-foreground">Não foi possível abrir o estudo</p>
          <p className="mt-1 text-xs text-muted-foreground break-words">{erro}</p>
        </div>
      </div>
    );
  }

  if (!pacote) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center gap-2 mt-24 text-sm text-muted-foreground">
          <Loader2 size={18} className="animate-spin" /> Carregando o estudo…
        </div>
      </div>
    );
  }

  return (
    <EstudoProvider pacote={pacote}>
      <ShellInterno pacote={pacote} onPacoteAtualizado={setPacote} />
    </EstudoProvider>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  if (status === "ok")
    return (
      <span className="flex items-center gap-1 text-[11px] text-success" title="Sincronizado com o Manta Hub">
        <CheckCircle2 size={13} /> sincronizado
      </span>
    );
  if (status === "offline")
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Sem sincronização (local)">
        <CloudOff size={13} /> local
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <RefreshCw size={13} className="animate-spin" /> sincronizando
    </span>
  );
}

function ShellInterno({
  pacote,
  onPacoteAtualizado,
}: {
  pacote: MtpPacote;
  onPacoteAtualizado: (p: MtpPacote) => void;
}) {
  const { syncStatus } = useEstudo();
  const [top, setTop] = useState<TopTabId>("dashboard");
  const [sub, setSub] = useState<string>("visao");
  const [geoSel, setGeoSel] = useState<GeoSel>({ eixoId: null, sta: null });

  const secao = NAV.find((t) => t.id === top)!;
  const accent = secao.accent;
  const nSond = geotecniaDe(pacote)?.resumo.n_total ?? 0;

  const trocarTop = (id: TopTabId) => {
    setTop(id);
    const alvo = NAV.find((t) => t.id === id)!;
    setSub(alvo.subs[0].id);
  };

  const irParaSecao = useCallback(
    (sta: number, eixoId?: string | null) => {
      const g = pacote.geometria;
      let eixo = eixoId ?? null;
      if (!eixo && g) {
        const achado = g.eixos.find(
          (e) =>
            e.secoes.length > 0 &&
            sta >= e.secoes[0].sta_m - 50 &&
            sta <= e.secoes[e.secoes.length - 1].sta_m + 50,
        );
        eixo = achado?.eixo_id ?? null;
      }
      setGeoSel({ eixoId: eixo, sta });
      setTop("dados");
      setSub("secoes");
    },
    [pacote],
  );

  const suspense = (node: ReactNode, texto: string) => (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 size={15} className="animate-spin" /> {texto}
        </div>
      }
    >
      {node}
    </Suspense>
  );

  // Mapa sub-aba → conteúdo (thunks: só a aba ativa é instanciada).
  const R: Record<string, () => ReactNode> = {
    // Dashboard
    visao: () => <VisaoTab />,
    premissas: () => <PremissasTab accent={accent} />,
    "dash-rodovias": () => <RodoviasTab accent={accent} />,
    "resumo-exec": () => <ResumoExecutivoTab accent={accent} />,
    bruckner: () => <BrucknerTab onIrParaSecao={(sta) => irParaSecao(sta)} />,
    "matriz-dmt": () => <MatrizDmtTab accent={accent} />,
    "quadro-od": () => <QuadroOrigemDestino />,
    momento: () => <MomentoPorFluxo />,
    "balanco-massas": () => <BalancoMassasTab accent={accent} />,
    dme: () => <DmePanel />,
    "orcamento-total": () => <OrcamentoTab />,
    "diagrama-planta": () => <PlantaTab />,
    cronograma: () => <CronogramaTab accent={accent} />,
    simultaneidade: () => <SimultaneidadeTab accent={accent} />,
    "tempo-caminho": () => <TempoCaminhoTab accent={accent} />,
    "validacao-dados": () => <ValidacaoDadosTab accent={accent} />,
    "validacao-fisica": () => <ValidacaoFisicaTab accent={accent} />,
    // Dados
    "dados-rodovias": () => <RodoviasTab accent={accent} />,
    "volumes-secao": () => <VolumesSecaoTab accent={accent} />,
    secoes: () => <SecoesTab pacote={pacote} sel={geoSel} onSel={setGeoSel} />,
    corredor3d: () =>
      suspense(
        <GeometriaTab pacote={pacote} sel={geoSel} onSel={setGeoSel} />,
        "Carregando o motor 3D…",
      ),
    "banco-dados": () => <BancoCenariosTab accent={accent} />,
    // Cenários
    "cen-visao": () => <CenarioVisaoTab accent={accent} />,
    "cen-premissas": () => <PremissasTab accent={accent} />,
    "cen-quadro-od": () => <QuadroOrigemDestino />,
    "cen-jazidas": () => <JazidasTab accent={accent} />,
    "cen-botaforas": () => <BotaForasTab accent={accent} />,
    "cen-momento": () => <MomentoPorFluxo />,
    "cen-orcamento": () => <OrcamentoTab />,
    "cen-custo-km": () => <CustoPorKmTab accent={accent} />,
    "cen-diagrama": () => <PlantaTab />,
    "cen-comparativo": () => <ComparativoTab />,
    // Otimizações
    "sim-real": () => <CenariosTab />,
    "otim-sem-geo": () => <OtimizacoesTab accent={accent} variante="sem" />,
    "otim-com-geo": () => <OtimizacoesTab accent={accent} variante="com" />,
    simulacoes: () => <ComparativoTab />,
    prazo: () => <PrazoTab />,
    // Geotecnia
    geotecnia: () => (
      <GeotecniaTab
        pacote={pacote}
        onIrParaSecao={(eixoId, sta) => irParaSecao(sta, eixoId)}
      />
    ),
    "geo-mapa": () =>
      suspense(<MapaGeotecniaTab accent={accent} />, "Carregando o mapa…"),
    "geo-cbr": () => <EnsaiosCbrTab accent={accent} />,
    "geo-resumo": () => <ResumoRodoviaGeoTab accent={accent} />,
    "importar-sondagens": () => (
      <ImportarSondagensTab pacote={pacote} onImportado={onPacoteAtualizado} />
    ),
    // Relatório
    "rel-central": () => <RelatorioTab />,
    "rel-completo": () => <RelatorioCompletoTab accent={accent} />,
    "rel-pacote": () => <ExportarPacoteTab accent={accent} />,
    rastreabilidade: () => <RastreabilidadeTab accent={accent} />,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Watermark />
      <Header
        title={pacote.projeto.nome}
        subtitle={`${pacote.schema} v${pacote.schema_version}${
          pacote.projeto.cliente ? ` · ${pacote.projeto.cliente}` : ""
        }`}
        right={<SyncBadge status={syncStatus} />}
      />
      <MainNavigation active={top} onChange={trocarTop} />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-5">
        <div className="flex flex-col lg:flex-row gap-5">
          <ColunaSubAbas
            subs={secao.subs.map((s) =>
              s.id === "geotecnia" && nSond
                ? { ...s, label: `Sondagens & perfil (${nSond})` }
                : s,
            )}
            active={sub}
            accent={accent}
            onChange={setSub}
          />

          <div className="flex-1 min-w-0 space-y-4">
            {top === "cenarios" && <SeletorCenarioBar accent={accent} />}
            {R[sub]?.() ?? (
              <EmptyStateAguardando
                bloco={sub}
                descricao="Selecione uma sub-aba."
              />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

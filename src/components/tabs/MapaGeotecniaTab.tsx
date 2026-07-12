import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { geotecniaDe } from "../../lib/mtp";
import { jazidasDe, botaForasDe } from "../../lib/pacote-ext";
import { ProvChip } from "../landxml/ProvChip";
import { useEstudo } from "../landxml/cenarios/EstudoContext";
import { SecaoHeaderCard } from "../ui/SecaoHeaderCard";

/**
 * Mapa interativo das sondagens (e recursos) por posição UTM (norte/este).
 *
 * Usa Leaflet com `CRS.Simple` (mapa planar sobre as coordenadas do projeto):
 * não depende de zona UTM nem de tiles externos — plota E/N como x/y. Quando o
 * pacote trouxer georreferência (lat/lng ou EPSG UTM), dá para trocar por um
 * mapa geográfico com basemap. Marcadores vetoriais (circleMarker) evitam
 * assets de ícone e CSP.
 */
const COR_TIPO: Record<string, string> = {
  percussao: "#C8601F",
  trado: "#B07D22",
  mista: "#4E7C59",
  poco: "#3B82F6",
  desconhecido: "#8B919A",
};
const corDe = (tipo: string) => COR_TIPO[tipo] ?? COR_TIPO.desconhecido;

export function MapaGeotecniaTab({ accent }: { accent: string }) {
  const { pacote } = useEstudo();
  const geo = geotecniaDe(pacote);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const pontos = useMemo(() => {
    const furos = (geo?.sondagens ?? [])
      .filter((s) => s.norte != null && s.este != null)
      .map((s) => ({
        norte: s.norte as number,
        este: s.este as number,
        cor: corDe(s.tipo),
        titulo: s.id,
        detalhe: `${s.tipo} · prof ${s.prof_total_m ?? "—"} m · NA ${s.na_m ?? "—"} m`,
      }));
    const jaz = jazidasDe(pacote)
      .filter((j) => j.norte != null && j.este != null)
      .map((j) => ({
        norte: j.norte as number,
        este: j.este as number,
        cor: "#E07B3D",
        titulo: `Jazida: ${j.nome}`,
        detalhe: j.material ?? "jazida",
      }));
    const bf = botaForasDe(pacote)
      .filter((b) => b.norte != null && b.este != null)
      .map((b) => ({
        norte: b.norte as number,
        este: b.este as number,
        cor: "#EF4444",
        titulo: `Bota-fora: ${b.nome}`,
        detalhe: "bota-fora",
      }));
    return [...furos, ...jaz, ...bf];
  }, [geo, pacote]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || pontos.length === 0) return;
    const map = L.map(el, {
      crs: L.CRS.Simple,
      minZoom: -12,
      attributionControl: false,
    });
    mapRef.current = map;

    const latlngs: L.LatLngExpression[] = [];
    for (const p of pontos) {
      // CRS.Simple: latLng(y, x) → usamos (norte, este)
      const ll: L.LatLngExpression = [p.norte, p.este];
      latlngs.push(ll);
      L.circleMarker(ll, {
        radius: 5,
        color: p.cor,
        fillColor: p.cor,
        fillOpacity: 0.8,
        weight: 1,
      })
        .bindPopup(`<strong>${p.titulo}</strong><br/>${p.detalhe}`)
        .addTo(map);
    }
    map.fitBounds(L.latLngBounds(latlngs).pad(0.1));
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [pontos]);

  const tiposPresentes = useMemo(() => {
    const set = new Set((geo?.sondagens ?? []).map((s) => s.tipo));
    return [...set];
  }, [geo]);

  return (
    <div className="space-y-4">
      <SecaoHeaderCard
        accent={accent}
        icon={MapPin}
        titulo="Mapa interativo"
        subtitulo={`${pontos.length} pontos posicionados (coordenadas UTM do projeto)`}
        right={<ProvChip pacote={pacote} bloco="sondagens" />}
      />

      {pontos.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Nenhuma sondagem/recurso com coordenadas (norte/este) neste pacote.
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="rounded-lg border border-border overflow-hidden bg-background"
            style={{ height: 520 }}
          />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {tiposPresentes.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: corDe(t) }}
                />
                {t}
              </span>
            ))}
            <span className="text-[11px]">
              Plano-cartesiano sobre coordenadas do projeto (sem basemap
              geográfico — requer georreferência no pacote).
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default MapaGeotecniaTab;

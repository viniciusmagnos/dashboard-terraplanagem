/**
 * Sincroniza o núcleo vendorizado do Manta Hub (motor de cálculo, tipos,
 * cliente de API e componentes landxml) para este projeto. Rode quando o hub
 * evoluir esses arquivos: `npm run sync-from-hub`.
 *
 * Mantém a lista EXPLÍCITA abaixo — NÃO sincroniza os arquivos próprios do app
 * (auth.ts foi adaptado p/ OAuth; pages/shell/tabs são específicos daqui).
 */
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const HUB = join(root, "..", "manta-hub", "frontend", "src");
const DST = join(root, "src");

if (!existsSync(HUB)) {
  console.error(`Manta Hub não encontrado em ${HUB}`);
  process.exit(1);
}

// Arquivos puros/compartilhados a espelhar do hub (NÃO inclui auth.ts).
const LIB_FILES = [
  "mtp.ts", "mtp-geometry.ts", "perfil-materiais.ts", "geotecnia-analise.ts",
  "bruckner.ts", "cenario.ts", "format.ts",
  "useNumericInput.ts", "api-client.ts", "auth-api.ts", "estudo-api.ts",
  "landxml-api.ts", "sondagem-api.ts", "pacote-store.ts", "users-search-api.ts",
  "theme.ts", "useResolvedTheme.ts", "estudo-html-export.ts", "estudo-html-charts.ts",
  "bruckner.test.ts", "cenario.test.ts", "cenario-parity.test.ts", "estudo-html-export.test.ts",
  "perfil-materiais.test.ts", "geotecnia-analise.test.ts",
];
const LIB_DIRS = ["landxml-3d"];
const COMP_DIRS = ["landxml"];
const COMP_FILES = [["askcad", "SenderAvatar.tsx"]];

let n = 0;
for (const f of LIB_FILES) {
  cpSync(join(HUB, "lib", f), join(DST, "lib", f));
  n++;
}
for (const d of LIB_DIRS) {
  cpSync(join(HUB, "lib", d), join(DST, "lib", d), { recursive: true });
  n++;
}
for (const d of COMP_DIRS) {
  cpSync(join(HUB, "components", d), join(DST, "components", d), { recursive: true });
  n++;
}
for (const [d, f] of COMP_FILES) {
  mkdirSync(join(DST, "components", d), { recursive: true });
  cpSync(join(HUB, "components", d, f), join(DST, "components", d, f));
  n++;
}

console.log(`Sincronizados ${n} itens do Manta Hub.`);
console.log("Revise os imports ../askcad/* nos componentes e rode `npm run build` + `npm test`.");

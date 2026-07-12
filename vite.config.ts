import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Em DEV apontamos direto para a API de produção do Manta Hub (mantaapi) e o
// issuer OAuth (hub), evitando subir os backends locais. Em PROD o mesmo
// roteamento é feito pelo netlify.toml (redirects/proxy same-origin), então o
// front nunca fala cross-origin e não há fricção de CORS.
const MANTAAPI = "https://mantaapi.mantaassociados.com";
const HUB = "https://hub.mantaassociados.com";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // /api/landxml/estudos → mantaapi/landxml/api/estudos
      "/api/landxml": {
        target: MANTAAPI,
        changeOrigin: true,
        secure: true,
        timeout: 600000,
        rewrite: (p) => p.replace(/^\/api\/landxml/, "/landxml/api"),
      },
      // /api/sondagem/... → mantaapi/sondagem/api/...
      "/api/sondagem": {
        target: MANTAAPI,
        changeOrigin: true,
        secure: true,
        timeout: 600000,
        rewrite: (p) => p.replace(/^\/api\/sondagem/, "/sondagem/api"),
      },
      // /api/auth/login → mantaapi/auth/api/login
      "/api/auth": {
        target: MANTAAPI,
        changeOrigin: true,
        secure: true,
        timeout: 600000,
        rewrite: (p) => p.replace(/^\/api\/auth/, "/auth/api"),
      },
      // /oauth/token → hub/v1/oauth/token (discovery/authorize são navegação top-level)
      "/oauth": {
        target: HUB,
        changeOrigin: true,
        secure: true,
        timeout: 600000,
        rewrite: (p) => p.replace(/^\/oauth/, "/v1/oauth"),
      },
      "/.well-known": {
        target: HUB,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

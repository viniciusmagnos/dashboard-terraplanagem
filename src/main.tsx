import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { initTheme } from "./lib/theme";
import { initAuth } from "./lib/auth";

// Aplica o tema e tenta restaurar a sessão (refresh token) ANTES de renderizar,
// para evitar um flash da tela de login quando o usuário já está logado.
initTheme();
initAuth().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});

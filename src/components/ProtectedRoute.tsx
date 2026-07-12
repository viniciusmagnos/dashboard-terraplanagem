import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Exige sessão autenticada. Sem login, manda para /login preservando o destino
 * (path + query) para retomar após o SSO — essencial para os deep-links
 * /estudo/:id do caminho reverso vindos do Manta Hub.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const returnTo = location.pathname + location.search;
    return <Navigate to="/login" state={{ from: returnTo }} replace />;
  }
  return <>{children}</>;
}

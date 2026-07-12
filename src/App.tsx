import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { CallbackPage } from "./pages/CallbackPage";
import { EstudosPage } from "./pages/EstudosPage";
import { EstudoShell } from "./pages/EstudoShell";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/callback" element={<CallbackPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <EstudosPage />
          </ProtectedRoute>
        }
      />
      {/* Deep-link do caminho reverso: o Manta Hub abre um estudo aqui. */}
      <Route
        path="/estudo/:id"
        element={
          <ProtectedRoute>
            <EstudoShell />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

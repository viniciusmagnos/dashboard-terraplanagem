/**
 * Modal de compartilhamento do ESTUDO do dashboard de terraplenagem.
 *
 * Duas abas (mesmo padrão do ShareDialog do AskCAD):
 * - **Convidar** (só o dono): busca no diretório de usuários do auth e
 *   adiciona como editor.
 * - **Participantes**: dono + editores. Dono remove qualquer editor; um
 *   editor só remove a si mesmo ("Sair").
 *
 * Editores enxergam o estudo na lista deles em /landxml/dashboard e abrem o
 * MESMO estudo (pacote + cenários + premissas), podendo editar em conjunto.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";

import {
  compartilharEstudo,
  descompartilharEstudo,
  listarParticipantes,
  type EstudoParticipante,
  type EstudoRole,
} from "../../lib/estudo-api";
import {
  getUsersByIds,
  searchUsers,
  type DirectoryUser,
} from "../../lib/users-search-api";
import { SenderAvatar } from "../askcad/SenderAvatar";

interface EstudoShareDialogProps {
  estudoId: string;
  /** Papel do usuário atual — "owner" libera convidar/remover. */
  role: EstudoRole;
  onClose: () => void;
  /** Chamado quando o próprio usuário sai do estudo (editor → "Sair"). */
  onLeft?: () => void;
}

interface ParticipanteEnriquecido extends EstudoParticipante {
  username?: string;
  display_name?: string;
}

export function EstudoShareDialog({
  estudoId,
  role,
  onClose,
  onLeft,
}: EstudoShareDialogProps) {
  const [tab, setTab] = useState<"invite" | "list">(
    role === "owner" ? "invite" : "list",
  );
  const [participantes, setParticipantes] = useState<ParticipanteEnriquecido[]>(
    [],
  );
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<DirectoryUser[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [convidando, setConvidando] = useState<number | null>(null);

  // ── Participantes + enriquecimento com nomes do auth ─────────
  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    void (async () => {
      try {
        const resp = await listarParticipantes(estudoId);
        if (cancelado) return;
        const ids = resp.participants.map((p) => p.user_id);
        const users = ids.length > 0 ? await getUsersByIds(ids) : [];
        if (cancelado) return;
        const porId = new Map(users.map((u) => [u.id, u]));
        setParticipantes(
          resp.participants.map((p) => {
            const u = porId.get(p.user_id);
            return {
              ...p,
              username: u?.username,
              display_name: u?.display_name || u?.username,
            };
          }),
        );
      } catch (exc) {
        if (!cancelado)
          setErro(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [estudoId]);

  // ── Busca debounced no diretório ─────────────────────────────
  useEffect(() => {
    if (tab !== "invite") return;
    let cancelado = false;
    setBuscando(true);
    const handle = setTimeout(async () => {
      try {
        const rows = await searchUsers(query);
        if (!cancelado) setResultados(rows);
      } catch (exc) {
        if (!cancelado)
          setErro(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(handle);
    };
  }, [query, tab]);

  const idsParticipantes = useMemo(
    () => new Set(participantes.map((p) => p.user_id)),
    [participantes],
  );

  async function convidar(u: DirectoryUser) {
    setConvidando(u.id);
    setErro(null);
    try {
      await compartilharEstudo(estudoId, u.id);
      setParticipantes((prev) => [
        ...prev,
        {
          user_id: u.id,
          role: "editor",
          added_at: new Date().toISOString(),
          added_by_user_id: 0,
          is_self: false,
          username: u.username,
          display_name: u.display_name || u.username,
        },
      ]);
      setTab("list");
    } catch (exc) {
      setErro(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setConvidando(null);
    }
  }

  async function remover(p: ParticipanteEnriquecido) {
    if (p.role === "owner") return;
    setErro(null);
    try {
      await descompartilharEstudo(estudoId, p.user_id);
      setParticipantes((prev) => prev.filter((x) => x.user_id !== p.user_id));
      if (p.is_self) {
        onLeft?.();
        onClose();
      }
    } catch (exc) {
      setErro(exc instanceof Error ? exc.message : String(exc));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Compartilhar dashboard</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {role === "owner" && (
          <div className="flex border-b border-border text-xs">
            <button
              onClick={() => setTab("invite")}
              className={`flex-1 px-3 py-2 transition-colors ${
                tab === "invite"
                  ? "text-cyan-400 border-b-2 border-cyan-500 font-semibold"
                  : "text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              Convidar
            </button>
            <button
              onClick={() => setTab("list")}
              className={`flex-1 px-3 py-2 transition-colors ${
                tab === "list"
                  ? "text-cyan-400 border-b-2 border-cyan-500 font-semibold"
                  : "text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              Participantes ({participantes.length})
            </button>
          </div>
        )}

        {erro && (
          <div className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs border-b border-rose-500/30">
            {erro}
          </div>
        )}

        {tab === "invite" && role === "owner" ? (
          <div className="p-4 space-y-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Buscar por nome ou username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded border border-border bg-background"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto -mx-1">
              {buscando && resultados.length === 0 && (
                <div className="text-xs text-muted-foreground px-3 py-4 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Buscando...
                </div>
              )}
              {!buscando && resultados.length === 0 && (
                <div className="text-xs text-muted-foreground px-3 py-4">
                  Nenhum usuário encontrado.
                </div>
              )}
              {resultados.map((u) => {
                const jaParticipa = idsParticipantes.has(u.id);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <SenderAvatar
                        userId={u.id}
                        name={u.display_name || u.username}
                        size={26}
                      />
                      <div className="min-w-0">
                        <div className="text-sm truncate">
                          {u.display_name || u.username}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          @{u.username}
                        </div>
                      </div>
                    </div>
                    {jaParticipa ? (
                      <span className="text-[11px] text-muted-foreground px-2">
                        já participa
                      </span>
                    ) : (
                      <button
                        onClick={() => void convidar(u)}
                        disabled={convidando === u.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
                      >
                        {convidando === u.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <UserPlus size={11} />
                        )}
                        Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {carregando && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Carregando...
              </div>
            )}
            {!carregando && participantes.length === 0 && (
              <div className="text-xs text-muted-foreground">
                Sem participantes ainda.
              </div>
            )}
            {participantes.map((p) => {
              const rotulo =
                p.display_name || p.username || `Usuário #${p.user_id}`;
              const podeRemover =
                p.role === "editor" && (role === "owner" || p.is_self);
              return (
                <div
                  key={p.user_id}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-surface-hover"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <SenderAvatar userId={p.user_id} name={rotulo} size={26} />
                    <div className="min-w-0">
                      <div className="text-sm truncate flex items-center gap-1.5">
                        {rotulo}
                        {p.is_self && (
                          <span className="text-[10px] text-cyan-400">
                            (você)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.role === "owner" ? "Dono" : "Editor"}
                        {p.username ? ` · @${p.username}` : ""}
                      </div>
                    </div>
                  </div>
                  {podeRemover && (
                    <button
                      onClick={() => void remover(p)}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      {p.is_self ? "Sair" : "Remover"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          {role === "owner"
            ? "Quem você convidar abre este mesmo estudo em /landxml/dashboard e edita cenários, premissas e custos junto com você. Só você troca o pacote, compartilha ou exclui o estudo."
            : "Este estudo foi compartilhado com você — suas edições valem para todos. Para sair, clique em \"Sair\" na sua linha."}
        </div>
      </div>
    </div>
  );
}

/**
 * Persistência do último pacote .mtp.json do dashboard.
 *
 * Pacotes v2 com geometria passam de 1 MB — acima do que cabe com folga no
 * localStorage (limite prático ~5 MB compartilhado). Estratégia:
 * - IndexedDB (`manta-landxml` / store `pacotes` / chave `atual`) como
 *   armazenamento principal (sem teto prático para nosso caso);
 * - espelho em localStorage `manta:landxml:mtp` só quando o texto é pequeno
 *   (< 2,5 M chars — compatibilidade com o fluxo antigo);
 * - leitura tenta IDB primeiro e migra do localStorage quando o IDB está
 *   vazio; falhas de IDB (ex.: navegação privada) degradam para localStorage.
 */

const LS_PACOTE = "manta:landxml:mtp";
const LS_LIMITE = 2_500_000;
const DB_NAME = "manta-landxml";
const STORE = "pacotes";
const CHAVE = "atual";

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponível"));
  });
}

function idbSet(texto: string): Promise<void> {
  return abrirDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(texto, CHAVE);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IDB write falhou"));
        };
      }),
  );
}

function idbGet(): Promise<string | null> {
  return abrirDb().then(
    (db) =>
      new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(CHAVE);
        req.onsuccess = () => {
          db.close();
          resolve(typeof req.result === "string" ? req.result : null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error ?? new Error("IDB read falhou"));
        };
      }),
  );
}

function idbDel(): Promise<void> {
  return abrirDb().then(
    (db) =>
      new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(CHAVE);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      }),
  );
}

/** Remove o bloco geometria de um JSON de pacote (fallback p/ localStorage). */
function semGeometria(texto: string): string {
  try {
    const obj = JSON.parse(texto) as Record<string, unknown>;
    if (obj && typeof obj === "object" && obj.geometria) {
      obj.geometria = null;
      return JSON.stringify(obj);
    }
  } catch {
    /* mantém original */
  }
  return texto;
}

export async function salvarPacoteAtual(texto: string): Promise<void> {
  let idbOk = false;
  try {
    await idbSet(texto);
    idbOk = true;
  } catch {
    /* IDB indisponível — cai pro localStorage */
  }
  try {
    if (texto.length < LS_LIMITE) {
      localStorage.setItem(LS_PACOTE, texto);
    } else if (!idbOk) {
      const enxuto = semGeometria(texto);
      if (enxuto.length < LS_LIMITE) localStorage.setItem(LS_PACOTE, enxuto);
    } else {
      // grande demais para espelho — evita cópia velha divergente
      localStorage.removeItem(LS_PACOTE);
    }
  } catch {
    /* quota localStorage — IDB (se ok) já cobre */
  }
}

export async function carregarPacoteAtual(): Promise<string | null> {
  try {
    const doIdb = await idbGet();
    if (doIdb) return doIdb;
  } catch {
    /* segue pro localStorage */
  }
  try {
    return localStorage.getItem(LS_PACOTE);
  } catch {
    return null;
  }
}

export async function limparPacoteAtual(): Promise<void> {
  try {
    localStorage.removeItem(LS_PACOTE);
  } catch {
    /* noop */
  }
  await idbDel().catch(() => undefined);
}

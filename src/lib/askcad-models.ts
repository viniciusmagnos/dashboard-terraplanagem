// APP-LOCAL — não adicionar ao sync-from-hub (port adaptado do manta-hub).
export type AskCadModel = "claude-sonnet-4-6" | "claude-opus-4-7";

export const ASKCAD_MODELS: { id: AskCadModel; label: string; hint: string }[] = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", hint: "rápido · padrão" },
  { id: "claude-opus-4-7", label: "Opus 4.7", hint: "mais capaz · ~5× mais caro" },
];

const STORAGE_KEY = "askcad:model";
const DEFAULT_MODEL: AskCadModel = "claude-sonnet-4-6";

export function readStoredModel(): AskCadModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "claude-opus-4-7" || raw === "claude-sonnet-4-6") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_MODEL;
}

export function writeStoredModel(model: AskCadModel): void {
  try {
    localStorage.setItem(STORAGE_KEY, model);
  } catch {
    /* ignore */
  }
}

// APP-LOCAL — não adicionar ao sync-from-hub (port adaptado do manta-hub).
import { useMemo, useState } from "react";
import type { FormFieldSchema } from "../../lib/askcad-api";

export type FormStatus = "pending" | "submitted" | "cancelled";

export interface FormRequestData {
  id: string;
  formTitle: string;
  contextMessage: string;
  fields: FormFieldSchema[];
  submitLabel: string;
  cancelLabel: string;
  status: FormStatus;
  values?: Record<string, unknown>;
}

interface InputFormCardProps {
  form: FormRequestData;
  /** Submit the values to the agent. Caller streams the SSE response. */
  onSubmit?: (formId: string, values: Record<string, unknown>) => void | Promise<void>;
  /** Notify the agent that the user cancelled. */
  onCancel?: (formId: string) => void | Promise<void>;
}

function fieldInitialValue(f: FormFieldSchema): string | boolean {
  if (f.type === "boolean") return Boolean(f.default ?? false);
  if (f.default === null || f.default === undefined) return "";
  return String(f.default);
}

function validateField(
  f: FormFieldSchema,
  raw: string | boolean,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (f.type === "boolean") {
    return { ok: true, value: Boolean(raw) };
  }
  const str = typeof raw === "string" ? raw.trim() : String(raw);
  if (str === "") {
    if (f.required !== false) {
      return { ok: false, error: "obrigatório" };
    }
    return { ok: true, value: f.default ?? null };
  }
  if (f.type === "number") {
    const n = Number(str.replace(",", "."));
    if (!Number.isFinite(n)) return { ok: false, error: "número inválido" };
    if (f.min !== undefined && n < f.min) return { ok: false, error: `< min (${f.min})` };
    if (f.max !== undefined && n > f.max) return { ok: false, error: `> max (${f.max})` };
    return { ok: true, value: n };
  }
  if (f.type === "integer") {
    const n = Number(str.replace(",", "."));
    if (!Number.isInteger(n)) return { ok: false, error: "inteiro inválido" };
    if (f.min !== undefined && n < f.min) return { ok: false, error: `< min (${f.min})` };
    if (f.max !== undefined && n > f.max) return { ok: false, error: `> max (${f.max})` };
    return { ok: true, value: n };
  }
  if (f.type === "select") {
    const opts = f.options ?? [];
    if (opts.length > 0 && !opts.includes(str)) {
      return { ok: false, error: `não está em ${opts.join(", ")}` };
    }
    return { ok: true, value: str };
  }
  return { ok: true, value: str };
}

export function InputFormCard({ form, onSubmit, onCancel }: InputFormCardProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of form.fields) {
      init[f.name] = fieldInitialValue(f);
    }
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const isPending = form.status === "pending";

  const formatted = useMemo(() => {
    if (form.status === "submitted" && form.values) {
      return form.fields.map((f) => ({
        label: f.label,
        value:
          form.values?.[f.name] === undefined || form.values?.[f.name] === ""
            ? "(vazio)"
            : String(form.values?.[f.name]),
        unit: f.unit ?? "",
      }));
    }
    return [];
  }, [form]);

  const handleSubmit = async () => {
    if (!onSubmit) return;
    const nextErrors: Record<string, string> = {};
    const finalValues: Record<string, unknown> = {};
    for (const f of form.fields) {
      const res = validateField(f, values[f.name]);
      if (!res.ok) {
        nextErrors[f.name] = res.error;
      } else {
        finalValues[f.name] = res.value;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(form.id, finalValues);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setBusy(true);
    try {
      await onCancel(form.id);
    } finally {
      setBusy(false);
    }
  };

  const borderColor =
    form.status === "submitted"
      ? "border-success/60"
      : form.status === "cancelled"
        ? "border-border"
        : "border-info/60";

  return (
    <div className={`my-2 border-2 ${borderColor} rounded-lg bg-surface overflow-hidden`}>
      <div className="px-3 py-2 bg-info/10 flex items-center gap-2">
        <span className="text-lg">🔧</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {form.formTitle || "Parâmetros solicitados pelo assistente"}
          </div>
          {form.contextMessage && (
            <div className="text-xs text-muted-foreground truncate">
              {form.contextMessage}
            </div>
          )}
        </div>
        {form.status !== "pending" && (
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              form.status === "submitted"
                ? "bg-success/15 text-success"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {form.status === "submitted" ? "enviado" : "cancelado"}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {isPending ? (
          <>
            {form.fields.map((f) => {
              const err = errors[f.name];
              const raw = values[f.name];
              return (
                <div key={f.name} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-foreground/90 flex items-center gap-2">
                    <span>{f.label}</span>
                    {f.unit && <span className="text-muted-foreground">({f.unit})</span>}
                  </label>
                  {f.type === "select" ? (
                    <select
                      value={String(raw)}
                      onChange={(e) =>
                        setValues((s) => ({ ...s, [f.name]: e.target.value }))
                      }
                      className="text-sm rounded border border-border bg-background text-foreground px-2 py-1"
                      disabled={busy}
                    >
                      {!(f.options ?? []).includes(String(raw)) && (
                        <option value="">— selecione —</option>
                      )}
                      {(f.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(raw)}
                        onChange={(e) =>
                          setValues((s) => ({ ...s, [f.name]: e.target.checked }))
                        }
                        disabled={busy}
                      />
                      <span className="text-foreground/90">
                        {Boolean(raw) ? "sim" : "não"}
                      </span>
                    </label>
                  ) : (
                    <input
                      type={f.type === "number" || f.type === "integer" ? "number" : "text"}
                      value={String(raw)}
                      step={f.type === "integer" ? 1 : "any"}
                      min={f.min}
                      max={f.max}
                      onChange={(e) =>
                        setValues((s) => ({ ...s, [f.name]: e.target.value }))
                      }
                      className="text-sm rounded border border-border bg-background text-foreground px-2 py-1"
                      placeholder={f.hint ?? ""}
                      disabled={busy}
                    />
                  )}
                  {f.hint && !err && (
                    <div className="text-[11px] text-muted-foreground">{f.hint}</div>
                  )}
                  {err && <div className="text-[11px] text-danger">{err}</div>}
                </div>
              );
            })}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={busy || !onCancel}
                className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-surface-hover disabled:opacity-50"
              >
                {form.cancelLabel || "Cancelar"}
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={busy || !onSubmit}
                className="text-xs px-3 py-1.5 rounded bg-manta text-white hover:bg-manta-hover disabled:opacity-50"
              >
                {form.submitLabel || "Enviar"}
              </button>
            </div>
          </>
        ) : formatted.length > 0 ? (
          <ul className="text-xs text-foreground/90 space-y-0.5">
            {formatted.map((row) => (
              <li key={row.label}>
                <strong>{row.label}:</strong> {row.value} {row.unit}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-muted-foreground">
            {form.status === "cancelled" ? "Formulário cancelado." : "Formulário enviado."}
          </div>
        )}
      </div>
    </div>
  );
}

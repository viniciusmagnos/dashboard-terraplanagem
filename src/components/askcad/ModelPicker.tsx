// APP-LOCAL — não adicionar ao sync-from-hub (port adaptado do manta-hub).
import { Sparkles } from "lucide-react";
import { ASKCAD_MODELS, type AskCadModel } from "../../lib/askcad-models";

interface ModelPickerProps {
  value: AskCadModel;
  onChange: (model: AskCadModel) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ModelPicker({ value, onChange, disabled, compact }: ModelPickerProps) {
  const padding = compact ? "px-2 py-0.5" : "px-2 py-1";
  const iconSize = compact ? 11 : 12;
  return (
    <label
      className={`flex items-center gap-1 text-xs rounded border border-border bg-surface ${padding} ${
        disabled ? "opacity-60" : "hover:bg-surface-hover"
      }`}
      title="Modelo usado pelo agente neste chat"
    >
      <Sparkles size={iconSize} className="text-manta shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AskCadModel)}
        disabled={disabled}
        className="bg-transparent text-xs text-foreground focus:outline-none disabled:cursor-not-allowed"
      >
        {ASKCAD_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.hint}
          </option>
        ))}
      </select>
    </label>
  );
}

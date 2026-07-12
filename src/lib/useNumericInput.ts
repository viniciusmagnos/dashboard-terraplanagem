import { useState, useRef, useEffect, type ChangeEvent } from "react";

/**
 * Hook that allows numeric inputs to be cleared by the user.
 * Stores raw string internally, commits valid numbers immediately,
 * and restores a fallback value on blur if the field is empty.
 */
export function useNumericInput(
  value: number,
  onChange: (n: number) => void,
  fallback = 0
) {
  const [raw, setRaw] = useState(() => String(value));
  const focused = useRef(false);

  // Sync display when parent value changes externally (e.g. reset button)
  useEffect(() => {
    if (!focused.current) {
      setRaw(String(value));
    }
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setRaw(s);
    const n = parseFloat(s);
    if (s !== "" && isFinite(n)) {
      onChange(n);
    }
  };

  const handleFocus = () => {
    focused.current = true;
  };

  const handleBlur = () => {
    focused.current = false;
    const n = parseFloat(raw);
    if (raw === "" || !isFinite(n)) {
      onChange(fallback);
      setRaw(String(fallback));
    } else {
      // Normalize display (e.g. "3." → "3")
      setRaw(String(n));
    }
  };

  return {
    inputProps: {
      value: raw,
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}

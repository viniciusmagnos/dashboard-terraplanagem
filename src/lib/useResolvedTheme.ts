import { useState, useEffect } from "react";
import { getResolvedTheme } from "./theme";

export function useResolvedTheme(): "light" | "dark" {
  const [resolved, setResolved] = useState(getResolvedTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setResolved(getResolvedTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return resolved;
}

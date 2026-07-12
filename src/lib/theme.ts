export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "manta-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

export function loadTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system";
}

export function setTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme === "system" ? getSystemTheme() : theme);
}

export function getResolvedTheme(): "light" | "dark" {
  const theme = loadTheme();
  return theme === "system" ? getSystemTheme() : theme;
}

/** Call once at app startup to apply stored preference and listen for OS changes */
export function initTheme() {
  const theme = loadTheme();
  applyTheme(theme === "system" ? getSystemTheme() : theme);

  // Listen for OS theme changes when set to "system"
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (loadTheme() === "system") {
      applyTheme(getSystemTheme());
    }
  });
}

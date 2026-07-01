/**
 * Shared theming contract for Connect UI and future Bridge widgets (BuyWidget, etc.).
 * Values map to CSS custom properties on the connect root element.
 */
export interface ConnectTheme {
  mode?: "dark" | "light";
  bg?: string;
  surface?: string;
  surfaceRaised?: string;
  border?: string;
  borderStrong?: string;
  text?: string;
  textDim?: string;
  textFaint?: string;
  accent?: string;
  accentDim?: string;
  radius?: string;
  fontDisplay?: string;
  fontBody?: string;
  fontMono?: string;
  modalOverlay?: string;
}

export const defaultDarkTheme: ConnectTheme = {
  mode: "dark",
  bg: "#0b0b0d",
  surface: "#151517",
  surfaceRaised: "#1b1b1e",
  border: "#232326",
  borderStrong: "#313134",
  text: "#f4f1ea",
  textDim: "#8a8a93",
  textFaint: "#57575e",
  accent: "#ff5a1f",
  accentDim: "#7a2c10",
  radius: "2px",
  fontDisplay: '"Syne", sans-serif',
  fontBody: '"Plus Jakarta Sans", sans-serif',
  fontMono: '"JetBrains Mono", monospace',
  modalOverlay: "rgba(0, 0, 0, 0.72)",
};

export function themeToCssVars(theme: ConnectTheme = {}): Record<string, string> {
  const merged = { ...defaultDarkTheme, ...theme };
  return {
    "--apkaya-bg": merged.bg!,
    "--apkaya-surface": merged.surface!,
    "--apkaya-surface-raised": merged.surfaceRaised!,
    "--apkaya-border": merged.border!,
    "--apkaya-border-strong": merged.borderStrong!,
    "--apkaya-text": merged.text!,
    "--apkaya-text-dim": merged.textDim!,
    "--apkaya-text-faint": merged.textFaint!,
    "--apkaya-accent": merged.accent!,
    "--apkaya-accent-dim": merged.accentDim!,
    "--apkaya-radius": merged.radius!,
    "--apkaya-font-display": merged.fontDisplay!,
    "--apkaya-font-body": merged.fontBody!,
    "--apkaya-font-mono": merged.fontMono!,
    "--apkaya-modal-overlay": merged.modalOverlay!,
  };
}

export function applyTheme(element: HTMLElement, theme?: ConnectTheme): void {
  const vars = themeToCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
}

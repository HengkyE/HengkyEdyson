/**
 * Portfolio themes: dark (futuristic) and light (clean white).
 * Used only for portfolio routes. Toggle via PortfolioThemeContext.
 */

export type PortfolioThemeMode = "dark" | "light";

export interface PortfolioThemeColors {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceCard: string;
  border: string;
  borderBright: string;
  accent: string;
  accentDim: string;
  accentGlow: string;
  text: string;
  textMuted: string;
  textSoft: string;
  white: string;
}

/** Dark: futuristic cyan-on-dark */
export const PortfolioColorsDark: PortfolioThemeColors = {
  background: "#0a0b0f",
  backgroundElevated: "rgba(15, 23, 42, 0.7)",
  surface: "rgba(30, 41, 59, 0.4)",
  surfaceCard: "rgba(30, 41, 59, 0.5)",
  border: "rgba(34, 211, 238, 0.25)",
  borderBright: "rgba(34, 211, 238, 0.5)",
  accent: "#22d3ee",
  accentDim: "rgba(34, 211, 238, 0.15)",
  accentGlow: "rgba(34, 211, 238, 0.35)",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textSoft: "#64748b",
  white: "#ffffff",
};

/** Light: clean white, soft and aesthetic */
export const PortfolioColorsLight: PortfolioThemeColors = {
  background: "#f8fafc",
  backgroundElevated: "#ffffff",
  surface: "rgba(241, 245, 249, 0.8)",
  surfaceCard: "#ffffff",
  border: "rgba(148, 163, 184, 0.35)",
  borderBright: "rgba(100, 116, 139, 0.5)",
  accent: "#0ea5e9",
  accentDim: "rgba(14, 165, 233, 0.12)",
  accentGlow: "rgba(14, 165, 233, 0.25)",
  text: "#1e293b",
  textMuted: "#64748b",
  textSoft: "#94a3b8",
  white: "#ffffff",
};

/** @deprecated Use getPortfolioColors(mode) or context. Kept for backward compatibility. */
export const PortfolioColors = PortfolioColorsDark;

export function getPortfolioColors(mode: PortfolioThemeMode): PortfolioThemeColors {
  return mode === "light" ? PortfolioColorsLight : PortfolioColorsDark;
}

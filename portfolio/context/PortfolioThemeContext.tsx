import {
  getPortfolioColors,
  type PortfolioThemeColors,
  type PortfolioThemeMode,
} from "@/portfolio/constants/portfolio-theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "portfolio_theme_mode";

interface PortfolioThemeContextType {
  mode: PortfolioThemeMode;
  setMode: (mode: PortfolioThemeMode) => void;
  toggleMode: () => void;
  colors: PortfolioThemeColors;
  isDark: boolean;
}

const PortfolioThemeContext = createContext<PortfolioThemeContextType | undefined>(undefined);

export function PortfolioThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<PortfolioThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
        }
      })
      .catch(() => {
        // e.g. web without storage; keep default mode
      });
  }, []);

  const setMode = useCallback((newMode: PortfolioThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = getPortfolioColors(mode);
  const isDark = mode === "dark";

  const value: PortfolioThemeContextType = {
    mode,
    setMode,
    toggleMode,
    colors,
    isDark,
  };

  return (
    <PortfolioThemeContext.Provider value={value}>
      {children}
    </PortfolioThemeContext.Provider>
  );
}

export function usePortfolioTheme() {
  const ctx = useContext(PortfolioThemeContext);
  if (ctx === undefined) {
    throw new Error("usePortfolioTheme must be used within PortfolioThemeProvider");
  }
  return ctx;
}

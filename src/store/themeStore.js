"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_CONFIG } from "@/shared/constants/config";
import { THEMES } from "@/shared/constants/themes";

const useThemeStore = create(
  persist(
    (set, get) => ({
      themeId: "default-light", // Default starting theme
      themeType: "light", // Track whether the current theme is inherently dark or light
      customThemes: [], // Array to hold imported custom themes

      setTheme: (themeId) => {
        const state = get();
        // Look in default themes first, then custom themes
        const themeDef = THEMES.find(t => t.id === themeId) || 
                         state.customThemes.find(t => t.id === themeId) || 
                         THEMES[0];
                         
        set({ themeId: themeDef.id, themeType: themeDef.type });
        applyTheme(themeDef);
      },

      addCustomTheme: (themeDef) => {
        set((state) => {
          // Prevent duplicates by ID
          const filtered = state.customThemes.filter(t => t.id !== themeDef.id);
          return { customThemes: [...filtered, themeDef] };
        });
      },

      removeCustomTheme: (themeId) => {
        set((state) => ({
          customThemes: state.customThemes.filter(t => t.id !== themeId),
          // Fallback to default if the deleted theme was active
          themeId: state.themeId === themeId ? "default-light" : state.themeId
        }));
        if (get().themeId === "default-light") {
          applyTheme(THEMES[0]);
        }
      },

      toggleTheme: () => {
        // Legacy toggle support: just flip between the two 9Router defaults
        const current = get().themeId;
        const newThemeId = current === "default-dark" ? "default-light" : "default-dark";
        const themeDef = THEMES.find(t => t.id === newThemeId);
        set({ themeId: themeDef.id, themeType: themeDef.type });
        applyTheme(themeDef);
      },

      initTheme: () => {
        const state = get();
        const themeDef = THEMES.find(t => t.id === state.themeId) || 
                         state.customThemes.find(t => t.id === state.themeId) || 
                         THEMES[0];
        applyTheme(themeDef);
      },
    }),
    {
      name: THEME_CONFIG.storageKey,
    }
  )
);

// Apply theme to document
function applyTheme(themeDef) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  
  // Clean up inline styles from previous custom themes
  root.removeAttribute("style");

  // Apply dark class if the theme dictates it
  if (themeDef.type === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Inject custom CSS variables if it's not a default theme
  if (themeDef.id !== "default-light" && themeDef.id !== "default-dark") {
    Object.entries(themeDef.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Automatically derive sidebar color from background if not explicitly provided
    if (!themeDef.colors["--color-sidebar"]) {
      // Create a slightly transparent version of the main background for the blur effect
      const bg = themeDef.colors["--color-bg"];
      
      // Super simple hex to rgba converter just for the sidebar fallback
      if (bg && bg.startsWith("#")) {
        const hex = bg.replace("#", "");
        let r, g, b;
        if (hex.length === 3) {
          r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
          g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
          b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
        } else {
          r = parseInt(hex.substring(0, 2), 16);
          g = parseInt(hex.substring(2, 4), 16);
          b = parseInt(hex.substring(4, 6), 16);
        }
        root.style.setProperty("--color-sidebar", `rgba(${r}, ${g}, ${b}, 0.85)`);
      }
    }
  }
}

export default useThemeStore;


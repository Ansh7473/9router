"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import useThemeStore from "@/store/themeStore";

// Subscribe to system theme changes
function subscribeToSystemTheme(callback) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// Get current system theme preference
function getSystemThemeSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Server snapshot always returns false
function getServerSnapshot() {
  return false;
}

export function useTheme() {
  const { 
    themeId, 
    themeType, 
    customThemes,
    setTheme, 
    addCustomTheme,
    removeCustomTheme,
    toggleTheme, 
    initTheme 
  } = useThemeStore();

  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return {
    themeId,
    customThemes,
    setTheme,
    addCustomTheme,
    removeCustomTheme,
    toggleTheme,
    isDark: themeType === "dark" || (themeId === "system" && systemPrefersDark),
  };
}


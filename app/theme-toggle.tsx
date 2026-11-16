"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "finora:theme:v1";
type Theme = "light" | "dark";

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.dataset.theme === "dark";
}

function getServerThemeSnapshot() {
  return false;
}

export default function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  function toggleTheme() {
    const nextTheme: Theme = getThemeSnapshot() ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still changes for this page even if browser storage is unavailable.
    }
  }

  const actionLabel = isDark ? "Mudar para tema claro" : "Ativar tema escuro";

  return (
    <button
      className="icon-button theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label="Tema escuro"
      aria-pressed={isDark}
      title={actionLabel}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span className="sr-only">{actionLabel}</span>
    </button>
  );
}

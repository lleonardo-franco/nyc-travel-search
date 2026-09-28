"use client";

import { useSyncExternalStore } from "react";

/** Favoritos (coração) guardados no navegador, sincronizados entre abas. */
const KEY = "nyc:favoritos";
const listeners = new Set<() => void>();
const EMPTY: string[] = [];
let snapshot: string[] | null = null;

function read(): string[] {
  if (snapshot) return snapshot;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    snapshot = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    snapshot = [];
  }
  return snapshot;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    snapshot = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // armazenamento bloqueado: vale só nesta sessão
    }
    listeners.forEach((l) => l());
  };
  return { favorites, isFavorite: (id: string) => favorites.includes(id), toggle };
}

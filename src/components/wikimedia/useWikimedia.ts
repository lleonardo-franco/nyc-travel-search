"use client";

import { useEffect, useState } from "react";
import { wikimediaUserAgent, type ApiQueryResponse, type WikiFetch } from "@/lib/wikimedia";

/**
 * Busca no Wikimedia direto do navegador do visitante (CORS com origin=*).
 * Cada visitante tem a própria cota, então isso funciona mesmo quando o IP do
 * servidor está limitado. O header Api-User-Agent identifica o app, como pede a política.
 */
export const browserFetch: WikiFetch = async (url) => {
  const res = await fetch(url, { headers: { "Api-User-Agent": wikimediaUserAgent() } });
  if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
  return (await res.json()) as ApiQueryResponse;
};

// Componentes que pedem a mesma consulta ao mesmo tempo compartilham a requisição.
const inflight = new Map<string, Promise<unknown>>();

function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

function readSession<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeSession(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // modo privado/cota cheia: segue sem cache
  }
}

/**
 * Usa o resultado do servidor quando existe; se o servidor não conseguiu (`initial === undefined`),
 * carrega pelo navegador. `status` permite mostrar esqueleto enquanto carrega.
 */
export function useWikimedia<T>(
  key: string,
  initial: T | undefined,
  load: (fetcher: WikiFetch) => Promise<T>,
): { data: T | undefined; status: "ready" | "loading" | "error" } {
  const [state, setState] = useState<{ key: string; data?: T; status: "ready" | "loading" | "error" }>(() =>
    initial !== undefined ? { key, data: initial, status: "ready" } : { key, status: "loading" },
  );

  useEffect(() => {
    if (initial !== undefined) return;
    let cancelled = false;
    const cacheKey = `wm:${key}`;
    const cached = readSession<T>(cacheKey);
    const finish = (next: { data?: T; status: "ready" | "error" }) => {
      if (!cancelled) setState({ key, ...next });
    };
    if (cached !== undefined) {
      Promise.resolve().then(() => finish({ data: cached, status: "ready" }));
    } else {
      shared(cacheKey, () => load(browserFetch))
        .then((data) => {
          writeSession(cacheKey, data);
          finish({ data, status: "ready" });
        })
        .catch(() => finish({ status: "error" }));
    }
    return () => {
      cancelled = true;
    };
    // `load` muda a cada render; a chave identifica a consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, initial]);

  if (initial !== undefined) return { data: initial, status: "ready" };
  if (state.key !== key) return { data: undefined, status: "loading" };
  return { data: state.data, status: state.status };
}

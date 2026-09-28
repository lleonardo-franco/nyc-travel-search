import { cache, HOUR } from "./cache";
import { fetchJson } from "./http";
import type { Currency } from "./types";

interface FrankfurterResponse {
  base: string;
  rates: Record<string, number>;
}

// Usadas só se a API do BCE (Frankfurter) estiver fora do ar.
const FALLBACK_FROM_USD: Record<Currency, number> = { USD: 1, BRL: 5.2, EUR: 0.88 };

/** Cotações a partir do dólar, via Frankfurter (dados do Banco Central Europeu, sem chave). */
export async function usdRates(): Promise<Record<Currency, number>> {
  try {
    return await cache.memo("fx:usd", 6 * HOUR, async () => {
      const data = await fetchJson<FrankfurterResponse>(
        "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL,EUR",
        { timeoutMs: 5_000 },
      );
      return { USD: 1, BRL: data.rates.BRL, EUR: data.rates.EUR };
    });
  } catch {
    return FALLBACK_FROM_USD;
  }
}

export async function convert(amount: number, from: Currency, to: Currency): Promise<number> {
  if (from === to) return amount;
  const rates = await usdRates();
  return (amount / rates[from]) * rates[to];
}

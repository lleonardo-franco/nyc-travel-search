import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ProviderError } from "@/lib/http";

/**
 * Cliente MCP (Model Context Protocol) genérico via Streamable HTTP.
 * A conexão com cada servidor é reaproveitada entre requisições e refeita se cair.
 */

const clients = new Map<string, Promise<Client>>();

async function connect(url: string): Promise<Client> {
  const client = new Client({ name: "nyc-travel-search", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

function getClient(url: string): Promise<Client> {
  let client = clients.get(url);
  if (!client) {
    client = connect(url);
    clients.set(url, client);
    client.catch(() => clients.delete(url));
  }
  return client;
}

function drop(url: string, client: Client) {
  if (clients.get(url)) clients.delete(url);
  client.close().catch(() => {});
}

type Content = { type: string; text?: string }[];

/** Erro devolvido pela própria ferramenta (isError) — não adianta repetir a chamada. */
class ToolError extends ProviderError {}

/**
 * Chama uma ferramenta de um servidor MCP e devolve o `structuredContent`
 * (ou o JSON do primeiro bloco de texto, para servidores que não o enviam).
 */
export async function callMcpTool<T>(
  url: string,
  name: string,
  args: Record<string, unknown>,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const client = await getClient(url);
    try {
      const result = await client.callTool({ name, arguments: args }, undefined, {
        timeout: opts.timeoutMs ?? 45_000,
        signal: opts.signal,
      });
      const content = (result.content ?? []) as Content;
      const text = content.find((c) => c.type === "text")?.text;
      if (result.isError) throw new ToolError(text?.slice(0, 200) ?? `a ferramenta ${name} falhou`);
      if (result.structuredContent) return result.structuredContent as T;
      if (text) return JSON.parse(text) as T;
      throw new ToolError(`a ferramenta ${name} não retornou dados`);
    } catch (err) {
      if (err instanceof ToolError || opts.signal?.aborted || attempt >= 1) {
        if (!(err instanceof ToolError)) drop(url, client);
        throw err instanceof ProviderError ? err : new ProviderError(`MCP: ${(err as Error).message}`);
      }
      // Sessão expirada ou conexão caída: reconecta e tenta mais uma vez.
      drop(url, client);
    }
  }
}

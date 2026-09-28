import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Endpoint MCP (Streamable HTTP, modo sem sessão): cada requisição cria um servidor
 * e um transporte novos, o que funciona bem em ambientes serverless.
 *
 *   claude mcp add --transport http nyc-travel http://localhost:3000/api/mcp
 */
async function handle(request: Request): Promise<Response> {
  const limited = rateLimit(request, "mcp");
  if (limited) return limited;

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Com enableJsonResponse a resposta já está completa aqui.
    void server.close();
  }
}

export const maxDuration = 60;
export { handle as GET, handle as POST, handle as DELETE };

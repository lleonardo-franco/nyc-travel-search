/**
 * Servidor MCP via stdio — para clientes que iniciam o processo localmente
 * (Claude Desktop, Claude Code, Cursor). Ver README, seção "MCP".
 *
 *   npm run mcp:stdio
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../src/lib/mcp/server";

const server = createMcpServer();
await server.connect(new StdioServerTransport());

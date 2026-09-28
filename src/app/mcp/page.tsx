import type { Metadata } from "next";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: "Servidor MCP",
  description: "Use a busca de hotéis e voos para Nova York no Claude, ChatGPT, Cursor ou qualquer cliente MCP.",
};

const TOOLS = [
  {
    name: "search_hotels",
    text: "Hotéis em NY com preços para as datas comparando sites. Filtros: preço máximo por noite, nota mínima, bairro, distância a pontos turísticos, ordenação.",
  },
  {
    name: "get_hotel_details",
    text: "Fotos, comodidades, todas as ofertas por site (com link) e as noites mais baratas/caras das próximas semanas.",
  },
  {
    name: "search_flights",
    text: "Voos para JFK, Newark ou LaGuardia via MCP da Kiwi.com (e Google Flights com chave). Filtros de paradas, classe, flexibilidade de datas.",
  },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-ink-900 p-5 font-mono text-sm leading-relaxed text-emerald-200">
      <code>{children}</code>
    </pre>
  );
}

export default function McpPage() {
  const endpoint = `${config.siteUrl}/api/mcp`;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-12">
      <header>
        <p className="text-sm font-semibold text-violet-700">Model Context Protocol</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight text-slate-900">Use o Rumo a NY dentro do seu assistente de IA</h1>
        <p className="mt-3 text-lg text-slate-600">
          O MCP aparece aqui de dois jeitos: o site <strong>consome</strong> o servidor MCP público da Kiwi.com para buscar voos, e
          também <strong>oferece</strong> o próprio servidor MCP, com as mesmas fontes e filtros do site.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-slate-900">Ferramentas disponíveis</h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <code className="rounded bg-violet-100 px-1.5 py-0.5 text-sm font-semibold text-violet-800">{t.name}</code>
              <p className="mt-2 text-sm text-slate-600">{t.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-500">
          Há também o prompt <code>planejar_viagem_nyc</code>, que combina voo + hotel dentro de um orçamento.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-slate-900">Conectar por HTTP (Streamable HTTP)</h2>
        <p className="text-slate-600">
          Endpoint: <code className="rounded bg-slate-100 px-1.5 py-0.5">{endpoint}</code>
        </p>
        <Code>{`# Claude Code
claude mcp add --transport http rumo-a-ny ${endpoint}

# Cursor / VS Code (mcp.json)
{
  "mcpServers": {
    "rumo-a-ny": { "url": "${endpoint}" }
  }
}`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-slate-900">Conectar localmente (stdio)</h2>
        <p className="text-slate-600">Com o repositório clonado, o Claude Desktop pode iniciar o servidor direto:</p>
        <Code>{`{
  "mcpServers": {
    "rumo-a-ny": {
      "command": "npm",
      "args": ["run", "--silent", "mcp:stdio", "--prefix", "/caminho/para/nyc-travel-search"]
    }
  }
}`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-slate-900">Exemplos de pedidos</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-700">
          <li>&quot;Hotéis em Chelsea com nota 9+ de 3 a 8 de dezembro, até R$ 1.800 a noite.&quot;</li>
          <li>&quot;Voos diretos de São Paulo para Nova York saindo em 10/11 e voltando em 20/11.&quot;</li>
          <li>&quot;Monte uma viagem de Porto Alegre para NY em janeiro com orçamento de R$ 15 mil.&quot;</li>
        </ul>
      </section>
    </div>
  );
}

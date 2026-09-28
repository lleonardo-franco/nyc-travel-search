<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Projeto: Rumo a NY

- UI e textos em português (pt-BR). Preços em BRL por padrão.
- Fontes de dados ficam em `src/lib/providers/*`: cada provedor implementa a interface de `types.ts`
  e é registrado no `index.ts` do agregador. Não chame APIs externas direto das páginas.
- Filtros/ordenação são funções puras em `src/lib/filters` (com testes). Estado de filtro vai na URL
  via `window.history.replaceState` — não use `router.replace` (refaria a renderização no servidor).
- Wikimedia: use `src/lib/wikimedia.ts` (isomórfico) + `wikimedia-server.ts` (servidor) ou
  `useWikimedia` (navegador). Sempre exiba autor/licença (`<Attribution>`).
- Antes de concluir: `npm run lint && npm run typecheck && npm test && npm run build`.

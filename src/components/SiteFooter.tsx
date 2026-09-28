const SOURCES = [
  { name: "Kiwi.com MCP", href: "https://www.kiwi.com/en/pages/mcp/" },
  { name: "Xotelo", href: "https://xotelo.com" },
  { name: "LiteAPI", href: "https://liteapi.travel" },
  { name: "SerpApi", href: "https://serpapi.com" },
  { name: "Wikimedia Commons", href: "https://commons.wikimedia.org" },
  { name: "OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
  { name: "Frankfurter (câmbio BCE)", href: "https://frankfurter.dev" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <p>
          Rumo a NY é um comparador: preços e disponibilidade são das fontes parceiras e podem mudar até a reserva.
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-slate-400">Dados:</span>
          {SOURCES.map((s) => (
            <a key={s.name} href={s.href} target="_blank" rel="noreferrer" className="hover:text-slate-900">
              {s.name}
            </a>
          ))}
        </p>
      </div>
    </footer>
  );
}

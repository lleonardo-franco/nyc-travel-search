export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5" aria-busy="true" aria-label="Carregando hotel">
      <div className="mb-4 h-4 w-56 animate-pulse rounded bg-slate-200" />
      <div className="grid h-72 grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-2xl md:h-[26rem]">
        <div className="col-span-4 row-span-2 animate-pulse bg-slate-200 md:col-span-2" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="hidden animate-pulse bg-slate-100 md:block" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-24 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">Comparando preços nos sites de reserva…</p>
    </div>
  );
}

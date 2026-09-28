import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-sm font-semibold text-blue-700">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Não encontramos esta página</h1>
      <p className="mt-3 text-slate-600">O hotel pode ter saído das fontes de preço ou o link está incompleto.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/hoteis" className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          Buscar hotéis
        </Link>
        <Link href="/voos" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:border-slate-500">
          Buscar voos
        </Link>
      </div>
    </div>
  );
}

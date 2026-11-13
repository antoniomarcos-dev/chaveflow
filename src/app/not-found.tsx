import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto my-12 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm font-bold text-[#1684D8]">Página não encontrada</p>
      <h1 className="mt-2 text-2xl font-bold">
        Este conteúdo não está disponível
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Confira o endereço ou volte ao painel para continuar.
      </p>
      <Link
        href="/app"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#1684D8] px-5 text-sm font-bold text-white"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}

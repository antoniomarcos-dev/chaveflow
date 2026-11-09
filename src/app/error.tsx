"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-white p-8 space-y-4">
        <h1 className="text-xl font-bold">
          Não foi possível carregar o sistema
        </h1>
        <p>
          Verifique sua conexão e tente novamente. Se o problema continuar,
          contate o administrador.
        </p>
        <button
          className="rounded-lg bg-teal-600 px-4 py-2 text-white"
          onClick={reset}
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}

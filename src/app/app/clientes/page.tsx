import { CustomerAccessButton } from "@/components/CustomerAccessButton";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { ArrowRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireInternalSession();
  if (!ctx.roles.some((r) => ["ADMIN", "MANAGER", "SELLER"].includes(r)))
    redirect("/app");
  const db = await loadDatabaseState(),
    { q = "" } = await searchParams;
  const canManageAll = ctx.roles.some((r) => r === "ADMIN" || r === "MANAGER");
  const deals = db.deals.filter(
    (d) =>
      d.organizationId === ctx.organization.id &&
      d.status !== "DRAFT" &&
      (canManageAll || d.sellerId === ctx.profile.id),
  );
  const customers = db.customers.filter(
    (c) =>
      c.organizationId === ctx.organization.id &&
      deals.some((d) => d.customerId === c.id) &&
      `${c.fullName} ${c.email}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Relacionamento</span>
          <h1>Clientes e acessos</h1>
          <p>
            Prepare o acesso de cada comprador para acompanhar a negociação com
            a própria conta.
          </p>
        </div>
        <div className="rounded-2xl bg-teal-50 p-4 text-teal-700">
          <Users className="h-7 w-7" />
        </div>
      </header>
      <form
        className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        action="/app/clientes"
      >
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Buscar cliente por nome ou e-mail"
            placeholder="Buscar por nome ou e-mail"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
          />
        </label>
        <button className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>
      {customers.length === 0 ? (
        <section className="empty-state">
          <Users className="mx-auto h-10 w-10 text-teal-500" />
          <h2>
            {q ? "Nenhum cliente encontrado" : "Seus clientes começam aqui"}
          </h2>
          <p>
            {q
              ? "Tente buscar por outro nome ou e-mail."
              : "Abra uma negociação com os dados do comprador. Depois, gere aqui o link para ele criar a senha e acompanhar a entrega."}
          </p>
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 font-semibold text-teal-700"
          >
            Abrir negociação <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          {customers.map((customer) => {
            const customerDeals = deals.filter(
              (d) => d.customerId === customer.id,
            );
            return (
              <article
                key={customer.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 font-bold text-teal-700">
                    {customer.fullName.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-slate-900">
                      {customer.fullName}
                    </h2>
                    <p className="break-all text-sm text-slate-500">
                      {customer.email}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {customer.profileId
                    ? "Conta vinculada · gere um novo link se precisar redefinir a senha"
                    : "Acesso à conta ainda não criado"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {customerDeals.map((d) => (
                    <Link
                      key={d.id}
                      href={`/app/negociacoes/${d.id}`}
                      className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
                    >
                      {d.dealNumber} ↗
                    </Link>
                  ))}
                </div>
                <CustomerAccessButton dealId={customerDeals[0].id} />
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

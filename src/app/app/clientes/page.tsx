import { CustomerAccessButton } from "@/components/CustomerAccessButton";
import { loadDatabaseState } from "@/infrastructure/database";
import { requireInternalSession } from "@/lib/server-session";
import { ArrowRight, KeyRound, Phone, Plus, Search, Users } from "lucide-react";
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
      `${c.fullName} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <header className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="eyebrow">Relacionamento e Portal do Comprador</span>
          <h1 className="text-2xl font-extrabold text-[#172B3A] mt-1">
            Clientes e Acessos ({customers.length})
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Consulte os compradores vinculados às negociações e gerencie separadamente as credenciais de acesso ao portal.
          </p>
        </div>
        <Link
          href="/app/negociacoes/nova"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1684D8] hover:bg-[#126FB8] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Negociação</span>
        </Link>
      </header>

      <form
        className="flex gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs"
        action="/app/clientes"
      >
        <label className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            aria-label="Buscar cliente por nome ou e-mail"
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="w-full rounded-xl border border-slate-300 bg-[#F4F7FA]/60 focus:bg-white py-2 pl-10 pr-3.5 text-xs sm:text-sm text-[#172B3A]"
          />
        </label>
        <button className="rounded-xl bg-[#0B3B70] hover:bg-[#1684D8] px-4 py-2 text-xs sm:text-sm font-bold text-white transition">
          Buscar
        </button>
      </form>

      {customers.length === 0 ? (
        <section className="empty-state">
          <Users className="mx-auto h-10 w-10 text-[#1684D8]" />
          <h2>
            {q ? "Nenhum cliente encontrado" : "Seus clientes começam aqui"}
          </h2>
          <p>
            {q
              ? "Tente buscar por outro nome, e-mail ou telefone."
              : "Abra uma negociação com os dados do comprador. Depois, gere aqui o link para ele criar a senha e acompanhar a entrega."}
          </p>
          <Link
            href="/app/negociacoes/nova"
            className="inline-flex items-center gap-2 font-bold text-[#1684D8] hover:underline"
          >
            Abrir negociação <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-[#F4F7FA]/50">
            <div className="text-xs font-bold text-[#172B3A]">
              Compradores vinculados às negociações ativas e concluídas
            </div>
            <span className="text-[11px] text-slate-500">
              Dados pessoais sensíveis preservados (exibindo apenas identificação essencial)
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const customerDeals = deals.filter(
                (d) => d.customerId === customer.id,
              );
              const initials = customer.fullName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("");

              return (
                <article
                  key={customer.id}
                  className="p-5 sm:p-6 grid lg:grid-cols-12 gap-5 items-start hover:bg-[#F4F7FA]/40 transition"
                >
                  {/* Bloco 1: Dados essenciais do comprador */}
                  <div className="lg:col-span-5 flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF3FC] border border-[#1684D8]/30 font-extrabold text-xs text-[#0B3B70]">
                      {initials}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-extrabold text-[#172B3A] text-sm sm:text-base">
                          {customer.fullName}
                        </h2>
                        <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {customer.personType}
                        </span>
                      </div>
                      <p className="break-all text-xs text-slate-600">
                        {customer.email}
                      </p>
                      {customer.phone && (
                        <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{customer.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bloco 2: Negociações vinculadas */}
                  <div className="lg:col-span-3 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Negociações ({customerDeals.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {customerDeals.map((d) => (
                        <Link
                          key={d.id}
                          href={`/app/negociacoes/${d.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#EAF3FC] hover:bg-[#1684D8] text-[#0B3B70] hover:text-white border border-[#1684D8]/30 px-2.5 py-1.5 text-xs font-mono font-bold transition"
                        >
                          <span>{d.dealNumber}</span>
                          <span>↗</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Bloco 3: Credenciais e Acesso ao Portal (Separado dos dados cadastrais) */}
                  <div className="lg:col-span-4 rounded-xl bg-[#F4F7FA] border border-slate-200/80 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B3B70]">
                        <KeyRound className="h-3.5 w-3.5 text-[#1684D8]" />
                        <span>Credencial do Portal do Cliente</span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          customer.profileId
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {customer.profileId ? "Conta ativa" : "Sem senha definida"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {customer.profileId
                        ? "Conta vinculada · gere um novo link caso o comprador precise redefinir a senha."
                        : "Acesso à conta ainda não ativado pelo comprador."}
                    </p>
                    <CustomerAccessButton
                      dealId={customerDeals[0].id}
                      compact
                      isAccountActive={Boolean(customer.profileId)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import { getServerSessionContext } from "@/lib/server-session";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";

const areas = [
  {
    code: "admin",
    number: "01",
    label: "Administração",
    title: "Uma equipe bem conectada.",
    description:
      "Cadastre vendedores, organize os acessos e acompanhe a operação da concessionária.",
    action: "Acessar administração",
    Icon: ShieldCheck,
  },
  {
    code: "vendedor",
    number: "02",
    label: "Equipe de vendas",
    title: "Cada negociação, no caminho certo.",
    description:
      "Gerencie suas vendas, acompanhe documentos e prepare o acesso dos seus clientes.",
    action: "Acessar painel de vendas",
    Icon: Users,
  },
  {
    code: "cliente",
    number: "03",
    label: "Área do cliente",
    title: "Mais perto das suas chaves.",
    description:
      "Acompanhe as etapas da sua compra, envie documentos e veja as atualizações da entrega.",
    action: "Acompanhar minha compra",
    Icon: CircleUserRound,
  },
];
export default async function HomePage() {
  const ctx = await getServerSessionContext();
  const dashboard = ctx?.profile.isCustomerOnly ? "/cliente" : "/app";
  return (
    <div className="home-page min-h-screen bg-[#F4F7FA] text-[#172B3A]">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="AUTOFLOW, início"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0B3B70] text-white shadow-sm">
              <KeyRound className="h-6 w-6 text-[#7CC4FA]" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#0B3B70]">
              <span className="text-[#1684D8] mr-1">//</span>AUTO<span className="text-[#1684D8]">FLOW</span>
              <span className="mt-0.5 block text-[10px] font-semibold tracking-wide text-slate-500">
                Sua operação conectada do início ao fim.
              </span>
            </span>
          </Link>
          <span className="hidden md:inline-flex items-center rounded-xl bg-[#EAF3FC] border border-[#1684D8]/30 px-3 py-1.5 text-xs font-bold text-[#0B3B70]">
            Unidade: Pinauto BYD — Ceres/GO
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm font-semibold">
          <a
            href="#acessos"
            className="hidden text-slate-600 hover:text-[#1684D8] sm:block"
          >
            Nossas áreas
          </a>
          <Link
            href={ctx ? dashboard : "/login"}
            className="inline-flex items-center gap-2 rounded-full bg-[#0B3B70] px-5 py-3 text-white transition hover:bg-[#1684D8]"
          >
            {ctx ? "Continuar no painel" : "Entrar no sistema"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>
      <main>
        <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:pb-24">
          <div className="relative z-10">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#1684D8]/30 bg-[#EAF3FC] px-3.5 py-2 text-xs font-bold text-[#0B3B70]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1684D8]" />
              AUTOFLOW · Sua operação conectada do início ao fim.
            </span>
            <h1 className="max-w-2xl text-[clamp(2.75rem,5.7vw,5rem)] font-extrabold leading-[1.06] tracking-[-0.055em] text-[#172B3A]">
              Uma jornada mais simples.
              <br />
              <span className="text-[#1684D8]">Até a entrega das chaves.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
              Da abertura da negociação à liberação autorizada do veículo. Uma plataforma limpa e conectada para integrar vendas, financeiro, documentação, faturamento e pátio na Pinauto BYD.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href={ctx ? dashboard : "/login"}
                className="inline-flex items-center gap-3 rounded-full bg-[#1684D8] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-[#1684D8]/20 transition hover:-translate-y-0.5 hover:bg-[#126FB8]"
              >
                {ctx ? "Abrir meu painel" : "Acessar minha conta"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#acessos"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#0B3B70]"
              >
                Encontre sua área
                <ArrowDown className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-[#1684D8]" />
              Acesso individual. Liberação condicionada aos requisitos obrigatórios e aprovações formais.
            </p>
          </div>
          <div className="journey-art relative overflow-hidden rounded-[2rem] bg-[#0B3B70] p-7 text-white shadow-2xl shadow-slate-900/10 sm:p-10">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[45px] border-[#1684D8]/20" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#1684D8]/10" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7CC4FA]">
                  Pinauto BYD — Ceres/GO
                </span>
                <Sparkles className="h-5 w-5 text-[#7CC4FA]" />
              </div>
              <div className="mt-9 flex items-center gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.6rem] bg-[#1684D8] text-white shadow-xl shadow-black/20">
                  <KeyRound className="h-10 w-10" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-xs text-blue-200">Passaporte Digital da Negociação</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight">
                    Tudo conectado.
                    <br />
                    Cada etapa importa.
                  </h2>
                </div>
              </div>
              <div className="mt-10 space-y-3">
                {[
                  {
                    icon: Users,
                    title: "Começa com as pessoas",
                    text: "Equipe e cliente com seu próprio acesso.",
                  },
                  {
                    icon: ClipboardCheck,
                    title: "Segue com clareza",
                    text: "Documentos, pendências, responsáveis e próximos passos.",
                  },
                  {
                    icon: KeyRound,
                    title: "Termina em uma conquista",
                    text: "Uma entrega autorizada, auditada e acompanhada.",
                  },
                ].map((step, index) => (
                  <div
                    key={step.title}
                    className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#7CC4FA]">
                      <step.icon className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{step.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-blue-100/80">
                        {step.text}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-blue-200/70">
                      0{index + 1}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex items-center gap-2 text-xs text-blue-100/90">
                <Check className="h-4 w-4 text-[#7CC4FA]" />
                Sua operação conectada do início ao fim.
              </div>
            </div>
          </div>
        </section>
        <section id="acessos" className="border-y border-slate-200/70 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="eyebrow">Acesso por Perfil</span>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#172B3A]">
                  O seu lugar no AUTOFLOW.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                Escolha sua área e entre com seu e-mail e senha. O sistema leva
                você ao painel da sua conta.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {areas.map((area) => (
                <article
                  key={area.code}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:border-[#1684D8] hover:shadow-xl hover:shadow-slate-900/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FC] text-[#1684D8]">
                      <area.Icon className="h-6 w-6" strokeWidth={1.5} />
                    </span>
                    <span className="text-xs font-medium text-slate-300">
                      {area.number}
                    </span>
                  </div>
                  <span className="mt-7 text-xs font-bold uppercase tracking-widest text-[#1684D8]">
                    {area.label}
                  </span>
                  <h3 className="mt-3 text-xl font-bold leading-snug tracking-tight text-[#172B3A]">
                    {area.title}
                  </h3>
                  <p className="mb-7 mt-3 flex-1 text-sm leading-relaxed text-slate-500">
                    {area.description}
                  </p>
                  <Link
                    href={`/login?area=${area.code}`}
                    className="inline-flex items-center justify-between gap-2 border-t border-slate-100 pt-5 text-sm font-bold text-[#0B3B70] group-hover:text-[#1684D8]"
                  >
                    {area.action}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:px-8">
        <p>AUTOFLOW — Sua operação conectada do início ao fim.</p>
        <p>Unidade: Pinauto BYD — Ceres/GO</p>
      </footer>
    </div>
  );
}

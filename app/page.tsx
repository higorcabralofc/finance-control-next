import { ArrowDownRight, ArrowUpRight, CreditCard, PiggyBank, Wallet } from "lucide-react";

const cards = [
  {
    label: "Saldo atual",
    value: "R$ 12.840,50",
    change: "+8,2% no mes",
    icon: Wallet,
    tone: "text-emerald-300",
  },
  {
    label: "Receitas",
    value: "R$ 7.250,00",
    change: "+12,4%",
    icon: ArrowUpRight,
    tone: "text-sky-300",
  },
  {
    label: "Despesas",
    value: "R$ 4.380,90",
    change: "-3,1%",
    icon: ArrowDownRight,
    tone: "text-rose-300",
  },
  {
    label: "Metas",
    value: "68%",
    change: "R$ 18.400 guardados",
    icon: PiggyBank,
    tone: "text-amber-300",
  },
];

const transactions = [
  ["Salario", "Receita", "+ R$ 6.800,00"],
  ["Mercado", "Alimentacao", "- R$ 486,20"],
  ["Cartao Nubank", "Cartao", "- R$ 1.240,00"],
  ["Reserva de emergencia", "Investimento", "+ R$ 850,00"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-300">Finance Control</p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Controle suas financas com clareza</h1>
          </div>
          <button className="inline-flex w-fit items-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300">
            <CreditCard size={18} /> Nova transacao
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">{card.label}</span>
                  <Icon className={card.tone} size={21} />
                </div>
                <strong className="mt-5 block text-2xl font-semibold text-white">{card.value}</strong>
                <p className="mt-2 text-sm text-slate-400">{card.change}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-white">Resumo mensal</h2>
              <span className="rounded-md bg-white/10 px-3 py-1 text-sm text-slate-300">Maio 2026</span>
            </div>
            <div className="flex h-72 items-end gap-3">
              {[46, 70, 54, 88, 64, 95, 78, 84].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-3">
                  <div className="w-full rounded-t-md bg-emerald-400/80" style={{ height: `${height}%` }} />
                  <span className="text-xs text-slate-500">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Ultimas transacoes</h2>
            <div className="mt-5 divide-y divide-white/10">
              {transactions.map(([name, category, amount]) => (
                <div key={name} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium text-white">{name}</p>
                    <p className="text-sm text-slate-400">{category}</p>
                  </div>
                  <span className={amount.startsWith("+") ? "text-emerald-300" : "text-slate-200"}>{amount}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Home,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

type TransactionKind = "income" | "expense";
type FilterKind = "all" | TransactionKind;

type Transaction = {
  id: number;
  title: string;
  category: string;
  date: string;
  amount: number;
  kind: TransactionKind;
};

const initialTransactions: Transaction[] = [
  { id: 1, title: "Salário", category: "Trabalho", date: "Hoje, 09:42", amount: 6800, kind: "income" },
  { id: 2, title: "Mercado Pão de Açúcar", category: "Alimentação", date: "Hoje, 08:16", amount: 286.42, kind: "expense" },
  { id: 3, title: "Conta de internet", category: "Moradia", date: "Ontem, 17:38", amount: 119.9, kind: "expense" },
  { id: 4, title: "Freelance · Projeto Aurora", category: "Trabalho", date: "05 nov, 14:20", amount: 1250, kind: "income" },
  { id: 5, title: "Uber", category: "Transporte", date: "05 nov, 09:05", amount: 32.8, kind: "expense" },
];

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Visão geral", href: "#inicio", icon: LayoutDashboard },
  { label: "Transações", href: "#transacoes", icon: ArrowLeftRight },
  { label: "Orçamento", href: "#orcamento", icon: Wallet },
  { label: "Objetivos", href: "#metas", icon: Target },
  { label: "Cartões", href: "#indicadores", icon: CreditCard },
  { label: "Fluxo do dinheiro", href: "#fluxo", icon: ArrowUpRight },
];

const chartData = [
  { month: "Jan", income: 5900, expense: 4200 },
  { month: "Fev", income: 6500, expense: 3900 },
  { month: "Mar", income: 6200, expense: 4600 },
  { month: "Abr", income: 7100, expense: 4300 },
  { month: "Mai", income: 6800, expense: 4100 },
  { month: "Jun", income: 7400, expense: 4900 },
  { month: "Jul", income: 6900, expense: 4400 },
  { month: "Ago", income: 7800, expense: 4700 },
  { month: "Set", income: 7200, expense: 4500 },
  { month: "Out", income: 8100, expense: 4800 },
  { month: "Nov", income: 7250, expense: 4380 },
  { month: "Dez", income: 0, expense: 0 },
];

const budgets = [
  { name: "Alimentação", spent: 1486, limit: 2200, icon: Utensils, color: "mint" },
  { name: "Moradia", spent: 1850, limit: 2500, icon: Home, color: "blue" },
  { name: "Transporte", spent: 548, limit: 900, icon: Car, color: "orange" },
  { name: "Compras", spent: 390, limit: 700, icon: ShoppingBag, color: "purple" },
];

const categoryIcon: Record<string, LucideIcon> = {
  Trabalho: BriefcaseBusiness,
  Alimentação: Utensils,
  Moradia: Home,
  Transporte: Car,
  Compras: ShoppingBag,
  Assinaturas: Smartphone,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const months = ["Novembro 2026", "Outubro 2026", "Setembro 2026"];

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  return (
    <div className="month-picker-wrap" ref={pickerRef} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <button type="button" className="month-picker" aria-label="Selecionar mês" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <CalendarDays size={16} /><span>{month}</span><ChevronDown size={14} />
      </button>
      {open && <div className="month-picker-menu" role="listbox" aria-label="Meses disponíveis">
        {months.map((option) => <button key={option} type="button" role="option" aria-selected={month === option} className={`month-option ${month === option ? "month-option-active" : ""}`} onClick={() => { onChange(option); setOpen(false); }}>
          <span>{option}</span>{month === option && <Check size={14} />}
        </button>)}
      </div>}
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <a className="brand" href="#inicio" onClick={onClose} aria-label="Finance Control — início">
          <span className="brand-mark"><span /><span /><span /></span>
          <span className="brand-name">fin<span>ora</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">P</span>
          <span className="workspace-label"><small>ESPAÇO</small><strong>Finanças pessoais</strong></span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-caption">MENU PRINCIPAL</p>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navigation.map(({ label, href, icon: Icon }, index) => (
            <a key={href} href={href} onClick={onClose} className={`nav-link ${index === 0 ? "nav-link-active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {index === 1 && <span className="nav-count">5</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><PiggyBank size={17} /></div>
            <p>Pequenos passos.<br /><strong>Grandes conquistas.</strong></p>
            <a href="#metas">Ver minhas metas <ArrowUpRight size={14} /></a>
            <span className="upgrade-orbit orbit-one" /><span className="upgrade-orbit orbit-two" />
          </div>
          <button className="profile-button" type="button">
            <span className="profile-avatar">FC</span>
            <span className="profile-copy"><strong>Minha conta</strong><small>Plano pessoal</small></span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
  hidden,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: string;
  hidden?: boolean;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={1.8} /></span></div>
      <strong className="metric-value">{hidden ? "••••••" : value}</strong>
      <p className="metric-note"><span className="trend-pill"><ArrowUpRight size={12} /> {note.split(" ")[0]}</span><span>{note.split(" ").slice(1).join(" ")}</span></p>
    </article>
  );
}

function CashflowChart({ hidden }: { hidden: boolean }) {
  const [range, setRange] = useState<6 | 12>(6);
  const data = chartData.slice(-range - (range === 6 ? 1 : 0), -1);
  const max = 9000;
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 0 : (index / (data.length - 1)) * 100;
    const y = 94 - (item.income / max) * 78;
    return `${x},${y}`;
  }).join(" ");
  const area = `0,100 ${points} 100,100`;
  return (
    <section className="panel cashflow-panel" id="fluxo">
      <div className="panel-heading">
        <div><p className="eyebrow">UM OLHAR DE CADA VEZ</p><h2>Fluxo do seu dinheiro</h2><p className="panel-subtitle">Entradas e saídas ao longo do ano</p></div>
        <div className="segmented-control" role="group" aria-label="Período do gráfico">
          <button className={range === 6 ? "segment-active" : ""} onClick={() => setRange(6)}>6 meses</button>
          <button className={range === 12 ? "segment-active" : ""} onClick={() => setRange(12)}>12 meses</button>
        </div>
      </div>
      <div className="chart-legend"><span><i className="legend-dot legend-income" />Receitas</span><span><i className="legend-dot legend-expense" />Despesas</span><span className="chart-total">{hidden ? "••••••" : "+ R$ 2.869,10"}</span></div>
      <div className="chart-wrap">
        <div className="chart-grid-lines"><span>R$ 9 mil</span><span>R$ 6 mil</span><span>R$ 3 mil</span><span>R$ 0</span></div>
        <svg className="cashflow-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gráfico de receitas e despesas dos últimos meses">
          <defs><linearGradient id="income-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#75d6a2" stopOpacity=".25" /><stop offset="100%" stopColor="#75d6a2" stopOpacity="0" /></linearGradient></defs>
          {[16, 42, 68, 94].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid-line" />)}
          <polygon points={area} fill="url(#income-fill)" />
          <polyline points={data.map((item, index) => `${data.length <= 1 ? 0 : (index / (data.length - 1)) * 100},${94 - (item.expense / max) * 78}`).join(" ")} className="chart-expense-line" />
          <polyline points={points} className="chart-income-line" />
          {data.map((item, index) => <circle key={item.month} cx={data.length <= 1 ? 0 : (index / (data.length - 1)) * 100} cy={94 - (item.income / max) * 78} r="1.6" className="chart-income-point" />)}
        </svg>
        <div className="chart-months">{data.map((item) => <span key={item.month}>{item.month}</span>)}</div>
      </div>
      <div className="chart-footnote"><span><span className="footnote-dot" /> Você guardou <strong>28% da renda</strong> este mês</span><a href="#relatorios">Ver relatório <ArrowUpRight size={14} /></a></div>
    </section>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const Icon = categoryIcon[transaction.category] || Wallet;
  const positive = transaction.kind === "income";
  return (
    <div className="transaction-row">
      <span className={`transaction-icon ${positive ? "transaction-icon-income" : ""}`}><Icon size={17} strokeWidth={1.8} /></span>
      <span className="transaction-name"><strong>{transaction.title}</strong><small>{transaction.category} <span>·</span> {transaction.date}</small></span>
      <span className={`transaction-amount ${positive ? "amount-positive" : ""}`}>{positive ? "+ " : "− "}{formatCurrency(transaction.amount)}</span>
      <button className="row-more" aria-label={`Mais opções para ${transaction.title}`} type="button"><MoreHorizontal size={18} /></button>
    </div>
  );
}

function NewTransactionModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, "id" | "date">) => void;
}) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Alimentação");
  const [amount, setAmount] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = Number(amount.replace(",", "."));
    if (!title.trim() || !numericAmount || numericAmount <= 0) return;
    onSave({ title: title.trim(), category, amount: numericAmount, kind });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><p className="eyebrow">SEU DINHEIRO, NO SEU RITMO</p><h2 id="modal-title">Nova transação</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <div className="kind-switch" role="group" aria-label="Tipo de transação">
            <button type="button" className={kind === "expense" ? "kind-active kind-expense" : ""} onClick={() => setKind("expense")}><ArrowDownLeft size={16} /> Despesa</button>
            <button type="button" className={kind === "income" ? "kind-active kind-income" : ""} onClick={() => setKind("income")}><ArrowUpRight size={16} /> Receita</button>
          </div>
          <label className="form-label">Descrição<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: almoço de domingo" autoFocus required /></label>
          <div className="form-row">
            <label className="form-label">Valor (R$)<input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" inputMode="decimal" required /></label>
            <label className="form-label">Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Alimentação</option><option>Moradia</option><option>Transporte</option><option>Compras</option><option>Trabalho</option><option>Assinaturas</option></select></label>
          </div>
          <div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> Salvar transação</button></div>
        </form>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [month, setMonth] = useState("Novembro 2026");

  const visibleTransactions = useMemo(() => transactions.filter((transaction) => {
    const matchesFilter = filter === "all" || transaction.kind === filter;
    const matchesSearch = `${transaction.title} ${transaction.category}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    return matchesFilter && matchesSearch;
  }), [transactions, filter, search]);

  function announce(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function saveTransaction(transaction: Omit<Transaction, "id" | "date">) {
    setTransactions((current) => [{ ...transaction, id: Date.now(), date: "Agora mesmo" }, ...current]);
    setModalOpen(false);
    setFilter("all");
    announce("Transação adicionada com sucesso.");
  }

  function exportTransactions() {
    const rows = [["Descrição", "Categoria", "Tipo", "Valor"], ...transactions.map((item) => [item.title, item.category, item.kind === "income" ? "Receita" : "Despesa", item.amount.toFixed(2).replace(".", ",")])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transacoes-finora.csv";
    link.click();
    URL.revokeObjectURL(url);
    announce("Seu arquivo CSV está pronto.");
  }

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Finanças pessoais</span><span className="breadcrumb-divider">/</span><strong>Visão geral</strong></div>
          <div className="topbar-actions">
            <MonthPicker month={month} onChange={setMonth} />
            {searchOpen && <input className="top-search-input" autoFocus placeholder="Buscar transação..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar transação" />}
            <button className={`icon-button search-toggle ${searchOpen ? "icon-button-active" : ""}`} type="button" aria-label="Buscar" onClick={() => { setSearchOpen((value) => !value); setSearch(""); }}><Search size={18} /></button>
            <button className="icon-button notification-button" type="button" aria-label="Notificações" onClick={() => announce("Você está em dia com as suas finanças.")}><Bell size={18} /><i /></button>
            <span className="topbar-avatar" aria-label="Perfil">FC</span>
          </div>
        </header>

        <div className="page-content" id="inicio">
          <section className="welcome-row">
            <div><p className="eyebrow welcome-eyebrow">SÁBADO, 7 DE NOVEMBRO</p><h1>Seu dinheiro, <span>em perspectiva.</span></h1><p className="welcome-subtitle">Um resumo tranquilo para tomar decisões com confiança.</p></div>
            <button className="button-primary add-transaction" onClick={() => setModalOpen(true)}><Plus size={17} strokeWidth={2.3} /> Nova transação</button>
          </section>

          <section className="balance-banner" aria-label="Resumo do saldo">
            <div className="balance-content"><span className="balance-label"><Wallet size={16} /> SALDO TOTAL</span><div className="balance-amount-row"><strong>{hidden ? "••••••••" : "R$ 12.840,50"}</strong><button className="balance-eye" type="button" onClick={() => setHidden((value) => !value)} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><p><span className="balance-change"><ArrowUpRight size={14} /> 8,2%</span> em relação ao mês passado</p></div>
            <div className="balance-breakdown"><div><span>Receitas do mês</span><strong>{hidden ? "••••••" : "R$ 7.250,00"}</strong></div><div><span>Despesas do mês</span><strong>{hidden ? "••••••" : "R$ 4.380,90"}</strong></div><div><span>Você poupou</span><strong className="balance-saved">28,5%</strong></div></div>
            <div className="banner-decoration banner-ring-one" /><div className="banner-decoration banner-ring-two" /><div className="banner-decoration banner-orb" />
          </section>

          <section className="metrics-grid" id="indicadores" aria-label="Indicadores do mês">
            <MetricCard label="Receitas" value="R$ 7.250,00" note="12,4% vs. mês anterior" icon={ArrowUpRight} tone="metric-mint" hidden={hidden} />
            <MetricCard label="Despesas" value="R$ 4.380,90" note="3,1% vs. mês anterior" icon={ArrowDownLeft} tone="metric-peach" hidden={hidden} />
            <MetricCard label="Investimentos" value="R$ 18.400,00" note="6,8% no acumulado" icon={TrendingUp} tone="metric-lilac" hidden={hidden} />
            <MetricCard label="Limite do cartão" value="R$ 2.760,00" note="46% do limite usado" icon={CreditCard} tone="metric-blue" hidden={hidden} />
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-main-column">
              <CashflowChart hidden={hidden} />
              <section className="panel transactions-panel" id="transacoes">
                <div className="panel-heading transactions-heading"><div><p className="eyebrow">MOVIMENTAÇÕES RECENTES</p><h2>Últimas transações</h2></div><div className="transaction-actions"><button className="outline-button export-button" onClick={exportTransactions}><Download size={15} /> Exportar</button><a className="text-link" href="#transacoes">Ver todas <ArrowUpRight size={14} /></a></div></div>
                <div className="transaction-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filtrar transações"><button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "filter-active" : ""} onClick={() => setFilter("all")}>Todas <span>{transactions.length}</span></button><button role="tab" aria-selected={filter === "income"} className={filter === "income" ? "filter-active" : ""} onClick={() => setFilter("income")}>Entradas</button><button role="tab" aria-selected={filter === "expense"} className={filter === "expense" ? "filter-active" : ""} onClick={() => setFilter("expense")}>Saídas</button></div><span className="transaction-month">{month}</span></div>
                <div className="transaction-list">{visibleTransactions.length ? visibleTransactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />) : <p className="empty-state">Nenhuma transação encontrada.</p>}</div>
              </section>
            </div>

            <div className="dashboard-side-column">
              <section className="panel budget-panel" id="orcamento">
                <div className="panel-heading compact-heading"><div><p className="eyebrow">GASTOS COM INTENÇÃO</p><h2>Orçamento mensal</h2></div><button className="icon-button small-icon-button" aria-label="Mais opções de orçamento"><MoreHorizontal size={18} /></button></div>
                <div className="budget-total-row"><span>Já utilizado</span><strong>{hidden ? "••••••" : "R$ 4.274,00"}<small> de R$ 6.300</small></strong></div>
                <div className="budget-meter"><span style={{ width: "68%" }} /></div>
                <p className="budget-hint"><span className="budget-hint-dot" /> Você ainda tem <strong>{hidden ? "••••" : "R$ 2.026,00"}</strong> para este mês</p>
                <div className="budget-categories">{budgets.map(({ name, spent, limit, icon: Icon, color }) => <div className="budget-category" key={name}><div className="budget-category-top"><span className={`category-icon category-${color}`}><Icon size={15} /></span><span className="category-name">{name}</span><span className="category-value">{hidden ? "••••" : formatCurrency(spent)}</span></div><div className="category-track"><span className={`category-fill fill-${color}`} style={{ width: `${Math.min((spent / limit) * 100, 100)}%` }} /></div></div>)}</div>
                <a className="panel-bottom-link" href="#orcamento">Detalhar orçamento <ArrowUpRight size={14} /></a>
              </section>

              <section className="goal-card" id="metas">
                <div className="goal-top"><span className="goal-icon"><Target size={19} /></span><span className="goal-period">META · 2026</span><button className="goal-more" aria-label="Mais opções da meta"><MoreHorizontal size={18} /></button></div>
                <p className="goal-kicker">UM FUTURO MAIS LEVE</p><h2>Reserva de<br />emergência</h2><div className="goal-amounts"><strong>{hidden ? "••••••" : "R$ 8.400"}</strong><span>de R$ 12.000</span></div>
                <div className="goal-progress"><span /></div><div className="goal-progress-meta"><span>70% concluído</span><span>Faltam R$ 3.600</span></div>
                <div className="goal-footer"><span className="goal-spark"><Check size={13} /></span> Você está no caminho certo</div><span className="goal-decoration" />
              </section>

              <section className="insight-card"><span className="insight-icon"><PiggyBank size={17} /></span><div><p className="eyebrow">UM BOM HÁBITO</p><p>Você guardou <strong>R$ 850</strong> a mais do que no mês passado. Continue assim.</p></div><ArrowUpRight className="insight-arrow" size={16} /></section>
            </div>
          </div>
          <footer className="page-footer"><span>Finora <span>·</span> cuidado com o seu dinheiro, sem complicação.</span><span>Seus dados ficam só com você <span className="footer-lock">◆</span></span></footer>
        </div>
      </main>
      {modalOpen && <NewTransactionModal onClose={() => setModalOpen(false)} onSave={saveTransaction} />}
      {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}</div>}
    </div>
  );
}

function TrendingUpIcon(props: React.ComponentProps<LucideIcon>) {
  return <ArrowUpRight {...props} />;
}

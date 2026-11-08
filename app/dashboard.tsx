"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Tag,
  Target,
  Trash2,
  TrendingUp,
  Utensils,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  CreditCardManager,
  buildCreditCardInvoices,
  cardInvoiceCategory,
  cardStorageKey,
  isStoredCreditCardStore,
  type CardPurchase,
  type CreditCardAccount,
  type CreditCardInvoice,
  type CreditCardStore,
} from "./credit-cards";

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

type DebtInstallment = {
  number: number;
  amount: number;
  dueDate: string;
  paidTransactionId?: number;
};

type InstallmentDebt = {
  id: number;
  title: string;
  category: string;
  totalAmount: number;
  installments: DebtInstallment[];
};

type FinancialGoal = {
  id: number;
  title: string;
  targetAmount: number;
  savedAmount: number;
};

const initialTransactions: Transaction[] = [];

function isStoredTransaction(value: unknown): value is Transaction {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" && Number.isFinite(item.id)
    && typeof item.title === "string" && item.title.trim().length > 0
    && typeof item.category === "string" && item.category.trim().length > 0
    && typeof item.date === "string"
    && typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount > 0
    && (item.kind === "income" || item.kind === "expense");
}

function isDateInputValue(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isStoredDebt(value: unknown): value is InstallmentDebt {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" && Number.isFinite(item.id)
    && typeof item.title === "string" && item.title.trim().length > 0
    && typeof item.category === "string" && item.category.trim().length > 0
    && typeof item.totalAmount === "number" && Number.isFinite(item.totalAmount) && item.totalAmount > 0
    && Array.isArray(item.installments) && item.installments.length > 0
    && item.installments.every((value) => {
      if (typeof value !== "object" || value === null) return false;
      const installment = value as Record<string, unknown>;
      return typeof installment.number === "number" && Number.isInteger(installment.number) && installment.number > 0
        && typeof installment.amount === "number" && Number.isFinite(installment.amount) && installment.amount >= 0
        && isDateInputValue(installment.dueDate)
        && (installment.paidTransactionId === undefined || (typeof installment.paidTransactionId === "number" && Number.isFinite(installment.paidTransactionId)));
    });
}

function isStoredGoal(value: unknown): value is FinancialGoal {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" && Number.isFinite(item.id)
    && typeof item.title === "string" && item.title.trim().length > 0
    && typeof item.targetAmount === "number" && Number.isFinite(item.targetAmount) && item.targetAmount > 0
    && typeof item.savedAmount === "number" && Number.isFinite(item.savedAmount) && item.savedAmount >= 0;
}

function localDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthlyDueDates(firstDate: string, count: number) {
  if (!isDateInputValue(firstDate)) return [];
  const [year, month, day] = firstDate.split("-").map(Number);
  const dates: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const monthIndex = month - 1 + offset;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonthIndex = monthIndex % 12;
    const finalDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
    dates.push(localDateInputValue(new Date(targetYear, targetMonthIndex, Math.min(day, finalDay))));
  }
  return dates;
}

function displayDueDate(value: string) {
  if (!isDateInputValue(value)) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

const initialCategories: Record<TransactionKind, string[]> = {
  expense: ["Alimentação", "Moradia", "Transporte", "Compras", "Assinaturas"],
  income: ["Trabalho", "Freelance", "Investimentos", "Reembolso", "Outros"],
};

const categoryStorageKey = "finora:categories:v1";
const transactionStorageKey = "finora:transactions:v1";
const debtStorageKey = "finora:debts:v1";
const goalsStorageKey = "finora:goals:v1";
const emptyCreditCardStore: CreditCardStore = { cards: [], purchases: [], payments: [], dueDateOverrides: {} };

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Visão geral", href: "#inicio", icon: LayoutDashboard },
  { label: "Transações", href: "#transacoes", icon: ArrowLeftRight },
  { label: "Orçamento", href: "#orcamento", icon: Wallet },
  { label: "Objetivos", href: "#metas", icon: Target },
  { label: "Cartões", href: "#cartoes", icon: CreditCard },
  { label: "Fluxo do dinheiro", href: "#fluxo", icon: ArrowUpRight },
  { label: "Categorias", href: "#categorias", icon: Tag },
  { label: "Dívidas e parcelas", href: "#dividas", icon: CalendarDays },
];

const chartData = [
  { month: "Jan", income: 0, expense: 0 },
  { month: "Fev", income: 0, expense: 0 },
  { month: "Mar", income: 0, expense: 0 },
  { month: "Abr", income: 0, expense: 0 },
  { month: "Mai", income: 0, expense: 0 },
  { month: "Jun", income: 0, expense: 0 },
  { month: "Jul", income: 0, expense: 0 },
  { month: "Ago", income: 0, expense: 0 },
  { month: "Set", income: 0, expense: 0 },
  { month: "Out", income: 0, expense: 0 },
  { month: "Nov", income: 0, expense: 0 },
  { month: "Dez", income: 0, expense: 0 },
];

const budgetCategoryStyles = [
  { name: "Alimentação", icon: Utensils, color: "mint" },
  { name: "Moradia", icon: Home, color: "blue" },
  { name: "Transporte", icon: Car, color: "orange" },
  { name: "Compras", icon: ShoppingBag, color: "purple" },
];

const categoryIcon: Record<string, LucideIcon> = {
  Trabalho: BriefcaseBusiness,
  Alimentação: Utensils,
  Moradia: Home,
  Transporte: Car,
  Compras: ShoppingBag,
  Assinaturas: Smartphone,
  Freelance: BriefcaseBusiness,
  Investimentos: TrendingUp,
  Reembolso: ArrowDownLeft,
  Outros: Wallet,
  "Faturas de cartão": CreditCard,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatPercentage = (value: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
const parseCurrencyInput = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "");
  return Number(normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized);
};

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

function Sidebar({ open, onClose, transactionCount }: { open: boolean; onClose: () => void; transactionCount: number }) {
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
              {index === 1 && <span className="nav-count">{transactionCount}</span>}
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
      <p className="metric-note"><i className="metric-note-dot" />{note}</p>
    </article>
  );
}

function CashflowChart({ hidden, transactions, month }: { hidden: boolean; transactions: Transaction[]; month: string }) {
  const [range, setRange] = useState<6 | 12>(6);
  const totals = transactions.reduce((result, transaction) => {
    result[transaction.kind] += transaction.amount;
    return result;
  }, { income: 0, expense: 0 });
  const monthAbbreviation: Record<string, string> = { Novembro: "Nov", Outubro: "Out", Setembro: "Set" };
  const selectedMonth = monthAbbreviation[month.split(" ")[0]] || "Nov";
  const allData = chartData.map((item) => item.month === selectedMonth ? { ...item, ...totals } : item);
  const data = allData.slice(-range - (range === 6 ? 1 : 0), -1);
  const max = Math.max(9000, ...data.flatMap((item) => [item.income, item.expense])) * 1.05;
  const hasActivity = data.some((item) => item.income > 0 || item.expense > 0);
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
      <div className="chart-legend"><span><i className="legend-dot legend-income" />Receitas</span><span><i className="legend-dot legend-expense" />Despesas</span><span className="chart-total">{hidden ? "••••••" : formatCurrency(totals.income - totals.expense)}</span></div>
      <div className="chart-wrap">
        {hasActivity ? <>
          <div className="chart-grid-lines"><span>R$ 9 mil</span><span>R$ 6 mil</span><span>R$ 3 mil</span><span>R$ 0</span></div>
          <svg className="cashflow-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Gráfico de receitas e despesas dos últimos meses">
            <defs><linearGradient id="income-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#75d6a2" stopOpacity=".25" /><stop offset="100%" stopColor="#75d6a2" stopOpacity="0" /></linearGradient></defs>
            {[16, 42, 68, 94].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid-line" />)}
            <polygon points={area} fill="url(#income-fill)" />
            <polyline points={data.map((item, index) => `${data.length <= 1 ? 0 : (index / (data.length - 1)) * 100},${94 - (item.expense / max) * 78}`).join(" ")} className="chart-expense-line" />
            <polyline points={points} className="chart-income-line" />
            {data.map((item, index) => <circle key={item.month} cx={data.length <= 1 ? 0 : (index / (data.length - 1)) * 100} cy={94 - (item.income / max) * 78} r="1.6" className="chart-income-point" />)}
          </svg>
        </> : <div className="chart-empty-state"><span className="chart-empty-icon"><Wallet size={18} /></span><strong>Seu fluxo começa aqui</strong><small>Registre uma receita ou despesa para ver seus dados.</small></div>}
        <div className="chart-months">{data.map((item) => <span key={item.month}>{item.month}</span>)}</div>
      </div>
      <div className="chart-footnote"><span><span className="footnote-dot" /> {hasActivity ? "Valores calculados pelas movimentações registradas." : "Adicione sua primeira movimentação para começar."}</span><span>Fluxo líquido lançado: <strong>{hidden ? "••••••" : formatCurrency(totals.income - totals.expense)}</strong></span></div>
    </section>
  );
}

function TransactionRow({ transaction, onDelete }: { transaction: Transaction; onDelete: () => void }) {
  const Icon = categoryIcon[transaction.category] || Wallet;
  const positive = transaction.kind === "income";
  return (
    <div className="transaction-row">
      <span className={`transaction-icon ${positive ? "transaction-icon-income" : ""}`}><Icon size={17} strokeWidth={1.8} /></span>
      <span className="transaction-name"><strong>{transaction.title}</strong><small>{transaction.category} <span>·</span> {transaction.date}</small></span>
      <span className={`transaction-amount ${positive ? "amount-positive" : ""}`}>{positive ? "+ " : "− "}{formatCurrency(transaction.amount)}</span>
      <button className="row-delete-button" aria-label={`Excluir transação ${transaction.title}`} title="Excluir transação" type="button" onClick={onDelete}><Trash2 size={16} /></button>
    </div>
  );
}

function CategoryManager({
  categories,
  onAdd,
  onDelete,
  onNotice,
}: {
  categories: Record<TransactionKind, string[]>;
  onAdd: (kind: TransactionKind, name: string) => void;
  onDelete: (kind: TransactionKind, name: string) => void;
  onNotice: (message: string) => void;
}) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [newCategory, setNewCategory] = useState("");
  const isExpense = kind === "expense";
  const currentCategories = categories[kind];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    if (currentCategories.some((category) => category.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      onNotice("Essa categoria já existe neste grupo.");
      return;
    }
    onAdd(kind, name);
    setNewCategory("");
  }

  return (
    <section className="panel category-manager-panel" id="categorias">
      <div className="panel-heading compact-heading">
        <div><p className="eyebrow">DO SEU JEITO</p><h2>Suas categorias</h2></div>
        <span className="category-count">{currentCategories.length}</span>
      </div>
      <p className="category-manager-description">Organize suas movimentações por tipo.</p>
      <div className="category-kind-tabs" role="tablist" aria-label="Tipo de categoria">
        <button type="button" role="tab" aria-selected={isExpense} className={isExpense ? "category-kind-active" : ""} onClick={() => setKind("expense")}>Despesas <span>{categories.expense.length}</span></button>
        <button type="button" role="tab" aria-selected={!isExpense} className={!isExpense ? "category-kind-active" : ""} onClick={() => setKind("income")}>Receitas <span>{categories.income.length}</span></button>
      </div>
      <form className="category-add-form" onSubmit={submit}>
        <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder={isExpense ? "Ex.: Saúde" : "Ex.: Aluguel recebido"} aria-label={`Nome da categoria de ${isExpense ? "despesa" : "receita"}`} maxLength={32} />
        <button type="submit" aria-label={`Adicionar categoria de ${isExpense ? "despesa" : "receita"}`} disabled={!newCategory.trim()}><Plus size={16} /> Adicionar</button>
      </form>
      <div className="category-manager-list">
        {currentCategories.map((category) => {
          const Icon = categoryIcon[category] || Tag;
          return <div className="managed-category" key={`${kind}-${category}`}>
            <span className={`managed-category-icon ${isExpense ? "managed-expense-icon" : "managed-income-icon"}`}><Icon size={14} /></span>
            <span className="managed-category-name">{category}</span>
            <button type="button" className="delete-category-button" aria-label={`Excluir categoria ${category}`} title={currentCategories.length === 1 ? "Mantenha ao menos uma categoria deste tipo" : `Excluir ${category}`} disabled={currentCategories.length === 1} onClick={() => onDelete(kind, category)}><Trash2 size={14} /></button>
          </div>;
        })}
      </div>
      <p className="category-manager-footnote">Categorias de receita e despesa são independentes e salvas neste dispositivo.</p>
    </section>
  );
}

function NewTransactionModal({
  onClose,
  onSave,
  categories,
}: {
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, "id" | "date">) => void;
  categories: Record<TransactionKind, string[]>;
}) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories.expense[0] || "");
  const [amount, setAmount] = useState("");

  function changeKind(nextKind: TransactionKind) {
    setKind(nextKind);
    setCategory((current) => categories[nextKind].includes(current) ? current : categories[nextKind][0] || "");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericAmount = parseCurrencyInput(amount);
    if (!title.trim() || !category || !numericAmount || numericAmount <= 0) return;
    onSave({ title: title.trim(), category, amount: numericAmount, kind });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><p className="eyebrow">SEU DINHEIRO, NO SEU RITMO</p><h2 id="modal-title">Nova transação</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <div className="kind-switch" role="group" aria-label="Tipo de transação">
            <button type="button" className={kind === "expense" ? "kind-active kind-expense" : ""} onClick={() => changeKind("expense")}><ArrowDownLeft size={16} /> Despesa</button>
            <button type="button" className={kind === "income" ? "kind-active kind-income" : ""} onClick={() => changeKind("income")}><ArrowUpRight size={16} /> Receita</button>
          </div>
          <label className="form-label">Descrição<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "income" ? "Ex.: salário mensal" : "Ex.: almoço de domingo"} autoFocus required /></label>
          <div className="form-row">
            <label className="form-label">Valor (R$)<input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" inputMode="decimal" required /></label>
            <label className="form-label">Categoria<select value={category} onChange={(event) => setCategory(event.target.value)} required>{categories[kind].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          </div>
          <div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> Salvar transação</button></div>
        </form>
      </section>
    </div>
  );
}

function NewDebtModal({
  onClose,
  onSave,
  categories,
}: {
  onClose: () => void;
  onSave: (debt: Omit<InstallmentDebt, "id">) => void;
  categories: Record<TransactionKind, string[]>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories.expense[0] || "");
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [firstDueDate, setFirstDueDate] = useState(() => localDateInputValue(new Date()));
  const [dueDates, setDueDates] = useState(() => monthlyDueDates(localDateInputValue(new Date()), 3));
  const [scheduleError, setScheduleError] = useState("");
  const numericAmount = parseCurrencyInput(amount);
  const totalCents = Number.isFinite(numericAmount) && numericAmount > 0 ? Math.round(numericAmount * 100) : 0;
  const baseInstallmentCents = Math.floor(totalCents / installmentCount);
  const extraCents = totalCents % installmentCount;

  function changeInstallmentCount(value: string) {
    const parsed = Number(value);
    const nextCount = Math.max(1, Math.min(60, Number.isFinite(parsed) ? Math.trunc(parsed) || 1 : 1));
    setInstallmentCount(nextCount);
    setDueDates(monthlyDueDates(firstDueDate, nextCount));
  }

  function changeFirstDueDate(value: string) {
    setFirstDueDate(value);
    setDueDates(monthlyDueDates(value, installmentCount));
  }

  function changeDueDate(index: number, value: string) {
    setDueDates((current) => current.map((date, dateIndex) => dateIndex === index ? value : date));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !category || !Number.isFinite(numericAmount) || numericAmount <= 0 || dueDates.length !== installmentCount || dueDates.some((date) => !isDateInputValue(date))) return;
    if (totalCents < installmentCount) {
      setScheduleError("A quantidade de parcelas não pode ser maior que o valor em centavos.");
      return;
    }
    setScheduleError("");
    const installments = dueDates.map((dueDate, index) => ({
      number: index + 1,
      amount: (baseInstallmentCents + (index < extraCents ? 1 : 0)) / 100,
      dueDate,
    }));
    onSave({ title: title.trim(), category, totalAmount: totalCents / 100, installments });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-modal debt-modal" role="dialog" aria-modal="true" aria-labelledby="debt-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">ORGANIZE OS PRÓXIMOS PAGAMENTOS</p><h2 id="debt-modal-title">Nova dívida parcelada</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <label className="form-label">Descrição<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: compra do notebook" maxLength={80} autoFocus required /></label>
          <div className="form-row">
            <label className="form-label">Valor total (R$)<input value={amount} onChange={(event) => { setAmount(event.target.value); setScheduleError(""); }} placeholder="0,00" inputMode="decimal" required /></label>
            <label className="form-label">Categoria<select value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.expense.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          </div>
          <div className="form-row">
            <label className="form-label">Número de parcelas<input type="number" min={1} max={60} step={1} value={installmentCount} onChange={(event) => changeInstallmentCount(event.target.value)} required /></label>
            <label className="form-label">Primeiro vencimento<input type="date" value={firstDueDate} onChange={(event) => changeFirstDueDate(event.target.value)} required /></label>
          </div>
          <div className="debt-schedule-preview">
            <div className="debt-schedule-heading"><strong>Vencimentos das parcelas</strong><span>Edite qualquer data antes de salvar.</span></div>
            <div className="debt-schedule-edit-list">
              {dueDates.map((dueDate, index) => <div className="debt-schedule-edit-row" key={index}>
                <span>Parcela {index + 1}</span>
                <input type="date" value={dueDate} onChange={(event) => changeDueDate(index, event.target.value)} aria-label={`Vencimento da parcela ${index + 1}`} required />
                <strong>{formatCurrency((baseInstallmentCents + (index < extraCents ? 1 : 0)) / 100)}</strong>
              </div>)}
            </div>
            <p>O total é dividido em parcelas mensais; diferenças de centavos são distribuídas nas primeiras.</p>
          </div>
          {scheduleError && <p className="form-error" role="alert">{scheduleError}</p>}
          <div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> Salvar dívida</button></div>
        </form>
      </section>
    </div>
  );
}

function DebtManager({
  debts,
  categories,
  onSave,
  onDelete,
  onPay,
  onDueDateChange,
}: {
  debts: InstallmentDebt[];
  categories: Record<TransactionKind, string[]>;
  onSave: (debt: Omit<InstallmentDebt, "id">) => void;
  onDelete: (id: number) => void;
  onPay: (debtId: number, installmentNumber: number) => void;
  onDueDateChange: (debtId: number, installmentNumber: number, dueDate: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);

  function saveDebt(debt: Omit<InstallmentDebt, "id">) {
    onSave(debt);
    setFormOpen(false);
  }

  return (
    <section className="panel debt-manager-panel" id="dividas">
      <div className="panel-heading debt-manager-heading">
        <div><p className="eyebrow">PAGAMENTOS PLANEJADOS</p><h2>Dívidas parceladas</h2></div>
        <button type="button" className="outline-button debt-add-button" onClick={() => setFormOpen(true)}><Plus size={14} /> Nova dívida</button>
      </div>
      <p className="debt-manager-description">Acompanhe o valor e o vencimento de cada parcela.</p>
      {debts.length === 0 ? <div className="debt-empty-state"><span><CalendarDays size={18} /></span><strong>Nenhuma dívida cadastrada</strong><small>Adicione uma compra parcelada para organizar os próximos vencimentos.</small></div> : <div className="debt-list">
        {debts.map((debt) => <article className="debt-card" key={debt.id}>
          <div className="debt-card-heading">
            <div className="debt-card-title"><strong>{debt.title}</strong><span>{debt.category} · {debt.installments.length} {debt.installments.length === 1 ? "parcela" : "parcelas"}</span></div>
            <div className="debt-card-total"><strong>{formatCurrency(debt.totalAmount)}</strong><small>valor total</small></div>
            <button type="button" className="row-delete-button debt-delete-button" aria-label={`Excluir dívida ${debt.title}`} title="Excluir dívida" onClick={() => onDelete(debt.id)}><Trash2 size={15} /></button>
          </div>
          <div className="debt-installment-list">
            {debt.installments.map((installment) => <div className="debt-installment-row" key={installment.number}>
              <span className="debt-installment-label">Parcela {installment.number}/{debt.installments.length}</span>
              <label className="debt-date-label"><span className="sr-only">Vencimento da parcela {installment.number}</span><input type="date" value={installment.dueDate} onChange={(event) => onDueDateChange(debt.id, installment.number, event.target.value)} aria-label={`Vencimento da parcela ${installment.number} de ${debt.title}`} /></label>
              <div className="debt-installment-value"><strong>{formatCurrency(installment.amount)}</strong>{installment.paidTransactionId ? <span className="debt-paid-status"><Check size={11} /> Pagamento lançado</span> : <button type="button" className="installment-pay-button" disabled={installment.amount <= 0} onClick={() => onPay(debt.id, installment.number)}><Check size={11} /> Registrar pagamento</button>}</div>
            </div>)}
          </div>
        </article>)}
      </div>}
      <p className="debt-manager-footnote">As parcelas em aberto são descontadas do saldo total. Ao pagar, o valor pendente diminui; a despesa fica no histórico sem ser descontada uma segunda vez.</p>
      {formOpen && <NewDebtModal onClose={() => setFormOpen(false)} onSave={saveDebt} categories={categories} />}
    </section>
  );
}

function NewGoalModal({ onClose, onSave }: { onClose: () => void; onSave: (title: string, targetAmount: number) => void }) {
  const [title, setTitle] = useState("");
  const [targetInput, setTargetInput] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetAmount = parseCurrencyInput(targetInput);
    if (!title.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) return;
    onSave(title.trim(), Math.round(targetAmount * 100) / 100);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-modal goal-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">UM PASSO DE CADA VEZ</p><h2 id="goal-modal-title">Novo objetivo</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <label className="form-label">Nome do objetivo<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: viagem, reserva de emergência" maxLength={60} autoFocus required /></label>
          <label className="form-label">Valor que deseja alcançar (R$)<input value={targetInput} onChange={(event) => setTargetInput(event.target.value)} placeholder="0,00" inputMode="decimal" required /></label>
          <p className="goal-modal-note">Depois de criar, você poderá acompanhar o progresso adicionando aportes.</p>
          <div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> Criar objetivo</button></div>
        </form>
      </section>
    </div>
  );
}

function GoalManager({
  goals,
  hidden,
  onCreate,
  onDelete,
  onContribute,
}: {
  goals: FinancialGoal[];
  hidden: boolean;
  onCreate: (title: string, targetAmount: number) => void;
  onDelete: (id: number) => void;
  onContribute: (id: number, amount: number) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [contributionInputs, setContributionInputs] = useState<Record<number, string>>({});

  function saveGoal(title: string, targetAmount: number) {
    onCreate(title, targetAmount);
    setModalOpen(false);
  }

  function contribute(event: FormEvent<HTMLFormElement>, goalId: number) {
    event.preventDefault();
    const amount = parseCurrencyInput(contributionInputs[goalId] || "");
    if (!Number.isFinite(amount) || amount <= 0) return;
    onContribute(goalId, amount);
    setContributionInputs((current) => ({ ...current, [goalId]: "" }));
  }

  return (
    <section className="panel goal-manager-panel" id="metas">
      <div className="panel-heading goal-manager-heading">
        <div><p className="eyebrow">SEUS PLANOS</p><h2>Objetivos financeiros</h2></div>
        <button type="button" className="outline-button goal-add-button" onClick={() => setModalOpen(true)}><Plus size={14} /> Novo objetivo</button>
      </div>
      {goals.length === 0 ? <div className="goal-empty-state"><span><Target size={18} /></span><strong>Seu próximo objetivo começa aqui</strong><small>Crie uma meta com o valor que deseja alcançar e acompanhe seu progresso.</small><button type="button" className="button-primary" onClick={() => setModalOpen(true)}><Plus size={15} /> Criar primeiro objetivo</button></div> : <div className="goal-list">
        {goals.map((goal) => {
          const progress = Math.min((goal.savedAmount / goal.targetAmount) * 100, 100);
          const remaining = Math.max(goal.targetAmount - goal.savedAmount, 0);
          return <article className="goal-item" key={goal.id}>
            <div className="goal-item-heading"><div><strong>{goal.title}</strong><small>Meta de {hidden ? "••••••" : formatCurrency(goal.targetAmount)}</small></div><button type="button" className="row-delete-button" aria-label={`Excluir objetivo ${goal.title}`} title="Excluir objetivo" onClick={() => onDelete(goal.id)}><Trash2 size={15} /></button></div>
            <div className="goal-item-values"><strong>{hidden ? "••••••" : formatCurrency(goal.savedAmount)}</strong><span>{hidden ? "••••••" : formatCurrency(remaining)} restantes</span></div>
            <div className="goal-item-progress" role="progressbar" aria-label={`Progresso de ${goal.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
            <div className="goal-item-meta"><span>{Math.round(progress)}% concluído</span><span>{progress >= 100 ? "Objetivo alcançado" : "Adicione um aporte para avançar"}</span></div>
            <form className="goal-contribution-form" onSubmit={(event) => contribute(event, goal.id)}>
              <label><span className="sr-only">Valor do aporte para {goal.title}</span><input value={contributionInputs[goal.id] || ""} onChange={(event) => setContributionInputs((current) => ({ ...current, [goal.id]: event.target.value }))} placeholder="Valor do aporte (R$)" inputMode="decimal" /></label>
              <button type="submit" className="outline-button"><Plus size={13} /> Adicionar aporte</button>
            </form>
          </article>;
        })}
      </div>}
      <p className="goal-manager-footnote">Objetivos e aportes são salvos neste navegador; aportes atualizam a meta, não são lançamentos de receita.</p>
      {modalOpen && <NewGoalModal onClose={() => setModalOpen(false)} onSave={saveGoal} />}
    </section>
  );
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [transactionsReady, setTransactionsReady] = useState(false);
  const [debts, setDebts] = useState<InstallmentDebt[]>([]);
  const [debtsReady, setDebtsReady] = useState(false);
  const [creditCardData, setCreditCardData] = useState<CreditCardStore>(emptyCreditCardStore);
  const [creditCardsReady, setCreditCardsReady] = useState(false);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [goalsReady, setGoalsReady] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [month, setMonth] = useState("Novembro 2026");
  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(transactionStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        setTransactions(Array.isArray(parsed) ? parsed.filter(isStoredTransaction) : []);
      }
    } catch {
      announce("Não foi possível ler as transações salvas neste navegador.");
    } finally {
      setTransactionsReady(true);
    }
  }, [announce]);

  useEffect(() => {
    if (!transactionsReady) return;
    try {
      window.localStorage.setItem(transactionStorageKey, JSON.stringify(transactions));
    } catch {
      announce("Não foi possível salvar as transações neste navegador.");
    }
  }, [transactions, transactionsReady, announce]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(debtStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        setDebts(Array.isArray(parsed) ? parsed.filter(isStoredDebt) : []);
      }
    } catch {
      announce("Não foi possível ler as dívidas salvas neste navegador.");
    } finally {
      setDebtsReady(true);
    }
  }, [announce]);

  useEffect(() => {
    if (!debtsReady) return;
    try {
      window.localStorage.setItem(debtStorageKey, JSON.stringify(debts));
    } catch {
      announce("Não foi possível salvar as dívidas neste navegador.");
    }
  }, [debts, debtsReady, announce]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(cardStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isStoredCreditCardStore(parsed)) {
          const dueDateOverrides: Record<string, string> = {};
          Object.entries(parsed.dueDateOverrides || {}).forEach(([key, value]) => {
            if (/^\d+:\d{4}-\d{2}$/.test(key) && isDateInputValue(value)) dueDateOverrides[key] = value;
          });
          setCreditCardData({ ...parsed, dueDateOverrides });
        } else announce("Os dados salvos dos cartões não puderam ser validados; a lista foi iniciada vazia.");
      }
    } catch {
      announce("Não foi possível ler os cartões salvos neste navegador.");
    } finally {
      setCreditCardsReady(true);
    }
  }, [announce]);

  useEffect(() => {
    if (!creditCardsReady) return;
    try {
      window.localStorage.setItem(cardStorageKey, JSON.stringify(creditCardData));
    } catch {
      announce("Não foi possível salvar os cartões neste navegador.");
    }
  }, [creditCardData, creditCardsReady, announce]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(goalsStorageKey);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        setGoals(Array.isArray(parsed) ? parsed.filter(isStoredGoal) : []);
      }
    } catch {
      announce("Não foi possível ler os objetivos salvos neste navegador.");
    } finally {
      setGoalsReady(true);
    }
  }, [announce]);

  useEffect(() => {
    if (!goalsReady) return;
    try {
      window.localStorage.setItem(goalsStorageKey, JSON.stringify(goals));
    } catch {
      announce("Não foi possível salvar os objetivos neste navegador.");
    }
  }, [goals, goalsReady, announce]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(categoryStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<TransactionKind, unknown>>;
        const readList = (value: unknown, fallback: string[]) => {
          if (!Array.isArray(value)) return fallback;
          const names = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
          return names.filter((item, index) => names.indexOf(item) === index);
        };
        setCategories({
          expense: readList(parsed.expense, initialCategories.expense),
          income: readList(parsed.income, initialCategories.income),
        });
      }
    } catch {
      announce("Não foi possível ler as categorias salvas neste navegador.");
    } finally {
      setCategoriesReady(true);
    }
  }, [announce]);

  useEffect(() => {
    if (!categoriesReady) return;
    try {
      window.localStorage.setItem(categoryStorageKey, JSON.stringify(categories));
    } catch {
      announce("Não foi possível salvar as categorias neste navegador.");
    }
  }, [categories, categoriesReady, announce]);

  const transactionTotals = useMemo(() => transactions.reduce((totals, transaction) => {
    totals[transaction.kind] += transaction.amount;
    return totals;
  }, { income: 0, expense: 0 }), [transactions]);
  const outstandingDebt = debts.reduce((total, debt) => total + debt.installments.reduce((subtotal, installment) => subtotal + (installment.paidTransactionId ? 0 : installment.amount), 0), 0);
  const creditCardInvoices = useMemo(() => buildCreditCardInvoices(creditCardData.cards, creditCardData.purchases, creditCardData.payments), [creditCardData]);
  const outstandingCardInvoices = creditCardInvoices.reduce((total, invoice) => total + (invoice.paidTransactionId ? 0 : invoice.amount), 0);
  const debtPaymentTransactionIds = new Set<number>();
  debts.forEach((debt) => debt.installments.forEach((installment) => {
    if (installment.paidTransactionId) debtPaymentTransactionIds.add(installment.paidTransactionId);
  }));
  creditCardData.payments.forEach((payment) => debtPaymentTransactionIds.add(payment.paidTransactionId));
  const linkedPaymentExpenses = transactions.reduce((total, transaction) => total + (transaction.kind === "expense" && debtPaymentTransactionIds.has(transaction.id) ? transaction.amount : 0), 0);
  const balanceExpenses = transactionTotals.expense - linkedPaymentExpenses;
  const totalBalance = transactionTotals.income - balanceExpenses - outstandingDebt - outstandingCardInvoices;
  const expensesByCategory = useMemo(() => transactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.kind === "expense") totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount;
    return totals;
  }, {}), [transactions]);
  const budgetColors = ["mint", "blue", "orange", "purple"];
  const budgetCategoryNames = [...categories.expense, ...Object.keys(expensesByCategory).filter((name) => !categories.expense.includes(name))];
  const expenseCategories = budgetCategoryNames.map((name, index) => {
    const style = budgetCategoryStyles.find((item) => item.name === name);
    return { name, spent: expensesByCategory[name] || 0, icon: style?.icon || categoryIcon[name] || Wallet, color: style?.color || budgetColors[index % budgetColors.length] };
  });
  const largestCategoryExpense = Math.max(0, ...expenseCategories.map((category) => category.spent));

  const visibleTransactions = useMemo(() => transactions.filter((transaction) => {
    const matchesFilter = filter === "all" || transaction.kind === filter;
    const matchesSearch = `${transaction.title} ${transaction.category}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
    return matchesFilter && matchesSearch;
  }), [transactions, filter, search]);

  function saveTransaction(transaction: Omit<Transaction, "id" | "date">) {
    setTransactions((current) => [{ ...transaction, id: Date.now(), date: "Agora mesmo" }, ...current]);
    setModalOpen(false);
    setFilter("all");
    announce("Transação adicionada com sucesso.");
  }

  function deleteTransaction(id: number) {
    const transaction = transactions.find((item) => item.id === id);
    const linkedInstallment = debts.some((debt) => debt.installments.some((installment) => installment.paidTransactionId === id));
    const linkedCardInvoice = creditCardData.payments.some((payment) => payment.paidTransactionId === id);
    if (!transaction || !window.confirm(`Excluir a transação “${transaction.title}”? O saldo será atualizado.${linkedInstallment ? " A parcela correspondente voltará a ficar em aberto." : ""}${linkedCardInvoice ? " A fatura do cartão correspondente voltará a ficar em aberto." : ""}`)) return;
    setTransactions((current) => current.filter((item) => item.id !== id));
    if (linkedInstallment) {
      setDebts((current) => current.map((debt) => ({
        ...debt,
        installments: debt.installments.map((installment) => installment.paidTransactionId === id ? { ...installment, paidTransactionId: undefined } : installment),
      })));
    }
    if (linkedCardInvoice) {
      setCreditCardData((current) => ({ ...current, payments: current.payments.filter((payment) => payment.paidTransactionId !== id) }));
    }
    announce("Transação excluída e saldo atualizado.");
  }

  function saveDebt(debt: Omit<InstallmentDebt, "id">) {
    setDebts((current) => [{ ...debt, id: Date.now() }, ...current]);
    announce("Dívida parcelada salva.");
  }

  function deleteDebt(id: number) {
    const debt = debts.find((item) => item.id === id);
    if (!debt || !window.confirm(`Excluir a dívida parcelada “${debt.title}” e seus vencimentos? As despesas de parcelas já pagas continuarão no histórico.`)) return;
    setDebts((current) => current.filter((item) => item.id !== id));
    announce("Dívida parcelada excluída.");
  }

  function payInstallment(debtId: number, installmentNumber: number) {
    const debt = debts.find((item) => item.id === debtId);
    const installment = debt?.installments.find((item) => item.number === installmentNumber);
    if (!debt || !installment || installment.paidTransactionId || installment.amount <= 0) return;
    if (!window.confirm(`Registrar o pagamento da parcela ${installment.number}/${debt.installments.length} de ${debt.title} como despesa de ${formatCurrency(installment.amount)}?`)) return;
    const transactionId = Date.now();
    setTransactions((current) => [{
      id: transactionId,
      title: `${debt.title} · parcela ${installment.number}/${debt.installments.length}`,
      category: debt.category,
      date: "Agora mesmo",
      amount: installment.amount,
      kind: "expense",
    }, ...current]);
    setDebts((current) => current.map((item) => item.id !== debtId ? item : {
      ...item,
      installments: item.installments.map((part) => part.number === installmentNumber ? { ...part, paidTransactionId: transactionId } : part),
    }));
    announce("Pagamento lançado como despesa e parcela baixada.");
  }

  function changeInstallmentDueDate(debtId: number, installmentNumber: number, dueDate: string) {
    if (!isDateInputValue(dueDate)) return;
    setDebts((current) => current.map((debt) => debt.id !== debtId ? debt : {
      ...debt,
      installments: debt.installments.map((installment) => installment.number === installmentNumber ? { ...installment, dueDate } : installment),
    }));
  }

  function saveCreditCard(card: Omit<CreditCardAccount, "id"> & { id?: number }) {
    const id = card.id ?? Date.now();
    const previousCard = creditCardData.cards.find((item) => item.id === id);
    const billingCycleChanged = Boolean(previousCard && (previousCard.closingDay !== card.closingDay || previousCard.dueDay !== card.dueDay));
    const openInvoiceKeys = new Set(creditCardInvoices.filter((invoice) => invoice.cardId === id && !invoice.paidTransactionId).map((invoice) => invoice.key));
    setCreditCardData((current) => ({
      ...current,
      cards: card.id
        ? current.cards.map((item) => item.id === id ? { ...card, id } : item)
        : [{ ...card, id }, ...current.cards],
      dueDateOverrides: billingCycleChanged
        ? Object.keys(current.dueDateOverrides || {}).reduce<Record<string, string>>((dates, key) => {
          if (!openInvoiceKeys.has(key)) dates[key] = current.dueDateOverrides![key];
          return dates;
        }, {})
        : current.dueDateOverrides || {},
    }));
    announce(billingCycleChanged ? "Dia do cartão atualizado; as faturas em aberto foram ajustadas." : card.id ? "Cartão atualizado." : "Cartão adicionado.");
  }

  function deleteCreditCard(id: number) {
    const card = creditCardData.cards.find((item) => item.id === id);
    if (!card || !window.confirm(`Excluir o cartão “${card.name}” e todas as compras e faturas associadas? Pagamentos já lançados continuarão no histórico de despesas.`)) return;
    setCreditCardData((current) => ({
      cards: current.cards.filter((item) => item.id !== id),
      purchases: current.purchases.filter((purchase) => purchase.cardId !== id),
      payments: current.payments.filter((payment) => payment.cardId !== id),
      dueDateOverrides: Object.keys(current.dueDateOverrides || {}).reduce<Record<string, string>>((dates, key) => {
        if (!key.startsWith(`${id}:`)) dates[key] = current.dueDateOverrides![key];
        return dates;
      }, {}),
    }));
    announce("Cartão e histórico de compras associados excluídos.");
  }

  function saveCardPurchase(purchase: Omit<CardPurchase, "id">) {
    setCreditCardData((current) => ({ ...current, purchases: [{ ...purchase, id: Date.now() }, ...current.purchases] }));
    announce("Compra adicionada à fatura do cartão.");
  }

  function deleteCardPurchase(id: number) {
    const purchase = creditCardData.purchases.find((item) => item.id === id);
    if (!purchase) return;
    const alreadyPaid = creditCardInvoices.some((invoice) => Boolean(invoice.paidTransactionId) && invoice.lines.some((line) => line.purchaseId === id));
    if (alreadyPaid) {
      announce("Esta compra já possui uma parcela paga e foi mantida no histórico.");
      return;
    }
    if (!window.confirm(`Excluir a compra “${purchase.title}” de todas as faturas futuras?`)) return;
    setCreditCardData((current) => ({ ...current, purchases: current.purchases.filter((item) => item.id !== id) }));
    announce("Compra removida das faturas.");
  }

  function changeCardInvoiceDueDate(invoiceKey: string, dueDate: string) {
    const invoice = creditCardInvoices.find((item) => item.key === invoiceKey);
    if (!invoice || invoice.paidTransactionId || !/^\d+:\d{4}-\d{2}$/.test(invoiceKey)) return;
    if (!isDateInputValue(dueDate)) {
      announce("Escolha uma data válida no calendário para atualizar o vencimento.");
      return;
    }
    setCreditCardData((current) => ({
      ...current,
      dueDateOverrides: { ...(current.dueDateOverrides || {}), [invoiceKey]: dueDate },
    }));
    announce("Data de vencimento da fatura atualizada.");
  }

  function payCreditCardInvoice(invoiceToPay: CreditCardInvoice) {
    const invoice = creditCardInvoices.find((item) => item.key === invoiceToPay.key);
    const card = creditCardData.cards.find((item) => item.id === invoice?.cardId);
    if (!invoice || !card || invoice.paidTransactionId || invoice.amount <= 0) return;
    const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${invoice.month}-01T12:00:00`));
    if (!window.confirm(`Registrar a fatura de ${card.name} (${monthLabel}) no valor de ${formatCurrency(invoice.amount)} como despesa? O pagamento será incluído no histórico e liberará limite.`)) return;
    const transactionId = Date.now();
    setTransactions((current) => [{
      id: transactionId,
      title: `Fatura ${card.name} · ${monthLabel}`,
      category: cardInvoiceCategory,
      date: "Agora mesmo",
      amount: invoice.amount,
      kind: "expense",
    }, ...current]);
    setCreditCardData((current) => ({
      ...current,
      payments: [
        ...current.payments.filter((payment) => !(payment.cardId === invoice.cardId && payment.month === invoice.month)),
        { cardId: invoice.cardId, month: invoice.month, paidTransactionId: transactionId, paidAt: localDateInputValue(new Date()) },
      ],
    }));
    announce("Fatura registrada como despesa e limite atualizado.");
  }

  function createGoal(title: string, targetAmount: number) {
    setGoals((current) => [{ id: Date.now(), title, targetAmount, savedAmount: 0 }, ...current]);
    announce("Objetivo criado. Adicione aportes para acompanhar seu progresso.");
  }

  function deleteGoal(id: number) {
    const goal = goals.find((item) => item.id === id);
    if (!goal || !window.confirm(`Excluir o objetivo “${goal.title}” e seu progresso?`)) return;
    setGoals((current) => current.filter((item) => item.id !== id));
    announce("Objetivo excluído.");
  }

  function contributeToGoal(id: number, amount: number) {
    setGoals((current) => current.map((goal) => goal.id === id ? { ...goal, savedAmount: Math.round((goal.savedAmount + amount) * 100) / 100 } : goal));
    announce("Aporte adicionado ao objetivo.");
  }

  function addCategory(kind: TransactionKind, name: string) {
    setCategories((current) => ({ ...current, [kind]: [...current[kind], name] }));
    announce(`Categoria de ${kind === "income" ? "receita" : "despesa"} criada.`);
  }

  function deleteCategory(kind: TransactionKind, name: string) {
    setCategories((current) => ({ ...current, [kind]: current[kind].filter((category) => category !== name) }));
    announce("Categoria excluída. O histórico de transações não foi alterado.");
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
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} transactionCount={transactions.length} />
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
            <div className="balance-content"><span className="balance-label"><Wallet size={16} /> SALDO TOTAL</span><div className="balance-amount-row"><strong>{hidden ? "••••••••" : formatCurrency(totalBalance)}</strong><button className="balance-eye" type="button" onClick={() => setHidden((value) => !value)} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}>{hidden ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><p><span className="balance-change"><ArrowLeftRight size={14} /> Saldo após obrigações</span> receitas menos despesas sem vínculo, dívidas e faturas em aberto</p></div>
            <div className="balance-breakdown"><div><span>Receitas cadastradas</span><strong>{hidden ? "••••••" : formatCurrency(transactionTotals.income)}</strong></div><div><span>Outras despesas</span><strong>{hidden ? "••••••" : formatCurrency(balanceExpenses)}</strong></div><div><span>Dívidas em aberto</span><strong>{hidden ? "••••••" : formatCurrency(outstandingDebt)}</strong></div><div><span>Faturas abertas</span><strong>{hidden ? "••••••" : formatCurrency(outstandingCardInvoices)}</strong></div></div>
            <div className="banner-decoration banner-ring-one" /><div className="banner-decoration banner-ring-two" /><div className="banner-decoration banner-orb" />
          </section>

          <section className="metrics-grid" id="indicadores" aria-label="Indicadores do mês">
            <MetricCard label="Receitas" value={formatCurrency(transactionTotals.income)} note="Total cadastrado" icon={ArrowUpRight} tone="metric-mint" hidden={hidden} />
            <MetricCard label="Despesas" value={formatCurrency(transactionTotals.expense)} note="Inclui parcelas e faturas pagas" icon={ArrowDownLeft} tone="metric-peach" hidden={hidden} />
            <MetricCard label="Obrigações em aberto" value={formatCurrency(outstandingDebt + outstandingCardInvoices)} note="Dívidas e faturas não pagas" icon={CalendarDays} tone="metric-lilac" hidden={hidden} />
            <MetricCard label="Pagamentos vinculados" value={formatCurrency(linkedPaymentExpenses)} note="Dívidas e faturas pagas" icon={Check} tone="metric-blue" hidden={hidden} />
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-main-column">
              <CashflowChart hidden={hidden} transactions={transactions} month={month} />
              <section className="panel transactions-panel" id="transacoes">
                <div className="panel-heading transactions-heading"><div><p className="eyebrow">MOVIMENTAÇÕES RECENTES</p><h2>Últimas transações</h2></div><div className="transaction-actions"><button className="outline-button export-button" onClick={exportTransactions}><Download size={15} /> Exportar</button>{visibleTransactions.length > 5 && <button type="button" className="text-link transaction-expand-button" aria-expanded={showAllTransactions} onClick={() => setShowAllTransactions((current) => !current)}>{showAllTransactions ? "Mostrar recentes" : "Ver todas"} <ArrowUpRight size={14} /></button>}</div></div>
                <div className="transaction-toolbar"><div className="filter-tabs" role="tablist" aria-label="Filtrar transações"><button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "filter-active" : ""} onClick={() => setFilter("all")}>Todas <span>{transactions.length}</span></button><button role="tab" aria-selected={filter === "income"} className={filter === "income" ? "filter-active" : ""} onClick={() => setFilter("income")}>Entradas</button><button role="tab" aria-selected={filter === "expense"} className={filter === "expense" ? "filter-active" : ""} onClick={() => setFilter("expense")}>Saídas</button></div><span className="transaction-month">{month}</span></div>
                <div className="transaction-list">{visibleTransactions.length ? (showAllTransactions ? visibleTransactions : visibleTransactions.slice(0, 5)).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onDelete={() => deleteTransaction(transaction.id)} />) : <p className="empty-state">Nenhuma transação encontrada.</p>}</div>
              </section>
              <DebtManager debts={debts} categories={categories} onSave={saveDebt} onDelete={deleteDebt} onPay={payInstallment} onDueDateChange={changeInstallmentDueDate} />
              <CreditCardManager cards={creditCardData.cards} purchases={creditCardData.purchases} payments={creditCardData.payments} dueDateOverrides={creditCardData.dueDateOverrides || {}} categories={categories.expense} hidden={hidden} onSaveCard={saveCreditCard} onDeleteCard={deleteCreditCard} onSavePurchase={saveCardPurchase} onDeletePurchase={deleteCardPurchase} onChangeInvoiceDueDate={changeCardInvoiceDueDate} onPayInvoice={payCreditCardInvoice} />
            </div>

            <div className="dashboard-side-column">
              <section className="panel budget-panel" id="orcamento">
                <div className="panel-heading compact-heading"><div><p className="eyebrow">GASTOS POR CATEGORIA</p><h2>Despesas registradas</h2></div><button className="icon-button small-icon-button" aria-label="Mais opções de despesas"><MoreHorizontal size={18} /></button></div>
                <div className="budget-total-row"><span>Total de despesas</span><strong>{hidden ? "••••••" : formatCurrency(transactionTotals.expense)}</strong></div>
                <p className="budget-hint"><span className="budget-hint-dot" /> Valores e barras acompanham as despesas registradas.</p>
                <div className="budget-categories">{expenseCategories.map(({ name, spent, icon: Icon, color }) => <div className="budget-category" key={name}><div className="budget-category-top"><span className={`category-icon category-${color}`}><Icon size={15} /></span><span className="category-name">{name}</span><span className="category-value">{hidden ? "••••" : formatCurrency(spent)}</span></div><div className="category-track"><span className={`category-fill fill-${color}`} style={{ width: `${largestCategoryExpense > 0 ? Math.min((spent / largestCategoryExpense) * 100, 100) : 0}%` }} /></div></div>)}</div>
                <a className="panel-bottom-link" href="#categorias">Gerenciar categorias <ArrowUpRight size={14} /></a>
              </section>

              <CategoryManager categories={categories} onAdd={addCategory} onDelete={deleteCategory} onNotice={announce} />

              <GoalManager goals={goals} hidden={hidden} onCreate={createGoal} onDelete={deleteGoal} onContribute={contributeToGoal} />

              <section className="insight-card"><span className="insight-icon"><PiggyBank size={17} /></span><div><p className="eyebrow">SEU PRÓXIMO PASSO</p><p>Registre uma movimentação para ver seus primeiros insights financeiros.</p></div><ArrowUpRight className="insight-arrow" size={16} /></section>
            </div>
          </div>
          <footer className="page-footer"><span>Finora <span>·</span> cuidado com o seu dinheiro, sem complicação.</span><span>Seus dados ficam só com você <span className="footer-lock">◆</span></span></footer>
        </div>
      </main>
      {modalOpen && <NewTransactionModal onClose={() => setModalOpen(false)} onSave={saveTransaction} categories={categories} />}
      {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}</div>}
    </div>
  );
}

function TrendingUpIcon(props: React.ComponentProps<LucideIcon>) {
  return <ArrowUpRight {...props} />;
}

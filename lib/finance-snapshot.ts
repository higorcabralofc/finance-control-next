export const FINANCE_STORAGE_KEYS = {
  categories: "finora:categories:v1",
  transactions: "finora:transactions:v1",
  debts: "finora:debts:v1",
  goals: "finora:goals:v1",
  creditCards: "finora:credit-cards:v1",
} as const;

export const LEGACY_IMPORT_MARKER_KEY = "finora:cloud-import:v1";
export const OFFLINE_SESSION_KEY = "finora:offline-session:v1";
const MAX_SNAPSHOT_BYTES = 1_000_000;

export type FinanceSnapshot = {
  version: 1;
  transactions: Record<string, unknown>[];
  debts: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  categories: { income: string[]; expense: string[] };
  creditCards: {
    cards: Record<string, unknown>[];
    purchases: Record<string, unknown>[];
    payments: Record<string, unknown>[];
    dueDateOverrides: Record<string, string>;
  };
};

export type FinanceCache = {
  version: 1;
  revision: number;
  pending: boolean;
  snapshot: FinanceSnapshot;
  updatedAt: string;
};

export type OfflineSession = {
  accountKey: string;
  displayName: string;
  email: string | null;
};

export const DEFAULT_CATEGORIES = {
  expense: ["Alimentação", "Moradia", "Transporte", "Compras", "Assinaturas"],
  income: ["Trabalho", "Freelance", "Investimentos", "Reembolso", "Outros"],
};

export function emptyFinanceSnapshot(): FinanceSnapshot {
  return {
    version: 1,
    transactions: [],
    debts: [],
    goals: [],
    categories: {
      expense: [...DEFAULT_CATEGORIES.expense],
      income: [...DEFAULT_CATEGORIES.income],
    },
    creditCards: { cards: [], purchases: [], payments: [], dueDateOverrides: {} },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateInput(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTransaction(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return typeof value.id === "number" && Number.isFinite(value.id)
    && typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 160
    && typeof value.category === "string" && value.category.trim().length > 0 && value.category.length <= 100
    && typeof value.date === "string" && value.date.trim().length > 0 && value.date.length <= 80
    && !/[\u0000-\u001f\u007f]/.test(value.date)
    && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount > 0
    && (value.kind === "income" || value.kind === "expense");
}

function isDebt(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.installments)) return false;
  return typeof value.id === "number" && Number.isFinite(value.id)
    && typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 160
    && typeof value.category === "string" && value.category.trim().length > 0 && value.category.length <= 100
    && typeof value.totalAmount === "number" && Number.isFinite(value.totalAmount) && value.totalAmount > 0
    && value.installments.length > 0 && value.installments.length <= 120
    && value.installments.every((installment) => isRecord(installment)
      && typeof installment.number === "number" && Number.isInteger(installment.number) && installment.number > 0
      && typeof installment.amount === "number" && Number.isFinite(installment.amount) && installment.amount >= 0
      && isDateInput(installment.dueDate)
      && (installment.paidTransactionId === undefined || (typeof installment.paidTransactionId === "number" && Number.isFinite(installment.paidTransactionId))));
}

function isGoal(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return typeof value.id === "number" && Number.isFinite(value.id)
    && typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 160
    && typeof value.targetAmount === "number" && Number.isFinite(value.targetAmount) && value.targetAmount > 0
    && typeof value.savedAmount === "number" && Number.isFinite(value.savedAmount) && value.savedAmount >= 0;
}

function isCard(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return typeof value.id === "number" && Number.isFinite(value.id)
    && typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 100
    && typeof value.lastFour === "string" && (value.lastFour === "" || /^\d{4}$/.test(value.lastFour))
    && typeof value.creditLimit === "number" && Number.isFinite(value.creditLimit) && value.creditLimit > 0
    && typeof value.closingDay === "number" && Number.isInteger(value.closingDay) && value.closingDay >= 1 && value.closingDay <= 31
    && typeof value.dueDay === "number" && Number.isInteger(value.dueDay) && value.dueDay >= 1 && value.dueDay <= 31;
}

function isPurchase(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return typeof value.id === "number" && Number.isFinite(value.id)
    && typeof value.cardId === "number" && Number.isFinite(value.cardId)
    && typeof value.title === "string" && value.title.trim().length > 0 && value.title.length <= 160
    && typeof value.category === "string" && value.category.trim().length > 0 && value.category.length <= 100
    && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount > 0
    && isDateInput(value.purchaseDate)
    && typeof value.installments === "number" && Number.isInteger(value.installments) && value.installments >= 1 && value.installments <= 48;
}

function isCardPayment(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && typeof value.cardId === "number" && Number.isFinite(value.cardId)
    && typeof value.month === "string" && /^\d{4}-\d{2}$/.test(value.month)
    && typeof value.paidTransactionId === "number" && Number.isFinite(value.paidTransactionId)
    && typeof value.paidAt === "string" && value.paidAt.length <= 80;
}

function isCategoryList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 100
    && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 100);
}

export function validateFinanceSnapshot(value: unknown): value is FinanceSnapshot {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.transactions)
    || !Array.isArray(value.debts) || !Array.isArray(value.goals) || !isRecord(value.categories)
    || !isRecord(value.creditCards)) return false;

  try {
    if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_SNAPSHOT_BYTES) return false;
  } catch {
    return false;
  }

  const cards = value.creditCards;
  const overrides = cards.dueDateOverrides === undefined ? {} : cards.dueDateOverrides;
  return value.transactions.length <= 10_000 && value.transactions.every(isTransaction)
    && value.debts.length <= 2_000 && value.debts.every(isDebt)
    && value.goals.length <= 2_000 && value.goals.every(isGoal)
    && isCategoryList(value.categories.income) && isCategoryList(value.categories.expense)
    && Array.isArray(cards.cards) && cards.cards.length <= 500 && cards.cards.every(isCard)
    && Array.isArray(cards.purchases) && cards.purchases.length <= 10_000 && cards.purchases.every(isPurchase)
    && Array.isArray(cards.payments) && cards.payments.length <= 10_000 && cards.payments.every(isCardPayment)
    && isRecord(overrides) && Object.keys(overrides).length <= 10_000
    && Object.entries(overrides).every(([key, date]) => /^\d+:\d{4}-\d{2}$/.test(key) && isDateInput(date));
}

function readValue(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as unknown : null;
  } catch {
    return null;
  }
}

function readArray(key: string): Record<string, unknown>[] {
  const value = readValue(key);
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function readLocalFinanceSnapshot(): FinanceSnapshot {
  if (typeof window === "undefined") return emptyFinanceSnapshot();
  const fallback = emptyFinanceSnapshot();
  const rawCategories = readValue(FINANCE_STORAGE_KEYS.categories);
  const categories = isRecord(rawCategories)
    && isCategoryList(rawCategories.income) && isCategoryList(rawCategories.expense)
    ? { income: rawCategories.income, expense: rawCategories.expense }
    : fallback.categories;
  const rawCards = readValue(FINANCE_STORAGE_KEYS.creditCards);
  const creditCards = isRecord(rawCards)
    ? {
        cards: Array.isArray(rawCards.cards) ? rawCards.cards.filter(isRecord) : [],
        purchases: Array.isArray(rawCards.purchases) ? rawCards.purchases.filter(isRecord) : [],
        payments: Array.isArray(rawCards.payments) ? rawCards.payments.filter(isRecord) : [],
        dueDateOverrides: isRecord(rawCards.dueDateOverrides)
          ? Object.fromEntries(Object.entries(rawCards.dueDateOverrides).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
          : {},
      }
    : fallback.creditCards;

  return {
    version: 1,
    transactions: readArray(FINANCE_STORAGE_KEYS.transactions),
    debts: readArray(FINANCE_STORAGE_KEYS.debts),
    goals: readArray(FINANCE_STORAGE_KEYS.goals),
    categories,
    creditCards,
  };
}

export function hasMeaningfulFinanceData(snapshot: FinanceSnapshot): boolean {
  return snapshot.transactions.length > 0 || snapshot.debts.length > 0 || snapshot.goals.length > 0
    || snapshot.creditCards.cards.length > 0 || snapshot.creditCards.purchases.length > 0
    || snapshot.creditCards.payments.length > 0
    || JSON.stringify(snapshot.categories.income) !== JSON.stringify(DEFAULT_CATEGORIES.income)
    || JSON.stringify(snapshot.categories.expense) !== JSON.stringify(DEFAULT_CATEGORIES.expense);
}

export function writeLocalFinanceSnapshot(snapshot: FinanceSnapshot): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FINANCE_STORAGE_KEYS.transactions, JSON.stringify(snapshot.transactions));
  window.localStorage.setItem(FINANCE_STORAGE_KEYS.debts, JSON.stringify(snapshot.debts));
  window.localStorage.setItem(FINANCE_STORAGE_KEYS.goals, JSON.stringify(snapshot.goals));
  window.localStorage.setItem(FINANCE_STORAGE_KEYS.categories, JSON.stringify(snapshot.categories));
  window.localStorage.setItem(FINANCE_STORAGE_KEYS.creditCards, JSON.stringify(snapshot.creditCards));
}

export function accountCacheStorageKey(accountKey: string): string {
  return `finora:account-cache:v1:${accountKey}`;
}

export function readAccountCache(accountKey: string): FinanceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(accountCacheStorageKey(accountKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.revision !== "number"
      || !Number.isInteger(parsed.revision) || parsed.revision < 0 || typeof parsed.pending !== "boolean"
      || typeof parsed.updatedAt !== "string" || !validateFinanceSnapshot(parsed.snapshot)) return null;
    return parsed as FinanceCache;
  } catch {
    return null;
  }
}

export function writeAccountCache(accountKey: string, cache: FinanceCache): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(accountCacheStorageKey(accountKey), JSON.stringify(cache));
}

export function readOfflineSession(): OfflineSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.accountKey !== "string" || !/^[a-f0-9]{32}$/.test(parsed.accountKey)
      || typeof parsed.displayName !== "string" || !(typeof parsed.email === "string" || parsed.email === null)) return null;
    return parsed as OfflineSession;
  } catch {
    return null;
  }
}

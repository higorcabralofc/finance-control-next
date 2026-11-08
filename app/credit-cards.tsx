"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, Check, CreditCard, Pencil, Plus, Receipt, Trash2, Wallet, X } from "lucide-react";

export type CreditCardAccount = {
  id: number;
  name: string;
  lastFour: string;
  creditLimit: number;
  closingDay: number;
  dueDay: number;
};

export type CardPurchase = {
  id: number;
  cardId: number;
  title: string;
  category: string;
  amount: number;
  purchaseDate: string;
  installments: number;
};

export type CardInvoicePayment = {
  cardId: number;
  month: string;
  paidTransactionId: number;
  paidAt: string;
};

export type CreditCardStore = {
  cards: CreditCardAccount[];
  purchases: CardPurchase[];
  payments: CardInvoicePayment[];
};

export type CardInvoiceLine = {
  purchaseId: number;
  title: string;
  category: string;
  purchaseDate: string;
  installmentNumber: number;
  installmentCount: number;
  amount: number;
};

export type CreditCardInvoice = {
  key: string;
  cardId: number;
  month: string;
  dueDate: string;
  amount: number;
  lines: CardInvoiceLine[];
  paidTransactionId?: number;
  paidAt?: string;
};

export const cardStorageKey = "finora:credit-cards:v1";
export const cardInvoiceCategory = "Faturas de cartão";

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const parseMoney = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "");
  return Number(normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized);
};

function isDateValue(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isStoredCreditCard(value: unknown): value is CreditCardAccount {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" && Number.isFinite(item.id)
    && typeof item.name === "string" && item.name.trim().length > 0
    && typeof item.lastFour === "string" && (item.lastFour === "" || /^\d{4}$/.test(item.lastFour))
    && typeof item.creditLimit === "number" && Number.isFinite(item.creditLimit) && item.creditLimit > 0
    && typeof item.closingDay === "number" && Number.isInteger(item.closingDay) && item.closingDay >= 1 && item.closingDay <= 31
    && typeof item.dueDay === "number" && Number.isInteger(item.dueDay) && item.dueDay >= 1 && item.dueDay <= 31;
}

export function isStoredCardPurchase(value: unknown): value is CardPurchase {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" && Number.isFinite(item.id)
    && typeof item.cardId === "number" && Number.isFinite(item.cardId)
    && typeof item.title === "string" && item.title.trim().length > 0
    && typeof item.category === "string" && item.category.trim().length > 0
    && typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount > 0
    && isDateValue(item.purchaseDate)
    && typeof item.installments === "number" && Number.isInteger(item.installments) && item.installments >= 1 && item.installments <= 48;
}

export function isStoredCardInvoicePayment(value: unknown): value is CardInvoicePayment {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.cardId === "number" && Number.isFinite(item.cardId)
    && typeof item.month === "string" && /^\d{4}-\d{2}$/.test(item.month)
    && typeof item.paidTransactionId === "number" && Number.isFinite(item.paidTransactionId)
    && typeof item.paidAt === "string";
}

export function isStoredCreditCardStore(value: unknown): value is CreditCardStore {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.cards) && item.cards.every(isStoredCreditCard)
    && Array.isArray(item.purchases) && item.purchases.every(isStoredCardPurchase)
    && Array.isArray(item.payments) && item.payments.every(isStoredCardInvoicePayment);
}

function monthKey(year: number, month: number) {
  const index = year * 12 + month - 1;
  const normalizedYear = Math.floor(index / 12);
  const normalizedMonth = index % 12 + 1;
  return `${normalizedYear}-${String(normalizedMonth).padStart(2, "0")}`;
}

function addMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  return monthKey(year, month + offset);
}

function firstInvoiceMonth(purchaseDate: string, closingDay: number) {
  const date = new Date(`${purchaseDate}T12:00:00`);
  const base = monthKey(date.getFullYear(), date.getMonth() + 1);
  return date.getDate() > closingDay ? addMonth(base, 1) : base;
}

function invoiceDueDate(invoiceMonth: string, closingDay: number, dueDay: number) {
  const [year, month] = invoiceMonth.split("-").map(Number);
  const dueMonth = addMonth(invoiceMonth, dueDay <= closingDay ? 1 : 0);
  const [dueYear, dueMonthNumber] = dueMonth.split("-").map(Number);
  const finalDay = new Date(dueYear, dueMonthNumber, 0).getDate();
  return `${dueYear}-${String(dueMonthNumber).padStart(2, "0")}-${String(Math.min(dueDay, finalDay)).padStart(2, "0")}`;
}

export function buildCreditCardInvoices(cards: CreditCardAccount[], purchases: CardPurchase[], payments: CardInvoicePayment[]): CreditCardInvoice[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const paymentsByKey = new Map(payments.map((payment) => [`${payment.cardId}:${payment.month}`, payment]));
  const groups = new Map<string, { cardId: number; month: string; amountCents: number; lines: CardInvoiceLine[] }>();

  purchases.forEach((purchase) => {
    const card = cardsById.get(purchase.cardId);
    if (!card) return;
    const firstMonth = firstInvoiceMonth(purchase.purchaseDate, card.closingDay);
    const totalCents = Math.round(purchase.amount * 100);
    const baseCents = Math.floor(totalCents / purchase.installments);
    const extraCents = totalCents % purchase.installments;
    for (let index = 0; index < purchase.installments; index += 1) {
      const month = addMonth(firstMonth, index);
      const key = `${card.id}:${month}`;
      const installmentCents = baseCents + (index < extraCents ? 1 : 0);
      const group = groups.get(key) || { cardId: card.id, month, amountCents: 0, lines: [] };
      group.amountCents += installmentCents;
      group.lines.push({
        purchaseId: purchase.id,
        title: purchase.title,
        category: purchase.category,
        purchaseDate: purchase.purchaseDate,
        installmentNumber: index + 1,
        installmentCount: purchase.installments,
        amount: installmentCents / 100,
      });
      groups.set(key, group);
    }
  });

  return Array.from(groups.entries()).map(([key, group]) => {
    const card = cardsById.get(group.cardId)!;
    const payment = paymentsByKey.get(key);
    return {
      key,
      cardId: group.cardId,
      month: group.month,
      dueDate: invoiceDueDate(group.month, card.closingDay, card.dueDay),
      amount: group.amountCents / 100,
      lines: group.lines.sort((left, right) => left.title.localeCompare(right.title, "pt-BR")),
      paidTransactionId: payment?.paidTransactionId,
      paidAt: payment?.paidAt,
    };
  }).sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.key.localeCompare(right.key));
}

function displayDate(value: string) {
  if (!isDateValue(value)) return "Data inválida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function displayMonth(value: string) {
  const date = new Date(`${value}-01T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function todayValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function CreditCardModal({
  card,
  onClose,
  onSave,
}: {
  card?: CreditCardAccount;
  onClose: () => void;
  onSave: (card: Omit<CreditCardAccount, "id"> & { id?: number }) => void;
}) {
  const [name, setName] = useState(card?.name || "");
  const [lastFour, setLastFour] = useState(card?.lastFour || "");
  const [limitText, setLimitText] = useState(card ? String(card.creditLimit.toFixed(2)).replace(".", ",") : "");
  const [closingDayText, setClosingDayText] = useState(String(card?.closingDay || 20));
  const [dueDayText, setDueDayText] = useState(String(card?.dueDay || 5));
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limit = parseMoney(limitText);
    const closingDay = Number(closingDayText);
    const dueDay = Number(dueDayText);
    const digits = lastFour.trim();
    if (!name.trim() || !Number.isFinite(limit) || limit <= 0) {
      setError("Informe o nome do cartão e um limite maior que zero.");
      return;
    }
    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setError("Os dias de fechamento e vencimento devem estar entre 1 e 31.");
      return;
    }
    if (digits && !/^\d{4}$/.test(digits)) {
      setError("Informe os quatro últimos dígitos ou deixe o campo vazio.");
      return;
    }
    onSave({ id: card?.id, name: name.trim(), lastFour: digits, creditLimit: Math.round(limit * 100) / 100, closingDay, dueDay });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-modal card-modal" role="dialog" aria-modal="true" aria-labelledby="credit-card-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">LIMITES E VENCIMENTOS</p><h2 id="credit-card-modal-title">{card ? "Editar cartão" : "Novo cartão de crédito"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <label className="form-label">Nome do cartão<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nubank principal" maxLength={40} autoFocus required /></label>
          <div className="form-row">
            <label className="form-label">Limite total (R$)<input value={limitText} onChange={(event) => setLimitText(event.target.value)} placeholder="0,00" inputMode="decimal" required /></label>
            <label className="form-label">Últimos 4 dígitos (opcional)<input value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" inputMode="numeric" maxLength={4} /></label>
          </div>
          <div className="form-row">
            <label className="form-label">Dia de fechamento<input type="number" min={1} max={31} value={closingDayText} onChange={(event) => setClosingDayText(event.target.value)} required /></label>
            <label className="form-label">Dia de vencimento<input type="number" min={1} max={31} value={dueDayText} onChange={(event) => setDueDayText(event.target.value)} required /></label>
          </div>
          <p className="card-form-note"><CreditCard size={13} /> Não informe número completo, validade ou código de segurança. Só os últimos quatro dígitos são armazenados.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> {card ? "Salvar alterações" : "Adicionar cartão"}</button></div>
        </form>
      </section>
    </div>
  );
}

function CardPurchaseModal({
  cards,
  categories,
  initialCardId,
  onClose,
  onSave,
}: {
  cards: CreditCardAccount[];
  categories: string[];
  initialCardId: number;
  onClose: () => void;
  onSave: (purchase: Omit<CardPurchase, "id">) => void;
}) {
  const [cardIdText, setCardIdText] = useState(String(initialCardId));
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] || "Outros");
  const [amountText, setAmountText] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayValue);
  const [installmentsText, setInstallmentsText] = useState("1");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseMoney(amountText);
    const installments = Number(installmentsText);
    const cardId = Number(cardIdText);
    if (!cards.some((card) => card.id === cardId) || !title.trim() || !category || !Number.isFinite(amount) || amount <= 0 || !isDateValue(purchaseDate) || !Number.isInteger(installments) || installments < 1 || installments > 48) {
      setError("Confira a descrição, o cartão, o valor, a data e o número de parcelas.");
      return;
    }
    onSave({ cardId, title: title.trim(), category, amount: Math.round(amount * 100) / 100, purchaseDate, installments });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="transaction-modal card-modal" role="dialog" aria-modal="true" aria-labelledby="card-purchase-modal-title">
        <div className="modal-heading"><div><p className="eyebrow">COMPRAS E PARCELAS</p><h2 id="card-purchase-modal-title">Lançar compra</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
        <form onSubmit={submit}>
          <label className="form-label">Cartão<select value={cardIdText} onChange={(event) => setCardIdText(event.target.value)} required>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}{card.lastFour ? ` ···· ${card.lastFour}` : ""}</option>)}</select></label>
          <label className="form-label">Descrição da compra<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: mercado, passagem" maxLength={80} autoFocus required /></label>
          <div className="form-row">
            <label className="form-label">Valor total (R$)<input value={amountText} onChange={(event) => setAmountText(event.target.value)} placeholder="0,00" inputMode="decimal" required /></label>
            <label className="form-label">Categoria<select value={category} onChange={(event) => setCategory(event.target.value)} required>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          </div>
          <div className="form-row">
            <label className="form-label">Data da compra<input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} required /></label>
            <label className="form-label">Parcelas<input type="number" min={1} max={48} value={installmentsText} onChange={(event) => setInstallmentsText(event.target.value)} required /></label>
          </div>
          <p className="card-form-note"><CalendarDays size={13} /> A primeira parcela entra na fatura conforme o fechamento do cartão; as próximas são distribuídas nos meses seguintes.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> Salvar compra</button></div>
        </form>
      </section>
    </div>
  );
}

export function CreditCardManager({
  cards,
  purchases,
  payments,
  categories,
  hidden,
  onSaveCard,
  onDeleteCard,
  onSavePurchase,
  onDeletePurchase,
  onPayInvoice,
}: {
  cards: CreditCardAccount[];
  purchases: CardPurchase[];
  payments: CardInvoicePayment[];
  categories: string[];
  hidden: boolean;
  onSaveCard: (card: Omit<CreditCardAccount, "id"> & { id?: number }) => void;
  onDeleteCard: (id: number) => void;
  onSavePurchase: (purchase: Omit<CardPurchase, "id">) => void;
  onDeletePurchase: (id: number) => void;
  onPayInvoice: (invoice: CreditCardInvoice) => void;
}) {
  const [cardModal, setCardModal] = useState<CreditCardAccount | "new" | null>(null);
  const [purchaseCardId, setPurchaseCardId] = useState<number | null>(null);
  const invoices = buildCreditCardInvoices(cards, purchases, payments);
  const today = todayValue();

  function isPurchaseLocked(purchaseId: number) {
    return invoices.some((invoice) => Boolean(invoice.paidTransactionId) && invoice.lines.some((line) => line.purchaseId === purchaseId));
  }

  return (
    <section className="panel credit-card-manager" id="cartoes">
      <div className="panel-heading credit-card-heading">
        <div><p className="eyebrow">CARTÕES E FATURAS</p><h2>Cartões de crédito</h2><p className="panel-subtitle">Limites, compras e próximos vencimentos em um só lugar.</p></div>
        <button type="button" className="outline-button card-add-button" onClick={() => setCardModal("new")}><Plus size={14} /> Novo cartão</button>
      </div>

      {cards.length === 0 ? (
        <div className="card-empty-state"><span><CreditCard size={20} /></span><strong>Nenhum cartão cadastrado</strong><small>Adicione um cartão para registrar compras, acompanhar faturas e ver o limite disponível.</small><button type="button" className="button-primary" onClick={() => setCardModal("new")}><Plus size={15} /> Adicionar primeiro cartão</button></div>
      ) : (
        <div className="credit-card-list">
          {cards.map((card) => {
            const cardInvoices = invoices.filter((invoice) => invoice.cardId === card.id);
            const used = cardInvoices.reduce((sum, invoice) => sum + (invoice.paidTransactionId ? 0 : invoice.amount), 0);
            const available = card.creditLimit - used;
            const nextInvoice = cardInvoices.find((invoice) => !invoice.paidTransactionId);
            return (
              <article className="credit-card-item" key={card.id}>
                <div className="credit-card-visual">
                  <div className="credit-card-visual-top"><span className="credit-card-chip" /><CreditCard size={20} /></div>
                  <strong>{card.name}</strong>
                  <span>{card.lastFour ? `••••  ••••  ••••  ${card.lastFour}` : "Cartão de crédito"}</span>
                </div>
                <div className="credit-card-details">
                  <div className="credit-card-limit-row"><span>Limite total</span><strong>{hidden ? "••••••" : money(card.creditLimit)}</strong></div>
                  <div className="credit-card-limit-row"><span>Em uso</span><strong>{hidden ? "••••••" : money(used)}</strong></div>
                  <div className="credit-card-limit-row credit-card-available"><span>Disponível</span><strong>{hidden ? "••••••" : money(available)}</strong></div>
                  <div className={`card-limit-track ${available < 0 ? "card-limit-exceeded" : ""}`}><span style={{ width: `${card.creditLimit > 0 ? Math.min(used / card.creditLimit * 100, 100) : 0}%` }} /></div>
                  <p className="credit-card-cycle">Fecha dia {card.closingDay} · vence dia {card.dueDay}{nextInvoice ? ` · próxima fatura vence ${displayDate(nextInvoice.dueDate)}` : ""}</p>
                  <div className="credit-card-actions">
                    <button type="button" className="outline-button" onClick={() => setPurchaseCardId(card.id)}><Plus size={13} /> Lançar compra</button>
                    <button type="button" className="card-icon-action" aria-label={`Editar ${card.name}`} title="Editar cartão" onClick={() => setCardModal(card)}><Pencil size={14} /></button>
                    <button type="button" className="card-icon-action card-icon-delete" aria-label={`Excluir ${card.name}`} title="Excluir cartão" onClick={() => onDeleteCard(card.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="card-invoices-section">
        <div className="card-invoices-heading"><div><span className="eyebrow">CICLOS DE COBRANÇA</span><h3>Faturas</h3></div><span className="card-invoice-count">{invoices.length}</span></div>
        {invoices.length === 0 ? (
          <div className="card-invoices-empty"><Receipt size={16} /><span>As faturas aparecerão aqui depois que você lançar uma compra.</span></div>
        ) : (
          <div className="card-invoice-list">
            {invoices.map((invoice) => {
              const card = cards.find((item) => item.id === invoice.cardId);
              if (!card) return null;
              const overdue = !invoice.paidTransactionId && invoice.dueDate < today;
              const lockedPurchaseIds = new Set(invoice.lines.filter((line) => isPurchaseLocked(line.purchaseId)).map((line) => line.purchaseId));
              return (
                <article className={`card-invoice ${invoice.paidTransactionId ? "card-invoice-paid" : ""}`} key={invoice.key}>
                  <div className="card-invoice-top">
                    <div className="card-invoice-main"><span className="card-invoice-icon"><Receipt size={15} /></span><div><strong>{card.name} · fatura de <span className="invoice-month-label">{displayMonth(invoice.month)}</span></strong><small>Vencimento {displayDate(invoice.dueDate)}{invoice.paidAt ? ` · paga em ${displayDate(invoice.paidAt)}` : ""}</small></div></div>
                    <div className="card-invoice-total"><strong>{hidden ? "••••••" : money(invoice.amount)}</strong><span className={invoice.paidTransactionId ? "invoice-status-paid" : overdue ? "invoice-status-overdue" : "invoice-status-open"}>{invoice.paidTransactionId ? "Paga" : overdue ? "Vencida" : "Em aberto"}</span></div>
                  </div>
                  <details className="card-invoice-details">
                    <summary>Ver {invoice.lines.length} {invoice.lines.length === 1 ? "lançamento" : "lançamentos"}</summary>
                    <div className="card-invoice-lines">
                      {invoice.lines.map((line, index) => (
                        <div className="card-invoice-line" key={`${invoice.key}-${line.purchaseId}-${line.installmentNumber}-${index}`}>
                          <div><strong>{line.title}</strong><small>{line.category} · parcela {line.installmentNumber}/{line.installmentCount}</small></div>
                          <strong>{hidden ? "••••" : money(line.amount)}</strong>
                          {!lockedPurchaseIds.has(line.purchaseId) && <button type="button" className="card-line-delete" aria-label={`Excluir compra ${line.title}`} title="Excluir compra de todas as faturas" onClick={() => onDeletePurchase(line.purchaseId)}><Trash2 size={13} /></button>}
                        </div>
                      ))}
                    </div>
                  </details>
                  {!invoice.paidTransactionId && <button type="button" className="card-invoice-pay" onClick={() => onPayInvoice(invoice)}><Check size={13} /> Registrar pagamento da fatura</button>}
                </article>
              );
            })}
          </div>
        )}
      </div>
      <p className="card-manager-footnote"><Wallet size={12} /> Compras e faturas são salvas neste navegador. Ao pagar uma fatura, o pagamento entra nas despesas e a fatura deixa de consumir o limite; não informe número completo nem código de segurança.</p>

      {cardModal && <CreditCardModal key={cardModal === "new" ? "new-card" : `card-${cardModal.id}`} card={cardModal === "new" ? undefined : cardModal} onClose={() => setCardModal(null)} onSave={(card) => { onSaveCard(card); setCardModal(null); }} />}
      {purchaseCardId !== null && <CardPurchaseModal cards={cards} categories={categories} initialCardId={purchaseCardId} onClose={() => setPurchaseCardId(null)} onSave={(purchase) => { onSavePurchase(purchase); setPurchaseCardId(null); }} />}
    </section>
  );
}

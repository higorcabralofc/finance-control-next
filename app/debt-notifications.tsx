"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";

export type DebtDueAlert = {
  id: string;
  debtTitle: string;
  installmentNumber: number;
  installmentCount: number;
  amount: number;
  dueDate: string;
  overdue: boolean;
};

type DebtNotificationCenterProps = {
  alerts: DebtDueAlert[];
  hidden: boolean;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`));
}

export default function DebtNotificationCenter({ alerts, hidden }: DebtNotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const accessibleCount = alerts.length === 1 ? "1 parcela pendente" : `${alerts.length} parcelas pendentes`;

  return (
    <div className="notification-wrap" ref={containerRef}>
      <button
        ref={buttonRef}
        className={`icon-button notification-button ${open ? "icon-button-active" : ""}`}
        type="button"
        aria-label={alerts.length ? `Notificações de dívidas: ${accessibleCount}` : "Notificações de dívidas"}
        aria-expanded={open}
        aria-controls="debt-notification-panel"
        title="Notificações de dívidas"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} aria-hidden="true" />
        {alerts.length > 0 && <span className="notification-count" aria-hidden="true">{alerts.length > 99 ? "99+" : alerts.length}</span>}
      </button>

      {open && (
        <section
          className="debt-notification-panel"
          id="debt-notification-panel"
          aria-label="Notificações de vencimento das dívidas"
          aria-live="polite"
        >
          <div className="debt-notification-head">
            <div className="debt-notification-heading-copy">
              <strong>Vencimentos</strong>
              <span>{alerts.length ? accessibleCount : "Nenhum vencimento pendente"}</span>
            </div>
            <button className="icon-button debt-notification-close" type="button" aria-label="Fechar notificações" onClick={() => setOpen(false)}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="debt-notification-empty">
              <Check size={19} aria-hidden="true" />
              <strong>Nenhuma dívida vence hoje ou está atrasada.</strong>
              <span>As parcelas aparecem aqui no dia do vencimento.</span>
            </div>
          ) : (
            <ul className="debt-notification-list">
              {alerts.slice(0, 50).map((alert) => (
                <li className={`debt-notification-item ${alert.overdue ? "debt-notification-item-overdue" : ""}`} key={alert.id}>
                  <span className="debt-notification-icon"><Bell size={14} aria-hidden="true" /></span>
                  <div className="debt-notification-copy">
                    <div className="debt-notification-title-row">
                      <strong title={alert.debtTitle}>{alert.debtTitle}</strong>
                      <span>{alert.overdue ? "Atrasada" : "Vence hoje"}</span>
                    </div>
                    <p>Parcela {alert.installmentNumber}/{alert.installmentCount} · {alert.overdue ? "venceu" : "vence"} {formatDate(alert.dueDate)}</p>
                  </div>
                  <strong className="debt-notification-amount">{hidden ? "••••••" : formatAmount(alert.amount)}</strong>
                </li>
              ))}
            </ul>
          )}

          {alerts.length > 50 && <p className="debt-notification-overflow">Exibindo 50 de {alerts.length} parcelas pendentes.</p>}
          <p className="debt-notification-footnote">O alerta permanece até registrar o pagamento. Com o Finora aberto, você também recebe um aviso no dia do vencimento.</p>
        </section>
      )}
    </div>
  );
}

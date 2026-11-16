"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, Cloud, CloudOff, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import Dashboard from "./dashboard";
import {
  LEGACY_IMPORT_MARKER_KEY,
  OFFLINE_SESSION_KEY,
  emptyFinanceSnapshot,
  hasMeaningfulFinanceData,
  readAccountCache,
  readLocalFinanceSnapshot,
  readOfflineSession,
  validateFinanceSnapshot,
  writeAccountCache,
  writeLocalFinanceSnapshot,
  type FinanceSnapshot,
  type OfflineSession,
} from "@/lib/finance-snapshot";

type UserProfile = OfflineSession;
type DashboardBootstrap = {
  user: UserProfile;
  revision: number;
  pending: boolean;
  offline: boolean;
};
type ConflictState = {
  user: UserProfile;
  localSnapshot: FinanceSnapshot;
  remoteSnapshot: FinanceSnapshot;
  remoteRevision: number;
  remoteExists: boolean;
  differentAccount: boolean;
};
type RemoteFinance = {
  exists: boolean;
  revision: number;
  snapshot: FinanceSnapshot | null;
};
type Phase = "checking" | "login" | "conflict" | "ready" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseUser(value: unknown): UserProfile | null {
  if (!isRecord(value) || typeof value.accountKey !== "string" || !/^[a-f0-9]{32}$/.test(value.accountKey)
    || typeof value.displayName !== "string" || !(typeof value.email === "string" || value.email === null)) return null;
  return { accountKey: value.accountKey, displayName: value.displayName, email: value.email };
}

function parseRemoteFinance(value: unknown): RemoteFinance | null {
  if (!isRecord(value) || typeof value.exists !== "boolean" || typeof value.revision !== "number"
    || !Number.isInteger(value.revision) || value.revision < 0) return null;
  if (value.snapshot !== null && !validateFinanceSnapshot(value.snapshot)) return null;
  if (value.exists && value.snapshot === null) return null;
  return { exists: value.exists, revision: value.revision, snapshot: value.snapshot as FinanceSnapshot | null };
}

function saveRecoveryCopy(accountKey: string, label: "local" | "cloud", snapshot: FinanceSnapshot) {
  const recoveryKey = `finora:recovery:v1:${accountKey}:${label}:${Date.now()}`;
  window.localStorage.setItem(recoveryKey, JSON.stringify(snapshot));
}

async function postSnapshot(snapshot: FinanceSnapshot, expectedRevision: number, accountKey: string) {
  const response = await fetch("/api/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Finora-Account-Key": accountKey },
    cache: "no-store",
    body: JSON.stringify({ expectedRevision, snapshot }),
  });
  const payload = await response.json() as Record<string, unknown>;
  if (response.status === 409 && payload.conflict === true) {
    return {
      conflict: true as const,
      revision: typeof payload.revision === "number" ? payload.revision : expectedRevision,
      snapshot: validateFinanceSnapshot(payload.snapshot) ? payload.snapshot : emptyFinanceSnapshot(),
    };
  }
  if (!response.ok || payload.saved !== true || typeof payload.revision !== "number") {
    throw new Error(typeof payload.error === "string" ? payload.error : "Não foi possível sincronizar os dados.");
  }
  return { conflict: false as const, revision: payload.revision };
}

function LoginScreen({ busy, error, onLogin }: { busy: boolean; error: string; onLogin: () => void }) {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-brand-mark"><i /><i /><i /></span>
          <span className="auth-brand-name">finora<span>.</span></span>
        </div>
        <div className="auth-icon"><Wallet size={23} /></div>
        <p className="eyebrow">SUAS FINANÇAS, NO SEU RITMO</p>
        <h1 id="auth-title">Acesse sua vida financeira</h1>
        <p className="auth-description">Entre com sua conta Manus para manter transações, cartões, metas e parcelas sincronizados entre seus dispositivos.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-login-button" type="button" onClick={onLogin} disabled={busy}>
          {busy ? <LoaderCircle size={17} className="auth-spinner" /> : <LockKeyhole size={17} />}
          {busy ? "Conectando com a Manus…" : "Entrar com a conta Manus"}
          {!busy && <ArrowRight size={16} />}
        </button>
        <p className="auth-privacy"><ShieldCheck size={15} /> Seus dados financeiros ficam separados por conta e só são enviados após o login.</p>
        <div className="auth-offline-note"><Cloud size={15} /> Depois do primeiro acesso neste aparelho, você pode consultar e alterar uma cópia offline; as mudanças ficam pendentes até a conexão voltar.</div>
      </section>
    </main>
  );
}

function ConflictScreen({
  conflict,
  busy,
  error,
  onUseCloud,
  onUseDevice,
}: {
  conflict: ConflictState;
  busy: boolean;
  error: string;
  onUseCloud: () => void;
  onUseDevice: () => void;
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card conflict-card" aria-labelledby="conflict-title">
        <div className="auth-brand"><span className="auth-brand-mark"><i /><i /><i /></span><span className="auth-brand-name">finora<span>.</span></span></div>
        <div className="auth-icon conflict-icon"><RefreshCw size={22} /></div>
        <p className="eyebrow">ESCOLHA UMA VERSÃO</p>
        <h1 id="conflict-title">{conflict.differentAccount ? "Há dados locais de outra conta" : conflict.remoteExists ? "Encontramos dados nos dois lugares" : "Há dados locais sem cópia na nuvem"}</h1>
        <p className="auth-description">{conflict.differentAccount ? <>As informações locais podem pertencer a outra conta Manus. Elas não serão importadas sem sua escolha. Selecione o que deseja manter para <strong>{conflict.user.displayName}</strong>.</> : conflict.remoteExists ? <>Há informações neste dispositivo e na nuvem da conta <strong>{conflict.user.displayName}</strong>. Nenhuma versão foi substituída. Escolha qual será usada agora.</> : <>Ainda não há dados nesta conta na nuvem. Você pode começar com a conta vazia ou importar os dados locais para <strong>{conflict.user.displayName}</strong>.</>}</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="conflict-choices">
          <button className="conflict-choice" type="button" onClick={onUseCloud} disabled={busy}>
              <Cloud size={18} /><span><strong>{conflict.remoteExists ? "Usar dados da nuvem" : "Começar com a conta vazia"}</strong><small>{conflict.remoteExists ? "Preserva a versão salva na sua conta." : "Os dados locais ficarão guardados para recuperação."}</small></span><Check size={16} />
          </button>
          <button className="conflict-choice conflict-choice-secondary" type="button" onClick={onUseDevice} disabled={busy}>
              <CloudOff size={18} /><span><strong>{conflict.remoteExists ? "Substituir pela versão deste dispositivo" : "Importar os dados deste dispositivo"}</strong><small>{conflict.remoteExists ? "Envia esta cópia para a nuvem da conta." : "Envia esta cópia local para sua conta."}</small></span><ArrowRight size={16} />
          </button>
        </div>
        <p className="auth-privacy"><ShieldCheck size={15} /> A cópia que não for escolhida fica guardada neste dispositivo e não será importada automaticamente em outra conta.</p>
        {busy && <p className="auth-progress"><LoaderCircle size={15} className="auth-spinner" /> Protegendo as cópias e sincronizando…</p>}
      </section>
    </main>
  );
}

function LoadingScreen({ offline = false }: { offline?: boolean }) {
  return (
    <main className="auth-screen">
      <section className="auth-loading-card" role="status" aria-live="polite">
        <span className="auth-brand-mark"><i /><i /><i /></span>
        <LoaderCircle size={19} className="auth-spinner" />
        <strong>{offline ? "Abrindo a última cópia deste dispositivo…" : "Verificando sua conta Finora…"}</strong>
      </section>
    </main>
  );
}

export default function AuthShell() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [bootstrap, setBootstrap] = useState<DashboardBootstrap | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [error, setError] = useState("");

  const activate = useCallback((user: UserProfile, snapshot: FinanceSnapshot, revision: number, pending: boolean, offline: boolean) => {
    try {
      writeLocalFinanceSnapshot(snapshot);
      writeAccountCache(user.accountKey, { version: 1, revision, pending, snapshot, updatedAt: new Date().toISOString() });
      if (!offline) {
        window.localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(user));
        window.localStorage.setItem(LEGACY_IMPORT_MARKER_KEY, user.accountKey);
      }
      setBootstrap({ user, revision, pending, offline });
      setConflict(null);
      setPhase("ready");
      setError("");
    } catch {
      setError("Não foi possível salvar a cópia local com segurança. Seus dados remotos não foram alterados.");
      setPhase("error");
    }
  }, []);

  const enterOffline = useCallback((expectedAccountKey?: string) => {
    const offlineSession = readOfflineSession();
    if (!offlineSession || (expectedAccountKey && offlineSession.accountKey !== expectedAccountKey)) return false;
    const cache = readAccountCache(offlineSession.accountKey);
    if (!cache) return false;
    activate(offlineSession, cache.snapshot, cache.revision, cache.pending, true);
    return true;
  }, [activate]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      const authError = new URLSearchParams(window.location.search).get("auth_error");
      if (authError) {
        setError("Não foi possível concluir o login. Confira sua conta Manus e tente novamente.");
        window.history.replaceState({}, "", window.location.pathname);
      }

      let authenticatedAccountKey: string | undefined;
      let authResponse: Response;
      try {
        authResponse = await fetch("/api/auth/session", { cache: "no-store" });
      } catch {
        if (!cancelled && !enterOffline()) {
          setError("Sem conexão e sem uma cópia offline deste dispositivo. Conecte-se à internet para entrar.");
          setPhase("login");
        }
        return;
      }
      if (authResponse.status === 401) {
        if (!cancelled && !enterOffline()) setPhase("login");
        return;
      }
      if (!authResponse.ok) {
        if (!cancelled && !enterOffline()) {
          setError("Não foi possível validar sua conta. Tente novamente com uma conexão estável.");
          setPhase("login");
        }
        return;
      }

      try {
        const authPayload = await authResponse.json() as Record<string, unknown>;
        const user = parseUser(authPayload.user);
        if (authPayload.authenticated !== true || !user) throw new Error("A sessão não retornou uma conta válida.");
        authenticatedAccountKey = user.accountKey;
        const financeResponse = await fetch("/api/finance", {
          cache: "no-store",
          headers: { "X-Finora-Account-Key": user.accountKey },
        });
        if (!financeResponse.ok) throw new Error("Não foi possível carregar a cópia da nuvem.");
        const remote = parseRemoteFinance(await financeResponse.json());
        if (!remote) throw new Error("A resposta financeira da nuvem é inválida.");

        const cache = readAccountCache(user.accountKey);
        const importMarker = window.localStorage.getItem(LEGACY_IMPORT_MARKER_KEY);
        const localSnapshot = readLocalFinanceSnapshot();
        const hasLocalData = hasMeaningfulFinanceData(localSnapshot);
        const hasLegacy = hasLocalData && importMarker !== user.accountKey
          && (!cache || JSON.stringify(localSnapshot) !== JSON.stringify(cache.snapshot));
        const differentAccount = hasLocalData && importMarker !== null && importMarker !== user.accountKey;

        if (remote.exists && remote.snapshot) {
          if (cache?.pending && cache.revision !== remote.revision) {
            if (!cancelled) {
              setConflict({ user, localSnapshot: cache.snapshot, remoteSnapshot: remote.snapshot, remoteRevision: remote.revision, remoteExists: true, differentAccount: false });
              setPhase("conflict");
            }
            return;
          }
          if (hasLegacy) {
            if (!cancelled) {
              setConflict({ user, localSnapshot, remoteSnapshot: remote.snapshot, remoteRevision: remote.revision, remoteExists: true, differentAccount });
              setPhase("conflict");
            }
            return;
          }
          const usePending = Boolean(cache?.pending && cache.revision === remote.revision);
          if (!cancelled) activate(user, usePending && cache ? cache.snapshot : remote.snapshot, remote.revision, usePending, false);
          return;
        }

        if (remote.exists && !remote.snapshot) throw new Error("O conjunto financeiro da nuvem não pôde ser validado.");
        if (hasLegacy && differentAccount && !cache?.pending) {
          if (!cancelled) {
            setConflict({ user, localSnapshot, remoteSnapshot: emptyFinanceSnapshot(), remoteRevision: 0, remoteExists: false, differentAccount: true });
            setPhase("conflict");
          }
          return;
        }

        const candidate = cache?.pending ? cache.snapshot : hasLocalData ? localSnapshot : emptyFinanceSnapshot();
        if (cache?.pending || hasLocalData) {
          if (!validateFinanceSnapshot(candidate)) throw new Error("Os dados locais não passaram na validação. Nada foi enviado à nuvem.");
          const result = await postSnapshot(candidate, 0, user.accountKey);
          if (result.conflict) {
            if (!cancelled) {
              setConflict({ user, localSnapshot: candidate, remoteSnapshot: result.snapshot, remoteRevision: result.revision, remoteExists: true, differentAccount: false });
              setPhase("conflict");
            }
            return;
          }
          if (!cancelled) activate(user, candidate, result.revision, false, false);
          return;
        }

        if (!cancelled) activate(user, candidate, 0, false, false);
      } catch (caught) {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Não foi possível iniciar a sincronização.";
        if (!enterOffline(authenticatedAccountKey)) {
          const offlineSession = readOfflineSession();
          setError(authenticatedAccountKey && offlineSession && offlineSession.accountKey !== authenticatedAccountKey
            ? "A cópia offline pertence a outra conta. Os dados locais foram preservados e não serão enviados."
            : message);
          setPhase("error");
        }
      }
    };
    void start();
    return () => { cancelled = true; };
  }, [activate, enterOffline]);

  async function login() {
    setLoginBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", cache: "no-store" });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok || typeof payload.authorizationUrl !== "string") {
        throw new Error(typeof payload.error === "string" ? payload.error : "O login Manus não está disponível.");
      }
      window.location.assign(payload.authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível iniciar o login.");
      setLoginBusy(false);
    }
  }

  function chooseCloudCopy() {
    if (!conflict) return;
    setConflictBusy(true);
    try {
      saveRecoveryCopy(conflict.user.accountKey, "local", conflict.localSnapshot);
      activate(conflict.user, conflict.remoteSnapshot, conflict.remoteRevision, false, false);
    } catch {
      setError("Não foi possível guardar a cópia local de recuperação. Nenhuma versão foi substituída.");
      setConflictBusy(false);
    }
  }

  async function chooseDeviceCopy() {
    if (!conflict) return;
    setConflictBusy(true);
    setError("");
    try {
      saveRecoveryCopy(conflict.user.accountKey, "cloud", conflict.remoteSnapshot);
      const result = await postSnapshot(conflict.localSnapshot, conflict.remoteRevision, conflict.user.accountKey);
      if (result.conflict) {
        setConflict({ ...conflict, remoteSnapshot: result.snapshot, remoteRevision: result.revision, remoteExists: true });
        setError("A nuvem mudou novamente. Revise as duas versões e escolha de novo.");
        setConflictBusy(false);
        return;
      }
      activate(conflict.user, conflict.localSnapshot, result.revision, false, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a cópia deste dispositivo.");
      setConflictBusy(false);
    }
  }

  async function logout() {
    let revocationConfirmed = false;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
      const payload: unknown = await response.json();
      revocationConfirmed = response.ok && isRecord(payload) && payload.loggedOut === true && payload.revocationConfirmed === true;
    } catch {
      // Remove o acesso local, mas não afirma que a revogação no servidor foi confirmada.
    }
    window.localStorage.removeItem(OFFLINE_SESSION_KEY);
    setBootstrap(null);
    setPhase("login");
    setError(revocationConfirmed ? "" : "Você saiu deste aparelho, mas não foi possível confirmar a revogação da sessão no servidor.");
  }

  if (phase === "checking") return <LoadingScreen />;
  if (phase === "conflict" && conflict) {
    return <ConflictScreen conflict={conflict} busy={conflictBusy} error={error} onUseCloud={chooseCloudCopy} onUseDevice={() => void chooseDeviceCopy()} />;
  }
  if (phase === "ready" && bootstrap) {
    return <Dashboard
      key={bootstrap.user.accountKey}
      user={bootstrap.user}
      initialRevision={bootstrap.revision}
      initialPending={bootstrap.pending}
      offline={bootstrap.offline}
      onLogout={() => void logout()}
    />;
  }
  if (phase === "error") {
    return <LoginScreen busy={loginBusy} error={error} onLogin={() => void login()} />;
  }
  return <LoginScreen busy={loginBusy} error={error} onLogin={() => void login()} />;
}

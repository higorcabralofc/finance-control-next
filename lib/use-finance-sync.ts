
import { useCallback, useEffect, useRef, useState } from "react";
import {
  validateFinanceSnapshot,
  writeAccountCache,
  type FinanceCache,
  type FinanceSnapshot,
} from "@/lib/finance-snapshot";
import type { OfflineSession } from "@/lib/finance-snapshot";

export type FinanceSyncStatus = "saved" | "pending" | "syncing" | "offline" | "conflict" | "error" | "login-needed";

export type FinanceSyncConflict = {
  remoteRevision: number;
  remoteSnapshot: FinanceSnapshot;
};

type FinanceSyncOptions = {
  user: OfflineSession;
  snapshot: FinanceSnapshot;
  ready: boolean;
  initialRevision: number;
  initialPending: boolean;
  offline: boolean;
  onApplySnapshot: (snapshot: FinanceSnapshot) => void;
};

type FinanceResponse = {
  exists: boolean;
  revision: number;
  snapshot: FinanceSnapshot | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function verifyAccountSession(expectedAccountKey: string): Promise<"matched" | "expired" | "changed"> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (response.status === 401) return "expired";
  if (!response.ok) throw new Error("Não foi possível confirmar a conta ativa antes da sincronização.");
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.authenticated !== true || !isRecord(payload.user)
    || typeof payload.user.accountKey !== "string" || !/^[a-f0-9]{32}$/.test(payload.user.accountKey)) {
    throw new Error("A resposta da sessão não identificou uma conta válida.");
  }
  return payload.user.accountKey === expectedAccountKey ? "matched" : "changed";
}

async function readFinanceResponse(response: Response): Promise<FinanceResponse> {
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.exists !== "boolean" || typeof payload.revision !== "number"
    || !Number.isInteger(payload.revision) || payload.revision < 0
    || (payload.snapshot !== null && !validateFinanceSnapshot(payload.snapshot))
    || (payload.exists && payload.snapshot === null)) {
    throw new Error("A resposta financeira da nuvem é inválida.");
  }
  return { exists: payload.exists, revision: payload.revision, snapshot: payload.snapshot as FinanceSnapshot | null };
}

function writeCache(accountKey: string, revision: number, pending: boolean, snapshot: FinanceSnapshot): boolean {
  try {
    const cache: FinanceCache = { version: 1, revision, pending, snapshot, updatedAt: new Date().toISOString() };
    writeAccountCache(accountKey, cache);
    return true;
  } catch {
    return false;
  }
}

function saveRecoveryCopy(accountKey: string, label: "device" | "cloud", snapshot: FinanceSnapshot): boolean {
  try {
    window.localStorage.setItem(`finora:recovery:v1:${accountKey}:${Date.now()}:${label}`, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function useFinanceSync({
  user,
  snapshot,
  ready,
  initialRevision,
  initialPending,
  offline,
  onApplySnapshot,
}: FinanceSyncOptions) {
  const [status, setStatus] = useState<FinanceSyncStatus>(offline ? "offline" : initialPending ? "pending" : "saved");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState<FinanceSyncConflict | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const revisionRef = useRef(initialRevision);
  const pendingRef = useRef(initialPending);
  const inFlightRef = useRef(false);
  const initializedRef = useRef(false);
  const lastSnapshotRef = useRef("");
  const currentSnapshotRef = useRef(snapshot);
  const queuedSnapshotRef = useRef<FinanceSnapshot | null>(null);
  const conflictRef = useRef<FinanceSyncConflict | null>(null);
  const syncRef = useRef<(next: FinanceSnapshot, expectedRevision?: number) => Promise<void>>(async () => undefined);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    currentSnapshotRef.current = snapshot;
  }, [snapshot]);

  const setConflictState = useCallback((next: FinanceSyncConflict | null) => {
    conflictRef.current = next;
    setConflict(next);
  }, []);

  const syncSnapshot = useCallback(async (nextSnapshot: FinanceSnapshot, expectedRevisionOverride?: number) => {
    if (conflictRef.current && expectedRevisionOverride === undefined) return;
    if (!validateFinanceSnapshot(nextSnapshot)) {
      setMessage("Os dados locais não passaram na validação; nada foi enviado.");
      setStatus("error");
      return;
    }
    if (!navigator.onLine) {
      pendingRef.current = true;
      writeCache(user.accountKey, revisionRef.current, true, nextSnapshot);
      setMessage("As alterações estão guardadas neste dispositivo e serão enviadas quando houver conexão.");
      setStatus("offline");
      return;
    }
    if (inFlightRef.current) {
      queuedSnapshotRef.current = nextSnapshot;
      return;
    }

    inFlightRef.current = true;
    setStatus("syncing");
    setMessage("");
    const expectedRevision = expectedRevisionOverride ?? revisionRef.current;
    try {
      const accountStatus = await verifyAccountSession(user.accountKey);
      if (accountStatus !== "matched") {
        pendingRef.current = true;
        writeCache(user.accountKey, expectedRevision, true, nextSnapshot);
        setMessage(accountStatus === "changed"
          ? "A conta ativa mudou. Nenhum dado foi enviado; entre novamente com a conta correta."
          : "Sua sessão expirou. As alterações ficaram guardadas neste dispositivo; entre novamente para sincronizar.");
        setStatus("login-needed");
        return;
      }
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Finora-Account-Key": user.accountKey },
        cache: "no-store",
        body: JSON.stringify({ expectedRevision, snapshot: nextSnapshot }),
      });
      const payload: unknown = await response.json();
      if (response.status === 401 || (response.status === 403 && isRecord(payload) && payload.accountMismatch === true)) {
        pendingRef.current = true;
        writeCache(user.accountKey, expectedRevision, true, nextSnapshot);
        setMessage(response.status === 401
          ? "Sua sessão expirou. As alterações ficaram guardadas neste dispositivo; entre novamente para sincronizar."
          : "A conta ativa mudou. Nenhum dado foi enviado; entre novamente com a conta correta.");
        setStatus("login-needed");
        return;
      }
      if (response.status === 409 && isRecord(payload) && payload.conflict === true) {
        if (typeof payload.revision !== "number" || !Number.isInteger(payload.revision) || !validateFinanceSnapshot(payload.snapshot)) {
          throw new Error("O conflito foi detectado, mas a versão remota não pôde ser validada. Seus dados locais foram preservados.");
        }
        const nextConflict = { remoteRevision: payload.revision, remoteSnapshot: payload.snapshot };
        pendingRef.current = true;
        lastSnapshotRef.current = JSON.stringify(nextSnapshot);
        writeCache(user.accountKey, expectedRevision, true, nextSnapshot);
        setConflictState(nextConflict);
        setMessage("As duas versões foram preservadas. Escolha qual delas deseja usar.");
        setStatus("conflict");
        return;
      }
      if (!response.ok || !isRecord(payload) || payload.saved !== true || typeof payload.revision !== "number") {
        const errorMessage = isRecord(payload) && typeof payload.error === "string" ? payload.error : "Não foi possível sincronizar agora.";
        throw new Error(errorMessage);
      }

      revisionRef.current = payload.revision;
      pendingRef.current = false;
      lastSnapshotRef.current = JSON.stringify(nextSnapshot);
      writeCache(user.accountKey, payload.revision, false, nextSnapshot);
      setConflictState(null);
      setStatus("saved");
      setMessage("Todas as alterações estão sincronizadas.");
    } catch (caught) {
      pendingRef.current = true;
      writeCache(user.accountKey, expectedRevision, true, nextSnapshot);
      const errorMessage = caught instanceof Error ? caught.message : "Falha de conexão com a nuvem.";
      setMessage(`${errorMessage} A cópia local foi mantida.`);
      setStatus(navigator.onLine ? "error" : "offline");
    } finally {
      inFlightRef.current = false;
      const queued = queuedSnapshotRef.current;
      queuedSnapshotRef.current = null;
      if (queued && !conflictRef.current) window.setTimeout(() => { void syncRef.current(queued); }, 0);
    }
  }, [setConflictState, user.accountKey]);

  useEffect(() => {
    syncRef.current = syncSnapshot;
  }, [syncSnapshot]);

  const refreshRemote = useCallback(async () => {
    if (!ready || !navigator.onLine || inFlightRef.current || conflictRef.current) return;
    try {
      const accountStatus = await verifyAccountSession(user.accountKey);
      if (accountStatus !== "matched") {
        setMessage(accountStatus === "changed"
          ? "A conta ativa mudou. Seus dados locais foram mantidos e não serão enviados à outra conta."
          : "Sua sessão expirou. Seus dados locais foram mantidos; entre novamente para sincronizar.");
        setStatus("login-needed");
        return;
      }
      const response = await fetch("/api/finance", {
        cache: "no-store",
        headers: { "X-Finora-Account-Key": user.accountKey },
      });
      if (response.status === 401 || response.status === 403) {
        const payload: unknown = await response.json();
        if (response.status === 401 || (isRecord(payload) && payload.accountMismatch === true)) {
          setMessage(response.status === 401
            ? "Sua sessão expirou. Seus dados locais foram mantidos; entre novamente para sincronizar."
            : "A conta ativa mudou. Seus dados locais foram mantidos e não serão enviados à outra conta.");
          setStatus("login-needed");
          return;
        }
      }
      if (!response.ok) throw new Error("Não foi possível verificar a versão da nuvem.");
      const remote = await readFinanceResponse(response);
      if (!remote.exists || !remote.snapshot) {
        if (revisionRef.current !== 0) throw new Error("A cópia remota não foi encontrada; seus dados locais foram mantidos.");
        if (!pendingRef.current) setStatus("saved");
        return;
      }
      if (remote.revision === revisionRef.current) {
        if (!pendingRef.current) {
          setStatus("saved");
          setMessage("Todas as alterações estão sincronizadas.");
        }
        return;
      }
      if (remote.revision < revisionRef.current) throw new Error("A nuvem retornou uma revisão anterior; seus dados locais foram mantidos.");
      if (pendingRef.current) {
        const nextConflict = { remoteRevision: remote.revision, remoteSnapshot: remote.snapshot };
        setConflictState(nextConflict);
        setStatus("conflict");
        setMessage("Este dispositivo e a nuvem têm alterações diferentes. Escolha uma versão.");
        writeCache(user.accountKey, revisionRef.current, true, currentSnapshotRef.current);
        return;
      }

      onApplySnapshot(remote.snapshot);
      revisionRef.current = remote.revision;
      pendingRef.current = false;
      lastSnapshotRef.current = JSON.stringify(remote.snapshot);
      writeCache(user.accountKey, remote.revision, false, remote.snapshot);
      setStatus("saved");
      setMessage("Dados atualizados a partir da nuvem.");
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "Não foi possível verificar a sincronização.";
      setMessage(errorMessage);
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [onApplySnapshot, ready, setConflictState, user.accountKey]);

  useEffect(() => {
    refreshRef.current = refreshRemote;
  }, [refreshRemote]);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(snapshot);
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSnapshotRef.current = serialized;
      pendingRef.current = initialPending;
      writeCache(user.accountKey, initialRevision, initialPending, snapshot);
      if (initialPending) {
        if (navigator.onLine) void syncRef.current(snapshot);
        else if (!offline) {
          const timer = window.setTimeout(() => setStatus("offline"), 0);
          return () => window.clearTimeout(timer);
        }
        return;
      }
      if (offline || navigator.onLine) return;
      const timer = window.setTimeout(() => setStatus("offline"), 0);
      return () => window.clearTimeout(timer);
    }
    if (serialized === lastSnapshotRef.current) return;
    lastSnapshotRef.current = serialized;
    pendingRef.current = true;
    writeCache(user.accountKey, revisionRef.current, true, snapshot);
    if (conflictRef.current) {
      setStatus("conflict");
      return;
    }
    if (!navigator.onLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o status visual com a conectividade externa após persistir a cópia local.
      setStatus("offline");
      setMessage("As alterações estão guardadas neste dispositivo e serão enviadas quando houver conexão.");
      return;
    }
    setStatus("pending");
    const timer = window.setTimeout(() => { void syncRef.current(snapshot); }, 650);
    return () => window.clearTimeout(timer);
  }, [initialPending, initialRevision, offline, ready, snapshot, user.accountKey]);

  useEffect(() => {
    const checkConnection = () => {
      if (!navigator.onLine) {
        setStatus("offline");
        setMessage("A cópia sincronizada continua disponível neste dispositivo; novas alterações ficam pendentes.");
        return;
      }
      if (pendingRef.current) void syncRef.current(currentSnapshotRef.current);
      else void refreshRef.current();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkConnection();
    };
    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);
    window.addEventListener("focus", checkConnection);
    document.addEventListener("visibilitychange", handleVisibility);
    if (offline) checkConnection();
    return () => {
      window.removeEventListener("online", checkConnection);
      window.removeEventListener("offline", checkConnection);
      window.removeEventListener("focus", checkConnection);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [offline]);

  const resolveWithCloud = useCallback(() => {
    if (!conflictRef.current) return;
    const localCopy = currentSnapshotRef.current;
    const currentConflict = conflictRef.current;
    if (!saveRecoveryCopy(user.accountKey, "device", localCopy)) {
      setMessage("Não foi possível salvar a cópia local de recuperação; nenhuma versão foi substituída.");
      return;
    }
    try {
      onApplySnapshot(currentConflict.remoteSnapshot);
      revisionRef.current = currentConflict.remoteRevision;
      pendingRef.current = false;
      lastSnapshotRef.current = JSON.stringify(currentConflict.remoteSnapshot);
      writeCache(user.accountKey, currentConflict.remoteRevision, false, currentConflict.remoteSnapshot);
      setConflictState(null);
      setStatus("saved");
      setMessage("A versão da nuvem foi aplicada. A cópia anterior deste dispositivo ficou guardada para recuperação.");
    } catch {
      setMessage("Não foi possível aplicar a versão da nuvem. A cópia local foi mantida.");
      setStatus("error");
    }
  }, [onApplySnapshot, setConflictState, user.accountKey]);

  const resolveWithDevice = useCallback(async () => {
    const currentConflict = conflictRef.current;
    if (!currentConflict) return;
    const localCopy = currentSnapshotRef.current;
    if (!saveRecoveryCopy(user.accountKey, "cloud", currentConflict.remoteSnapshot)) {
      setMessage("Não foi possível salvar a cópia da nuvem de recuperação; nenhuma versão foi substituída.");
      return;
    }
    setConflictBusy(true);
    await syncRef.current(localCopy, currentConflict.remoteRevision);
    setConflictBusy(false);
  }, [user.accountKey]);

  return { status, message, conflict, conflictBusy, resolveWithCloud, resolveWithDevice };
}

import { Cloud, CloudOff, ShieldCheck } from "lucide-react";

type SyncConflictDialogProps = {
  onUseCloud: () => void;
  onUseDevice: () => void;
  busy: boolean;
};

export default function SyncConflictDialog({ onUseCloud, onUseDevice, busy }: SyncConflictDialogProps) {
  return (
    <div className="modal-backdrop sync-conflict-overlay">
      <section className="transaction-modal sync-conflict-modal" role="alertdialog" aria-modal="true" aria-labelledby="sync-conflict-title">
        <p className="eyebrow">SINCRONIZAÇÃO EM PAUSA</p>
        <h2 id="sync-conflict-title">Há alterações em outro dispositivo</h2>
        <p className="sync-conflict-copy">Mantivemos a cópia deste dispositivo e a versão da nuvem. Escolha qual será aplicada; nada será substituído sem sua confirmação.</p>
        <div className="sync-conflict-choices">
          <button type="button" className="sync-conflict-choice" onClick={onUseCloud} disabled={busy}>
            <Cloud size={18} /><span><strong>Usar versão da nuvem</strong><small>Atualiza este dispositivo com a última cópia salva.</small></span>
          </button>
          <button type="button" className="sync-conflict-choice sync-conflict-choice-secondary" onClick={onUseDevice} disabled={busy}>
            <CloudOff size={18} /><span><strong>Manter esta cópia e enviar</strong><small>Substitui a versão da nuvem pelo que está neste dispositivo.</small></span>
          </button>
        </div>
        <p className="sync-conflict-footnote"><ShieldCheck size={14} /> A versão preterida fica guardada localmente para recuperação.</p>
        {busy && <p className="sync-conflict-busy" role="status">Sincronizando com segurança…</p>}
      </section>
    </div>
  );
}

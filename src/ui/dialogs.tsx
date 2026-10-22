import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TreeDoc } from '../model/types';
import { addChildOptions, displayName, type AddChildMode } from '../model/relations';
import { t } from '../i18n';

export function Modal(props: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div ref={ref} className={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title} data-testid={props.testId}>
        <h3>{props.title}</h3>
        {props.children}
      </div>
    </div>
  );
}

export function ConfirmDialog(props: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={props.title} onClose={props.onCancel} testId="confirm-dialog">
      <div className="note" style={{ fontSize: 14, color: 'var(--muted)' }}>{props.message}</div>
      <div className="actions">
        <button className="btn ghost" onClick={props.onCancel} data-testid="confirm-cancel">{t('cancel')}</button>
        <button className={`btn ${props.danger ? 'danger' : 'primary'}`} onClick={props.onConfirm} data-testid="confirm-ok">
          {props.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function MessageDialog(props: { title: string; message: ReactNode; onClose: () => void }) {
  return (
    <Modal title={props.title} onClose={props.onClose} testId="message-dialog">
      <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>{props.message}</div>
      <div className="actions">
        <button className="btn primary" onClick={props.onClose} data-testid="message-ok">{t('ok')}</button>
      </div>
    </Modal>
  );
}

export function AddChildDialog(props: { doc: TreeDoc; personId: string; onAdd: (mode: AddChildMode) => void; onClose: () => void }) {
  const options = addChildOptions(props.doc, props.personId);
  const [choice, setChoice] = useState<string>(options.length ? `p:${options[0].partnerId}` : 'newPartner');
  const submit = () => {
    if (choice === 'newPartner') props.onAdd({ kind: 'newPartner' });
    else if (choice === 'single') props.onAdd({ kind: 'single' });
    else props.onAdd({ kind: 'withPartner', partnerId: choice.slice(2) });
  };
  const item = (value: string, label: string, desc: string) => (
    <label key={value} className={`choice${choice === value ? ' selected' : ''}`}>
      <input type="radio" name="add-child" value={value} checked={choice === value} onChange={() => setChoice(value)} />
      <div>
        <div className="t">{label}</div>
        <div className="d">{desc}</div>
      </div>
    </label>
  );
  return (
    <Modal title={t('addChildFor', { name: displayName(props.doc.persons[props.personId], props.doc.settings) })} onClose={props.onClose} testId="add-child-dialog">
      <div className="choice-list">
        {options.map((o) => item(`p:${o.partnerId}`, o.label, t('addChildWithDesc')))}
        {item('newPartner', t('addChildNewPartner'), t('addChildNewPartnerDesc'))}
        {item('single', t('addChildSingle'), t('addChildSingleDesc'))}
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={props.onClose}>{t('cancel')}</button>
        <button className="btn primary" onClick={submit} data-testid="add-child-submit">{t('add')}</button>
      </div>
    </Modal>
  );
}

export function ManualLayoutInfo(props: { onContinue: () => void; onCancel: () => void }) {
  // Short pause so the explanation is read before continuing (the original uses a countdown too).
  const [wait, setWait] = useState(3);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  return (
    <Modal title={t('manualInfoTitle')} onClose={props.onCancel} testId="manual-info">
      <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
        <p style={{ marginTop: 0 }}>{t('manualInfo1')}</p>
        <p>{t('manualInfo2')}</p>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={props.onCancel}>{t('cancel')}</button>
        <button className="btn primary" onClick={props.onContinue} disabled={wait > 0} data-testid="manual-continue">
          {wait > 0 ? `${t('continue')} (${wait})` : t('continue')}
        </button>
      </div>
    </Modal>
  );
}

export function Toast(props: { text: string; kind?: 'info' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(props.onDone, props.kind === 'error' ? 6000 : 3200);
    return () => clearTimeout(timer);
  }, [props]);
  return (
    <div className={`toast${props.kind === 'error' ? ' error' : ''}`} role="status" data-testid="toast">
      {props.text}
    </div>
  );
}

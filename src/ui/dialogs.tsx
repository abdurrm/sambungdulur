import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import type { TreeDoc } from '../model/types';
import { addChildOptions, displayName, type AddChildMode } from '../model/relations';
import { t } from '../i18n';
import { SHORTCUTS, showKeys } from './shortcuts';

/**
 * Every dialog goes through this wrapper so focus trapping, Escape, outside presses and focus return
 * are handled in one place (Base UI Dialog). Dialogs are mounted only while open; closing calls `onClose`.
 */
export function Modal(props: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; testId?: string }) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Popup className={`modal${props.wide ? ' wide' : ''}`} aria-label={props.title} data-testid={props.testId}>
          <Dialog.Title render={<h3 />}>{props.title}</Dialog.Title>
          {props.children}
          {/* Lets touch screen-reader users leave the dialog; placed last so it never takes initial focus. */}
          <Dialog.Close className="sr-only">{t('close')}</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
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


/** "?" help: every shortcut from the registry, in the current language. */
export function ShortcutsDialog(props: { onClose: () => void }) {
  const rows = SHORTCUTS.filter((s) => s.keys.length);
  return (
    <Modal title={t('shortcutsTitle')} onClose={props.onClose} testId="shortcuts-dialog">
      <table className="details shortcuts">
        <tbody>
          {rows.map((s) => (
            <tr key={s.command}>
              <th>
                {s.keys.map((k, i) => (
                  <span key={i}>
                    {i > 0 && ' / '}
                    <kbd>{showKeys(k)}</kbd>
                  </span>
                ))}
              </th>
              <td>{t(s.label)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">{t('shortcutsNote')}</p>
      <div className="actions">
        <button className="btn primary" onClick={props.onClose} data-testid="shortcuts-ok">{t('ok')}</button>
      </div>
    </Modal>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import type { TreeDoc } from '../model/types';
import { addChildOptions, displayName, type AddChildMode } from '../model/relations';
import { t, type Key } from '../i18n';
import { SHORTCUT_GROUPS, SHORTCUTS, showKeys, type ShortcutGroup } from './shortcuts';
import { commandIcon, Icon } from './icons';

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


const GROUP_LABEL: Record<ShortcutGroup, Key> = {
  file: 'grpFile',
  navigation: 'grpNavigation',
  person: 'grpPerson',
  view: 'grpView',
  history: 'grpHistory',
  help: 'grpHelp',
};

/** Shortcut list (Ctrl+H, F1, ?): every shortcut from the registry, grouped, in the current language, with a filter. */
export function ShortcutsDialog(props: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = SHORTCUTS.filter((s) => s.keys.length).filter(
    (s) => !needle || t(s.label).toLowerCase().includes(needle) || s.keys.some((k) => showKeys(k).toLowerCase().includes(needle)),
  );
  return (
    <Modal title={t('shortcutsTitle')} onClose={props.onClose} testId="shortcuts-dialog">
      <input
        type="search"
        className="input"
        placeholder={t('shortcutsFilter')}
        aria-label={t('shortcutsFilter')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        data-testid="shortcuts-filter"
      />
      <div className="shortcut-groups">
        {SHORTCUT_GROUPS.map((g) => {
          const items = rows.filter((s) => s.group === g);
          if (!items.length) return null;
          return (
            <section key={g} className="shortcut-group" data-testid={`shortcut-group-${g}`}>
              <h4 className="section-label">{t(GROUP_LABEL[g])}</h4>
              <table className="details shortcuts">
                <tbody>
                  {items.map((s) => (
                    <tr key={s.command} data-testid={`shortcut-${s.command}`}>
                      <th>
                        {s.keys.map((k, i) => (
                          <span key={i}>
                            {i > 0 && ' / '}
                            <kbd>{showKeys(k)}</kbd>
                          </span>
                        ))}
                      </th>
                      <td>
                        <span className="shortcut-label">
                          {commandIcon(s.command) ? <Icon id={commandIcon(s.command)!} size={16} /> : <span className="icon-gap" />}
                          {t(s.label)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
        {!rows.length && <p className="note" data-testid="shortcuts-none">{t('shortcutsNone', { q })}</p>}
      </div>
      <p className="note">{t('shortcutsNote')}</p>
      <div className="actions">
        <button className="btn primary" onClick={props.onClose} data-testid="shortcuts-ok">{t('ok')}</button>
      </div>
    </Modal>
  );
}

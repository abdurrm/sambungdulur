import { useState } from 'react';
import { Icon } from './icons';
import { Modal } from './dialogs';
import { t } from '../i18n';

export interface OpenReport {
  title: string;
  lines: string[];
}

export function OpenDialog(props: {
  onOpenFile: (file: File) => Promise<OpenReport>;
  onLinkFolder: (files: File[]) => Promise<OpenReport>;
  onNew: () => void;
  onClose: () => void;
  missingMedia: number;
  onImportKk: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<OpenReport | null>(null);
  const [error, setError] = useState('');
  const wrap = async (fn: () => Promise<OpenReport>) => {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      setReport(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const cursor = { cursor: busy ? 'wait' : 'pointer' };
  return (
    <Modal title={t('openDialogTitle')} onClose={() => !busy && props.onClose()} wide testId="open-dialog">
      <p className="note" style={{ fontSize: 13.5 }}>{t('openIntro')}</p>
      <button className="choice" onClick={props.onImportKk} disabled={busy} data-testid="open-import-kk">
        <span className="badge" style={{ color: 'var(--accent-text)', background: 'var(--accent-soft)' }}><Icon id="openFile" size={20} /></span>
        <span>
          <div className="t">{t('kkImport')}</div>
          <div className="d">{t('kkIntro')}</div>
        </span>
      </button>
      <label className="choice" style={cursor}>
        <span className="badge" style={{ color: 'var(--accent-text)', background: 'var(--accent-soft)' }}><Icon id="openFile" size={20} /></span>
        <span>
          <div className="t">{t('openFile')}</div>
          <div className="d">{t('openFileDesc')}</div>
        </span>
        <input
          type="file"
          hidden
          accept=".sambung,.ged,.zip,.json,application/zip,text/plain"
          disabled={busy}
          data-testid="open-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) wrap(() => props.onOpenFile(f));
          }}
        />
      </label>
      <label className="choice" style={cursor}>
        <span className="badge" style={{ color: 'var(--male)', background: 'var(--hover)' }}><Icon id="linkFolder" size={20} /></span>
        <span>
          <div className="t">{t('linkFolder')}</div>
          <div className="d">
            {t('linkFolderDesc')}
            {props.missingMedia > 0 ? ` ${t('missingPhotos', { n: props.missingMedia })}` : ''}
          </div>
        </span>
        <input
          type="file"
          hidden
          multiple
          // @ts-expect-error non-standard but widely supported directory picker attribute
          webkitdirectory=""
          disabled={busy}
          data-testid="link-folder-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) wrap(() => props.onLinkFolder(files));
          }}
        />
      </label>
      <label className="choice" style={cursor}>
        <span className="badge" style={{ color: 'var(--sogan-text)', background: 'var(--sogan-soft)' }}><Icon id="open" size={20} /></span>
        <span>
          <div className="t">{t('linkFiles')}</div>
          <div className="d">{t('linkFilesDesc')}</div>
        </span>
        <input
          type="file"
          hidden
          multiple
          accept="image/*"
          disabled={busy}
          data-testid="link-files-input"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) wrap(() => props.onLinkFolder(files));
          }}
        />
      </label>
      <button className="choice" onClick={props.onNew} disabled={busy} data-testid="new-tree">
        <span className="badge" style={{ color: 'var(--muted)', background: 'var(--hover)' }}><Icon id="newTree" size={20} /></span>
        <span>
          <div className="t">{t('newTree')}</div>
          <div className="d">{t('newTreeDesc')}</div>
        </span>
      </button>
      {busy && <p className="note">{t('working')}</p>}
      {error && <p className="error-text" data-testid="open-error">{error}</p>}
      {report && (
        <div data-testid="open-report">
          <div style={{ fontWeight: 650, marginBottom: 6 }}>{report.title}</div>
          <div className="report">{report.lines.join('\n')}</div>
        </div>
      )}
      <div className="actions">
        <button className="btn" onClick={props.onClose} disabled={busy} data-testid="open-close">{t('close')}</button>
      </div>
    </Modal>
  );
}

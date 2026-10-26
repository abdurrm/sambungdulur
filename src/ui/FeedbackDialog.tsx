import { useRef, useState } from 'react';
import { feedbackDestination, feedbackReport, type FeedbackKind } from '../io/feedback';
import { getLang, t } from '../i18n';
import { REPO_URL } from '../links';
import { APP_VERSION } from '../version';
import { Modal } from './dialogs';

export default function FeedbackDialog(props: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [steps, setSteps] = useState('');
  const [destination, setDestination] = useState<'new' | 'comment'>('new');
  const [issue, setIssue] = useState('');
  const [environment, setEnvironment] = useState(false);
  const [publicReady, setPublicReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'copied' | 'manual' | null>(null);
  const preview = useRef<HTMLTextAreaElement>(null);
  const input = { kind, title, details, steps: kind === 'bug' ? steps : '', language: getLang(),
    environment: environment ? `${navigator.userAgent}\nViewport: ${innerWidth} × ${innerHeight}` : undefined };
  const report = feedbackReport(input);
  const target = feedbackDestination(input, destination, issue);
  const valid = !!title.trim() && !!details.trim() && !!target;
  const copy = async () => {
    try { await navigator.clipboard.writeText(report); setCopyStatus('copied'); }
    catch { preview.current?.focus(); preview.current?.select(); setCopyStatus('manual'); }
  };
  return <Modal title={t('feedback')} onClose={props.onClose} wide testId="feedback-dialog">
    <p className="note">SambungDulur v{APP_VERSION} · {t('feedbackIntro')}</p>
    <div className="feedback-form">
      <label className="field">{t('feedbackKind')}<select className="input" value={kind} onChange={(e) => { setKind(e.target.value as FeedbackKind); setCopyStatus(null); }} data-testid="feedback-kind">
        <option value="bug">{t('feedbackBug')}</option><option value="idea">{t('feedbackIdea')}</option><option value="question">{t('feedbackQuestion')}</option>
      </select></label>
      <label className="field">{t('feedbackTitle')}<input className="input" value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setCopyStatus(null); }} data-testid="feedback-title" /></label>
      <label className="field">{t('feedbackDetails')}<textarea className="input" rows={4} value={details} maxLength={6000} onChange={(e) => { setDetails(e.target.value); setCopyStatus(null); }} data-testid="feedback-details" /></label>
      {kind === 'bug' && <label className="field">{t('feedbackSteps')}<textarea className="input" rows={2} value={steps} maxLength={2000} onChange={(e) => { setSteps(e.target.value); setCopyStatus(null); }} data-testid="feedback-steps" /></label>}
      <label className="field">{t('feedbackDestination')}<select className="input" value={destination} onChange={(e) => setDestination(e.target.value as 'new' | 'comment')} data-testid="feedback-destination">
        <option value="new">{t('feedbackNewIssue')}</option><option value="comment">{t('feedbackIssueComment')}</option>
      </select></label>
      {destination === 'comment' && <label className="field">{t('feedbackIssueNumber')}<input className="input" inputMode="numeric" value={issue} maxLength={10} placeholder="#123" onChange={(e) => setIssue(e.target.value)} data-testid="feedback-issue-number" /></label>}
      <label className="check"><input type="checkbox" checked={environment} onChange={(e) => { setEnvironment(e.target.checked); setCopyStatus(null); }} data-testid="feedback-environment" />{t('feedbackEnvironment')}</label>
      <label className="field">{t('feedbackPreview')}<textarea className="input" ref={preview} readOnly rows={5} value={report} data-testid="feedback-preview" /></label>
      {target?.copyRequired && <p className="note" data-testid="feedback-copy-help">{t('feedbackCopyHelp')}</p>}
      <p className="note">{t('feedbackPublic')}</p>
      <label className="check"><input type="checkbox" checked={publicReady} onChange={(e) => setPublicReady(e.target.checked)} data-testid="feedback-public-ready" />{t('feedbackPublicReady')}</label>
      <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">{t('feedbackBrowse')}</a>
      {copyStatus && <p role="status" data-testid="feedback-copy-status">{t(copyStatus === 'copied' ? 'feedbackCopied' : 'feedbackCopyManual')}</p>}
    </div>
    <div className="actions">
      <button className="btn ghost" onClick={props.onClose}>{t('close')}</button>
      <button className="btn" disabled={!title.trim() || !details.trim()} onClick={() => void copy()} data-testid="feedback-copy">{t('feedbackCopy')}</button>
      {valid && publicReady && target ? <a className="btn primary" href={target.url} target="_blank" rel="noopener noreferrer" data-testid="feedback-open">{t('feedbackOpen')}</a> : <button className="btn primary" disabled data-testid="feedback-open">{t('feedbackOpen')}</button>}
    </div>
  </Modal>;
}

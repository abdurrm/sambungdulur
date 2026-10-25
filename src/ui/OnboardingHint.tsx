import { useEffect, useRef } from 'react';
import { Icon } from './icons';
import { t } from '../i18n';
import type { PointerKind } from './viewport';

export const ONBOARDED_KEY = 'sambungdulur.onboarded';

/** First-visit tips, worded for the input in use. Non-blocking; dismissed for good with one tap or Escape. */
export function OnboardingHint(props: { pointer: PointerKind; wide?: boolean; onDismiss: () => void }) {
  // Listen in the capture phase: other layers (the phone sheet) consume Escape for themselves.
  const dismiss = useRef(props.onDismiss);
  dismiss.current = props.onDismiss;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss.current();
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
  const tips = props.pointer === 'coarse' ? (['obTap', 'obLongPress', 'obDrag'] as const) : ([props.wide ? 'obClickWide' : 'obClick', 'obRightClick', 'obKeys'] as const);
  return (
    <aside className="onboarding" aria-labelledby="onboarding-title" data-testid="onboarding">
      <div className="onboarding-head">
        <strong id="onboarding-title">{t('obTitle')}</strong>
        <button className="onboarding-x" onClick={props.onDismiss} aria-label={t('close')}>
          <Icon id="close" size={16} />
        </button>
      </div>
      <ul>
        {tips.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
      <button className="btn primary onboarding-ok" onClick={props.onDismiss} data-testid="onboarding-ok">
        {t('obDismiss')}
      </button>
    </aside>
  );
}

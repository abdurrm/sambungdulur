import type { DateFormat, FontSize, TreeSettings } from '../model/types';
import { LANGS, t, type Lang } from '../i18n';

const DATE_FORMATS: DateFormat[] = ['MM/DD/YYYY', 'MM.DD.YYYY', 'DD/MM/YYYY', 'DD.MM.YYYY', 'YYYY'];

export function GenerationControl(props: { settings: TreeSettings; onChange: (patch: Partial<TreeSettings>) => void; compact?: boolean }) {
  const s = props.settings;
  const step = (key: 'ancestorGenerations' | 'descendantGenerations', delta: number) => {
    // Sequence: 0 … 10, then All (-1).
    const cur = s[key];
    let next: number;
    if (delta > 0) next = cur < 0 || cur >= 10 ? -1 : cur + 1;
    else next = cur < 0 ? 10 : Math.max(0, cur - 1);
    props.onChange({ [key]: next });
  };
  const show = (v: number) => (v < 0 ? t('all') : String(v));
  return (
    <div className="gen-control" role="group" aria-label={t('generationsShown')} data-testid="gen-control">
      {!props.compact && <span className="lbl">{t('generations')}</span>}
      <span className="dir" title={t('ancestorGens')}>▲</span>
      <button onClick={() => step('ancestorGenerations', -1)} aria-label={t('fewerAnc')} data-testid="gen-up-minus">−</button>
      <span className="val" data-testid="gen-up-value">{show(s.ancestorGenerations)}</span>
      <button onClick={() => step('ancestorGenerations', 1)} aria-label={t('moreAnc')} data-testid="gen-up-plus">+</button>
      <span className="dir" title={t('descendantGens')}>▼</span>
      <button onClick={() => step('descendantGenerations', -1)} aria-label={t('fewerDesc')} data-testid="gen-down-minus">−</button>
      <span className="val" data-testid="gen-down-value">{show(s.descendantGenerations)}</span>
      <button onClick={() => step('descendantGenerations', 1)} aria-label={t('moreDesc')} data-testid="gen-down-plus">+</button>
    </div>
  );
}

export function LanguageSelect(props: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <select className="input lang-select" aria-label={t('language')} value={props.lang} onChange={(e) => props.onChange(e.target.value as Lang)} data-testid="lang-select">
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}

export function SettingsMenu(props: {
  settings: TreeSettings;
  onChange: (patch: Partial<TreeSettings>) => void;
  onClose: () => void;
  lang: Lang;
  onLang: (l: Lang) => void;
}) {
  const s = props.settings;
  const large = s.fontSize === 'large';
  const set = props.onChange;
  return (
    <div className="popover" role="dialog" aria-label={t('treeSettings')} data-testid="settings-menu">
      <div className="settings-grid">
        <label className="field">
          {t('dateFormat')}
          <select value={s.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFormat })} data-testid="set-date-format">
            {DATE_FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('surname')}
          <select value={s.surname} onChange={(e) => set({ surname: e.target.value as TreeSettings['surname'] })} data-testid="set-surname">
            <option value="surnameNow">{t('surnameNowOpt')}</option>
            <option value="surnameAtBirth">{t('surnameAtBirthOpt')}</option>
          </select>
        </label>
        <label className="field">
          {t('fontSize')}
          <select value={s.fontSize} onChange={(e) => set({ fontSize: e.target.value as FontSize })} data-testid="set-font-size">
            <option value="small">{t('small')}</option>
            <option value="normal">{t('normal')}</option>
            <option value="large">{t('large')}</option>
          </select>
        </label>
        <label className="field">
          {t('treeStyle')}
          <select value={s.rectStyle} onChange={(e) => set({ rectStyle: e.target.value as TreeSettings['rectStyle'] })} data-testid="set-tree-style">
            <option value="plain">{t('plain')}</option>
            <option value="framed">{t('framed')}</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.showDob} onChange={() => set(s.showDob ? { showDob: false, showDod: false } : { showDob: true })} data-testid="set-dob" />
          {t('dob')}
        </label>
        <label className="check">
          <input type="checkbox" checked={s.showDod} onChange={() => set(s.showDod ? { showDod: false } : { showDod: true, showDob: true })} data-testid="set-dod" />
          {t('dod')}
        </label>
        <label className="check">
          <input type="checkbox" checked={s.showCountryOfBirth} onChange={() => set({ showCountryOfBirth: !s.showCountryOfBirth })} data-testid="set-country" />
          {t('countryOfBirth')}
        </label>
        <label className="check">
          <input type="checkbox" checked={s.showImage} onChange={() => set({ showImage: !s.showImage })} data-testid="set-image" />
          {t('image')}
        </label>
        <label className={`check${large ? ' disabled' : ''}`} title={large ? t('notWithLarge') : undefined}>
          <input type="checkbox" disabled={large} checked={!large && s.showProfession} onChange={() => set({ showProfession: !s.showProfession })} data-testid="set-profession" />
          {t('profession')}
        </label>
        <label className={`check${large ? ' disabled' : ''}`} title={large ? t('notWithLarge') : undefined}>
          <input type="checkbox" disabled={large} checked={!large && s.showInterestingFacts} onChange={() => set({ showInterestingFacts: !s.showInterestingFacts })} data-testid="set-facts" />
          {t('facts')}
        </label>
      </div>
      <hr className="sep" style={{ margin: '14px 0' }} />
      <div className="settings-grid">
        <div className="field">
          {t('theme')}
          <div className="seg">
            {(['light', 'dark'] as const).map((th) => (
              <button key={th} className={s.theme === th ? 'on' : ''} onClick={() => set({ theme: th })} data-testid={`set-theme-${th}`}>
                {th === 'light' ? t('light') : t('dark')}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          {t('language')}
          <LanguageSelect lang={props.lang} onChange={props.onLang} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.traceAnimation} onChange={() => set({ traceAnimation: !s.traceAnimation })} data-testid="set-trace" />
          {t('animateLineage')}
        </label>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          {t('generationsHelp')}
          <GenerationControl settings={s} onChange={set} compact />
        </div>
      </div>
      {large && <p className="note">{t('largeNote')}</p>}
      <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn" style={{ width: 'auto' }} onClick={props.onClose}>{t('close')}</button>
      </div>
    </div>
  );
}

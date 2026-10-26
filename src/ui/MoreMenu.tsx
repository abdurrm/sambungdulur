import { Menu } from '@base-ui/react/menu';
import { Icon } from './icons';
import { LANGS, t, type Lang } from '../i18n';
import { GUIDE_URL } from '../links';
import { shortcutText } from './shortcuts';

/** Overflow menu for medium and narrow layouts: secondary tools, with the destructive reset set apart. */
export default function MoreMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: 'light' | 'dark';
  lang: Lang;
  manualMode: boolean;
  canInstall: boolean;
  onManual: () => void;
  onTheme: () => void;
  onLang: (l: Lang) => void;
  onInstall: () => void;
  onReset: () => void;
  onShortcuts: () => void;
  onFeedback: () => void;
}) {
  return (
    <Menu.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Menu.Trigger className={`tool-btn${props.open ? ' active' : ''}`} data-testid="btn-more" aria-label={t('moreTools')} data-tip={t('moreTools')}>
        <Icon id="more" active={props.open} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="popup-positioner" side="bottom" align="end" sideOffset={6} collisionPadding={8} positionMethod="fixed">
          <Menu.Popup className="popover menu" data-testid="more-menu">
            <Menu.Item className="menu-item" onClick={props.onManual} data-testid="more-manual">
              <Icon id="manual" size={16} active={props.manualMode} /> {t('manualLayout')}
              {props.manualMode && <span className="menu-hint">✓</span>}
              <kbd className="menu-kbd">{shortcutText('manual')}</kbd>
            </Menu.Item>
            <Menu.Item className="menu-item" onClick={props.onTheme} data-testid="more-theme">
              <Icon id={props.theme === 'light' ? 'themeDark' : 'themeLight'} size={16} /> {props.theme === 'light' ? t('darkTheme') : t('lightTheme')}
              <kbd className="menu-kbd">{shortcutText('theme')}</kbd>
            </Menu.Item>
            <Menu.Item className="menu-item only-keyboard" onClick={props.onShortcuts} data-testid="more-shortcuts">
              <Icon id="shortcuts" size={16} /> {t('shortcutsTitle')}
              <kbd className="menu-kbd">{shortcutText('help')}</kbd>
            </Menu.Item>
            <Menu.LinkItem className="menu-item" href={GUIDE_URL} target="_blank" rel="noopener noreferrer" closeOnClick data-testid="more-help">
              <Icon id="help" size={16} /> {t('help')}
            </Menu.LinkItem>
            <Menu.Item className="menu-item" onClick={props.onFeedback} data-testid="more-feedback"><Icon id="feedback" size={16} />{t('feedback')}</Menu.Item>
            {props.canInstall && (
              <Menu.Item className="menu-item" onClick={props.onInstall}>
                <Icon id="install" size={16} /> {t('installApp')}
              </Menu.Item>
            )}
            <Menu.Separator className="menu-sep" />
            <Menu.Group>
              <Menu.GroupLabel className="menu-label">{t('language')}</Menu.GroupLabel>
              <Menu.RadioGroup value={props.lang} onValueChange={(v) => props.onLang(v as Lang)}>
                {LANGS.map((l) => (
                  <Menu.RadioItem key={l.code} value={l.code} className="menu-item" closeOnClick data-testid={`more-lang-${l.code}`}>
                    <span className="menu-radio" aria-hidden="true">{props.lang === l.code ? '●' : '○'}</span> {l.label}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className="menu-sep danger-sep" />
            <Menu.Item className="menu-item danger" onClick={props.onReset} data-testid="more-reset">
              <Icon id="reset" size={16} /> {t('resetTree')}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

import type { Theme } from '../model/types';
import { DEFAULT_BACKGROUND, resolveBackdrop, SOLID_PRESETS, type CanvasBackground, type SolidPreset } from '../model/background';
import { t, type Key } from '../i18n';

const PRESET_LABEL: Record<SolidPreset, Key> = {
  paper: 'bgPaper',
  cream: 'bgCream',
  sogan: 'bgSogan',
  nila: 'bgNila',
  leaf: 'bgLeaf',
  sky: 'bgSky',
  stone: 'bgStone',
  night: 'bgNight',
};

type Kind = CanvasBackground['kind'];
const KINDS: { kind: Kind; label: Key }[] = [
  { kind: 'grid', label: 'bgGrid' },
  { kind: 'solid', label: 'bgSolid' },
];

/**
 * "Canvas background" section of Tree settings. Every change applies to the canvas straight away
 * (live preview) and is one undo step; dragging the colour picker counts as one step.
 * Loaded on demand with the settings popover.
 */
export default function BackgroundSettings(props: {
  value: CanvasBackground;
  theme: Theme;
  onChange: (bg: CanvasBackground, coalesceKey?: string) => void;
}) {
  const bg = props.value;
  const current = resolveBackdrop(bg, props.theme);
  const pick = (kind: Kind) => {
    if (kind === bg.kind) return;
    props.onChange(kind === 'grid' ? DEFAULT_BACKGROUND : { kind: 'solid', preset: 'cream' });
  };
  return (
    <fieldset className="bg-settings" data-testid="bg-settings">
      <legend className="field">{t('canvasBackground')}</legend>
      <div className="seg" role="group" aria-label={t('canvasBackground')}>
        {KINDS.map((k) => (
          <button key={k.kind} className={bg.kind === k.kind ? 'on' : ''} aria-pressed={bg.kind === k.kind} onClick={() => pick(k.kind)} data-testid={`bg-kind-${k.kind}`}>
            {t(k.label)}
          </button>
        ))}
      </div>
      {bg.kind === 'solid' && (
        <div className="swatches" role="group" aria-label={t('bgSolid')}>
          {SOLID_PRESETS.map((p) => {
            const on = 'preset' in bg && bg.preset === p.id;
            return (
              <button
                key={p.id}
                className={`swatch${on ? ' on' : ''}`}
                style={{ background: p[props.theme] }}
                aria-label={t(PRESET_LABEL[p.id])}
                aria-pressed={on}
                data-tip={t(PRESET_LABEL[p.id])}
                onClick={() => props.onChange({ kind: 'solid', preset: p.id })}
                data-testid={`bg-swatch-${p.id}`}
              />
            );
          })}
          <label className={`swatch swatch-custom${'custom' in bg ? ' on' : ''}`} data-tip={t('bgCustom')}>
            <span className="sr-only">{t('bgCustom')}</span>
            <input
              type="color"
              value={current.color}
              onChange={(e) => props.onChange({ kind: 'solid', custom: e.target.value }, 'background-colour')}
              data-testid="bg-custom"
            />
          </label>
        </div>
      )}
      <button className="btn ghost bg-reset" disabled={bg.kind === 'grid'} onClick={() => props.onChange(DEFAULT_BACKGROUND)} data-testid="bg-reset">
        {t('bgReset')}
      </button>
    </fieldset>
  );
}

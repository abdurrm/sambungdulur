import { useState, type ReactNode } from 'react';
import type { Theme } from '../model/types';
import {
  DEFAULT_BACKGROUND,
  resolveBackdrop,
  SOLID_PRESETS,
  TILE_COLOR,
  TILE_PATTERNS,
  TILE_SCALE,
  type CanvasBackground,
  type ImageBackground,
  type ImageFit,
  type SolidPreset,
  type TilePattern,
} from '../model/background';
import { motifTile } from '../render/motifs';
import { TOKENS } from '../theme/tokens';
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
const PATTERN_LABEL: Record<TilePattern, Key> = { dots: 'tDots', diagonal: 'tDiagonal', hex: 'tHex', kawung: 'tKawung', parang: 'tParang', truntum: 'tTruntum' };
const FIT_LABEL: Record<ImageFit, Key> = { cover: 'fitCover', contain: 'fitContain', tile: 'fitTile' };

type Kind = CanvasBackground['kind'];
const KINDS: { kind: Kind; label: Key }[] = [
  { kind: 'grid', label: 'bgGrid' },
  { kind: 'solid', label: 'bgSolid' },
  { kind: 'tiles', label: 'bgTiles' },
  { kind: 'image', label: 'bgImage' },
];

/** Small live sample of a motif, drawn with the same tiles as the canvas. */
function MotifSample(props: { pattern: TilePattern; color: string; bg: string }) {
  const tile = motifTile(props.pattern, props.color);
  const id = `sample-${props.pattern}`;
  return (
    <svg width="100%" height="100%" aria-hidden="true">
      <defs>
        <pattern id={id} width={tile.width} height={tile.height} patternUnits="userSpaceOnUse" patternTransform="scale(0.75)">
          {tile.node}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={props.bg} />
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function Range(props: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; testId: string }) {
  return (
    <label className="field range-field">
      {props.label}
      <input type="range" min={props.min} max={props.max} step={props.step ?? 1} value={props.value} onChange={(e) => props.onChange(+e.target.value)} data-testid={props.testId} />
    </label>
  );
}

function Seg<T extends string>(props: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="field">
      {props.label}
      <div className="seg" role="group" aria-label={props.label}>
        {props.options.map((o) => (
          <button key={o.value} className={props.value === o.value ? 'on' : ''} aria-pressed={props.value === o.value} onClick={() => props.onChange(o.value)} data-testid={`${props.testId}-${o.value}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "Canvas background" section of Tree settings: grid, plain colour, pattern or picture. Every change
 * applies to the canvas straight away (live preview) and is one undo step; dragging a slider or the
 * colour picker counts as one step. Loaded on demand with the settings popover.
 */
export default function BackgroundSettings(props: {
  value: CanvasBackground;
  theme: Theme;
  onChange: (bg: CanvasBackground, coalesceKey?: string) => void;
  /** Shrinks, stores and applies a picture; resolves when done. */
  onImage: (file: File) => Promise<void>;
  /** Extra picture sources (the camera on touch screens). */
  imageSources?: (pick: (file: File) => void) => ReactNode;
}) {
  const bg = props.value;
  // "Picture" can be picked before a picture exists; the canvas keeps its background until one is chosen.
  const [shown, setShown] = useState<Kind>(bg.kind);
  const kind = bg.kind === 'image' || shown !== 'image' ? bg.kind : 'image';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = resolveBackdrop(bg, props.theme);
  const pick = (k: Kind) => {
    setShown(k);
    if (k === bg.kind || k === 'image') return;
    if (k === 'grid') props.onChange(DEFAULT_BACKGROUND);
    else if (k === 'solid') props.onChange({ kind: 'solid', preset: 'cream' });
    else props.onChange({ kind: 'tiles', pattern: 'kawung', scale: 100 });
  };
  const useImage = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      await props.onImage(file);
    } catch (e) {
      setError(t('bgImageFailed', { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };
  const patchImage = (patch: Partial<ImageBackground>, key?: string) => bg.kind === 'image' && props.onChange({ ...bg, ...patch }, key);
  const upload = (label: string) => (
    <label className={`btn${busy ? ' busy' : ''}`} aria-disabled={busy || undefined}>
      {busy ? t('bgImageBusy') : label}
      <input
        type="file"
        accept="image/*,.heic,.heif,.webp"
        hidden
        disabled={busy}
        data-testid="bg-image-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void useImage(file);
        }}
      />
    </label>
  );
  return (
    <fieldset className="bg-settings" data-testid="bg-settings">
      <legend className="field">{t('canvasBackground')}</legend>
      <div className="seg" role="group" aria-label={t('canvasBackground')}>
        {KINDS.map((k) => (
          <button key={k.kind} className={kind === k.kind ? 'on' : ''} aria-pressed={kind === k.kind} onClick={() => pick(k.kind)} data-testid={`bg-kind-${k.kind}`}>
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
            <input type="color" value={current.color} onChange={(e) => props.onChange({ kind: 'solid', custom: e.target.value }, 'background-colour')} data-testid="bg-custom" />
          </label>
        </div>
      )}

      {bg.kind === 'tiles' && (
        <>
          <div className="motifs" role="group" aria-label={t('bgTiles')}>
            {TILE_PATTERNS.map((p) => (
              <button
                key={p}
                className={`motif${bg.pattern === p ? ' on' : ''}`}
                aria-pressed={bg.pattern === p}
                onClick={() => props.onChange({ ...bg, pattern: p })}
                data-testid={`bg-motif-${p}`}
              >
                <span className="motif-sample">
                  <MotifSample pattern={p} color={current.tiles?.color ?? TILE_COLOR[props.theme]} bg={TOKENS[props.theme].bg} />
                </span>
                <span className="motif-name">{t(PATTERN_LABEL[p])}</span>
              </button>
            ))}
          </div>
          <Range label={t('bgScale', { n: bg.scale })} min={TILE_SCALE.min} max={TILE_SCALE.max} step={10} value={bg.scale} onChange={(v) => props.onChange({ ...bg, scale: v }, 'background-scale')} testId="bg-scale" />
          <div className="field">
            {t('bgMotifColor')}
            <div className="row-inline">
              <label className={`swatch swatch-custom${bg.color ? ' on' : ''}`} data-tip={t('bgMotifColor')}>
                <span className="sr-only">{t('bgMotifColor')}</span>
                <input type="color" value={current.tiles?.color ?? TILE_COLOR[props.theme]} onChange={(e) => props.onChange({ ...bg, color: e.target.value }, 'background-motif-colour')} data-testid="bg-motif-color" />
              </label>
              <button className="btn ghost" style={{ width: 'auto' }} disabled={!bg.color} onClick={() => props.onChange({ kind: 'tiles', pattern: bg.pattern, scale: bg.scale })} data-testid="bg-motif-color-default">
                {t('bgMotifColorDefault')}
              </button>
            </div>
          </div>
        </>
      )}

      {kind === 'image' && (
        <>
          <div className="row-inline">
            {upload(bg.kind === 'image' ? t('bgReplace') : t('bgUpload'))}
            {props.imageSources?.((file) => void useImage(file))}
          </div>
          {error && <p className="error-text">{error}</p>}
          {bg.kind === 'image' && (
            <>
              <Seg
                label={t('bgPlacement')}
                options={(['cover', 'contain', 'tile'] as ImageFit[]).map((f) => ({ value: f, label: t(FIT_LABEL[f]) }))}
                value={bg.fit}
                onChange={(fit) => patchImage({ fit })}
                testId="bg-fit"
              />
              <Range label={t('bgFade', { n: bg.fade })} min={0} max={90} step={5} value={bg.fade} onChange={(fade) => patchImage({ fade }, 'background-fade')} testId="bg-fade" />
              <Range label={t('bgBlur', { n: bg.blur })} min={0} max={12} value={bg.blur} onChange={(blur) => patchImage({ blur }, 'background-blur')} testId="bg-blur" />
              <Seg
                label={t('bgMotion')}
                options={[
                  { value: 'fixed', label: t('bgFixed') },
                  { value: 'scroll', label: t('bgScroll') },
                ]}
                value={bg.fixed ? 'fixed' : 'scroll'}
                onChange={(v) => patchImage({ fixed: v === 'fixed' })}
                testId="bg-motion"
              />
            </>
          )}
        </>
      )}

      <button className="btn ghost bg-reset" disabled={bg.kind === 'grid'} onClick={() => (setShown('grid'), props.onChange(DEFAULT_BACKGROUND))} data-testid="bg-reset">
        {t('bgReset')}
      </button>
    </fieldset>
  );
}

import type { ReactNode } from 'react';
import type { TreeDoc } from '../model/types';
import type { TreeLayout, LayoutNode } from '../layout/layout';
import { cardStyle, type Density } from '../layout/metrics';
import { displayName } from '../model/relations';
import { FONT_MONO, FONT_SANS, type Palette } from './palette';
import type { Backdrop } from '../model/background';
import type { MotifTile } from './motifs';
import { t } from '../i18n';

export interface TreeSvgProps {
  doc: TreeDoc;
  layout: TreeLayout;
  palette: Palette;
  density: Density;
  /** Resolves a media id to an URL (object URL in the app, data URL in exports). */
  mediaUrl: (id: string) => string | undefined;
  selectedId?: string | null;
  highlight?: Set<string>;
  matches?: Set<string>;
  hiddenParents?: Set<string>;
  hiddenChildren?: Set<string>;
  /** Persons whose visible parents / children can be collapsed from the card. */
  collapsibleUp?: Set<string>;
  collapsibleDown?: Set<string>;
  interactive?: boolean;
  manualMode?: boolean;
  trace?: boolean;
  /** Draw the background (exports may choose transparent). */
  background?: boolean;
  /** What the background looks like; defaults to the theme grid. */
  backdrop?: Backdrop;
  /** The motif tile for a `tiles` backdrop (render/motifs.tsx, loaded on demand by the caller). */
  motif?: MotifTile;
  padding?: number;
  legend?: boolean;
  /** Radius (layout units) of the invisible press area around card buttons; set on touch screens. */
  hitRadius?: number;
  /** Accessible name for each card (interactive canvas). */
  describe?: (personId: string) => string;
  /** Wrap content in a <g> with this transform (canvas zoom). */
  transform?: string;
  title?: string;
}

function initialsOf(name: string): string {
  const parts = name.replace(/[()]/g, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Card(props: {
  n: LayoutNode;
  doc: TreeDoc;
  pal: Palette;
  density: Density;
  url?: string;
  selected: boolean;
  lit: boolean;
  matched: boolean;
  hasHiddenParents: boolean;
  hasHiddenChildren: boolean;
  canCollapseUp: boolean;
  canCollapseDown: boolean;
  interactive: boolean;
  manualMode: boolean;
  hitRadius?: number;
  label?: string;
}) {
  const { n, doc, pal, density, url, selected, lit, matched } = props;
  const p = doc.persons[n.id];
  const st = cardStyle(doc.settings, density);
  const left = n.x - n.w / 2;
  const c = n.content;
  const lh = (sz: number) => Math.round(sz * st.lineGap);
  const ring = pal.ring[p.gender];
  const framed = doc.settings.rectStyle === 'framed';
  let y = n.y + st.pad;
  const out: ReactNode[] = [];
  const stroke = selected ? pal.emphasis : matched ? pal.match : lit ? pal.emphasis : pal.cardStroke;
  const strokeW = selected ? 2.4 : matched ? 2.2 : lit ? 1.6 : 1.2;

  if (selected) {
    out.push(<rect key="glow" x={left - 5} y={n.y - 5} width={n.w + 10} height={n.h + 10} rx={16} fill="none" stroke={pal.emphasisGlow} strokeWidth={8} />);
  }
  if (framed) {
    out.push(<rect key="frame" x={left - 6} y={n.y - 6} width={n.w + 12} height={n.h + 12} rx={15} fill="none" stroke={pal.cardFrame} strokeWidth={1.4} />);
  }
  out.push(<rect key="card" className="card-bg" x={left} y={n.y} width={n.w} height={n.h} rx={12} fill={pal.card} stroke={stroke} strokeWidth={strokeW} />);
  // Gender accent along the top edge (subtle, the photo ring carries the main distinction).
  out.push(<path key="accent" d={`M${left + 12},${n.y + 1.2}H${left + n.w - 12}`} stroke={ring} strokeWidth={2} strokeLinecap="round" opacity={0.55} />);

  if (c.showPhoto) {
    const r = st.photo / 2;
    const cx = n.x;
    const cy = y + r;
    out.push(<circle key="tint" cx={cx} cy={cy} r={r} fill={pal.tint[p.gender]} />);
    if (url) {
      out.push(
        <image
          key="img"
          href={url}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#clip-${n.id})`}
        />,
      );
    } else {
      out.push(
        <text key="ini" x={cx} y={cy} dy="0.35em" textAnchor="middle" fontFamily={FONT_SANS} fontWeight={600} fontSize={r * 0.72} fill={pal.initials[p.gender]}>
          {initialsOf(displayName(p, doc.settings))}
        </text>,
      );
    }
    out.push(
      <circle key="ring" className={`ring ring-${p.gender}`} data-gender={p.gender} cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={p.gender === 'other' ? 2.5 : 3} strokeDasharray={p.gender === 'other' ? '5 3' : undefined} />,
    );
    if (p.deceased) {
      out.push(
        <text key="dec" x={cx + r * 0.78} y={cy - r * 0.62} textAnchor="middle" fontFamily={FONT_SANS} fontSize={st.metaSize + 2} fill={pal.dim}>
          †
        </text>,
      );
    }
    y += st.photo + 10;
  }
  c.nameLines.forEach((line, i) => {
    out.push(
      <text key={`n${i}`} x={n.x} y={y + st.nameSize} textAnchor="middle" fontFamily={FONT_SANS} fontWeight={650} fontSize={st.nameSize} fill={pal.text}>
        {line}
        {!c.showPhoto && p.deceased && i === c.nameLines.length - 1 ? ' †' : ''}
      </text>,
    );
    y += lh(st.nameSize);
  });
  const meta = (key: string, text: string, opts: { mono?: boolean; italic?: boolean; color?: string } = {}) => {
    out.push(
      <text
        key={key}
        x={n.x}
        y={y + st.metaSize}
        textAnchor="middle"
        fontFamily={opts.mono ? FONT_MONO : FONT_SANS}
        fontStyle={opts.italic ? 'italic' : undefined}
        fontSize={st.metaSize}
        fill={opts.color ?? pal.muted}
      >
        {text}
      </text>,
    );
    y += lh(st.metaSize);
  };
  if (c.dateLine) {
    meta('d', c.dateLine, { mono: true });
    y += 2;
  }
  if (c.countryLines.length) {
    c.countryLines.forEach((l, i) => meta(`c${i}`, l, { color: pal.dim }));
    y += 2;
  }
  if (c.professionLines.length) {
    c.professionLines.forEach((l, i) => meta(`p${i}`, l, { italic: true }));
    y += 2;
  }
  if (c.factLines.length) {
    y += 3;
    out.push(<path key="sep" d={`M${left + 18},${y}H${left + n.w - 18}`} stroke={pal.cardStroke} strokeWidth={1} strokeDasharray="2 3" />);
    y += 5;
    c.factLines.forEach((l, i) => meta(`f${i}`, l, { color: pal.dim }));
  }

  if (props.interactive) {
    const btn = (key: string, cx: number, cy: number, label: string, action: string, title: string) =>
      out.push(
        <g key={key} className="card-btn" data-action={action} data-person-id={n.id} role="button" aria-label={title}>
          <title>{title}</title>
          {/* Touch screens: an invisible, larger press area around the small visible button. */}
          {props.hitRadius && props.hitRadius > 10 && <circle className="card-hit" cx={cx} cy={cy} r={props.hitRadius} fill="transparent" pointerEvents="all" />}
          <circle cx={cx} cy={cy} r={10} fill={pal.card} stroke={pal.handle} strokeWidth={1.4} />
          <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontFamily={FONT_MONO} fontSize={12} fill={pal.handle}>
            {label}
          </text>
        </g>,
      );
    const collapsed = doc.collapsed[n.id];
    if (props.manualMode) {
      // top edge is used by the move handle
    } else if (props.hasHiddenParents || collapsed === 'ancestors' || collapsed === 'both')
      btn('up', n.x, n.y, '+', 'expand-up', t('showParents'));
    else if (props.canCollapseUp && (selected || props.lit)) btn('up', n.x, n.y, '−', 'collapse-up', t('hideParents'));
    if (props.hasHiddenChildren || collapsed === 'descendants' || collapsed === 'both')
      btn('down', n.x, n.y + n.h, '+', 'expand-down', t('showChildren'));
    else if (props.canCollapseDown && (selected || props.lit) && !props.manualMode)
      btn('down', n.x, n.y + n.h, '−', 'collapse-down', t('hideChildren'));
    btn('details', left + n.w - 14, n.y + 14, doc.compactCards[n.id] ? '▸' : '▾', 'toggle-card', doc.compactCards[n.id] ? t('expandDetails') : t('collapseDetails'));
    if (props.manualMode) {
      out.push(
        <g key="mv" className="move-handle" data-action="move" data-person-id={n.id} aria-label={t('moveHandle')}>
          <title>{t('moveHandle')}</title>
          <rect x={n.x - 22} y={n.y - 12} width={44} height={24} rx={12} fill={pal.handle} />
          <text x={n.x} y={n.y} dy="0.35em" textAnchor="middle" fontFamily={FONT_MONO} fontSize={13} fill={pal.onHandle}>
            ↔
          </text>
        </g>,
      );
    }
  }
  return (
    <g
      className="person"
      data-person-id={n.id}
      data-gender={p.gender}
      data-testid={`person-${n.id}`}
      style={props.interactive ? { cursor: 'pointer' } : undefined}
      role={props.label ? 'group' : undefined}
      aria-label={props.label}
      aria-current={props.label && selected ? 'true' : undefined}
    >
      {out}
    </g>
  );
}

export function TreeSvg(props: TreeSvgProps) {
  const { doc, layout, palette: pal, density } = props;
  const pad = props.padding ?? 60;
  const vbX = layout.minX - pad;
  const vbY = layout.minY - pad;
  const w = layout.width + pad * 2;
  const h = layout.height + pad * 2 + (props.legend ? 40 : 0);
  const lit = props.highlight ?? new Set<string>();
  const edgeLit = (from: string[], to: string[]) => lit.size > 0 && from.some((f) => lit.has(f)) && to.some((t) => lit.has(t));
  const nodes = [...layout.nodes.values()];
  const st = cardStyle(doc.settings, density);
  const body = (
    <>
      <g className="edges" fill="none">
        {layout.edges.map((e) => {
          const on = edgeLit(e.from, e.to);
          return (
            <path
              key={e.id}
              d={e.d}
              className={on ? (props.trace ? 'edge lit trace' : 'edge lit') : 'edge'}
              data-family-id={e.familyId}
              stroke={on ? pal.emphasis : e.kind === 'partner-far' ? pal.edgeFar : pal.edge}
              strokeWidth={on ? 2.4 : e.kind === 'partner' ? 2 : 1.6}
              strokeDasharray={e.kind === 'partner-far' ? '6 5' : on && props.trace ? '8 6' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </g>
      <g className="nodes">
        {nodes.map((n) => (
          <Card
            key={n.id}
            n={n}
            doc={doc}
            pal={pal}
            density={density}
            url={doc.persons[n.id].photoId ? props.mediaUrl(doc.persons[n.id].photoId) : undefined}
            selected={props.selectedId === n.id}
            lit={lit.has(n.id)}
            matched={!!props.matches?.has(n.id)}
            hasHiddenParents={!!props.hiddenParents?.has(n.id)}
            hasHiddenChildren={!!props.hiddenChildren?.has(n.id)}
            canCollapseUp={!!props.collapsibleUp?.has(n.id)}
            canCollapseDown={!!props.collapsibleDown?.has(n.id)}
            interactive={!!props.interactive}
            manualMode={!!props.manualMode}
            hitRadius={props.hitRadius}
            label={props.describe?.(n.id)}
          />
        ))}
      </g>
      {props.manualMode &&
        layout.handles.map((hd) => (
          <circle
            key={hd.familyId}
            className="control-point"
            data-action="bus"
            data-family-id={hd.familyId}
            cx={hd.x}
            cy={hd.y}
            r={7}
            fill={pal.card}
            stroke={pal.handle}
            strokeWidth={2}
          >
            <title>{t('dragLine')}</title>
          </circle>
        ))}
    </>
  );
  const legendY = layout.minY + layout.height + pad + 4;
  const backdrop: Backdrop = props.backdrop ?? { kind: 'grid', color: pal.bg, grid: true };
  const img = backdrop.image;
  type Len = number | string;
  const tiles = (x: Len, y: Len, width: Len, height: Len) =>
    backdrop.tiles && props.motif ? <rect className="canvas-tiles" x={x} y={y} width={width} height={height} fill="url(#bg-tiles)" pointerEvents="none" /> : null;
  /** The picture with its blur and its theme-coloured veil, filling the given area. */
  const picture = (x: Len, y: Len, width: Len, height: Len) =>
    img?.url ? (
      <g className="canvas-image" pointerEvents="none">
        <g filter={img.blur > 0 ? 'url(#bg-blur)' : undefined}>
          {img.fit === 'tile' ? (
            <rect x={x} y={y} width={width} height={height} fill="url(#bg-image)" />
          ) : (
            <image href={img.url} x={x} y={y} width={width} height={height} preserveAspectRatio={img.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'} />
          )}
        </g>
        <rect x={x} y={y} width={width} height={height} fill={backdrop.color} opacity={img.fade / 100} />
      </g>
    ) : null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className="tree-svg"
      viewBox={props.transform ? undefined : `${vbX} ${vbY} ${w} ${h}`}
      width={props.transform ? '100%' : w}
      height={props.transform ? '100%' : h}
      role="img"
      aria-label={props.title ?? doc.title}
      data-backdrop={props.background === false ? 'none' : backdrop.kind}
    >
      <defs>
        <pattern id="grid-minor" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke={pal.grid} strokeWidth="1" />
        </pattern>
        <pattern id="grid-major" width="120" height="120" patternUnits="userSpaceOnUse">
          <rect width="120" height="120" fill="url(#grid-minor)" />
          <path d="M120 0H0V120" fill="none" stroke={pal.gridMajor} strokeWidth="1" />
        </pattern>
        {nodes
          .filter((n) => n.content.showPhoto && doc.persons[n.id].photoId)
          .map((n) => (
            <clipPath key={n.id} id={`clip-${n.id}`}>
              <circle cx={n.x} cy={n.y + st.pad + st.photo / 2} r={st.photo / 2 - 1} />
            </clipPath>
          ))}
        {backdrop.tiles && props.motif && (
          <pattern id="bg-tiles" width={props.motif.width} height={props.motif.height} patternUnits="userSpaceOnUse" patternTransform={`scale(${backdrop.tiles.scale / 100})`}>
            {props.motif.node}
          </pattern>
        )}
        {img?.url && img.blur > 0 && (
          <filter id="bg-blur" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation={img.blur} />
          </filter>
        )}
        {img?.url && img.fit === 'tile' && (
          <pattern id="bg-image" width={img.width} height={img.height} patternUnits="userSpaceOnUse">
            <image href={img.url} width={img.width} height={img.height} />
          </pattern>
        )}
        {props.trace && (
          <style>{`.trace{animation:sd-trace 1.1s linear infinite}@keyframes sd-trace{to{stroke-dashoffset:-28}}@media (prefers-reduced-motion: reduce){.trace{animation:none}}`}</style>
        )}
      </defs>
      {props.background !== false &&
        (props.transform ? (
          <rect className="canvas-bg" x="-100000" y="-100000" width="200000" height="200000" fill={backdrop.color} />
        ) : (
          <>
            <rect className="canvas-bg" x={vbX} y={vbY} width={w} height={h} fill={backdrop.color} />
            {backdrop.grid && <rect x={vbX} y={vbY} width={w} height={h} fill="url(#grid-major)" />}
            {tiles(vbX, vbY, w, h)}
            {picture(vbX, vbY, w, h)}
          </>
        ))}
      {props.background !== false && props.transform && img?.fixed && picture(0, 0, '100%', '100%')}
      {props.transform ? (
        <g transform={props.transform}>
          {props.background !== false && backdrop.grid && <rect x="-100000" y="-100000" width="200000" height="200000" fill="url(#grid-major)" pointerEvents="none" />}
          {props.background !== false && tiles(-100000, -100000, 200000, 200000)}
          {props.background !== false && img && !img.fixed && picture(vbX, vbY, w, h)}
          {body}
        </g>
      ) : (
        body
      )}
      {props.legend && (
        <g fontFamily={FONT_SANS} fontSize={13} fill={pal.caption}>
          {(['male', 'female', 'other'] as const).map((g, i) => (
            <g key={g} transform={`translate(${vbX + pad + i * 190},${legendY})`}>
              <circle cx={8} cy={8} r={7} fill="none" stroke={pal.ring[g]} strokeWidth={3} strokeDasharray={g === 'other' ? '4 2' : undefined} />
              <text x={22} y={13}>
                {g === 'male' ? t('legendMale') : g === 'female' ? t('legendFemale') : t('legendOther')}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { TreeDoc } from '../model/types';
import type { TreeLayout } from '../layout/layout';
import type { VisibleGraph } from '../layout/visible';
import { TreeSvg } from '../render/TreeSvg';
import { PALETTES } from '../render/palette';
import { displayName } from '../model/relations';
import { t as tx } from '../i18n';
import type { MenuAnchor } from './PersonMenu';

const LONG_PRESS_MS = 500;
const pointAnchor = (x: number, y: number): MenuAnchor => ({ getBoundingClientRect: () => new DOMRect(x, y, 0, 0) });

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 2;

export interface CanvasApi {
  zoomBy: (factor: number) => void;
  fit: () => void;
  centerOn: (id: string, scale?: number) => void;
  /** Pans (keeping the zoom) only if the card is not fully inside the uncovered part of the canvas. */
  ensureVisible: (id: string) => void;
  getScale: () => number;
}

/** Parts of the canvas covered by overlays (editor sheet, drawer), in CSS pixels. */
export interface CanvasInset {
  left: number;
  bottom: number;
}
const NO_INSET: CanvasInset = { left: 0, bottom: 0 };
const MARGIN = 12;

interface Props {
  doc: TreeDoc;
  layout: TreeLayout;
  visible: VisibleGraph;
  selectedId: string | null;
  highlight: Set<string>;
  matches: Set<string>;
  mediaUrl: (id: string) => string | undefined;
  manualMode: boolean;
  onSelect: (id: string | null) => void;
  onAction: (action: string, personId: string) => void;
  onDragPerson: (id: string, dx: number, done: boolean) => void;
  onDragBus: (familyId: string, dy: number, done: boolean) => void;
  onScale?: (k: number) => void;
  inset?: CanvasInset;
  /** Open the person action menu (right-click, long-press, or the ⋯ button on the selected card). */
  onCardMenu?: (personId: string, anchor: MenuAnchor) => void;
  /** Double-click on a card: edit that person. */
  onEditRequest?: (personId: string) => void;
}

export const TreeCanvas = forwardRef<CanvasApi, Props>(function TreeCanvas(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const tRef = useRef(t);
  tRef.current = t;
  const layoutRef = useRef(props.layout);
  layoutRef.current = props.layout;
  const onScale = props.onScale;
  const insetRef = useRef<CanvasInset>(props.inset ?? NO_INSET);
  insetRef.current = props.inset ?? NO_INSET;
  /** The part of the canvas the user can actually see, in canvas-local pixels. */
  const viewRect = useCallback(() => {
    const { width, height } = wrapRef.current!.getBoundingClientRect();
    const { left, bottom } = insetRef.current;
    // Never let an overlay shrink the usable area to nothing (e.g. a sheet dragged to full height).
    const x = Math.min(left, width * 0.6);
    const h = Math.max(height * 0.25, height - bottom);
    return { x, y: 0, w: width - x, h };
  }, []);

  useEffect(() => {
    const el = wrapRef.current!;
    const z = zoom<HTMLDivElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      // Let card buttons and manual-layout handles receive their own pointer events.
      .filter((ev: Event) => {
        const target = ev.target as Element;
        if (target.closest?.('[data-action="move"],[data-action="bus"],.card-more')) return false;
        if (ev.type === 'wheel') return true; // includes trackpad pinch (ctrl+wheel)
        return !(ev as MouseEvent).button; // primary button / touch only
      })
      .on('zoom', (ev) => {
        setT(ev.transform);
        onScale?.(ev.transform.k);
      });
    zoomRef.current = z;
    select(el).call(z).on('dblclick.zoom', null);
    return () => {
      select(el).on('.zoom', null);
    };
  }, [onScale]);

  const transformTo = useCallback((x: number, y: number, k: number, animate = true) => {
    const el = wrapRef.current!;
    const z = zoomRef.current!;
    const v = viewRect();
    const tr = zoomIdentity.translate(v.x + v.w / 2 - x * k, v.y + v.h / 2 - y * k).scale(k);
    const sel = select(el);
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sel.transition().duration(350).call(z.transform, tr);
    } else sel.call(z.transform, tr);
  }, []);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const L = layoutRef.current;
    const { w: width, h: height } = viewRect();
    const pad = 60;
    const k = Math.max(ZOOM_MIN, Math.min(1, (width - pad * 2) / Math.max(1, L.width), (height - pad * 2) / Math.max(1, L.height)));
    transformTo(L.minX + L.width / 2, L.minY + L.height / 2, k);
  }, [transformTo, viewRect]);

  const ensureVisible = useCallback(
    (id: string) => {
      const n = layoutRef.current.nodes.get(id);
      if (!n || !wrapRef.current) return;
      const tr = tRef.current;
      const v = viewRect();
      const left = tr.applyX(n.x - n.w / 2), right = tr.applyX(n.x + n.w / 2);
      const top = tr.applyY(n.y), bottom = tr.applyY(n.y + n.h);
      const inside = left >= v.x + MARGIN && right <= v.x + v.w - MARGIN && top >= v.y + MARGIN && bottom <= v.y + v.h - MARGIN;
      if (inside) return;
      // Taller than the visible strip: show the top of the card (name and photo) rather than its middle.
      const cardH = n.h * tr.k;
      const cy = cardH > v.h - MARGIN * 2 ? n.y + (v.h / 2 - MARGIN) / tr.k : n.y + n.h / 2;
      transformTo(n.x, cy, tr.k);
    },
    [transformTo, viewRect],
  );

  // When an overlay grows or shrinks (sheet opened, dragged, closed), keep the selected card in view.
  const insetKey = `${props.inset?.left ?? 0}:${props.inset?.bottom ?? 0}`;
  const selectedRef = useRef(props.selectedId);
  selectedRef.current = props.selectedId;
  useEffect(() => {
    if (selectedRef.current) ensureVisible(selectedRef.current);
  }, [insetKey, ensureVisible]);

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (factor) => {
        const el = wrapRef.current!;
        // Step from the current scale without animation so repeated clicks are exact (×1.15 / ×0.85).
        const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(tRef.current.k * factor).toFixed(3)));
        select(el).interrupt().call(zoomRef.current!.scaleTo, k);
      },
      fit,
      centerOn: (id, scale) => {
        const n = layoutRef.current.nodes.get(id);
        if (!n) return;
        transformTo(n.x, n.y + n.h / 2, scale ?? Math.max(0.6, tRef.current.k));
      },
      ensureVisible,
      getScale: () => tRef.current.k,
    }),
    [fit, transformTo, ensureVisible],
  );

  // Pointer handling: select on click, drag handles in manual mode.
  const drag = useRef<{ kind: 'move' | 'bus'; id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    const handle = target.closest('[data-action="move"],[data-action="bus"]');
    if (handle && props.manualMode) {
      const kind = handle.getAttribute('data-action') as 'move' | 'bus';
      const id = handle.getAttribute(kind === 'move' ? 'data-person-id' : 'data-family-id')!;
      drag.current = { kind, id, startX: e.clientX, startY: e.clientY, moved: false };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      e.stopPropagation();
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const k = tRef.current.k;
    d.moved = true;
    if (d.kind === 'move') props.onDragPerson(d.id, (e.clientX - d.startX) / k, false);
    else props.onDragBus(d.id, (e.clientY - d.startY) / k, false);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const k = tRef.current.k;
    if (d.kind === 'move') props.onDragPerson(d.id, (e.clientX - d.startX) / k, true);
    else props.onDragBus(d.id, (e.clientY - d.startY) / k, true);
    drag.current = null;
  };
  const downAt = useRef<{ x: number; y: number } | null>(null);
  // Long-press on a card (touch / pen) opens its action menu; any real movement means a pan instead.
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const longPressAt = useRef(0);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const personAt = (target: EventTarget | null) => (target as Element | null)?.closest?.('.person')?.getAttribute('data-person-id') ?? null;
  const openMenu = (id: string, anchor: MenuAnchor) => props.onCardMenu?.(id, anchor);
  const onLongPressStart = (e: React.PointerEvent) => {
    cancelPress();
    if (e.pointerType === 'mouse' || props.manualMode || !props.onCardMenu) return;
    const id = personAt(e.target);
    if (!id) return;
    const { clientX: x, clientY: y } = e;
    press.current = { x, y, timer: window.setTimeout(() => ((press.current = null), (longPressAt.current = Date.now()), openMenu(id, pointAnchor(x, y))), LONG_PRESS_MS) };
  };
  const onContextMenu = (e: React.MouseEvent) => {
    const id = personAt(e.target);
    if (!id || props.manualMode || !props.onCardMenu) return;
    e.preventDefault();
    // Android also fires contextmenu for the long-press we already handled.
    if (Date.now() - longPressAt.current < 800) return;
    cancelPress();
    openMenu(id, pointAnchor(e.clientX, e.clientY));
  };
  const onClick = (e: React.MouseEvent) => {
    if (downAt.current && Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y) > 6) return;
    const target = e.target as Element;
    if (target.closest('.card-more')) return;
    // The click that ends a long-press must not also count as a press outside the menu it opened.
    if (Date.now() - longPressAt.current < 800) {
      e.stopPropagation();
      return;
    }
    const btn = target.closest('.card-btn');
    if (btn) {
      props.onAction(btn.getAttribute('data-action')!, btn.getAttribute('data-person-id')!);
      return;
    }
    if (target.closest('[data-action="move"],[data-action="bus"]')) return;
    const person = target.closest('.person');
    props.onSelect(person ? person.getAttribute('data-person-id') : null);
  };

  const palette = PALETTES[props.doc.settings.theme];
  const selectedNode = props.selectedId ? props.layout.nodes.get(props.selectedId) : undefined;
  return (
    <div
      ref={wrapRef}
      className="canvas-wrap"
      data-testid="tree-canvas"
      onPointerDownCapture={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY };
        onLongPressStart(e);
        onPointerDown(e);
      }}
      onPointerMove={(e) => {
        if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress();
        onPointerMove(e);
      }}
      onPointerUp={(e) => (cancelPress(), onPointerUp(e))}
      onPointerCancel={(e) => (cancelPress(), onPointerUp(e))}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        const target = e.target as Element;
        if (props.manualMode || target.closest('.card-btn,.card-more')) return;
        const id = personAt(target);
        if (id) props.onEditRequest?.(id);
      }}
    >
      <TreeSvg
        doc={props.doc}
        layout={props.layout}
        palette={palette}
        density="normal"
        mediaUrl={props.mediaUrl}
        selectedId={props.selectedId}
        highlight={props.highlight}
        matches={props.matches}
        hiddenParents={props.visible.hiddenParents}
        hiddenChildren={props.visible.hiddenChildren}
        interactive
        manualMode={props.manualMode}
        trace={props.doc.settings.traceAnimation}
        transform={t.toString()}
      />
      {selectedNode && props.onCardMenu && !props.manualMode && (
        <button
          className="card-more"
          style={{ left: t.applyX(selectedNode.x - selectedNode.w / 2) + 6, top: t.applyY(selectedNode.y) + 6 }}
          aria-label={tx('cardActions', { name: displayName(props.doc.persons[selectedNode.id], props.doc.settings) })}
          aria-haspopup="menu"
          title={tx('cardActions', { name: displayName(props.doc.persons[selectedNode.id], props.doc.settings) })}
          onClick={(e) => openMenu(selectedNode.id, e.currentTarget)}
          data-testid="card-more"
        >
          ⋯
        </button>
      )}
    </div>
  );
});

import { useEffect, useRef, type ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { Icon } from './icons';
import { SHEET_BAR_PX, type SheetSnap } from './sheetSnap';

const SNAP_VALUES: Record<SheetSnap, string | number> = { bar: `${SHEET_BAR_PX}px`, half: 0.5, full: 1 };
const SNAP_POINTS = [SNAP_VALUES.bar, SNAP_VALUES.half, SNAP_VALUES.full];
const snapOf = (v: string | number | null): SheetSnap => (v === SNAP_VALUES.full ? 'full' : v === SNAP_VALUES.half ? 'half' : 'bar');

/**
 * The phone editor as a draggable bottom sheet (Base UI Drawer). It is always open and non-modal so the
 * canvas stays usable; "closed" is the bar snap point that shows the selected person's name.
 */
export default function SheetFrame(props: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  label: string;
  gripLabel: string;
  title: string;
  /** Changing this (another person picked) scrolls the sheet back to its top. */
  resetKey?: string | null;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const opened = props.snap !== 'bar';
  // Opening the sheet from its bar, or picking someone else, starts at the top (name and actions).
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [props.resetKey, opened]);
  const collapsed = props.snap === 'bar';
  return (
    <Drawer.Root
      open
      modal={false}
      disablePointerDismissal
      snapPoints={SNAP_POINTS}
      snapPoint={SNAP_VALUES[props.snap]}
      snapToSequentialPoints
      onSnapPointChange={(v) => props.onSnapChange(snapOf(v))}
      // Swiping below the bar or pressing Escape never removes the editor: it collapses to the bar.
      onOpenChange={(open) => !open && props.onSnapChange('bar')}
    >
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Viewport className="sheet-viewport">
            <Drawer.Popup className={`sheet${collapsed ? ' hidden' : ''}`} data-snap={props.snap} data-testid="sidebar" aria-label={props.label}>
              <div className="sheet-drag" data-testid="sheet-drag">
                <div className="sheet-handle" aria-hidden="true" />
                <button
                  className="sidebar-grip"
                  onClick={() => props.onSnapChange(collapsed ? 'half' : 'bar')}
                  aria-expanded={!collapsed}
                  data-testid="sheet-grip"
                >
                  <Icon id={collapsed ? 'caretUp' : 'caretDown'} size={16} />
                  {props.title}
                  <span className="sr-only">, {props.gripLabel}</span>
                </button>
              </div>
              <Drawer.Content ref={body} className="sidebar-body sheet-body">{props.children}</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

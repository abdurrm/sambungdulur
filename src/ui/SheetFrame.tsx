import type { ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  children: ReactNode;
}) {
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
                  aria-label={props.gripLabel}
                  aria-expanded={!collapsed}
                  data-testid="sheet-grip"
                >
                  {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {props.title}
                </button>
              </div>
              <Drawer.Content className="sidebar-body sheet-body">{props.children}</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

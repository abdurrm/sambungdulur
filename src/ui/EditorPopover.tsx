import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';
import type { CanvasApi } from './TreeCanvas';
import { Icon } from './icons';
import { t } from '../i18n';

/** Room kept free around the pop-up: header above, zoom buttons on the right, view info and toasts below. */
export const POPUP_COLLISION = { top: 64, right: 68, bottom: 84, left: 12 };
export const POPUP_WIDTH = 360;
const GAP = 12;

/**
 * Desktop editor: a non-modal Base UI Popover anchored to the selected card (not a dialog in the middle
 * of the screen). The canvas stays clickable, pannable and keyboard-driven: opening never takes focus,
 * a press outside never closes it (picking another card moves it there; empty canvas deselects), and it
 * follows its card on every pan or zoom, hiding while the card is off screen.
 * Sides are tried right, left, then below and above the card.
 */
export default function EditorPopover(props: {
  open: boolean;
  personId: string | null;
  label: string;
  canvas: React.RefObject<CanvasApi | null>;
  /** Escape or the close button. */
  onClose: () => void;
  /** Turns the pop-up into a fixed panel on the right. */
  onPin: () => void;
  /** Escape belongs to an open dialog or menu instead. */
  escapeBlocked: () => boolean;
  children: ReactNode;
}) {
  const [, setTick] = useState(0);
  const api = props.canvas.current;
  useEffect(() => api?.onViewChange(() => setTick((n) => n + 1)), [api]);
  const id = props.personId;
  const rect = id && api ? api.cardRect(id) : null;
  const view = api?.canvasRect() ?? null;
  // The card counts as visible while some of it is inside the canvas.
  const cardVisible =
    !!rect && !!view && rect.right > view.left && rect.left < view.right && rect.bottom > view.top && rect.top < view.bottom && rect.width > 0;
  // A fresh virtual anchor on every render makes the positioner measure the card again.
  const anchor = useMemo(
    () => (rect ? { getBoundingClientRect: () => rect } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rect?.x, rect?.y, rect?.width, rect?.height],
  );
  return (
    <Popover.Root
      open={props.open && !!anchor}
      modal={false}
      onOpenChange={(open, details) => {
        if (open) return;
        if (details.reason === 'escape-key') {
          if (props.escapeBlocked()) return;
          props.onClose();
        } else if (details.reason === 'close-press') props.onClose();
        // Outside presses and focus leaving the pop-up do not close it: the canvas decides.
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          className="editor-positioner"
          anchor={anchor}
          side="right"
          align="center"
          sideOffset={GAP}
          collisionPadding={POPUP_COLLISION}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'end' }}
          positionMethod="fixed"
          data-card-hidden={cardVisible ? undefined : ''}
        >
          <Popover.Popup
            className="editor-popup"
            initialFocus={false}
            finalFocus={false}
            aria-label={props.label}
            data-testid="editor-popup"
            data-key-scope="tree"
          >
            <div className="panel-tools">
              <button className="editor-close" onClick={props.onPin} aria-label={t('pinEditor')} aria-pressed="false" data-tip={t('pinEditor')} data-testid="editor-pin">
                <Icon id="pin" size={18} />
              </button>
              <Popover.Close className="editor-close" aria-label={t('close')} data-tip={t('closeEditor')} data-testid="editor-close">
                <Icon id="close" size={18} />
              </Popover.Close>
            </div>
            {props.children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

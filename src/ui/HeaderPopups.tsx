import type { ReactElement, ReactNode } from 'react';
import { Popover } from '@base-ui/react/popover';

/**
 * Header popover (search, tree settings). Controlled by the App so only one header popup is open at a time.
 * Escape, outside presses and focus return are handled by Base UI. On narrow screens CSS docks the
 * positioner to the bottom of the screen so it is within thumb reach.
 */
export function ToolPopover(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  label: string;
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Popover.Trigger render={props.trigger} />
      <Popover.Portal>
        <Popover.Positioner className="popup-positioner" side="bottom" align="end" sideOffset={6} collisionPadding={8} positionMethod="fixed">
          <Popover.Popup className={`popover${props.className ? ' ' + props.className : ''}`} aria-label={props.label} data-testid={props.testId}>
            {props.children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}


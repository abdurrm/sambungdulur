import { useEffect, useState } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';

const OPEN_DELAY = 350;

/**
 * One tooltip for the whole app (Base UI Tooltip), shown for any element with `data-tip`.
 * Opens on mouse hover after a short delay (instantly while moving between tools) and on keyboard focus;
 * never on touch, where a tap must just run the action. The text includes the keyboard shortcut.
 */
export default function TooltipLayer() {
  const [tip, setTip] = useState<{ el: HTMLElement; text: string } | null>(null);
  useEffect(() => {
    let timer = 0;
    let current: HTMLElement | null = null;
    let warm = false; // a tooltip was just visible: show the next one without waiting
    const show = (el: HTMLElement) => {
      clearTimeout(timer);
      current = el;
      timer = window.setTimeout(
        () => {
          if (current === el && document.contains(el)) {
            setTip({ el, text: el.dataset.tip ?? '' });
            warm = true;
          }
        },
        warm ? 0 : OPEN_DELAY,
      );
    };
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setTip(null);
      timer = window.setTimeout(() => (warm = false), 400);
    };
    const tipOf = (t: EventTarget | null) => ((t as Element | null)?.closest?.('[data-tip]') as HTMLElement | null) ?? null;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = tipOf(e.target);
      if (el === current) return;
      if (el) show(el);
      else if (current) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = tipOf(e.target);
      if (el && el.matches(':focus-visible')) show(el);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && current && hide();
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerdown', hide, true);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);
  if (!tip || !tip.text) return null;
  return (
    <Tooltip.Root open onOpenChange={(open) => !open && setTip(null)}>
      <Tooltip.Portal>
        <Tooltip.Positioner className="tooltip-positioner" anchor={tip.el} side="bottom" sideOffset={8} collisionPadding={8}>
          <Tooltip.Popup className="tooltip" data-testid="tooltip">
            {tip.text}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

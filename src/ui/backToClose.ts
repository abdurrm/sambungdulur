import { useEffect, useRef } from 'react';

/**
 * Makes the browser/Android back button close the topmost open layer (full editor sheet, dialog)
 * instead of leaving the app. Each active layer pushes one history entry; only the top of the stack
 * reacts to a back press. Closing a layer by other means removes its entry again.
 */
interface Entry {
  token: string;
  onBack: () => void;
}
const stack: Entry[] = [];
let ignorePops = 0;
let listening = false;

function onPop() {
  if (ignorePops > 0) {
    ignorePops--;
    return;
  }
  const top = stack.pop();
  top?.onBack();
}

export function useBackToClose(active: boolean, onBack: () => void) {
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    if (!active) return;
    if (!listening) {
      window.addEventListener('popstate', onPop);
      listening = true;
    }
    const token = Math.random().toString(36).slice(2);
    const entry: Entry = { token, onBack: () => cb.current() };
    stack.push(entry);
    history.pushState({ ...(history.state ?? {}), sdLayer: token }, '');
    return () => {
      const i = stack.indexOf(entry);
      if (i < 0) return; // already consumed by a back press
      stack.splice(i, 1);
      // Closed in-app: drop the history entry we added so back still leaves the app afterwards.
      if (history.state?.sdLayer === token) {
        ignorePops++;
        history.back();
      }
    };
  }, [active]);
}

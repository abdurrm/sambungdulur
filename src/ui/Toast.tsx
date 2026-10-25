import { useEffect } from 'react';

export function Toast(props: { text: string; kind?: 'info' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(props.onDone, props.kind === 'error' ? 6000 : 3200);
    return () => clearTimeout(timer);
  }, [props]);
  return (
    <div className={`toast${props.kind === 'error' ? ' error' : ''}`} role="status" data-testid="toast">
      {props.text}
    </div>
  );
}

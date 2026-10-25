import { Toast } from '@base-ui/react/toast';
import { t } from '../i18n';

/** One app-wide toast queue (Base UI Toast), usable from any handler without prop drilling. */
const manager = Toast.createToastManager();

export function notify(text: string, opts: { kind?: 'info' | 'error'; action?: { label: string; onClick: () => void } } = {}) {
  const id: string = manager.add({
    description: text,
    type: opts.kind ?? 'info',
    priority: opts.kind === 'error' ? 'high' : 'low',
    timeout: opts.action ? 8000 : opts.kind === 'error' ? 6000 : 3200,
    actionProps: opts.action
      ? ({
          children: opts.action.label,
          onClick: () => {
            manager.close(id);
            opts.action!.onClick();
          },
          'data-testid': 'toast-action',
        } as React.ButtonHTMLAttributes<HTMLButtonElement>)
      : undefined,
  });
  return id;
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    // The toast has no visible title: its message names it for screen readers (role="dialog" needs a name).
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={`toast${toast.type === 'error' ? ' error' : ''}`}
      aria-label={typeof toast.description === 'string' ? toast.description : undefined}
      data-testid="toast"
    >
      <Toast.Content className="toast-content">
        <Toast.Description className="toast-text" />
        {toast.actionProps && <Toast.Action className="toast-action" />}
        <Toast.Close className="toast-close" aria-label={t('close')}>×</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}

export function Toasts() {
  return (
    <Toast.Provider toastManager={manager} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

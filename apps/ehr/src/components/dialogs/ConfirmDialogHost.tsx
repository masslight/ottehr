import { ReactElement, useEffect, useState } from 'react';
import { AppDialog } from './AppDialog';
import { ConfirmDialogRequest, useConfirmDialogStore } from './confirmDialog';

/** Renders the dialogs opened by `confirmDialog()` and `confirmDestructive()`. Mount once, at the app root. */
export function ConfirmDialogHost(): ReactElement | null {
  const request = useConfirmDialogStore((state) => state.request);
  // Keeps the last question on screen while the dialog fades out.
  const [shown, setShown] = useState<ConfirmDialogRequest | undefined>(request);
  useEffect(() => {
    if (request) setShown(request);
  }, [request]);

  if (!shown) return null;

  const answer = (confirmed: boolean): void => {
    if (!request) return;
    request.resolve(confirmed);
    useConfirmDialogStore.setState({ request: undefined });
  };

  return (
    <AppDialog
      variant={shown.variant}
      open={Boolean(request)}
      onClose={() => answer(false)}
      title={shown.title}
      primary={{ label: shown.confirmLabel, onClick: () => answer(true) }}
      dismiss={shown.cancelLabel ? { label: shown.cancelLabel } : undefined}
    >
      {shown.body}
    </AppDialog>
  );
}

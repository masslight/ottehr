import { Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { DmeOrderDTO } from 'utils/lib/types/api/dme.types';
import { useUpdateDmeOrder } from '../dme.queries';

export type DmeOrderAction = 'delete' | 'dispense';

const ACTION_COPY: Record<
  DmeOrderAction,
  { title: string; description: (itemName: string) => string; confirmText: string; errorMessage: string }
> = {
  delete: {
    title: 'Delete DME Order',
    description: (itemName) => `Are you sure you want to delete the DME order "${itemName}"?`,
    confirmText: 'Delete Order',
    errorMessage: 'Failed to delete the DME order. Please try again.',
  },
  dispense: {
    title: 'Dispense DME',
    description: (itemName) => `Confirm that "${itemName}" has been handed to the patient.`,
    confirmText: 'Dispense',
    errorMessage: 'Failed to mark the DME order as dispensed. Please try again.',
  },
};

interface DmeOrderActionDialogProps {
  order: DmeOrderDTO;
  action: DmeOrderAction;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}

export const DmeOrderActionDialog = ({
  order,
  action,
  open,
  onClose,
  onDone,
}: DmeOrderActionDialogProps): ReactElement => {
  const { mutateAsync: updateOrder, isPending } = useUpdateDmeOrder(order.encounterId);
  const copy = ACTION_COPY[action];
  const [serverError, setServerError] = useState<string | undefined>();

  // Reproduces what InPersonModal did for this dialog: close on success, keep it open with the error on failure.
  const handleConfirm = async (): Promise<void> => {
    setServerError(undefined);
    try {
      await updateOrder({ action, deviceRequestId: order.id });
      onDone?.();
      handleClose();
    } catch (error) {
      setServerError(getApiError({ error, defaultError: copy.errorMessage }));
      enqueueSnackbar(copy.errorMessage, { variant: 'error' });
    }
  };

  const handleClose = (): void => {
    setServerError(undefined);
    onClose();
  };

  return (
    <AppDialog
      variant={action === 'delete' ? 'destructive' : 'confirm'}
      open={open}
      onClose={handleClose}
      title={copy.title}
      primary={{ label: copy.confirmText, onClick: handleConfirm, disabled: isPending }}
    >
      {copy.description(order.itemName)}
      {serverError && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {serverError}
        </Typography>
      )}
    </AppDialog>
  );
};

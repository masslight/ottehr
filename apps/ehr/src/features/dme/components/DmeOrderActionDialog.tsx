import { ReactElement } from 'react';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
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

  const handleConfirm = async (): Promise<void> => {
    await updateOrder({ action, deviceRequestId: order.id });
    onDone?.();
  };

  return (
    <InPersonModal
      open={open}
      title={copy.title}
      description={copy.description(order.itemName)}
      confirmText={copy.confirmText}
      closeButtonText="Cancel"
      color={action === 'delete' ? 'error.main' : 'primary.main'}
      handleConfirm={handleConfirm}
      handleClose={onClose}
      errorMessage={copy.errorMessage}
      disabled={isPending}
    />
  );
};

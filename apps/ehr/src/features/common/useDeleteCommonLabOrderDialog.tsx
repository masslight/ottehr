import { Typography } from '@mui/material';
import { ReactElement, useCallback, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ExternalLabsStatus } from 'utils/lib/types/data/labs/labs.types';

interface UseDeleteCommonLabOrderDialogProps {
  deleteOrder: ({
    serviceRequestId,
    testItemName,
  }: {
    serviceRequestId: string;
    testItemName: string;
  }) => Promise<{ success: boolean; errorMsg?: string }>;
  locales?: typeof defaultLocalesConstants;
}

const defaultLocalesConstants = {
  noLabOrderSelectedForDeletion: 'No lab order selected for deletion',
  failedToDeleteLabOrder: 'Failed to delete lab order',
  errorOccurredDuringDeletion: 'An error occurred during deletion',
  errorConfirmingDelete: 'Error confirming delete:',
  deleteOrderDialogTitle: 'Delete Lab Order',
  deleteOrderDialogContent: (testItemName: string, testItemStatus: ExternalLabsStatus | undefined) => (
    <>
      Are you sure you want to delete this order <strong>{testItemName}</strong>?
      <br />
      <br />
      Any results associated with this order will also be deleted. Deleting this order will not remove any associated
      diagnoses; please review the Assessment.
      {testItemStatus && ['sent', 'received', 'reviewed'].includes(testItemStatus) && (
        <>
          <br />
          <br />
          <strong>{`This lab is already ${testItemStatus}. Are you sure you want to delete the electronic record of it?`}</strong>
        </>
      )}
      <br />
      <br />
      <strong>This action is final and cannot be undone.</strong>
    </>
  ),
  deleteOrderDialogKeepButton: 'Cancel',
  deleteOrderDialogDeleteButton: 'Delete Order',
};

interface UseDeleteCommonLabOrderDialogResult {
  showDeleteLabOrderDialog: ({
    serviceRequestId,
    testItemName,
    testItemStatus,
  }: {
    serviceRequestId: string;
    testItemName: string;
    testItemStatus?: ExternalLabsStatus;
  }) => void;
  DeleteOrderDialog: ReactElement | null;
}

export const useDeleteCommonLabOrderDialog = ({
  deleteOrder,
  locales = defaultLocalesConstants,
}: UseDeleteCommonLabOrderDialogProps): UseDeleteCommonLabOrderDialogResult => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [serviceRequestIdToDelete, setServiceRequestIdToDelete] = useState<string>('');
  const [testItemNameToDelete, setTestItemNameToDelete] = useState<string>('');
  const [testItemToDeleteStatus, setTestItemToDeleteStatus] = useState<ExternalLabsStatus | undefined>(undefined);

  const showDeleteLabOrderDialog = useCallback(
    ({
      serviceRequestId,
      testItemName,
      testItemStatus,
    }: {
      serviceRequestId: string;
      testItemName: string;
      testItemStatus?: ExternalLabsStatus;
    }): void => {
      setServiceRequestIdToDelete(serviceRequestId);
      setTestItemNameToDelete(testItemName);
      setIsDeleteDialogOpen(true);
      setDeleteError(null);
      setTestItemToDeleteStatus(testItemStatus);
    },
    []
  );

  const closeDeleteDialog = useCallback((): void => {
    setIsDeleteDialogOpen(false);
    setDeleteError(null);
  }, []);

  const confirmDeleteOrder = useCallback(async (): Promise<void> => {
    if (!serviceRequestIdToDelete) {
      setDeleteError(locales.noLabOrderSelectedForDeletion);
      return;
    }

    setIsDeleting(true);

    try {
      const response = await deleteOrder({
        serviceRequestId: serviceRequestIdToDelete,
        testItemName: testItemNameToDelete,
      });

      if (response.success) {
        setIsDeleteDialogOpen(false);
      } else {
        let errorMsg = locales.failedToDeleteLabOrder;
        if (response.errorMsg) errorMsg += `: ${response.errorMsg}`;
        setDeleteError(errorMsg);
      }
    } catch (err) {
      console.error(locales.errorConfirmingDelete, err);
      const errorMessage = err instanceof Error ? err.message : locales.errorOccurredDuringDeletion;
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [serviceRequestIdToDelete, testItemNameToDelete, deleteOrder, locales]);

  const DeleteOrderDialog = isDeleteDialogOpen ? (
    <AppDialog
      variant="destructive"
      data-testid={dataTestIds.commonLabOrder.deleteDialog}
      open={isDeleteDialogOpen}
      onClose={closeDeleteDialog}
      title={locales.deleteOrderDialogTitle}
      dismiss={{ label: locales.deleteOrderDialogKeepButton }}
      primary={{
        label: locales.deleteOrderDialogDeleteButton,
        onClick: confirmDeleteOrder,
        loading: isDeleting,
        'data-testid': dataTestIds.commonLabOrder.deleteDialogButton,
      }}
    >
      {locales.deleteOrderDialogContent(testItemNameToDelete, testItemToDeleteStatus)}
      {deleteError && (
        <Typography color="error" sx={{ mt: 2, fontSize: 'inherit' }}>
          {deleteError}
        </Typography>
      )}
    </AppDialog>
  ) : null;

  return {
    showDeleteLabOrderDialog,
    DeleteOrderDialog,
  };
};

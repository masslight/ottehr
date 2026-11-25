import { ReactElement } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAdminDeleteEmCodeMutation } from './admin.queries';

interface EMCodeDeleteDialogProps {
  code: string | null;
  onClose: () => void;
}

export default function EMCodeDeleteDialog({ code, onClose }: EMCodeDeleteDialogProps): ReactElement {
  const deleteMutation = useAdminDeleteEmCodeMutation();

  const handleConfirm = (): void => {
    if (code) {
      deleteMutation.mutate({ code }, { onSuccess: onClose });
    }
  };

  return (
    <AppDialog
      variant="destructive"
      open={code !== null}
      onClose={onClose}
      title="Delete E&M Code"
      data-testid={dataTestIds.emCodesAdminPage.confirmDeleteDialog}
      primary={{
        label: 'Delete',
        onClick: handleConfirm,
        loading: deleteMutation.isPending,
        'data-testid': dataTestIds.emCodesAdminPage.confirmDeleteButton,
      }}
      dismiss={{ 'data-testid': dataTestIds.emCodesAdminPage.cancelDeleteButton }}
    >
      Are you sure you want to delete code <strong>{code}</strong>? This action cannot be undone.
    </AppDialog>
  );
}

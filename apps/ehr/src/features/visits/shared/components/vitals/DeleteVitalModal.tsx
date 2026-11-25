import { Box } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

const ERROR_MESSAGE = "Can't delete vital observation. Please try again later.";

export const DeleteVitalModal: React.FC<{
  open: boolean;
  onClose: () => void;
  entity: VitalsObservationDTO;
  onDelete: (entity: VitalsObservationDTO) => Promise<void>;
}> = ({ open, onClose, entity, onDelete }) => {
  const [error, setError] = useState<string>();

  const handleDelete = async (): Promise<void> => {
    setError(undefined);
    try {
      await onDelete(entity);
      onClose();
    } catch {
      setError(ERROR_MESSAGE);
      enqueueSnackbar(ERROR_MESSAGE, { variant: 'error' });
    }
  };

  return (
    <AppDialog
      variant="destructive"
      open={open}
      onClose={onClose}
      title="Delete Vital"
      primary={{ label: 'Delete', onClick: handleDelete }}
      data-testid={dataTestIds.vitalsPage.deleteVitalModal}
    >
      <Box data-testid={dataTestIds.dialog.inPersonModalContent}>
        Are you sure you want to permanently delete this vitals note?
        {error && (
          <Box mt={2} color="error.main">
            {error}
          </Box>
        )}
      </Box>
    </AppDialog>
  );
};

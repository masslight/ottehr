import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createDischargeSummary } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { RoundedButton } from '../../../../components/RoundedButton';
import { dataTestIds } from '../../../../constants/data-test-ids';

interface DischargeSummaryButtonProps {
  appointmentId?: string;
}

export const DischargeSummaryButton: FC<DischargeSummaryButtonProps> = ({ appointmentId }) => {
  const { oystehrZambda } = useApiClients();
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const handleCreateDischargeSummary = async (): Promise<void> => {
    if (!oystehrZambda || !appointmentId) {
      throw new Error('api client not defined or appointment id is missing');
    }
    setStatusLoading(true);
    try {
      await createDischargeSummary(oystehrZambda, {
        appointmentId,
      });
      enqueueSnackbar('Discharge Summary saved.', { variant: 'success' });
    } catch (error: any) {
      console.error('Error creating Discharge Summary:', error);
      enqueueSnackbar('Error creating Discharge Summary.', { variant: 'error' });
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <RoundedButton
      loading={statusLoading}
      variant="outlined"
      onClick={handleCreateDischargeSummary}
      startIcon={<PrintOutlinedIcon color="inherit" />}
      data-testid={dataTestIds.progressNotePage.dischargeSummaryButton}
    >
      Discharge Summary
    </RoundedButton>
  );
};

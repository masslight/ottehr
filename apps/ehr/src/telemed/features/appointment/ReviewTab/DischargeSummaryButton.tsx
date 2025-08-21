import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { createDischargeSummary } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { RoundedButton } from '../../../../components/RoundedButton';
import { dataTestIds } from '../../../../constants/data-test-ids';

interface DischargeSummaryButtonProps {
  appointmentId?: string;
  patientId?: string;
}

export const DischargeSummaryButton: FC<DischargeSummaryButtonProps> = ({ appointmentId, patientId }) => {
  const { oystehrZambda } = useApiClients();
  const { downloadDocument } = useGetPatientDocs(patientId ?? '');

  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  if (!patientId) {
    return null;
  }

  const handleCreateDischargeSummary = async (): Promise<void> => {
    if (!oystehrZambda || !appointmentId) {
      throw new Error('api client not defined or appointment id is missing');
    }
    setStatusLoading(true);
    try {
      const response = await createDischargeSummary(oystehrZambda, {
        appointmentId,
      });
      const documentId = response?.documentId;

      if (documentId) {
        await downloadDocument(documentId);
      } else {
        enqueueSnackbar(
          'Discharge summary created, but document is not accessible right now. You can find it later in the Patient Record > Review Docs.',
          { variant: 'info' }
        );
      }
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

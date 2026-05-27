import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { createAndOpenDischargeSummary } from './DischargeButton';

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
      await createAndOpenDischargeSummary(oystehrZambda, appointmentId, downloadDocument);
      enqueueSnackbar('Discharge Summary saved.', { variant: 'success' });
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <RoundedButton
      loading={statusLoading}
      loadingPosition="start"
      variant="outlined"
      onClick={handleCreateDischargeSummary}
      startIcon={<PrintOutlinedIcon color="inherit" />}
      data-testid={dataTestIds.progressNotePage.dischargeSummaryButton}
    >
      Discharge Summary
    </RoundedButton>
  );
};

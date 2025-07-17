import CheckIcon from '@mui/icons-material/Check';
import { Box, Skeleton } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { useAppointment } from 'src/features/css-module/hooks/useAppointment';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getVisitStatus } from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const DischargeButton: FC = () => {
  const { appointment, encounter } = getSelectors(useAppointmentStore, ['appointment', 'encounter']);
  const { refetch } = useAppointment(appointment?.id);
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const [statusLoading, setStatusLoading] = useState<boolean>(false);

  const inPersonStatus = useMemo(() => appointment && getVisitStatus(appointment, encounter), [appointment, encounter]);
  const isAlreadyDischarged = inPersonStatus === 'ready for discharge' || inPersonStatus === 'completed';

  if (!user || !encounter?.id) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'end' }}>
        <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: '20px' }} />
      </Box>
    );
  }

  const encounterId: string = encounter.id;

  const handleDischarge = async (): Promise<void> => {
    setStatusLoading(true);

    try {
      await handleChangeInPersonVisitStatus({ encounterId, user, updatedStatus: 'ready for discharge' }, oystehrZambda);

      await refetch();

      enqueueSnackbar('Patient discharged successfully', { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <RoundedButton
        disabled={statusLoading || isAlreadyDischarged}
        variant="contained"
        onClick={handleDischarge}
        startIcon={isAlreadyDischarged ? <CheckIcon color="inherit" /> : undefined}
        data-testid={dataTestIds.progressNotePage.dischargeButton}
      >
        {isAlreadyDischarged ? 'Discharged' : 'Discharge'}
      </RoundedButton>
    </Box>
  );
};

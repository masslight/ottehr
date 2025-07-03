import CheckIcon from '@mui/icons-material/Check';
import { Box } from '@mui/material';
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

  const isDischargedStatus = useMemo(() => inPersonStatus === 'ready for discharge', [inPersonStatus]);

  const handleDischarge = async (): Promise<void> => {
    if (!encounter || !encounter.id) {
      throw new Error('Encounter ID is required to change the visit status');
    }

    if (!oystehrZambda) {
      throw new Error('Oystehr Zambda client is not available when changing the visit status');
    }

    if (!user) {
      throw new Error('User is required to change the visit status');
    }

    setStatusLoading(true);

    try {
      await handleChangeInPersonVisitStatus(
        { encounterId: encounter.id, user, updatedStatus: 'ready for discharge' },
        oystehrZambda
      );

      await refetch();

      enqueueSnackbar('Patient discharged successfully', { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }

    setStatusLoading(false);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <RoundedButton
        disabled={statusLoading || isDischargedStatus}
        variant="contained"
        onClick={handleDischarge}
        startIcon={isDischargedStatus ? <CheckIcon color="inherit" /> : undefined}
        data-testid={dataTestIds.progressNotePage.dischargeButton}
      >
        {isDischargedStatus ? 'Discharged' : 'Discharge'}
      </RoundedButton>
    </Box>
  );
};

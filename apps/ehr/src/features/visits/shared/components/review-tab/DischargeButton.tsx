import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import { LoadingButton } from '@mui/lab';
import { Box, Button, ButtonGroup, Skeleton, Tooltip } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { handleDischarge } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getInPersonVisitStatus } from 'utils';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { DischargeAndPrintDialog } from './DischargeAndPrintDialog';

export const DischargeButton: FC = () => {
  const { appointment, encounter, appointmentRefetch, resources } = useAppointmentData();
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const inPersonStatus = useMemo(
    () => appointment && getInPersonVisitStatus(appointment, encounter),
    [appointment, encounter]
  );

  const isAlreadyDischarged = inPersonStatus === 'discharged' || inPersonStatus === 'completed';

  if (!user || !encounter?.id) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'end' }}>
        <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: '20px' }} />
      </Box>
    );
  }

  const encounterId: string = encounter.id;
  const appointmentId = resources?.appointment?.id ?? appointment?.id;
  const patientId = resources?.patient?.id;

  const onDischargeClick = async (): Promise<void> => {
    setStatusLoading(true);

    try {
      await handleDischarge(encounterId, oystehrZambda);
      await appointmentRefetch();
      enqueueSnackbar('Patient discharged successfully', { variant: 'success' });
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDischargeSuccess = async (): Promise<void> => {
    await appointmentRefetch();
  };

  if (isAlreadyDischarged) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'end' }}>
        <LoadingButton
          disabled
          variant="contained"
          startIcon={<CheckIcon color="inherit" />}
          data-testid={dataTestIds.progressNotePage.dischargeButton}
          sx={{ borderRadius: 100, textTransform: 'none' }}
        >
          Discharged
        </LoadingButton>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'end' }}>
        <ButtonGroup variant="contained" disabled={statusLoading || isAlreadyDischarged} sx={{ boxShadow: 'none' }}>
          <LoadingButton
            variant="contained"
            loading={statusLoading}
            onClick={onDischargeClick}
            data-testid={dataTestIds.progressNotePage.dischargeButton}
            sx={{ borderRadius: '100px', textTransform: 'none' }}
          >
            Discharge
          </LoadingButton>
          <Tooltip title="Discharge & Print">
            <Button variant="contained" size="small" onClick={() => setDialogOpen(true)} sx={{ borderRadius: '100px' }}>
              <ArrowDropDownIcon fontSize="small" />
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>

      <DischargeAndPrintDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        encounterId={encounterId}
        appointmentId={appointmentId}
        patientId={patientId}
        onDischargeSuccess={handleDischargeSuccess}
      />
    </>
  );
};

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import { LoadingButton } from '@mui/lab';
import { Box, Button, ButtonGroup, Skeleton, Tooltip } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { createDischargeSummary } from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getInPersonVisitStatus } from 'utils';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { DischargeAndPrintDialog } from './DischargeAndPrintDialog';

export const createAndOpenDischargeSummary = async (
  oystehr: Oystehr,
  appointmentId: string,
  downloadDocument: (id: string, options?: { skipRelated?: boolean }) => Promise<void>,
  options?: { skipRelated?: boolean }
): Promise<void> => {
  try {
    const response = await createDischargeSummary(oystehr, { appointmentId });
    const documentId = response?.documentId;
    if (documentId) {
      await downloadDocument(documentId, options);
    } else {
      enqueueSnackbar(
        'Discharge summary created, but document is not accessible right now. You can find it later in the Patient Record > Review Docs.',
        { variant: 'info' }
      );
    }
  } catch (error) {
    console.error('Error creating Discharge Summary:', error);
    enqueueSnackbar('Error creating Discharge Summary.', { variant: 'error' });
  }
};

export const handleDischarge = async (encounterId: string, oystehr?: Oystehr): Promise<void> => {
  await handleChangeInPersonVisitStatus({ encounterId, updatedStatus: 'discharged' }, oystehr);
  enqueueSnackbar('Patient discharged successfully', { variant: 'success' });
};

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
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    } finally {
      setStatusLoading(false);
    }
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
      />
    </>
  );
};

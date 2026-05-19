import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import { LoadingButton } from '@mui/lab';
import { Box, ButtonGroup, IconButton, Skeleton, Tooltip } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
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

  const handleDischarge = async (): Promise<void> => {
    setStatusLoading(true);

    try {
      await handleChangeInPersonVisitStatus({ encounterId, updatedStatus: 'discharged' }, oystehrZambda);
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
          sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap' }}
        >
          Discharged
        </LoadingButton>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'end' }}>
        <ButtonGroup
          variant="contained"
          disabled={statusLoading || isAlreadyDischarged}
          sx={{
            borderRadius: 100,
            '& .MuiButtonGroup-grouped': {
              borderRadius: 100,
            },
            '& .MuiButtonGroup-grouped:not(:last-of-type)': {
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            },
            '& .MuiButtonGroup-grouped:not(:first-of-type)': {
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            },
          }}
        >
          <LoadingButton
            loading={statusLoading}
            variant="contained"
            onClick={handleDischarge}
            data-testid={dataTestIds.progressNotePage.dischargeButton}
            sx={{
              borderRadius: 100,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: 14,
              whiteSpace: 'nowrap',
              borderTopRightRadius: '0 !important',
              borderBottomRightRadius: '0 !important',
            }}
          >
            Discharge
          </LoadingButton>
          <Tooltip title="Discharge & Print">
            <IconButton
              size="small"
              onClick={() => setDialogOpen(true)}
              disabled={statusLoading}
              sx={{
                borderRadius: 0,
                borderTopRightRadius: '100px !important',
                borderBottomRightRadius: '100px !important',
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                border: '1px solid',
                borderColor: 'primary.main',
                borderLeft: '1px solid rgba(255,255,255,0.3)',
                px: 0.5,
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'action.disabledBackground',
                  color: 'action.disabled',
                  borderColor: 'action.disabledBackground',
                },
              }}
            >
              <ArrowDropDownIcon fontSize="small" />
            </IconButton>
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

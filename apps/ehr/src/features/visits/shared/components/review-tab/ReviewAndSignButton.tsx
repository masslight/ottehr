import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Checkbox, FormControlLabel, Stack, Tooltip, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getPatientName } from 'src/shared/utils/getPatientName';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useProgressNoteSigning } from '../../hooks/useProgressNoteSigning';
import { useAppointmentData } from '../../stores/appointment/appointment.store';

type ReviewAndSignButtonProps = {
  onSigned?: () => void;
};

export const ReviewAndSignButton: FC<ReviewAndSignButtonProps> = ({ onSigned }) => {
  const { patient } = useAppointmentData();
  const { completed, errorMessages, supervisorApprovalApplies, mdmRequired, inPersonStatus, isSigning, signNote } =
    useProgressNoteSigning();

  const [openTooltip, setOpenTooltip] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requireSupervisorApproval, setRequireSupervisorApproval] = useState(true);

  const patientName = getPatientName(patient?.name).firstLastName;

  const handleCloseTooltip = (): void => {
    setOpenTooltip(false);
  };

  const handleOpenTooltip = (): void => {
    setOpenTooltip(true);
  };

  const handleSign = async (): Promise<void> => {
    await signNote({ requireSupervisorApproval });

    if (onSigned) {
      onSigned();
    }
  };

  // Closes once signing has succeeded; a failure leaves the dialog open and reports it.
  const handleConfirm = async (): Promise<void> => {
    try {
      await handleSign();
      setDialogOpen(false);
    } catch (error: unknown) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
  };

  const confirmationDescription = mdmRequired
    ? 'Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses, made a medical decision and chosen an E&M code and are ready to sign this patient?'
    : 'Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses and chosen an E&M code and are ready to sign this patient?';

  return (
    <Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <Tooltip
        placement="top"
        open={openTooltip && errorMessages.length > 0}
        onClose={handleCloseTooltip}
        onOpen={handleOpenTooltip}
        title={errorMessages.map((message) => (
          <Typography key={message}>{message}</Typography>
        ))}
      >
        <Box>
          <RoundedButton
            disabled={errorMessages.length > 0 || isSigning || completed || inPersonStatus === 'provider'}
            variant="contained"
            onClick={() => setDialogOpen(true)}
            startIcon={completed ? <CheckIcon color="inherit" /> : undefined}
            data-testid={dataTestIds.progressNotePage.reviewAndSignButton}
          >
            {completed ? 'Signed' : 'Review & Sign'}
          </RoundedButton>
          <AppDialog
            variant="confirm"
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title={`Review and Sign ${patientName}`}
            primary={{ label: 'Sign', onClick: handleConfirm, loading: isSigning }}
          >
            <Stack spacing={2}>
              <Box>{confirmationDescription}</Box>

              {supervisorApprovalApplies && (
                <FormControlLabel
                  control={
                    <Checkbox
                      data-testid={dataTestIds.progressNotePage.supervisorApprovalCheckbox}
                      checked={requireSupervisorApproval}
                      onChange={(e) => setRequireSupervisorApproval(e.target.checked)}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={0.5}>
                      Require Supervisor approval
                      <Tooltip
                        placement="top"
                        title="When this option is ON, the button 'Approve' becomes available for Supervisor on the complete visits on Discharged tab of the Tracking Board. Once approved, the claim will be submitted to RCM."
                      >
                        <InfoOutlinedIcon fontSize="small" color="action" />
                      </Tooltip>
                    </Box>
                  }
                />
              )}
            </Stack>
          </AppDialog>
        </Box>
      </Tooltip>
    </Box>
  );
};

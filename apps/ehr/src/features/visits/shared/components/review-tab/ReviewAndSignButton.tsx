import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Checkbox, DialogContentText, FormControlLabel, Stack, Tooltip, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getPatientName } from 'src/shared/utils/getPatientName';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
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
          <ConfirmationDialog
            title={`Review and Sign ${patientName}`}
            description={
              <Stack spacing={2}>
                <DialogContentText>{confirmationDescription}</DialogContentText>

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
            }
            response={handleSign}
            actionButtons={{
              proceed: { text: 'Sign', loading: isSigning },
              back: { text: 'Cancel' },
              reverse: true,
            }}
          >
            {(showDialog) => (
              <RoundedButton
                disabled={errorMessages.length > 0 || isSigning || completed || inPersonStatus === 'provider'}
                variant="contained"
                onClick={showDialog}
                startIcon={completed ? <CheckIcon color="inherit" /> : undefined}
                data-testid={dataTestIds.progressNotePage.reviewAndSignButton}
              >
                {completed ? 'Signed' : 'Review & Sign'}
              </RoundedButton>
            )}
          </ConfirmationDialog>
        </Box>
      </Tooltip>
    </Box>
  );
};

import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import { Box, Tooltip, Typography } from '@mui/material';
import { Appointment, Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useSendFax } from 'src/hooks/useSendFax';
import { getInPersonVisitStatus } from 'utils';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
import { FAX_NUMBER_HELPER_TEXT, FaxNumberField, isFaxNumberValid } from '../../../../../components/FaxNumberField';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';

interface SendFaxButtonProps {
  /**
   * Visit-note fax (default behavior): gates the button until the visit note is signed and faxes a
   * copy of that note for this appointment.
   */
  appointment?: Appointment;
  encounter?: Encounter;
  /**
   * Overrides the default (visit-note) send — e.g. faxing a radiology order instead. Should throw on
   * failure so the error snackbar is shown. When provided, the visit-note gating does not apply.
   */
  onSend?: (faxNumber: string) => Promise<void>;
  /** Optional prefill (10 digits); synced into the field if it resolves asynchronously. */
  initialFaxNumber?: string;
}

export const SendFaxButton: FC<SendFaxButtonProps> = ({ appointment, encounter, onSend, initialFaxNumber }) => {
  const sendFax = useSendFax();
  const [openTooltip, setOpenTooltip] = useState(false);

  const inPersonStatus = useMemo(
    () => appointment && encounter && getInPersonVisitStatus(appointment, encounter),
    [appointment, encounter]
  );
  const appointmentAccessibility = useGetAppointmentAccessibility();

  const [faxNumber, setFaxNumber] = useState(initialFaxNumber ?? '');
  const [faxError, setFaxError] = useState(false);
  // Once the user types a number, a late-arriving prefill must not overwrite it — the user could
  // miss the swap and fax PHI to the prefilled number instead of the one they entered.
  const userEditedFaxNumber = useRef(false);

  useEffect(() => {
    if (initialFaxNumber && !userEditedFaxNumber.current) {
      setFaxNumber(initialFaxNumber);
    }
  }, [initialFaxNumber]);

  const errorMessage = useMemo(() => {
    // The signed-note gating only applies to the default visit-note fax; a custom onSend opts out.
    if (onSend) {
      return null;
    }
    if (
      appointmentAccessibility.visitType === 'follow-up'
        ? encounter?.status === 'in-progress'
        : inPersonStatus && !['intake', 'completed'].includes(inPersonStatus)
    ) {
      return "Once the visit note has been signed, you will have the option to fax a copy to the patient's Primary Care Physician.";
    }
    return null;
  }, [onSend, appointmentAccessibility.visitType, encounter?.status, inPersonStatus]);

  const handleSendFax = async (): Promise<void> => {
    if (faxError) {
      enqueueSnackbar('Please enter a valid fax number.', { variant: 'error' });
      return;
    }

    if (onSend) {
      try {
        await onSend(faxNumber);
        enqueueSnackbar('Fax sent.', { variant: 'success' });
      } catch (error) {
        console.error('Error sending fax:', error);
        enqueueSnackbar('Error sending fax.', { variant: 'error' });
      }
      return;
    }

    if (!appointment?.id) {
      enqueueSnackbar('Error sending fax.', { variant: 'error' });
      return;
    }
    // useSendFax reports success and failure; swallow the rejection so the dialog can close.
    await sendFax({
      target: { type: 'visit-note', appointmentId: appointment.id },
      recipients: [{ faxNumber }],
    }).catch(() => undefined);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <Tooltip
        placement="top"
        open={openTooltip && errorMessage !== null}
        onClose={() => setOpenTooltip(false)}
        onOpen={() => setOpenTooltip(true)}
        title={<Typography>{errorMessage !== null && errorMessage}</Typography>}
      >
        <Box>
          <ConfirmationDialog
            title="Send Fax"
            description={
              <FaxNumberField
                id="fax-number"
                label="Fax number"
                fullWidth
                required
                value={faxNumber}
                error={faxError}
                helperText={faxError ? FAX_NUMBER_HELPER_TEXT : ' '}
                sx={{ mt: 2 }}
                onChange={(digits) => {
                  userEditedFaxNumber.current = true;
                  setFaxNumber(digits);
                  setFaxError(!isFaxNumberValid(digits));
                }}
              />
            }
            response={handleSendFax}
            actionButtons={{
              proceed: {
                text: 'Send',
                disabled: faxNumber === '' || faxError,
              },
              back: { text: 'Cancel' },
              reverse: true,
            }}
          >
            {(showDialog) => (
              <RoundedButton
                disabled={errorMessage !== null}
                variant="outlined"
                onClick={showDialog}
                startIcon={<FaxOutlinedIcon color="inherit" />}
                data-testid={dataTestIds.progressNotePage.sendFaxButton}
              >
                Send Fax
              </RoundedButton>
            )}
          </ConfirmationDialog>
        </Box>
      </Tooltip>
    </Box>
  );
};

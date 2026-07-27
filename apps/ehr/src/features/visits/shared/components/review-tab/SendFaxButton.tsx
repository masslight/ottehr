import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import { Box, FormControl, FormHelperText, InputLabel, OutlinedInput, Tooltip, Typography } from '@mui/material';
import { Appointment, Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { phone } from 'phone';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InputMask } from 'ui-components';
import { getInPersonVisitStatus, isPhoneNumberValid } from 'utils';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';

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
  const apiClient = useOystehrAPIClient();
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

    try {
      if (onSend) {
        await onSend(faxNumber);
      } else {
        if (!apiClient || !appointment?.id) {
          throw new Error('api client not defined or appointment ID is missing');
        }
        await apiClient.sendFax({ appointmentId: appointment.id, faxNumber });
      }
      enqueueSnackbar('Fax sent.', { variant: 'success' });
    } catch (error: any) {
      console.error('Error sending fax:', error);
      enqueueSnackbar('Error sending fax.', { variant: 'error' });
    }
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
              <FormControl variant="outlined" fullWidth error={faxError} sx={{ mt: 2, mb: -2 }}>
                <InputLabel shrink required htmlFor="fax-number">
                  Fax number
                </InputLabel>
                <OutlinedInput
                  id="fax-number"
                  label="Fax number"
                  notched
                  required
                  type="tel"
                  placeholder="(XXX) XXX-XXXX"
                  value={faxNumber}
                  inputMode="numeric"
                  inputComponent={InputMask as any}
                  inputProps={{
                    mask: '(000) 000-0000',
                  }}
                  onChange={(e) => {
                    userEditedFaxNumber.current = true;
                    const number = e.target.value.replace(/\D/g, '');
                    setFaxNumber(number);
                    if (isPhoneNumberValid(number) && phone(number).isValid) {
                      setFaxError(false);
                    } else {
                      setFaxError(true);
                    }
                  }}
                />
                <FormHelperText error sx={{ visibility: faxError ? 'visible' : 'hidden' }}>
                  Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number
                </FormHelperText>
              </FormControl>
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

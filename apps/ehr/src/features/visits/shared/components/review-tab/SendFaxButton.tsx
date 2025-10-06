import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import { Box, FormControl, FormHelperText, InputLabel, OutlinedInput, Tooltip, Typography } from '@mui/material';
import { Appointment, Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { phone } from 'phone';
import { FC, useMemo, useState } from 'react';
import InputMask from 'src/components/InputMask';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getVisitStatus, isPhoneNumberValid, TelemedAppointmentStatusEnum } from 'utils';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';

interface SendFaxButtonProps {
  appointment?: Appointment;
  encounter?: Encounter;
  inPerson: boolean;
}

export const SendFaxButton: FC<SendFaxButtonProps> = ({ appointment, encounter, inPerson }: SendFaxButtonProps) => {
  const apiClient = useOystehrAPIClient();
  const [openTooltip, setOpenTooltip] = useState(false);

  const inPersonStatus = useMemo(
    () => appointment && encounter && getVisitStatus(appointment, encounter),
    [appointment, encounter]
  );
  const appointmentAccessibility = useGetAppointmentAccessibility();

  const [faxNumber, setFaxNumber] = useState('');
  const [faxError, setFaxError] = useState(false);

  const errorMessage = useMemo(() => {
    if (
      (inPerson && inPersonStatus && !['intake', 'completed'].includes(inPersonStatus)) ||
      appointmentAccessibility.status !== TelemedAppointmentStatusEnum.complete
    ) {
      return "Once the visit note has been signed, you will have the option to fax a copy to the patient's Primary Care Physician.";
    }
    return null;
  }, [inPerson, inPersonStatus, appointmentAccessibility.status]);

  const handleSendFax = async (): Promise<void> => {
    if (faxError) {
      enqueueSnackbar('Please enter a valid fax number.', { variant: 'error' });
      return;
    }

    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointment ID is missing');
    }

    try {
      await apiClient.sendFax({
        appointmentId: appointment.id,
        faxNumber,
      });
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

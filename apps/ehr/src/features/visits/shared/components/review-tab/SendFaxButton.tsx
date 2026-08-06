import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import { Box, FormControl, FormHelperText, InputLabel, OutlinedInput } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { phone } from 'phone';
import { FC, useEffect, useRef, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InputMask } from 'ui-components';
import { isPhoneNumberValid } from 'utils';
import { ConfirmationDialog } from '../../../../../components/ConfirmationDialog';
import { RoundedButton } from '../../../../../components/RoundedButton';

interface SendFaxButtonProps {
  /** Performs the send. Should throw on failure so the error snackbar is shown. */
  onSend: (faxNumber: string) => Promise<void>;
  /** Optional prefill (10 digits); synced into the field if it resolves asynchronously. */
  initialFaxNumber?: string;
}

/**
 * Single-number fax button used by the radiology order flow.
 *
 * Visit documents are faxed from the encounter header ("Fax Documents") instead — see `features/fax`.
 */
export const SendFaxButton: FC<SendFaxButtonProps> = ({ onSend, initialFaxNumber }) => {
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

  const handleSendFax = async (): Promise<void> => {
    if (faxError) {
      enqueueSnackbar('Please enter a valid fax number.', { variant: 'error' });
      return;
    }

    try {
      await onSend(faxNumber);
      enqueueSnackbar('Fax sent.', { variant: 'success' });
    } catch (error: any) {
      console.error('Error sending fax:', error);
      enqueueSnackbar('Error sending fax.', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'end' }}>
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
  );
};

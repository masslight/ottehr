import FaxOutlinedIcon from '@mui/icons-material/FaxOutlined';
import { Box, FormControl, FormHelperText, InputLabel, OutlinedInput } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { phone } from 'phone';
import { FC, useEffect, useRef, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { InputMask } from 'ui-components/lib/components/InputMask';
import { isPhoneNumberValid } from 'utils/lib/helpers/helpers';
import { RoundedButton } from '../../../../../components/RoundedButton';

interface SendFaxButtonProps {
  /** Performs the send. Should throw on failure so the error snackbar is shown. */
  onSend: (faxNumber: string) => Promise<void>;
  /** Optional prefill (10 digits); synced into the field if it resolves asynchronously. */
  initialFaxNumber?: string;
}

/**
 * Single-number fax button used by the radiology and DME order flows.
 *
 * Visit documents are faxed from the encounter header ("Fax Documents") instead — see `features/fax`.
 */
export const SendFaxButton: FC<SendFaxButtonProps> = ({ onSend, initialFaxNumber }) => {
  const [faxNumber, setFaxNumber] = useState(initialFaxNumber ?? '');
  const [faxError, setFaxError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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
      <RoundedButton
        variant="outlined"
        onClick={() => setDialogOpen(true)}
        startIcon={<FaxOutlinedIcon color="inherit" />}
        data-testid={dataTestIds.progressNotePage.sendFaxButton}
      >
        Send Fax
      </RoundedButton>
      <AppDialog
        variant="form"
        size="s"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Send Fax"
        primary={{
          label: 'Send',
          // Closes whether or not the send succeeded, as before; the snackbar carries the result.
          onClick: async () => {
            await handleSendFax();
            setDialogOpen(false);
          },
          disabled: faxNumber === '' || faxError,
        }}
      >
        <FormControl variant="outlined" fullWidth error={faxError} sx={{ mt: 1 }}>
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
      </AppDialog>
    </Box>
  );
};

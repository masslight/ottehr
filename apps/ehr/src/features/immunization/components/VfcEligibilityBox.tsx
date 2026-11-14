import { LoadingButton } from '@mui/lab';
import { Box, Button, List, ListItemButton, ListItemText } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PopoverBlank, Sentence } from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { VfcEligibilityResponse } from 'utils/lib/types/api/vfc-eligibility';
import {
  VaccineFundingSource,
  VFC_ELIGIBILITY_CODES,
  VFC_ELIGIBILITY_LABELS,
  VfcEligibilityCode,
} from 'utils/lib/types/data/immunization/vfc';
import { DISPLAY_DATE_FORMAT } from 'utils/lib/utils/dateUtils';
import { useConfirmVfcEligibility, useVfcEligibility } from '../hooks/useVaccineInventory';

const ROUNDED_BUTTON_SX = { textTransform: 'none', borderRadius: 20 } as const;

/** The category the line shows: the confirmed one, else what the paperwork says. */
export const shownVfcEligibility = (data: VfcEligibilityResponse | undefined): VfcEligibilityCode | undefined =>
  data?.confirmed?.code ?? data?.derived?.code;

/** A dose given from VFC stock while the visit's VFC eligibility is not confirmed: staff are asked first. */
export const needsVfcConfirmation = (
  data: VfcEligibilityResponse | undefined,
  fundingSource: VaccineFundingSource | undefined
): boolean => !!data?.applies && !data.confirmed && fundingSource === 'vfc';

/** Confirms a category for the visit; a failure is shown and resolves false. */
const useConfirm = (
  encounterId: string | undefined
): { confirm: (code: VfcEligibilityCode) => Promise<boolean>; isPending: boolean } => {
  const { mutateAsync, isPending } = useConfirmVfcEligibility(encounterId);
  const confirm = async (code: VfcEligibilityCode): Promise<boolean> => {
    try {
      await mutateAsync(code);
      enqueueSnackbar(`VFC eligibility confirmed: ${VFC_ELIGIBILITY_LABELS[code].short}`, { variant: 'success' });
      return true;
    } catch (error) {
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to confirm VFC eligibility' }), { variant: 'error' });
      return false;
    }
  };
  return { confirm, isPending };
};

interface VfcEligibilityBoxProps {
  encounterId: string | undefined;
  readOnly?: boolean;
}

/**
 * "VFC eligibility confirmation [category]." Pre-filled with what the paperwork says and confirmed with one click;
 * picking a category confirms it. Shown only for patients 18 and younger.
 */
export const VfcEligibilityBox: FC<VfcEligibilityBoxProps> = ({ encounterId, readOnly = false }) => {
  const { data } = useVfcEligibility(encounterId);
  const { confirm, isPending } = useConfirm(encounterId);

  if (!data?.applies) return null;
  const { confirmed } = data;
  const code = shownVfcEligibility(data);

  return (
    <Sentence dataTestId={dataTestIds.vfcEligibility.box}>
      VFC eligibility confirmation{' '}
      <PopoverBlank
        label="category"
        title="VFC eligibility"
        hideTitle
        value={code && VFC_ELIGIBILITY_LABELS[code].long}
        need
        readOnly={readOnly}
        dataTestId={dataTestIds.vfcEligibility.blank}
      >
        {(close) => (
          <List dense disablePadding role="listbox" aria-label="VFC eligibility">
            {VFC_ELIGIBILITY_CODES.map((option) => (
              <ListItemButton
                key={option}
                role="option"
                selected={option === code}
                aria-selected={option === code}
                onClick={() => {
                  close();
                  void confirm(option);
                }}
              >
                <ListItemText primary={VFC_ELIGIBILITY_LABELS[option].long} />
              </ListItemButton>
            ))}
          </List>
        )}
      </PopoverBlank>
      .
      {confirmed ? (
        <Box
          component="span"
          sx={{ ml: 1, fontSize: 14, color: 'text.secondary' }}
          data-testid={dataTestIds.vfcEligibility.confirmed}
        >
          Confirmed {DateTime.fromISO(confirmed.confirmedAt).toLocal().toFormat(`${DISPLAY_DATE_FORMAT} hh:mm a`)}
          {confirmed.confirmedBy ? ` · ${confirmed.confirmedBy}` : ''}
        </Box>
      ) : (
        code &&
        !readOnly && (
          <LoadingButton
            variant="contained"
            size="small"
            loading={isPending}
            onClick={() => void confirm(code)}
            sx={{ ...ROUNDED_BUTTON_SX, ml: 1 }}
            data-testid={dataTestIds.vfcEligibility.confirmButton}
          >
            Confirm
          </LoadingButton>
        )
      )}
    </Sentence>
  );
};

interface VfcUnconfirmedDialogProps {
  open: boolean;
  encounterId: string | undefined;
  patientFirstName: string | undefined;
  onClose: () => void;
  /** Goes on to save the dose. */
  onContinue: () => void;
}

/** Asked before a dose from VFC stock is saved as given while the visit's VFC eligibility is not confirmed. */
export const VfcUnconfirmedDialog: FC<VfcUnconfirmedDialogProps> = ({
  open,
  encounterId,
  patientFirstName,
  onClose,
  onContinue,
}) => {
  const derived = useVfcEligibility(encounterId).data?.derived?.code;
  const { confirm, isPending } = useConfirm(encounterId);
  const who = patientFirstName || 'The patient';

  return (
    <CustomDialog
      open={open}
      handleClose={onClose}
      title="VFC eligibility isn't confirmed"
      description={`${who} is getting VFC stock, but VFC eligibility hasn't been confirmed for this visit.${
        derived ? '' : ' Pick a category at the top.'
      }`}
      dataTestId={dataTestIds.vfcEligibility.unconfirmedDialog}
      maxWidth="xs"
      fullWidth
      actions={
        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
          {derived && (
            <LoadingButton
              variant="contained"
              loading={isPending}
              onClick={async () => {
                if (await confirm(derived)) onContinue();
              }}
              sx={ROUNDED_BUTTON_SX}
              data-testid={dataTestIds.dialog.proceedButton}
            >
              Confirm and continue
            </LoadingButton>
          )}
          <Button
            variant={derived ? 'text' : 'contained'}
            onClick={onContinue}
            sx={ROUNDED_BUTTON_SX}
            data-testid={dataTestIds.vfcEligibility.continueButton}
          >
            Continue
          </Button>
        </Box>
      }
    />
  );
};

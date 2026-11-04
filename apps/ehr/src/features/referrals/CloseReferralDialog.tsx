import { LoadingButton } from '@mui/lab';
import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  REFERRAL_CLOSE_REASON_LABELS,
  REFERRAL_CLOSE_REASONS,
  ReferralCloseReason,
} from 'utils/lib/types/api/referrals/referrals.types';
import { useUpdateReferralStatusMutation } from './referrals.queries';

interface CloseReferralDialogProps {
  referralId: string;
  onClose: () => void;
}

/** Closes a referral with a reason and an optional one-line outcome (requirements item 14). */
export const CloseReferralDialog: FC<CloseReferralDialogProps> = ({ referralId, onClose }) => {
  const [reason, setReason] = useState<ReferralCloseReason | ''>('');
  const [outcome, setOutcome] = useState('');
  const { mutateAsync, isPending } = useUpdateReferralStatusMutation();

  const confirm = async (): Promise<void> => {
    if (!reason) return;
    try {
      await mutateAsync({ action: 'close', referralId, reason, outcome: outcome.trim() || undefined });
      onClose();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to close the referral. Please try again.', { variant: 'error' });
    }
  };

  return (
    <CustomDialog
      open
      handleClose={onClose}
      title="Close referral"
      maxWidth="xs"
      fullWidth
      dataTestId={dataTestIds.referrals.closeDialog}
      description={
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            size="small"
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as ReferralCloseReason)}
            data-testid={dataTestIds.referrals.closeReason}
          >
            {REFERRAL_CLOSE_REASONS.map((option) => (
              <MenuItem key={option} value={option}>
                {REFERRAL_CLOSE_REASON_LABELS[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Outcome (optional)"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            inputProps={{ maxLength: 500, 'data-testid': dataTestIds.referrals.closeOutcome }}
          />
        </Stack>
      }
      actions={
        <>
          <Button onClick={onClose} disabled={isPending} sx={{ borderRadius: 100, textTransform: 'none' }}>
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={confirm}
            loading={isPending}
            disabled={!reason}
            sx={{ borderRadius: 100, textTransform: 'none' }}
            data-testid={dataTestIds.referrals.closeConfirmButton}
          >
            Close referral
          </LoadingButton>
        </>
      }
    />
  );
};

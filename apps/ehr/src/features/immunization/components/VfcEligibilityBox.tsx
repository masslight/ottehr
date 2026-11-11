import { otherColors } from '@ehrTheme/colors';
import { LoadingButton } from '@mui/lab';
import { Alert, Box, Button, Chip, MenuItem, Paper, Select, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  VFC_ELIGIBILITY_CODES,
  VFC_ELIGIBILITY_LABELS,
  VfcEligibilityCode,
} from 'utils/lib/types/data/immunization/vfc';
import { DISPLAY_DATE_FORMAT } from 'utils/lib/utils/dateUtils';
import { useConfirmVfcEligibility, useVfcEligibility } from '../hooks/useVaccineInventory';

interface VfcEligibilityBoxProps {
  encounterId: string | undefined;
  /** `card`: its own paper on Visit Details. `strip`: a line above the order screen's immunizations. */
  variant: 'card' | 'strip';
  readOnly?: boolean;
}

const NOTES: Partial<Record<VfcEligibilityCode, { severity: 'warning' | 'info'; text: string }>> = {
  V05: {
    severity: 'warning',
    text: 'Underinsured children can get VFC vaccine only at an FQHC, a rural health clinic or a deputized location. Elsewhere, use private stock or refer the family. You can still save.',
  },
  V04: {
    severity: 'info',
    text: 'American Indian / Alaska Native children are VFC eligible in any circumstance, even with private insurance.',
  },
};

/**
 * The visit's VFC eligibility, confirmed with one click: what the paperwork says is offered, staff can pick
 * another category, and the confirmation is saved with the visit. Shown only for patients 18 and younger.
 */
export const VfcEligibilityBox: FC<VfcEligibilityBoxProps> = ({ encounterId, variant, readOnly }) => {
  const { data, isLoading } = useVfcEligibility(encounterId);
  const { mutateAsync: confirm, isPending } = useConfirmVfcEligibility(encounterId);
  const [picked, setPicked] = useState<VfcEligibilityCode | ''>('');
  const [changing, setChanging] = useState(false);

  if (isLoading || !data || !data.applies) return null;
  const { derived, confirmed } = data;
  const code: VfcEligibilityCode | '' = picked || (changing ? confirmed?.code ?? '' : derived?.code ?? '');
  const showConfirm = !confirmed || changing;

  const onConfirm = async (): Promise<void> => {
    if (!code) return;
    try {
      await confirm(code);
      setChanging(false);
      setPicked('');
      enqueueSnackbar(`VFC eligibility confirmed: ${VFC_ELIGIBILITY_LABELS[code].short}`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to confirm VFC eligibility' }), { variant: 'error' });
    }
  };

  const confirmedLine = confirmed && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Chip
        size="small"
        label="Confirmed"
        sx={{
          height: 20,
          fontSize: 12,
          bgcolor: otherColors.employeeActiveChip,
          color: otherColors.employeeActiveText,
        }}
      />
      <Typography variant="body2" fontWeight={700} data-testid={dataTestIds.vfcEligibility.confirmed}>
        VFC: {VFC_ELIGIBILITY_LABELS[confirmed.code].short} ({confirmed.code})
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {DateTime.fromISO(confirmed.confirmedAt).toLocal().toFormat(`${DISPLAY_DATE_FORMAT} hh:mm a`)}
        {confirmed.confirmedBy ? ` · ${confirmed.confirmedBy}` : ''}
      </Typography>
      {!readOnly && !changing && (
        <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setChanging(true)}>
          Change
        </Button>
      )}
    </Box>
  );

  const confirmLine = showConfirm && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {!confirmed && (
        <Chip
          size="small"
          label="Not confirmed"
          sx={{ height: 20, fontSize: 12, bgcolor: otherColors.warningBackground, color: otherColors.warningText }}
        />
      )}
      <Select
        size="small"
        value={code}
        displayEmpty
        disabled={readOnly || isPending}
        onChange={(event) => setPicked(event.target.value as VfcEligibilityCode)}
        inputProps={{ 'aria-label': 'VFC eligibility', 'data-testid': dataTestIds.vfcEligibility.select }}
        sx={{ minWidth: 280 }}
      >
        <MenuItem value="" disabled>
          <em>Pick the VFC eligibility</em>
        </MenuItem>
        {VFC_ELIGIBILITY_CODES.map((option) => (
          <MenuItem key={option} value={option}>
            {VFC_ELIGIBILITY_LABELS[option].long} ({option})
          </MenuItem>
        ))}
      </Select>
      <LoadingButton
        variant="contained"
        size="small"
        loading={isPending}
        disabled={!code || readOnly}
        onClick={() => void onConfirm()}
        sx={{ textTransform: 'none', borderRadius: 20 }}
        data-testid={dataTestIds.vfcEligibility.confirmButton}
      >
        Confirm
      </LoadingButton>
      {changing && (
        <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setChanging(false)}>
          Cancel
        </Button>
      )}
    </Box>
  );

  const why = showConfirm && (
    <Typography variant="body2" color="text.secondary">
      {derived
        ? `From today's paperwork: ${derived.why}`
        : 'The paperwork does not say yet: pick the category that applies.'}
    </Typography>
  );
  const note = code ? NOTES[code] : undefined;

  const body = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={dataTestIds.vfcEligibility.box}>
      {confirmedLine}
      {confirmLine}
      {why}
      {note && (
        <Alert severity={note.severity} sx={{ py: 0 }}>
          {note.text}
        </Alert>
      )}
    </Box>
  );

  if (variant === 'strip') {
    return (
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderRadius: 1,
          bgcolor: confirmed && !changing ? otherColors.lightGreen : otherColors.warningBackground,
        }}
      >
        {!confirmed && (
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            VFC eligibility was not confirmed at check-in. Confirm before vaccinating; the lot list uses it.
          </Typography>
        )}
        {body}
      </Box>
    );
  }
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" color="primary.dark" sx={{ mb: 0.5 }}>
        VFC eligibility
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Screened before vaccinating, every immunization visit.
      </Typography>
      {body}
    </Paper>
  );
};

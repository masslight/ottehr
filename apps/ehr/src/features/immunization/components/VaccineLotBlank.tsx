import { otherColors } from '@ehrTheme/colors';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { formatQuantity } from 'src/features/admin/inventory/inventory.helpers';
import { PopoverBlank } from 'src/features/visits/in-person/components/procedures/narrative/InlineBlanks';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import {
  isVfcBorrowing,
  sortVaccineLotsForPatient,
  VACCINE_FUNDING_SOURCE_LABELS,
  VaccineFundingSource,
  VFC_BORROWING_REASONS,
  VFC_ELIGIBILITY_LABELS,
  VfcEligibilityCode,
} from 'utils/lib/types/data/immunization/vfc';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';

const FUNDING_CHIP_SX: Record<VaccineFundingSource, { bgcolor: string; color: string }> = {
  vfc: { bgcolor: otherColors.infoAlert, color: otherColors.infoText },
  private: { bgcolor: otherColors.cardChip, color: 'text.primary' },
  state: { bgcolor: otherColors.infoAlert, color: otherColors.infoText },
};

/** The small VFC / Private / State program tag a lot carries. */
export const FundingChip: FC<{ fundingSource: VaccineFundingSource | undefined }> = ({ fundingSource }) => (
  <Chip
    size="small"
    label={VACCINE_FUNDING_SOURCE_LABELS[fundingSource ?? 'private']}
    sx={{ height: 20, fontSize: 12, ...FUNDING_CHIP_SX[fundingSource ?? 'private'] }}
  />
);

interface VaccineLotBlankProps {
  /** The vaccine's lots on hand at the visit's location. */
  lots: InventoryLot[];
  value: string | undefined;
  /** The patient's VFC eligibility, when known: the matching stock lists first. */
  vfcEligibility: VfcEligibilityCode | undefined;
  patientFirstName?: string;
  readOnly: boolean;
  need?: boolean;
  /** A lot picked from stock, with the borrowing reason when it is the other stock. */
  onPick: (lot: InventoryLot, borrowingReason: string | undefined) => void;
  /** A lot typed by hand: saved as typed, nothing comes off stock. */
  onType: (lotNumber: string) => void;
  dataTestId?: string;
}

/**
 * The Lot blank when the vaccine is tracked: the lots on hand, the patient's stock first (VFC lots for a
 * VFC-eligible child, private otherwise). Picking the other stock asks for the borrowing reason and goes on
 * the borrowing log; it is never blocked. An expired lot lists last and asks before it is used. A lot not listed can
 * still be typed.
 */
export const VaccineLotBlank: FC<VaccineLotBlankProps> = ({
  lots,
  value,
  vfcEligibility,
  patientFirstName,
  readOnly,
  need,
  onPick,
  onType,
  dataTestId,
}) => {
  const [pending, setPending] = useState<InventoryLot | undefined>(undefined);
  const [expiredPending, setExpiredPending] = useState<InventoryLot | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const options = sortVaccineLotsForPatient(lots, vfcEligibility, DateTime.now().toISODate());
  const who = patientFirstName || 'The patient';
  const eligibilityText = vfcEligibility
    ? VFC_ELIGIBILITY_LABELS[vfcEligibility].vfc
      ? `${who} is VFC eligible (${VFC_ELIGIBILITY_LABELS[vfcEligibility].short}): VFC lots first.`
      : `${who} is not VFC eligible: private lots first.`
    : 'VFC eligibility is not confirmed yet, so the lots are in expiration order. Confirm it before using VFC stock.';

  const pickLot = (lot: InventoryLot, close?: () => void): void => {
    if (isVfcBorrowing(lot.fundingSource ?? 'private', vfcEligibility)) {
      setPending(lot);
      setReason('');
      setNote('');
      setReasonError(false);
      return;
    }
    onPick(lot, undefined);
    close?.();
  };

  const choose = (lot: InventoryLot, expired: boolean, close: () => void): void => {
    if (expired) {
      setExpiredPending(lot);
      return;
    }
    pickLot(lot, close);
  };

  const confirmBorrowing = (): void => {
    if (!pending) return;
    if (!reason) {
      setReasonError(true);
      return;
    }
    onPick(pending, note.trim() ? `${reason}: ${note.trim()}` : reason);
    setPending(undefined);
  };

  const eligible = vfcEligibility ? VFC_ELIGIBILITY_LABELS[vfcEligibility].vfc : false;
  const borrowingTitle = eligible
    ? `Use a ${VACCINE_FUNDING_SOURCE_LABELS[
        pending?.fundingSource ?? 'private'
      ].toLowerCase()} lot for a VFC-eligible child?`
    : 'Use VFC stock for a patient who is not VFC eligible?';
  const borrowingBody = eligible
    ? `${who} is VFC eligible. Giving lot ${pending?.lotNumber} counts as borrowing: it goes on the Vaccine Borrowing Report, and the dose must be paid back from VFC stock.`
    : `${who} is not VFC eligible. VFC vaccine is only for eligible children, so this dose counts as borrowing: it goes on the Vaccine Borrowing Report and must be replaced with private stock.`;

  return (
    <>
      <PopoverBlank
        label="lot number"
        title="Lot"
        hideTitle
        paperSx={{ width: 'min(520px, calc(100vw - 32px))', maxWidth: 'min(520px, calc(100vw - 32px))' }}
        value={value || undefined}
        readOnly={readOnly}
        need={need}
        dataTestId={dataTestId}
      >
        {(close) => (
          <Box sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
              {eligibilityText}
            </Typography>
            <List dense role="listbox" aria-label="Lots on hand" sx={{ py: 0.5 }}>
              {options.map(({ lot, expired, matches }) => (
                <ListItemButton
                  key={lot.id}
                  role="option"
                  aria-selected={lot.lotNumber === value}
                  selected={lot.lotNumber === value}
                  onClick={() => choose(lot, expired, close)}
                  data-testid={dataTestIds.vaccineLotBlank.option(lot.id)}
                >
                  <ListItemText
                    primary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <b>Lot {lot.lotNumber}</b>
                        <FundingChip fundingSource={lot.fundingSource} />
                        {matches === true && (
                          <Chip
                            size="small"
                            label="Matches eligibility"
                            sx={{
                              height: 20,
                              fontSize: 12,
                              bgcolor: otherColors.employeeActiveChip,
                              color: otherColors.employeeActiveText,
                            }}
                          />
                        )}
                        {matches === false && (
                          <Chip size="small" label="Other stock" sx={{ height: 20, fontSize: 12 }} />
                        )}
                        {expired && (
                          <Chip
                            size="small"
                            label="Expired"
                            sx={{
                              height: 20,
                              fontSize: 12,
                              bgcolor: otherColors.lightErrorBg,
                              color: otherColors.lightErrorText,
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={[
                      formatQuantity(lot.onHand, lot.unit),
                      `exp ${formatDateForDisplay(lot.expirationDate)}`,
                      lot.manufacturer,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </ListItemButton>
              ))}
            </List>
            <TextField
              size="small"
              fullWidth
              label="Or type a lot that isn't listed"
              helperText="Saved as typed; nothing comes off stock."
              defaultValue={value && !lots.some((lot) => lot.lotNumber === value) ? value : ''}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onType((event.target as HTMLInputElement).value.trim());
                  close();
                }
              }}
              onBlur={(event) => {
                const typed = event.target.value.trim();
                if (typed && typed !== value) onType(typed);
              }}
              inputProps={{ 'data-testid': dataTestIds.vaccineLotBlank.typedLot }}
              sx={{ mt: 1 }}
            />
          </Box>
        )}
      </PopoverBlank>

      <Dialog open={!!expiredPending} onClose={() => setExpiredPending(undefined)} maxWidth="xs" fullWidth>
        <DialogTitle>Use an expired lot?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Lot {expiredPending?.lotNumber} expired on {formatDateForDisplay(expiredPending?.expirationDate)}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpiredPending(undefined)} sx={{ textTransform: 'none' }}>
            Pick another lot
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const lot = expiredPending;
              setExpiredPending(undefined);
              if (lot) pickLot(lot);
            }}
            sx={{ textTransform: 'none' }}
            data-testid={dataTestIds.vaccineLotBlank.useExpiredLot}
          >
            Use this lot
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pending} onClose={() => setPending(undefined)} maxWidth="sm" fullWidth>
        <DialogTitle>{borrowingTitle}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2">{borrowingBody}</Typography>
          <Box>
            <Select
              size="small"
              fullWidth
              displayEmpty
              value={reason}
              error={reasonError}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(false);
              }}
              inputProps={{
                'aria-label': 'Borrowing reason',
                'data-testid': dataTestIds.vaccineLotBlank.borrowingReason,
              }}
            >
              <MenuItem value="" disabled>
                <em>Borrowing reason</em>
              </MenuItem>
              {VFC_BORROWING_REASONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {reasonError && <FormHelperText error>Choose a reason for the borrowing report.</FormHelperText>}
          </Box>
          <TextField
            size="small"
            label="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            inputProps={{ maxLength: 200 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(undefined)} sx={{ textTransform: 'none' }}>
            Pick another lot
          </Button>
          <Button
            variant="contained"
            onClick={confirmBorrowing}
            sx={{ textTransform: 'none' }}
            data-testid={dataTestIds.vaccineLotBlank.useBorrowedLot}
          >
            Use this lot
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

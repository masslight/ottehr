import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import {
  DRUG_UNIT_CODES,
  DrugUnitCode,
  formatNdcForDisplay,
  NDC_REGEX,
  ndcToDigits,
} from 'utils/lib/types/data/billing/billing.constants';

/** Medication detail carried on a service line row (NDC as 11 plain digits). */
export interface ServiceLineDrug {
  ndc: string;
  quantity: string;
  units: DrugUnitCode;
}

interface MedicationDetailDialogProps {
  open: boolean;
  value: ServiceLineDrug | null;
  onSave: (drug: ServiceLineDrug) => void;
  onRemove?: () => void;
  onClose: () => void;
  saving?: boolean;
}

/**
 * Small dialog to attach an NDC drug code + dosage to a service line. Only the 11-digit 5-4-2 NDC
 * layout is supported: the input takes digits and is dashed as 5-4-2 while typing, and the NDC is
 * saved as 11 plain digits.
 */
export function MedicationDetailDialog({
  open,
  value,
  onSave,
  onRemove,
  onClose,
  saving = false,
}: MedicationDetailDialogProps): ReactElement {
  const [ndc, setNdc] = useState('');
  const [ndcTouched, setNdcTouched] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [units, setUnits] = useState<DrugUnitCode>('UN');

  useEffect(() => {
    if (!open) return;
    setNdc(value?.ndc ? formatNdcForDisplay(value.ndc) : '');
    setNdcTouched(false);
    setQuantity(value?.quantity ?? '');
    setUnits(value?.units ?? 'UN');
  }, [open, value]);

  const handleNdcChange = (raw: string): void => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    setNdc([digits.slice(0, 5), digits.slice(5, 9), digits.slice(9)].filter(Boolean).join('-'));
  };

  const ndcValid = NDC_REGEX.test(ndc);
  const ndcError = ndcTouched && ndc.length > 0 && !ndcValid;
  const ndcHelperText = ndcError ? 'Must be 11 digits in 5-4-2 format' : '11 digits, 5-4-2 format (e.g. 12345-6789-01)';
  const quantityValid = Number(quantity) > 0;
  const canSave = ndcValid && quantityValid;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Medication Detail</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            size="small"
            label="NDC Code"
            value={ndc}
            onChange={(e) => handleNdcChange(e.target.value)}
            onBlur={() => setNdcTouched(true)}
            inputProps={{ maxLength: 13, inputMode: 'numeric' }}
            placeholder="12345-6789-01"
            helperText={ndcHelperText}
            error={ndcError}
            autoFocus
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              label="Dosage"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={quantity !== '' && !quantityValid}
              sx={{ width: 140 }}
            />
            <TextField
              select
              size="small"
              label="Units"
              value={units}
              onChange={(e) => setUnits(e.target.value as DrugUnitCode)}
              SelectProps={{ renderValue: (v) => v as string }}
              fullWidth
            >
              {DRUG_UNIT_CODES.map((u) => (
                <MenuItem key={u.code} value={u.code}>
                  <Box>
                    <Typography variant="body2">
                      {u.code} — {u.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        {onRemove && (
          <Button size="small" color="error" onClick={onRemove} disabled={saving} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button size="small" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!canSave || saving}
          onClick={() => onSave({ ndc: ndcToDigits(ndc), quantity, units })}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

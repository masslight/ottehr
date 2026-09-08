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
import { DRUG_UNIT_CODES, DrugUnitCode, NDC_REGEX, normalizeNdc } from 'utils/lib/types/data/billing/billing.constants';

/** Medication detail carried on a service line row (NDC already dashed). */
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
}

/**
 * Small dialog to attach an NDC drug code + dosage to a service line. The NDC accepts 10, 11, or
 * 12 digits, dashes optional; when dashes are present they must match a valid layout
 * (10 → 4-4-2 / 5-3-2 / 5-4-1, 11 → 5-4-2, 12 → 6-4-2). The input is never re-dashed while
 * typing; an undashed entry gets the default layout for its length on save (10 → 4-4-2).
 */
export function MedicationDetailDialog({
  open,
  value,
  onSave,
  onRemove,
  onClose,
}: MedicationDetailDialogProps): ReactElement {
  const [ndc, setNdc] = useState('');
  const [ndcTouched, setNdcTouched] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [units, setUnits] = useState<DrugUnitCode>('UN');

  useEffect(() => {
    if (!open) return;
    setNdc(value?.ndc ?? '');
    setNdcTouched(false);
    setQuantity(value?.quantity ?? '');
    setUnits(value?.units ?? 'UN');
  }, [open, value]);

  const handleNdcChange = (raw: string): void => {
    let dashes = 0;
    const next = raw
      .replace(/[^0-9-]/g, '')
      .split('')
      .filter((c) => c !== '-' || ++dashes <= 2)
      .join('');
    setNdc(next.slice(0, 14));
  };

  const ndcValid = NDC_REGEX.test(ndc);
  const ndcError = ndcTouched && ndc.length > 0 && !ndcValid;
  const ndcHelperText = ndcError ? 'Must be a 10, 11 or 12 digits number' : '10, 11 or 12 digits number';
  const quantityValid = Number(quantity) > 0;
  const canSave = ndcValid && quantityValid;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Medication Detail</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            size="small"
            label="NDC Code"
            value={ndc}
            onChange={(e) => handleNdcChange(e.target.value)}
            onBlur={() => setNdcTouched(true)}
            inputProps={{ maxLength: 14 }}
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
          <Button size="small" color="error" onClick={onRemove} sx={{ mr: 'auto' }}>
            Remove
          </Button>
        )}
        <Button size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!canSave}
          onClick={() => onSave({ ndc: normalizeNdc(ndc), quantity, units })}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

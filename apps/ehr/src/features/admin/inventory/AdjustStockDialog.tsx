import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { adjustMedicationInventory } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  INVENTORY_ADJUSTMENT_REASONS,
  INVENTORY_ENTRY_REASON_LABELS,
  InventoryAdjustmentReason,
  InventoryDrugRow,
  InventoryLotRow,
} from 'utils/lib/types/api/config/in-house-medications';
import { formatOnHand, unitLabel } from './inventory.helpers';

interface AdjustStockDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  drug: InventoryDrugRow;
  lot: InventoryLotRow;
  clinicName: string;
}

const buttonSx = { textTransform: 'none', borderRadius: 50, fontWeight: 'bold' };
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Adjust a lot up or down with a reason (requirement 6). */
export default function AdjustStockDialog({
  open,
  onClose,
  onSaved,
  drug,
  lot,
  clinicName,
}: AdjustStockDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [direction, setDirection] = useState<'remove' | 'add'>('remove');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<InventoryAdjustmentReason | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const count = Number(quantity);
  const units = capitalize(unitLabel(lot.unit, count > 0 ? count : 2));
  const actionLabel = direction === 'remove' ? 'Remove' : 'Add';
  const submitLabel = count > 0 ? `${actionLabel} ${count} ${units}` : `${actionLabel} ${units}`;

  const save = async (): Promise<void> => {
    if (!oystehrZambda || !reason) return;
    setSaving(true);
    try {
      await adjustMedicationInventory(oystehrZambda, {
        action: 'adjust',
        lotId: lot.id,
        direction,
        quantity: count,
        reason,
        note: note.trim() || undefined,
      });
      enqueueSnackbar(
        `${actionLabel === 'Remove' ? 'Removed' : 'Added'} ${formatOnHand(count, lot.unit)} of ${drug.name}`,
        {
          variant: 'success',
        }
      );
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error adjusting stock', error);
      enqueueSnackbar('Failed to adjust stock', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <DialogTitle component="div">
          <Typography variant="h5" color="primary.dark">
            Adjust stock
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {drug.name} · Lot {lot.lotNumber} · {clinicName} · {formatOnHand(lot.onHand, lot.unit)} on hand
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <FormControl>
            <FormLabel id="adjust-direction-label">Direction</FormLabel>
            <RadioGroup
              row
              aria-labelledby="adjust-direction-label"
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'remove' | 'add')}
            >
              <FormControlLabel value="remove" control={<Radio size="small" />} label="Remove" />
              <FormControlLabel value="add" control={<Radio size="small" />} label="Add" />
            </RadioGroup>
          </FormControl>
          <TextField
            required
            label={`Quantity (${unitLabel(lot.unit, 2)})`}
            type="number"
            inputProps={{ min: 1, step: 1 }}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            sx={{ width: 160 }}
          />
          <FormControl fullWidth required>
            <InputLabel id="adjust-reason-label">Reason</InputLabel>
            <Select
              labelId="adjust-reason-label"
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as InventoryAdjustmentReason)}
            >
              {INVENTORY_ADJUSTMENT_REASONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {INVENTORY_ENTRY_REASON_LABELS[option]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {reason === 'other' ? (
            <TextField
              required
              fullWidth
              label="What happened"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={onClose} sx={buttonSx}>
            Cancel
          </Button>
          <LoadingButton type="submit" variant="contained" loading={saving} sx={buttonSx}>
            {submitLabel}
          </LoadingButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

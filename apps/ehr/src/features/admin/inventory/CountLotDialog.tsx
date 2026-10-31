import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { adjustMedicationInventory } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { InventoryDrugRow, InventoryLotRow } from 'utils/lib/types/api/config/in-house-medications';
import { formatChange, formatOnHand, unitLabel } from './inventory.helpers';

interface CountLotDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  drug: InventoryDrugRow;
  lot: InventoryLotRow;
  locationName: string;
}

const buttonSx = { textTransform: 'none', borderRadius: 50, fontWeight: 'bold' };
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Count what is on the shelf; the difference from what Ottehr expects is recorded (requirement 6). */
export default function CountLotDialog({
  open,
  onClose,
  onSaved,
  drug,
  lot,
  locationName,
}: CountLotDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [counted, setCounted] = useState('');
  const [saving, setSaving] = useState(false);

  const count = counted.trim() === '' ? undefined : Number(counted);
  const difference = count === undefined ? undefined : count - lot.onHand;

  const save = async (): Promise<void> => {
    if (!oystehrZambda || count === undefined) return;
    setSaving(true);
    try {
      await adjustMedicationInventory(oystehrZambda, { action: 'count', lotId: lot.id, counted: count });
      enqueueSnackbar(
        difference === 0
          ? `Counted lot ${lot.lotNumber}: no difference`
          : `Counted lot ${lot.lotNumber}: recorded ${formatChange(difference ?? 0, lot.unit)}`,
        { variant: 'success' }
      );
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving count', error);
      enqueueSnackbar('Failed to save count', { variant: 'error' });
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
            Count lot
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {drug.name} · Lot {lot.lotNumber} · {locationName}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            required
            label={`${capitalize(unitLabel(lot.unit, 2))} on the shelf`}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            sx={{ width: 160 }}
          />
          <Typography>
            Ottehr expects <b style={{ fontWeight: 500 }}>{formatOnHand(lot.onHand, lot.unit)}</b>.
            {difference === undefined ? null : difference === 0 ? (
              <> Saving records &quot;no difference&quot;.</>
            ) : (
              <>
                {' '}
                Saving records <b style={{ fontWeight: 500 }}>{formatChange(difference, lot.unit)}</b> as &quot;Count
                adjustment&quot;.
              </>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            If the count matches, it&apos;s recorded as &quot;no difference&quot;. Multi-use items are counted as
            containers.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={onClose} sx={buttonSx}>
            Cancel
          </Button>
          <LoadingButton type="submit" variant="contained" loading={saving} sx={buttonSx}>
            Save Count
          </LoadingButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

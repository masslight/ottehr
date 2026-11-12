import { Box, capitalize, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useRef, useState } from 'react';
import { adjustMedicationInventory } from 'src/api/api';
import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { useApiClients } from 'src/hooks/useAppClients';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { InventoryDrugRow, InventoryLotRow } from 'utils/lib/types/api/config/in-house-medications';
import { formatQuantity, unitLabel } from './inventory.helpers';

interface CountLotDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  drug: InventoryDrugRow;
  lot: InventoryLotRow;
  locationName: string;
}

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
  const formRef = useRef<HTMLFormElement>(null);
  const [counted, setCounted] = useState('');
  const [saving, setSaving] = useState(false);

  const count = counted.trim() === '' ? undefined : Number(counted);
  const difference = count === undefined ? undefined : count - lot.onHand;

  const save = async (): Promise<void> => {
    if (!oystehrZambda || count === undefined) return;
    setSaving(true);
    try {
      const result = await adjustMedicationInventory(oystehrZambda, {
        action: 'count',
        lotId: lot.id,
        counted: count,
      });
      if (!('entry' in result)) throw new Error('expected a stock entry, got a borrowing row');
      const { entry } = result;
      enqueueSnackbar(
        entry.quantity === 0
          ? `Counted lot ${lot.lotNumber}: no difference`
          : `Counted lot ${lot.lotNumber}: recorded ${formatQuantity(entry.quantity, lot.unit, { signed: true })}`,
        { variant: 'success' }
      );
      onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving count', error);
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to save count' }), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomDialog
      open={open}
      handleClose={onClose}
      maxWidth="sm"
      fullWidth
      title="Count Lot"
      description={
        <Box
          component="form"
          ref={formRef}
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            void save();
          }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {drug.name} · Lot {lot.lotNumber} · {locationName}
          </Typography>
          <TextField
            required
            label={`${capitalize(unitLabel(lot.unit, 2))} on the Shelf`}
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            sx={{ width: 160 }}
          />
          <Typography>
            Ottehr expects <b style={{ fontWeight: 500 }}>{formatQuantity(lot.onHand, lot.unit)}</b>.
            {difference === undefined ? null : difference === 0 ? (
              <> Saving records &quot;no difference&quot;.</>
            ) : (
              <>
                {' '}
                Saving records{' '}
                <b style={{ fontWeight: 500 }}>{formatQuantity(difference, lot.unit, { signed: true })}</b> as
                &quot;Count adjustment&quot;.
              </>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            If the count matches, it&apos;s recorded as &quot;no difference&quot;. Multi-use items are counted as
            containers.
          </Typography>
        </Box>
      }
      handleConfirm={() => {
        if (formRef.current?.reportValidity()) void save();
      }}
      confirmText="Save Count"
      confirmLoading={saving}
      closeButtonText="Cancel"
    />
  );
}

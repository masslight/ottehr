import { otherColors } from '@ehrTheme/colors';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  capitalize,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Medication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useRef, useState } from 'react';
import { getMedicationInventory, lookupNdc, receiveMedicationShipment } from 'src/api/api';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  InHouseMedicationInventory,
  LookupNdcResponse,
  MEDICATION_COUNTED_AS_LABELS,
  ReceiveExpirationConflict,
  ReceiveMedicationShipmentInput,
} from 'utils/lib/types/api/config/in-house-medications';
import { formatExpiration, inventoryButtonSx, storedLocationId, unitLabel } from './inventory.helpers';

interface ReceiveShipmentDialogProps {
  open: boolean;
  onClose: () => void;
  medication: Medication & { id: string };
  inventory: InHouseMedicationInventory;
  locations: { id: string; name: string }[];
}

interface ReceiveFormState {
  ndc: string;
  manufacturer: string;
  lotNumber: string;
  expirationDate: DateTime | null;
  quantity: string;
  locationId: string;
  vendor: string;
}

type LookupState = { status: 'idle' | 'loading' } | LookupNdcResponse;

const NDC_LOOKUP_DEBOUNCE_MS = 600;

export default function ReceiveShipmentDialog({
  open,
  onClose,
  medication,
  inventory,
  locations,
}: ReceiveShipmentDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ReceiveFormState>(() => ({
    ndc: '',
    manufacturer: '',
    lotNumber: '',
    expirationDate: null,
    quantity: '',
    locationId: storedLocationId(locations) ?? locations[0]?.id ?? '',
    vendor: '',
  }));
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [prefilledFromLastLot, setPrefilledFromLastLot] = useState(false);
  const [saving, setSaving] = useState(false);
  // Set when the location already has this lot number with another expiration date; staff pick what to do.
  const [conflict, setConflict] = useState<ReceiveExpirationConflict | undefined>(undefined);
  const setField = <K extends keyof ReceiveFormState>(field: K, value: ReceiveFormState[K]): void =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const name = getMedicationName(medication) ?? '';
  const units = MEDICATION_COUNTED_AS_LABELS[inventory.countedAs];
  const quantity = Number(form.quantity);

  // Later shipments start from the last lot received (any location).
  useEffect(() => {
    if (!open || !oystehrZambda) return;
    let cancelled = false;
    getMedicationInventory(oystehrZambda, { medicationId: medication.id })
      .then(({ lastReceivedLot }) => {
        if (cancelled || !lastReceivedLot) return;
        setForm((prev) => ({
          ...prev,
          ndc: prev.ndc || (lastReceivedLot.ndc ?? ''),
          manufacturer: prev.manufacturer || (lastReceivedLot.manufacturer ?? ''),
          vendor: prev.vendor || (lastReceivedLot.vendor ?? ''),
        }));
        setPrefilledFromLastLot(true);
      })
      .catch((error) => console.error('Error loading the last lot received', error));
    return () => {
      cancelled = true;
    };
  }, [open, oystehrZambda, medication.id]);

  // Look the box up once typing pauses; a result for an NDC that has since changed is dropped.
  useEffect(() => {
    const ndc = form.ndc.trim();
    if (!oystehrZambda || !ndc) {
      setLookup({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setLookup({ status: 'loading' });
    const timer = setTimeout(() => {
      lookupNdc(oystehrZambda, { ndc, medicationId: medication.id })
        .then((result) => {
          if (cancelled) return;
          setLookup(result);
          if (result.product?.manufacturer) setField('manufacturer', result.product.manufacturer);
        })
        .catch((error) => {
          console.error('Error looking up NDC', error);
          if (!cancelled) setLookup({ status: 'unavailable' });
        });
    }, NDC_LOOKUP_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.ndc, oystehrZambda, medication.id]);

  const locationName = locations.find((location) => location.id === form.locationId)?.name ?? 'the location';

  const receive = async (expirationConflict?: ReceiveMedicationShipmentInput['expirationConflict']): Promise<void> => {
    if (!oystehrZambda || !form.expirationDate) return;
    setSaving(true);
    try {
      const result = await receiveMedicationShipment(oystehrZambda, {
        medicationId: medication.id,
        locationId: form.locationId,
        lotNumber: form.lotNumber.trim(),
        expirationDate: form.expirationDate.toISODate() ?? '',
        quantity,
        ndc: form.ndc.trim(),
        manufacturer: form.manufacturer.trim() || undefined,
        vendor: form.vendor.trim() || undefined,
        expirationConflict,
      });
      if ('expirationConflict' in result) {
        setConflict(result.expirationConflict);
        return;
      }
      setConflict(undefined);
      enqueueSnackbar(`Received ${quantity} ${units.plural} of ${name} at ${locationName}`, { variant: 'success' });
      onClose();
    } catch (error) {
      console.error('Error receiving shipment', error);
      enqueueSnackbar(getApiError({ error, defaultError: 'Failed to receive shipment' }), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const mismatch = lookup.status === 'mismatch';
  const product = 'product' in lookup ? lookup.product : undefined;
  const unitsLabel = capitalize(units.plural);
  const receiveLabel = quantity > 0 ? `Receive ${quantity} ${unitsLabel}` : `Receive ${unitsLabel}`;
  const lookupPanel = ((): ReactElement | null => {
    if (lookup.status === 'idle') return null;
    if (lookup.status === 'loading') {
      return (
        <Typography variant="body2" color="text.secondary">
          Looking up NDC {form.ndc.trim()} in the FDA NDC directory…
        </Typography>
      );
    }
    if (lookup.status === 'unavailable') {
      return (
        <Typography variant="body2" color="text.secondary">
          FDA NDC directory lookup unavailable. Check the box before saving.
        </Typography>
      );
    }
    if (lookup.status === 'not-found') {
      return (
        <Typography variant="body2" color="text.secondary">
          NDC {form.ndc.trim()} is not in the FDA NDC directory. Check the box before saving.
        </Typography>
      );
    }
    if (lookup.status === 'mismatch') {
      return (
        <Box
          sx={{
            backgroundColor: otherColors.lightErrorBg,
            borderRadius: 1,
            px: 1.5,
            py: 1.25,
            color: otherColors.lightErrorText,
          }}
        >
          <Typography variant="body2">
            NDC {product?.packageNdc ?? form.ndc.trim()} is {product?.name ?? 'a different medication'}, not {name}.
            Check the box before saving.
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ backgroundColor: otherColors.infoAlert, borderRadius: 2, px: 1.5, py: 1 }}>
        <Typography variant="body2" fontWeight={700}>
          FDA NDC directory
        </Typography>
        <Typography variant="body2">{[product?.name, product?.manufacturer].filter(Boolean).join(' · ')}</Typography>
        {product?.packageDescription ? (
          <Typography variant="body2" color="text.secondary">
            {product.packageDescription}
          </Typography>
        ) : null}
        <Typography variant="body2" sx={{ color: otherColors.darkGreenText, mt: 0.25 }}>
          Matches this medication
        </Typography>
      </Box>
    );
  })();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-testid={dataTestIds.receiveShipmentDialog.dialog}
    >
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) void receive();
        }}
      >
        <DialogTitle component="div">
          <Typography variant="h5" color="primary.dark">
            Receive Shipment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {name} · counted in {units.plural}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                required
                label="NDC From the Box"
                value={form.ndc}
                onChange={(e) => setField('ndc', e.target.value)}
                inputProps={{ 'data-testid': dataTestIds.receiveShipmentDialog.ndcField }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Manufacturer"
                value={form.manufacturer}
                onChange={(e) => setField('manufacturer', e.target.value)}
              />
            </Grid>
            {lookupPanel ? (
              <Grid item xs={12}>
                {lookupPanel}
              </Grid>
            ) : null}
            <Grid item xs={4}>
              <TextField
                fullWidth
                required
                label="Lot Number"
                value={form.lotNumber}
                onChange={(e) => setField('lotNumber', e.target.value)}
                inputProps={{ 'data-testid': dataTestIds.receiveShipmentDialog.lotNumberField }}
              />
            </Grid>
            <Grid item xs={4}>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <DatePicker
                  label="Expiration Date"
                  value={form.expirationDate}
                  onChange={(value) => setField('expirationDate', value)}
                  format="MM/dd/yyyy"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                required
                label={`Quantity (${units.plural})`}
                type="number"
                inputProps={{ min: 1, step: 1, 'data-testid': dataTestIds.receiveShipmentDialog.quantityField }}
                value={form.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel id="receive-location-label">Location</InputLabel>
                <Select
                  labelId="receive-location-label"
                  label="Location"
                  value={form.locationId}
                  onChange={(e) => setField('locationId', e.target.value)}
                >
                  {locations.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Vendor (optional)"
                value={form.vendor}
                onChange={(e) => setField('vendor', e.target.value)}
              />
            </Grid>
            {prefilledFromLastLot ? (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  NDC, manufacturer and vendor are filled from the last lot received.
                </Typography>
              </Grid>
            ) : null}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={onClose} sx={inventoryButtonSx}>
            Cancel
          </Button>
          {mismatch ? (
            <ConfirmationDialog
              title="Receive under a different medication?"
              description={`The FDA NDC directory says NDC ${product?.packageNdc ?? form.ndc.trim()} is ${
                product?.name ?? 'a different medication'
              }, not ${name}.`}
              response={() => receive()}
              actionButtons={{ proceed: { text: receiveLabel, color: 'error', loading: saving }, reverse: true }}
            >
              {(showDialog) => (
                <LoadingButton
                  type="button"
                  variant="contained"
                  loading={saving}
                  sx={inventoryButtonSx}
                  data-testid={dataTestIds.receiveShipmentDialog.receiveButton}
                  onClick={() => {
                    if (formRef.current?.reportValidity()) showDialog();
                  }}
                >
                  {receiveLabel}
                </LoadingButton>
              )}
            </ConfirmationDialog>
          ) : (
            <LoadingButton
              type="submit"
              variant="contained"
              loading={saving}
              sx={inventoryButtonSx}
              data-testid={dataTestIds.receiveShipmentDialog.receiveButton}
            >
              {receiveLabel}
            </LoadingButton>
          )}
        </DialogActions>
      </form>
      {conflict && form.expirationDate ? (
        <ExpirationConflictDialog
          conflict={conflict}
          lotNumber={form.lotNumber.trim()}
          locationName={locationName}
          enteredDate={form.expirationDate.toISODate() ?? ''}
          quantity={quantity}
          saving={saving}
          onChoose={(choice) => void receive(choice)}
          onBack={() => setConflict(undefined)}
        />
      ) : null}
    </Dialog>
  );
}

/** The warning when a lot number is already on hand with a different expiration date (OTR-3339). */
function ExpirationConflictDialog({
  conflict,
  lotNumber,
  locationName,
  enteredDate,
  quantity,
  saving,
  onChoose,
  onBack,
}: {
  conflict: ReceiveExpirationConflict;
  lotNumber: string;
  locationName: string;
  enteredDate: string;
  quantity: number;
  saving: boolean;
  onChoose: (choice: NonNullable<ReceiveMedicationShipmentInput['expirationConflict']>) => void;
  onBack: () => void;
}): ReactElement {
  const existing = formatExpiration(conflict.expirationDate);
  const entered = formatExpiration(enteredDate);
  const onHand = `${conflict.onHand} ${unitLabel(conflict.unit, conflict.onHand)}`;
  const adding = `${quantity} ${unitLabel(conflict.unit, quantity)}`;
  const choices: {
    choice: NonNullable<ReceiveMedicationShipmentInput['expirationConflict']>;
    label: string;
    help: string;
  }[] = [
    {
      choice: 'separate-lot',
      label: 'Add as a Separate Lot',
      help: `Keeps the ${onHand} expiring ${existing} and adds ${adding} expiring ${entered}. Both appear in the lot list on the medication card.`,
    },
    {
      choice: 'correct-existing',
      label: `Correct the Existing Lot to ${entered}`,
      help: `Changes the expiration of the ${onHand} already on hand and adds the ${adding} to that lot. The change is recorded in the lot's history.`,
    },
  ];
  return (
    <Dialog open onClose={onBack} maxWidth="xs" fullWidth>
      <DialogTitle component={Typography} variant="h5" color="primary.dark" sx={{ pb: 1 }}>
        Lot {lotNumber} is already on hand at {locationName} with expiration {existing}.
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Typography>You entered {entered}.</Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {choices.map(({ choice, label, help }) => (
            <Box key={choice}>
              <LoadingButton
                variant="contained"
                loading={saving}
                sx={inventoryButtonSx}
                onClick={() => onChoose(choice)}
              >
                {label}
              </LoadingButton>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {help}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onBack} disabled={saving} sx={inventoryButtonSx}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

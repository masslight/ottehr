import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
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
import { useApiClients } from 'src/hooks/useAppClients';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  InHouseMedicationInventory,
  LookupNdcResponse,
  MEDICATION_COUNTED_AS_LABELS,
  ReceiveMedicationShipmentInput,
} from 'utils/lib/types/api/config/in-house-medications';
import { ConfirmationDialog } from '../ConfirmationDialog';

interface ReceiveShipmentDialogProps {
  open: boolean;
  onClose: () => void;
  medication: Medication & { id: string };
  inventory: InHouseMedicationInventory;
  clinics: { id: string; name: string }[];
}

interface ReceiveFormState {
  ndc: string;
  manufacturer: string;
  lotNumber: string;
  expirationDate: DateTime | null;
  quantity: string;
  locationId: string;
  vendor: string;
  costMode: 'package' | 'item';
  pricePerPackage: string;
  itemsPerPackage: string;
  perItemCost: string;
}

type LookupState = { status: 'idle' | 'loading' } | LookupNdcResponse;

const NDC_LOOKUP_DEBOUNCE_MS = 600;
const buttonSx = { textTransform: 'none', borderRadius: 50, fontWeight: 'bold' };

// The clinic the Tracking Board's location picker last saved, when it is one of the in-person clinics.
function storedClinicId(clinics: { id: string }[]): string | undefined {
  try {
    const stored = localStorage.getItem('selectedLocation');
    const id = stored ? (JSON.parse(stored) as { id?: string }).id : undefined;
    return clinics.some((clinic) => clinic.id === id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function toCostInput(form: ReceiveFormState): ReceiveMedicationShipmentInput['cost'] {
  if (form.costMode === 'item') {
    return form.perItemCost.trim() ? { perItem: Number(form.perItemCost) } : undefined;
  }
  return form.pricePerPackage.trim() && form.itemsPerPackage.trim()
    ? { pricePerPackage: Number(form.pricePerPackage), itemsPerPackage: Number(form.itemsPerPackage) }
    : undefined;
}

const formatMoney = (value: number): string => `$${value.toFixed(2)}`;

export default function ReceiveShipmentDialog({
  open,
  onClose,
  medication,
  inventory,
  clinics,
}: ReceiveShipmentDialogProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ReceiveFormState>(() => ({
    ndc: '',
    manufacturer: '',
    lotNumber: '',
    expirationDate: null,
    quantity: '',
    locationId: storedClinicId(clinics) ?? clinics[0]?.id ?? '',
    vendor: '',
    costMode: 'package',
    pricePerPackage: '',
    itemsPerPackage: '',
    perItemCost: '',
  }));
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [prefilledFromLastLot, setPrefilledFromLastLot] = useState(false);
  const [saving, setSaving] = useState(false);
  const setField = <K extends keyof ReceiveFormState>(field: K, value: ReceiveFormState[K]): void =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const name = getMedicationName(medication) ?? '';
  const units = MEDICATION_COUNTED_AS_LABELS[inventory.countedAs];
  const quantity = Number(form.quantity);
  const unitCost =
    form.costMode === 'item'
      ? form.perItemCost.trim()
        ? Number(form.perItemCost)
        : undefined
      : form.pricePerPackage.trim() && Number(form.itemsPerPackage) > 0
      ? Number(form.pricePerPackage) / Number(form.itemsPerPackage)
      : undefined;

  // Later shipments start from the last lot received (any clinic).
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

  const receive = async (): Promise<void> => {
    if (!oystehrZambda || !form.expirationDate) return;
    setSaving(true);
    try {
      await receiveMedicationShipment(oystehrZambda, {
        medicationId: medication.id,
        locationId: form.locationId,
        lotNumber: form.lotNumber.trim(),
        expirationDate: form.expirationDate.toISODate() ?? '',
        quantity,
        ndc: form.ndc.trim(),
        manufacturer: form.manufacturer.trim() || undefined,
        vendor: form.vendor.trim() || undefined,
        cost: toCostInput(form),
      });
      const clinicName = clinics.find((clinic) => clinic.id === form.locationId)?.name ?? 'the clinic';
      enqueueSnackbar(`Received ${quantity} ${units.plural} of ${name} at ${clinicName}`, { variant: 'success' });
      onClose();
    } catch (error) {
      console.error('Error receiving shipment', error);
      enqueueSnackbar('Failed to receive shipment', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const mismatch = lookup.status === 'mismatch';
  const product = 'product' in lookup ? lookup.product : undefined;
  const unitsLabel = units.plural.charAt(0).toUpperCase() + units.plural.slice(1);
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
        <Box sx={{ backgroundColor: '#FDECEA', borderRadius: 1, px: 1.5, py: 1.25, color: '#5F2120' }}>
          <Typography variant="body2">
            NDC {product?.packageNdc ?? form.ndc.trim()} is {product?.name ?? 'a different drug'}, not {name}. Check the
            box before saving.
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ backgroundColor: 'rgba(225,245,254,.8)', borderRadius: 2, px: 1.5, py: 1 }}>
        <Typography variant="body2" fontWeight={700}>
          FDA NDC directory
        </Typography>
        <Typography variant="body2">{[product?.name, product?.manufacturer].filter(Boolean).join(' · ')}</Typography>
        {product?.packageDescription ? (
          <Typography variant="body2" color="text.secondary">
            {product.packageDescription}
          </Typography>
        ) : null}
        <Typography variant="body2" sx={{ color: '#1B5E20', mt: 0.25 }}>
          Matches this medication
        </Typography>
      </Box>
    );
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) void receive();
        }}
      >
        <DialogTitle component="div">
          <Typography variant="h5" color="primary.dark">
            Receive shipment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {name} · counted as {units.plural}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                required
                label="NDC from the box"
                value={form.ndc}
                onChange={(e) => setField('ndc', e.target.value)}
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
                label="Lot number"
                value={form.lotNumber}
                onChange={(e) => setField('lotNumber', e.target.value)}
              />
            </Grid>
            <Grid item xs={4}>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <DatePicker
                  label="Expiration date"
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
                inputProps={{ min: 1, step: 1 }}
                value={form.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel id="receive-clinic-label">Clinic</InputLabel>
                <Select
                  labelId="receive-clinic-label"
                  label="Clinic"
                  value={form.locationId}
                  onChange={(e) => setField('locationId', e.target.value)}
                >
                  {clinics.map((clinic) => (
                    <MenuItem key={clinic.id} value={clinic.id}>
                      {clinic.name}
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
            <Grid item xs={12}>
              <Typography variant="overline" color="primary.dark" fontWeight={500}>
                Cost (optional)
              </Typography>
            </Grid>
            <Grid item xs={12} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              {form.costMode === 'package' ? (
                <>
                  <TextField
                    label="Price per package"
                    type="number"
                    inputProps={{ min: 0, step: 'any' }}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    value={form.pricePerPackage}
                    onChange={(e) => setField('pricePerPackage', e.target.value)}
                    sx={{ width: 160 }}
                  />
                  <TextField
                    label={`${units.singular}s per package`}
                    type="number"
                    inputProps={{ min: 1, step: 1 }}
                    value={form.itemsPerPackage}
                    onChange={(e) => setField('itemsPerPackage', e.target.value)}
                    sx={{ width: 160 }}
                  />
                </>
              ) : (
                <TextField
                  label={`Cost per ${units.singular.toLowerCase()}`}
                  type="number"
                  inputProps={{ min: 0, step: 'any' }}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  value={form.perItemCost}
                  onChange={(e) => setField('perItemCost', e.target.value)}
                  sx={{ width: 160 }}
                />
              )}
              {unitCost !== undefined && Number.isFinite(unitCost) ? (
                <Typography>
                  = {formatMoney(unitCost)} per {units.singular.toLowerCase()}
                </Typography>
              ) : null}
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={() => setField('costMode', form.costMode === 'package' ? 'item' : 'package')}
              >
                {form.costMode === 'package'
                  ? `Enter cost per ${units.singular.toLowerCase()} instead`
                  : 'Enter price per package instead'}
              </Link>
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
          <Button variant="outlined" onClick={onClose} sx={buttonSx}>
            Cancel
          </Button>
          {mismatch ? (
            <ConfirmationDialog
              title="Receive under a different drug?"
              description={`The FDA NDC directory says NDC ${product?.packageNdc ?? form.ndc.trim()} is ${
                product?.name ?? 'a different drug'
              }, not ${name}.`}
              response={receive}
              actionButtons={{ proceed: { text: receiveLabel, color: 'error', loading: saving }, reverse: true }}
            >
              {(showDialog) => (
                <LoadingButton
                  type="button"
                  variant="contained"
                  loading={saving}
                  sx={buttonSx}
                  onClick={() => {
                    if (formRef.current?.reportValidity()) showDialog();
                  }}
                >
                  {receiveLabel}
                </LoadingButton>
              )}
            </ConfirmationDialog>
          ) : (
            <LoadingButton type="submit" variant="contained" loading={saving} sx={buttonSx}>
              {receiveLabel}
            </LoadingButton>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}

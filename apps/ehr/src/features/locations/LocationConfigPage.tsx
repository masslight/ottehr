import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Location } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomBreadcrumbs from 'src/components/CustomBreadcrumbs';
import LocationPaymentsSection from 'src/features/locations/LocationPaymentsSection';
import {
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  ROOM_EXTENSION_URL,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { isLocationInPerson, isLocationVirtual } from 'utils/lib/fhir/location';
import { LocationFieldsInput } from 'utils/lib/types/api/locations';
import { RoleType } from 'utils/lib/types/api/user.types';
import { TIMEZONES } from 'utils/lib/types/constants';
import { APIError, APIErrorCode, isApiError } from 'utils/lib/types/errors';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import useEvolveUser from '../../hooks/useEvolveUser';
import {
  useDeleteLocationMutation,
  useLocationQuery,
  useToggleLocationActiveMutation,
  useUpdateLocationMutation,
} from './location.queries';

const extValue = (location: Location, url: string): string | undefined =>
  location.extension?.find((ext) => ext.url === url)?.valueString;

const readRooms = (location: Location): string[] =>
  (location.extension ?? []).filter((ext) => ext.url === ROOM_EXTENSION_URL).map((ext) => ext.valueString ?? '');

const telecomValue = (location: Location, system: 'phone' | 'url' | 'fax'): string =>
  location.telecom?.find((cp) => cp.system === system)?.value ?? '';

type RoomEntry = { id: string; value: string };
const roomId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

// Soft (non-blocking) format hints. Stripe mirrors the retired connect section's check;
// Advapacs ids are Advapacs FHIR Location ids, minted as UUIDs in practice — a UUID
// mismatch flags typos and leftover `#{var/...}` placeholders without hard-blocking save.
const STRIPE_ACCOUNT_ID_REGEX = /^acct_[a-zA-Z0-9]{8,}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function LocationConfigPage(): ReactElement {
  const locationId = useParams()['location-id'] as string;
  const { data: location, isLoading } = useLocationQuery(locationId);
  const updateMutation = useUpdateLocationMutation(locationId);
  const toggleActiveMutation = useToggleLocationActiveMutation();
  const deleteMutation = useDeleteLocationMutation();
  const navigate = useNavigate();

  const currentUser = useEvolveUser();
  const isCustomerSupport = currentUser?.hasRole([RoleType.CustomerSupport]) ?? false;
  const isAdministrator = currentUser?.hasRole([RoleType.Administrator]) ?? false;
  const canEditPaymentFields = isCustomerSupport;
  const canSeePaymentFields = isCustomerSupport || isAdministrator;
  // Same role gate the delete-location zambda enforces; the UI just hides the control.
  const canDeleteLocation = isCustomerSupport || isAdministrator;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // null → first-level "are you sure?"; a string → the escalated destructive warning
  // (the zambda's RESOURCE_HAS_DEPENDENTS message), which "Delete anyway" force-confirms.
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [isVirtual, setIsVirtual] = useState(false);
  const [isInPerson, setIsInPerson] = useState(false);
  const [slug, setSlug] = useState('');
  const [timezone, setTimezone] = useState<string>(TIMEZONES[0]);
  const [description, setDescription] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [url, setUrl] = useState('');
  const [fax, setFax] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [reviewLink, setReviewLink] = useState('');
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [advapacsLocationId, setAdvapacsLocationId] = useState('');
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [newRoom, setNewRoom] = useState('');

  useEffect(() => {
    if (!location) return;
    setName(location.name ?? '');
    setActive(location.status === 'active');
    setIsVirtual(isLocationVirtual(location));
    setIsInPerson(isLocationInPerson(location));
    setSlug(location.identifier?.find((id) => id.system === SLUG_SYSTEM)?.value ?? '');
    setTimezone(extValue(location, TIMEZONE_EXTENSION_URL) ?? TIMEZONES[0]);
    setDescription(location.description ?? '');
    setAddressLine(location.address?.line?.[0] ?? '');
    setAddressLine2(location.address?.line?.[1] ?? '');
    setAddressCity(location.address?.city ?? '');
    setAddressState(location.address?.state ?? '');
    setAddressPostalCode(location.address?.postalCode ?? '');
    setPhone(telecomValue(location, 'phone'));
    setUrl(telecomValue(location, 'url'));
    setFax(telecomValue(location, 'fax'));
    setSupportPhone(extValue(location, LOCATION_SUPPORT_PHONE_EXTENSION_URL) ?? '');
    setReviewLink(location.extension?.find((e) => e.url === LOCATION_REVIEW_LINK_EXTENSION_URL)?.valueUrl ?? '');
    setStripeAccountId(extValue(location, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL) ?? '');
    setAdvapacsLocationId(extValue(location, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL) ?? '');
    setRooms(readRooms(location).map((value) => ({ id: roomId(), value })));
  }, [location]);

  const noModeSelected = !isVirtual && !isInPerson;
  const stripeFormatWarn = stripeAccountId.trim() !== '' && !STRIPE_ACCOUNT_ID_REGEX.test(stripeAccountId.trim());
  const advapacsFormatWarn = advapacsLocationId.trim() !== '' && !UUID_REGEX.test(advapacsLocationId.trim());

  const handleSave = (): void => {
    const fields: LocationFieldsInput = {
      name: name.trim(),
      isVirtual,
      isInPerson,
      slug: slug.trim(),
      timezone,
      description: description.trim() || null,
      address: {
        line: [addressLine.trim(), addressLine2.trim()].filter((l) => l !== ''),
        city: addressCity.trim() || undefined,
        state: addressState.trim() || undefined,
        postalCode: addressPostalCode.trim() || undefined,
      },
      telecom: { phone: phone.trim() || null, url: url.trim() || null, fax: fax.trim() || null },
      supportPhone: supportPhone.trim() || null,
      reviewLink: reviewLink.trim() || null,
      rooms: rooms.map((r) => r.value.trim()).filter((r) => r !== ''),
      // Stripe belongs in this payload: its field moved here when the Payment Locations page was
      // retired, but this payload was never updated, so edits to it were silently dropped.
      // Still omitted wholesale for callers who can't edit payment fields — the zambda rejects the
      // request outright if either key is present, so sending them would break every save by a
      // non-Customer-Support user.
      ...(canEditPaymentFields
        ? {
            stripeAccountId: stripeAccountId.trim() || null,
            advapacsLocationId: advapacsLocationId.trim() || null,
          }
        : {}),
    };
    updateMutation.mutate(fields);
  };

  const runDelete = async (): Promise<void> => {
    const force = deleteWarning !== null;
    try {
      await deleteMutation.mutateAsync({ locationId, force });
      enqueueSnackbar('Location deleted', { variant: 'success' });
      setDeleteDialogOpen(false);
      navigate('/admin/locations');
    } catch (error) {
      if (!force && isApiError(error) && (error as APIError).code === APIErrorCode.RESOURCE_HAS_DEPENDENTS) {
        // Not safe to delete → escalate the dialog to the destructive-action warning.
        setDeleteWarning((error as APIError).message);
      } else {
        enqueueSnackbar(isApiError(error) ? (error as APIError).message : 'Failed to delete location.', {
          variant: 'error',
        });
        setDeleteDialogOpen(false);
      }
    }
  };

  const breadcrumbs = useMemo(
    () => [
      { link: '/admin', children: 'Admin' },
      { link: '/admin/locations', children: 'Locations' },
      { link: '#', children: location?.name || (isLoading ? 'Loading…' : locationId) },
    ],
    [location?.name, isLoading, locationId]
  );

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <CustomBreadcrumbs chain={breadcrumbs} />
      <Paper sx={{ maxWidth: 560, mt: 2, p: 3 }}>
        {/* Immediate status control — separate from Save/update-location, hitting the
            dedicated toggle-location-active endpoint. Optimistic; reverts on failure. */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Switch
            checked={active}
            disabled={toggleActiveMutation.isPending}
            onChange={(e) => {
              const next = e.target.checked;
              setActive(next);
              toggleActiveMutation.mutate({ locationId, active: next }, { onError: () => setActive(!next) });
            }}
          />
          <Typography>{active ? 'Active' : 'Inactive'}</Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />

          <Box>
            <FormControlLabel
              control={<Checkbox checked={isVirtual} onChange={(e) => setIsVirtual(e.target.checked)} />}
              label="Virtual (Telemed)"
            />
            <FormControlLabel
              control={<Checkbox checked={isInPerson} onChange={(e) => setIsInPerson(e.target.checked)} />}
              label="In person"
            />
            {noModeSelected && (
              <Typography variant="body2" color="error">
                Select at least one of "Virtual" or "In person". A location may be both.
              </Typography>
            )}
          </Box>

          <TextField label="Permalink (slug)" value={slug} onChange={(e) => setSlug(e.target.value)} fullWidth />
          <TextField select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} fullWidth>
            {TIMEZONES.map((tz) => (
              <MenuItem key={tz} value={tz}>
                {tz}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <Typography variant="h6" color="primary.dark">
            Address
          </Typography>
          <TextField label="Street" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} fullWidth />
          <TextField
            label="Street line 2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            fullWidth
          />
          <TextField label="City" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} fullWidth />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="State"
              value={addressState}
              onChange={(e) => setAddressState(e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Postal code"
              value={addressPostalCode}
              onChange={(e) => setAddressPostalCode(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>

          <Typography variant="h6" color="primary.dark">
            Contact
          </Typography>
          <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          <TextField label="URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth />
          <TextField label="Fax" value={fax} onChange={(e) => setFax(e.target.value)} fullWidth />
          <TextField
            label="Support phone"
            value={supportPhone}
            onChange={(e) => setSupportPhone(e.target.value)}
            fullWidth
            helperText="Front-desk number shown to patients in booking/support flows."
          />
          <TextField
            label="Review link"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
            placeholder="https://g.page/r/..."
            helperText="Used in templates as {{location-review-link}}"
            fullWidth
          />

          {canSeePaymentFields && (
            <>
              <Typography variant="h6" color="primary.dark">
                Payments
              </Typography>
              {/* Account ID is a Location field (set here by Customer Support). Connection
                  status + terminal readers live on Stripe/Device resources and render below
                  — consolidated here from the retired Payment Locations page. */}
              <TextField
                label="Stripe Account ID"
                value={stripeAccountId}
                onChange={(e) => setStripeAccountId(e.target.value)}
                disabled={!canEditPaymentFields}
                fullWidth
                error={stripeFormatWarn}
                helperText={stripeFormatWarn ? 'Doesn’t look like a Stripe account ID (expected acct_…).' : undefined}
              />
              <LocationPaymentsSection
                locationId={locationId}
                stripeAccountId={location ? extValue(location, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL) : undefined}
              />

              <Typography variant="h6" color="primary.dark">
                Radiology / Imaging
              </Typography>
              {/* Advapacs (PACS) location id — maps this Location to an Advapacs location for
                  radiology orders (create-order reads it). Not a payment field; it just shares
                  the same Customer-Support permission tier. */}
              <TextField
                label="Advapacs Location ID"
                value={advapacsLocationId}
                onChange={(e) => setAdvapacsLocationId(e.target.value)}
                disabled={!canEditPaymentFields}
                fullWidth
                error={advapacsFormatWarn}
                helperText={advapacsFormatWarn ? 'Doesn’t look like an Advapacs location UUID.' : undefined}
              />
            </>
          )}

          <Typography variant="h6" color="primary.dark">
            Rooms
          </Typography>
          {rooms.map((room) => (
            <Box key={room.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                value={room.value}
                onChange={(e) =>
                  setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, value: e.target.value } : r)))
                }
                size="small"
                fullWidth
                placeholder="Room name"
              />
              <IconButton
                aria-label="Delete room"
                onClick={() => setRooms((prev) => prev.filter((r) => r.id !== room.id))}
                size="small"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              size="small"
              fullWidth
              placeholder="New room name"
            />
            <Button
              onClick={() => {
                if (!newRoom.trim()) return;
                setRooms((prev) => [...prev, { id: roomId(), value: newRoom.trim() }]);
                setNewRoom('');
              }}
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={!newRoom.trim()}
            >
              Add
            </Button>
          </Box>

          <Box sx={{ mt: 2 }}>
            <LoadingButton
              variant="contained"
              onClick={handleSave}
              loading={updateMutation.isPending}
              disabled={noModeSelected}
            >
              Save
            </LoadingButton>
          </Box>

          {canDeleteLocation && (
            <>
              <Divider sx={{ mt: 2 }} />
              <Typography variant="h6" color="error">
                Danger zone
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Permanently delete this location. Prefer deactivating (the toggle above) unless it was created in error
                — deletion cannot be undone.
              </Typography>
              <Box>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => {
                    setDeleteWarning(null);
                    setDeleteDialogOpen(true);
                  }}
                >
                  Delete location
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteDialogOpen(false);
        }}
      >
        <DialogTitle>{deleteWarning ? 'Delete anyway?' : 'Delete this location?'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteWarning ?? `“${name || 'This location'}” will be permanently deleted. This can't be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <LoadingButton color="error" onClick={runDelete} loading={deleteMutation.isPending}>
            {deleteWarning ? 'Delete anyway' : 'Delete'}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

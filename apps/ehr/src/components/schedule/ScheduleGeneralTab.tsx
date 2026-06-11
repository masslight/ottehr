import AddIcon from '@mui/icons-material/Add';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Location, Practitioner } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RoleType, ScheduleDTO, scheduleTypeFromFHIRType, UpdateScheduleParams } from 'utils';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';

const INTAKE_URL = import.meta.env.VITE_APP_PATIENT_APP_URL;

interface ScheduleGeneralTabProps {
  item: ScheduleDTO;
  onSchedulePersisted: (updatedItem: ScheduleDTO) => void;
  onSave: (params: UpdateScheduleParams) => Promise<void>;
  isSaving: boolean;
}

export default function ScheduleGeneralTab({
  item,
  onSchedulePersisted,
  onSave,
  isSaving,
}: ScheduleGeneralTabProps): ReactElement {
  const { oystehr } = useApiClients();
  const currentUser = useEvolveUser();
  const isCustomerSupport = currentUser?.hasRole([RoleType.CustomerSupport]) ?? false;
  const isAdministrator = currentUser?.hasRole([RoleType.Administrator]) ?? false;
  const canEditPaymentFields = isCustomerSupport;
  const canSeePaymentFields = isCustomerSupport || isAdministrator;

  const isLocation = item.owner.type === 'Location';

  // Slug and timezone live on the General tab, not here — keeping them
  // editable here would let this tab's save overwrite General-tab edits.
  const [isVirtual, setIsVirtual] = useState<boolean>(Boolean(item.owner.isVirtual));
  const [stripeAccountId, setStripeAccountId] = useState<string>(item.owner.stripeAccountId ?? '');
  const [advapacsLocationId, setAdvapacsLocationId] = useState<string>(item.owner.advapacsLocationId ?? '');
  type RoomEntry = { id: string; value: string };
  const newRoomId = useCallback(
    (): string =>
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    []
  );
  const toRoomEntries = useCallback(
    (values: string[]): RoomEntry[] => values.map((value) => ({ id: newRoomId(), value })),
    [newRoomId]
  );
  const [rooms, setRooms] = useState<RoomEntry[]>(toRoomEntries(item.owner.rooms ?? []));
  const [newRoom, setNewRoom] = useState<string>('');
  const [description, setDescription] = useState<string>(item.owner.description ?? '');
  const [addressLine, setAddressLine] = useState<string>(item.owner.address?.line?.[0] ?? '');
  const [addressCity, setAddressCity] = useState<string>(item.owner.address?.city ?? '');
  const [addressState, setAddressState] = useState<string>(item.owner.address?.state ?? '');
  const [addressPostalCode, setAddressPostalCode] = useState<string>(item.owner.address?.postalCode ?? '');
  const initialTelecomValue = (system: 'phone' | 'url' | 'fax'): string =>
    item.owner.telecom?.find((cp) => cp.system === system)?.value ?? '';
  const [telecomPhone, setTelecomPhone] = useState<string>(initialTelecomValue('phone'));
  const [telecomUrl, setTelecomUrl] = useState<string>(initialTelecomValue('url'));
  const [telecomFax, setTelecomFax] = useState<string>(initialTelecomValue('fax'));
  const [reviewLink, setReviewLink] = useState<string>(item.owner.reviewLink ?? '');
  const [statusPatchLoading, setStatusPatchLoading] = useState(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    setIsVirtual(Boolean(item.owner.isVirtual));
    setStripeAccountId(item.owner.stripeAccountId ?? '');
    setAdvapacsLocationId(item.owner.advapacsLocationId ?? '');
    setRooms(toRoomEntries(item.owner.rooms ?? []));
    setDescription(item.owner.description ?? '');
    setAddressLine(item.owner.address?.line?.[0] ?? '');
    setAddressCity(item.owner.address?.city ?? '');
    setAddressState(item.owner.address?.state ?? '');
    setAddressPostalCode(item.owner.address?.postalCode ?? '');
    setTelecomPhone(item.owner.telecom?.find((cp) => cp.system === 'phone')?.value ?? '');
    setTelecomUrl(item.owner.telecom?.find((cp) => cp.system === 'url')?.value ?? '');
    setTelecomFax(item.owner.telecom?.find((cp) => cp.system === 'fax')?.value ?? '');
    setReviewLink(item.owner.reviewLink ?? '');
  }, [item, toRoomEntries]);

  const defaultIntakeUrl = useMemo(() => {
    const fhirType = item.owner.type;
    const locationType = item.owner.isVirtual ? 'virtual' : 'in-person';
    const ownerSlug = item.owner.slug;
    if (ownerSlug && fhirType) {
      return `${INTAKE_URL}/prebook/${locationType}?bookingOn=${ownerSlug}&scheduleType=${scheduleTypeFromFHIRType(
        fhirType
      )}`;
    }
    return '';
  }, [item.owner.type, item.owner.isVirtual, item.owner.slug]);

  const setActiveStatus = async (isActive: boolean): Promise<void> => {
    if (!oystehr || !item?.id) {
      enqueueSnackbar('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
      return;
    }
    try {
      setStatusPatchLoading(true);
      const value: string | boolean = item.owner.type === 'Location' ? (isActive ? 'active' : 'inactive') : isActive;
      const patched = await oystehr.fhir.patch<Location | Practitioner>({
        resourceType: item.owner.type as 'Location' | 'Practitioner',
        id: item.owner.id,
        operations: [
          {
            path: item.owner.type === 'Location' ? '/status' : '/active',
            op: 'add',
            value,
          },
        ],
      });
      let newActiveStatus = isActive;
      if (patched.resourceType === 'Location') {
        newActiveStatus = patched.status === 'active';
      } else {
        newActiveStatus = patched.active === true;
      }
      onSchedulePersisted({
        ...item,
        owner: {
          ...item.owner,
          active: newActiveStatus,
        },
      });
    } catch {
      enqueueSnackbar('Oops. Something went wrong. Status update was not saved.', { variant: 'error' });
    } finally {
      setStatusPatchLoading(false);
    }
  };

  const handleAddRoom = (): void => {
    const trimmed = newRoom.trim();
    if (!trimmed) return;
    if (rooms.some((room) => room.value === trimmed)) {
      enqueueSnackbar('Room with this name already exists.', { variant: 'warning' });
      return;
    }
    setRooms([...rooms, { id: newRoomId(), value: trimmed }]);
    setNewRoom('');
  };

  const handleRoomChange = (id: string, value: string): void => {
    setRooms(rooms.map((room) => (room.id === id ? { ...room, value } : room)));
  };

  const handleRoomDelete = (id: string): void => {
    setRooms(rooms.filter((room) => room.id !== id));
  };

  const buildAddressPayload = (): UpdateScheduleParams['address'] => {
    const line = addressLine.trim();
    const city = addressCity.trim();
    const state = addressState.trim();
    const postalCode = addressPostalCode.trim();
    if (!line && !city && !state && !postalCode) {
      return null;
    }
    return {
      use: 'work',
      type: 'physical',
      line: line ? [line] : undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
    };
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const params: UpdateScheduleParams = {
      scheduleId: item.id,
    };
    if (isLocation) {
      params.isVirtual = isVirtual;
      params.rooms = rooms.map((room) => room.value.trim()).filter((value) => value !== '');
      params.description = description.trim();
      params.address = buildAddressPayload();
      params.telecom = {
        phone: telecomPhone.trim(),
        url: telecomUrl.trim(),
        fax: telecomFax.trim(),
      };
      params.reviewLink = reviewLink.trim();
      if (canEditPaymentFields) {
        params.stripeAccountId = stripeAccountId.trim();
        params.advapacsLocationId = advapacsLocationId.trim();
      }
    }
    // The parent mutation's onError already surfaces a snackbar; swallow here just
    // to avoid an unhandled rejection from the async form handler.
    try {
      await onSave(params);
    } catch {
      // intentionally empty — see comment above
    }
  };

  return (
    <>
      <Paper sx={{ marginBottom: 2, padding: 3 }}>
        <Box display={'flex'} alignItems={'center'}>
          <Switch
            checked={item.owner.active}
            onClick={() => setActiveStatus(!item.owner.active)}
            disabled={statusPatchLoading}
          />
          {statusPatchLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <Typography>{item.owner.active ? 'Active' : 'Inactive'}</Typography>
          )}
        </Box>
        <hr />
        <br />

        <form onSubmit={(e) => void handleSubmit(e)}>
          <TextField
            label="Slug"
            value={item.owner.slug ?? ''}
            InputProps={{ readOnly: true }}
            disabled
            sx={{ width: '250px' }}
          />
          <br />

          <Typography variant="body2" sx={{ pt: 1, pb: 0.5, fontWeight: 600 }}>
            Share booking link to this schedule:
          </Typography>
          <Box sx={{ display: defaultIntakeUrl ? 'flex' : 'none', alignItems: 'center', gap: 0.5, mb: 3 }}>
            <Tooltip
              title={isCopied ? 'Link copied!' : 'Copy link'}
              placement="top"
              arrow
              onClose={() => {
                setTimeout(() => {
                  setIsCopied(false);
                }, 200);
              }}
            >
              <Button
                aria-label="Copy booking link"
                onClick={() => {
                  void navigator.clipboard.writeText(defaultIntakeUrl);
                  setIsCopied(true);
                }}
                sx={{ p: 0, minWidth: 0 }}
              >
                <ContentCopyRoundedIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Link to={defaultIntakeUrl} target="_blank">
              <Typography variant="body2">{defaultIntakeUrl}</Typography>
            </Link>
          </Box>

          {isLocation && (
            <Box sx={{ marginTop: 3 }}>
              <FormControlLabel
                control={<Checkbox checked={isVirtual} onChange={(event) => setIsVirtual(event.target.checked)} />}
                label="Telemed location"
              />

              <Box sx={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
                <TextField
                  label="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
              </Box>

              <Box sx={{ marginTop: 3 }}>
                <Typography variant="h6" color="primary.dark" sx={{ marginBottom: 1 }}>
                  Address
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
                  <TextField
                    label="Street"
                    value={addressLine}
                    onChange={(event) => setAddressLine(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="City"
                    value={addressCity}
                    onChange={(event) => setAddressCity(event.target.value)}
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="State"
                      value={addressState}
                      onChange={(event) => setAddressState(event.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Postal code"
                      value={addressPostalCode}
                      onChange={(event) => setAddressPostalCode(event.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Box>
                </Box>
              </Box>

              <Box sx={{ marginTop: 3 }}>
                <Typography variant="h6" color="primary.dark" sx={{ marginBottom: 1 }}>
                  Contact
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
                  <TextField
                    label="Phone"
                    value={telecomPhone}
                    onChange={(event) => setTelecomPhone(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="URL"
                    value={telecomUrl}
                    onChange={(event) => setTelecomUrl(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Fax"
                    value={telecomFax}
                    onChange={(event) => setTelecomFax(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Review link"
                    value={reviewLink}
                    onChange={(event) => setReviewLink(event.target.value)}
                    placeholder="https://g.page/r/..."
                    helperText="Used in templates as {{location-review-link}}"
                    fullWidth
                  />
                </Box>
              </Box>

              {canSeePaymentFields && (
                <Box sx={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 500 }}>
                  <TextField
                    label="Stripe Account ID"
                    value={stripeAccountId}
                    onChange={(event) => setStripeAccountId(event.target.value)}
                    disabled={!canEditPaymentFields}
                    fullWidth
                  />
                  <TextField
                    label="Advapacs Location ID"
                    value={advapacsLocationId}
                    onChange={(event) => setAdvapacsLocationId(event.target.value)}
                    disabled={!canEditPaymentFields}
                    fullWidth
                  />
                </Box>
              )}

              <Box sx={{ marginTop: 3 }}>
                <Typography variant="h6" color="primary.dark" sx={{ marginBottom: 1 }}>
                  Rooms
                </Typography>
                {rooms.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 1 }}>
                    No rooms configured.
                  </Typography>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 500 }}>
                  {rooms.map((room) => (
                    <Box key={room.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        value={room.value}
                        onChange={(event) => handleRoomChange(room.id, event.target.value)}
                        size="small"
                        fullWidth
                        placeholder="Room name"
                      />
                      <IconButton aria-label="Delete room" onClick={() => handleRoomDelete(room.id)} size="small">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 1 }}>
                    <TextField
                      value={newRoom}
                      onChange={(event) => setNewRoom(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleAddRoom();
                        }
                      }}
                      size="small"
                      fullWidth
                      placeholder="New room name"
                    />
                    <Button
                      onClick={handleAddRoom}
                      variant="outlined"
                      startIcon={<AddIcon />}
                      disabled={!newRoom.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          <Box>
            <LoadingButton type="submit" loading={isSaving} variant="contained" sx={{ marginTop: 3 }}>
              Save
            </LoadingButton>
          </Box>
        </form>
      </Paper>
    </>
  );
}

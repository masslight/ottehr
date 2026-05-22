import AddIcon from '@mui/icons-material/Add';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
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
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RoleType, ScheduleDTO, scheduleTypeFromFHIRType, TIMEZONES, UpdateScheduleParams } from 'utils';
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

  const [slug, setSlug] = useState<string>(item.owner.slug ?? '');
  const [timezone, setTimezone] = useState<string>(item.owner.timezone ?? TIMEZONES[0]);
  const [isVirtual, setIsVirtual] = useState<boolean>(Boolean(item.owner.isVirtual));
  const [stripeAccountId, setStripeAccountId] = useState<string>(item.owner.stripeAccountId ?? '');
  const [advapacsLocationId, setAdvapacsLocationId] = useState<string>(item.owner.advapacsLocationId ?? '');
  const [rooms, setRooms] = useState<string[]>(item.owner.rooms ?? []);
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
  const [statusPatchLoading, setStatusPatchLoading] = useState(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    setSlug(item.owner.slug ?? '');
    setTimezone(item.owner.timezone ?? TIMEZONES[0]);
    setIsVirtual(Boolean(item.owner.isVirtual));
    setStripeAccountId(item.owner.stripeAccountId ?? '');
    setAdvapacsLocationId(item.owner.advapacsLocationId ?? '');
    setRooms(item.owner.rooms ?? []);
    setDescription(item.owner.description ?? '');
    setAddressLine(item.owner.address?.line?.[0] ?? '');
    setAddressCity(item.owner.address?.city ?? '');
    setAddressState(item.owner.address?.state ?? '');
    setAddressPostalCode(item.owner.address?.postalCode ?? '');
    setTelecomPhone(item.owner.telecom?.find((cp) => cp.system === 'phone')?.value ?? '');
    setTelecomUrl(item.owner.telecom?.find((cp) => cp.system === 'url')?.value ?? '');
    setTelecomFax(item.owner.telecom?.find((cp) => cp.system === 'fax')?.value ?? '');
  }, [item]);

  const defaultIntakeUrl = useMemo(() => {
    const fhirType = item.owner.type;
    const locationType = item.owner.isVirtual ? 'virtual' : 'in-person';
    if (slug && fhirType) {
      return `${INTAKE_URL}/prebook/${locationType}?bookingOn=${slug}&scheduleType=${scheduleTypeFromFHIRType(
        fhirType
      )}`;
    }
    return '';
  }, [item.owner.type, item.owner.isVirtual, slug]);

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
      // Preserve old behavior: toggling active also persists current timezone/slug.
      // Fire-and-forget but surface rejections to the user instead of letting them go unhandled.
      onSave({ scheduleId: item.id, timezone, slug }).catch(() => {
        enqueueSnackbar('Status updated, but persisting timezone/slug failed.', { variant: 'error' });
      });
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
    if (rooms.includes(trimmed)) {
      enqueueSnackbar('Room with this name already exists.', { variant: 'warning' });
      return;
    }
    setRooms([...rooms, trimmed]);
    setNewRoom('');
  };

  const handleRoomChange = (index: number, value: string): void => {
    setRooms(rooms.map((room, i) => (i === index ? value : room)));
  };

  const handleRoomDelete = (index: number): void => {
    setRooms(rooms.filter((_, i) => i !== index));
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
      timezone,
      slug,
    };
    if (isLocation) {
      params.isVirtual = isVirtual;
      params.rooms = rooms.map((room) => room.trim()).filter((room) => room !== '');
      params.description = description.trim();
      params.address = buildAddressPayload();
      params.telecom = {
        phone: telecomPhone.trim(),
        url: telecomUrl.trim(),
        fax: telecomFax.trim(),
      };
      if (canEditPaymentFields) {
        params.stripeAccountId = stripeAccountId.trim();
        params.advapacsLocationId = advapacsLocationId.trim();
      }
    }
    try {
      await onSave(params);
    } catch {
      enqueueSnackbar('Oops. Something went wrong. Changes were not saved.', { variant: 'error' });
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
          <TextField label="Slug" value={slug} InputProps={{ readOnly: true }} disabled sx={{ width: '250px' }} />
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
          <Autocomplete
            options={TIMEZONES}
            renderInput={(params) => <TextField {...params} label="Timezone" />}
            sx={{ marginTop: 2, width: '250px' }}
            value={timezone}
            onChange={(_event, newValue) => {
              if (newValue) {
                setTimezone(newValue);
              }
            }}
          />

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
                  {rooms.map((room, index) => (
                    <Box key={`room-${index}`} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        value={room}
                        onChange={(event) => handleRoomChange(index, event.target.value)}
                        size="small"
                        fullWidth
                        placeholder="Room name"
                      />
                      <IconButton aria-label="Delete room" onClick={() => handleRoomDelete(index)} size="small">
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

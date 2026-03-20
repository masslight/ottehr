import { LoadingButton } from '@mui/lab';
import { Autocomplete, Box, Button, Grid, TextField } from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployees, saveFollowup } from 'src/api/api';
import LocationSelect from 'src/components/LocationSelect';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { FOLLOWUP_REASONS, FOLLOWUP_SYSTEMS, FollowupReason, PatientFollowupDetails, ProviderDetails } from 'utils';

interface PatientFollowupFormProps {
  patient: Patient | undefined;
  followupDetails?: PatientFollowupDetails;
  initialEncounterId?: string;
}

interface EncounterRow {
  id: string | undefined;
  typeLabel: string;
  dateTime: string | undefined;
  appointment: Appointment;
  encounter: Encounter;
  location?: Location;
}

interface FormData {
  provider: ProviderDetails | null;
  reason: FollowupReason | undefined;
  otherReason: string;
  initialVisit: EncounterRow | null;
  followupDate: DateTime;
  followupTime: DateTime;
  location: LocationWithWalkinSchedule | undefined;
}

interface FormErrors {
  provider?: string;
  reason?: string;
  otherReason?: string;
  initialVisit?: string;
  followupDate?: string;
  followupTime?: string;
  location?: string;
}

export default function PatientFollowupForm({
  patient,
  followupDetails,
  initialEncounterId,
}: PatientFollowupFormProps): JSX.Element {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const currentUser = useEvolveUser();

  const patientId = patient?.id;

  const [loading, setLoading] = useState<boolean>(false);
  const [providers, setProviders] = useState<ProviderDetails[]>([]);
  const [previousEncounters, setPreviousEncounters] = useState<EncounterRow[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [_locations, setLocations] = useState<LocationWithWalkinSchedule[]>([]);

  const [formData, setFormData] = useState<FormData>({
    provider: followupDetails?.provider || null,
    reason: followupDetails?.reason || undefined,
    otherReason: followupDetails?.otherReason || '',
    initialVisit: null,
    followupDate: followupDetails?.start ? DateTime.fromISO(followupDetails.start) : DateTime.now(),
    followupTime: followupDetails?.start ? DateTime.fromISO(followupDetails.start) : DateTime.now(),
    location: followupDetails?.location as LocationWithWalkinSchedule | undefined,
  });

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.provider) {
      newErrors.provider = 'Provider is required';
    }
    if (!formData.reason) {
      newErrors.reason = 'Reason is required';
    }
    if (formData.reason === 'Other' && !formData.otherReason.trim()) {
      newErrors.otherReason = 'Other reason is required when "Other" is selected';
    }
    if (!formData.initialVisit) {
      newErrors.initialVisit = 'Initial visit is required';
    }
    if (!formData.followupDate) {
      newErrors.followupDate = 'Annotation date is required';
    }
    if (!formData.followupTime) {
      newErrors.followupTime = 'Annotation time is required';
    }
    if (!formData.location) {
      newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateFormData = (field: keyof FormData, value: any): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  useEffect(() => {
    const getAndSetProviders = async (client: Oystehr): Promise<void> => {
      const getEmployeesRes = await getEmployees(client);
      const providers = getEmployeesRes.employees.filter((employee) => employee.isProvider);
      const formattedProviders: ProviderDetails[] = providers
        .map((prov) => {
          const id = prov.profile.split('/')[1];
          return {
            practitionerId: id,
            name: `${prov.firstName} ${prov.lastName}`,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      setProviders(formattedProviders);
    };
    if (oystehrZambda && providers.length === 0) {
      void getAndSetProviders(oystehrZambda);
    }
  }, [oystehrZambda, providers]);

  useEffect(() => {
    const getPreviousEncounters = async (client: Oystehr): Promise<void> => {
      if (!patientId) return;
      try {
        const resources = (
          await client.fhir.search({
            resourceType: 'Encounter',
            params: [
              {
                name: 'patient',
                value: patientId,
              },
              {
                name: '_include',
                value: 'Encounter:appointment',
              },
              {
                name: '_include',
                value: 'Encounter:location',
              },
              {
                name: '_sort',
                value: '-date',
              },
            ],
          })
        ).unbundle();

        const encounters = resources.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
        const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
        const fhirLocations = resources.filter((resource) => resource.resourceType === 'Location') as Location[];

        const nonFollowupEncounters = encounters.filter((encounter) => {
          const isFollowup = encounter.type?.some(
            (type) =>
              type.coding?.some(
                (coding) => coding.system === FOLLOWUP_SYSTEMS.type.url && coding.code === FOLLOWUP_SYSTEMS.type.code
              )
          );
          return !isFollowup;
        });

        const encounterRows: EncounterRow[] = nonFollowupEncounters
          .map((encounter) => {
            const appointment = encounter.appointment?.[0]?.reference
              ? appointments.find((app) => `Appointment/${app.id}` === encounter.appointment?.[0]?.reference)
              : undefined;

            const locationRef = encounter.location?.[0]?.location?.reference?.replace('Location/', '');
            const encounterLocation = locationRef ? fhirLocations.find((loc) => loc.id === locationRef) : undefined;

            return {
              id: encounter.id,
              typeLabel: appointment?.appointmentType?.text || 'Visit',
              dateTime: appointment?.start,
              appointment: appointment!,
              encounter: encounter,
              location: encounterLocation,
            };
          })
          .filter((row) => row.id)
          .sort((a, b) => {
            const dateA = DateTime.fromISO(a.dateTime ?? '');
            const dateB = DateTime.fromISO(b.dateTime ?? '');
            return dateB.diff(dateA).milliseconds;
          });

        setPreviousEncounters(encounterRows);

        const preselectedEncounterId = followupDetails?.initialEncounterID || initialEncounterId;
        const preselectedVisit = preselectedEncounterId
          ? encounterRows.find((row) => row.encounter?.id === preselectedEncounterId)
          : undefined;

        // Pre-populate provider from the logged-in user
        const userProfile = currentUser?.profileResource;
        const userProvider = userProfile?.id
          ? {
              practitionerId: userProfile.id,
              name: [userProfile.name?.[0]?.given?.[0], userProfile.name?.[0]?.family].filter(Boolean).join(' '),
            }
          : undefined;

        setFormData((prev) => ({
          ...prev,
          ...(preselectedVisit ? { initialVisit: preselectedVisit } : {}),
          ...(userProvider ? { provider: userProvider } : {}),
        }));
      } catch (error) {
        console.error('Error fetching previous encounters:', error);
      }
    };

    if (oystehrZambda && patientId) {
      void getPreviousEncounters(oystehrZambda);
    }
  }, [oystehrZambda, patientId, followupDetails?.initialEncounterID, initialEncounterId, currentUser]);

  useEffect(() => {
    if (previousEncounters.length > 0) {
      const latestInitialVisit = previousEncounters[0];
      if (latestInitialVisit.location) {
        setFormData((prev) => ({ ...prev, location: latestInitialVisit.location as LocationWithWalkinSchedule }));
      } else {
        const selectedLocation = localStorage.getItem('selectedLocation');
        if (selectedLocation) {
          setFormData((prev) => ({ ...prev, location: JSON.parse(selectedLocation) }));
        }
      }
    }
  }, [previousEncounters]);

  const handleFormSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    let apiErr = false;
    let errorMessage = '';

    try {
      if (!oystehrZambda) throw new Error('Zambda client not found');
      if (!patientId) {
        errorMessage = `Required input fields are missing: Patient Id`;
        throw new Error(errorMessage);
      }

      // Combine date and time for the start time
      const combinedDateTime = formData.followupDate.set({
        hour: formData.followupTime.hour,
        minute: formData.followupTime.minute,
        second: formData.followupTime.second,
      });

      const encounterDetails: PatientFollowupDetails = {
        encounterId: followupDetails?.encounterId,
        followupType: 'Follow-up Encounter',
        patientId,
        reason: formData.reason || undefined,
        otherReason: formData.reason === 'Other' ? formData.otherReason : undefined,
        initialEncounterID: formData.initialVisit?.encounter?.id,
        appointmentId: formData.initialVisit?.appointment?.id,
        answered: '',
        caller: '',
        resolved: false,
        message: '',
        start: combinedDateTime.toISO() || '',
        location: formData.location,
        provider: formData.provider || undefined,
      };

      const followup = await saveFollowup(oystehrZambda, { encounterDetails });

      navigate(
        `/in-person/${formData.initialVisit?.appointment?.id}/follow-up-note${
          followup.encounterId ? `?encounterId=${followup.encounterId}` : ''
        }`
      );
    } catch (error) {
      console.error(`Failed to add patient followup: ${error}`);
      if (!errorMessage) errorMessage = `Failed to add patient followup: ${error}`;
      enqueueSnackbar(errorMessage, { variant: 'error' });
      apiErr = true;
    } finally {
      setLoading(false);
      if (!apiErr) {
        enqueueSnackbar('Followup saved successfully!', { variant: 'success' });
      }
    }
  };

  const handleCancel = (): void => {
    if (patientId) {
      navigate(`/patient/${patientId}`, { state: { defaultTab: 'encounters' } });
    } else {
      navigate('/visits');
    }
  };

  const handleDateChange = (date: DateTime): void => {
    if (!date || !formData.followupTime) return;

    updateFormData('followupDate', date);
    const isToday = date.hasSame(DateTime.now(), 'day');

    const combinedDateTime = date.set({
      hour: formData.followupTime.hour,
      minute: formData.followupTime.minute,
      second: formData.followupTime.second,
    });

    if (isToday && combinedDateTime < DateTime.now()) {
      const currentTime = DateTime.now();
      if (!formData.followupTime.hasSame(currentTime, 'minute')) {
        updateFormData('followupTime', currentTime);
      }
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <Grid container spacing={2} columns={10}>
        <Grid item xs={10}>
          <Autocomplete
            options={providers}
            fullWidth
            size="small"
            getOptionLabel={(option) => `${option.name}`}
            isOptionEqualToValue={(option, value) => option.practitionerId === value.practitionerId}
            value={formData.provider}
            onChange={(_, newVal) => updateFormData('provider', newVal || null)}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.practitionerId}>
                  {option.name}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                placeholder="Select provider"
                name="provider"
                {...params}
                label="Annotation provider *"
                error={!!errors.provider}
                helperText={errors.provider}
              />
            )}
          />
        </Grid>

        <Grid item xs={10}>
          <Autocomplete
            options={FOLLOWUP_REASONS}
            onChange={(_, newVal) => {
              updateFormData('reason', newVal || undefined);

              if (newVal !== 'Other') {
                updateFormData('otherReason', '');
              }
            }}
            size="small"
            fullWidth
            value={formData.reason}
            renderInput={(params) => (
              <TextField
                placeholder="Select reason"
                name="reason"
                {...params}
                label="Reason *"
                error={!!errors.reason}
                helperText={errors.reason}
              />
            )}
          />
        </Grid>

        {formData.reason === 'Other' && (
          <Grid item xs={10}>
            <TextField
              fullWidth
              size="small"
              id="otherReason"
              label="Other reason *"
              variant="outlined"
              value={formData.otherReason}
              onChange={(e) => updateFormData('otherReason', e.target.value)}
              placeholder="Please specify the reason"
              error={!!errors.otherReason}
              helperText={errors.otherReason}
            />
          </Grid>
        )}

        <Grid item xs={10}>
          <Autocomplete
            options={previousEncounters}
            fullWidth
            size="small"
            getOptionLabel={(option) => {
              const dateTime = option.dateTime ? formatISOStringToDateAndTime(option.dateTime) : 'Unknown date/time';
              const type = option.typeLabel || 'Visit';
              return `${dateTime} - ${type}`;
            }}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={formData.initialVisit}
            onChange={(_, newVal) => updateFormData('initialVisit', newVal || null)}
            renderInput={(params) => (
              <TextField
                placeholder="Select initial visit"
                name="initialVisit"
                {...params}
                label="Initial visit *"
                error={!!errors.initialVisit}
                helperText={errors.initialVisit}
              />
            )}
          />
        </Grid>

        <Grid item xs={5}>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <DatePicker
              onChange={(val) => val && handleDateChange(val)}
              label="Annotation date"
              format="MM/dd/yyyy"
              value={formData.followupDate}
              minDate={DateTime.now().startOf('day')}
              slotProps={{
                textField: {
                  id: 'followup-date',
                  label: 'Annotation date *',
                  fullWidth: true,
                  size: 'small',
                  error: !!errors.followupDate,
                  helperText: errors.followupDate,
                },
              }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={5}>
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <TimePicker
              onChange={(val) => val && updateFormData('followupTime', val)}
              value={formData.followupTime}
              label="Annotation time *"
              minTime={formData.followupDate.hasSame(DateTime.now(), 'day') ? DateTime.now() : undefined}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  error: !!errors.followupTime,
                  helperText: errors.followupTime,
                },
              }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid item xs={10}>
          <LocationSelect
            location={formData.location}
            setLocation={(location) => updateFormData('location', location)}
            setLocations={setLocations}
            updateURL={false}
            renderInputProps={{ size: 'small' }}
          />
          {errors.location && <Box sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5 }}>{errors.location}</Box>}
        </Grid>

        <Grid item xs={10}>
          <Box display="flex" flexDirection="row" justifyContent="space-between" gap={2}>
            <Button
              sx={{
                minWidth: 80,
                border: 1,
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
              }}
              onClick={handleCancel}
            >
              Cancel
            </Button>

            <LoadingButton
              variant="contained"
              type="submit"
              loading={loading}
              sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
                marginRight: 1,
              }}
            >
              Create follow-up
            </LoadingButton>
          </Box>
        </Grid>
      </Grid>
    </form>
  );
}

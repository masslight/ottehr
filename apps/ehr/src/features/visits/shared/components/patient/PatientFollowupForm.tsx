import { LoadingButton } from '@mui/lab';
import { Autocomplete, Box, Button, Grid, Paper, TextField } from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployees, saveFollowup } from 'src/api/api';
import LocationSelect from 'src/components/LocationSelect';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useApiClients } from 'src/hooks/useAppClients';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import {
  FOLLOWUP_REASONS,
  FOLLOWUP_SYSTEMS,
  FollowupReason,
  PatientFollowupDetails,
  PRACTITIONER_CODINGS,
  ProviderDetails,
} from 'utils';

interface PatientFollowupFormProps {
  patient: Patient | undefined;
  followupDetails?: PatientFollowupDetails;
}

interface EncounterRow {
  id: string | undefined;
  typeLabel: string;
  dateTime: string | undefined;
  appointment: Appointment;
  encounter: Encounter;
}

interface FormData {
  provider: ProviderDetails | null;
  reason: FollowupReason | undefined;
  otherReason: string;
  initialVisit: EncounterRow | undefined;
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

export default function PatientFollowupForm({ patient, followupDetails }: PatientFollowupFormProps): JSX.Element {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const patientId = patient?.id;

  const [loading, setLoading] = useState<boolean>(false);
  const [providers, setProviders] = useState<ProviderDetails[]>([]);
  const [previousEncounters, setPreviousEncounters] = useState<EncounterRow[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [locations, setLocations] = useState<LocationWithWalkinSchedule[]>([]);

  const [formData, setFormData] = useState<FormData>({
    provider: followupDetails?.provider || null,
    reason: followupDetails?.reason || undefined,
    otherReason: followupDetails?.otherReason || '',
    initialVisit: undefined,
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
      newErrors.followupDate = 'Follow-up date is required';
    }
    if (!formData.followupTime) {
      newErrors.followupTime = 'Follow-up time is required';
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
                name: '_sort',
                value: '-date',
              },
            ],
          })
        ).unbundle();

        const encounters = resources.filter((resource) => resource.resourceType === 'Encounter') as Encounter[];
        const appointments = resources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];

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

            return {
              id: encounter.id,
              typeLabel: appointment?.appointmentType?.text || 'Visit',
              dateTime: appointment?.start,
              appointment: appointment!,
              encounter: encounter,
            };
          })
          .filter((row) => row.id)
          .sort((a, b) => {
            const dateA = DateTime.fromISO(a.dateTime ?? '');
            const dateB = DateTime.fromISO(b.dateTime ?? '');
            return dateB.diff(dateA).milliseconds;
          });

        setPreviousEncounters(encounterRows);

        if (followupDetails?.initialEncounterID && encounterRows.length > 0) {
          const matchingVisit = encounterRows.find((row) => row.encounter?.id === followupDetails.initialEncounterID);
          if (matchingVisit) {
            setFormData((prev) => ({ ...prev, initialVisit: matchingVisit }));
          }
        }
      } catch (error) {
        console.error('Error fetching previous encounters:', error);
      }
    };

    if (oystehrZambda && patientId) {
      void getPreviousEncounters(oystehrZambda);
    }
  }, [oystehrZambda, patientId, followupDetails?.initialEncounterID]);

  useEffect(() => {
    if (previousEncounters.length > 0 && providers.length > 0) {
      const latestInitialVisit = previousEncounters[0];
      const provider = providers.find(
        (provider) =>
          latestInitialVisit.encounter.participant?.find(
            (participant) =>
              participant.individual?.reference?.split('/')[1] === provider.practitionerId &&
              participant.type?.find(
                (type) =>
                  type.coding?.some(
                    (coding) =>
                      coding.system === PRACTITIONER_CODINGS.Attender[0].system &&
                      coding.code === PRACTITIONER_CODINGS.Attender[0].code
                  )
              )
          )
      );
      if (provider) {
        setFormData((prev) => ({ ...prev, provider: provider }));
      }
    }
  }, [previousEncounters, providers]);

  useEffect(() => {
    if (previousEncounters.length > 0 && locations.length > 0) {
      const latestInitialVisit = previousEncounters[0];
      const location = locations.find(
        (location) =>
          latestInitialVisit.encounter.location?.find(
            (latestLocation) => location.id === latestLocation.location?.reference?.split('/')[1]
          )
      );
      const selectedLocation = localStorage.getItem('selectedLocation');
      if (location) {
        setFormData((prev) => ({ ...prev, location: location }));
      } else if (selectedLocation) {
        setFormData((prev) => ({ ...prev, location: JSON.parse(selectedLocation) }));
      }
    }
  }, [previousEncounters, locations]);

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
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
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
                  label="Follow-up provider *"
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
              onChange={(_, newVal) => updateFormData('initialVisit', newVal || undefined)}
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
                label="Follow-up date"
                format="MM/dd/yyyy"
                value={formData.followupDate}
                minDate={DateTime.now().startOf('day')}
                slotProps={{
                  textField: {
                    id: 'followup-date',
                    label: 'Follow-up date *',
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
                label="Follow-up time *"
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
    </Paper>
  );
}

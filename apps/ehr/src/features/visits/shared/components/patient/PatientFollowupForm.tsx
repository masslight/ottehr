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
import { useApiClients } from 'src/hooks/useAppClients';
import { AppointmentHistoryRow } from 'src/hooks/useGetPatient';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import {
  FOLLOWUP_REASONS,
  FOLLOWUP_SYSTEMS,
  FollowupReason,
  PatientFollowupDetails,
  ProviderDetails,
  ServiceMode,
} from 'utils';

interface PatientFollowupFormProps {
  patient: Patient | undefined;
  followupDetails?: PatientFollowupDetails;
}

interface FormData {
  provider: ProviderDetails | undefined;
  reason: FollowupReason | undefined;
  otherReason: string;
  initialVisit: AppointmentHistoryRow | undefined;
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
  const [previousAppointments, setPreviousAppointments] = useState<AppointmentHistoryRow[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<FormData>({
    provider: followupDetails?.provider || undefined,
    reason: followupDetails?.reason || undefined,
    otherReason: followupDetails?.otherReason || '',
    initialVisit: undefined,
    followupDate: followupDetails?.start ? DateTime.fromISO(followupDetails.start) : DateTime.now(),
    followupTime: followupDetails?.start ? DateTime.fromISO(followupDetails.start) : DateTime.now(),
    location: followupDetails?.location || JSON.parse(localStorage?.getItem('selectedLocation') || ''),
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
      const formattedProviders: ProviderDetails[] = providers.map((prov) => {
        const id = prov.profile.split('/')[1];
        return {
          practitionerId: id,
          name: `${prov.firstName} ${prov.lastName}`,
        };
      });
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

        const appointmentRows: AppointmentHistoryRow[] = nonFollowupEncounters
          .map((encounter) => {
            const appointment = encounter.appointment?.[0]?.reference
              ? appointments.find((app) => `Appointment/${app.id}` === encounter.appointment?.[0]?.reference)
              : undefined;

            return {
              id: appointment?.id,
              typeLabel: appointment?.appointmentType?.text || 'Visit',
              office: undefined,
              officeTimeZone: undefined,
              dateTime: appointment?.start || encounter.period?.start,
              serviceMode: ServiceMode['in-person'],
              length: 0,
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

        setPreviousAppointments(appointmentRows);

        if (followupDetails?.initialVisit && appointmentRows.length > 0) {
          const matchingVisit = appointmentRows.find((row) => row.encounter?.id === followupDetails.initialVisit);
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
  }, [oystehrZambda, patientId, followupDetails?.initialVisit]);

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
        followupType: 'Telephone Encounter',
        patientId,
        reason: formData.reason || undefined,
        otherReason: formData.reason === 'Other' ? formData.otherReason : undefined,
        initialVisit: formData.initialVisit?.encounter?.id,
        appointmentId: formData.initialVisit?.appointment?.id,
        answered: '',
        caller: '',
        resolved: false,
        message: '',
        start: combinedDateTime.toISO() || '',
        location: formData.location,
        provider: formData.provider || undefined,
      };

      console.log('encounter details', encounterDetails, formData);

      await saveFollowup(oystehrZambda, { encounterDetails });

      navigate(`/patient/${patientId}`, { state: { defaultTab: 'followups' } });
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
      navigate(`/patient/${patientId}`, { state: { defaultTab: 'followups' } });
    } else {
      navigate('/visits');
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
              onChange={(_, newVal) => updateFormData('provider', newVal || undefined)}
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
              options={previousAppointments}
              fullWidth
              size="small"
              getOptionLabel={(option) => {
                const dateTime = option.dateTime
                  ? DateTime.fromISO(option.dateTime).toFormat('MM/dd/yyyy h:mm a')
                  : 'Unknown date/time';
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
                onChange={(val) => val && updateFormData('followupDate', val)}
                label="Follow-up date"
                format="MM/dd/yyyy"
                value={formData.followupDate}
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

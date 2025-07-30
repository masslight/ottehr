import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  lighten,
  Paper,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import {
  FOLLOWUP_TYPES,
  FollowupReason,
  FollowupType,
  NON_BILLABLE_REASONS,
  PatientFollowupDetails,
  ProviderDetails,
  SLUG_SYSTEM,
  TELEPHONE_REASONS,
} from 'utils';
import { getEmployees, saveFollowup } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import LocationSelect from '../LocationSelect';

interface PatientFollowupFormProps {
  patient: Patient | undefined;
  followupStatus: 'RESOLVED' | 'OPEN' | 'NEW';
  setFollowupStatus?: any;
  followupDetails?: PatientFollowupDetails;
}

export default function PatientFollowupForm({
  patient,
  followupDetails,
  followupStatus,
  setFollowupStatus,
}: PatientFollowupFormProps): JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const patientId = patient?.id;

  const [loading, setLoading] = useState<boolean>(false);
  const storedLocation = localStorage?.getItem('selectedLocation');
  const parsedStoredLocation = storedLocation ? JSON.parse(storedLocation) : undefined;
  const [selectedLocation, setSelectedLocation] = useState<LocationWithWalkinSchedule | undefined>(
    followupDetails?.location ? followupDetails?.location : parsedStoredLocation
  );
  const [reasonOptions, setReasonOptions] = useState<FollowupReason[]>(
    followupDetails?.followupType
      ? followupDetails.followupType === 'Non-Billable'
        ? [...NON_BILLABLE_REASONS]
        : [...TELEPHONE_REASONS]
      : []
  );
  const [providers, setProviders] = useState<ProviderDetails[]>([]);

  const [followupType, setFollowupType] = useState<FollowupType | null>(followupDetails?.followupType || null);
  const [followupReason, setFollowupReason] = useState<FollowupReason | null>(followupDetails?.reason || null);
  const [answered, setAnswered] = useState<string>(followupDetails?.answered || '');
  const [caller, setCaller] = useState<string>(followupDetails?.caller || '');
  const [followupDate, setFollowupDate] = useState<DateTime>(
    followupDetails?.start ? DateTime.fromISO(followupDetails.start) : DateTime.now()
  );
  const [provider, setProvider] = useState<ProviderDetails | null>(followupDetails?.provider || null);
  const [resolved, setResolved] = useState<boolean>(false);
  const [message, setMessage] = useState<string>(followupDetails?.message || '');

  useEffect(() => {
    const locationSlug = selectedLocation?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)
      ?.value;
    const locationState = selectedLocation?.address?.state;
    if (!locationSlug || !locationState) {
      console.log(
        'show some toast: location is missing slug or address.state',
        selectedLocation,
        locationSlug,
        locationState
      );
      return;
    }
  }, [selectedLocation]);

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

  const handleTypeChange = (event: any, newValue: any): void => {
    const type = newValue;
    if (!type) {
      setReasonOptions([]);
      setFollowupReason(null);
    } else {
      setReasonOptions(type === 'Telephone Encounter' ? [...TELEPHONE_REASONS] : [...NON_BILLABLE_REASONS]);
      if (followupType && type !== followupType) setFollowupReason(null);
    }
    setFollowupType(type);
  };

  const handleReasonChange = (event: any, newValue: any): void => {
    const selectedReason = newValue;
    setFollowupReason(selectedReason);
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    let apiErr = false;
    let errorMessage = '';

    try {
      if (!oystehrZambda) throw new Error('Zambda client not found');
      if (!followupType || !patientId) {
        errorMessage = `Required input fields are missing: ${!followupType ? 'Type, ' : ''} ${
          !patientId ? 'Patient Id, ' : ''
        }`;
        throw new Error(errorMessage);
      }
      const encounterDetails: PatientFollowupDetails = {
        encounterId: followupDetails?.encounterId,
        followupType,
        patientId,
        reason: (followupReason as FollowupReason) || undefined,
        answered,
        caller,
        resolved,
        message,
        start: followupDate.toISO() || '',
        end: resolved ? DateTime.now().toISO() : undefined,
        location: selectedLocation,
        provider: provider || undefined,
      };

      const res = await saveFollowup(oystehrZambda, { encounterDetails });
      if (res.encounterId && resolved && setFollowupStatus) {
        setFollowupStatus('RESOLVED');
      }
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
      <form onSubmit={(e) => handleFormSubmit(e)}>
        <Grid container spacing={2} columns={10}>
          <Grid item xs={5}>
            <Autocomplete
              disabled={followupStatus === 'RESOLVED'}
              options={FOLLOWUP_TYPES}
              onChange={handleTypeChange}
              value={followupType}
              fullWidth
              renderInput={(params) => (
                <TextField required placeholder="Select type" name="type" {...params} label="Type" />
              )}
            />
          </Grid>
          <Grid item xs={5}>
            <Autocomplete
              disabled={followupStatus === 'RESOLVED'}
              options={reasonOptions}
              onChange={handleReasonChange}
              fullWidth
              value={followupReason}
              noOptionsText="Please select a type"
              renderInput={(params) => (
                <TextField placeholder="Select reason" name="reason" {...params} label="Reason" />
              )}
            />
          </Grid>
          <Grid item xs={5}>
            <TextField
              disabled={followupStatus !== 'NEW'}
              fullWidth
              id="answered"
              label="Answered"
              variant="outlined"
              value={answered}
              onChange={(e) => setAnswered(e.target.value)}
            />
          </Grid>
          <Grid item xs={5}>
            <TextField
              disabled={followupStatus === 'RESOLVED'}
              fullWidth
              id="caller"
              label="Caller"
              variant="outlined"
              value={caller}
              onChange={(e) => setCaller(e.target.value)}
            />
          </Grid>
          <Grid item xs={5}>
            <LocalizationProvider dateAdapter={AdapterLuxon}>
              <DatePicker
                disabled={followupStatus !== 'NEW'}
                onChange={(val) => val && setFollowupDate(val)}
                label="Date"
                format="MM/dd/yyyy"
                value={followupDate}
                slotProps={{ textField: { id: 'followup-date', label: 'Date', fullWidth: true } }}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={5}>
            <LocalizationProvider dateAdapter={AdapterLuxon}>
              <TimePicker
                disabled={followupStatus !== 'NEW'}
                onChange={(val) => val && setFollowupDate(val)}
                value={followupDate}
                label="Time"
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              ></TimePicker>
            </LocalizationProvider>
          </Grid>
          <Grid item xs={5}>
            <LocationSelect
              location={selectedLocation}
              setLocation={setSelectedLocation}
              updateURL={false}
              renderInputProps={{ disabled: followupStatus === 'RESOLVED' }}
            />
          </Grid>
          <Grid item xs={5}>
            <Autocomplete
              disabled={followupStatus === 'RESOLVED'}
              options={providers}
              fullWidth
              getOptionLabel={(option) => `${option.name}`}
              isOptionEqualToValue={(option, value) => option.practitionerId === value.practitionerId}
              value={provider}
              onChange={(_, newVal) => {
                setProvider(newVal);
              }}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.practitionerId}>
                    {option.name}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField placeholder="Select provider" name="provider" {...params} label="Provider" />
              )}
            />
          </Grid>
          <Grid item xs={10}>
            <TextField
              disabled={followupStatus === 'RESOLVED'}
              fullWidth
              id="message"
              label="Message"
              variant="outlined"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              multiline
            />
          </Grid>
          <Grid item xs={10}>
            <Divider sx={{ ml: -3, mr: -3 }} />
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
              {followupStatus !== 'RESOLVED' && (
                <Box display="flex" flexDirection="row">
                  <FormControlLabel
                    sx={{
                      backgroundColor: 'transparent',
                      pr: 0,
                    }}
                    control={
                      <Checkbox
                        size="small"
                        sx={{
                          color: theme.palette.primary.main,
                          '&.Mui-checked': {
                            color: theme.palette.primary.main,
                          },
                          '&.Mui-disabled': {
                            color: lighten(theme.palette.primary.main, 0.4),
                          },
                        }}
                        checked={resolved}
                        onChange={(e) => setResolved(e.target.checked)}
                      />
                    }
                    label={
                      <Typography
                        sx={{
                          fontSize: '16px',
                          fontWeight: 500,
                          color: theme.palette.text.primary,
                        }}
                      >
                        Mark as resolved
                      </Typography>
                    }
                  />

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
                    Save
                  </LoadingButton>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
}

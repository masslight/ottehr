import { Autocomplete, Box, Button, Divider, Grid, Paper, TextField } from '@mui/material';
import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEmployees } from 'src/api/api';
import LocationSelect from 'src/components/LocationSelect';
import { useApiClients } from 'src/hooks/useAppClients';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { ProviderDetails, SLUG_SYSTEM } from 'utils';

const FOLLOWUP_TYPES = ['Telephone Encounter', 'Non-Billable'] as const;
type FollowupType = (typeof FOLLOWUP_TYPES)[number];

const TELEPHONE_REASONS = [
  'Culture Positive; Group A Strep',
  'Culture Positive; Other',
  'Culture Positive; Urine',
  'Culture Positive; Wound',
  'Lab Call Back; Change of Antibiotics',
  'Lab Call Back; Needs Prescription',
  'Medication Change or Resend',
  'Medication Refill Request Spilled, ran out too early, etc.',
] as const;
const NON_BILLABLE_REASONS = [
  'Presents for Splints/Crutches',
  'Presents with Specimen',
  'Adolescent/Adult Discussion',
] as const;
type TelephoneReasons = (typeof TELEPHONE_REASONS)[number];
type NonBillableReasons = (typeof NON_BILLABLE_REASONS)[number];
type FollowupReason = TelephoneReasons | NonBillableReasons;

export interface OldPatientFollowupDetails {
  encounterId?: string; // will only exist when updating
  patientId: string | null;
  followupType: FollowupType;
  reason?: FollowupReason;
  answered?: string;
  caller?: string;
  message?: string;
  start: string;
  end?: string; // if resolved === true, this should be entered
  location?: Location;
  provider?: ProviderDetails;
  resolved: boolean;
}

interface OldFollowupViewProps {
  patient: Patient | undefined;
  followupDetails?: OldPatientFollowupDetails;
}

export default function OldFollowupView({ patient, followupDetails }: OldFollowupViewProps): JSX.Element {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const patientId = patient?.id;

  const storedLocation = localStorage?.getItem('selectedLocation');
  const parsedStoredLocation = storedLocation ? JSON.parse(storedLocation) : undefined;
  const [selectedLocation, setSelectedLocation] = useState<LocationWithWalkinSchedule | undefined>(
    followupDetails?.location ? followupDetails?.location : parsedStoredLocation
  );
  const [reasonOptions] = useState<FollowupReason[]>(
    followupDetails?.followupType
      ? followupDetails.followupType === 'Non-Billable'
        ? [...NON_BILLABLE_REASONS]
        : [...TELEPHONE_REASONS]
      : []
  );
  const [providers, setProviders] = useState<ProviderDetails[]>([]);

  const [followupType] = useState<FollowupType | null>(followupDetails?.followupType || null);
  const [followupReason] = useState<FollowupReason | null>(followupDetails?.reason || null);
  const [answered, setAnswered] = useState<string>(followupDetails?.answered || '');
  const [caller, setCaller] = useState<string>(followupDetails?.caller || '');
  const [followupDate, setFollowupDate] = useState<DateTime>(
    followupDetails?.start ? DateTime.fromISO(followupDetails.start) : DateTime.now()
  );
  const [provider, setProvider] = useState<ProviderDetails | null>(followupDetails?.provider || null);
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

  const handleCancel = (): void => {
    if (patientId) {
      navigate(`/patient/${patientId}`, { state: { defaultTab: 'followups' } });
    } else {
      navigate('/visits');
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={2} columns={10}>
        <Grid item xs={5}>
          <Autocomplete
            disabled
            options={FOLLOWUP_TYPES}
            value={followupType}
            fullWidth
            renderInput={(params) => (
              <TextField required placeholder="Select type" name="type" {...params} label="Type" />
            )}
          />
        </Grid>
        <Grid item xs={5}>
          <Autocomplete
            disabled
            options={reasonOptions}
            fullWidth
            value={followupReason}
            noOptionsText="Please select a type"
            renderInput={(params) => <TextField placeholder="Select reason" name="reason" {...params} label="Reason" />}
          />
        </Grid>
        <Grid item xs={5}>
          <TextField
            disabled
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
            disabled
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
              disabled
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
              disabled
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
            renderInputProps={{ disabled: true }}
          />
        </Grid>
        <Grid item xs={5}>
          <Autocomplete
            disabled
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
            disabled
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
              Back
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

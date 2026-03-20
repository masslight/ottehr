import { LoadingButton } from '@mui/lab';
import { Autocomplete, Box, Button, Grid, TextField } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useApiClients } from 'src/hooks/useAppClients';
import { FOLLOWUP_SYSTEMS } from 'utils';

interface EncounterRow {
  id: string | undefined;
  typeLabel: string;
  dateTime: string | undefined;
  appointment: Appointment;
  encounter: Encounter;
  location?: Location;
}

interface ScheduledFollowupParentSelectorProps {
  patient: Patient;
  initialEncounterId?: string;
}

export default function ScheduledFollowupParentSelector({
  patient,
  initialEncounterId,
}: ScheduledFollowupParentSelectorProps): JSX.Element {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const patientId = patient?.id;

  const [previousEncounters, setPreviousEncounters] = useState<EncounterRow[]>([]);
  const [selectedParentEncounter, setSelectedParentEncounter] = useState<EncounterRow | undefined>(undefined);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const getPreviousEncounters = async (client: Oystehr): Promise<void> => {
      if (!patientId) return;
      try {
        const resources = (
          await client.fhir.search({
            resourceType: 'Encounter',
            params: [
              { name: 'patient', value: patientId },
              { name: '_include', value: 'Encounter:appointment' },
              { name: '_include', value: 'Encounter:location' },
              { name: '_sort', value: '-date' },
            ],
          })
        ).unbundle();

        const encounters = resources.filter((r) => r.resourceType === 'Encounter') as Encounter[];
        const appointments = resources.filter((r) => r.resourceType === 'Appointment') as Appointment[];
        const locations = resources.filter((r) => r.resourceType === 'Location') as Location[];

        // Only show non-followup (top-level) encounters as parent options
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
            const encounterLocation = locationRef ? locations.find((loc) => loc.id === locationRef) : undefined;

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

        if (initialEncounterId && encounterRows.length > 0) {
          console.log(
            '[ScheduledSelector] Looking for initialEncounterId:',
            initialEncounterId,
            'in',
            encounterRows.map((r) => r.id)
          );
          const matchingVisit = encounterRows.find((row) => row.encounter?.id === initialEncounterId);
          console.log('[ScheduledSelector] Match:', matchingVisit?.id);
          if (matchingVisit) {
            setSelectedParentEncounter(matchingVisit);
          }
        }
      } catch (err) {
        console.error('Error fetching previous encounters:', err);
      }
    };

    if (oystehrZambda && patientId) {
      void getPreviousEncounters(oystehrZambda);
    }
  }, [oystehrZambda, patientId, initialEncounterId]);

  const handleContinue = (): void => {
    if (!selectedParentEncounter) {
      setError('Please select a initial visit');
      return;
    }

    // Navigate to the standard Add Visit page with parent encounter context
    console.log('[ScheduledFollowup] Navigating with parentEncounterId:', selectedParentEncounter.encounter.id);
    navigate('/visits/add', {
      state: {
        parentEncounterId: selectedParentEncounter.encounter.id,
        parentLocation: selectedParentEncounter.location,
        patientId: patientId,
        patientInfo: {
          id: patient.id,
          newPatient: false,
          firstName: patient.name?.[0]?.given?.[0] || '',
          lastName: patient.name?.[0]?.family || '',
          dateOfBirth: patient.birthDate || '',
          sex: patient.gender,
          phoneNumber: patient.telecom?.find((t) => t.system === 'phone')?.value?.replace('+1', '') || '',
        },
      },
    });
  };

  const handleCancel = (): void => {
    if (patientId) {
      navigate(`/patient/${patientId}`, { state: { defaultTab: 'encounters' } });
    } else {
      navigate('/visits');
    }
  };

  return (
    <Grid container spacing={2} columns={10}>
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
          value={selectedParentEncounter ?? null}
          onChange={(_, newVal) => {
            setSelectedParentEncounter(newVal || undefined);
            setError(undefined);
          }}
          renderInput={(params) => (
            <TextField
              placeholder="Select initial visit"
              name="parentVisit"
              {...params}
              label="Initial visit *"
              error={!!error}
              helperText={error}
            />
          )}
        />
      </Grid>

      <Grid item xs={10}>
        <Box display="flex" flexDirection="row" justifyContent="space-between" gap={2}>
          <Button
            sx={{ minWidth: 80, border: 1, borderRadius: 100, textTransform: 'none', fontWeight: 600 }}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <LoadingButton
            variant="contained"
            onClick={handleContinue}
            sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}
          >
            Continue to Add Visit
          </LoadingButton>
        </Box>
      </Grid>
    </Grid>
  );
}

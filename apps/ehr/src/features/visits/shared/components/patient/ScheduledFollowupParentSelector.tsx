import { LoadingButton } from '@mui/lab';
import { Autocomplete, Box, Button, Grid, TextField } from '@mui/material';
import { Patient, Person } from 'fhir/r4b';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { getFirstName, getLastName } from 'utils';
import { useParentEncounters } from './useParentEncounters';

interface ScheduledFollowupParentSelectorProps {
  patient: Patient;
  person?: Person;
  initialEncounterId?: string;
}

export default function ScheduledFollowupParentSelector({
  patient,
  person,
  initialEncounterId,
}: ScheduledFollowupParentSelectorProps): JSX.Element {
  const navigate = useNavigate();
  const patientId = patient?.id;

  const { previousEncounters, selectedParentEncounter, setSelectedParentEncounter } = useParentEncounters(
    patientId,
    initialEncounterId
  );
  const [error, setError] = useState<string>();

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
          firstName: getFirstName(patient),
          lastName: getLastName(patient),
          dateOfBirth: patient.birthDate,
          sex: patient.gender,
          phoneNumber:
            patient?.telecom?.find((t) => t.system === 'phone')?.value?.replace('+1', '') ||
            person?.telecom?.find((t) => t.system === 'phone')?.value?.replace('+1', ''),
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

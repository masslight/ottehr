import { LoadingButton } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  Grid,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Patient, Person } from 'fhir/r4b';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { CopyableFollowupField, FollowUpOptions, getFirstName, getLastName } from 'utils';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { COPYABLE_FOLLOWUP_FIELDS, fetchCopySourceChartData } from './copyFollowupFields';
import { useParentEncounters } from './useParentEncounters';

interface ScheduledFollowupParentSelectorProps {
  patient: Patient;
  person?: Person;
  initialEncounterId?: string;
}

const ALL_FIELDS_CHECKED = Object.fromEntries(COPYABLE_FOLLOWUP_FIELDS.map((field) => [field.key, true])) as Record<
  CopyableFollowupField,
  boolean
>;

export default function ScheduledFollowupParentSelector({
  patient,
  person,
  initialEncounterId,
}: ScheduledFollowupParentSelectorProps): JSX.Element {
  const navigate = useNavigate();
  const patientId = patient?.id;
  const apiClient = useOystehrAPIClient();

  const { previousEncounters, selectedParentEncounter, setSelectedParentEncounter } = useParentEncounters(
    patientId,
    initialEncounterId
  );
  const [error, setError] = useState<string>();
  const [checkedFields, setCheckedFields] = useState<Record<CopyableFollowupField, boolean>>(ALL_FIELDS_CHECKED);

  const parentEncounterId = selectedParentEncounter?.encounter.id;
  const queryEnabled = Boolean(apiClient) && Boolean(parentEncounterId);

  const { data: parentChartData, isFetching } = useQuery({
    queryKey: ['followup-copy-chart-data', parentEncounterId],
    queryFn: () => fetchCopySourceChartData(apiClient!, parentEncounterId!),
    enabled: queryEnabled,
  });

  // Cover the window where the query is expected to fire but data hasn't arrived yet
  // (e.g. apiClient still null on first render). Without this, isFetching is false while
  // parentChartData is undefined and we'd flash all-disabled checkboxes.
  const isChartDataLoading = isFetching || (queryEnabled && parentChartData === undefined);

  const handleContinue = (): void => {
    if (!selectedParentEncounter || !parentEncounterId) {
      setError('Please select a initial visit');
      return;
    }

    const clientCopyFields: CopyableFollowupField[] = parentChartData
      ? COPYABLE_FOLLOWUP_FIELDS.filter(
          (field) => checkedFields[field.key] && field.extract !== undefined && !field.isEmpty(parentChartData)
        ).map((field) => field.key)
      : [];

    // Diagnosis is server-side: maps to followUpOptions.skipPatientDiagnosis.
    const diagnosisEmpty = parentChartData
      ? COPYABLE_FOLLOWUP_FIELDS.find((f) => f.key === 'diagnosis')?.isEmpty(parentChartData) ?? true
      : true;
    const skipPatientDiagnosis = !checkedFields.diagnosis || diagnosisEmpty;

    const followUpOptions: FollowUpOptions = {
      parentEncounterId,
      ...(skipPatientDiagnosis && { skipPatientDiagnosis: true }),
    };

    navigate('/visits/add', {
      state: {
        followUpOptions,
        parentLocation: selectedParentEncounter.location,
        patientId: patientId,
        clientCopyFields,
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

      {selectedParentEncounter && (
        <Grid item xs={10}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Copy from previous visit
          </Typography>
          {isChartDataLoading ? (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Checking the initial visit&apos;s note…
              </Typography>
            </Box>
          ) : (
            <FormGroup>
              {COPYABLE_FOLLOWUP_FIELDS.map((field) => {
                const isEmpty = !parentChartData || field.isEmpty(parentChartData);
                const checkbox = (
                  <FormControlLabel
                    key={field.key}
                    disabled={isEmpty}
                    control={
                      <Checkbox
                        size="small"
                        checked={!isEmpty && checkedFields[field.key]}
                        onChange={(e) => setCheckedFields((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                      />
                    }
                    label={field.label}
                  />
                );
                if (!isEmpty) return checkbox;
                return (
                  <Tooltip key={field.key} title={`No ${field.label} available to copy`} placement="right">
                    <Box component="span" sx={{ width: 'fit-content' }}>
                      {checkbox}
                    </Box>
                  </Tooltip>
                );
              })}
            </FormGroup>
          )}
        </Grid>
      )}

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
            loading={isChartDataLoading}
            disabled={!selectedParentEncounter}
            sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}
          >
            Continue to Add Visit
          </LoadingButton>
        </Box>
      </Grid>
    </Grid>
  );
}

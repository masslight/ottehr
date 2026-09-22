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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Patient, Person } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { convertVisitToFollowUp } from 'src/api/api';
import { formatISOStringToDateAndTime } from 'src/helpers/formatDateTime';
import { useApiClients } from 'src/hooks/useAppClients';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import {
  CopyableFollowupField,
  FollowUpOptions,
} from 'utils/lib/types/api/prebook-create-appointment/prebook-create-appointment.types';
import { markChartStale } from '../../hooks/chartSectionCache';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import type { ConvertFromVisit } from './AddPatientFollowup';
import { COPYABLE_FOLLOWUP_FIELDS, fetchCopySourceChartData } from './copyFollowupFields';
import { getFollowupPrefill } from './followupPrefill';
import { useCopyChartDataToFollowup } from './useCopyChartDataToFollowup';
import { useParentEncounters } from './useParentEncounters';

interface ScheduledFollowupParentSelectorProps {
  patient: Patient;
  person?: Person;
  initialEncounterId?: string;
  /** Present when retyping an existing visit rather than booking a new follow-up. */
  convertFrom?: ConvertFromVisit;
}

const ALL_FIELDS_CHECKED = Object.fromEntries(COPYABLE_FOLLOWUP_FIELDS.map((field) => [field.key, true])) as Record<
  CopyableFollowupField,
  boolean
>;

export default function ScheduledFollowupParentSelector({
  patient,
  person,
  initialEncounterId,
  convertFrom,
}: ScheduledFollowupParentSelectorProps): JSX.Element {
  const navigate = useNavigate();
  const patientId = patient?.id;
  const apiClient = useOystehrAPIClient();
  const { oystehrZambda } = useApiClients();
  const queryClient = useQueryClient();
  const copyChartDataToFollowup = useCopyChartDataToFollowup();

  const { previousEncounters, selectedParentEncounter, setSelectedParentEncounter } = useParentEncounters(
    patientId,
    initialEncounterId,
    convertFrom?.encounterId
  );
  const [error, setError] = useState<string>();
  const [checkedFields, setCheckedFields] = useState<Record<CopyableFollowupField, boolean>>(ALL_FIELDS_CHECKED);

  const parentEncounterId = selectedParentEncounter?.encounter.id;
  const queryEnabled = Boolean(apiClient) && Boolean(parentEncounterId);

  const {
    data: parentChartData,
    isFetching,
    isError: isChartDataError,
  } = useQuery({
    queryKey: ['followup-copy-chart-data', parentEncounterId],
    queryFn: () => fetchCopySourceChartData(apiClient!, parentEncounterId!),
    enabled: queryEnabled,
  });

  const targetEncounterId = convertFrom?.encounterId;
  const targetQueryEnabled = Boolean(apiClient) && Boolean(targetEncounterId);
  const {
    data: targetChartData,
    isFetching: isTargetFetching,
    isError: isTargetChartDataError,
  } = useQuery({
    queryKey: ['followup-copy-chart-data', targetEncounterId],
    queryFn: () => fetchCopySourceChartData(apiClient!, targetEncounterId!),
    enabled: targetQueryEnabled,
  });

  // Loading until data arrives; on error stop loading so the provider isn't stuck on the button.
  const isChartDataLoading =
    isFetching ||
    (queryEnabled && parentChartData === undefined && !isChartDataError) ||
    isTargetFetching ||
    (targetQueryEnabled && targetChartData === undefined && !isTargetChartDataError);

  const disabledReasonFor = (field: (typeof COPYABLE_FOLLOWUP_FIELDS)[number]): string | undefined =>
    !parentChartData || field.isEmpty(parentChartData) ? `No ${field.label} available to copy` : undefined;

  const alreadyPresentOnTarget = (field: (typeof COPYABLE_FOLLOWUP_FIELDS)[number]): boolean =>
    !!targetChartData && !field.isEmpty(targetChartData);

  const copyableFieldKeys = (): CopyableFollowupField[] =>
    COPYABLE_FOLLOWUP_FIELDS.filter(
      (field) => checkedFields[field.key] && field.extract !== undefined && !disabledReasonFor(field)
    ).map((field) => field.key);

  // Diagnosis is server-side: maps to followUpOptions.skipPatientDiagnosis.
  const shouldSkipDiagnosis = (): boolean => {
    const diagnosisField = COPYABLE_FOLLOWUP_FIELDS.find((f) => f.key === 'diagnosis');
    if (!diagnosisField) return true;
    return !checkedFields.diagnosis || !!disabledReasonFor(diagnosisField);
  };

  const convertMutation = useMutation({
    mutationFn: async (): Promise<{ copyFailed: boolean }> => {
      if (!convertFrom || !parentEncounterId) throw new Error('Nothing to convert');
      if (!oystehrZambda) throw new Error('api client not defined');

      await convertVisitToFollowUp(oystehrZambda, {
        encounterId: convertFrom.encounterId,
        parentEncounterId,
        ...(shouldSkipDiagnosis() && { skipPatientDiagnosis: true }),
      });

      // Everything past this point is best-effort: the visit is already a follow-up.
      let copyFailed = false;
      const fields = copyableFieldKeys();
      if (fields.length > 0) {
        try {
          await copyChartDataToFollowup.mutateAsync({
            sourceEncounterId: parentEncounterId,
            targetEncounterId: convertFrom.encounterId,
            fields,
          });
        } catch (e) {
          console.error('Failed to copy chart data to the converted visit:', e);
          copyFailed = true;
        }
      }

      await markChartStale(queryClient, convertFrom.encounterId);

      return { copyFailed };
    },
    onSuccess: ({ copyFailed }) => {
      enqueueSnackbar(
        copyFailed
          ? 'Visit converted to a follow-up, but some information could not be copied from the initial visit'
          : 'Visit converted to a scheduled follow-up',
        { variant: copyFailed ? 'warning' : 'success' }
      );
      navigate(`/visit/${convertFrom!.appointmentId}`);
    },
    onError: (e) => {
      console.error('Failed to convert the visit to a follow-up:', e);
      enqueueSnackbar('Could not convert this visit to a follow-up. Please try again.', { variant: 'error' });
    },
  });

  const handleContinue = (): void => {
    if (!selectedParentEncounter || !parentEncounterId) {
      setError('Please select an initial visit');
      return;
    }

    if (convertFrom) {
      convertMutation.mutate();
      return;
    }

    const followUpOptions: FollowUpOptions = {
      parentEncounterId,
      ...(shouldSkipDiagnosis() && { skipPatientDiagnosis: true }),
    };

    navigate('/visits/add', {
      state: {
        followUpOptions,
        parentLocation: selectedParentEncounter.location,
        prefill: getFollowupPrefill(selectedParentEncounter.appointment),
        patientId: patientId,
        clientCopyFields: copyableFieldKeys(),
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
    if (convertFrom) {
      navigate(`/visit/${convertFrom.appointmentId}`);
    } else if (patientId) {
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
                const disabledReason = disabledReasonFor(field);
                const alreadyPresent = alreadyPresentOnTarget(field);
                const checkbox = (
                  <FormControlLabel
                    key={field.key}
                    disabled={!!disabledReason}
                    control={
                      <Checkbox
                        size="small"
                        checked={!disabledReason && checkedFields[field.key]}
                        onChange={(e) => setCheckedFields((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                      />
                    }
                    label={
                      alreadyPresent ? (
                        <>
                          {field.label}{' '}
                          <Typography component="span" variant="body2" color="text.secondary">
                            (this visit already has {field.label})
                          </Typography>
                        </>
                      ) : (
                        field.label
                      )
                    }
                  />
                );
                if (!disabledReason) return checkbox;
                return (
                  <Tooltip key={field.key} title={disabledReason} placement="right">
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
            loading={isChartDataLoading || convertMutation.isPending}
            disabled={!selectedParentEncounter}
            sx={{ borderRadius: 100, textTransform: 'none', fontWeight: 600 }}
          >
            {convertFrom ? 'Convert to Follow-up' : 'Continue to Add Visit'}
          </LoadingButton>
        </Box>
      </Grid>
    </Grid>
  );
}

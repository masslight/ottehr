import { otherColors } from '@ehrTheme/colors';
import {
  FormControl,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  HISTORY_OBTAINED_FROM_FIELD,
  HistorySourceKeys,
  historySourceLabels,
  ObservationHistoryObtainedFromDTO,
  ObservationSeenInLastThreeYearsDTO,
  ObservationTextFieldDTO,
  PATIENT_VACCINATION_STATUS,
  PatientVaccinationDTO,
  PatientVaccinationKeys,
  patientVaccinationLabels,
  RecentVisitKeys,
  recentVisitLabels,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore, useDebounce, useDeleteChartData } from '../../../../telemed';
import { useOystehrAPIClient } from '../../../../telemed/hooks/useOystehrAPIClient';
import { useNavigationContext } from '../../context/NavigationContext';
import { useChartData } from '../../hooks/useChartData';

const AskThePatientComponent = (): React.ReactElement => {
  const apiClient = useOystehrAPIClient();
  const theme = useTheme();
  const { chartData, updateObservation, encounter } = getSelectors(useAppointmentStore, [
    'chartData',
    'updateObservation',
    'encounter',
  ]);
  const { refetch: refetchChartData, isLoading: isChartDataLoading } = useChartData({
    encounterId: encounter?.id || '',
    requestedFields: {
      observations: {
        _tag: ADDITIONAL_QUESTIONS_META_SYSTEM,
        _search_by: 'encounter',
      },
    },
    enabled: false,
  });
  const { mutate: deleteChartData } = useDeleteChartData();
  const { debounce } = useDebounce(1000);

  const [recentVisitKey, setRecentVisitKey] = useState<RecentVisitKeys | ''>('');
  const [patientVaccinationKey, setPatientVaccinationKey] = useState<PatientVaccinationKeys | null>(null);
  const [vaccinationNotes, setVaccinationNotes] = useState<string>('');
  const [historySourceKey, setHistorySourceKey] = useState<HistorySourceKeys | ''>('');
  const [otherReason, setOtherReason] = useState<string>('');

  const [historySourceUpdating, setHistorySourceUpdating] = useState(false);
  const [patientVaccinationUpdating, setPatientVaccinationUpdating] = useState(false);
  const [vaccinationNotesUpdating, setVaccinationNotesUpdating] = useState(false);
  const [recentVisitUpdating, setRecentVisitUpdating] = useState(false);

  const { setNavigationDisable } = useNavigationContext();

  setNavigationDisable({ isAskPatientFieldsUpdating: recentVisitUpdating || historySourceUpdating });

  const currentSeenInLastThreeYearsObs = chartData?.observations?.find(
    (obs) => obs.field === SEEN_IN_LAST_THREE_YEARS_FIELD
  ) as ObservationSeenInLastThreeYearsDTO | undefined;

  const currentHistoryObtainedFromObs = chartData?.observations?.find(
    (obs) => obs.field === HISTORY_OBTAINED_FROM_FIELD
  ) as ObservationHistoryObtainedFromDTO | undefined;

  const currentPatientVaccinationFromObs = chartData?.observations?.find(
    (obs) => obs.field === PATIENT_VACCINATION_STATUS
  ) as PatientVaccinationDTO | undefined;

  useEffect(() => {
    const seenInLastThreeYearsObs = chartData?.observations?.find(
      (obs) => obs.field === SEEN_IN_LAST_THREE_YEARS_FIELD
    ) as ObservationSeenInLastThreeYearsDTO | undefined;

    const historyObtainedFromObs = chartData?.observations?.find((obs) => obs.field === HISTORY_OBTAINED_FROM_FIELD) as
      | ObservationHistoryObtainedFromDTO
      | undefined;

    const patientVaccinationFromObs = chartData?.observations?.find(
      (obs) => obs.field === PATIENT_VACCINATION_STATUS
    ) as PatientVaccinationDTO | undefined;

    if (seenInLastThreeYearsObs?.value) {
      setRecentVisitKey(seenInLastThreeYearsObs.value);
    }

    if (historyObtainedFromObs?.value) {
      setHistorySourceKey(historyObtainedFromObs.value);
      if (historyObtainedFromObs.value === HistorySourceKeys.NotObtainedOther) {
        setOtherReason(historyObtainedFromObs.note);
      }
    }

    if (patientVaccinationFromObs?.value) {
      setPatientVaccinationKey(patientVaccinationFromObs.value);
    }
    if (patientVaccinationFromObs?.note) {
      setVaccinationNotes(patientVaccinationFromObs?.note);
    }
  }, [chartData]);

  const handleSaveObservation = async (
    observation: ObservationTextFieldDTO,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
  ): Promise<void> => {
    setIsLoading(true);

    try {
      const result = await apiClient?.saveChartData?.({
        encounterId: encounter?.id || '',
        observations: [observation],
      });

      if (result?.chartData?.observations?.[0]) {
        updateObservation(result.chartData.observations[0]);
      }
    } catch {
      enqueueSnackbar('An error occurred while saving the information. Please try again.', {
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecentVisitChange = (value: RecentVisitKeys): void => {
    setRecentVisitKey(value);
    void handleSaveObservation(
      currentSeenInLastThreeYearsObs
        ? { ...currentSeenInLastThreeYearsObs, value }
        : {
            field: SEEN_IN_LAST_THREE_YEARS_FIELD,
            value,
          },
      setRecentVisitUpdating
    );
  };

  const handleHistorySourceChange = (value: HistorySourceKeys): void => {
    if (value === HistorySourceKeys.NotObtainedOther) {
      setHistorySourceKey(HistorySourceKeys.NotObtainedOther);
    } else {
      void handleSaveObservation(
        currentHistoryObtainedFromObs
          ? { ...currentHistoryObtainedFromObs, value }
          : {
              field: HISTORY_OBTAINED_FROM_FIELD,
              value,
            },
        setHistorySourceUpdating
      );
    }
  };

  const handlePatientVaccinationStatusChange = (value: PatientVaccinationKeys): void => {
    setPatientVaccinationKey(value);
    const curValues: PatientVaccinationDTO = {
      field: PATIENT_VACCINATION_STATUS,
      value,
    };
    if (vaccinationNotes) {
      curValues['note'] = vaccinationNotes;
    }
    void handleSaveObservation(
      currentPatientVaccinationFromObs
        ? { ...currentPatientVaccinationFromObs, value }
        : {
            ...curValues,
          },
      setPatientVaccinationUpdating
    );
  };

  const handleVaccinationNotesChange = (vaccinationNoteInput: string): void => {
    debounce(() => {
      if (!patientVaccinationKey) {
        enqueueSnackbar('Please select a vaccination status above', { variant: 'error' });
        return;
      }
      const curValues: PatientVaccinationDTO = {
        field: PATIENT_VACCINATION_STATUS,
        value: patientVaccinationKey,
      };
      if (vaccinationNoteInput) {
        void handleSaveObservation(
          {
            ...currentPatientVaccinationFromObs,
            ...curValues,
            note: vaccinationNoteInput,
          },
          setVaccinationNotesUpdating
        );
      } else if (currentPatientVaccinationFromObs) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { note, ...patientVaccinationFromObsNoNote } = currentPatientVaccinationFromObs; // remove the note
        void handleSaveObservation(
          {
            ...patientVaccinationFromObsNoNote,
            ...curValues,
          },
          setVaccinationNotesUpdating
        );
      } else {
        void handleSaveObservation(
          {
            ...curValues,
          },
          setVaccinationNotesUpdating
        );
      }
    });
  };

  const handleOtherReasonChange = (value: string): void => {
    debounce(() => {
      if (value) {
        void handleSaveObservation(
          {
            ...currentHistoryObtainedFromObs,
            field: HISTORY_OBTAINED_FROM_FIELD,
            value: HistorySourceKeys.NotObtainedOther,
            note: value,
          },
          setHistorySourceUpdating
        );
      } else if (currentHistoryObtainedFromObs) {
        setHistorySourceUpdating(true);

        // TODO check if onError cb works correctly
        deleteChartData(
          { observations: [currentHistoryObtainedFromObs] },
          {
            onSuccess: async () => {
              await refetchChartData();
              setHistorySourceUpdating(false);
            },
            onError: () => {
              setHistorySourceUpdating(false);
            },
          }
        );
      }
    });
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant="subtitle2" sx={{ color: otherColors.orange700, mb: 2 }}>
            ASK THE PATIENT
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Grid item xs={6}>
            <Typography
              sx={{
                color: theme.palette.primary.dark,
                mb: 1,
                fontWeight: 'bold',
              }}
            >
              Has the patient been seen in one of our offices / telemed in last 3 years?
            </Typography>

            <FormControl component="fieldset" disabled={recentVisitUpdating || isChartDataLoading}>
              <RadioGroup
                row
                value={recentVisitKey}
                onChange={(e) => handleRecentVisitChange(e.target.value as RecentVisitKeys)}
              >
                {Object.values(RecentVisitKeys).map((key) => (
                  <FormControlLabel key={key} value={key} control={<Radio />} label={recentVisitLabels[key]} />
                ))}
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <Typography
              sx={{
                color: theme.palette.primary.dark,
                mt: 2,
                mb: 1,
                fontWeight: 'bold',
              }}
            >
              Has the patient received vaccinations?
            </Typography>

            <FormControl component="fieldset" disabled={patientVaccinationUpdating || isChartDataLoading}>
              <RadioGroup
                row
                value={patientVaccinationKey}
                onChange={(e) => handlePatientVaccinationStatusChange(e.target.value as PatientVaccinationKeys)}
              >
                {Object.values(PatientVaccinationKeys).map((key) => (
                  <FormControlLabel key={key} value={key} control={<Radio />} label={patientVaccinationLabels[key]} />
                ))}
              </RadioGroup>
            </FormControl>

            <TextField
              fullWidth
              label="Vaccination notes"
              variant="outlined"
              sx={{ mt: 2 }}
              value={vaccinationNotes}
              onChange={(e) => {
                setVaccinationNotes(e.target.value);
                handleVaccinationNotesChange(e.target.value);
              }}
              disabled={vaccinationNotesUpdating || isChartDataLoading}
            />
          </Grid>
          <Grid item xs={6}>
            <Typography
              sx={{
                color: theme.palette.primary.dark,
                mt: 2,
                mb: 1,
                fontWeight: 'bold',
              }}
            >
              History obtained from
            </Typography>

            <FormControl fullWidth>
              <Select
                value={historySourceKey}
                onChange={(e) => handleHistorySourceChange(e.target.value as HistorySourceKeys)}
                displayEmpty
                disabled={historySourceUpdating || isChartDataLoading}
                renderValue={(selected) =>
                  selected ? historySourceLabels[selected as HistorySourceKeys] : 'Select an option'
                }
              >
                <MenuItem value="">
                  <em>Select an option</em>
                </MenuItem>
                {Object.values(HistorySourceKeys).map((key) => (
                  <MenuItem key={key} value={key}>
                    {historySourceLabels[key]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {historySourceKey === HistorySourceKeys.NotObtainedOther && (
              <TextField
                fullWidth
                placeholder="Please specify*"
                variant="outlined"
                sx={{ mt: 2 }}
                value={otherReason}
                onChange={(e) => {
                  setOtherReason(e.target.value);
                  handleOtherReasonChange(e.target.value);
                }}
                disabled={historySourceUpdating || isChartDataLoading}
              />
            )}
          </Grid>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default AskThePatientComponent;

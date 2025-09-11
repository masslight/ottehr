import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import {
  Box,
  Button,
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
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React, { useCallback, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAppointmentData, useChartData, useDebounce, useDeleteChartData } from 'src/telemed';
import { useOystehrAPIClient } from 'src/telemed/hooks/useOystehrAPIClient';
import {
  ADDITIONAL_QUESTIONS_META_SYSTEM,
  ChartDataFields,
  Field,
  getFhirValueOrFallback,
  getFieldById,
  getNoteFieldById,
  ObservationDTO,
  patientScreeningQuestionsConfig,
} from 'utils';
import { useScreeningQuestionsHandler } from './useScreeningQuestionsHandler';

const CustomCalendarActionBar = ({
  onAccept,
  onClear,
}: {
  onAccept: () => void;
  onClear: () => void;
}): React.ReactElement => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, p: 1, borderBottom: '1px solid #e0e0e0' }}>
      <Button variant="outlined" size="large" onClick={onClear}>
        Clear
      </Button>
      <Button variant="contained" size="large" onClick={onAccept}>
        Apply
      </Button>
    </Box>
  );
};

const AskThePatient = (): React.ReactElement => {
  const { control, setValue, watch } = useForm();
  const theme = useTheme();
  const apiClient = useOystehrAPIClient();
  const { encounter } = useAppointmentData();
  const { chartData, updateObservation, chartDataSetState } = useChartData();
  const [fieldLoadingState, setFieldLoadingState] = useState<Record<string, boolean>>({});

  const { isLoading: isChartDataLoading } = useChartData({
    requestedFields: {
      observations: {
        _tag: ADDITIONAL_QUESTIONS_META_SYSTEM,
        _search_by: 'encounter',
      },
    },
    enabled: false,
  });

  const { mutateAsync: _deleteChartData } = useDeleteChartData();
  const { debounce } = useDebounce(1000);
  const [tempDateRanges, setTempDateRanges] = useState<Record<string, [DateTime | null, DateTime | null]>>({});
  const [calendarOpen, setCalendarOpen] = useState<Record<string, boolean>>({});
  const [originalDateRanges, setOriginalDateRanges] = useState<Record<string, [DateTime | null, DateTime | null]>>({});

  // Watch all fields values
  const watchedValues = watch();

  const getFieldDisplayName = useCallback((fieldId: string): string => {
    const field = getFieldById(fieldId);

    if (field) {
      return field.question;
    }

    const noteFieldInfo = getNoteFieldById(fieldId);

    if (noteFieldInfo) {
      return noteFieldInfo.noteField.label || noteFieldInfo.field.question;
    }

    return fieldId;
  }, []);

  const setLoading = useCallback(
    (fieldId: string, isLoading: boolean): void => {
      setFieldLoadingState((prev) => ({
        ...prev,
        [fieldId]: isLoading,
      }));
    },
    [setFieldLoadingState]
  );

  const getObservation = useCallback(
    (fhirField: string): ObservationDTO | undefined => {
      return chartData?.observations?.find((obs: ObservationDTO) => obs.field === fhirField);
    },
    [chartData]
  );

  // returns observation with values from form
  const getUiData = useCallback(
    (fhirField: string): ObservationDTO | undefined => {
      const baseObservation = getObservation(fhirField);
      const field = patientScreeningQuestionsConfig.fields.find((f) => f.fhirField === fhirField);

      if (!baseObservation) return undefined;

      if (!field || !watchedValues) return baseObservation;

      const updatedObservation = { ...baseObservation };

      if (field.id in watchedValues) {
        updatedObservation.value = getFhirValueOrFallback(field, watchedValues[field.id]);
      }

      if (field.noteField && field.noteField.id in watchedValues) {
        const noteValue = watchedValues[field.noteField.id] as string;
        (updatedObservation as ObservationDTO & { note?: string }).note = noteValue || undefined;
      }

      return updatedObservation;
    },
    [getObservation, watchedValues]
  );

  const saveObservation = useCallback(
    async (observation: ObservationDTO, fieldId: string): Promise<void> => {
      setLoading(fieldId, true);
      const originalObservation = getObservation(observation.field);

      try {
        const result = await apiClient?.saveChartData?.({
          encounterId: encounter.id || '',
          observations: [observation],
        });

        if (result?.chartData?.observations?.[0]) {
          updateObservation(result.chartData.observations[0]);
        }
      } catch (error) {
        if (originalObservation) {
          updateObservation(originalObservation);
        }

        console.error('Error saving observation:', error);
        const fieldDisplayName = getFieldDisplayName(fieldId);

        enqueueSnackbar(
          `An error occurred while saving the answer for question: "${fieldDisplayName}". Please try again.`,
          {
            variant: 'error',
          }
        );
      } finally {
        setLoading(fieldId, false);
      }
    },
    [setLoading, getObservation, apiClient, encounter.id, updateObservation, getFieldDisplayName]
  );

  const deleteChartData = useCallback(
    async (
      chartDataFields: ChartDataFields,
      options?: {
        onSuccess?: () => void | Promise<void>;
        onError?: (error: any) => void;
      }
    ) => {
      try {
        await _deleteChartData(chartDataFields);

        const observationsToDelete = chartDataFields.observations || [];
        const fieldsToRemove = observationsToDelete.map((obs) => obs.field);

        chartDataSetState((state) => {
          if (!state.chartData?.observations) return state;

          const updatedObservations = state.chartData.observations.filter(
            (observation) => !fieldsToRemove.includes(observation.field)
          );

          return {
            ...state,
            chartData: {
              ...state.chartData,
              observations: updatedObservations,
            },
          };
        });

        if (options?.onSuccess) {
          await options.onSuccess();
        }
      } catch (error) {
        console.error('Failed to delete chart data:', error);

        if (options?.onError) {
          options.onError(error);
        }

        throw error;
      }
    },
    [_deleteChartData, chartDataSetState]
  );

  const deleteObservation = useCallback(
    async (observation: ObservationDTO, fieldId: string): Promise<void> => {
      setLoading(fieldId, true);

      const originalObservation = getObservation(observation.field);

      await deleteChartData(
        { observations: [observation] },
        {
          onSuccess: async () => {
            setLoading(fieldId, false);
          },
          onError: () => {
            if (originalObservation) {
              updateObservation(originalObservation);
            }
            setLoading(fieldId, false);
          },
        }
      );
    },
    [deleteChartData, getObservation, setLoading, updateObservation]
  );

  const { handleFieldChange, initialValues } = useScreeningQuestionsHandler({
    chartData,
    debounce,
    currentFormValues: watchedValues,
    deleteObservation,
    saveObservation,
    getUiData,
  });

  const isInitialized = useRef(false);

  // Set initial values
  React.useEffect(() => {
    if (isInitialized.current) {
      return;
    }

    if (!initialValues || Object.keys(initialValues).length === 0) {
      return;
    }

    Object.entries(initialValues).forEach(([fieldId, value]) => {
      const fieldConfig = patientScreeningQuestionsConfig.fields.find((f) => f.id === fieldId);

      if (fieldConfig?.type === 'dateRange' && Array.isArray(value) && value.length === 2) {
        const convertedValue: [DateTime | null, DateTime | null] = [
          value[0] && typeof value[0] === 'string'
            ? DateTime.fromISO(value[0]).isValid
              ? DateTime.fromISO(value[0])
              : null
            : null,
          value[1] && typeof value[1] === 'string'
            ? DateTime.fromISO(value[1]).isValid
              ? DateTime.fromISO(value[1])
              : null
            : null,
        ];
        setValue(fieldId, convertedValue);
      } else {
        setValue(fieldId, value);
      }
    });

    isInitialized.current = true;
  }, [initialValues, setValue]);

  // Function to check visibility of conditional note field based on configuration
  const getIsNoteFieldVisible = useCallback(
    (field: Field): boolean => {
      if (!field.noteField) return false;

      const parentValue = watchedValues[field.id];

      if (!parentValue) return false;

      if (!field.noteField.conditionalValue) return true;

      const fhirValue = getFhirValueOrFallback(field, parentValue);

      return field.noteField.conditionalValue === fhirValue;
    },
    [watchedValues]
  );

  // Clear note fields when they become invisible
  React.useEffect(() => {
    patientScreeningQuestionsConfig.fields.forEach((field) => {
      if (field.noteField) {
        const currentNoteValue = watchedValues[field.noteField.id];

        if (!getIsNoteFieldVisible(field) && currentNoteValue) {
          setValue(field.noteField.id, '');
        }
      }
    });
  }, [watchedValues, setValue, handleFieldChange, getIsNoteFieldVisible]);

  const renderField = (field: Field): React.ReactNode => {
    const isFieldDisabled =
      Boolean(fieldLoadingState[field.id]) ||
      (field?.noteField && Boolean(fieldLoadingState[field?.noteField?.id])) ||
      isChartDataLoading;

    switch (field.type) {
      case 'radio':
        return (
          <Grid item xs={12} key={field.id}>
            <Typography
              sx={{
                color: theme.palette.primary.dark,
                mt: 2,
                mb: 1,
                fontWeight: 'bold',
              }}
            >
              {field.question}
              {field.required && '*'}
            </Typography>

            <Box sx={{ display: 'flex', width: '100%' }}>
              <Box sx={{ flex: '0 0 auto', marginRight: '40px' }}>
                <Controller
                  name={field.id}
                  control={control}
                  defaultValue=""
                  render={({ field: formField }) => (
                    <FormControl component="fieldset" disabled={isFieldDisabled}>
                      <RadioGroup
                        {...formField}
                        row
                        onChange={(e) => {
                          formField.onChange(e);
                          handleFieldChange?.(field.id, e.target.value);
                        }}
                      >
                        {field.options?.map((option) => (
                          <FormControlLabel
                            key={option.value}
                            value={option.value}
                            control={<Radio />}
                            label={option.label}
                            sx={{ marginRight: '20px' }}
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                  )}
                />
              </Box>

              {field.noteField && getIsNoteFieldVisible(field) && (
                <Controller
                  name={field.noteField.id}
                  control={control}
                  defaultValue=""
                  render={({ field: noteFormField }) => (
                    <Box sx={{ flex: '1' }}>
                      <TextField
                        {...noteFormField}
                        label={field.noteField!.label}
                        placeholder={field.noteField!.placeholder}
                        variant="outlined"
                        sx={{ width: '300px' }}
                        disabled={isFieldDisabled}
                        onChange={(e) => {
                          noteFormField.onChange(e);
                          handleFieldChange?.(field.noteField!.id, e.target.value);
                        }}
                      />
                    </Box>
                  )}
                />
              )}
            </Box>
          </Grid>
        );

      case 'dateRange':
        return (
          <Grid item xs={12} key={field.id}>
            <Grid item xs={6}>
              <Typography
                sx={{
                  color: theme.palette.primary.dark,
                  mt: 2,
                  mb: 1,
                  fontWeight: 'bold',
                }}
              >
                {field.question}
              </Typography>

              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <Controller
                  name={field.id}
                  control={control}
                  defaultValue={[null, null] as [DateTime | null, DateTime | null]}
                  render={({ field: formField }) => {
                    const dateRangeValue: [DateTime | null, DateTime | null] =
                      Array.isArray(formField.value) && formField.value.length === 2
                        ? (formField.value as [DateTime | null, DateTime | null])
                        : [null, null];

                    const tempValue = tempDateRanges[field.id] || dateRangeValue;
                    const isOpen = calendarOpen[field.id] || false;

                    const handleOpen = (): void => {
                      setCalendarOpen((prev) => ({ ...prev, [field.id]: true }));
                      setOriginalDateRanges((prev) => ({ ...prev, [field.id]: dateRangeValue }));
                      setTempDateRanges((prev) => ({ ...prev, [field.id]: dateRangeValue }));
                    };

                    const handleClose = (): void => {
                      setCalendarOpen((prev) => ({ ...prev, [field.id]: false }));
                      const originalValue = originalDateRanges[field.id];
                      const currentTempValue = tempDateRanges[field.id];

                      const hasChanges =
                        currentTempValue &&
                        originalValue &&
                        (currentTempValue[0]?.toISO() !== originalValue[0]?.toISO() ||
                          currentTempValue[1]?.toISO() !== originalValue[1]?.toISO());

                      if (hasChanges) {
                        enqueueSnackbar(
                          'Changes were not saved. Click "Apply" in the calendar to save your date selection.',
                          {
                            variant: 'warning',
                          }
                        );
                      }

                      if (originalValue) {
                        formField.onChange(originalValue);
                        setTempDateRanges((prev) => {
                          const newState = { ...prev };
                          delete newState[field.id];
                          return newState;
                        });
                      }
                    };

                    const handleApply = (): void => {
                      const finalValue = tempDateRanges[field.id] || dateRangeValue;
                      formField.onChange(finalValue);
                      const hasAllDates = finalValue[0] && finalValue[1];

                      if (hasAllDates) {
                        const stringValue = finalValue.map((date) => (date && date.isValid ? date.toISO() : null)) as [
                          string | null,
                          string | null,
                        ];
                        handleFieldChange?.(field.id, stringValue);
                      } else {
                        enqueueSnackbar('Please select both start and end dates.', {
                          variant: 'warning',
                        });
                        return;
                      }

                      setTempDateRanges((prev) => {
                        const newState = { ...prev };
                        delete newState[field.id];
                        return newState;
                      });

                      setCalendarOpen((prev) => ({ ...prev, [field.id]: false }));
                    };

                    const handleClear = (): void => {
                      const existingObservation = chartData?.observations?.find((obs) => obs.field === field.fhirField);
                      console.log(111111111, existingObservation?.resourceId);
                      if (existingObservation?.resourceId) {
                        const clearedValue: [DateTime | null, DateTime | null] = [null, null];
                        formField.onChange(clearedValue);
                        handleFieldChange?.(field.id, null);

                        setTempDateRanges((prev) => {
                          const newState = { ...prev };
                          delete newState[field.id];
                          return newState;
                        });
                      }

                      setCalendarOpen((prev) => ({ ...prev, [field.id]: false }));
                    };

                    return (
                      <DateRangePicker
                        open={isOpen}
                        onOpen={handleOpen}
                        onClose={handleClose}
                        disableCloseOnSelect={true}
                        closeOnSelect={false}
                        value={tempValue}
                        disabled={isFieldDisabled}
                        slots={{
                          field: SingleInputDateRangeField,
                          layout: ({ children }) => (
                            <Box>
                              <CustomCalendarActionBar onAccept={handleApply} onClear={handleClear} />
                              {children}
                            </Box>
                          ),
                        }}
                        slotProps={{
                          field: {
                            // @ts-expect-error - this interface is correct
                            sx: { width: 300 },
                            readOnly: true,
                            InputProps: {
                              endAdornment: (
                                <CalendarTodayIcon
                                  sx={{
                                    color: '#6b7280',
                                    cursor: 'pointer',
                                    '&:hover': { color: '#374151' },
                                  }}
                                />
                              ),
                            },
                          },
                          popper: {
                            sx: {
                              '& .MuiPickersLayout-root': {
                                display: 'flex',
                                flexDirection: 'column',
                              },
                              '& .MuiPickersLayout-root > .MuiBox-root:first-child': {
                                order: -1,
                                borderBottom: '1px solid #e0e0e0',
                                backgroundColor: '#f9f9f9',
                              },
                              '& .MuiDateRangeCalendar-root': {
                                order: 1,
                              },
                            },
                          },
                        }}
                        onChange={(value) => {
                          const safeValue: [DateTime | null, DateTime | null] = value || [null, null];
                          setTempDateRanges((prev) => ({
                            ...prev,
                            [field.id]: safeValue,
                          }));
                        }}
                      />
                    );
                  }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        );

      case 'select':
        return (
          <Grid item xs={12} key={field.id}>
            <Grid item xs={6}>
              <Typography
                sx={{
                  color: theme.palette.primary.dark,
                  mt: 2,
                  mb: 1,
                  fontWeight: 'bold',
                }}
              >
                {field.question}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start',
                  '@media (max-width: 1650px)': {
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  },
                }}
              >
                <Controller
                  name={field.id}
                  control={control}
                  defaultValue=""
                  render={({ field: formField }) => (
                    <FormControl
                      fullWidth
                      sx={{
                        maxWidth: '450px',
                        '@media (max-width: 1650px)': {
                          maxWidth: 'none',
                        },
                      }}
                    >
                      <Select
                        {...formField}
                        displayEmpty
                        disabled={isFieldDisabled}
                        onChange={(e) => {
                          formField.onChange(e);
                          handleFieldChange?.(field.id, e.target.value);
                        }}
                        renderValue={(selected) =>
                          selected ? field.options?.find((opt) => opt.value === selected)?.label : 'Select an option'
                        }
                      >
                        <MenuItem value="">
                          <em>Select an option</em>
                        </MenuItem>
                        {field.options?.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
                {field.noteField && getIsNoteFieldVisible(field) && (
                  <Controller
                    name={field.noteField.id}
                    control={control}
                    defaultValue=""
                    render={({ field: noteFormField }) => (
                      <TextField
                        {...noteFormField}
                        label={field.noteField!.label}
                        placeholder={field.noteField!.placeholder}
                        variant="outlined"
                        sx={{
                          maxWidth: '300px',
                          '@media (max-width: 1650px)': {
                            maxWidth: 'none',
                          },
                        }}
                        disabled={isFieldDisabled}
                        onChange={(e) => {
                          noteFormField.onChange(e);
                          handleFieldChange?.(field.noteField!.id, e.target.value);
                        }}
                      />
                    )}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        );

      case 'text':
        return (
          <Grid item xs={12} key={field.id}>
            <Grid item xs={6}>
              <Typography
                sx={{
                  color: theme.palette.primary.dark,
                  mt: 2,
                  mb: 1,
                  fontWeight: 'bold',
                }}
              >
                {field.question}
                {field.required && '*'}
              </Typography>
              <Controller
                name={field.id}
                control={control}
                defaultValue=""
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    placeholder={field.placeholder}
                    variant="outlined"
                    fullWidth
                    disabled={isFieldDisabled}
                    onChange={(e) => {
                      formField.onChange(e);
                      handleFieldChange?.(field.id, e.target.value);
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        );

      case 'textarea':
        return (
          <Grid item xs={12} key={field.id}>
            <Grid item xs={6}>
              <Typography
                sx={{
                  color: theme.palette.primary.dark,
                  mt: 2,
                  mb: 1,
                  fontWeight: 'bold',
                }}
              >
                {field.question}
                {field.required && '*'}
              </Typography>
              <Controller
                name={field.id}
                control={control}
                defaultValue=""
                render={({ field: formField }) => (
                  <TextField
                    {...formField}
                    placeholder={field.placeholder}
                    variant="outlined"
                    fullWidth
                    disabled={isFieldDisabled}
                    onChange={(e) => {
                      formField.onChange(e);
                      handleFieldChange?.(field.id, e.target.value);
                    }}
                  />
                )}
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Grid container>
        <Grid item xs={12}>
          <Typography variant="subtitle2" sx={{ color: '#ea580c', mb: 2 }}>
            {patientScreeningQuestionsConfig.title}
          </Typography>
        </Grid>

        {patientScreeningQuestionsConfig.fields.map((field) => renderField(field))}
      </Grid>
    </Paper>
  );
};

export default AskThePatient;

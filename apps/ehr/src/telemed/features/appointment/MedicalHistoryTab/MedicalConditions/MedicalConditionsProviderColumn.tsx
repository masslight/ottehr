import { otherColors } from '@ehrTheme/colors';
import {
  Autocomplete,
  Box,
  Card,
  CircularProgress,
  debounce,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { CompleteConfiguration } from 'src/components/CompleteConfiguration';
import { APIErrorCode, IcdSearchResponse, MedicalConditionDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { useChartData } from '../../../../../features/css-module/hooks/useChartData';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { DeleteIconButton } from '../../../../components';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import { useAppointmentStore, useDeleteChartData, useGetIcd10Search, useSaveChartData } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const MedicalConditionsProviderColumn: FC = () => {
  const { encounter, chartData } = getSelectors(useAppointmentStore, ['encounter', 'chartData']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const featureFlags = useFeatureFlags();

  const { isLoading: isChartDataLoading } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: {
      conditions: {},
    },
    onSuccess: (data) => {
      useAppointmentStore.setState((prevState) => ({
        ...prevState,
        chartData: {
          ...prevState.chartData,
          patientId: prevState.chartData?.patientId || '',
          conditions: data.conditions,
        },
      }));
    },
  });

  const conditions = chartData?.conditions || [];
  const length = conditions.length;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn}
    >
      {isChartDataLoading && <ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
          data-testid={dataTestIds.telemedEhrFlow.hpiMedicalConditionsList}
        >
          {conditions.map((value, index) => (
            <MedicalConditionListItem
              key={value.resourceId || `new${index}`}
              value={value}
              index={index}
              length={length}
            />
          ))}
        </Box>
      )}

      {conditions.length === 0 && isReadOnly && !isChartDataLoading && !featureFlags.css && (
        <Typography color="secondary.light">Missing. Patient input must be reconciled by provider</Typography>
      )}

      {!isReadOnly && <AddMedicalConditionField />}
    </Box>
  );
};

const setUpdatedCondition = (updatedCondition?: MedicalConditionDTO): void => {
  if (updatedCondition) {
    useAppointmentStore.setState((prevState) => ({
      chartData: {
        ...prevState.chartData!,
        conditions: prevState.chartData?.conditions?.map((condition) =>
          condition.resourceId === updatedCondition.resourceId ? updatedCondition : condition
        ),
      },
    }));
  }
};

const MedicalConditionListItem: FC<{ value: MedicalConditionDTO; index: number; length: number }> = ({
  value,
  index,
  length,
}) => {
  const [note, setNote] = useState(value.note || '');
  const areNotesEqual = note.trim() === (value.note || '');

  const featureFlags = useFeatureFlags();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { mutate: updateChartData, isLoading: isUpdateLoading } = useSaveChartData();
  const { mutate: deleteChartData, isLoading: isDeleteLoading } = useDeleteChartData();
  const isLoading = isUpdateLoading || isDeleteLoading;
  const isLoadingOrAwaiting = isLoading || !areNotesEqual;
  const isAlreadySaved = !!value.resourceId;

  const updateNote = useMemo(
    () =>
      debounce((input: string) => {
        updateChartData(
          {
            conditions: [{ ...value, note: input.trim() || undefined }],
          },
          {
            onSuccess: (data) => {
              const updatedCondition = data.chartData.conditions?.[0];
              setUpdatedCondition(updatedCondition);
            },
            onError: () => {
              enqueueSnackbar('An error has occurred while updating medical condition note. Please try again.', {
                variant: 'error',
              });
            },
          }
        );
      }, 1500),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.current]
  );

  const updateCurrent = (newCurrentValue: boolean): void => {
    updateChartData(
      {
        conditions: [{ ...value, current: newCurrentValue, note: newCurrentValue ? undefined : value.note }],
      },
      {
        onSuccess: (data) => {
          if (newCurrentValue) {
            setNote('');
          }
          const updatedCondition = data.chartData.conditions?.[0];
          setUpdatedCondition(updatedCondition);
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while updating medical condition status. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  const deleteCondition = (): void => {
    deleteChartData(
      {
        conditions: [value],
      },
      {
        onSuccess: () => {
          useAppointmentStore.setState((prevState) => ({
            chartData: {
              ...prevState.chartData!,
              conditions: prevState.chartData?.conditions?.filter(
                (condition) => condition.resourceId !== value.resourceId
              ),
            },
          }));
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting medical condition. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      data-testid={dataTestIds.telemedEhrFlow.hpiMedicalConditionListItem}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            color: (theme) => (!value.current && featureFlags.css ? theme.palette.text.secondary : undefined),
          }}
        >
          {value.code} {value.display}
          {featureFlags.css &&
            isReadOnly &&
            ` | ${value.current ? 'Current' : 'Inactive now'}${value.note ? ' | Note: ' + value.note : ''}`}
        </Typography>

        {!isReadOnly && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {featureFlags.css && (
              <FormControlLabel
                control={<Switch checked={value.current} onChange={(e) => updateCurrent(e.target.checked)} />}
                label={value.current ? 'Current' : 'Inactive now'}
                disabled={isLoadingOrAwaiting || !isAlreadySaved}
                labelPlacement="start"
                sx={{
                  '& .MuiFormControlLabel-label': {
                    marginRight: 1,
                    textAlign: 'right',
                    color: (theme) => (!value.current ? theme.palette.text.secondary : undefined),
                  },
                }}
              />
            )}
            <DeleteIconButton disabled={isLoadingOrAwaiting || !isAlreadySaved} onClick={deleteCondition} />
          </Box>
        )}
      </Box>

      {!value.current && !isReadOnly && featureFlags.css && (
        <TextField
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            updateNote(e.target.value);
          }}
          disabled={(isLoading && areNotesEqual) || !isAlreadySaved}
          size="small"
          fullWidth
          label="Notes for inactive condition"
          InputProps={{
            endAdornment: !areNotesEqual && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size="20px" />
              </Box>
            ),
          }}
        />
      )}

      {index + 1 !== length && <Divider />}
    </Box>
  );
};

const AddMedicalConditionField: FC = () => {
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const { mutate: updateChartData, isLoading: isUpdateLoading } = useSaveChartData();
  const { error: icdSearchError } = useGetIcd10Search({ search: 'E11', sabs: 'ICD10CM' });

  const nlmApiKeyMissing = icdSearchError?.code === APIErrorCode.MISSING_NLM_API_KEY_ERROR;

  const methods = useForm<{ value: IcdSearchResponse['codes'][number] | null }>({
    defaultValues: { value: null },
  });
  const { control, reset } = methods;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'ICD10CM' });
  const icdSearchOptions = data?.codes || [];

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((data) => {
        console.log(data);
        setDebouncedSearchTerm(data);
      }, 800),
    []
  );

  const handleSelectOption = (data: IcdSearchResponse['codes'][number] | null): void => {
    if (data) {
      const newValue = {
        code: data.code,
        display: data.display,
        current: true,
      };
      useAppointmentStore.setState((prevState) => ({
        chartData: {
          ...prevState.chartData!,
          conditions: [...(prevState.chartData?.conditions || []), newValue],
        },
      }));
      reset({ value: null });

      updateChartData(
        { conditions: [newValue] },
        {
          onSuccess: (data) => {
            const updatedCondition = data.chartData.conditions?.[0];
            if (updatedCondition) {
              useAppointmentStore.setState((prevState) => ({
                chartData: {
                  ...prevState.chartData!,
                  conditions: prevState.chartData?.conditions?.map((conditions) =>
                    conditions.code === updatedCondition.code && !conditions.resourceId ? updatedCondition : conditions
                  ),
                },
              }));
            }
          },
          onError: () => {
            useAppointmentStore.setState((prevState) => ({
              chartData: {
                ...prevState.chartData!,
                conditions: prevState.chartData?.conditions?.filter((condition) => condition.resourceId),
              },
            }));
            enqueueSnackbar('An error has occurred while adding medical condition. Please try again.', {
              variant: 'error',
            });
          },
        }
      );
    }
  };

  const handleSetup = (): void => {
    window.open('https://docs.oystehr.com/ottehr/setup/terminology/', '_blank');
  };

  return (
    <Card
      elevation={0}
      sx={{
        p: 3,
        backgroundColor: otherColors.formCardBg,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Controller
        name="value"
        control={control}
        rules={{ required: true }}
        render={({ field: { value, onChange } }) => (
          <Autocomplete
            value={value || null}
            onChange={(_e, data) => {
              onChange((data || '') as any);
              handleSelectOption(data);
            }}
            getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
            isOptionEqualToValue={(option, value) => value.code === option.code}
            fullWidth
            size="small"
            loading={isSearching}
            blurOnSelect
            disabled={isChartDataLoading || isUpdateLoading}
            options={icdSearchOptions}
            noOptionsText={
              debouncedSearchTerm && icdSearchOptions.length === 0
                ? 'Nothing found for this search criteria'
                : 'Start typing to load results'
            }
            filterOptions={(x) => x}
            renderInput={(params) => (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  {...params}
                  onChange={(e) => debouncedHandleInputChange(e.target.value)}
                  data-testid={dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput}
                  label="Medical condition"
                  placeholder="Search"
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiInputLabel-root': {
                      fontWeight: 'bold',
                    },
                  }}
                />
                {nlmApiKeyMissing && <CompleteConfiguration handleSetup={handleSetup} />}
              </Box>
            )}
          />
        )}
      />
    </Card>
  );
};

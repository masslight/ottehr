import { otherColors } from '@ehrTheme/colors';
import {
  Autocomplete,
  Box,
  Card,
  CircularProgress,
  debounce,
  Divider,
  FormControlLabel,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { sortByRecencyAndStatus } from 'src/helpers';
import { IcdSearchResponse, MedicalConditionDTO } from 'utils';
import { useChartDataArrayValue } from '../../../hooks/useChartDataArrayValue';
import { useGetAppointmentAccessibility } from '../../../hooks/useGetAppointmentAccessibility';
import { useICD10SearchNew } from '../../../stores/appointment/appointment.queries';
import {
  ChartDataState,
  useChartData,
  useDeleteChartData,
  useSaveChartData,
} from '../../../stores/appointment/appointment.store';
import { useAppFlags } from '../../../stores/contexts/useAppFlags';
import { ProviderSideListSkeleton } from '../../ProviderSideListSkeleton';

export const MedicalConditionsProviderColumn: FC = () => {
  const { chartData, isLoading: isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const featureFlags = useAppFlags();
  const conditions = sortByRecencyAndStatus(chartData?.conditions ?? []);
  const length = conditions.length;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.medicalConditions.medicalConditionColumn}
    >
      {isChartDataLoading && <ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
          data-testid={dataTestIds.medicalConditions.medicalConditionsList}
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

      {conditions.length === 0 && isReadOnly && !isChartDataLoading && !featureFlags.isInPerson && (
        <Typography color="secondary.light">Missing. Patient input must be reconciled by provider</Typography>
      )}

      {!isReadOnly && <AddMedicalConditionField />}
    </Box>
  );
};

const setUpdatedCondition = (
  chartDataSetState: (updater: Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>)) => void,
  updatedCondition?: MedicalConditionDTO
): void => {
  if (updatedCondition) {
    chartDataSetState((prevState) => ({
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
  const featureFlags = useAppFlags();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate: updateChartData, isPending: isUpdateLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const isLoading = isUpdateLoading || isDeleteLoading;
  const isLoadingOrAwaiting = isLoading || !areNotesEqual;
  const isAlreadySaved = !!value.resourceId;
  const { chartDataSetState } = useChartData({ refetchOnMount: false });

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
              setUpdatedCondition(chartDataSetState, updatedCondition);
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
          setUpdatedCondition(chartDataSetState, updatedCondition);
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
          chartDataSetState((prevState) => ({
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
    chartDataSetState(
      (prevState) => ({
        chartData: {
          ...prevState.chartData!,
          conditions: prevState.chartData?.conditions?.filter((condition) => condition.resourceId !== value.resourceId),
        },
      }),
      { invalidateQueries: false }
    );
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      data-testid={dataTestIds.medicalConditions.medicalConditionListItem}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            color: (theme) => (!value.current && featureFlags.isInPerson ? theme.palette.text.secondary : undefined),
          }}
        >
          {value.code} {value.display}
          {featureFlags.isInPerson &&
            isReadOnly &&
            ` | ${value.current ? 'Current' : 'Inactive now'}${value.note ? ' | Note: ' + value.note : ''}`}
        </Typography>

        {!isReadOnly && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {featureFlags.isInPerson && (
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

      {!value.current && !isReadOnly && featureFlags.isInPerson && (
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
  const { chartData, isChartDataLoading, setPartialChartData } = useChartData();
  const { onSubmit, isLoading } = useChartDataArrayValue('conditions');

  const methods = useForm<{ value: IcdSearchResponse['codes'][number] | null }>({
    defaultValues: { value: null },
  });
  const { control, reset } = methods;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data } = useICD10SearchNew({ search: debouncedSearchTerm });
  const icdSearchOptions = data?.codes || [];

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((data) => {
        console.log(data);
        setDebouncedSearchTerm(data);
      }, 800),
    []
  );

  const handleSelectOption = async (data: IcdSearchResponse['codes'][number] | null): Promise<void> => {
    if (data) {
      const newValue = {
        code: data.code,
        display: data.display,
        current: true,
        lastUpdated: new Date().toISOString(),
      };

      try {
        setPartialChartData(
          {
            conditions: [...(chartData?.conditions || []), newValue],
          },
          { invalidateQueries: false }
        );
        await onSubmit(newValue);
        reset({ value: null });
      } catch {
        // Error is already handled by useChartDataArrayValue
      }
    }
  };

  if (isChartDataLoading) {
    return <Skeleton variant="rectangular" width="100%" height={56} />;
  }

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
              void handleSelectOption(data);
            }}
            getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
            isOptionEqualToValue={(option, value) => value.code === option.code}
            fullWidth
            size="small"
            loading={isSearching}
            loadingText={'Loading...'}
            blurOnSelect
            disabled={isChartDataLoading || isLoading}
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
                  data-testid={dataTestIds.medicalConditions.medicalConditionsInput}
                  label="Medical condition"
                  placeholder="Search"
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiInputLabel-root': {
                      fontWeight: 'bold',
                    },
                  }}
                />
              </Box>
            )}
          />
        )}
      />
    </Card>
  );
};

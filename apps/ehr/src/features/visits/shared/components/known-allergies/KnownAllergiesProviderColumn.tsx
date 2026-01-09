import { otherColors } from '@ehrTheme/colors';
import {
  Autocomplete,
  Box,
  Card,
  CircularProgress,
  debounce,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ErxSearchAllergensResponse } from '@oystehr/sdk';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { sortByRecencyAndStatus } from 'src/helpers';
import { AllergyDTO } from 'utils';
import { DeleteIconButton } from '../../../../../components/DeleteIconButton';
import { useChartDataArrayValue } from '../../hooks/useChartDataArrayValue';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import { ExtractObjectType, useGetAllergiesSearch } from '../../stores/appointment/appointment.queries';
import {
  ChartDataState,
  useChartData,
  useDeleteChartData,
  useSaveChartData,
} from '../../stores/appointment/appointment.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const KnownAllergiesProviderColumn: FC = () => {
  const { chartData, isLoading: isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const featureFlags = useAppFlags();
  const allergies = sortByRecencyAndStatus(chartData?.allergies ?? []);
  const length = allergies.length;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.allergies.knownAllergiesColumn}
    >
      {isChartDataLoading && <ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
          data-testid={dataTestIds.allergies.knownAllergiesList}
        >
          {allergies.map((value, index) => (
            <AllergyListItem key={value.resourceId || `new${index}`} value={value} index={index} length={length} />
          ))}
        </Box>
      )}

      {allergies.length === 0 && isReadOnly && !isChartDataLoading && !featureFlags.isInPerson && (
        <Typography color="secondary.light">Missing. Patient input must be reconciled by provider</Typography>
      )}

      {!isReadOnly && <AddAllergyField />}
    </Box>
  );
};

const setUpdatedAllergy = (
  chartDataSetState: (updater: Partial<ChartDataState> | ((state: ChartDataState) => Partial<ChartDataState>)) => void,
  updatedAllergy?: AllergyDTO
): void => {
  if (updatedAllergy) {
    // todo: check is valid
    chartDataSetState((prevState) => ({
      chartData: {
        ...prevState.chartData!,
        allergies: prevState.chartData?.allergies?.map((allergy) =>
          allergy.resourceId === updatedAllergy.resourceId ? updatedAllergy : allergy
        ),
      },
    }));
  }
};

const AllergyListItem: FC<{ value: AllergyDTO; index: number; length: number }> = ({ value, index, length }) => {
  const [note, setNote] = useState(value.note || '');
  const areNotesEqual = note.trim() === (value.note || '');
  const featureFlags = useAppFlags();
  const { chartDataSetState } = useChartData({ refetchOnMount: false });
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { mutate: updateChartData, isPending: isUpdateLoading } = useSaveChartData();
  const { mutate: deleteChartData, isPending: isDeleteLoading } = useDeleteChartData();
  const isLoading = isUpdateLoading || isDeleteLoading;
  const isLoadingOrAwaiting = isLoading || !areNotesEqual;
  const isAlreadySaved = !!value.resourceId;

  const updateNote = useMemo(
    () =>
      debounce((input: string) => {
        updateChartData(
          {
            allergies: [{ ...value, note: input.trim() || undefined }],
          },
          {
            onSuccess: (data) => {
              const updatedAllergy = data.chartData.allergies?.[0];
              setUpdatedAllergy(chartDataSetState, updatedAllergy);
            },
            onError: () => {
              enqueueSnackbar('An error has occurred while updating allergy note. Please try again.', {
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
        allergies: [{ ...value, current: newCurrentValue, note: newCurrentValue ? undefined : value.note }],
      },
      {
        onSuccess: (data) => {
          if (newCurrentValue) {
            setNote('');
          }
          const updatedAllergy = data.chartData.allergies?.[0];
          setUpdatedAllergy(chartDataSetState, updatedAllergy);
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while updating allergy status. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  const deleteAllergy = (): void => {
    // Optimistic update
    chartDataSetState(
      (prevState) => ({
        chartData: {
          ...prevState.chartData!,
          allergies: prevState.chartData?.allergies?.filter((allergy) => allergy.resourceId !== value.resourceId),
        },
      }),
      { invalidateQueries: false }
    );
    deleteChartData(
      {
        allergies: [value],
      },
      {
        onSuccess: () => {
          // No need to update again, optimistic update already applied
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting allergy. Please try again.', {
            variant: 'error',
          });
          // Rollback to previous state
          chartDataSetState((prevState) => ({
            chartData: {
              ...prevState.chartData!,
              allergies: [...(prevState.chartData?.allergies || []), value],
            },
          }));
        },
      }
    );
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      data-testid={dataTestIds.allergies.knownAllergiesListItem}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            color: (theme) => (!value.current && featureFlags.isInPerson ? theme.palette.text.secondary : undefined),
          }}
        >
          {value.name}
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
            <DeleteIconButton
              disabled={isLoadingOrAwaiting || !isAlreadySaved}
              onClick={deleteAllergy}
              dataTestId={dataTestIds.allergies.knownAllergiesListItemDeleteButton}
            />
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
          label="Notes for inactive allergy"
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

const AddAllergyField: FC = () => {
  const { chartData, isChartDataLoading, setPartialChartData } = useChartData();
  const { onSubmit, isLoading } = useChartDataArrayValue('allergies');

  const methods = useForm<{ value: ExtractObjectType<ErxSearchAllergensResponse> | null; otherAllergyName: string }>({
    defaultValues: { value: null, otherAllergyName: '' },
  });

  const { control, reset, handleSubmit } = methods;
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isOtherOptionSelected, setIsOtherOptionSelected] = useState(false);
  const { isFetching: isSearching, data } = useGetAllergiesSearch(debouncedSearchTerm);

  const allergiesSearchOptions = useMemo(() => {
    if (!data || isSearching) return [];

    // Process the data to include brand name
    const allergiesWithBrand = data.map((allergy) => {
      const brandName = allergy.brandName;
      if (brandName && brandName !== allergy.name) {
        return {
          ...allergy,
          name: `${allergy.name} (${brandName})`,
        };
      }
      return allergy;
    });

    return [...allergiesWithBrand, { name: 'Other' } as unknown as ExtractObjectType<ErxSearchAllergensResponse>];
  }, [data, isSearching]);

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((data) => {
        if (data.length > 2) {
          setDebouncedSearchTerm(data);
        }
      }, 800),
    []
  );

  const handleSelectOption = async (data: ExtractObjectType<ErxSearchAllergensResponse> | null): Promise<void> => {
    if (data) {
      const newValue = {
        name: data.name,
        id: data.id?.toString(),
        current: true,
        lastUpdated: new Date().toISOString(),
      };
      const prevAllergies = [...(chartData?.allergies ?? [])];

      try {
        setPartialChartData(
          {
            allergies: [...(chartData?.allergies || []), newValue],
          },
          { invalidateQueries: false }
        );
        await onSubmit(newValue);
        reset({ value: null, otherAllergyName: '' });
        setIsOtherOptionSelected(false);
      } catch {
        // Rollback to previous state
        setPartialChartData({
          allergies: prevAllergies,
        });
      }
    }
  };

  const onSubmitForm = async (data: {
    value: ExtractObjectType<ErxSearchAllergensResponse> | null;
    otherAllergyName: string;
  }): Promise<void> => {
    if (data.value) {
      const allergyData = {
        ...data.value,
        name: 'Other' + (data.otherAllergyName ? ` (${data.otherAllergyName})` : ''),
      };
      await handleSelectOption(allergyData);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)}>
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
                if (data?.name === 'Other') {
                  setIsOtherOptionSelected(true);
                } else {
                  setIsOtherOptionSelected(false);
                  void handleSelectOption(data);
                }
              }}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
              fullWidth
              size="small"
              loading={isSearching}
              filterOptions={(options) => options}
              isOptionEqualToValue={(option, value) => option.name === value.name}
              disablePortal
              blurOnSelect
              disabled={isChartDataLoading || isLoading}
              options={allergiesSearchOptions}
              noOptionsText={
                debouncedSearchTerm && debouncedSearchTerm.length > 2 && allergiesSearchOptions.length === 0
                  ? 'Nothing found for this search criteria'
                  : 'Start typing to load results'
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  onChange={(e) => debouncedHandleInputChange(e.target.value)}
                  data-testid={dataTestIds.allergies.knownAllergiesInput}
                  label="Agent/Substance"
                  placeholder="Search"
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiInputLabel-root': {
                      fontWeight: 'bold',
                    },
                  }}
                />
              )}
            />
          )}
        />
        {isOtherOptionSelected && (
          <Stack direction="row" spacing={2} alignItems="center">
            <Controller
              name="otherAllergyName"
              control={control}
              render={({ field: { value, onChange } }) => (
                <TextField
                  value={value || ''}
                  onChange={(e) => onChange(e.target.value)}
                  label="Other allergy"
                  placeholder="Please specify"
                  fullWidth
                  size="small"
                />
              )}
            />
            <RoundedButton type="submit" disabled={isLoading}>
              Add
            </RoundedButton>
          </Stack>
        )}
      </Card>
    </form>
  );
};

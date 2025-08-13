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
import React, { FC, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { RoundedButton } from 'src/components/RoundedButton';
import { AllergyDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { DeleteIconButton } from '../../../../components';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import {
  ExtractObjectType,
  useAppointmentStore,
  useDeleteChartData,
  useGetAllergiesSearch,
  useSaveChartData,
} from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const KnownAllergiesProviderColumn: FC = () => {
  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const featureFlags = useFeatureFlags();

  const allergies = chartData?.allergies || [];
  const length = allergies.length;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn}
    >
      {isChartDataLoading && <ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
          data-testid={dataTestIds.telemedEhrFlow.hpiKnownAllergiesList}
        >
          {allergies.map((value, index) => (
            <AllergyListItem key={value.resourceId || `new${index}`} value={value} index={index} length={length} />
          ))}
        </Box>
      )}

      {allergies.length === 0 && isReadOnly && !isChartDataLoading && !featureFlags.css && (
        <Typography color="secondary.light">Missing. Patient input must be reconciled by provider</Typography>
      )}

      {!isReadOnly && <AddAllergyField />}
    </Box>
  );
};

const setUpdatedAllergy = (updatedAllergy?: AllergyDTO): void => {
  if (updatedAllergy) {
    useAppointmentStore.setState((prevState) => ({
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

  const featureFlags = useFeatureFlags();
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
              setUpdatedAllergy(updatedAllergy);
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
          setUpdatedAllergy(updatedAllergy);
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
    deleteChartData(
      {
        allergies: [value],
      },
      {
        onSuccess: () => {
          useAppointmentStore.setState((prevState) => ({
            chartData: {
              ...prevState.chartData!,
              allergies: prevState.chartData?.allergies?.filter((allergy) => allergy.resourceId !== value.resourceId),
            },
          }));
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting allergy. Please try again.', {
            variant: 'error',
          });
        },
      }
    );
  };

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
      data-testid={dataTestIds.telemedEhrFlow.hpiKnownAllergiesListItem}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            color: (theme) => (!value.current && featureFlags.css ? theme.palette.text.secondary : undefined),
          }}
        >
          {value.name}
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
            <DeleteIconButton disabled={isLoadingOrAwaiting || !isAlreadySaved} onClick={deleteAllergy} />
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
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const { mutate: updateChartData, isPending: isUpdateLoading } = useSaveChartData();

  const methods = useForm<{ value: ExtractObjectType<ErxSearchAllergensResponse> | null; otherAllergyName: string }>({
    defaultValues: { value: null, otherAllergyName: '' },
  });
  const { control, reset, handleSubmit } = methods;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isOtherOptionSelected, setIsOtherOptionSelected] = useState(false);

  const { isFetching: isSearching, data } = useGetAllergiesSearch(debouncedSearchTerm);
  const allergiesSearchOptions = useMemo(() => {
    if (!data || isSearching) return [];

    // Process the data to include brandname
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

  const handleSelectOption = (data: ExtractObjectType<ErxSearchAllergensResponse> | null): void => {
    if (data) {
      const newValue = {
        name: data.name,
        id: data.id?.toString(),
        current: true,
      };
      useAppointmentStore.setState((prevState) => ({
        chartData: {
          ...prevState.chartData!,
          allergies: [...(prevState.chartData?.allergies || []), newValue],
        },
      }));
      reset({ value: null, otherAllergyName: '' });
      setIsOtherOptionSelected(false);

      updateChartData(
        { allergies: [newValue] },
        {
          onSuccess: (data) => {
            const updatedAllergy = data.chartData.allergies?.[0];
            if (updatedAllergy) {
              useAppointmentStore.setState((prevState) => ({
                chartData: {
                  ...prevState.chartData!,
                  allergies: prevState.chartData?.allergies?.map((allergy) =>
                    allergy.id === updatedAllergy.id && !allergy.resourceId ? updatedAllergy : allergy
                  ),
                },
              }));
            }
          },
          onError: () => {
            useAppointmentStore.setState((prevState) => ({
              chartData: {
                ...prevState.chartData!,
                allergies: prevState.chartData?.allergies?.filter((allergy) => allergy.resourceId),
              },
            }));
            enqueueSnackbar('An error has occurred while adding allergy. Please try again.', {
              variant: 'error',
            });
          },
        }
      );
    }
  };

  const onSubmit = (data: {
    value: ExtractObjectType<ErxSearchAllergensResponse> | null;
    otherAllergyName: string;
  }): void => {
    if (data.value) {
      handleSelectOption({
        ...data.value,
        name: 'Other' + (data.otherAllergyName ? ` (${data.otherAllergyName})` : ''),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
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
                  handleSelectOption(data);
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
              disabled={isChartDataLoading || isUpdateLoading}
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
                  data-testid={dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput}
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
            <RoundedButton type="submit">Add</RoundedButton>
          </Stack>
        )}
      </Card>
    </form>
  );
};

import React, { FC, useMemo, useState } from 'react';
import {
  Box,
  Divider,
  FormControlLabel,
  Switch,
  Typography,
  TextField,
  debounce,
  CircularProgress,
  Card,
  Autocomplete,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { AllergyDTO } from 'utils';
import { otherColors } from '../../../../../CustomThemeProvider';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useFeatureFlags } from '../../../../../features/css-module/context/featureFlags';
import { useGetAppointmentAccessibility } from '../../../../hooks';
import {
  AllergiesSearchResponse,
  useAppointmentStore,
  useDeleteChartData,
  useGetAllergiesSearch,
  useSaveChartData,
} from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';
import { DeleteIconButton } from '../../../../components';
import { enqueueSnackbar } from 'notistack';

export const KnownAllergiesProviderColumn: FC = () => {
  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const featureFlags = useFeatureFlags();

  const allergies = chartData?.allergies || [];
  const length = allergies.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isChartDataLoading && <ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
  const featureFlags = useFeatureFlags();
  const { mutate: updateChartData, isLoading: isUpdateLoading } = useSaveChartData();

  const methods = useForm<{ value: AllergiesSearchResponse['allergens'][number] | null }>({
    defaultValues: { value: null },
  });
  const { control, reset } = methods;

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data } = useGetAllergiesSearch(debouncedSearchTerm);
  const allergiesSearchOptions = data?.allergens || [];

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((data) => {
        console.log(data);
        setDebouncedSearchTerm(data);
      }, 800),
    []
  );

  const handleSelectOption = (data: AllergiesSearchResponse['allergens'][number] | null): void => {
    if (data) {
      const newValue = {
        name: data.name,
        id: data.id,
        current: featureFlags.css || undefined,
      };
      useAppointmentStore.setState((prevState) => ({
        chartData: {
          ...prevState.chartData!,
          allergies: [...(prevState.chartData?.allergies || []), newValue],
        },
      }));
      reset({ value: null });

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
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
            fullWidth
            size="small"
            loading={isSearching}
            disablePortal
            blurOnSelect
            disabled={isChartDataLoading || isUpdateLoading}
            options={allergiesSearchOptions}
            noOptionsText={
              debouncedSearchTerm && allergiesSearchOptions.length === 0
                ? 'Nothing found for this search criteria'
                : 'Start typing to load results'
            }
            filterOptions={(x) => x}
            renderInput={(params) => (
              <TextField
                {...params}
                onChange={(e) => debouncedHandleInputChange(e.target.value)}
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
    </Card>
  );
};

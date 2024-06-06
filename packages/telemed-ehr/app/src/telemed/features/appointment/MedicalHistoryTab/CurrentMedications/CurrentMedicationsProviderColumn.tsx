import { Autocomplete, Box, Card, TextField, Typography, debounce } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { otherColors } from '../../../../../CustomThemeProvider';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';
import { useChartDataArrayValue } from '../../../../hooks';
import { MedicationSearchResponse, useAppointmentStore, useGetMedicationsSearch } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const CurrentMedicationsProviderColumn: FC = () => {
  const methods = useForm<{ value: MedicationSearchResponse['medications'][number] | null }>({
    values: { value: null },
  });
  const { isChartDataLoading, isReadOnly } = getSelectors(useAppointmentStore, ['isChartDataLoading', 'isReadOnly']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: medications } = useChartDataArrayValue('medications', reset);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data: medSearchOptions } = useGetMedicationsSearch(debouncedSearchTerm);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChange = useCallback(
    debounce((data) => {
      console.log(data);
      setDebouncedSearchTerm(data);
    }, 800),
    []
  );

  const handleSubmitWrapper = (data: { value: MedicationSearchResponse['medications'][number] | null }): void => {
    if (data.value) {
      onSubmit({
        ...data.value,
      });
      reset({ value: null });
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          mb: (medications.length || isChartDataLoading) && !isReadOnly ? 2 : 0,
        }}
      >
        {isChartDataLoading ? (
          <ProviderSideListSkeleton />
        ) : (
          <ActionsList
            data={medications}
            getKey={(value) => value.resourceId!}
            renderItem={(value) => <Typography>{value.name}</Typography>}
            renderActions={
              isReadOnly
                ? undefined
                : (value) => <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.resourceId!)} />
            }
            divider
          />
        )}
      </Box>

      {medications.length === 0 && isReadOnly && !isChartDataLoading && (
        <Typography color="secondary.light">Missing. Patient input must be reconciled by provider</Typography>
      )}

      {!isReadOnly && (
        <form onSubmit={handleSubmit(handleSubmitWrapper)}>
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
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <Autocomplete
                  value={value}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                  fullWidth
                  isOptionEqualToValue={(option, value) => value.id === option.id}
                  loading={isSearching}
                  size="small"
                  disablePortal
                  disabled={isLoading || isChartDataLoading}
                  noOptionsText="No medications"
                  options={medSearchOptions?.medications || []}
                  onChange={(_e, data) => onChange(data)}
                  filterOptions={(x) => x}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      helperText={error ? error.message : null}
                      error={!!error}
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
                      label="Medication"
                      placeholder="Search"
                    />
                  )}
                />
              )}
            />
            <RoundedButton disabled={isLoading || isChartDataLoading} type="submit">
              Add to the medications
            </RoundedButton>
          </Card>
        </form>
      )}
    </Box>
  );
};

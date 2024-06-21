import { FC, useCallback, useState } from 'react';
import { Autocomplete, Box, Card, TextField, Typography, debounce } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { otherColors } from '../../../../../CustomThemeProvider';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useChartDataArrayValue } from '../../../../hooks';
import { AllergiesSearchResponse, useAppointmentStore, useGetAllergiesSearch } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';

// const mapOptionToLabel = {
//   food: 'Food',
//   medication: 'Medication',
//   other: 'Other',
// };

export const KnownAllergiesProviderColumn: FC = () => {
  // const methods = useForm<{
  //   agentOrSubstance: string;
  //   type: keyof typeof mapOptionToLabel;
  // }>({
  //   defaultValues: {
  //     agentOrSubstance: '',
  //     type: 'food',
  //   },
  // });
  const methods = useForm<{ value: AllergiesSearchResponse['allergens'][number] | null }>({
    values: { value: null },
  });
  const { isChartDataLoading, isReadOnly } = getSelectors(useAppointmentStore, ['isChartDataLoading', 'isReadOnly']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: allergies } = useChartDataArrayValue('allergies', reset);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data: allergiesSearchOptions } = useGetAllergiesSearch(debouncedSearchTerm);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChange = useCallback(
    debounce((data) => {
      console.log(data);
      setDebouncedSearchTerm(data);
    }, 800),
    [],
  );

  const handleSubmitWrapper = (data: { value: AllergiesSearchResponse['allergens'][number] | null }): void => {
    if (data.value) {
      onSubmit({
        name: data.value.name,
        id: data.value.id,
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
          mb: (allergies.length || isChartDataLoading) && !isReadOnly ? 2 : 0,
        }}
      >
        {isChartDataLoading ? (
          <ProviderSideListSkeleton />
        ) : (
          <ActionsList
            data={allergies}
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

      {allergies.length === 0 && isReadOnly && !isChartDataLoading && (
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
            {/* <Controller
            name="type"
            control={control}
            rules={{ required: true }}
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <FormControl>
                <FormLabel error={!!error}>
                  <Typography variant="subtitle2">Type *</Typography>
                </FormLabel>
                <RadioGroup value={value} onChange={onChange} row>
                  {(Object.keys(mapOptionToLabel) as (keyof typeof mapOptionToLabel)[]).map((option) => (
                    <FormControlLabel
                      disabled={isLoading || isChartDataLoading}
                      key={option}
                      value={option}
                      control={<Radio />}
                      label={mapOptionToLabel[option]}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          /> */}
            <Controller
              name="value"
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <Autocomplete
                  value={value || null}
                  onChange={(_e, data) => onChange(data || '')}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                  fullWidth
                  size="small"
                  loading={isSearching}
                  disablePortal
                  disabled={isLoading || isChartDataLoading}
                  options={allergiesSearchOptions?.allergens || []}
                  noOptionsText="No allergies"
                  filterOptions={(x) => x}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      helperText={error ? error.message : null}
                      error={!!error}
                      onChange={(e) => debouncedHandleInputChange(e.target.value)}
                      label="Agent/Substance"
                      placeholder="Search"
                    />
                  )}
                />
              )}
            />
            <RoundedButton disabled={isLoading || isChartDataLoading} type="submit">
              Add to the known allergies
            </RoundedButton>
          </Card>
        </form>
      )}
    </Box>
  );
};

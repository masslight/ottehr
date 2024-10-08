import { Autocomplete, Box, Card, TextField, Typography, debounce } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { IcdSearchResponse } from 'ehr-utils';
import { otherColors } from '../../../../../CustomThemeProvider';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { ActionsList, DeleteIconButton, RoundedButton } from '../../../../components';
import { useChartDataArrayValue } from '../../../../hooks';
import { useAppointmentStore, useGetIcd10Search } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';

export const MedicalConditionsProviderColumn: FC = () => {
  const methods = useForm<{ value: IcdSearchResponse['codes'][number] | null }>({
    values: { value: null },
  });
  const [isManualSearching, setIsManualSearching] = useState(false);

  const { isChartDataLoading, isReadOnly } = getSelectors(useAppointmentStore, ['isChartDataLoading', 'isReadOnly']);

  const { control, handleSubmit, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: conditions } = useChartDataArrayValue('conditions', reset);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data } = useGetIcd10Search(debouncedSearchTerm);
  const icdSearchOptions = data?.codes || [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChange = useCallback(
    debounce((data) => {
      console.log(data);
      setDebouncedSearchTerm(data);
      setIsManualSearching(false);
    }, 800),
    [],
  );

  const handleInputChange = (value: string): void => {
    setIsManualSearching(true);
    debouncedHandleInputChange(value);
  };

  const handleSubmitWrapper = (data: { value: IcdSearchResponse['codes'][number] | null }): void => {
    if (data.value) {
      onSubmit(data.value);
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
          mb: (conditions.length || isChartDataLoading) && !isReadOnly ? 2 : 0,
        }}
      >
        {isChartDataLoading ? (
          <ProviderSideListSkeleton />
        ) : (
          <ActionsList
            data={conditions}
            getKey={(value) => value.resourceId!}
            renderItem={(value) => <Typography>{`${value.code} ${value.display}`}</Typography>}
            renderActions={
              isReadOnly
                ? undefined
                : (value) => <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.resourceId!)} />
            }
            divider
          />
        )}
      </Box>

      {conditions.length === 0 && isReadOnly && !isChartDataLoading && (
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
                  getOptionLabel={(option) =>
                    typeof option === 'string' ? option : `${option.code} ${option.display}`
                  }
                  fullWidth
                  isOptionEqualToValue={(option, value) => value.code === option.code}
                  loading={isManualSearching || isSearching}
                  size="small"
                  disablePortal
                  disabled={isLoading || isChartDataLoading}
                  noOptionsText="No medical conditions"
                  options={icdSearchOptions}
                  onChange={(_e, data) => onChange(data)}
                  filterOptions={(x) => x}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      helperText={error ? error.message : null}
                      error={!!error}
                      onChange={(e) => handleInputChange(e.target.value)}
                      label="Medical condition"
                      placeholder="Start typing to see results"
                    />
                  )}
                />
              )}
            />
            <RoundedButton disabled={isLoading || isChartDataLoading} type="submit">
              Add to the medical conditions
            </RoundedButton>
          </Card>
        </form>
      )}
    </Box>
  );
};

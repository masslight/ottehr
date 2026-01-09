import { otherColors } from '@ehrTheme/colors';
import { Autocomplete, Box, Card, Stack, TextField, Typography } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ProviderSideListSkeleton } from 'src/features/visits/shared/components/ProviderSideListSkeleton';
import { useChartDataArrayValue } from 'src/features/visits/shared/hooks/useChartDataArrayValue';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { HospitalizationDTO } from 'utils';
import { HospitalizationOptions } from './hospitalizationOptions';

export const HospitalizationForm: FC = () => {
  const methods = useForm<{
    selectedHospitalization: HospitalizationDTO | null;
    otherHospitalizationName: string;
  }>({
    defaultValues: {
      selectedHospitalization: null,
      otherHospitalizationName: '',
    },
  });
  const { isLoading: isChartDataLoading } = useChartData();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { control, reset, handleSubmit } = methods;

  const { isLoading, onSubmit, onRemove, values: hospitalization } = useChartDataArrayValue('episodeOfCare', reset, {});
  const [isOtherOptionSelected, setIsOtherOptionSelected] = useState(false);

  const handleSelectOption = useCallback(
    async (data: HospitalizationDTO | null): Promise<void> => {
      if (data) {
        await onSubmit(data);
        reset({ selectedHospitalization: null, otherHospitalizationName: '' });
        setIsOtherOptionSelected(false);
      }
    },
    [onSubmit, reset]
  );

  const sortedHospitalizationOptions = useMemo(() => {
    return [
      ...HospitalizationOptions.sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase())),
      {
        display: 'Other',
        code: 'other',
      },
    ];
  }, []);

  const onSubmitForm = (data: {
    selectedHospitalization: HospitalizationDTO | null;
    otherHospitalizationName: string;
  }): void => {
    if (data.selectedHospitalization) {
      void handleSelectOption({
        ...data.selectedHospitalization,
        display: 'Other' + (data.otherHospitalizationName ? ` (${data.otherHospitalizationName})` : ''),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isReadOnly ? (
          <ActionsList
            data={hospitalization}
            getKey={(value) => value.resourceId!}
            renderItem={(value) => <Typography>{value.display}</Typography>}
            divider
          />
        ) : (
          <Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                mb: hospitalization.length || isChartDataLoading ? 2 : 0,
              }}
            >
              {isChartDataLoading ? (
                <ProviderSideListSkeleton />
              ) : (
                <ActionsList
                  itemDataTestId={dataTestIds.hospitalizationPage.hospitalizationList}
                  data={hospitalization}
                  getKey={(value) => value.resourceId!}
                  renderItem={(value) => <Typography>{value.display}</Typography>}
                  renderActions={(value) => (
                    <DeleteIconButton disabled={isLoading} onClick={() => onRemove(value.resourceId!)} />
                  )}
                  divider
                />
              )}
            </Box>
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
                name="selectedHospitalization"
                control={control}
                rules={{ required: true }}
                render={({ field: { value, onChange } }) => (
                  <Autocomplete
                    value={value || null}
                    onChange={async (_e, data) => {
                      onChange(data);
                      if (data?.display === 'Other') {
                        setIsOtherOptionSelected(true);
                      } else {
                        setIsOtherOptionSelected(false);
                        await handleSelectOption(data);
                      }
                    }}
                    fullWidth
                    size="small"
                    disabled={isLoading || isChartDataLoading}
                    options={sortedHospitalizationOptions}
                    noOptionsText="Nothing found for this search criteria"
                    getOptionLabel={(option) => `${option.display}`}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Typography component="span"> {option.display} </Typography>
                      </li>
                    )}
                    isOptionEqualToValue={(option, value) => option.code === value.code}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        data-testid={dataTestIds.hospitalizationPage.hospitalizationDropdown}
                        label="Hospitalization"
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
                    name="otherHospitalizationName"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <TextField
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        label="Other hospitalization"
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
          </Box>
        )}
      </Box>
    </form>
  );
};

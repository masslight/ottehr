import {
  Autocomplete,
  Box,
  Button,
  Card,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  debounce,
} from '@mui/material';

import { DatePicker, TimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { FC, useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MedicationDTO } from 'utils';
import { otherColors } from '@theme/colors';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useChartDataArrayValue, useGetAppointmentAccessibility } from '../../../../hooks';
import { MedicationSearchResponse, useAppointmentStore, useGetMedicationsSearch } from '../../../../state';
import { ProviderSideListSkeleton } from '../ProviderSideListSkeleton';
import { CurrentMedicationGroup } from './CurrentMedicationGroup';
import { dataTestIds } from '../../../../../constants/data-test-ids';

interface CurrentMedicationsProviderColumnForm {
  medication: MedicationSearchResponse['medications'][number] | null;
  type: MedicationDTO['type'];
  date: DateTime | null;
  time: DateTime | null;
  dose: string | null;
}

export const CurrentMedicationsProviderColumn: FC = () => {
  const methods = useForm<CurrentMedicationsProviderColumnForm>({
    defaultValues: { medication: null, time: null, dose: null, date: null, type: 'scheduled' },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { control, reset, handleSubmit } = methods;

  const {
    isLoading,
    onSubmit,
    onRemove,
    values: medications,
  } = useChartDataArrayValue('medications', undefined, {
    _sort: '-_lastUpdated',
    _include: 'MedicationStatement:source',
    status: { type: 'token', value: 'active' },
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const { isFetching: isSearching, data } = useGetMedicationsSearch(debouncedSearchTerm);
  const medSearchOptions = data?.medications || [];

  const medicationsMap: { scheduled: MedicationDTO[]; asNeeded: MedicationDTO[] } = useMemo(
    () => ({
      scheduled: medications.filter((med) => med.type === 'scheduled'),
      asNeeded: medications.filter((med) => med.type === 'as-needed'),
    }),
    [medications]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedHandleInputChange = useCallback(
    debounce((data) => {
      console.log(data);
      setDebouncedSearchTerm(data);
    }, 800),
    []
  );

  const handleFormSubmitted = async (data: CurrentMedicationsProviderColumnForm): Promise<void> => {
    if (data) {
      const success = await onSubmit({
        name: data.medication?.name || '',
        id: data.medication?.id,
        type: data.type,
        intakeInfo: {
          date: data
            .date!.set({ hour: data.time?.hour, minute: data.time?.minute })
            .toUTC()
            .toString(),
          dose: data.dose!,
        },
        status: 'active',
      });
      if (success) {
        reset({ medication: null, date: null, time: null, dose: null, type: 'scheduled' });
      }
    }
  };

  return (
    <Box>
      <Box
        data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsColumn}
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
          <>
            {medicationsMap.scheduled.length > 0 ? (
              <Box data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList}>
                <CurrentMedicationGroup
                  label="Scheduled medications"
                  medications={medicationsMap.scheduled}
                  onRemove={onRemove}
                  isLoading={isLoading}
                  dataTestId={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('scheduled')}
                ></CurrentMedicationGroup>
              </Box>
            ) : null}
            {medicationsMap.asNeeded.length > 0 ? (
              <Box data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList}>
                <CurrentMedicationGroup
                  label="As needed medications"
                  medications={medicationsMap.asNeeded}
                  onRemove={onRemove}
                  isLoading={isLoading}
                  dataTestId={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('as-needed')}
                ></CurrentMedicationGroup>
              </Box>
            ) : null}
          </>
        )}
      </Box>

      {medications.length === 0 && isReadOnly && !isChartDataLoading && (
        <Typography color="secondary.light">Missing. Patient input must be reconciled by provider</Typography>
      )}

      {!isReadOnly && (
        <form onSubmit={(event) => handleSubmit((data) => handleFormSubmitted(data))(event)}>
          <Card
            elevation={0}
            sx={{
              p: 3,
              backgroundColor: otherColors.formCardBg,
              borderRadius: 2,
              display: 'grid',
              gridTemplateColumns: 'repeat(1, 1fr)',
              gap: 2,
            }}
          >
            <Controller
              name="type"
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <RadioGroup row value={value} onChange={onChange}>
                  <FormControlLabel
                    value="scheduled"
                    data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledRadioButton}
                    control={<Radio size="small" disabled={isLoading} />}
                    label={'Scheduled medication'}
                  />
                  <FormControlLabel
                    value="as-needed"
                    data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton}
                    control={<Radio size="small" disabled={isLoading} />}
                    label={'As needed medication'}
                  />
                </RadioGroup>
              )}
            ></Controller>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
              <Controller
                name="medication"
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
                    noOptionsText={
                      debouncedSearchTerm && medSearchOptions.length === 0
                        ? 'Nothing found for this search criteria'
                        : 'Start typing to load results'
                    }
                    options={medSearchOptions}
                    onChange={(_e, data) => {
                      onChange(data);
                    }}
                    filterOptions={(x) => x}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        onChange={(e) => debouncedHandleInputChange(e.target.value)}
                        data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput}
                        label="Medication"
                        placeholder="Search"
                        required={true}
                        error={!!error}
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
              <Controller
                name="dose"
                control={control}
                rules={{ required: true }}
                render={({ field: { value, onChange }, fieldState: { error } }) => (
                  <TextField
                    value={value || ''}
                    onChange={onChange}
                    data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput}
                    required={true}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    label="Recent dose amount and units"
                    placeholder="Provide amount and units"
                    error={!!error}
                  />
                )}
              ></Controller>
              <Controller
                name="date"
                control={control}
                rules={{
                  required: true,
                  validate: (val) => {
                    return !val ? 'Provide valid date' : val?.invalidExplanation || undefined;
                  },
                }}
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <Box data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateInput}>
                    <LocalizationProvider dateAdapter={AdapterLuxon}>
                      <DatePicker
                        onChange={onChange}
                        label="Last date medication was taken"
                        value={value || null}
                        slotProps={{
                          textField: {
                            InputLabelProps: { shrink: true },
                            InputProps: { size: 'small', placeholder: 'MM/DD/YYYY' },
                            error: !!error,
                            required: true,
                          },
                        }}
                      />
                    </LocalizationProvider>
                  </Box>
                )}
              />
              <Controller
                name="time"
                control={control}
                rules={{
                  required: true,
                  validate: (val) => {
                    return !val ? 'Provide valid time' : val?.invalidExplanation || undefined;
                  },
                }}
                render={({ field: { value, onChange }, fieldState: { error } }) => (
                  <Box data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsTimeInput}>
                    <LocalizationProvider dateAdapter={AdapterLuxon}>
                      <TimePicker
                        onChange={onChange}
                        value={value || null}
                        label="Last time medication was taken"
                        slotProps={{
                          textField: {
                            InputLabelProps: { shrink: true },
                            InputProps: { size: 'small', error: !!error },
                            required: true,
                          },
                        }}
                      ></TimePicker>
                    </LocalizationProvider>
                  </Box>
                )}
              ></Controller>
            </Box>
            <Button
              variant="outlined"
              type="submit"
              disabled={isLoading}
              data-testid={dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton}
              sx={{
                borderColor: otherColors.consentBorder,
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: 14,
                maxWidth: '100px',
              }}
            >
              Add
            </Button>
          </Card>
        </form>
      )}
    </Box>
  );
};

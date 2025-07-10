import { otherColors } from '@ehrTheme/colors';
import { Autocomplete, Box, Card, Stack, TextField, Typography } from '@mui/material';
import { FC, useCallback, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { RoundedButton } from 'src/components/RoundedButton';
import { HospitalizationDTO } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import {
  ActionsList,
  DeleteIconButton,
  useAppointmentStore,
  useChartDataArrayValue,
  useGetAppointmentAccessibility,
} from '../../../../telemed';
import { ProviderSideListSkeleton } from '../../../../telemed/features/appointment';

const HospitalizationOptions: HospitalizationDTO[] = [
  {
    display: 'Anaphylaxis',
    code: '39579001',
  },
  {
    display: 'Appendicitis',
    code: '74400008',
  },
  {
    display: 'Exacerbation of asthma',
    code: '281239006',
  },
  {
    display: 'Burn injury',
    code: '48333001',
  },
  {
    display: 'Cellulitis',
    code: '385627004',
  },
  {
    display: 'Human parturition, function',
    code: '386216000',
  },
  {
    display: 'Dehydration',
    code: '34095006',
  },
  {
    display: 'Diabetes type',
    code: '405751000',
  },
  {
    display: 'Disorder of digestive system',
    code: '53619000',
  },
  {
    display: 'Overdose',
    code: '1149222004',
  },
  {
    display: 'Febrile convulsion',
    code: '41497008',
  },
  {
    display: 'Fever',
    code: '386661006',
  },
  {
    display: 'Injury of head',
    code: '82271004',
  },
  {
    display: 'Influenza',
    code: '6142004',
  },
  {
    display: 'Jaundice',
    code: '18165001',
  },
  {
    display: 'Meningitis',
    code: '7180009',
  },
  {
    display: 'Problem behavior',
    code: '277843001',
  },
  {
    display: 'Injury due to motor vehicle accident',
    code: '407153006',
  },
  {
    display: 'Injury of musculoskeletal system',
    code: '105606008',
  },
  {
    display: 'Dysmorphism',
    code: '276720006',
  },
  {
    display: 'Pneumonia',
    code: '233604007',
  },
  {
    display: 'Poisoning',
    code: '75478009',
  },
  {
    display: 'Post-trauma response',
    code: '39093002',
  },
  {
    display: 'Prematurity of infant',
    code: '771299009',
  },
  {
    display: 'Mental disorder',
    code: '74732009',
  },
  {
    display: 'Disorder of respiratory system',
    code: '50043002',
  },
  {
    display: 'Respiratory syncytial virus infection',
    code: '55735004',
  },
  {
    display: 'Seizure',
    code: '91175000',
  },
  {
    display: 'Urinary tract infectious disease',
    code: '68566005',
  },
];

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
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
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

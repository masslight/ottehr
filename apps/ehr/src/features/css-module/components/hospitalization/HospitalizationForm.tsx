import { Autocomplete, Box, Card, TextField, Typography } from '@mui/material';
import { FC, useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { otherColors } from '@ehrTheme/colors';

const HospitalizationOptions: HospitalizationDTO[] = [
  {
    display: 'Anaphylaxis',
    code: '39579001',
    snomedDescription: '39579001 | Anaphylaxis (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Appendicitis',
    code: '74400008',
    snomedDescription: '74400008 | Appendicitis (disorder)',
    snomedRegionDescription: '66754008 | Appendix structure (body structure)',
  },
  {
    display: 'Exacerbation of asthma',
    code: '281239006',
    snomedDescription: '281239006 | Exacerbation of asthma (disorder)',
    snomedRegionDescription: '89187006 | Airway structure (body structure)',
  },
  {
    display: 'Burn injury',
    code: '48333001',
    snomedDescription: '48333001 | Burn injury (morphologic abnormality)',
    snomedRegionDescription: '',
  },
  {
    display: 'Cellulitis',
    code: '385627004',
    snomedDescription: '385627004 | Cellulitis (morphologic abnormality)',
    snomedRegionDescription: '',
  },
  {
    display: 'Human parturition, function',
    code: '386216000',
    snomedDescription: '386216000 | Human parturition, function (observable entity)',
    snomedRegionDescription: '',
  },
  {
    display: 'Dehydration',
    code: '34095006',
    snomedDescription: '34095006 | Dehydration (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Diabetes type',
    code: '405751000',
    snomedDescription: '405751000 | Diabetes type (observable entity)',
    snomedRegionDescription: '',
  },
  {
    display: 'Disorder of digestive system',
    code: '53619000',
    snomedDescription: '53619000 | Disorder of digestive system (disorder)',
    snomedRegionDescription: '86762007 | Structure of digestive system (body structure)',
  },
  {
    display: 'Overdose',
    code: '1149222004',
    snomedDescription: '1149222004 | Overdose (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Febrile convulsion',
    code: '41497008',
    snomedDescription: '41497008 | Febrile convulsion (finding)',
    snomedRegionDescription: '12738006 | Brain structure (body structure)',
  },
  {
    display: 'Fever',
    code: '386661006',
    snomedDescription: '386661006 | Fever (finding)',
    snomedRegionDescription: '',
  },
  {
    display: 'Injury of head',
    code: '82271004',
    snomedDescription: '82271004 | Injury of head (disorder)',
    snomedRegionDescription: '69536005 | Head structure (body structure)',
  },
  {
    display: 'Influenza',
    code: '6142004',
    snomedDescription: '6142004 | Influenza (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Jaundice',
    code: '18165001',
    snomedDescription: '18165001 | Jaundice (finding)',
    snomedRegionDescription: '',
  },
  {
    display: 'Meningitis',
    code: '7180009',
    snomedDescription: '7180009 | Meningitis (disorder)',
    snomedRegionDescription: '1231004 | Meninges structure (body structure)',
  },
  {
    display: 'Problem behavior',
    code: '277843001',
    snomedDescription: '277843001 | Problem behavior (finding)',
    snomedRegionDescription: '',
  },
  {
    display: 'Injury due to motor vehicle accident',
    code: '407153006',
    snomedDescription: '407153006 | Injury due to motor vehicle accident (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Injury of musculoskeletal system',
    code: '105606008',
    snomedDescription: '105606008 | Injury of musculoskeletal system (disorder)',
    snomedRegionDescription: '26107004 | Structure of musculoskeletal system (body structure)',
  },
  {
    display: 'Dysmorphism',
    code: '276720006',
    snomedDescription: '276720006 | Dysmorphism (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Pneumonia',
    code: '233604007',
    snomedDescription: '233604007 | Pneumonia (disorder)',
    snomedRegionDescription: '113255004 | Structure of parenchyma of lung (body structure)',
  },
  {
    display: 'Poisoning',
    code: '75478009',
    snomedDescription: '75478009 | Poisoning (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Post-trauma response',
    code: '39093002',
    snomedDescription: '39093002 | Post-trauma response (finding)',
    snomedRegionDescription: '',
  },
  {
    display: 'Prematurity of infant',
    code: '771299009',
    snomedDescription: '771299009 | Prematurity of infant (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Mental disorder',
    code: '74732009',
    snomedDescription: '74732009 | Mental disorder (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Disorder of respiratory system',
    code: '50043002',
    snomedDescription: '50043002 | Disorder of respiratory system (disorder)',
    snomedRegionDescription: '20139000 | Structure of respiratory system (body structure)',
  },
  {
    display: 'Respiratory syncytial virus infection',
    code: '55735004',
    snomedDescription: '55735004 | Respiratory syncytial virus infection (disorder)',
    snomedRegionDescription: '',
  },
  {
    display: 'Seizure',
    code: '91175000',
    snomedDescription: '91175000 | Seizure (finding)',
    snomedRegionDescription: '12738006 | Brain structure (body structure)',
  },
  {
    display: 'Urinary tract infectious disease',
    code: '68566005',
    snomedDescription: '68566005 | Urinary tract infectious disease (disorder)',
    snomedRegionDescription: '122489005 | Urinary system structure (body structure)',
  },
];

export const HospitalizationForm: FC = () => {
  const methods = useForm<{
    selectedHospitalization: HospitalizationDTO | null;
  }>({
    defaultValues: {
      selectedHospitalization: null,
    },
  });
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { control, reset } = methods;

  const { isLoading, onSubmit, onRemove, values: hospitalization } = useChartDataArrayValue('episodeOfCare', reset, {});

  const handleSelectOption = useCallback(
    async (data: HospitalizationDTO | null): Promise<void> => {
      if (data) {
        await onSubmit(data);
        reset({ selectedHospitalization: null });
      }
    },
    [onSubmit, reset]
  );

  const sortedHospitalizationOptions = useMemo(() => {
    return HospitalizationOptions.sort((a, b) => a.display.toLowerCase().localeCompare(b.display.toLowerCase()));
  }, []);

  return (
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
                    await handleSelectOption(data);
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
          </Card>
        </Box>
      )}
    </Box>
  );
};

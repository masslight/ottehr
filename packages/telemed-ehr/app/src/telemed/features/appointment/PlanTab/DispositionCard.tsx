import React, { FC, useCallback, useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  TextField,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  AccordionCard,
  ContainedPrimaryToggleButton,
  RoundedButton,
  UppercaseCaptionTypography,
} from '../../../components';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useDebounce } from '../../../hooks';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore, useSaveChartData } from '../../../state';
import {
  DispositionFormValues,
  mapDispositionToForm,
  mapFormToDisposition,
  DEFAULT_DISPOSITION_VALUES,
  dispositionFieldsPerType,
  labServiceOptions,
  virusTestsOptions,
  dispositionCheckboxOptions,
  followUpInOptions,
  mapDispositionTypeToLabel,
} from '../../../utils';

export const DispositionCard: FC = () => {
  const { chartData, setPartialChartData, isReadOnly } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'isReadOnly',
  ]);
  const methods = useForm<DispositionFormValues>({
    defaultValues: chartData?.disposition ? mapDispositionToForm(chartData.disposition) : DEFAULT_DISPOSITION_VALUES,
  });
  const { debounce } = useDebounce(1500);
  const { mutate, isLoading } = useSaveChartData();

  const { control, handleSubmit, watch, getValues, setValue } = methods;
  const [currentType, setCurrentType] = useState(getValues('type'));

  const onSubmit = useCallback(
    (values: DispositionFormValues): void => {
      debounce(() => {
        mutate(
          { disposition: mapFormToDisposition(values) },
          {
            onSuccess: (data) => {
              const disposition = data?.disposition;
              if (disposition) {
                setPartialChartData({ disposition });
              }
            },
          }
        );
      });
    },
    [debounce, mutate, setPartialChartData]
  );

  useEffect(() => {
    const subscription = watch(() => handleSubmit(onSubmit)());
    return () => subscription.unsubscribe();
  }, [handleSubmit, onSubmit, watch]);

  const fields = dispositionFieldsPerType[currentType];

  return (
    <AccordionCard label="Disposition" headerItem={isLoading ? <CircularProgress size="20px" /> : undefined}>
      <FormProvider {...methods}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Controller
            name="type"
            control={control}
            render={({ field: { value, onChange } }) => (
              <ToggleButtonGroup
                size="small"
                fullWidth
                exclusive
                disabled={isReadOnly}
                value={value}
                onChange={(_, newValue) => {
                  if (newValue) {
                    setCurrentType(newValue);
                    onChange(newValue);
                  }
                }}
              >
                <ContainedPrimaryToggleButton value="pcp">
                  {mapDispositionTypeToLabel['pcp']}
                </ContainedPrimaryToggleButton>
                <ContainedPrimaryToggleButton value="uc">
                  {mapDispositionTypeToLabel['uc']}
                </ContainedPrimaryToggleButton>
                <ContainedPrimaryToggleButton value="uc-lab">
                  {mapDispositionTypeToLabel['uc-lab']}
                </ContainedPrimaryToggleButton>
                <ContainedPrimaryToggleButton value="ed">
                  {mapDispositionTypeToLabel['ed']}
                </ContainedPrimaryToggleButton>
                <ContainedPrimaryToggleButton value="uc-oth">
                  {mapDispositionTypeToLabel['uc-oth']}
                </ContainedPrimaryToggleButton>
              </ToggleButtonGroup>
            )}
          />

          {fields.includes('labService') && (
            <Box
              sx={{
                display: 'flex',
                gap: 2,
              }}
            >
              <Controller
                name="labService"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Autocomplete
                    fullWidth
                    disabled={isReadOnly}
                    options={labServiceOptions.map((option) => option.label)}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Lab service" placeholder="Type or select" />
                    )}
                    onChange={(_e, data) => {
                      onChange(data);
                      const currentOption = labServiceOptions.find((option) => option.label === data);
                      if (currentOption?.note) {
                        setValue('note', currentOption.note);
                      }
                    }}
                    value={value}
                  />
                )}
              />

              <Controller
                name="virusTest"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Autocomplete
                    fullWidth
                    disabled={isReadOnly}
                    options={virusTestsOptions}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Virus tests" placeholder="Type or select" />
                    )}
                    onChange={(_e, data) => onChange(data)}
                    value={value}
                  />
                )}
              />
            </Box>
          )}

          {fields.includes('followUpIn') && (
            <Controller
              name="followUpIn"
              control={control}
              render={({ field: { onChange, value } }) => (
                <TextField
                  select
                  disabled={isReadOnly}
                  label="Follow up visit in"
                  size="small"
                  sx={{ minWidth: '200px', width: 'fit-content' }}
                  value={value}
                  onChange={onChange}
                >
                  <MenuItem value={''}>
                    <em>None</em>
                  </MenuItem>
                  {followUpInOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}

          {isReadOnly ? (
            getValues('note') ? (
              <Typography>{getValues('note')}</Typography>
            ) : (
              <Typography color="secondary.light">Note not provided</Typography>
            )
          ) : (
            <Controller
              name="note"
              control={control}
              render={({ field: { value, onChange } }) => (
                <TextField label="Note" multiline fullWidth size="small" value={value} onChange={onChange} />
              )}
            />
          )}

          {fields.includes('bookVisit') && (
            <RoundedButton disabled={isReadOnly} to="/visits/add" target="_blank" variant="contained">
              Book a visit
            </RoundedButton>
          )}

          {fields.includes('followUpType') && (
            <>
              <Divider />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <UppercaseCaptionTypography>Subspeciality Follow Up (optional)</UppercaseCaptionTypography>

                <Box sx={{ display: 'flex', gap: 3 }}>
                  {dispositionCheckboxOptions.map((option) => (
                    <React.Fragment key={option.name}>
                      <FormControlLabel
                        control={
                          <Controller
                            name={option.name}
                            control={control}
                            render={({ field }) => (
                              <Checkbox
                                {...field}
                                disabled={isReadOnly}
                                checked={field.value}
                                onChange={(e) => {
                                  const newValue = e.target.checked;
                                  field.onChange(newValue);
                                  if (option.name === 'other' && !newValue) {
                                    setValue('otherNote', '');
                                  }
                                }}
                              />
                            )}
                          />
                        }
                        label={option.label}
                      />
                      {option.name === 'other' && (
                        <Controller
                          name="otherNote"
                          control={control}
                          render={({ field: { value, onChange } }) => (
                            <TextField
                              disabled={isReadOnly}
                              label="Please specify"
                              size="small"
                              value={value}
                              onChange={onChange}
                            />
                          )}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            </>
          )}
        </Box>
      </FormProvider>
    </AccordionCard>
  );
};

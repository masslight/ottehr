import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  Autocomplete,
  Box,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Skeleton,
  TextField,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import {
  dispositionCheckboxOptions,
  DispositionType,
  getDefaultNote,
  mapDispositionTypeToLabel,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
} from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { AccordionCard, ContainedPrimaryToggleButton, UppercaseCaptionTypography } from '../../../components';
import { useDebounce, useGetAppointmentAccessibility } from '../../../hooks';
import { useChartData, useSaveChartData } from '../../../state';
import {
  DEFAULT_DISPOSITION_VALUES,
  dispositionFieldsPerType,
  DispositionFormValues,
  followUpInOptions,
  labServiceOptions,
  mapDispositionToForm,
  reasonsForTransferOptions,
  SEND_OUT_VIRUS_TEST_LABEL,
  virusTestsOptions,
} from '../../../utils';
import { useDispositionMultipleNotes } from './useDispositionMultipleNotes';

const ERROR_TEXT = 'Disposition data update was unsuccessful, please change some disposition field data to try again.';

export const DispositionCard: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const isResetting = useRef(false);
  const latestRequestId = useRef(0);

  const methods = useForm<DispositionFormValues>({
    defaultValues: DEFAULT_DISPOSITION_VALUES,
  });

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    reset,
    formState: { isDirty },
  } = methods;

  const { setPartialChartData, chartData } = useChartData();

  const { isFetching: isChartDataLoading } = useChartData({
    requestedFields: { disposition: {} },
    onSuccess: (data) => {
      setPartialChartData({ disposition: data?.disposition });
      isResetting.current = true;
      reset(data?.disposition ? mapDispositionToForm(data.disposition) : DEFAULT_DISPOSITION_VALUES);
      setCurrentType(data?.disposition?.type || DEFAULT_DISPOSITION_VALUES.type);
      if (data?.disposition?.note) {
        setNoteCache(data.disposition.note);
      }
      isResetting.current = false;
    },
  });

  const { setNoteCache, withNote } = useDispositionMultipleNotes({ methods, savedDisposition: chartData?.disposition });
  const labServiceValue = useWatch({ control: methods.control, name: 'labService' });
  const showVirusTest = labServiceValue?.includes?.(SEND_OUT_VIRUS_TEST_LABEL);
  const { debounce } = useDebounce(1500);
  const { mutate, isPending: isLoading } = useSaveChartData();
  const [currentType, setCurrentType] = useState(getValues('type'));
  const [isError, setIsError] = useState(false);

  const onSubmit = useCallback(
    (values: DispositionFormValues): void => {
      setIsError(false);
      const requestId = ++latestRequestId.current;
      debounce(() => {
        mutate(
          { disposition: withNote(values) },
          {
            onSuccess: (data) => {
              if (requestId === latestRequestId.current) {
                const disposition = data.chartData?.disposition;
                if (disposition) {
                  setPartialChartData({ disposition });
                  isResetting.current = true;
                  reset(mapDispositionToForm(disposition));
                  isResetting.current = false;
                }
              }
            },
            onError: () => {
              if (requestId === latestRequestId.current) {
                enqueueSnackbar(ERROR_TEXT, {
                  variant: 'error',
                });
                setIsError(true);
              }
            },
          }
        );
      });
    },
    [debounce, mutate, setPartialChartData, withNote, reset]
  );

  useEffect(() => {
    const subscription = watch((data, { type }) => {
      if (!isResetting.current && type === 'change') {
        void handleSubmit(onSubmit)();
      }
    });
    return () => subscription.unsubscribe();
  }, [handleSubmit, onSubmit, watch]);

  const fields = dispositionFieldsPerType[currentType];
  const tabs: DispositionType[] = ['pcp-no-type', 'another', 'ed', 'specialty'];

  if (isChartDataLoading || !chartData?.disposition) {
    return (
      <AccordionCard label="Disposition">
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rounded" height={36} />
          <Skeleton variant="rounded" height={36} />
          <Skeleton variant="rounded" height={36} />
        </Box>
      </AccordionCard>
    );
  }

  return (
    <AccordionCard
      label="Disposition"
      headerItem={
        isLoading || isDirty ? (
          <CircularProgress size="20px" />
        ) : isError ? (
          <Tooltip title={ERROR_TEXT}>
            <ErrorOutlineIcon color="error" />
          </Tooltip>
        ) : undefined
      }
    >
      <FormProvider {...methods}>
        <Box
          sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
          data-testid={dataTestIds.telemedEhrFlow.planTabDispositionContainer}
        >
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
                {tabs.map((tab) => (
                  <ContainedPrimaryToggleButton
                    key={tab}
                    value={tab}
                    data-testid={dataTestIds.telemedEhrFlow.planTabDispositionToggleButton(tab)}
                  >
                    {mapDispositionTypeToLabel[tab]}
                  </ContainedPrimaryToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          />

          {fields.includes('labService') && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                '& .MuiAutocomplete-root': {
                  maxWidth: '50%',
                },
              }}
            >
              <Controller
                name="labService"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Autocomplete
                    fullWidth
                    multiple
                    disabled={isReadOnly}
                    options={labServiceOptions.map((option) => option.label)}
                    renderInput={(params) => (
                      <TextField {...params} size="small" label="Lab services" placeholder="Type or select" />
                    )}
                    onChange={(_e, data) => {
                      onChange(data);

                      const selectedNotes = data
                        .map(
                          (selectedLabel) => labServiceOptions.find((option) => option.label === selectedLabel)?.note
                        )
                        .filter(Boolean);

                      let noteText = getDefaultNote('ip-lab');

                      if (selectedNotes.length > 0) {
                        noteText += '\n\n' + selectedNotes.join('\n\n');
                      }

                      setValue('note', noteText);
                      setNoteCache(noteText);

                      // clear value of virusTest, if SEND_OUT_VIRUS_TEST_LABEL is not selected
                      if (!data.includes(SEND_OUT_VIRUS_TEST_LABEL)) {
                        setValue('virusTest', []);
                      }
                    }}
                    value={Array.isArray(value) ? value : []}
                  />
                )}
              />

              {showVirusTest && (
                <Controller
                  name="virusTest"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Autocomplete
                      fullWidth
                      multiple
                      disabled={isReadOnly}
                      options={virusTestsOptions}
                      renderInput={(params) => (
                        <TextField {...params} size="small" label="Virus tests" placeholder="Type or select" />
                      )}
                      onChange={(_e, data) => onChange(data)}
                      value={Array.isArray(value) ? value : []}
                    />
                  )}
                />
              )}
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
                  data-testid={dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown}
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

          {fields.includes('reason') && (
            <Controller
              name="reason"
              control={control}
              render={({ field: { onChange, value } }) => (
                <TextField
                  select
                  disabled={isReadOnly}
                  label="Reason for transfer"
                  placeholder="Select"
                  data-testid={dataTestIds.telemedEhrFlow.planTabDispositionReasonForTransferDropdown}
                  size="small"
                  sx={{ minWidth: '200px', width: '50%' }}
                  value={value}
                  onChange={onChange}
                >
                  <MenuItem value={''}>
                    <em>None</em>
                  </MenuItem>
                  {reasonsForTransferOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
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
                <TextField
                  label="Note"
                  multiline
                  fullWidth
                  size="small"
                  data-testid={dataTestIds.telemedEhrFlow.planTabDispositionNote}
                  value={value}
                  onChange={(...args) => {
                    setNoteCache(args[0].target.value);
                    onChange(...args);
                  }}
                />
              )}
            />
          )}

          {fields.includes(NOTHING_TO_EAT_OR_DRINK_FIELD) && (
            <FormControlLabel
              label={NOTHING_TO_EAT_OR_DRINK_LABEL}
              control={
                <Controller
                  name={NOTHING_TO_EAT_OR_DRINK_FIELD}
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Checkbox
                      name={NOTHING_TO_EAT_OR_DRINK_FIELD}
                      disabled={isReadOnly}
                      checked={value}
                      onChange={onChange}
                    />
                  )}
                />
              }
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
                <UppercaseCaptionTypography>Subspecialty Follow Up (optional)</UppercaseCaptionTypography>

                <Box sx={{ display: 'flex', gap: 3 }}>
                  {dispositionCheckboxOptions.map((option) => (
                    <React.Fragment key={option.name}>
                      {option.name !== 'other' && (
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
                                  }}
                                />
                              )}
                            />
                          }
                          label={option.label}
                        />
                      )}

                      {option.name === 'other' && (
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography component="label" htmlFor="other-input">
                            Other
                          </Typography>
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
                        </Box>
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

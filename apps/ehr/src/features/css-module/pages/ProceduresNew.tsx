import {
  Autocomplete,
  Backdrop,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Box, Stack, useTheme } from '@mui/system';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { ValueSet } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useQuery, UseQueryResult } from 'react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { QUERY_STALE_TIME } from 'src/constants';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  AccordionCard,
  ActionsList,
  DeleteIconButton,
  useAppointmentStore,
  useDebounce,
  useDeleteChartData,
  useGetAppointmentAccessibility,
  useGetIcd10Search,
  useSaveChartData,
} from 'src/telemed';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { DiagnosesField } from 'src/telemed/features/appointment/AssessmentTab';
import {
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  CPTCodeDTO,
  DiagnosisDTO,
  getSelectors,
  getVisitStatus,
  IcdSearchResponse,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  PROCEDURE_TYPE_CPT_EXTENSION_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  REQUIRED_FIELD_ERROR_MESSAGE,
  SUPPLIES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  TelemedAppointmentStatusEnum,
  TIME_SPENT_VALUE_SET_URL,
} from 'utils';
import { InfoAlert } from '../components/InfoAlert';
import { useFeatureFlags } from '../context/featureFlags';
import { ROUTER_PATH } from '../routing/routesCSS';

const OTHER = 'Other';
const PERFORMED_BY = ['Healthcare staff', 'Provider', 'Both'];
const SPECIMEN_SENT = ['Yes', 'No'];
const DOCUMENTED_BY = ['Provider', 'Healthcare staff'];

interface PageState {
  consentObtained?: boolean;
  procedureType?: string;
  cptCodes?: CPTCodeDTO[];
  diagnoses?: DiagnosisDTO[];
  procedureDate?: DateTime | null;
  procedureTime?: DateTime | null;
  performerType?: string;
  medicationUsed?: string;
  bodySite?: string;
  otherBodySite?: string;
  bodySide?: string;
  technique?: string;
  suppliesUsed?: string;
  otherSuppliesUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  complications?: string;
  otherComplications?: string;
  patientResponse?: string;
  postInstructions?: string;
  otherPostInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
}

interface ProcedureType {
  name: string;
  cpt?: {
    code: string;
    display: string;
  };
}

interface SelectOptions {
  procedureTypes: ProcedureType[];
  medicationsUsed: string[];
  bodySites: string[];
  bodySides: string[];
  techniques: string[];
  supplies: string[];
  complications: string[];
  patientResponses: string[];
  postProcedureInstructions: string[];
  timeSpent: string[];
}

export default function ProceduresNew(): ReactElement {
  const navigate = useNavigate();
  const theme = useTheme();
  const { id: appointmentId, procedureId } = useParams();
  const { oystehr } = useApiClients();
  const { data: selectOptions, isLoading: isSelectOptionsLoading } = useSelectOptions(oystehr);
  const { chartData, setPartialChartData, appointment, encounter } = getSelectors(useAppointmentStore, [
    'chartData',
    'setPartialChartData',
    'appointment',
    'encounter',
  ]);
  const inPersonStatus = useMemo(() => appointment && getVisitStatus(appointment, encounter), [appointment, encounter]);
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();
  const isReadOnly = useMemo(() => {
    if (css) {
      return inPersonStatus === 'completed';
    }
    return appointmentAccessibility.status === TelemedAppointmentStatusEnum.complete;
  }, [css, inPersonStatus, appointmentAccessibility.status]);
  const chartCptCodes = chartData?.cptCodes || [];
  const chartDiagnoses = chartData?.diagnosis || [];
  const chartProcedures = chartData?.procedures || [];
  const { mutateAsync: saveChartData } = useSaveChartData();
  const { mutateAsync: deleteChartData } = useDeleteChartData();

  const [state, setState] = useState<PageState>({
    procedureDate: DateTime.now(),
    procedureTime: DateTime.now(),
  });
  const [saveInProgress, setSaveInProgress] = useState<boolean>(false);

  const updateState = (stateMutator: (state: PageState) => void): void => {
    stateMutator(state);
    setState({ ...state });
  };

  const [initialValuesSet, setInitialValuesSet] = useState<boolean>(false);
  useEffect(() => {
    const procedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);
    if (procedure == null || initialValuesSet || isSelectOptionsLoading) {
      return;
    }
    const procedureDateTime =
      procedure.procedureDateTime != null ? DateTime.fromISO(procedure.procedureDateTime) : undefined;
    setState({
      procedureType: procedure.procedureType,
      cptCodes: procedure.cptCodes,
      diagnoses: procedure.diagnoses,
      procedureDate: procedureDateTime,
      procedureTime: procedureDateTime,
      performerType: procedure.performerType,
      medicationUsed: procedure.medicationUsed,
      bodySite: getPredefinedValueOrOther(procedure.bodySite, selectOptions?.bodySites),
      otherBodySite: getPredefinedValueIfOther(procedure.bodySite, selectOptions?.bodySites),
      bodySide: procedure.bodySide,
      technique: procedure.technique,
      suppliesUsed: getPredefinedValueOrOther(procedure.suppliesUsed, selectOptions?.supplies),
      otherSuppliesUsed: getPredefinedValueIfOther(procedure.suppliesUsed, selectOptions?.supplies),
      procedureDetails: procedure.procedureDetails,
      specimenSent: procedure.specimenSent,
      complications: getPredefinedValueOrOther(procedure.complications, selectOptions?.complications),
      otherComplications: getPredefinedValueIfOther(procedure.complications, selectOptions?.complications),
      patientResponse: procedure.patientResponse,
      postInstructions: getPredefinedValueOrOther(procedure.postInstructions, selectOptions?.postProcedureInstructions),
      otherPostInstructions: getPredefinedValueIfOther(
        procedure.postInstructions,
        selectOptions?.postProcedureInstructions
      ),
      timeSpent: procedure.timeSpent,
      documentedBy: procedure.documentedBy,
      consentObtained: procedure.consentObtained,
    });
    setInitialValuesSet(true);
  }, [procedureId, chartData?.procedures, setState, initialValuesSet, isSelectOptionsLoading, selectOptions]);

  const onCancel = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
  };

  const onSave = async (): Promise<void> => {
    setSaveInProgress(true);
    try {
      const saveCptAndDiagnosesResponse = await saveChartData({
        cptCodes: state.cptCodes?.filter((cptCode) => cptCode.resourceId == null) ?? [],
        diagnosis: state.diagnoses?.filter((diagnosis) => diagnosis.resourceId == null) ?? [],
      });
      const savedCptCodes = saveCptAndDiagnosesResponse.chartData?.cptCodes;
      if (savedCptCodes) {
        setPartialChartData({
          cptCodes: [...chartCptCodes, ...savedCptCodes],
        });
      }
      const savedDiagnoses = saveCptAndDiagnosesResponse.chartData?.diagnosis;
      if (savedDiagnoses) {
        setPartialChartData({
          diagnosis: [...chartDiagnoses, ...savedDiagnoses],
        });
      }
      const cptCodesToUse = [
        ...(savedCptCodes ?? []),
        ...(state.cptCodes?.filter((cptCode) => cptCode.resourceId != null) ?? []),
      ];
      const diagnosesToUse = [
        ...(savedDiagnoses ?? []),
        ...(state.diagnoses?.filter((diagnosis) => diagnosis.resourceId != null) ?? []),
      ];
      const saveProcedureResponse = await saveChartData({
        procedures: [
          {
            resourceId: procedureId,
            procedureType: state.procedureType,
            cptCodes: cptCodesToUse,
            diagnoses: diagnosesToUse,
            procedureDateTime: state.procedureDate
              ?.set({ hour: state.procedureTime?.hour, minute: state.procedureTime?.minute })
              ?.toUTC()
              ?.toString(),
            documentedDateTime: DateTime.now().toUTC().toString(),
            performerType: state.performerType,
            medicationUsed: state.medicationUsed,
            bodySite: state.bodySite !== OTHER ? state.bodySite : state.otherBodySite?.trim(),
            bodySide: state.bodySide,
            technique: state.technique,
            suppliesUsed: state.suppliesUsed !== OTHER ? state.suppliesUsed : state.otherSuppliesUsed?.trim(),
            procedureDetails: state.procedureDetails,
            specimenSent: state.specimenSent,
            complications: state.complications !== OTHER ? state.complications : state.otherComplications?.trim(),
            patientResponse: state.patientResponse,
            postInstructions:
              state.postInstructions !== OTHER ? state.postInstructions : state.otherPostInstructions?.trim(),
            timeSpent: state.timeSpent,
            documentedBy: state.documentedBy,
            consentObtained: state.consentObtained,
          },
        ],
      });
      const oldProcedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);
      if (oldProcedure != null) {
        await deleteChartData({
          cptCodes: oldProcedure.cptCodes?.filter(
            (cptCode) => cptCodesToUse.find((cptCodeToUse) => cptCodeToUse.resourceId == cptCode.resourceId) == null
          ),
          diagnosis: oldProcedure.diagnoses?.filter(
            (diagnosis) =>
              diagnosesToUse.find((diagnosisToUse) => diagnosisToUse.resourceId == diagnosis.resourceId) == null
          ),
        });
      }
      const savedProcedure = saveProcedureResponse.chartData?.procedures?.[0];
      if (savedProcedure) {
        setPartialChartData({
          procedures: [
            ...chartProcedures.filter((procedure) => procedure.resourceId !== procedureId),
            {
              ...savedProcedure,
              cptCodes: cptCodesToUse,
              diagnoses: diagnosesToUse,
            },
          ],
        });
      }
      setSaveInProgress(false);
      enqueueSnackbar('Procedure saved!', { variant: 'success' });
      navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
    } catch {
      setSaveInProgress(false);
      enqueueSnackbar('An error has occurred while saving procedure. Please try again.', { variant: 'error' });
    }
  };

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetIcd10Search({ search: debouncedSearchTerm, sabs: 'CPT' });
  const cptSearchOptions = data?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const cptWidget = (): ReactElement => {
    return (
      <>
        <Autocomplete
          fullWidth
          blurOnSelect
          options={cptSearchOptions}
          filterOptions={(x) => x}
          noOptionsText={
            debouncedSearchTerm && cptSearchOptions.length === 0
              ? 'Nothing found for this search criteria'
              : 'Start typing to load results'
          }
          autoComplete
          includeInputInList
          disableClearable
          value={null as unknown as undefined}
          isOptionEqualToValue={(option, value) => value.code === option.code}
          loading={isSearching}
          onChange={(_e: unknown, data: CPTCodeDTO | null) => {
            updateState((state) => {
              if (data != null) {
                state.cptCodes = [...(state.cptCodes ?? []), data];
              }
            });
          }}
          getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.code} ${option.display}`)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="CPT code"
              placeholder="Search CPT code"
              onChange={(e) => debouncedHandleInputChange(e.target.value)}
            />
          )}
          disabled={isReadOnly}
        />
        <ActionsList
          data={state.cptCodes ?? []}
          getKey={(value, index) => value.resourceId || index}
          renderItem={(value) => (
            <Typography>
              {value.code} {value.display}
            </Typography>
          )}
          renderActions={(value) =>
            !isReadOnly ? (
              <DeleteIconButton
                onClick={() =>
                  updateState(
                    (state) => (state.cptCodes = state.cptCodes?.filter((cptCode) => cptCode.code != value.code))
                  )
                }
              />
            ) : undefined
          }
          divider
        />
      </>
    );
  };

  const diagnosesWidget = (): ReactElement => {
    return (
      <>
        <DiagnosesField
          label="Dx"
          onChange={(value: IcdSearchResponse['codes'][number]): void => {
            const preparedValue = { ...value, isPrimary: false };
            updateState((state) => {
              state.diagnoses = [...(state.diagnoses ?? []), preparedValue];
            });
          }}
          disableForPrimary={false}
          disabled={isReadOnly}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ActionsList
            data={state.diagnoses ?? []}
            getKey={(value, index) => value.resourceId || index}
            renderItem={(value) => (
              <Typography>
                {value.display} {value.code}
              </Typography>
            )}
            renderActions={(value) =>
              !isReadOnly ? (
                <DeleteIconButton
                  onClick={() =>
                    updateState(
                      (state) =>
                        (state.diagnoses = state.diagnoses?.filter((diagnosis) => diagnosis.code != value.code))
                    )
                  }
                />
              ) : undefined
            }
            divider
          />
        </Box>
      </>
    );
  };

  const dropdown = (
    label: string,
    options: string[] | undefined,
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    return (
      <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={isReadOnly}>
        <InputLabel id={label}>{label}</InputLabel>
        <Select
          label={label}
          labelId={label}
          variant="outlined"
          value={value ?? ''}
          onChange={(e) => updateState((state) => stateMutator(e.target.value, state))}
        >
          {(options ?? []).map((option) => {
            return (
              <MenuItem key={option} value={option}>
                <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
                  {option}
                </Typography>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    );
  };

  const otherTextInput = (
    parentLabel: string,
    parentValue: string | undefined,
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    if (parentValue !== 'Other') {
      return <></>;
    }
    return (
      <TextField
        label={'Other ' + parentLabel.toLocaleLowerCase()}
        size="small"
        value={value ?? ''}
        onChange={(e: any) => updateState((state) => stateMutator(e.target.value, state))}
        disabled={isReadOnly}
      />
    );
  };

  const radio = (
    label: string,
    options: string[],
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void,
    error = false
  ): ReactElement => {
    return (
      <FormControl error={error} disabled={isReadOnly}>
        <FormLabel id={label}>{label}</FormLabel>
        <RadioGroup
          row
          aria-labelledby={label}
          onChange={(e) => updateState((state) => stateMutator(e.target.value, state))}
          value={value ?? ''}
        >
          {options.map((option) => {
            return <FormControlLabel key={option} value={option} control={<Radio />} label={option} />;
          })}
        </RadioGroup>
        {error ? <FormHelperText>{REQUIRED_FIELD_ERROR_MESSAGE}</FormHelperText> : undefined}
      </FormControl>
    );
  };

  return (
    <>
      <Stack spacing={1}>
        <PageTitle label="Document Procedure" showIntakeNotesButton={false} />
        <AccordionCard>
          <Stack spacing={2} style={{ padding: '24px' }}>
            <Box style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={state.consentObtained ?? false}
                onChange={(_e: any, checked: boolean) => updateState((state) => (state.consentObtained = checked))}
                disabled={isReadOnly}
              />
              <Typography>
                I have obtained the{' '}
                <Link target="_blank" to={`/consent_procedure.pdf`} style={{ color: theme.palette.primary.main }}>
                  Consent for Procedure
                </Link>
              </Typography>
            </Box>

            <Box sx={{ marginTop: '16px', color: '#0F347C' }}>
              <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>
                <Typography style={{ color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
                  Procedure Type & CPT Code
                </Typography>
              </TooltipWrapper>
            </Box>

            {dropdown(
              'Procedure type',
              selectOptions?.procedureTypes.map((procedureType) => procedureType.name),
              state.procedureType,
              (value, state) => {
                state.procedureType = value;
                const cpt = selectOptions?.procedureTypes.find((procedureType) => procedureType.name === value)?.cpt;
                if (cpt != null) {
                  state.cptCodes = [cpt];
                } else {
                  state.cptCodes = [];
                }
              }
            )}
            {cptWidget()}
            <Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Dx
            </Typography>
            {diagnosesWidget()}
            <Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Procedure Details
            </Typography>
            <Stack direction="row" spacing={2}>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <DatePicker
                  label="Date of the procedure"
                  slotProps={{
                    textField: {
                      InputLabelProps: { shrink: true },
                      InputProps: { size: 'small', placeholder: 'MM/DD/YYYY' },
                    },
                  }}
                  value={state.procedureDate}
                  onChange={(date: DateTime | null, _e: any) => updateState((state) => (state.procedureDate = date))}
                  disabled={isReadOnly}
                />
              </LocalizationProvider>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <TimePicker
                  label="Time of the procedure"
                  slotProps={{
                    textField: {
                      InputLabelProps: { shrink: true },
                      InputProps: { size: 'small' },
                    },
                  }}
                  value={state.procedureTime}
                  onChange={(time: DateTime | null, _e: any) => updateState((state) => (state.procedureTime = time))}
                  disabled={isReadOnly}
                />
              </LocalizationProvider>
            </Stack>
            {radio('Performed by', PERFORMED_BY, state.performerType, (value, state) => (state.performerType = value))}
            <InfoAlert text="Please include body part including laterality, type and quantity anesthesia used, specific materials (type and quantity) used, technique, findings, complications, specimen sent, and after-procedure status." />
            {dropdown(
              'Anaesthesia / medication used',
              selectOptions?.medicationsUsed,
              state.medicationUsed,
              (value, state) => (state.medicationUsed = value)
            )}
            {dropdown('Site/location', selectOptions?.bodySites, state.bodySite, (value, state) => {
              state.bodySite = value;
              state.otherBodySite = undefined;
            })}
            {otherTextInput(
              'Site/location',
              state.bodySite,
              state.otherBodySite,
              (value, state) => (state.otherBodySite = value)
            )}
            {dropdown(
              'Side of body',
              selectOptions?.bodySides,
              state.bodySide,
              (value, state) => (state.bodySide = value)
            )}
            {dropdown(
              'Technique',
              selectOptions?.techniques,
              state.technique,
              (value, state) => (state.technique = value)
            )}
            {dropdown('Instruments / supplies used', selectOptions?.supplies, state.suppliesUsed, (value, state) => {
              state.suppliesUsed = value;
              state.otherSuppliesUsed = undefined;
            })}
            {otherTextInput(
              'Instruments / supplies used',
              state.suppliesUsed,
              state.otherSuppliesUsed,
              (value, state) => (state.otherSuppliesUsed = value)
            )}
            <TextField
              label="Procedure details"
              multiline
              rows={4}
              value={state.procedureDetails ?? ''}
              onChange={(e: any) => updateState((state) => (state.procedureDetails = e.target.value))}
              disabled={isReadOnly}
            />
            {radio(
              'Specimen sent',
              SPECIMEN_SENT,
              state.specimenSent != null ? (state.specimenSent ? 'Yes' : 'No') : undefined,
              (value, state) => (state.specimenSent = value === 'Yes')
            )}
            {dropdown('Complications', selectOptions?.complications, state.complications, (value, state) => {
              state.complications = value;
              state.otherComplications = undefined;
            })}
            {otherTextInput(
              'Complications',
              state.complications,
              state.otherComplications,
              (value, state) => (state.otherComplications = value)
            )}
            {dropdown(
              'Patient response',
              selectOptions?.patientResponses,
              state.patientResponse,
              (value, state) => (state.patientResponse = value)
            )}
            {dropdown(
              'Post-procedure Instructions',
              selectOptions?.postProcedureInstructions,
              state.postInstructions,
              (value, state) => {
                state.postInstructions = value;
                state.otherPostInstructions = undefined;
              }
            )}
            {otherTextInput(
              'Post-procedure Instructions',
              state.postInstructions,
              state.otherPostInstructions,
              (value, state) => (state.otherPostInstructions = value)
            )}
            {dropdown(
              'Time spent',
              selectOptions?.timeSpent,
              state.timeSpent,
              (value, state) => (state.timeSpent = value)
            )}
            {radio('Documented by', DOCUMENTED_BY, state.documentedBy, (value, state) => (state.documentedBy = value))}
            <Divider orientation="horizontal" />
            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton color="primary" onClick={onCancel}>
                Cancel
              </RoundedButton>
              <RoundedButton color="primary" variant="contained" disabled={isReadOnly} onClick={onSave}>
                Save
              </RoundedButton>
            </Box>
          </Stack>
        </AccordionCard>
      </Stack>
      <Backdrop sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })} open={saveInProgress}>
        <CircularProgress color="inherit" />
      </Backdrop>
    </>
  );
}

function getPredefinedValueOrOther(
  value: string | undefined,
  predefinedValues: string[] | undefined
): string | undefined {
  if (value != null && predefinedValues?.includes(value)) {
    return value;
  }
  return value != null ? OTHER : undefined;
}

function getPredefinedValueIfOther(
  value: string | undefined,
  predefinedValues: string[] | undefined
): string | undefined {
  if (value != null && !predefinedValues?.includes(value)) {
    return value;
  }
  return undefined;
}

function useSelectOptions(oystehr: Oystehr | undefined): UseQueryResult<SelectOptions, never> {
  return useQuery(
    ['procedures-new-dropdown-options'],
    async () => {
      if (oystehr == null) {
        return [];
      }
      const valueSets = (
        await oystehr.fhir.search<ValueSet>({
          resourceType: 'ValueSet',
          params: [
            {
              name: 'url',
              value: [
                PROCEDURE_TYPES_VALUE_SET_URL,
                MEDICATIONS_USED_VALUE_SET_URL,
                BODY_SITES_VALUE_SET_URL,
                BODY_SIDES_VALUE_SET_URL,
                TECHNIQUES_VALUE_SET_URL,
                SUPPLIES_VALUE_SET_URL,
                COMPLICATIONS_VALUE_SET_URL,
                PATIENT_RESPONSES_VALUE_SET_URL,
                POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
                TIME_SPENT_VALUE_SET_URL,
              ].join(','),
            },
          ],
        })
      ).unbundle();
      return {
        procedureTypes: getProcedureTypes(valueSets),
        medicationsUsed: getValueSetValues(MEDICATIONS_USED_VALUE_SET_URL, valueSets),
        bodySites: getValueSetValues(BODY_SITES_VALUE_SET_URL, valueSets),
        bodySides: getValueSetValues(BODY_SIDES_VALUE_SET_URL, valueSets),
        techniques: getValueSetValues(TECHNIQUES_VALUE_SET_URL, valueSets),
        supplies: getValueSetValues(SUPPLIES_VALUE_SET_URL, valueSets),
        complications: getValueSetValues(COMPLICATIONS_VALUE_SET_URL, valueSets),
        patientResponses: getValueSetValues(PATIENT_RESPONSES_VALUE_SET_URL, valueSets),
        postProcedureInstructions: getValueSetValues(POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL, valueSets),
        timeSpent: getValueSetValues(TIME_SPENT_VALUE_SET_URL, valueSets),
      };
    },
    {
      onError: (_err) => {
        return [];
      },
      keepPreviousData: true,
      staleTime: QUERY_STALE_TIME,
    }
  );
}

function getValueSetValues(valueSetUrl: string, valueSets: ValueSet[] | undefined): string[] {
  const valueSet = valueSets?.find((valueSet) => valueSet.url === valueSetUrl);
  return valueSet?.expansion?.contains?.flatMap((item) => (item.display != null ? [item.display] : [])) ?? [];
}

function getProcedureTypes(valueSets: ValueSet[] | undefined): ProcedureType[] {
  const valueSet = valueSets?.find((valueSet) => valueSet.url === PROCEDURE_TYPES_VALUE_SET_URL);
  return (
    valueSet?.expansion?.contains?.flatMap((item) => {
      const name = item.display;
      if (name == null) {
        return [];
      }
      const cptCodeableConcept = item.extension?.find((extension) => extension.url === PROCEDURE_TYPE_CPT_EXTENSION_URL)
        ?.valueCodeableConcept;
      const cptCode = cptCodeableConcept?.coding?.[0].code;
      const cptDisplay = cptCodeableConcept?.coding?.[0].display;
      const cpt = cptCode != null && cptDisplay != null ? { code: cptCode, display: cptDisplay } : undefined;
      return [{ name, cpt }];
    }) ?? []
  );
}

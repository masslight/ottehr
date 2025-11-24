import {
  Autocomplete,
  Backdrop,
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
import { Box, Stack } from '@mui/system';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import { ValueSet } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { RoundedButton } from 'src/components/RoundedButton';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { QUERY_STALE_TIME } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import {
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  CPT_SYSTEM,
  CPTCodeDTO,
  DiagnosisDTO,
  HCPCS_SYSTEM,
  IcdSearchResponse,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  ProcedureSuggestion,
  REQUIRED_FIELD_ERROR_MESSAGE,
  SUPPLIES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  TelemedAppointmentStatusEnum,
  TIME_SPENT_VALUE_SET_URL,
} from 'utils';
import { DiagnosesField } from '../../shared/components/assessment-tab/DiagnosesField';
import { PageTitle } from '../../shared/components/PageTitle';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useGetIcd10Search, useRecommendBillingCodes } from '../../shared/stores/appointment/appointment.queries';
import { useChartData, useDeleteChartData, useSaveChartData } from '../../shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../shared/stores/contexts/useAppFlags';
import AiSuggestion from '../components/AiSuggestion';
import { InfoAlert } from '../components/InfoAlert';
import { ROUTER_PATH } from '../routing/routesInPerson';

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
  suppliesUsed?: string[];
  otherSuppliesUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  complications?: string;
  otherComplications?: string;
  patientResponse?: string;
  postInstructions?: string[];
  otherPostInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
}

interface ProcedureType {
  name: string;
  cpt?: {
    code: string;
    display: string;
    system?: string;
  };
  hcpcs?: {
    code: string;
    display: string;
    system?: string;
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

type ParseResult = {
  values: string[];
  other?: string;
};

const parseWithOther = (rawValue: string | undefined, validOptions: string[] | undefined): ParseResult => {
  const result: ParseResult = { values: [], other: undefined };

  if (!rawValue) return result;

  const [generalPart, otherPart] = rawValue.split(`${OTHER}:`, 2);

  result.values = generalPart
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => validOptions?.includes(item));

  if (otherPart !== undefined) {
    const trimmedOther = otherPart.trim();
    if (trimmedOther) result.other = trimmedOther;
    result.values.push(OTHER);
  }

  return result;
};

export default function ProceduresNew(): ReactElement {
  const navigate = useNavigate();
  const { id: appointmentId, procedureId } = useParams();
  const { oystehr } = useApiClients();
  const { data: selectOptions, isLoading: isSelectOptionsLoading } = useSelectOptions(oystehr);
  const { chartData, setPartialChartData } = useChartData();
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { isInPerson } = useAppFlags();
  const { mutateAsync: recommendBillingCodes } = useRecommendBillingCodes();
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);

  const isReadOnly = useMemo(() => {
    if (isInPerson) {
      return appointmentAccessibility.isAppointmentReadOnly;
    }
    return appointmentAccessibility.status === TelemedAppointmentStatusEnum.complete;
  }, [isInPerson, appointmentAccessibility.status, appointmentAccessibility.isAppointmentReadOnly]);

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
  const [recommendedBillingCodes, setRecommendedBillingCodes] = useState<ProcedureSuggestion[] | null>(null);

  const sortedProcedureTypes = useMemo(() => {
    return (selectOptions?.procedureTypes ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [selectOptions?.procedureTypes]);

  const updateState = (stateMutator: (draft: PageState) => void): void => {
    setState((prev) => {
      const next = { ...prev };
      stateMutator(next);
      return next;
    });
  };

  const parseSuppliesUsed = (
    rawValue: string | undefined,
    validOptions: string[] | undefined
  ): { suppliesUsed: string[]; otherSuppliesUsed?: string } => {
    const { values, other } = parseWithOther(rawValue, validOptions);
    return { suppliesUsed: values, otherSuppliesUsed: other };
  };

  const parsePostInstructions = (
    rawValue: string | undefined,
    validOptions: string[] | undefined
  ): { postInstructions: string[]; otherPostInstructions?: string } => {
    const { values, other } = parseWithOther(rawValue, validOptions);
    return { postInstructions: values, otherPostInstructions: other };
  };

  useEffect(() => {
    const fetchRecommendedBillingCodes = async (): Promise<void> => {
      if (!state.procedureType) {
        return;
      }
      setLoadingSuggestions(true);
      const codes = await recommendBillingCodes({
        procedureType: state.procedureType,
        diagnoses: state.diagnoses,
        medicationUsed: state.medicationUsed,
        bodySite: state.bodySite,
        bodySide: state.bodySide,
        technique: state.technique,
        suppliesUsed: combineMultipleValuesForSave(state.suppliesUsed, state.otherSuppliesUsed),
        procedureDetails: state.procedureDetails,
        timeSpent: state.timeSpent,
      });
      setRecommendedBillingCodes(codes);
      setLoadingSuggestions(false);
    };

    fetchRecommendedBillingCodes().catch((error) => console.log(error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.procedureType,
    state.diagnoses,
    state.medicationUsed,
    state.bodySite,
    state.bodySide,
    state.technique,
    state.suppliesUsed,
    // state.procedureDetails,
    state.timeSpent,
    recommendBillingCodes,
  ]);

  const [initialValuesSet, setInitialValuesSet] = useState<boolean>(false);
  useEffect(() => {
    const procedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);
    if (procedure == null || initialValuesSet || isSelectOptionsLoading) {
      return;
    }
    const procedureDateTime =
      procedure.procedureDateTime != null ? DateTime.fromISO(procedure.procedureDateTime) : undefined;
    const parsedSupplies = parseSuppliesUsed(procedure.suppliesUsed, selectOptions?.supplies);
    const parsedPostInstructions = parsePostInstructions(
      procedure.postInstructions,
      selectOptions?.postProcedureInstructions
    );
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
      suppliesUsed: parsedSupplies.suppliesUsed,
      otherSuppliesUsed: parsedSupplies.otherSuppliesUsed,
      procedureDetails: procedure.procedureDetails,
      specimenSent: procedure.specimenSent,
      complications: getPredefinedValueOrOther(procedure.complications, selectOptions?.complications),
      otherComplications: getPredefinedValueIfOther(procedure.complications, selectOptions?.complications),
      patientResponse: procedure.patientResponse,
      postInstructions: parsedPostInstructions.postInstructions,
      otherPostInstructions: parsedPostInstructions.otherPostInstructions,
      timeSpent: procedure.timeSpent,
      documentedBy: procedure.documentedBy,
      consentObtained: procedure.consentObtained,
    });
    setInitialValuesSet(true);
  }, [procedureId, chartData?.procedures, setState, initialValuesSet, isSelectOptionsLoading, selectOptions]);

  const onCancel = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
  };

  const combineMultipleValuesForSave = (
    values: string[] | undefined,
    otherValue: string | undefined
  ): string | undefined => {
    if (!values?.length && !otherValue) return undefined;

    const result: string[] = [];

    (values ?? []).forEach((value) => {
      if (value === OTHER && otherValue?.trim()) {
        result.push(`${OTHER}: ${otherValue.trim()}`);
      } else {
        result.push(value);
      }
    });

    return result.join(', ');
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
            suppliesUsed: combineMultipleValuesForSave(state.suppliesUsed, state.otherSuppliesUsed),
            procedureDetails: state.procedureDetails,
            specimenSent: state.specimenSent,
            complications: state.complications !== OTHER ? state.complications : state.otherComplications?.trim(),
            patientResponse: state.patientResponse,
            postInstructions: combineMultipleValuesForSave(state.postInstructions, state.otherPostInstructions),
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
  const cptSearchOptions = (data as { codes?: CPTCodeDTO[] })?.codes || [];
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
                state.cptCodes = [
                  ...(state.cptCodes ?? []),
                  {
                    ...data,
                    system: data.system ?? CPT_SYSTEM,
                  },
                ];
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
              data-testid={dataTestIds.documentProcedurePage.cptCodeInput}
            />
          )}
          disabled={isReadOnly}
        />
        <ActionsList
          data={state.cptCodes ?? []}
          getKey={(value, index) => value.resourceId || index}
          renderItem={(value) => (
            <Typography data-testid={dataTestIds.documentProcedurePage.cptCode}>
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
              <Typography data-testid={dataTestIds.documentProcedurePage.diagnosis}>
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
                  dataTestId={dataTestIds.documentProcedurePage.diagnosisDeleteButton}
                />
              ) : undefined
            }
            itemDataTestId={dataTestIds.documentProcedurePage.diagnosisItem}
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
    stateMutator: (value: string, state: PageState) => void,
    dataTestId: string
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
          data-testid={dataTestId}
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
    parentValue: string | string[] | undefined,
    value: string | undefined,
    stateMutator: (value: string, state: PageState) => void
  ): ReactElement => {
    const shouldShow = (Array.isArray(parentValue) && parentValue.includes(OTHER)) || parentValue === OTHER;

    if (!shouldShow) {
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
    dataTestId: string,
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
            return (
              <FormControlLabel
                key={option}
                value={option}
                control={<Radio />}
                label={option}
                data-testid={dataTestId}
              />
            );
          })}
        </RadioGroup>
        {error ? <FormHelperText>{REQUIRED_FIELD_ERROR_MESSAGE}</FormHelperText> : undefined}
      </FormControl>
    );
  };

  const multiSelect = (
    label: string,
    options: string[] | undefined,
    values: string[] | undefined,
    stateMutator: (values: string[], state: PageState) => void,
    dataTestId: string
  ): ReactElement => {
    return (
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={(options ?? []).map((opt) => ({ value: opt, label: opt }))}
        value={(values ?? []).map((v) => ({ value: v, label: v }))}
        onChange={(_e, newValues) =>
          updateState((state) =>
            stateMutator(
              newValues.map((v) => v.value),
              state
            )
          )
        }
        renderOption={(props, option) => (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        )}
        renderInput={(params) => <TextField {...params} label={label} data-testid={dataTestId} />}
        disabled={isReadOnly}
      />
    );
  };

  return (
    <>
      <Stack spacing={1}>
        <PageTitle
          label="Document Procedure"
          showIntakeNotesButton={false}
          dataTestId={dataTestIds.documentProcedurePage.title}
        />
        <AccordionCard>
          <Stack spacing={2} style={{ padding: '24px' }}>
            <Box sx={{ color: '#0F347C' }}>
              <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>
                <Typography style={{ color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
                  Procedure Type
                </Typography>
              </TooltipWrapper>
            </Box>

            {dropdown(
              'Procedure type',
              sortedProcedureTypes.map((procedureType) => procedureType.name),
              state.procedureType,
              (value, state) => {
                state.procedureType = value;

                const selected = selectOptions?.procedureTypes.find((procedureType) => procedureType.name === value);

                const newCodes: CPTCodeDTO[] = [];
                if (selected?.cpt) {
                  newCodes.push({
                    code: selected.cpt.code,
                    display: selected.cpt.display,
                    system: selected.cpt.system ?? CPT_SYSTEM,
                  });
                }

                if (selected?.hcpcs) {
                  newCodes.push({
                    code: selected.hcpcs.code,
                    display: selected.hcpcs.display,
                    system: selected.hcpcs.system ?? HCPCS_SYSTEM,
                  });
                }

                state.cptCodes = newCodes;
              },
              dataTestIds.documentProcedurePage.procedureType
            )}
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
            {radio(
              'Performed by',
              PERFORMED_BY,
              state.performerType,
              (value, state) => (state.performerType = value),
              dataTestIds.documentProcedurePage.performedBy
            )}
            <InfoAlert text="Please include body part including laterality, type and quantity anesthesia used, specific materials (type and quantity) used, technique, findings, complications, specimen sent, and after-procedure status." />
            {dropdown(
              'Anaesthesia / medication used',
              selectOptions?.medicationsUsed,
              state.medicationUsed,
              (value, state) => (state.medicationUsed = value),
              dataTestIds.documentProcedurePage.anaesthesia
            )}
            {dropdown(
              'Site/location',
              selectOptions?.bodySites,
              state.bodySite,
              (value, state) => {
                state.bodySite = value;
                state.otherBodySite = undefined;
              },
              dataTestIds.documentProcedurePage.site
            )}
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
              (value, state) => (state.bodySide = value),
              dataTestIds.documentProcedurePage.sideOfBody
            )}
            {dropdown(
              'Technique',
              selectOptions?.techniques,
              state.technique,
              (value, state) => (state.technique = value),
              dataTestIds.documentProcedurePage.technique
            )}
            {multiSelect(
              'Instruments / supplies used',
              selectOptions?.supplies,
              state.suppliesUsed,
              (values, state) => {
                state.suppliesUsed = values;
              },
              dataTestIds.documentProcedurePage.instruments
            )}
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
              data-testid={dataTestIds.documentProcedurePage.procedureDetails}
            />
            {radio(
              'Specimen sent',
              SPECIMEN_SENT,
              state.specimenSent != null ? (state.specimenSent ? 'Yes' : 'No') : undefined,
              (value, state) => (state.specimenSent = value === 'Yes'),
              dataTestIds.documentProcedurePage.specimenSent
            )}
            {dropdown(
              'Complications',
              selectOptions?.complications,
              state.complications,
              (value, state) => {
                state.complications = value;
                state.otherComplications = undefined;
              },
              dataTestIds.documentProcedurePage.complications
            )}
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
              (value, state) => (state.patientResponse = value),
              dataTestIds.documentProcedurePage.patientResponse
            )}
            {multiSelect(
              'Post-procedure Instructions',
              selectOptions?.postProcedureInstructions,
              state.postInstructions,
              (values, state) => {
                state.postInstructions = values;
              },
              dataTestIds.documentProcedurePage.postProcedureInstructions
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
              (value, state) => (state.timeSpent = value),
              dataTestIds.documentProcedurePage.timeSpent
            )}
            {radio(
              'Documented by',
              DOCUMENTED_BY,
              state.documentedBy,
              (value, state) => (state.documentedBy = value),
              dataTestIds.documentProcedurePage.documentedBy
            )}
            <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>
              <Typography style={{ color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>CPT Code</Typography>
            </TooltipWrapper>
            {recommendedBillingCodes && (
              <AiSuggestion
                title="Recommended CPT Codes"
                procedureSuggestions={recommendedBillingCodes}
                loading={loadingSuggestions}
              />
            )}
            {cptWidget()}
            <Divider orientation="horizontal" />
            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <RoundedButton color="primary" onClick={onCancel}>
                Cancel
              </RoundedButton>
              <RoundedButton
                color="primary"
                variant="contained"
                disabled={isReadOnly}
                onClick={onSave}
                data-testid={dataTestIds.documentProcedurePage.saveButton}
              >
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

const emptySelectOptions: SelectOptions = {
  procedureTypes: [],
  medicationsUsed: [],
  bodySites: [],
  bodySides: [],
  techniques: [],
  supplies: [],
  complications: [],
  patientResponses: [],
  postProcedureInstructions: [],
  timeSpent: [],
};

function useSelectOptions(oystehr: Oystehr | undefined): UseQueryResult<SelectOptions, Error> {
  return useQuery({
    queryKey: ['procedures-new-dropdown-options'],

    queryFn: async (): Promise<SelectOptions> => {
      if (!oystehr) {
        return emptySelectOptions;
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

    placeholderData: keepPreviousData,
    staleTime: QUERY_STALE_TIME,
  });
}

function getValueSetValues(valueSetUrl: string, valueSets: ValueSet[] | undefined): string[] {
  const valueSet = valueSets?.find((valueSet) => valueSet.url === valueSetUrl);
  return valueSet?.expansion?.contains?.flatMap((item) => (item.display != null ? [item.display] : [])) ?? [];
}

function getProcedureTypes(valueSets: ValueSet[] | undefined): ProcedureType[] {
  if (!valueSets) return [];

  const latest = valueSets
    .filter((vs) => vs.url === PROCEDURE_TYPES_VALUE_SET_URL)
    .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? ''))
    .at(-1);

  if (!latest?.expansion?.contains) return [];

  return latest.expansion.contains
    .map((item): ProcedureType | null => {
      if (!item.display) return null;

      const getCode = (urlPart: string): { code: string; display: string; system?: string } | undefined => {
        const coding = item.extension?.find((ext) => ext.url?.includes(urlPart))?.valueCodeableConcept?.coding?.[0];

        return coding?.code && coding?.display
          ? { code: coding.code, display: coding.display, system: coding.system }
          : undefined;
      };

      return {
        name: item.display,
        cpt: getCode('procedure-type-cpt'),
        hcpcs: getCode('procedure-type-hcpcs'),
      };
    })
    .filter((p): p is ProcedureType => p !== null);
}

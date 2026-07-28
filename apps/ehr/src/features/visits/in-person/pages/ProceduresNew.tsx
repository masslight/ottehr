import { Backdrop, Checkbox, CircularProgress, Divider, FormHelperText, TextField, Typography } from '@mui/material';
import { Box, Stack, useTheme } from '@mui/system';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import { useQueryClient } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createProcedureQuickPick, getProcedureQuickPicks, updateProcedureQuickPick } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { AutocompleteInput } from 'src/components/input/AutocompleteInput';
import { RoundedButton } from 'src/components/RoundedButton';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { sortQuickPicks, useMergedProcedureQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { useMarkDraftNavigatedAway, useProcedureStore } from 'src/state/draft-data.store';
import {
  CodeOutcomeKind,
  CPTCodeDTO,
  detectProcedureFamily,
  FHIR_CODE_REGEX,
  IcdSearchResponse,
  ProcedureQuickPickData,
  PROCEDURES_CONFIG,
  RoleType,
} from 'utils';
import { PageTitle } from '../../shared/components/PageTitle';
import { QuickPicksButton } from '../../shared/components/QuickPicksButton';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useGetCPTHCPCSSearch } from '../../shared/stores/appointment/appointment.queries';
import {
  useAppointmentData,
  useChartData,
  useDeleteChartData,
  useSaveChartData,
} from '../../shared/stores/appointment/appointment.store';
import { InfoAlert } from '../components/InfoAlert';
import { CodingAssistPanel } from '../components/procedures/coding-assist/CodingAssistPanel';
import { DocumentationCheck } from '../components/procedures/coding-assist/DocumentationCheck';
import { ConditionalCodingFields } from '../components/procedures/ConditionalCodingFields';
import { ProcedureCptCodesField } from '../components/procedures/ProcedureCptCodesField';
import { ProcedureDiagnosesField } from '../components/procedures/ProcedureDiagnosesField';
import {
  clearUnusedStructuredFields,
  procedureInputFieldVisibility,
} from '../components/procedures/procedureFieldVisibility';
import {
  ProcedureDropdown,
  ProcedureMultiSelect,
  ProcedureOtherTextInput,
  ProcedureRadioGroup,
} from '../components/procedures/ProcedureFormFields';
import { ProcedureQuickPickDialogs } from '../components/procedures/ProcedureQuickPickDialogs';
import { useProcedureSelectOptions } from '../components/procedures/useProcedureSelectOptions';
import { ProcedureCodingEvaluationStateKind, useProcedureCoding } from '../hooks/useProcedureCoding';
import { ROUTER_PATH } from '../routing/routesInPerson';
import {
  combineMultipleValuesForSave,
  getPredefinedValueIfOther,
  getPredefinedValueOrOther,
  OTHER,
  parseWithOther,
  splitOtherForQuickPick,
} from './procedureOtherFields';
import {
  initialProcedurePageState,
  LocalProcedurePageState,
  procedureFactsFromPageState,
  procedurePageStateToDraft,
} from './procedurePageState';
import { applyProcedureQuickPick } from './procedureQuickPick';

const PERFORMED_BY = ['Healthcare staff', 'Provider', 'Both'];
const SPECIMEN_SENT = ['Yes', 'No'];
const DOCUMENTED_BY = ['Provider', 'Healthcare staff'];

interface ProceduresNewProps {
  procedureId?: string;
  onFinished?: () => void;
}

export default function ProceduresNew({
  procedureId: procedureIdProp,
  onFinished,
}: ProceduresNewProps = {}): ReactElement {
  const navigate = useNavigate();
  const isInlineFlow = useIsInlineFlow();
  const theme = useTheme();
  const { id: appointmentId, procedureId: procedureIdFromUrl } = useParams();
  const procedureId = procedureIdProp ?? procedureIdFromUrl;
  const { oystehr, oystehrZambda } = useApiClients();
  const currentUser = useEvolveUser();
  const isAdmin = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;
  const { data: selectOptions, isLoading: isSelectOptionsLoading } = useProcedureSelectOptions(oystehr);
  const { chartData, setPartialChartData } = useChartData();
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const queryClient = useQueryClient();

  const { encounter } = useAppointmentData();
  const { setDraft, getDraft, clearDraft, hasDraft } = useProcedureStore();
  useMarkDraftNavigatedAway({ encounterId: encounter.id ?? '', setDraft, hasDraft });
  const draft = !procedureId && encounter.id ? getDraft(encounter.id) : {};

  const isReadOnly = useMemo(() => {
    return appointmentAccessibility.isAppointmentReadOnly;
  }, [appointmentAccessibility.isAppointmentReadOnly]);

  const chartCptCodes = chartData?.cptCodes || [];
  const chartDiagnoses = chartData?.diagnosis || [];
  const chartProcedures = chartData?.procedures || [];
  const { mutateAsync: saveChartData } = useSaveChartData();
  const { mutateAsync: deleteChartData } = useDeleteChartData();

  const methods = useForm({
    defaultValues: draft.procedureType ? { procedureType: draft.procedureType } : undefined,
  });
  const formValues = methods.watch();
  const {
    formState: { errors },
  } = methods;

  const [state, setState] = useState<LocalProcedurePageState>(() => initialProcedurePageState(draft));
  const [saveInProgress, setSaveInProgress] = useState<boolean>(false);
  const [quickPickDialogOpen, setQuickPickDialogOpen] = useState(false);
  const [quickPickName, setQuickPickName] = useState('');
  const [existingQuickPicks, setExistingQuickPicks] = useState<ProcedureQuickPickData[]>([]);
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  // The quick-picks fetch is triggered by mounting this page (useMergedProcedureQuickPicks
  // calls the zambda from a useEffect on mount), so picks start loading as soon as the
  // user navigates to /procedures/new — not when they open the Quick Picks menu. We
  // surface the loading flag below so the menu shows a "Loading…" item while in-flight,
  // instead of appearing empty on a fast first click.
  const { quickPicks: mergedQuickPicks, loading: mergedQuickPicksLoading } = useMergedProcedureQuickPicks();
  const sortedMergedQuickPicks = useMemo(
    () => [...mergedQuickPicks].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [mergedQuickPicks]
  );

  const persistDraftAfterStateChangeRef = useRef(false);
  const updateState = useCallback((stateMutator: (draft: LocalProcedurePageState) => void): void => {
    persistDraftAfterStateChangeRef.current = true;
    setState((prev) => {
      const next = { ...prev };
      stateMutator(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!persistDraftAfterStateChangeRef.current) return;
    persistDraftAfterStateChangeRef.current = false;
    if (!procedureId && encounter.id) {
      setDraft(encounter.id, procedurePageStateToDraft(state));
    }
  }, [encounter.id, procedureId, setDraft, state]);

  const handleClearForm = (): void => {
    persistDraftAfterStateChangeRef.current = false;
    if (encounter.id) clearDraft(encounter.id);
    setState({ procedureDate: DateTime.now(), procedureTime: DateTime.now() });
    methods.reset({ procedureType: '' });
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

  const procedureFacts = useMemo(
    () => procedureFactsFromPageState(state, formValues.procedureType),
    [formValues.procedureType, state]
  );
  const codingAssist = useProcedureCoding(procedureFacts);
  const codingEvaluations =
    codingAssist.evaluationState.kind === ProcedureCodingEvaluationStateKind.Ready
      ? codingAssist.evaluationState.current
      : codingAssist.evaluationState.previous;
  const codingAssistIsEvaluating = codingAssist.evaluationState.kind === ProcedureCodingEvaluationStateKind.Evaluating;

  const [initialValuesSet, setInitialValuesSet] = useState<boolean>(false);
  const [initialFormStateSet, setInitialFormStateSet] = useState<boolean>(false);
  const procedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);

  useEffect(() => {
    if (procedure == null || initialValuesSet || selectOptions == null) {
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
      lengthCm: procedure.lengthCm,
      repairDepth: procedure.repairDepth,
      infusionStartTime: procedure.infusionStartTime,
      infusionStopTime: procedure.infusionStopTime,
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
  }, [procedure, setState, initialValuesSet, selectOptions]);

  const onCancel = (): void => {
    if (!procedureId && encounter.id) clearDraft(encounter.id);
    if (onFinished) onFinished();
    else navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
  };

  const onSave = async (): Promise<void> => {
    setSaveInProgress(true);
    try {
      const cptCodesToSave =
        state.cptCodes?.filter((cptCode) => {
          if (cptCode.resourceId == null) return true;
          const original = chartCptCodes.find((chartCode) => chartCode.resourceId === cptCode.resourceId);
          return original == null || original.billableUnits !== cptCode.billableUnits;
        }) ?? [];

      const saveCptAndDiagnosesResponse = await saveChartData({
        cptCodes: cptCodesToSave,
        diagnosis: state.diagnoses?.filter((diagnosis) => diagnosis.resourceId == null) ?? [],
      });

      const savedCptCodes = saveCptAndDiagnosesResponse.chartData?.cptCodes;

      if (savedCptCodes) {
        const savedCptCodeIds = new Set(savedCptCodes.flatMap((code) => (code.resourceId ? [code.resourceId] : [])));
        setPartialChartData({
          cptCodes: [
            ...chartCptCodes.filter((code) => !code.resourceId || !savedCptCodeIds.has(code.resourceId)),
            ...savedCptCodes,
          ],
        });
      }

      const savedDiagnoses = saveCptAndDiagnosesResponse.chartData?.diagnosis;

      if (savedDiagnoses) {
        setPartialChartData({
          diagnosis: [...chartDiagnoses, ...savedDiagnoses],
        });
      }

      const savedCptCodeIds = new Set(savedCptCodes?.flatMap((code) => (code.resourceId ? [code.resourceId] : [])));

      const cptCodesToUse = [
        ...(savedCptCodes ?? []),
        ...(state.cptCodes?.filter(
          (cptCode) => cptCode.resourceId != null && !savedCptCodeIds.has(cptCode.resourceId)
        ) ?? []),
      ];

      const diagnosesToUse = [
        ...(savedDiagnoses ?? []),
        ...(state.diagnoses?.filter((diagnosis) => diagnosis.resourceId != null) ?? []),
      ];

      const saveProcedureResponse = await saveChartData({
        procedures: [
          {
            resourceId: procedureId,
            procedureType: formValues.procedureType,
            cptCodes: cptCodesToUse,
            diagnoses: diagnosesToUse,
            procedureDateTime: state.procedureDate
              ?.set({ hour: state.procedureTime?.hour, minute: state.procedureTime?.minute })
              ?.toUTC()
              ?.toString(),
            documentedDateTime: DateTime.now().toUTC().toString(),
            performerType: state.performerType,
            medicationUsed: state.medicationUsed,
            bodySite: state.bodySite !== OTHER ? state.bodySite : state.otherBodySite?.trim() || OTHER,
            bodySide: state.bodySide,
            technique: state.technique,
            suppliesUsed: combineMultipleValuesForSave(state.suppliesUsed, state.otherSuppliesUsed),
            procedureDetails: state.procedureDetails,
            lengthCm: state.lengthCm,
            repairDepth: state.repairDepth,
            infusionStartTime: state.infusionStartTime,
            infusionStopTime: state.infusionStopTime,
            specimenSent: state.specimenSent,
            complications:
              state.complications !== OTHER ? state.complications : state.otherComplications?.trim() || OTHER,
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

      void queryClient.invalidateQueries({
        queryKey: ['procedures-for-tracking-board'],
        refetchType: 'active',
      });

      setSaveInProgress(false);
      enqueueSnackbar('Procedure saved!', { variant: 'success' });

      if (!procedureId && encounter.id) clearDraft(encounter.id);

      if (onFinished) {
        onFinished();
      } else {
        navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
      }
    } catch {
      setSaveInProgress(false);
      enqueueSnackbar('An error has occurred while saving procedure. Please try again.', { variant: 'error' });
    }
  };

  const openQuickPickDialog = async (): Promise<void> => {
    if (!oystehrZambda) return;
    try {
      const response = await getProcedureQuickPicks(oystehrZambda);
      setExistingQuickPicks([...response.quickPicks].sort(sortQuickPicks));
    } catch (error) {
      console.error('Failed to load existing quick picks:', error);
      setExistingQuickPicks(sortedMergedQuickPicks);
    }
    // Suggest name: procedure name | site location | side of body | complications | cpt codes
    const parts: string[] = [];
    if (formValues.procedureType) parts.push(formValues.procedureType);
    if (state.bodySite) parts.push(state.bodySite);
    if (state.bodySide) parts.push(state.bodySide);
    if (state.complications) parts.push(state.complications);
    if (state.cptCodes?.length) parts.push(state.cptCodes.map((c) => c.code).join(', '));
    setQuickPickName(parts.join(' | '));
    setQuickPickDialogOpen(true);
  };

  const buildQuickPickFromCurrentState = (): Omit<ProcedureQuickPickData, 'id'> => {
    const supplies = splitOtherForQuickPick(state.suppliesUsed, state.otherSuppliesUsed);
    const postInstructions = splitOtherForQuickPick(state.postInstructions, state.otherPostInstructions);
    return {
      name: quickPickName.trim(),
      procedureType:
        selectOptions?.procedureTypes?.find((pt) => pt.name === formValues.procedureType)?.code ??
        formValues.procedureType,
      cptCodes: state.cptCodes?.map((c) => ({
        code: c.code,
        display: c.display,
        billableUnits: c.billableUnits,
      })),
      // diagnoses, consentObtained, and performerType excluded — encounter-specific
      medicationUsed: state.medicationUsed,
      bodySite: state.bodySite,
      otherBodySite: state.bodySite === OTHER ? state.otherBodySite?.trim() : undefined,
      bodySide: state.bodySide,
      technique: state.technique,
      suppliesUsed: supplies.values,
      otherSuppliesUsed: supplies.other,
      procedureDetails: state.procedureDetails,
      lengthCm: state.lengthCm,
      repairDepth: state.repairDepth,
      infusionStartTime: state.infusionStartTime,
      infusionStopTime: state.infusionStopTime,
      specimenSent: state.specimenSent,
      complications: state.complications,
      otherComplications: state.complications === OTHER ? state.otherComplications?.trim() : undefined,
      patientResponse: state.patientResponse,
      postInstructions: postInstructions.values,
      otherPostInstructions: postInstructions.other,
      timeSpent: state.timeSpent,
      documentedBy: state.documentedBy,
    };
  };

  const onSaveAsQuickPick = async (overwriteId?: string): Promise<void> => {
    if (!quickPickName.trim()) {
      enqueueSnackbar('Quick pick name is required', { variant: 'error' });
      return;
    }
    if (!oystehrZambda) {
      throw new Error('oystehrZambda was null');
    }

    setQuickPickSaving(true);
    try {
      const quickPickData = buildQuickPickFromCurrentState();

      if (overwriteId) {
        await updateProcedureQuickPick(oystehrZambda, overwriteId, quickPickData);
        enqueueSnackbar(`Quick pick "${quickPickName}" updated`, { variant: 'success' });
      } else {
        await createProcedureQuickPick(oystehrZambda, { quickPick: quickPickData });
        enqueueSnackbar(`Quick pick "${quickPickName}" created`, { variant: 'success' });
      }

      setQuickPickDialogOpen(false);
    } catch (error) {
      console.error('Failed to save quick pick:', error);
      enqueueSnackbar('Failed to save quick pick', { variant: 'error' });
    } finally {
      setQuickPickSaving(false);
    }
  };

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const { isFetching: isSearching, data } = useGetCPTHCPCSSearch({ search: debouncedSearchTerm, type: 'both' });
  const cptSearchOptions = (data as { codes?: CPTCodeDTO[] })?.codes || [];
  const { debounce } = useDebounce(800);
  const debouncedHandleInputChange = (data: string): void => {
    debounce(() => {
      setDebouncedSearchTerm(data);
    });
  };

  const addRecommendedCptCodes = (entries: CPTCodeDTO[]): void =>
    updateState((state) => {
      const cptCodes = [...(state.cptCodes ?? [])];

      entries.forEach((entry) => {
        const existingIndex = cptCodes.findIndex((cptCode) => cptCode.code === entry.code);
        if (existingIndex === -1) {
          cptCodes.push(entry);
        } else if (entry.billableUnits != null) {
          cptCodes[existingIndex] = { ...cptCodes[existingIndex], billableUnits: entry.billableUnits };
        }
      });

      state.cptCodes = cptCodes;
    });

  // Keep the not-assessed line quiet unless the forward evaluation has something to say.
  const forwardEvaluation = codingEvaluations?.suggestion;
  const suggestionVisible =
    forwardEvaluation?.outcome?.kind === CodeOutcomeKind.Determined ||
    forwardEvaluation?.outcome?.kind === CodeOutcomeKind.DeterminedWithAlternates ||
    forwardEvaluation?.outcome?.kind === CodeOutcomeKind.Open;

  useEffect(() => {
    if (procedureId && !initialFormStateSet) {
      return;
    }
    const callback = methods.subscribe({
      name: 'procedureType',
      formState: {
        values: true,
      },
      callback: ({ values }) => {
        if (!values.procedureType) return;
        if (!procedureId && encounter.id) {
          setDraft(encounter.id, { procedureType: values.procedureType });
        }
        updateState((state) => {
          const selected = selectOptions?.procedureTypes.find(
            (procedureType) => procedureType.name === values.procedureType
          );
          // don't remove applied codes on changes
          const appliedCodes = [...(state.cptCodes ?? [])];
          if (selected?.cpt && !appliedCodes.some((c) => c.code === selected.cpt!.code)) {
            appliedCodes.push({ code: selected.cpt.code, display: selected.cpt.display });
          }
          if (selected?.hcpcs && !appliedCodes.some((c) => c.code === selected.hcpcs!.code)) {
            appliedCodes.push({ code: selected.hcpcs.code, display: selected.hcpcs.display });
          }
          state.cptCodes = appliedCodes;

          if (selected) {
            Object.entries(PROCEDURES_CONFIG.prepopulation[selected.code] ?? []).forEach(([field, value]) => {
              const currentValue = (state as any)[field];
              if (currentValue == null || currentValue === '') {
                (state as any)[field] = value;
              }
            });
          }

          // The structured inputs unmount when the new family does not use them; without this their
          // values would survive on the entry and reach the note, the billing PDF and any quick pick
          // saved from it (a wound size on an EKG).
          clearUnusedStructuredFields(
            state,
            procedureInputFieldVisibility(
              detectProcedureFamily({ procedureType: values.procedureType, cptCodes: appliedCodes }),
              { procedureType: values.procedureType, cptCodes: appliedCodes }
            )
          );
        });
      },
    });
    return () => callback();
  }, [methods, selectOptions, procedureId, initialFormStateSet, encounter.id, setDraft, updateState]);

  useEffect(() => {
    if (procedure == null) {
      return;
    }
    methods.reset({
      procedureType: procedure.procedureType,
    });
    setInitialFormStateSet(true);
  }, [methods, procedure]);

  const onQuickPickSelect = (quickPick: ProcedureQuickPickData): void => {
    const procedureTypeName = quickPick.procedureType
      ? selectOptions?.procedureTypes.find((procedureType) => procedureType.code === quickPick.procedureType)?.name ??
        quickPick.procedureType
      : undefined;
    if (procedureTypeName) {
      methods.reset({ ...formValues, procedureType: procedureTypeName });
    }
    updateState((state) => {
      applyProcedureQuickPick(state, quickPick, procedureTypeName ?? formValues.procedureType);
    });
  };

  const onQuickPickSelectRef = useRef(onQuickPickSelect);
  onQuickPickSelectRef.current = onQuickPickSelect;

  const commandPaletteItems = useMemo(
    () =>
      procedureId || isReadOnly || selectOptions == null
        ? []
        : mergedQuickPicks.map((quickPick) => ({
            id: `procedure-${quickPick.id ?? quickPick.name}`,
            label: quickPick.name,
            category: 'Add Procedure',
            onSelect: () => onQuickPickSelectRef.current(quickPick),
          })),
    [isReadOnly, mergedQuickPicks, procedureId, selectOptions]
  );
  useCommandPaletteSource('procedure-quick-picks', commandPaletteItems);

  const handlePendingQuickPick = useCallback((payload: ProcedureQuickPickData) => {
    onQuickPickSelectRef.current(payload);
  }, []);
  usePendingQuickPick('procedures', handlePendingQuickPick, selectOptions != null);

  const [consentPdfExists, setConsentPdfExists] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/consent_procedure.pdf', { method: 'HEAD' })
      .then((res) => {
        const contentType = res.headers.get('content-type') ?? '';
        if (!cancelled) setConsentPdfExists(res.ok && contentType.includes('pdf'));
      })
      .catch(() => {
        if (!cancelled) setConsentPdfExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FormProvider {...methods}>
      <Stack spacing={1}>
        {!isInlineFlow && (
          <PageTitle
            label="Document Procedure"
            showIntakeNotesButton={false}
            dataTestId={dataTestIds.documentProcedurePage.title}
          />
        )}
        {!procedureId && hasDraft(encounter.id ?? '') && (
          <UnsavedDraftWarning
            message={
              draft.hasNavigatedAway
                ? 'Your previously entered data has been restored. Click "Clear Form" to start fresh.'
                : 'You have a procedure in progress. Your draft will be saved.'
            }
          />
        )}
        <AccordionCard>
          <Stack spacing={2} style={{ padding: '24px' }}>
            <Box style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={state.consentObtained ?? false}
                onChange={(_e: any, checked: boolean) => updateState((state) => (state.consentObtained = checked))}
                disabled={isReadOnly}
                data-testid={dataTestIds.documentProcedurePage.consentForProcedure}
              />
              <Typography>
                I have obtained the{' '}
                {consentPdfExists ? (
                  <Link target="_blank" to={`/consent_procedure.pdf`} style={{ color: theme.palette.primary.main }}>
                    Consent for Procedure
                  </Link>
                ) : (
                  'Consent for Procedure'
                )}
              </Typography>
            </Box>

            <QuickPicksButton
              quickPicks={sortedMergedQuickPicks}
              loading={mergedQuickPicksLoading}
              disabled={selectOptions == null}
              getLabel={(quickPick) => quickPick.name}
              onSelect={onQuickPickSelect}
              showAddOption
              isAdmin={isAdmin}
              onAddOrUpdate={() => void openQuickPickDialog()}
              searchable
            />

            <Box sx={{ marginTop: '16px', color: '#0F347C' }}>
              <Typography style={{ color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>Procedure Type</Typography>
            </Box>

            <AutocompleteInput
              name="procedureType"
              label="Procedure type"
              options={selectOptions?.procedureTypes.map((procedureType) => procedureType.name)}
              disabled={isReadOnly}
              loading={isSelectOptionsLoading}
              freeSolo
              dataTestId={dataTestIds.documentProcedurePage.procedureType}
              required
              // regex is from fhir spec for code (which is where this value is mapped)
              // https://hl7.org/fhir/R4B/datatypes.html#code
              validate={(value) =>
                !value || FHIR_CODE_REGEX.test(value) || 'No leading, trailing, or consecutive spaces allowed'
              }
            />

            <Typography style={{ marginTop: '8px', color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>
              Dx
            </Typography>
            <ProcedureDiagnosesField
              diagnoses={state.diagnoses ?? []}
              onAdd={(value: IcdSearchResponse['codes'][number]) =>
                updateState((state) => {
                  state.diagnoses = [...(state.diagnoses ?? []), { ...value, isPrimary: false }];
                })
              }
              onDelete={(value) =>
                updateState(
                  (state) => (state.diagnoses = state.diagnoses?.filter((diagnosis) => diagnosis.code != value.code))
                )
              }
              disabled={isReadOnly}
            />
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
            <ProcedureRadioGroup
              label="Performed by"
              options={PERFORMED_BY}
              value={state.performerType}
              onChange={(value) => updateState((state) => (state.performerType = value))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.performedBy}
            />
            <InfoAlert text="Please include body part including laterality, type and quantity anesthesia used, specific materials (type and quantity) used, technique, findings, complications, specimen sent, and after-procedure status." />
            <ProcedureDropdown
              label="Anaesthesia / medication used"
              options={selectOptions?.medicationsUsed}
              value={state.medicationUsed}
              onChange={(value) => updateState((state) => (state.medicationUsed = value))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.anaesthesia}
            />
            <ProcedureDropdown
              label="Site/location"
              options={selectOptions?.bodySites}
              value={state.bodySite}
              onChange={(value) =>
                updateState((state) => {
                  state.bodySite = value;
                  state.otherBodySite = undefined;
                })
              }
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.site}
            />
            <ProcedureOtherTextInput
              parentLabel="Site/location"
              visible={state.bodySite === OTHER}
              value={state.otherBodySite}
              onChange={(value) => updateState((state) => (state.otherBodySite = value))}
              disabled={isReadOnly}
            />
            <ProcedureDropdown
              label="Side of body"
              options={selectOptions?.bodySides}
              value={state.bodySide}
              onChange={(value) => updateState((state) => (state.bodySide = value))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.sideOfBody}
            />
            <ConditionalCodingFields
              visibility={codingAssist.fieldVisibility}
              isReadOnly={isReadOnly}
              lengthCm={state.lengthCm}
              repairDepth={state.repairDepth}
              infusionStartTime={state.infusionStartTime}
              infusionStopTime={state.infusionStopTime}
              onLengthChange={(value) => updateState((state) => (state.lengthCm = value))}
              onRepairDepthChange={(value) => updateState((state) => (state.repairDepth = value))}
              onInfusionStartChange={(value) => updateState((state) => (state.infusionStartTime = value))}
              onInfusionStopChange={(value) => updateState((state) => (state.infusionStopTime = value))}
            />
            <ProcedureMultiSelect
              label="Technique"
              options={selectOptions?.techniques}
              values={state.technique}
              onChange={(values) => updateState((state) => (state.technique = values))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.technique}
            />
            <ProcedureMultiSelect
              label="Instruments / supplies used"
              options={selectOptions?.supplies}
              values={state.suppliesUsed}
              onChange={(values) => updateState((state) => (state.suppliesUsed = values))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.instruments}
            />
            <ProcedureOtherTextInput
              parentLabel="Instruments / supplies used"
              visible={state.suppliesUsed?.includes(OTHER) ?? false}
              value={state.otherSuppliesUsed}
              onChange={(value) => updateState((state) => (state.otherSuppliesUsed = value))}
              disabled={isReadOnly}
            />
            <TextField
              label="Procedure details"
              multiline
              rows={4}
              value={state.procedureDetails ?? ''}
              onChange={(e: any) => updateState((state) => (state.procedureDetails = e.target.value))}
              disabled={isReadOnly}
              data-testid={dataTestIds.documentProcedurePage.procedureDetails}
            />
            <ProcedureRadioGroup
              label="Specimen sent"
              options={SPECIMEN_SENT}
              value={state.specimenSent != null ? (state.specimenSent ? 'Yes' : 'No') : undefined}
              onChange={(value) => updateState((state) => (state.specimenSent = value === 'Yes'))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.specimenSent}
            />
            <ProcedureDropdown
              label="Complications"
              options={selectOptions?.complications}
              value={state.complications}
              onChange={(value) =>
                updateState((state) => {
                  state.complications = value;
                  state.otherComplications = undefined;
                })
              }
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.complications}
            />
            <ProcedureOtherTextInput
              parentLabel="Complications"
              visible={state.complications === OTHER}
              value={state.otherComplications}
              onChange={(value) => updateState((state) => (state.otherComplications = value))}
              disabled={isReadOnly}
            />
            <ProcedureDropdown
              label="Patient response"
              options={selectOptions?.patientResponses}
              value={state.patientResponse}
              onChange={(value) => updateState((state) => (state.patientResponse = value))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.patientResponse}
            />
            <ProcedureMultiSelect
              label="Post-procedure Instructions"
              options={selectOptions?.postProcedureInstructions}
              values={state.postInstructions}
              onChange={(values) => updateState((state) => (state.postInstructions = values))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.postProcedureInstructions}
            />
            <ProcedureOtherTextInput
              parentLabel="Post-procedure Instructions"
              visible={state.postInstructions?.includes(OTHER) ?? false}
              value={state.otherPostInstructions}
              onChange={(value) => updateState((state) => (state.otherPostInstructions = value))}
              disabled={isReadOnly}
            />
            <ProcedureDropdown
              label="Time spent"
              options={selectOptions?.timeSpent}
              value={state.timeSpent}
              onChange={(value) => updateState((state) => (state.timeSpent = value))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.timeSpent}
            />
            <ProcedureRadioGroup
              label="Documented by"
              options={DOCUMENTED_BY}
              value={state.documentedBy}
              onChange={(value) => updateState((state) => (state.documentedBy = value))}
              disabled={isReadOnly}
              dataTestId={dataTestIds.documentProcedurePage.documentedBy}
            />
            <TooltipWrapper tooltipProps={CPT_TOOLTIP_PROPS}>
              <Typography style={{ color: '#0F347C', fontSize: '16px', fontWeight: '500' }}>CPT Code</Typography>
            </TooltipWrapper>
            <CodingAssistPanel
              evaluation={forwardEvaluation}
              isEvaluating={codingAssistIsEvaluating}
              rulesVintage={codingAssist.rulesVintage}
              procedureTypeSelected={Boolean(formValues.procedureType)}
              isReadOnly={isReadOnly}
              selectedCodes={state.cptCodes ?? []}
              onAddCodes={addRecommendedCptCodes}
            />
            <DocumentationCheck evaluation={codingEvaluations?.defense} suggestionVisible={suggestionVisible} />
            <ProcedureCptCodesField
              codes={state.cptCodes ?? []}
              searchOptions={cptSearchOptions}
              isSearching={isSearching}
              searchTerm={debouncedSearchTerm}
              onSearchTermChange={debouncedHandleInputChange}
              onAdd={(code) => updateState((state) => (state.cptCodes = [...(state.cptCodes ?? []), code]))}
              onDelete={(code) =>
                updateState(
                  (state) => (state.cptCodes = state.cptCodes?.filter((cptCode) => cptCode.code != code.code))
                )
              }
              disabled={isReadOnly}
            />
            <Divider orientation="horizontal" />
            <Box style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Stack direction="row" spacing={2}>
                <RoundedButton color="primary" onClick={onCancel}>
                  Cancel
                </RoundedButton>
                {!procedureId && (
                  <RoundedButton color="primary" onClick={handleClearForm}>
                    Clear Form
                  </RoundedButton>
                )}
              </Stack>
              <RoundedButton
                color="primary"
                variant="contained"
                disabled={isReadOnly}
                onClick={methods.handleSubmit(onSave)}
                data-testid={dataTestIds.documentProcedurePage.saveButton}
              >
                Save
              </RoundedButton>
            </Box>
            {Object.entries(errors).length > 0 && (
              <FormHelperText sx={{ textAlign: 'right' }} error={true}>
                Please fix all errors
              </FormHelperText>
            )}
          </Stack>
        </AccordionCard>
      </Stack>
      <Backdrop sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })} open={saveInProgress}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <ProcedureQuickPickDialogs
        open={quickPickDialogOpen}
        name={quickPickName}
        onNameChange={setQuickPickName}
        existingQuickPicks={existingQuickPicks}
        saving={quickPickSaving}
        onClose={() => setQuickPickDialogOpen(false)}
        onSave={(overwriteId) => void onSaveAsQuickPick(overwriteId)}
      />
    </FormProvider>
  );
}

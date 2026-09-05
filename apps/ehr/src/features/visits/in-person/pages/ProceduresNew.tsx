import { AddCircleOutline, CheckCircle } from '@mui/icons-material';
import {
  Autocomplete,
  Backdrop,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Box, Stack, useTheme } from '@mui/system';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker, LocalizationProvider, TimePicker } from '@mui/x-date-pickers-pro';
import Oystehr from '@oystehr/sdk';
import { keepPreviousData, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { ValueSet } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createProcedureQuickPick, getProcedureQuickPicks, updateProcedureQuickPick } from 'src/api/api';
import { AccordionCard } from 'src/components/AccordionCard';
import { ActionsList } from 'src/components/ActionsList';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { AutocompleteInput } from 'src/components/input/AutocompleteInput';
import { RoundedButton } from 'src/components/RoundedButton';
import { UnsavedDraftWarning } from 'src/components/UnsavedDraftWarning';
import { CPT_TOOLTIP_PROPS, TooltipWrapper } from 'src/components/WithTooltip';
import { QUERY_STALE_TIME } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { useCommandPaletteSource } from 'src/hooks/useCommandPaletteSource';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { sortQuickPicks, useMergedProcedureQuickPicks } from 'src/hooks/useMergedQuickPicks';
import { usePendingQuickPick } from 'src/hooks/usePendingQuickPick';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { useMarkDraftNavigatedAway, useProcedureStore } from 'src/state/draft-data.store';
import { PROCEDURES_CONFIG } from 'utils/lib/ottehr-config/procedures';
import { formatCptCodeForDisplay, sidedSiteFromLegacyBodySite } from 'utils/lib/procedure-coding/codec';
import { StructuredProcedureFacts } from 'utils/lib/procedure-coding/model.types';
import { CPTCodeDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { IcdSearchResponse } from 'utils/lib/types/api/icd-search/icd-search.types';
import {
  BODY_SIDES_VALUE_SET_URL,
  BODY_SITES_VALUE_SET_URL,
  COMPLICATIONS_VALUE_SET_URL,
  MEDICATIONS_USED_VALUE_SET_URL,
  PATIENT_RESPONSES_VALUE_SET_URL,
  POST_PROCEDURE_INSTRUCTIONS_VALUE_SET_URL,
  PROCEDURE_TYPES_VALUE_SET_URL,
  SUPPLIES_VALUE_SET_URL,
  TECHNIQUES_VALUE_SET_URL,
  TIME_SPENT_VALUE_SET_URL,
} from 'utils/lib/types/api/procedures.constants';
import { ProcedurePageState } from 'utils/lib/types/api/procedures.types';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { FHIR_CODE_REGEX } from 'utils/lib/types/constants';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { AiSectionContainer } from '../../shared/components/AiSection';
import { DiagnosesField } from '../../shared/components/assessment-tab/DiagnosesField';
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
import { FactsRecord, StructuredFactsFields } from '../components/StructuredFactsFields';
import { useProcedureCoding } from '../hooks/useProcedureCoding';
import { ROUTER_PATH } from '../routing/routesInPerson';
import {
  combineMultipleValuesForSave,
  getPredefinedValueIfOther,
  getPredefinedValueOrOther,
  mergeOtherFromQuickPick,
  OTHER,
  parseWithOther,
  splitOtherForQuickPick,
} from './procedureOtherFields';

const PERFORMED_BY = ['Healthcare staff', 'Provider', 'Both'];
const SPECIMEN_SENT = ['Yes', 'No'];
const DOCUMENTED_BY = ['Provider', 'Healthcare staff'];

// Keys from ProcedureQuickPickData that should be applied to page state when a quick pick is selected.
// Encounter-specific fields (diagnoses, performerType, consentObtained) and metadata (id, name, procedureType)
// are intentionally excluded.
const QUICK_PICK_APPLY_KEYS: (keyof ProcedureQuickPickData)[] = [
  'cptCodes',
  'medicationUsed',
  'bodySite',
  'otherBodySite',
  'bodySide',
  'technique',
  'suppliesUsed',
  'otherSuppliesUsed',
  'procedureDetails',
  'structuredFacts',
  'specimenSent',
  'complications',
  'otherComplications',
  'patientResponse',
  'postInstructions',
  'otherPostInstructions',
  'timeSpent',
  'documentedBy',
];

const mergeCptCodes = (
  existingCodes: ProcedureQuickPickData['cptCodes'],
  incomingCodes: ProcedureQuickPickData['cptCodes']
): ProcedureQuickPickData['cptCodes'] => {
  if (!existingCodes?.length) {
    return incomingCodes;
  }

  if (!incomingCodes?.length) {
    return existingCodes;
  }

  const mergedCodes = [...existingCodes];

  incomingCodes.forEach((incomingCode) => {
    if (!mergedCodes.some((existingCode) => existingCode.code === incomingCode.code)) {
      mergedCodes.push(incomingCode);
    }
  });

  return mergedCodes;
};

interface LocalPageState extends Omit<ProcedurePageState, 'procedureDate' | 'procedureTime'> {
  procedureDate?: DateTime | null;
  procedureTime?: DateTime | null;
}

interface ProcedureType {
  name: string;
  code: string;
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

function pageStateToDraft(pageState: LocalPageState): ProcedurePageState {
  return {
    consentObtained: pageState.consentObtained,
    cptCodes: pageState.cptCodes,
    diagnoses: pageState.diagnoses,
    procedureDate: pageState.procedureDate?.toISO() || undefined,
    procedureTime: pageState.procedureTime?.toISO() || undefined,
    performerType: pageState.performerType,
    medicationUsed: pageState.medicationUsed,
    bodySite: pageState.bodySite,
    otherBodySite: pageState.otherBodySite,
    bodySide: pageState.bodySide,
    technique: pageState.technique,
    suppliesUsed: pageState.suppliesUsed,
    otherSuppliesUsed: pageState.otherSuppliesUsed,
    procedureDetails: pageState.procedureDetails,
    structuredFacts: pageState.structuredFacts,
    specimenSent: pageState.specimenSent,
    complications: pageState.complications,
    otherComplications: pageState.otherComplications,
    patientResponse: pageState.patientResponse,
    postInstructions: pageState.postInstructions,
    otherPostInstructions: pageState.otherPostInstructions,
    timeSpent: pageState.timeSpent,
    documentedBy: pageState.documentedBy,
  };
}

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
  const { data: selectOptions, isLoading: isSelectOptionsLoading } = useSelectOptions(oystehr);
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

  const [state, setState] = useState<LocalPageState>({
    procedureDate: draft.procedureDate ? DateTime.fromISO(draft.procedureDate) : DateTime.now(),
    procedureTime: draft.procedureTime ? DateTime.fromISO(draft.procedureTime) : DateTime.now(),
    consentObtained: draft.consentObtained,
    cptCodes: draft.cptCodes,
    diagnoses: draft.diagnoses,
    performerType: draft.performerType,
    medicationUsed: draft.medicationUsed,
    bodySite: draft.bodySite,
    otherBodySite: draft.otherBodySite,
    bodySide: draft.bodySide,
    technique: draft.technique,
    suppliesUsed: draft.suppliesUsed,
    otherSuppliesUsed: draft.otherSuppliesUsed,
    procedureDetails: draft.procedureDetails,
    structuredFacts: draft.structuredFacts,
    specimenSent: draft.specimenSent,
    complications: draft.complications,
    otherComplications: draft.otherComplications,
    patientResponse: draft.patientResponse,
    postInstructions: draft.postInstructions,
    otherPostInstructions: draft.otherPostInstructions,
    timeSpent: draft.timeSpent,
    documentedBy: draft.documentedBy,
  });
  const [saveInProgress, setSaveInProgress] = useState<boolean>(false);
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);
  const [overwriteTarget, setOverwriteTarget] = useState<ProcedureQuickPickData | null>(null);
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

  const updateState = useCallback(
    (stateMutator: (draft: LocalPageState) => void): void => {
      setState((prev) => {
        const next = { ...prev };
        stateMutator(next);
        if (!procedureId && encounter.id) {
          setDraft(encounter.id, pageStateToDraft(next));
        }
        return next;
      });
    },
    [setDraft, encounter.id, procedureId]
  );

  const handleClearForm = (): void => {
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

  // Deterministic coding assist (client-side, synchronous) — the sole
  // code-suggestion source on this page; the legacy AI suggestion list is retired.
  const selectedProcedureTypeCode =
    selectOptions?.procedureTypes.find((procedureType) => procedureType.name === formValues.procedureType)?.code ??
    formValues.procedureType;
  const codingAssist = useProcedureCoding({
    procedureTypeCode: selectedProcedureTypeCode,
    structuredFacts: state.structuredFacts,
    doc: {
      procedureDetails: state.procedureDetails,
      technique: state.technique,
      suppliesUsed: state.suppliesUsed,
      medicationUsed: state.medicationUsed,
      bodySite: state.bodySite,
      bodySide: state.bodySide,
      patientResponse: state.patientResponse,
      postInstructions: state.postInstructions,
      timeSpent: state.timeSpent,
      performerType: state.performerType,
      documentedBy: state.documentedBy,
    },
    selectedCptCodes: state.cptCodes?.map((cptCode) => cptCode.code) ?? [],
  });
  const codingFamily = codingAssist.family;

  // Keep structuredFacts stamped with the active family: seed on procedure-type
  // switch (laceration seeds a wound row from the legacy body site/side via the
  // shared shim), clear when the selected type is uncovered.
  useEffect(() => {
    if (codingFamily == null) {
      if (state.structuredFacts != null) {
        updateState((state) => (state.structuredFacts = undefined));
      }
      return;
    }
    if (state.structuredFacts?.family === codingFamily) {
      return;
    }
    updateState((state) => {
      const seeded = { family: codingFamily } as StructuredProcedureFacts;
      if (seeded.family === 'laceration') {
        const seedSite = sidedSiteFromLegacyBodySite(state.bodySite, state.bodySide);
        if (seedSite != null) {
          seeded.wounds = { [seedSite]: [{}] };
        }
      }
      state.structuredFacts = seeded;
    });
  }, [codingFamily, state.structuredFacts, updateState]);

  const [initialValuesSet, setInitialValuesSet] = useState<boolean>(false);
  const [initialFormStateSet, setInitialFormStateSet] = useState<boolean>(false);
  const procedure = chartData?.procedures?.find((procedure) => procedure.resourceId === procedureId);

  useEffect(() => {
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
      structuredFacts: procedure.structuredFacts,
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
  }, [procedure, setState, initialValuesSet, isSelectOptionsLoading, selectOptions]);

  const onCancel = (): void => {
    if (!procedureId && encounter.id) clearDraft(encounter.id);
    if (onFinished) onFinished();
    else navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
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
            structuredFacts: state.structuredFacts,
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
      if (onFinished) onFinished();
      else navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES}`);
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
      cptCodes: state.cptCodes?.map((c) => ({ code: c.code, display: c.display })),
      // diagnoses, consentObtained, and performerType excluded — encounter-specific
      medicationUsed: state.medicationUsed,
      bodySite: state.bodySite,
      otherBodySite: state.bodySite === OTHER ? state.otherBodySite?.trim() : undefined,
      bodySide: state.bodySide,
      technique: state.technique,
      suppliesUsed: supplies.values,
      otherSuppliesUsed: supplies.other,
      procedureDetails: state.procedureDetails,
      structuredFacts: state.structuredFacts,
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

  // Suggestions can legitimately repeat a code with different modifiers
  // (94640 + 94640-76), so line identity is code + modifiers, not code alone.
  const cptLineKey = (code: string, modifierCodes: string[]): string => [code, ...modifierCodes].join('-');
  const cptDtoLineKey = (cptCode: CPTCodeDTO): string =>
    cptLineKey(
      cptCode.code,
      (cptCode.modifier ?? []).map((modifier) => modifier.code)
    );

  const existingCptLineKeys = useMemo(
    () => new Set(state.cptCodes?.map(cptDtoLineKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.cptCodes]
  );

  const addSuggestedCptCodes = (entries: CPTCodeDTO[]): void =>
    updateState((state) => {
      const cptCodes = [...(state.cptCodes ?? [])];
      entries.forEach((entry) => {
        if (!cptCodes.some((cptCode) => cptDtoLineKey(cptCode) === cptDtoLineKey(entry))) {
          cptCodes.push(entry);
        }
      });
      state.cptCodes = cptCodes;
    });

  const humanizeCodingFlag = (flag: string): string => {
    const [kind, ...rest] = flag.split(':');
    const detail = rest.join(':').replace(/_/g, ' ');
    switch (kind) {
      case 'blocked':
        return `Blocked — ${detail}`;
      case 'advisory':
        return `Advisory — ${detail}`;
      case 'em_only':
        return `E/M only — ${detail}`;
      case 'out_of_family':
        return `Outside this code family — ${detail}`;
      case 'requires_bespoke':
        return `Needs manual review — ${detail}`;
      case 'verify':
        return `Verify — ${detail}`;
      case 'missing':
        return `Missing documentation — ${detail}`;
      case 'engine_error':
        return `Coding engine error — ${detail}`;
      case 'units_capped':
        return `Units capped — ${rest[0]} is limited to ${rest[1]} unit(s) per day`;
      case 'no_row_matched':
      case 'no_band_matched':
        return `No coding rule matched the documented facts (${detail}) — needs manual review`;
      case 'second_initial':
        return `Second initial service — ${detail}`;
      case 'complex_floor':
        return `Below the complex-repair length floor (${detail}) — reported at the layered-closure level`;
      case 'medicare_adhesive_only':
        return `Medicare adhesive-only closure — billed as ${rest[0]}`;
      case 'review':
        return `Needs review — ${detail}`;
      default:
        return flag.replace(/_/g, ' ');
    }
  };

  // These families capture the site in a dedicated structured field (wound
  // picker, FB site, splint region, per-ear/per-side methods), so the generic
  // Site/location + Side dropdowns would be redundant and are hidden.
  const familyHasDedicatedSiteField =
    codingAssist.family != null &&
    ['laceration', 'foreign-body', 'splinting', 'cerumen', 'nasal-packing'].includes(codingAssist.family);

  const sortedAlphabetically = (options: string[] | undefined): string[] | undefined =>
    options && [...options].sort((a, b) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)));

  const suggestion = codingAssist.suggestion;
  const suggestionFlags = suggestion?.flags ?? [];
  // Engine lines persist the bare code as display (the FHIR mapping requires a
  // non-empty display); modifiers and units ride the DTO's structured fields.
  // Identical lines (same code + modifiers, e.g. a repeat 93000-76) aggregate
  // into units; lines differing only in modifiers stay separate.
  const suggestedEntries: CPTCodeDTO[] = [];
  (suggestion?.codes ?? []).forEach((line) => {
    const key = cptLineKey(line.code, line.modifiers);
    const existing = suggestedEntries.find((entry) => cptDtoLineKey(entry) === key);
    if (existing) {
      existing.billableUnits = (existing.billableUnits ?? 1) + line.units;
      return;
    }
    suggestedEntries.push({
      code: line.code,
      display: line.code,
      ...(line.modifiers.length > 0 && {
        modifier: line.modifiers.map((modifier) => ({ code: modifier, display: modifier })),
      }),
      ...(line.units > 1 && { billableUnits: line.units }),
    });
  });
  const allSuggestedAdded =
    suggestedEntries.length > 0 && suggestedEntries.every((entry) => existingCptLineKeys.has(cptDtoLineKey(entry)));

  // The deterministic engine is the sole code-suggestion source (the legacy AI
  // list is retired). Uncovered procedure types render no suggestion content.
  const recommendedCptCodesContent = (): ReactNode => {
    if (!formValues.procedureType) {
      return <Typography color="secondary.light">Select a procedure type to see recommended CPT codes</Typography>;
    }
    if (codingAssist.family == null || suggestion == null) {
      return null;
    }
    return (
      <>
        {suggestion.codes.length > 0 && (
          <Box data-testid={dataTestIds.documentProcedurePage.bestMatchCptCode}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.dark' }}>
              Best match — from your documentation
            </Typography>
            {suggestedEntries.map((entry, index) => (
              <Box
                key={`${index}-${cptDtoLineKey(entry)}`}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}
              >
                <Typography data-testid={dataTestIds.documentProcedurePage.recommendedCptCode(entry.code)}>
                  {formatCptCodeForDisplay(entry, ' – ')}
                </Typography>
                {!isReadOnly &&
                  (existingCptLineKeys.has(cptDtoLineKey(entry)) ? (
                    <IconButton size="small" disabled aria-label={`CPT code ${entry.code} already added`}>
                      <CheckCircle sx={{ fontSize: '17px', color: 'success.main' }} />
                    </IconButton>
                  ) : (
                    <Tooltip title="Add CPT code">
                      <IconButton
                        size="small"
                        aria-label={`Add CPT code ${entry.code}`}
                        onClick={() => addSuggestedCptCodes([entry])}
                        data-testid={dataTestIds.documentProcedurePage.cptCodeQuickAddButton(entry.code)}
                      >
                        <AddCircleOutline sx={{ fontSize: '17px' }} />
                      </IconButton>
                    </Tooltip>
                  ))}
              </Box>
            ))}
            {!isReadOnly && suggestedEntries.length > 1 && !allSuggestedAdded && (
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => addSuggestedCptCodes(suggestedEntries)}
                data-testid={dataTestIds.documentProcedurePage.cptCodeQuickAddAllButton}
              >
                ＋ Add all suggested codes
              </Typography>
            )}
          </Box>
        )}
        {suggestion.codes.length === 0 && suggestionFlags.length === 0 && (
          <Typography color="secondary.light">No suggestions</Typography>
        )}
        {suggestionFlags.map((flag) => (
          <Typography key={flag} variant="body2">
            {humanizeCodingFlag(flag)}
          </Typography>
        ))}
        {suggestion.review === true && (
          <Typography variant="body2" color="text.secondary">
            Needs manual coding review — the suggestion is not authoritative for this documentation.
          </Typography>
        )}
        {suggestion.requiredDocumentation.length > 0 && (
          <Box data-testid={dataTestIds.documentProcedurePage.requiredDocumentationList}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Required documentation
            </Typography>
            {suggestion.requiredDocumentation.map((item) => (
              <Typography key={item} variant="caption" component="div" color="text.secondary">
                • {item}
              </Typography>
            ))}
          </Box>
        )}
      </>
    );
  };

  // ── Documentation defense — driven by codingDispatch.defend. ──
  const defense = codingAssist.defense;
  const notSupportedFindings = defense?.codes.filter((finding) => finding.status === 'not-supported') ?? [];
  const supportedCodes = defense?.codes.filter((f) => f.status === 'supported').map((f) => f.code) ?? [];
  const notAssessedCodes = defense?.codes.filter((f) => f.status === 'not-assessed').map((f) => f.code) ?? [];
  const payerNotes = [...new Set([...(suggestion?.payerNotes ?? []), ...(defense?.payerNotes ?? [])])];
  const amberBoxVisible = notSupportedFindings.length > 0;
  const positiveStateVisible = !amberBoxVisible && supportedCodes.length > 0;
  const notAssessedLineVisible = notAssessedCodes.length > 0 && (amberBoxVisible || positiveStateVisible);

  const payerNotesContent = (): ReactNode =>
    payerNotes.length > 0 ? (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {payerNotes.map((note) => (
          <Typography key={note} variant="caption" color="text.secondary">
            {note}
          </Typography>
        ))}
      </Box>
    ) : null;

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
              {formatCptCodeForDisplay(value)}
            </Typography>
          )}
          renderActions={(value) =>
            !isReadOnly ? (
              <DeleteIconButton
                onClick={() =>
                  // Delete this line only — the same code can appear again with
                  // different modifiers (94640 + 94640-76).
                  updateState((state) => (state.cptCodes = state.cptCodes?.filter((cptCode) => cptCode !== value)))
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
    stateMutator: (value: string, state: LocalPageState) => void,
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
    stateMutator: (value: string, state: LocalPageState) => void
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
    stateMutator: (value: string, state: LocalPageState) => void,
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
    stateMutator: (values: string[], state: LocalPageState) => void,
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
    if (quickPick.procedureType) {
      const resolvedProcedureType =
        selectOptions?.procedureTypes.find((procedureType) => procedureType.code === quickPick.procedureType)?.name ??
        quickPick.procedureType;
      methods.reset({
        ...formValues,
        procedureType: resolvedProcedureType,
      });
      // methods.reset() above doesn't reliably notify the procedureType draft-sync subscription,
      // so persist it directly here — same as every other quick-pick field going through updateState.
      if (!procedureId && encounter.id) {
        setDraft(encounter.id, { procedureType: resolvedProcedureType });
      }
    }
    updateState((state) => {
      QUICK_PICK_APPLY_KEYS.forEach((key) => {
        if (key === 'cptCodes') {
          state.cptCodes = mergeCptCodes(state.cptCodes, quickPick.cptCodes);
          return;
        }

        // Arrays hold only real options; re-add the "Other" chip so its text input renders.
        if (key === 'suppliesUsed') {
          state.suppliesUsed = mergeOtherFromQuickPick(quickPick.suppliesUsed, quickPick.otherSuppliesUsed);
          return;
        }
        if (key === 'postInstructions') {
          state.postInstructions = mergeOtherFromQuickPick(quickPick.postInstructions, quickPick.otherPostInstructions);
          return;
        }

        (state as Record<string, unknown>)[key] = quickPick[key];
      });
    });
  };

  const onQuickPickSelectRef = useRef(onQuickPickSelect);
  onQuickPickSelectRef.current = onQuickPickSelect;

  const commandPaletteItems = useMemo(
    () =>
      procedureId || isReadOnly
        ? []
        : mergedQuickPicks.map((quickPick) => ({
            id: `procedure-${quickPick.id ?? quickPick.name}`,
            label: quickPick.name,
            category: 'Add Procedure',
            onSelect: () => onQuickPickSelectRef.current(quickPick),
          })),
    [isReadOnly, mergedQuickPicks, procedureId]
  );
  useCommandPaletteSource('procedure-quick-picks', commandPaletteItems);

  const handlePendingQuickPick = useCallback((payload: ProcedureQuickPickData) => {
    onQuickPickSelectRef.current(payload);
  }, []);
  usePendingQuickPick('procedures', handlePendingQuickPick, !isSelectOptionsLoading);

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
            {!familyHasDedicatedSiteField && (
              <>
                {dropdown(
                  'Site/location',
                  sortedAlphabetically(selectOptions?.bodySites),
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
              </>
            )}
            {codingAssist.manifest != null && state.structuredFacts != null && (
              <StructuredFactsFields
                manifest={codingAssist.manifest}
                facts={state.structuredFacts as unknown as FactsRecord}
                onChange={(next) =>
                  updateState((state) => (state.structuredFacts = next as unknown as StructuredProcedureFacts))
                }
                isReadOnly={isReadOnly}
              />
            )}
            {multiSelect(
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
            <AiSectionContainer>{recommendedCptCodesContent()}</AiSectionContainer>
            {amberBoxVisible && (
              <Container
                style={{
                  background: '#FFF3E0',
                  borderRadius: '8px',
                  padding: '4px 8px 4px 8px',
                }}
              >
                <Container style={{ display: 'flex', alignItems: 'center', padding: 0 }}>
                  <Typography variant="body1" style={{ fontWeight: 700 }}>
                    Documentation Checks
                  </Typography>
                </Container>
                <Box
                  sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, paddingTop: '4px' }}
                  data-testid={dataTestIds.documentProcedurePage.codingDefenseFindings}
                >
                  {notSupportedFindings.map((finding) => (
                    <Box key={finding.code}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {finding.code}
                      </Typography>
                      {finding.reasons.map((reason) => (
                        <Typography key={reason} variant="body2">
                          {reason}
                        </Typography>
                      ))}
                    </Box>
                  ))}
                </Box>
                {payerNotesContent()}
              </Container>
            )}
            {positiveStateVisible && (
              <Box data-testid={dataTestIds.documentProcedurePage.codingDefenseSupported}>
                <Typography variant="body2" sx={{ color: 'success.main' }}>
                  Documentation supports {supportedCodes.join(', ')}
                </Typography>
                {payerNotesContent()}
              </Box>
            )}
            {notAssessedLineVisible && (
              <Typography
                variant="body2"
                color="text.secondary"
                data-testid={dataTestIds.documentProcedurePage.codingDefenseNotAssessed}
              >
                {notAssessedCodes.join(', ')} &mdash; not assessed by documentation checks
              </Typography>
            )}
            {cptWidget()}
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

      {/* Add to Quick Picks Dialog */}
      <Dialog open={quickPickDialogOpen} onClose={() => setQuickPickDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add to Quick Picks</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={existingQuickPicks.map((qp) => qp.name)}
            value={quickPickName}
            onChange={(_e, newValue) => setQuickPickName(newValue ?? '')}
            onInputChange={(_e, newInputValue) => setQuickPickName(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Quick Pick Name"
                fullWidth
                sx={{ mt: 1 }}
                autoFocus
                placeholder="Enter a name or select an existing quick pick"
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setQuickPickDialogOpen(false)} disabled={quickPickSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!quickPickName.trim() || quickPickSaving}
            onClick={() => {
              const existing = existingQuickPicks.find(
                (qp) => qp.name.toLowerCase() === quickPickName.trim().toLowerCase()
              );
              if (existing?.id) {
                setOverwriteTarget(existing);
                setConfirmOverwriteOpen(true);
              } else {
                void onSaveAsQuickPick();
              }
            }}
          >
            {quickPickSaving ? <CircularProgress size={20} /> : 'Save Quick Pick'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Overwrite Confirmation Dialog */}
      <Dialog open={confirmOverwriteOpen} onClose={() => setConfirmOverwriteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Existing Quick Pick?</DialogTitle>
        <DialogContent>
          <Typography>
            A quick pick named &ldquo;{overwriteTarget?.name}&rdquo; already exists. Do you want to replace it with the
            current procedure data?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOverwriteOpen(false)}>Back</Button>
          <Button
            variant="contained"
            onClick={() => {
              setConfirmOverwriteOpen(false);
              if (overwriteTarget?.id) {
                void onSaveAsQuickPick(overwriteTarget.id);
              }
            }}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>
    </FormProvider>
  );
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
      if (oystehr == null) {
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
      if (!item.display || !item.code) return null;

      const getCode = (urlPart: string): { code: string; display: string; system?: string } | undefined => {
        const coding = item.extension?.find((ext) => ext.url?.includes(urlPart))?.valueCodeableConcept?.coding?.[0];

        return coding?.code && coding?.display
          ? { code: coding.code, display: coding.display, system: coding.system }
          : undefined;
      };

      return {
        name: item.display,
        code: item.code,
        cpt: getCode('procedure-type-cpt'),
        hcpcs: getCode('procedure-type-hcpcs'),
      };
    })
    .filter((p): p is ProcedureType => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usePatientRadiologyOrders } from 'src/features/radiology/components/usePatientRadiologyOrders';
import {
  BillingSuggestionInput,
  BillingSuggestionOutput,
  CPTCodeDTO,
  DiagnosisDTO,
  getRosFindingStateFromKey,
  InPersonRosConfig,
  PROVIDER_CONFIG,
  rosField,
  RosFindingState,
} from 'utils';
import { getReturningPatient } from '../components/additional-questions/AdditionalQuestionsPatientColumn';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';
import { useRosObservationsStore } from '../stores/appointment/ros-observations.store';
import { useChartFields } from './useChartFields';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export interface BillingSuggestionsResult {
  icdCodesSuggest: { code: string; description: string; reason: string }[] | undefined;
  cptCodesSuggest: { code: string; description: string; reason: string }[] | undefined;
  emCode: { code: string; description: string; upcodingSuggestion: string }[] | undefined;
  codingSuggestions: string | undefined;
  isLoading: boolean;
}

// ── Pure data-shaping function ──────────────────────────────────────────────

export function buildBillingSuggestionInput(params: {
  chartData: ReturnType<typeof useChartData>['chartData'];
  chartDataFields: any;
  radiologyOrders: any[] | undefined;
  appointment: any;
  patient: any;
  rosFindings?: string;
}): BillingSuggestionInput | null {
  const { chartData, chartDataFields, radiologyOrders, appointment, patient, rosFindings } = params;

  // External lab results
  const externalLabOrderParts: string[] = [];
  if (chartDataFields?.externalLabResults?.labOrderResults) {
    chartDataFields.externalLabResults.labOrderResults.forEach((result: any) => {
      if (result.resultValues?.length) {
        externalLabOrderParts.push(`Test: ${result.name} | Results: ${result.resultValues.join(', ')}`);
      } else {
        externalLabOrderParts.push(`Test: ${result.name} | Result: received`);
      }
    });
  }
  if (chartDataFields?.externalLabResults?.resultsPending?.length) {
    chartDataFields.externalLabResults.resultsPending.forEach((name: string) => {
      externalLabOrderParts.push(`Test: ${name} | Result: PENDING`);
    });
  }

  // In-house lab results
  const inHouseLabOrderParts: string[] = [];
  if (chartDataFields?.inHouseLabResults?.labOrderResults) {
    chartDataFields.inHouseLabResults.labOrderResults.forEach((result: any) => {
      if (result.resultValues?.length) {
        inHouseLabOrderParts.push(`Test: ${result.name} | Results: ${result.resultValues.join(', ')}`);
      } else {
        const resultValue = result.simpleResultValue ?? 'completed';
        inHouseLabOrderParts.push(`Test: ${result.name} | Result: ${resultValue}`);
      }
    });
  }
  if (chartDataFields?.inHouseLabResults?.resultsPending?.length) {
    chartDataFields.inHouseLabResults.resultsPending.forEach((name: string) => {
      inHouseLabOrderParts.push(`Test: ${name} | Result: PENDING`);
    });
  }

  // Radiology
  const radiologyOrdersString = radiologyOrders?.map((order: any) => order.studyType).join(', ');
  const radiologyReportsString =
    radiologyOrders
      ?.filter((order: any) => order.finalReport || order.preliminaryReport)
      .map((order: any) => {
        const report = order.finalReport || order.preliminaryReport;
        const reportType = order.finalReport ? 'Final' : 'Preliminary';
        try {
          return `${order.studyType} (${reportType}): ${atob(report!)}`;
        } catch {
          return `${order.studyType} (${reportType}): ${report}`;
        }
      })
      .join('\n') || '';

  // Procedures
  const proceduresParts: string[] = [];
  if (chartData?.procedures) {
    chartData.procedures.forEach((procedure) => {
      const parts = [`Procedure: ${procedure.procedureType || 'Unknown'}`];
      if (procedure.bodySite)
        parts.push(`Body Site: ${procedure.bodySite}${procedure.bodySide ? ` (${procedure.bodySide})` : ''}`);
      if (procedure.technique?.length) parts.push(`Technique: ${procedure.technique.join(', ')}`);
      if (procedure.cptCodes?.length) parts.push(`CPT: ${procedure.cptCodes.map((c) => c.code).join(', ')}`);
      if (procedure.diagnoses?.length) parts.push(`Dx: ${procedure.diagnoses.map((d) => d.code).join(', ')}`);
      if (procedure.medicationUsed) parts.push(`Medication: ${procedure.medicationUsed}`);
      if (procedure.suppliesUsed) parts.push(`Supplies: ${procedure.suppliesUsed}`);
      if (procedure.procedureDetails) parts.push(`Details: ${procedure.procedureDetails}`);
      if (procedure.complications) parts.push(`Complications: ${procedure.complications}`);
      if (procedure.specimenSent) parts.push('Specimen Sent: Yes');
      proceduresParts.push(parts.join(' | '));
    });
  }

  // Patient status (new vs established)
  let newPatient = undefined;
  const newPatientFromChart = chartData?.observations?.find(
    (observation) => observation.field === 'seen-in-last-three-years' || observation.field === 'seen-in-last-3-years'
  );
  const newPatientFromAppointmentCreation = !getReturningPatient(chartData, appointment);

  if (newPatientFromChart) {
    newPatient = newPatientFromChart?.value === 'no' || newPatientFromChart?.value === false;
  } else {
    newPatient = newPatientFromAppointmentCreation;
  }

  // Patient demographics
  let patientAge: string | undefined;
  if (patient?.birthDate) {
    const birth = new Date(patient.birthDate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
      years--;
    }
    patientAge = `${years} years`;
  }

  return {
    newPatient,
    patientAge,
    patientSex: patient?.gender,
    hpi: chartDataFields?.chiefComplaint?.text ?? '',
    mdm: chartDataFields?.medicalDecision?.text ?? '',
    diagnoses: chartData?.diagnosis,
    billing: chartData?.cptCodes
      ? [...chartData.cptCodes, ...(chartData.emCode ? [chartData.emCode] : [])]
      : chartData?.emCode
      ? [chartData.emCode]
      : undefined,
    externalLabOrders: externalLabOrderParts.join('\n'),
    internalLabOrders: inHouseLabOrderParts.join('\n'),
    radiologyOrders: radiologyOrdersString,
    radiologyReports: radiologyReportsString,
    procedures: proceduresParts.join('\n'),
    rosFindings: rosFindings || '',
  };
}

// ── Stable hash of the input for use as a React Query cache key ─────────────

function hashInput(input: BillingSuggestionInput): string {
  return JSON.stringify(input);
}

// ── Main hook ───────────────────────────────────────────────────────────────

export const useBillingSuggestions = (): BillingSuggestionsResult => {
  const { chartData, isLoading: chartDataLoading } = useChartData();
  const { appointment, encounter, patient } = useAppointmentData();
  const encounterId = encounter.id;

  const {
    data: chartDataFields,
    isLoading: chartDataFieldsLoading,
    isFetching: chartDataFieldsFetching,
  } = useChartFields({
    requestedFields: {
      chiefComplaint: {
        _tag: 'chief-complaint',
      },
      medicalDecision: {
        _tag: 'medical-decision',
      },
      inHouseLabResults: {},
      externalLabResults: {},
    },
  });

  const { orders: radiologyOrders } = usePatientRadiologyOrders({
    encounterIds: encounterId,
  });

  const apiClient = useOystehrAPIClient();
  const rosState = useRosObservationsStore();

  const inputsReady = !chartDataLoading && !chartDataFieldsLoading && !chartDataFieldsFetching;

  // Build ROS positive findings string grouped by system
  const rosFindingsGroupedBySystem = useMemo(() => {
    const reported = Object.values(rosState).filter(
      (obs) => obs.value && getRosFindingStateFromKey(obs.field) === RosFindingState.Reports
    );

    if (reported.length === 0) return '';

    const systemFindings: Record<string, string[]> = {};

    for (const [_systemKey, system] of Object.entries(InPersonRosConfig)) {
      const items: string[] = [];
      for (const [baseKey, item] of Object.entries(system.items)) {
        const fieldKey = rosField(baseKey, RosFindingState.Reports);
        if (rosState[fieldKey]?.value) {
          items.push(item.label);
        }
      }
      if (items.length > 0) {
        systemFindings[system.label] = items;
      }
    }

    return Object.entries(systemFindings)
      .map(([system, items]) => `${system}: ${items.join(', ')}`)
      .join('. ');
  }, [rosState]);

  const billingInput = useMemo(() => {
    if (!inputsReady) return null;
    return buildBillingSuggestionInput({
      chartData,
      chartDataFields,
      radiologyOrders,
      appointment,
      patient,
      rosFindings: rosFindingsGroupedBySystem,
    });
  }, [inputsReady, chartData, chartDataFields, radiologyOrders, appointment, patient, rosFindingsGroupedBySystem]);

  const inputHash = useMemo(() => (billingInput ? hashInput(billingInput) : ''), [billingInput]);

  const { data, isLoading: queryLoading } = useQuery<BillingSuggestionOutput>({
    queryKey: ['billing-suggestions', encounterId, inputHash],
    queryFn: async () => {
      if (!apiClient || !billingInput) {
        throw new Error('api client or billing input is not defined');
      }
      return apiClient.recommendBillingSuggestions(billingInput);
    },
    enabled: !!apiClient && !!billingInput && !!encounterId,
    staleTime: Infinity,
    retry: 0,
  });

  const currentDiagnoses: DiagnosisDTO[] | undefined = chartData?.diagnosis;
  const currentCptCodes: CPTCodeDTO[] = [];
  if (chartData?.cptCodes) {
    currentCptCodes.push(...chartData.cptCodes);
  }
  if (chartData?.emCode) {
    currentCptCodes.push(chartData.emCode);
  }

  const emCodeSet = new Set(PROVIDER_CONFIG.assessment.emCodeOptions.map((option) => option.code));

  const icdCodesSuggest = data?.icdCodes?.filter(
    (code) => !currentDiagnoses?.some((diagnosis) => diagnosis.code === code.code)
  );
  const cptCodesSuggest = data?.cptCodes?.filter(
    (code) => !currentCptCodes?.some((cptCode) => cptCode.code === code.code) && !emCodeSet.has(code.code)
  );

  return {
    icdCodesSuggest,
    cptCodesSuggest,
    emCode: data?.emCode,
    codingSuggestions: data?.codingSuggestions,
    isLoading: !inputsReady || queryLoading,
  };
};

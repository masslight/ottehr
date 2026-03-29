import React, { useState } from 'react';
import { usePatientLabOrders } from 'src/features/external-labs/components/labs-orders/usePatientLabOrders';
import { useInHouseLabOrders } from 'src/features/in-house-labs/components/orders/useInHouseLabOrders';
import { usePatientRadiologyOrders } from 'src/features/radiology/components/usePatientRadiologyOrders';
import {
  CPTCodeDTO,
  DiagnosisDTO,
  PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE,
  PATIENT_INFO_META_DATA_SYSTEM,
  PROVIDER_CONFIG,
} from 'utils';
import { useRecommendBillingSuggestions } from '../stores/appointment/appointment.queries';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';
import { useChartFields } from './useChartFields';

export interface BillingSuggestionsResult {
  icdCodesSuggest: { code: string; description: string; reason: string }[] | undefined;
  cptCodesSuggest: { code: string; description: string; reason: string }[] | undefined;
  emCode: { code: string; description: string; upcodingSuggestion: string }[] | undefined;
  codingSuggestions: string | undefined;
  isLoading: boolean;
}

export const useBillingSuggestions = (): BillingSuggestionsResult => {
  const { chartData, isLoading: chartDataLoading } = useChartData();
  const { appointment, encounter } = useAppointmentData();
  const encounterId = encounter.id;
  const currentDiagnoses: DiagnosisDTO[] | undefined = chartData?.diagnosis;
  const currentCptCodes: CPTCodeDTO[] | undefined = [];
  if (chartData?.cptCodes) {
    currentCptCodes.push(...chartData.cptCodes);
  }
  if (chartData?.emCode) {
    currentCptCodes.push(chartData.emCode);
  }

  const { data: chartDataFields, isLoading: chartDataFieldsLoading } = useChartFields({
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

  const { groupedLabOrdersForChartTable } = usePatientLabOrders({
    searchBy: { field: 'encounterId', value: encounterId || '' },
  });

  const { labOrders } = useInHouseLabOrders({ searchBy: { field: 'encounterId', value: encounterId || '' } });

  const { orders: radiologyOrders } = usePatientRadiologyOrders({
    encounterIds: encounterId,
  });

  const { mutateAsync: recommendBillingSuggestions } = useRecommendBillingSuggestions();
  const [icdCodes, setIcdCodes] = useState<{ code: string; description: string; reason: string }[] | undefined>(
    undefined
  );
  const [cptCodes, setCptCodes] = useState<{ code: string; description: string; reason: string }[] | undefined>(
    undefined
  );
  const [emCode, setEmCode] = useState<{ code: string; description: string; upcodingSuggestion: string }[] | undefined>(
    undefined
  );
  const [codingSuggestions, setCodingSuggestions] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const icdCodesSuggest = icdCodes?.filter(
    (code) => !currentDiagnoses?.some((diagnosis) => diagnosis.code === code.code)
  );
  const emCodeSet = new Set(PROVIDER_CONFIG.assessment.emCodeOptions.map((option) => option.code));
  const cptCodesSuggest = cptCodes?.filter(
    (code) => !currentCptCodes?.some((cptCode) => cptCode.code === code.code) && !emCodeSet.has(code.code)
  );

  React.useEffect(() => {
    console.log('[AI Suggestions] useEffect triggered');
    console.log(
      '[AI Suggestions] chartDataLoading:',
      chartDataLoading,
      'chartDataFieldsLoading:',
      chartDataFieldsLoading
    );
    const fetchRecommendedBillingSuggestions = async (): Promise<void> => {
      if (chartDataLoading) {
        console.log('[AI Suggestions] Skipping: chartData still loading');
        return;
      }
      if (chartDataFieldsLoading) {
        console.log('[AI Suggestions] Skipping: chartDataFields still loading');
        return;
      }
      console.log('[AI Suggestions] Starting fetch...');
      setIsLoading(true);

      const externalLabOrders = Object.entries(groupedLabOrdersForChartTable?.hasResults || [])
        .concat(Object.entries(groupedLabOrdersForChartTable?.pendingActionOrResults || []))
        .flatMap(([_requisitionNumber, orderBundle]) => orderBundle.orders.map((order) => order.testItem))
        .join(', ');

      const inHouseLabOrders = labOrders?.map((order) => order.testItemName).join(', ');

      const radiologyOrdersString = radiologyOrders?.map((order) => order.studyType).join(', ');

      const radiologyReportsString =
        radiologyOrders
          ?.filter((order) => order.finalReport || order.preliminaryReport)
          .map((order) => {
            const report = order.finalReport || order.preliminaryReport;
            const reportType = order.finalReport ? 'Final' : 'Preliminary';
            try {
              return `${order.studyType} (${reportType}): ${atob(report!)}`;
            } catch {
              return `${order.studyType} (${reportType}): ${report}`;
            }
          })
          .join('\n') || '';

      const proceduresString = chartData?.procedures?.map((procedure) => procedure.procedureType).join(', ');

      const labResultsParts: string[] = [];
      if (chartDataFields?.inHouseLabResults?.labOrderResults) {
        chartDataFields.inHouseLabResults.labOrderResults.forEach((result) => {
          const parts = [result.name];
          if (result.simpleResultValue) {
            parts.push(`Result: ${result.simpleResultValue}`);
          }
          if (result.nonNormalResultContained?.length) {
            parts.push(`(${result.nonNormalResultContained.join(', ')})`);
          }
          labResultsParts.push(parts.join(' - '));
        });
      }
      if (chartDataFields?.inHouseLabResults?.resultsPending?.length) {
        labResultsParts.push(`Pending: ${chartDataFields.inHouseLabResults.resultsPending.join(', ')}`);
      }
      if (chartDataFields?.externalLabResults?.labOrderResults) {
        chartDataFields.externalLabResults.labOrderResults.forEach((result) => {
          const parts = [result.name];
          if (result.nonNormalResultContained?.length) {
            parts.push(`(${result.nonNormalResultContained.join(', ')})`);
          }
          labResultsParts.push(parts.join(' - '));
        });
      }
      if (chartDataFields?.externalLabResults?.resultsPending?.length) {
        labResultsParts.push(`Pending: ${chartDataFields.externalLabResults.resultsPending.join(', ')}`);
      }
      const labResultsString = labResultsParts.join('; ');

      let newPatient = undefined;
      const newPatientFromChart = chartData?.observations?.find(
        (observation) =>
          observation.field === 'seen-in-last-three-years' || observation.field === 'seen-in-last-3-years'
      );
      const newPatientFromAppointmentCreation = appointment?.meta?.tag?.some(
        (tag) =>
          tag.system === PATIENT_INFO_META_DATA_SYSTEM && tag.code !== PATIENT_INFO_META_DATA_RETURNING_PATIENT_CODE
      );

      if (newPatientFromChart) {
        newPatient = newPatientFromChart?.value === 'no';
      } else if (newPatientFromAppointmentCreation) {
        newPatient = newPatientFromAppointmentCreation;
      }

      console.log('[AI Suggestions] Calling API with:', {
        newPatient,
        hpi: chartDataFields?.chiefComplaint?.text ?? '',
        mdm: chartDataFields?.medicalDecision?.text ?? '',
        labResults: labResultsString,
        radiologyReports: radiologyReportsString,
      });

      const billingSuggestionTemp = await recommendBillingSuggestions({
        newPatient,
        hpi: chartDataFields?.chiefComplaint?.text ?? '',
        mdm: chartDataFields?.medicalDecision?.text ?? '',
        diagnoses: currentDiagnoses,
        billing: currentCptCodes,
        externalLabOrders: externalLabOrders,
        internalLabOrders: inHouseLabOrders,
        radiologyOrders: radiologyOrdersString,
        radiologyReports: radiologyReportsString,
        procedures: proceduresString,
        labResults: labResultsString,
      });
      console.log('[AI Suggestions] Response received:', billingSuggestionTemp);
      setIcdCodes(billingSuggestionTemp.icdCodes);
      setCptCodes(billingSuggestionTemp.cptCodes);
      setEmCode(billingSuggestionTemp.emCode);
      setCodingSuggestions(billingSuggestionTemp.codingSuggestions);
      setIsLoading(false);
    };
    fetchRecommendedBillingSuggestions().catch((error) => {
      console.error('[AI Suggestions] Error:', error);
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // chartData?.diagnosis,
    // chartData?.cptCodes,
    // chartData?.emCode,
    recommendBillingSuggestions,
    // chartDataFields?.chiefComplaint,
    chartDataFields?.medicalDecision,
    // chartData?.procedures,
    // groupedLabOrdersForChartTable?.hasResults,
    // groupedLabOrdersForChartTable?.pendingActionOrResults,
    // labOrders,
    // radiologyOrders,
    // chartData,
    // chartDataLoading,
    // chartDataFieldsLoading,
  ]);

  return {
    icdCodesSuggest,
    cptCodesSuggest,
    emCode,
    codingSuggestions,
    isLoading,
  };
};

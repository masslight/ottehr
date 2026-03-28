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
    console.log(JSON.stringify(chartData?.diagnosis));
    const fetchRecommendedBillingSuggestions = async (): Promise<void> => {
      if (chartDataLoading) {
        return;
      }
      if (chartDataFieldsLoading) {
        return;
      }
      setIsLoading(true);

      const externalLabOrders = Object.entries(groupedLabOrdersForChartTable?.hasResults || [])
        .concat(Object.entries(groupedLabOrdersForChartTable?.pendingActionOrResults || []))
        .flatMap(([_requisitionNumber, orderBundle]) => orderBundle.orders.map((order) => order.testItem))
        .join(', ');

      const inHouseLabOrders = labOrders?.map((order) => order.testItemName).join(', ');

      const radiologyOrdersString = radiologyOrders?.map((order) => order.studyType).join(', ');

      const proceduresString = chartData?.procedures?.map((procedure) => procedure.procedureType).join(', ');

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

      console.log(chartData, newPatient);

      const billingSuggestionTemp = await recommendBillingSuggestions({
        newPatient,
        hpi: chartDataFields?.chiefComplaint?.text ?? '',
        mdm: chartDataFields?.medicalDecision?.text ?? '',
        diagnoses: currentDiagnoses,
        billing: currentCptCodes,
        externalLabOrders: externalLabOrders,
        internalLabOrders: inHouseLabOrders,
        radiologyOrders: radiologyOrdersString,
        procedures: proceduresString,
      });
      setIcdCodes(billingSuggestionTemp.icdCodes);
      setCptCodes(billingSuggestionTemp.cptCodes);
      setEmCode(billingSuggestionTemp.emCode);
      setCodingSuggestions(billingSuggestionTemp.codingSuggestions);
      setIsLoading(false);
    };
    fetchRecommendedBillingSuggestions().catch((error) => {
      console.log(error);
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

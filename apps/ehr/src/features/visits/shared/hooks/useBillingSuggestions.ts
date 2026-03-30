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
  const { appointment, encounter, patient } = useAppointmentData();
  const encounterId = encounter.id;
  const currentDiagnoses: DiagnosisDTO[] | undefined = chartData?.diagnosis;
  const currentCptCodes: CPTCodeDTO[] | undefined = [];
  if (chartData?.cptCodes) {
    currentCptCodes.push(...chartData.cptCodes);
  }
  if (chartData?.emCode) {
    currentCptCodes.push(chartData.emCode);
  }

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
    const fetchRecommendedBillingSuggestions = async (): Promise<void> => {
      if (chartDataLoading) {
        return;
      }
      if (chartDataFieldsLoading || chartDataFieldsFetching) {
        return;
      }
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
      const proceduresString = proceduresParts.join('\n');

      const labResultsParts: string[] = [];
      if (chartDataFields?.inHouseLabResults?.labOrderResults) {
        chartDataFields.inHouseLabResults.labOrderResults.forEach((result) => {
          if (result.resultValues?.length) {
            labResultsParts.push(`Test: ${result.name} | Results: ${result.resultValues.join(', ')}`);
          } else {
            const resultValue = result.simpleResultValue ?? 'completed';
            labResultsParts.push(`Test: ${result.name} | Result: ${resultValue}`);
          }
        });
      }
      if (chartDataFields?.inHouseLabResults?.resultsPending?.length) {
        chartDataFields.inHouseLabResults.resultsPending.forEach((name) => {
          labResultsParts.push(`Test: ${name} | Result: PENDING`);
        });
      }
      if (chartDataFields?.externalLabResults?.labOrderResults) {
        chartDataFields.externalLabResults.labOrderResults.forEach((result) => {
          labResultsParts.push(`Test: ${result.name} | Result: received`);
        });
      }
      if (chartDataFields?.externalLabResults?.resultsPending?.length) {
        chartDataFields.externalLabResults.resultsPending.forEach((name) => {
          labResultsParts.push(`Test: ${name} | Result: PENDING`);
        });
      }
      const labResultsString = labResultsParts.join('\n');

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

      let patientAge: string | undefined;
      if (patient?.birthDate) {
        const birth = new Date(patient.birthDate);
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        if (
          now.getMonth() < birth.getMonth() ||
          (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
        ) {
          years--;
        }
        patientAge = `${years} years`;
      }
      const patientSex = patient?.gender;

      const billingSuggestionTemp = await recommendBillingSuggestions({
        newPatient,
        patientAge,
        patientSex,
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
      setIcdCodes(billingSuggestionTemp.icdCodes);
      setCptCodes(billingSuggestionTemp.cptCodes);
      setEmCode(billingSuggestionTemp.emCode);
      setCodingSuggestions(billingSuggestionTemp.codingSuggestions);
      setIsLoading(false);
    };
    fetchRecommendedBillingSuggestions().catch((error) => {
      console.error(error);
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // chartData?.diagnosis,
    // chartData?.cptCodes,
    // chartData?.emCode,
    recommendBillingSuggestions,
    chartDataFieldsFetching,
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

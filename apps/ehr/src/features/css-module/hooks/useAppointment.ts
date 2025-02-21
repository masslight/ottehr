import { Appointment, Bundle, Encounter, FhirResource, Patient, QuestionnaireResponse, Location } from 'fhir/r4b';
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from 'react-query';
import { useParsedAppointmentStore } from '../store/parsedAppointment.store';
import { ProcessedData, SourceData } from '../parser/types';
import { getResources } from '../parser/extractors';
import { parseBundle } from '../parser/parser';
import { useAppointmentStore, useGetTelemedAppointment } from '../../../telemed';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useChartData } from './useChartData';
import { useEffect } from 'react';

type TelemedState = Partial<{
  appointment: Appointment;
  patient: Patient;
  location: Location;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse;
}>;

export const useAppointment = (
  appointmentId?: string
): {
  sourceData: SourceData;
  processedData: ProcessedData;
  telemedData: TelemedState;
  error: any;
  isLoading: boolean;
  refetch: <TPageData>(
    options?: (RefetchOptions & RefetchQueryFilters<TPageData>) | undefined
  ) => Promise<QueryObserverResult<FhirResource[], unknown>>;
} => {
  const { sourceData, processedData } = useParsedAppointmentStore();

  const telemedData = getSelectors(useAppointmentStore, [
    'appointment',
    'patient',
    'location',
    'encounter',
    'questionnaireResponse',
  ]) as TelemedState;

  const { isLoading: isChartDataLoading, chartData } = useChartData({
    encounterId: telemedData.encounter?.id || '',
    shouldUpdateExams: true,
  });
  const encounterId = telemedData.encounter?.id;

  useEffect(() => {
    if (!encounterId) return;

    useAppointmentStore.setState({
      chartData,
      isChartDataLoading: isChartDataLoading,
    });
  }, [chartData, encounterId, isChartDataLoading]);

  const { isLoading, error, refetch } = useGetTelemedAppointment({ appointmentId }, (data) => {
    const bundleResources = getResources(data);
    const parsedResources = parseBundle(data);

    // init telemed store for compatibility
    useAppointmentStore.setState({
      appointment: bundleResources.appointment,
      patient: bundleResources.patient,
      location: bundleResources.location,
      encounter: bundleResources.encounter,
      questionnaireResponse: bundleResources.questionnaireResponse,
      coverage: bundleResources.coverage,

      // the patientPhotoUrls and schoolWorkNoteUrls structures are equal with Telemed
      patientPhotoUrls: parsedResources.processedData?.patientConditionalPhotosUrls || [],
      schoolWorkNoteUrls: parsedResources.processedData?.schoolWorkNoteUrls || [],
      coverageName: parsedResources.processedData?.coverageName,

      isAppointmentLoading: false,
    });
  });

  // update parsed appointment store on telemed data change
  useEffect(() => {
    const telemedResources = Object.values([
      telemedData.appointment,
      telemedData.patient,
      telemedData.location,
      telemedData.encounter,
      telemedData.questionnaireResponse,
    ] as FhirResource[]).filter(Boolean);
    const parsedResources = parseBundle(telemedResources as Bundle[]);
    useParsedAppointmentStore.setState(parsedResources);
  }, [
    telemedData.appointment,
    telemedData.patient,
    telemedData.location,
    telemedData.encounter,
    telemedData.questionnaireResponse,
  ]);

  return { sourceData, processedData, telemedData, error, isLoading, refetch };
};

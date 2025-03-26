import { Appointment, Bundle, Encounter, FhirResource, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { useEffect } from 'react';
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from 'react-query';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore, useGetAppointment } from '../../../telemed';
import { getResources } from '../parser/extractors';
import { parseBundle } from '../parser/parser';
import { VisitMappedData, VisitResources } from '../parser/types';
import { useMappedVisitDataStore } from '../store/parsedAppointment.store';

type VisitState = Partial<{
  appointment: Appointment;
  patient: Patient;
  location: Location;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse;
}>;

export const useAppointment = (
  appointmentId?: string
): {
  resources: VisitResources;
  mappedData: VisitMappedData;
  visitState: VisitState;
  error: any;
  isLoading: boolean;
  refetch: <TPageData>(
    options?: (RefetchOptions & RefetchQueryFilters<TPageData>) | undefined
  ) => Promise<QueryObserverResult<FhirResource[], unknown>>;
} => {
  const { resources, mappedData } = useMappedVisitDataStore();

  const visitData = getSelectors(useAppointmentStore, [
    'appointment',
    'patient',
    'location',
    'encounter',
    'questionnaireResponse',
  ]) as VisitState;

  const { isLoading, error, refetch } = useGetAppointment({ appointmentId }, (data) => {
    const bundleResources = getResources(data);
    const parsedResources = parseBundle(data);

    // init telemed store for compatibility
    useAppointmentStore.setState({
      appointment: bundleResources.appointment,
      patient: bundleResources.patient,
      location: bundleResources.location,
      encounter: bundleResources.encounter,
      questionnaireResponse: bundleResources.questionnaireResponse,

      // the patientPhotoUrls and schoolWorkNoteUrls structures are equal with Telemed
      patientPhotoUrls: parsedResources.mappedData?.patientConditionalPhotosUrls || [],
      schoolWorkNoteUrls: parsedResources.mappedData?.schoolWorkNoteUrls || [],

      isAppointmentLoading: false,
    });
  });

  // update parsed appointment store on telemed data change
  useEffect(() => {
    const visitResources = Object.values([
      visitData.appointment,
      visitData.patient,
      visitData.location,
      visitData.encounter,
      visitData.questionnaireResponse,
    ] as FhirResource[]).filter(Boolean);
    const parsedResources = parseBundle(visitResources as Bundle[]);
    useMappedVisitDataStore.setState(parsedResources);
  }, [
    visitData.appointment,
    visitData.patient,
    visitData.location,
    visitData.encounter,
    visitData.questionnaireResponse,
  ]);

  return { resources, mappedData, visitState: visitData, error, isLoading, refetch };
};

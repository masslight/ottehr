import { Encounter } from 'fhir/r4b';
import { useEffect, useRef } from 'react';
import { useAppointmentStore, useExamObservationsStore, useVideoCallStore } from '../state';

export const useResetAppointmentStore = (): void => {
  const didResetRef = useRef(false);

  if (!didResetRef.current) {
    useAppointmentStore.setState({
      appointment: undefined,
      patient: undefined,
      location: undefined,
      locationVirtual: undefined,
      encounter: {} as Encounter,
      questionnaireResponse: undefined,
      patientPhotoUrls: [],
      schoolWorkNoteUrls: [],
      chartData: undefined,
      currentTab: 'hpi',
    });
    useExamObservationsStore.setState({});
    useVideoCallStore.setState({ meetingData: null });

    didResetRef.current = true;
  }

  useEffect(() => {
    return () => useAppointmentStore.setState({ patientPhotoUrls: [] });
  }, []);
};

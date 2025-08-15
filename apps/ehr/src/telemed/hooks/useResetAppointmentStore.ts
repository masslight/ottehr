import { Encounter } from 'fhir/r4b';
import { useEffect } from 'react';
import { useAppointmentStore, useExamObservationsStore, useVideoCallStore } from '../state';

export const useResetAppointmentStore = (): void => {
  useEffect(() => {
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

    return () => useAppointmentStore.setState({ patientPhotoUrls: [] });
  }, []);
};

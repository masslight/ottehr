import { Encounter } from 'fhir/r4b';
import { useEffect, useRef } from 'react';
import {
  EXAM_OBSERVATIONS_INITIAL,
  IN_PERSON_EXAM_OBSERVATIONS_INITIAL,
  useAppointmentStore,
  useExamObservationsStore,
  useInPersonExamObservationsStore,
  useVideoCallStore,
} from '../state';
import {
  EXAM_CARDS_INITIAL,
  IN_PERSON_EXAM_CARDS_INITIAL,
  useExamCardsStore,
  useInPersonExamCardsStore,
} from '../state/appointment/exam-cards.store';

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
    useExamObservationsStore.setState(EXAM_OBSERVATIONS_INITIAL);
    useInPersonExamObservationsStore.setState(IN_PERSON_EXAM_OBSERVATIONS_INITIAL);
    useVideoCallStore.setState({ meetingData: null });
    useExamCardsStore.setState(EXAM_CARDS_INITIAL);
    useInPersonExamCardsStore.setState(IN_PERSON_EXAM_CARDS_INITIAL);

    didResetRef.current = true;
  }

  useEffect(() => {
    return () => useAppointmentStore.setState({ patientPhotoUrls: [] });
  }, []);
};

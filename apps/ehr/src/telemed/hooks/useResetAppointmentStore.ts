import { useRef } from 'react';
import {
  APP_TELEMED_LOCAL_INITIAL,
  useAppTelemedLocalStore,
  useExamObservationsStore,
  useVideoCallStore,
} from '../state';

export const useResetAppointmentStore = (): void => {
  const didResetRef = useRef(false);

  if (!didResetRef.current) {
    useExamObservationsStore.setState({}, true);
    useVideoCallStore.setState({ meetingData: null });
    useAppTelemedLocalStore.setState(APP_TELEMED_LOCAL_INITIAL);

    didResetRef.current = true;
  }
};

import { useRef } from 'react';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { APP_TELEMED_LOCAL_INITIAL, useAppTelemedLocalStore } from '../stores/appointment/appointment.store';
import { useExamObservationsStore } from '../stores/appointment/exam-observations.store';

export const useResetAppointmentStore = (): void => {
  const didResetRef = useRef(false);

  if (!didResetRef.current) {
    useExamObservationsStore.setState({}, true);
    useVideoCallStore.setState({ meetingData: null });
    useAppTelemedLocalStore.setState(APP_TELEMED_LOCAL_INITIAL);

    didResetRef.current = true;
  }
};

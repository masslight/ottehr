import { useEffect } from 'react';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import {
  APP_TELEMED_LOCAL_INITIAL,
  useAppointmentData,
  useAppTelemedLocalStore,
} from '../stores/appointment/appointment.store';
import { resetExamObservationsStore } from '../stores/appointment/reset-exam-observations';
import { resetRosObservationsStore } from '../stores/appointment/reset-ros-observations';

// Module-scoped so the reset survives transient remounts of the layout (e.g. a loading
// flash during appointmentRefetch). Instance-scoped tracking re-fired and wiped
// meetingData mid-connect, causing the videoRoomContainer flake.
let lastResetForAppointmentId: string | undefined;

export const useResetAppointmentStore = (): void => {
  const { appointment } = useAppointmentData();
  const appointmentId = appointment?.id;

  useEffect(() => {
    if (appointmentId && lastResetForAppointmentId !== appointmentId) {
      resetExamObservationsStore();
      resetRosObservationsStore();
      useVideoCallStore.setState({ meetingData: null });
      useAppTelemedLocalStore.setState(APP_TELEMED_LOCAL_INITIAL);
      lastResetForAppointmentId = appointmentId;
    }
  }, [appointmentId]);
};

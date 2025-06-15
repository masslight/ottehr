import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../App';
import { useAppointmentStore } from '../features/appointments';
import { useIOSAppSync } from '../features/ios-communication/useIOSAppSync';

export function IOSMessagesHandler(): JSX.Element {
  const appointmentId = useAppointmentStore((state) => state.appointmentID);
  const navigate = useNavigate();
  const { isIOSApp } = useIOSAppSync();

  useEffect(() => {
    const listener = (event: Event): void => {
      const customEvent = event as CustomEvent;
      switch (customEvent.detail) {
        case 'IOS_OPEN_CALL_MENU': {
          navigate(`${intakeFlowPageRoute.IOSVideoCallMenu.path}?appointment_id=${appointmentId}`);
          break;
        }
        case 'IOS_OPEN_CALL_ENDED': {
          navigate(`${intakeFlowPageRoute.IOSCallEnded.path}`);
          break;
        }
        default:
          break;
      }
    };
    if (isIOSApp) {
      document.addEventListener('IOS_EVENT', listener);
    }
    return () => {
      window.removeEventListener('IOS_EVENT', listener);
    };
  }, [isIOSApp, appointmentId, navigate]);

  return <></>;
}

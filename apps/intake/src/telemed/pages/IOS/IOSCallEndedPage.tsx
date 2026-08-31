import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingSpinner } from 'src/telemed/components/LoadingSpinner';
import { useAppointmentStore } from 'src/telemed/features/appointments/appointment.store';
import { useIntakeCommonStore } from 'src/telemed/features/common/intake-common.store';
import { useGetWaitStatus } from 'src/telemed/features/waiting-room/waiting-room.queries';
import { intakeFlowPageRoute } from '../../../App';
import CallEndedPage from '../CallEndedPage';

export function IOSCallEndedPage(): JSX.Element {
  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const urlAppointmentID = searchParams.get('appointment_id');
  const appointmentID = useAppointmentStore((state) => state.appointmentID) || '';

  useEffect(() => {
    if (urlAppointmentID) {
      useAppointmentStore.setState(() => ({ appointmentID: urlAppointmentID }));
    }
  }, [urlAppointmentID]);

  const { isFetching } = useGetWaitStatus(
    (data) => {
      if (!data) {
        return;
      }
      if (data?.status == 'completed') {
        useIntakeCommonStore.setState({ error: 'The call has ended. Please, request another visit' });
        navigate(intakeFlowPageRoute.Homepage.path);
      }
      if (data?.status == 'cancelled') {
        useIntakeCommonStore.setState({ error: 'The appointment you tried to access was canceled' });
        navigate(intakeFlowPageRoute.Homepage.path);
      }
    },
    appointmentID,
    10000
  );

  return isFetching ? <LoadingSpinner /> : <CallEndedPage />;
}

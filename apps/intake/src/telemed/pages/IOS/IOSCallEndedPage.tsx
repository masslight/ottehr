import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { intakeFlowPageRoute } from '../../../App';
import { LoadingSpinner } from '../../components';
import { useAppointmentStore } from '../../features/appointments';
import { useIntakeCommonStore } from '../../features/common';
import { useGetWaitStatus } from '../../features/waiting-room';
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
      if (data?.status == 'complete') {
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

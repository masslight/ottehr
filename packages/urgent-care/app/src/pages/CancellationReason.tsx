import mixpanel from 'mixpanel-browser';
import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useZambdaClient, PageForm } from 'ui-components';
import { IntakeFlowPageRoute } from '../App';
import zapehrApi from '../api/zapehrApi';
import { CustomContainer } from '../components';
import { appointmentNotFoundInformation } from '../helpers/information';
import { safelyCaptureException } from '../helpers/sentry';
import { IntakeDataContext } from '../store';
import { updateSelectedLocation, updateVisitType } from '../store/IntakeActions';
import { CancellationReasonOptions } from '../store/types';

const CancellationReason = (): JSX.Element => {
  const navigate = useNavigate();
  const zambdaClient = useZambdaClient({ tokenless: true });
  const { state, dispatch } = useContext(IntakeDataContext);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const { id: appointmentID } = useParams();

  useEffect(() => {
    mixpanel.track('Cancellation Reason');
  }, []);

  const onSubmit = async (data: { cancellationReason: string }): Promise<void> => {
    if (!zambdaClient) {
      throw new Error('zambdaClient is not defined');
    }
    setLoading(true);
    try {
      const cancelledAppointment = await zapehrApi.cancelAppointment(
        zambdaClient,
        {
          appointmentID: appointmentID || '',
          cancellationReason: data.cancellationReason,
        },
        dispatch,
      );

      updateSelectedLocation(cancelledAppointment.location, dispatch);
      updateVisitType(cancelledAppointment.visitType, dispatch);
      state.appointmentID = undefined;
      state.appointmentSlot = undefined;
      state.patientInfo = undefined;
      state.completedPaperwork = undefined;

      setLoading(false);
      navigate(IntakeFlowPageRoute.CancellationConfirmation.path);
    } catch (error: any) {
      safelyCaptureException(error);
      if (error.message === 'Appointment is not found') {
        setNotFound(true);
      } else {
        console.log('error', error);
      }
      setLoading(false);
    }
  };

  if (notFound) {
    return (
      <CustomContainer
        title={'There was an error canceling this appointment'}
        description={appointmentNotFoundInformation}
        bgVariant={IntakeFlowPageRoute.CheckIn.path}
      >
        <></>
      </CustomContainer>
    );
  }

  return (
    <CustomContainer title="Why are you canceling?" bgVariant={IntakeFlowPageRoute.CancellationReason.path}>
      <PageForm
        formElements={[
          {
            type: 'Select',
            name: 'cancellationReason',
            label: 'Cancelation reason',
            required: true,
            selectOptions: Object.keys(CancellationReasonOptions).map((value) => ({
              label: value,
              value: value,
            })),
          },
        ]}
        controlButtons={{ loading, submitLabel: 'Cancel visit' }}
        onSubmit={onSubmit}
      />
      {/* <ErrorDialog
        open={notFound}
        title="Appointment is not found"
        description={appointmentNotFoundInformation}
        closeButtonText="Close"
        handleClose={() => setNotFound(false)}
      /> */}
    </CustomContainer>
  );
};

export default CancellationReason;

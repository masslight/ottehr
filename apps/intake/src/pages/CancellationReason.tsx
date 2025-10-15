import mixpanel from 'mixpanel-browser';
import { useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  APIError,
  APPOINTMENT_NOT_FOUND_ERROR,
  BOOKING_CONFIG,
  CANT_CANCEL_CHECKED_IN_APT_ERROR,
  PROJECT_NAME,
} from 'utils';
import ottehrApi from '../api/ottehrApi';
import { PageContainer } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import PageForm from '../components/PageForm';
import useAppointmentNotFoundInformation from '../helpers/information';
import { useNavigateInFlow } from '../hooks/useNavigateInFlow';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import { useVisitContext } from './ThankYou';

const CancellationReason = (): JSX.Element => {
  const navigate = useNavigate();
  const zambdaClient = useUCZambdaClient({ tokenless: true });
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [cancelErrorDialog, setCancelErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const { id: appointmentID } = useParams();
  const navigateInFlow = useNavigateInFlow();

  const { appointmentData } = useVisitContext();
  const { t } = useTranslation();

  const visitType = useMemo(() => {
    return appointmentData?.appointment?.visitType;
  }, [appointmentData?.appointment?.visitType]);

  const selectedLocation = useMemo(() => {
    return appointmentData?.appointment?.location;
  }, [appointmentData?.appointment?.location]);

  // Track event in Mixpanel
  const eventName = 'Cancellation Reason';
  useTrackMixpanelEvents({
    eventName: eventName,
    visitType: visitType,
    loading: !visitType,
    bookingCity: selectedLocation?.address?.city,
    bookingState: selectedLocation?.address?.state,
  });

  const onSubmit = async (data: FieldValues): Promise<void> => {
    try {
      if (!zambdaClient) {
        throw new Error('zambdaClient is not defined');
      }
      if (!appointmentID) {
        throw new Error('no appointment ID provided');
      }
      setLoading(true);

      await ottehrApi.cancelAppointment(zambdaClient, {
        appointmentID: appointmentID,
        language: 'en', // replace with i18n.language to enable
        cancellationReason: data.cancellationReason,
      });

      setLoading(false);
      navigateInFlow('cancellation-confirmation');
    } catch (error: any) {
      if ((error as APIError)?.code === CANT_CANCEL_CHECKED_IN_APT_ERROR.code) {
        setCancelErrorDialog({
          title: t('cancel.errors.checkedIn.title'),
          description: t('cancel.errors.checkedIn.description'),
          closeButtonText: t('cancel.errors.checkedIn.button'),
        });
      } else if ((error as APIError)?.code === APPOINTMENT_NOT_FOUND_ERROR.code) {
        setNotFound(true);
      } else {
        console.log('error', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const appointmentNotFoundInformation = useAppointmentNotFoundInformation();

  if (notFound) {
    return (
      <PageContainer title={t('cancel.errors.errorCanceling')} description={appointmentNotFoundInformation}>
        <></>
      </PageContainer>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const cancelReasonOptions = useMemo(() => {
    return BOOKING_CONFIG.cancelReasonOptions.map((reason, index) => ({
      label: t(`cancel.reasons.reason${index + 1}`, { PROJECT_NAME }),
      value: reason,
    }));
  }, [t]);

  return (
    <PageContainer title={t('cancel.title')}>
      <PageForm
        formElements={[
          {
            type: 'Select',
            name: 'cancellationReason',
            label: t('cancel.subtitle'),
            required: true,
            selectOptions: cancelReasonOptions,
          },
        ]}
        controlButtons={{
          loading,
          submitLabel: t('cancel.cancelButton'),
          onBack: () => {
            mixpanel.track(eventName, { patientFlow: visitType });
            navigate(-1);
          },
        }}
        onSubmit={onSubmit}
      />
      <ErrorDialog
        open={!!cancelErrorDialog}
        title={cancelErrorDialog?.title || ''}
        description={cancelErrorDialog?.description || ''}
        closeButtonText={cancelErrorDialog?.closeButtonText ?? ''}
        handleClose={() => {
          setCancelErrorDialog(undefined);
        }}
      />
    </PageContainer>
  );
};

export default CancellationReason;

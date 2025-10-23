import mixpanel from 'mixpanel-browser';
import { useMemo, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useCancelTelemedAppointmentMutation } from 'src/telemed/features/appointments';
import { useOystehrAPIClient } from 'src/telemed/utils';
import {
  APIError,
  APPOINTMENT_NOT_FOUND_ERROR,
  BOOKING_CONFIG,
  CancellationReasonOptionsTelemed,
  CANT_CANCEL_CHECKED_IN_APT_ERROR,
  PROJECT_NAME,
  ServiceMode,
} from 'utils';
import { safelyCaptureException } from 'utils/lib/frontend/sentry';
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
  const apiClient = useOystehrAPIClient();
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [cancelErrorDialog, setCancelErrorDialog] = useState<ErrorDialogConfig | undefined>(undefined);
  const { id: appointmentID } = useParams();
  const navigateInFlow = useNavigateInFlow();

  const { appointmentData } = useVisitContext();
  const { t } = useTranslation();

  const cancelTelemedAppointment = useCancelTelemedAppointmentMutation();

  const visitType = useMemo(() => {
    return appointmentData?.appointment?.visitType;
  }, [appointmentData?.appointment?.visitType]);

  const selectedLocation = useMemo(() => {
    return appointmentData?.appointment?.location;
  }, [appointmentData?.appointment?.location]);

  const isVirtualAppt = useMemo(() => {
    return appointmentData?.appointment?.serviceMode === ServiceMode.virtual;
  }, [appointmentData?.appointment?.serviceMode]);

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

      if (isVirtualAppt) {
        if (!apiClient) {
          throw new Error('apiClient is not defined');
        }
        await cancelTelemedAppointment.mutate(
          {
            apiClient,
            appointmentID: appointmentID,
            cancellationReason: data.cancellationReason,
          },
          {
            onSuccess: async () => {
              setLoading(false);
              navigateInFlow('cancellation-confirmation');
            },
            onError: (error) => {
              setLoading(false);
              if ((error as APIError)?.code === CANT_CANCEL_CHECKED_IN_APT_ERROR.code) {
                setCancelErrorDialog({
                  title: t('cancel.errors.checkedIn.title'),
                  description: t('cancel.errors.checkedIn.description'),
                  closeButtonText: t('cancel.errors.checkedIn.button'),
                });
              } else if ((error as APIError)?.code === APPOINTMENT_NOT_FOUND_ERROR.code) {
                setNotFound(true);
              } else {
                console.error('error', error);
                alert(t('cancel.errors.errorCanceling'));
                safelyCaptureException(error);
              }
            },
          }
        );
        return;
      } else {
        await ottehrApi.cancelAppointment(zambdaClient, {
          appointmentID: appointmentID,
          language: 'en', // replace with i18n.language to enable
          cancellationReason: data.cancellationReason,
        });

        setLoading(false);
        navigateInFlow('cancellation-confirmation');
      }
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
        safelyCaptureException(error);
        alert(t('cancel.errors.errorCanceling'));
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
    return isVirtualAppt
      ? Object.keys(CancellationReasonOptionsTelemed).map((key, index) => ({
          label:
            t(`cancel.telemedReasons.reason${index + 1}`, { PROJECT_NAME }) ||
            CancellationReasonOptionsTelemed[key as keyof typeof CancellationReasonOptionsTelemed],
          value: CancellationReasonOptionsTelemed[key as keyof typeof CancellationReasonOptionsTelemed],
        }))
      : Object.keys(BOOKING_CONFIG.cancelReasonOptions).map((key, index) => ({
          label:
            t(`cancel.reasons.reason${index + 1}`, { PROJECT_NAME }) ||
            BOOKING_CONFIG.CancelReasonOptions[key as keyof typeof BOOKING_CONFIG.CancelReasonOptions],
          value: BOOKING_CONFIG.CancelReasonOptions[key as keyof typeof BOOKING_CONFIG.CancelReasonOptions],
        }));
  }, [t, isVirtualAppt]);

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
          loading: loading || cancelTelemedAppointment.isPending,
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

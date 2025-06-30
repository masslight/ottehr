import { useAuth0 } from '@auth0/auth0-react';
import { Typography } from '@mui/material';
import { Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  APIError,
  AvailableLocationInformation,
  CANT_UPDATE_CANCELED_APT_ERROR,
  GetAppointmentResponseAppointmentDetails,
  PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  PROJECT_NAME,
  PROJECT_WEBSITE,
  SlotListItem,
  VisitType,
} from 'utils';
import ottehrApi from '../api/ottehrApi';
import { PageContainer, Schedule } from '../components';
import { ErrorDialog, ErrorDialogConfig } from '../components/ErrorDialog';
import { useCheckOfficeOpen } from '../hooks/useCheckOfficeOpen';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import { useUCZambdaClient } from '../hooks/useUCZambdaClient';
import i18n from '../lib/i18n';
import { ottehrLightBlue } from '../themes/ottehr/icons';
import { useVisitContext } from './ThankYou';

const Reschedule = (): JSX.Element => {
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const { id: appointmentIDParam } = useParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [slotData, setSlotData] = useState<SlotListItem[] | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<Slot | undefined>(undefined);
  const [appointment, setAppointment] = useState<GetAppointmentResponseAppointmentDetails | undefined>();
  const [pageNotFound, setPageNotFound] = useState(false);
  const { isLoading } = useAuth0();
  const navigate = useNavigate();
  const { updateAppointmentStart } = useVisitContext();
  const [errorConfig, setErrorConfig] = useState<ErrorDialogConfig | undefined>(undefined);
  const [submitPending, setSubmitPending] = useState(false);

  const { location, visitType } = useMemo(() => {
    if (appointment) {
      return appointment;
    } else {
      return { location: undefined, visitType: undefined };
    }
  }, [appointment]);
  // Track Welcome page in Mixpanel
  useTrackMixpanelEvents({
    eventName: 'Modify Booking Time',
    visitType: visitType as VisitType,
    loading: loading || isLoading,
    bookingCity: location?.address?.city,
    bookingState: location?.address?.state,
  });

  useEffect(() => {
    const getAppointmentDetails = async (appointmentID: string): Promise<any> => {
      try {
        if (!tokenlessZambdaClient) {
          return;
        }
        setLoading(true);
        const response = await ottehrApi.getAppointmentDetails(tokenlessZambdaClient, appointmentID);
        const appointment = response.appointment;
        const location: AvailableLocationInformation = appointment.location;
        if (!location) {
          // this is basically an internal error that should be thrown by backend.
          // very odd that we'd need to inspect the returned object and throw at this point
          throw new Error('appointment details response missing location');
        }
        setAppointment(appointment);
        console.log('appointment slot', appointment.slot);
        setSelectedSlot(appointment.slot);
        const available = response.availableSlots;
        console.log('first available', available[0].slot);
        // todo: get this data another way
        setSlotData(available);
      } catch (e) {
        setPageNotFound(true);
        console.error('Error validating location: ', e);
      } finally {
        setLoading(false);
      }
    };

    if (appointmentIDParam) {
      void getAppointmentDetails(appointmentIDParam);
    }
  }, [appointmentIDParam, tokenlessZambdaClient]);

  // todo: this can be simplified greatly by handling on the backend
  const allAvailableSlots = useMemo(() => {
    const slots = (slotData ?? []).map((si) => si.slot);
    const currentDateTime = DateTime.now().setZone(location?.timezone);
    if (slotData && selectedSlot) {
      const currentSlotTime = DateTime.fromISO(selectedSlot.start)
        .setZone(location?.timezone)
        .setLocale(i18n.language);
      const currentSlotTimePassed = currentSlotTime > currentDateTime;
      if (currentSlotTimePassed) {
        return slots;
      }
      const alreadyIncluded = slots.some((s) => s.start === selectedSlot.start);
      if (alreadyIncluded) {
        return slots;
      }
      return [...slots, selectedSlot]?.sort((a: Slot, b: Slot) => a.start.localeCompare(b.start));
    }
    return slotData?.map((si) => si.slot);
  }, [selectedSlot, location?.timezone, slotData]);

  const { officeHasClosureOverrideToday, officeHasClosureOverrideTomorrow } = useCheckOfficeOpen(location);
  const { t } = useTranslation();

  const rescheduleAppointment = useCallback(
    async (slot: Slot) => {
      if (!tokenlessZambdaClient) {
        throw new Error('zambdaClient is not defined');
      }

      if (!appointmentIDParam) {
        throw new Error('appointment id is missing');
      }

      setSubmitPending(true);

      try {
        const res = await ottehrApi.updateAppointment(tokenlessZambdaClient, {
          appointmentID: appointmentIDParam,
          slot: slot,
          language: 'en', // replace with i18n.language to enable
        });
        if (res.appointmentID) {
          updateAppointmentStart(slot.start);
          navigate(`/visit/${res.appointmentID}`);
        } else if (res.availableSlots) {
          setErrorConfig({
            title: t('modify.errors.noLongerAvail.title'),
            description: t('modify.errors.noLongerAvail.description'),
          });
          setSlotData(res.availableSlots);
        }
      } catch (e) {
        if ((e as APIError)?.code === CANT_UPDATE_CANCELED_APT_ERROR.code) {
          setErrorConfig({
            title: t('modify.errors.alreadyCanceled.title'),
            description: t('modify.errors.alreadyCanceled.description'),
            closeButtonText: t('modify.errors.alreadyCanceled.button'),
          });
        } else if ((e as APIError)?.code === PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR.code) {
          setErrorConfig({
            title: t('modify.errors.cannotModify.title'),
            description: t('modify.errors.cannotModify.description'),
            closeButtonText: t('modify.errors.cannotModify.button'),
          });
        } else {
          setErrorConfig({
            title: t('modify.errors.unexpected.title'),
            description: (
              <>
                {t('modify.errors.unexpected.description')}{' '}
                <Link to={`${PROJECT_WEBSITE}/contact-us/`} target="_blank">
                  {t('modify.errors.unexpected.link')}
                </Link>
                .
              </>
            ),
          });
        }
      } finally {
        setSubmitPending(false);
      }
    },
    [appointmentIDParam, navigate, tokenlessZambdaClient, updateAppointmentStart, t]
  );

  // validation for valid state from location resource
  if (pageNotFound) {
    return (
      <PageContainer title={t('modify.errors.notFound.title')}>
        <Typography variant="body1">
          {t('modify.errors.notFound.description', { PROJECT_NAME })}{' '}
          <a href={`${PROJECT_WEBSITE}/find-care/`}>{t('modify.errors.notFound.link')}</a>.
        </Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={t('modify.title')}
      subtitle={loading ? 'Loading...' : `${location?.name}`}
      subtext={loading ? '' : t('modify.selectNew')}
      isFirstPage
      img={ottehrLightBlue}
      imgAlt="ottehr icon"
      imgWidth={150}
    >
      <>
        <Schedule
          slotData={allAvailableSlots}
          slotsLoading={loading}
          backButton={true}
          submitLabelAdjective={i18n.t('appointments.modifyTo')}
          timezone={location?.timezone || 'America/New_York'}
          existingSelectedSlot={selectedSlot}
          handleSlotSelected={async (slot) => {
            void rescheduleAppointment(slot);
            // todo: there should be a separate get-ready page for a reschedule, or else some way to distinguish
            // between the two flows
            // why was this happening?? the Schedule component would have been performing alternate navigation before
            // this was invoked
            // navigate(`/book/${location?.address?.state}/${location?.slug}/${visitTypeParam}/get-ready`);
          }}
          forceClosedToday={officeHasClosureOverrideToday}
          forceClosedTomorrow={officeHasClosureOverrideTomorrow}
          submitPending={submitPending}
        />
      </>
      <ErrorDialog
        open={!!errorConfig}
        title={errorConfig?.title || ''}
        description={errorConfig?.description || ''}
        closeButtonText={errorConfig?.closeButtonText ?? t('modify.closeButton')}
        handleClose={() => {
          setErrorConfig(undefined);
        }}
      />
    </PageContainer>
  );
};

export default Reschedule;

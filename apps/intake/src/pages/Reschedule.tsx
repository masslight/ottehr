/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuth0 } from '@auth0/auth0-react';
import { Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorDialog, ErrorDialogConfig, useUCZambdaClient } from 'ui-components';
import {
  APIError,
  CANT_UPDATE_CANCELED_APT_ERROR,
  PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR,
  SlotListItem,
  VisitType,
} from 'utils';
import zapehrApi, { AppointmentBasicInfo, AvailableLocationInformation } from '../api/zapehrApi';
import { ottehrLightBlue } from '../assets/icons';
import { PageContainer, Schedule } from '../components';
import { useCheckOfficeOpen } from '../hooks/useCheckOfficeOpen';
import { useTrackMixpanelEvents } from '../hooks/useTrackMixpanelEvents';
import i18n from '../lib/i18n';
import { useVisitContext } from './ThankYou';
import { Slot } from 'fhir/r4b';

const Reschedule = (): JSX.Element => {
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const { id: appointmentIDParam } = useParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [slotData, setSlotData] = useState<SlotListItem[] | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<string | undefined>(undefined);
  const [appointment, setAppointment] = useState<AppointmentBasicInfo | undefined>();
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
        const response = await zapehrApi.getAppointmentDetails(tokenlessZambdaClient, appointmentID);
        const appointment = response.appointment;
        const location: AvailableLocationInformation = appointment.location;
        if (!location) {
          // this is basically an internal error that should be thrown by backend.
          // very odd that we'd need to inspect the returned object and throw at this point
          throw new Error('appointment details response missing location');
        }
        setAppointment(appointment);
        const formattedStart =
          DateTime.fromISO(appointment.start)
            .setZone(location?.timezone)
            .setLocale(i18n.language)
            .toISO() || '';
        setSelectedSlot(formattedStart);
        const available = response.availableSlots;
        const sortedDatesArray = available.sort((a: string, b: string) => a.localeCompare(b));
        // todo: get this data another way
        setSlotData([]);
        setLoading(false);
      } catch (e) {
        setPageNotFound(true);
        console.error('Error validating location: ', e);
      }
    };

    if (appointmentIDParam) {
      void getAppointmentDetails(appointmentIDParam);
    }
  }, [appointmentIDParam, tokenlessZambdaClient]);

  const allAvailableSlots = useMemo(() => {
    /*const currentSlotTime = DateTime.fromISO(selectedSlot ?? '');
    const currentDateTime = DateTime.now().setZone(location?.timezone);
    const hasNotPassed = currentSlotTime > currentDateTime;
    if (slotData && selectedSlot) {
      const availableSlots =
        hasNotPassed && !slotData.includes(selectedSlot ?? '')
          ? [...(slotData as string[]), selectedSlot ?? '']
          : slotData;
      return availableSlots?.sort((a: string, b: string) => a.localeCompare(b));
    }
    return slotData;*/
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const res = await zapehrApi.updateAppointment(tokenlessZambdaClient, {
          appointmentID: appointmentIDParam,
          slot: slot.start,
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
                <Link to="https://ottehr.com/contact-us/" target="_blank">
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
          {t('modify.errors.notFound.description')}{' '}
          <a href="https://ottehr.com/find-care/">{t('modify.errors.notFound.link')}</a>.
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
          setSlotData={setSlotData}
          slotsLoading={loading}
          backButton={true}
          submitLabelAdjective={i18n.t('appointments.modifyTo')}
          timezone={location?.timezone || 'America/New_York'}
          existingSelectedSlot={undefined}
          handleSlotSelected={async (slot) => {
            void rescheduleAppointment(slot);
            // todo: there should be a separate get-ready page for a reschedule, or else some way to distinguish
            // between the two flows
            // why was this happening?? the Schedule component would have been performing alternate navigation before
            // this was invoked
            // navigate(`/book/${location?.address?.state}/${location?.slug}/${visitTypeParam}/get-ready`);
          }}
          scheduleType={location?.scheduleType}
          locationSlug={location?.slug}
          forceClosedToday={officeHasClosureOverrideToday}
          forceClosedTomorrow={officeHasClosureOverrideTomorrow}
          submitPending={submitPending}
          markSlotBusy={false}
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

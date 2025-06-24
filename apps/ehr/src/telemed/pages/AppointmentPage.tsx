import { Box } from '@mui/material';
import { GlobalStyles, lightTheme, MeetingProvider } from 'amazon-chime-sdk-component-library-react';
import {
  Appointment,
  DocumentReference,
  Encounter,
  FhirResource,
  Location,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { FC, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import {
  getQuestionnaireResponseByLinkId,
  isLocationVirtual,
  mapStatusToTelemed,
  RefreshableAppointmentData,
  SCHOOL_WORK_NOTE_CODE,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { getSelectors } from '../../shared/store/getSelectors';
import HearingRelayPopup from '../components/HearingRelayPopup';
import PreferredLanguagePopup from '../components/PreferredLanguagePopup';
import {
  AppointmentFooter,
  AppointmentHeader,
  AppointmentSidePanel,
  AppointmentTabs,
  VideoChatContainer,
} from '../features/appointment';
import { useResetAppointmentStore } from '../hooks';
import { useAppointmentStore, useGetAppointment, useRefreshableAppointmentData, useVideoCallStore } from '../state';
import { arraysEqual, extractPhotoUrlsFromAppointmentData, extractReviewAndSignAppointmentData } from '../utils';

export const AppointmentPage: FC = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  const {
    appointment,
    encounter,
    patientPhotoUrls: currentPatientPhotosUrls,
  } = getSelectors(useAppointmentStore, ['appointment', 'encounter', 'patientPhotoUrls']);

  const [wasHearingRelayPopupOpen, setWasHearingRelayPopupOpen] = useState(false);
  const [shouldHearingRelayPopupBeOpened, setShouldHearingRelayPopupBeOpened] = useState(false);
  const [wasPreferredLanguagePopupOpen, setWasPreferredLanguagePopupOpen] = useState(false);
  const [shouldPreferredLanguagePopupBeOpened, setShouldPreferredLanguagePopupBeOpened] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<string | undefined>(undefined);
  const isPreferredLanguagePopupOpen = shouldPreferredLanguagePopupBeOpened && !wasPreferredLanguagePopupOpen;
  const isHearingRelayPopupOpen =
    shouldHearingRelayPopupBeOpened && !wasHearingRelayPopupOpen && !isPreferredLanguagePopupOpen;

  const closeHearingRelayPopup = (): void => {
    setWasHearingRelayPopupOpen(true);
  };

  const closePreferredLanguagePopup = (): void => {
    setWasPreferredLanguagePopupOpen(true);
  };

  const shouldPeriodicallyRefreshAppointmentData = useMemo(() => {
    const appointmentStatus = mapStatusToTelemed(encounter.status, appointment?.status);
    return (
      appointmentStatus === TelemedAppointmentStatusEnum.ready ||
      appointmentStatus === TelemedAppointmentStatusEnum['pre-video'] ||
      appointmentStatus === TelemedAppointmentStatusEnum['on-video']
    );
  }, [appointment, encounter]);

  useRefreshableAppointmentData(
    {
      appointmentId: id,
      isEnabled: shouldPeriodicallyRefreshAppointmentData,
    },
    (refreshedData: RefreshableAppointmentData) => {
      const updatedPatientConditionPhotoUrs = refreshedData.patientConditionPhotoUrls;
      const hasPhotosUpdates = !arraysEqual(currentPatientPhotosUrls, updatedPatientConditionPhotoUrs);
      if (hasPhotosUpdates) {
        useAppointmentStore.setState({ patientPhotoUrls: updatedPatientConditionPhotoUrs });
      }
    }
  );

  useGetAppointment(
    {
      appointmentId: id,
    },
    (data) => {
      const questionnaireResponse = data?.find(
        (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse'
      ) as QuestionnaireResponse;
      useAppointmentStore.setState({
        appointment: data?.find((resource: FhirResource) => resource.resourceType === 'Appointment') as Appointment,
        patient: data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as Patient,
        location: (data?.filter((resource: FhirResource) => resource.resourceType === 'Location') as Location[]).find(
          (location) => !isLocationVirtual(location)
        ),
        locationVirtual: (
          data?.filter((resource: FhirResource) => resource.resourceType === 'Location') as Location[]
        ).find(isLocationVirtual),
        practitioner: data?.find(
          (resource: FhirResource) => resource.resourceType === 'Practitioner'
        ) as unknown as Practitioner,
        encounter: data?.find((resource: FhirResource) => resource.resourceType === 'Encounter') as Encounter,
        questionnaireResponse,
        patientPhotoUrls: extractPhotoUrlsFromAppointmentData(data),
        schoolWorkNoteUrls:
          (data
            ?.filter(
              (resource: FhirResource) =>
                resource.resourceType === 'DocumentReference' &&
                resource.status === 'current' &&
                (resource.type?.coding?.[0].code === SCHOOL_WORK_NOTE_CODE ||
                  resource.type?.coding?.[0].code === SCHOOL_WORK_NOTE_TEMPLATE_CODE)
            )
            .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
            .filter(Boolean) as string[]) || [],
        reviewAndSignData: extractReviewAndSignAppointmentData(data),
      });

      const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer.find(Boolean)
        ?.valueString;
      if (relayPhone?.toLowerCase() === 'yes') {
        setShouldHearingRelayPopupBeOpened(true);
      }
      const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)
        ?.answer?.[0]?.valueString;
      setPreferredLanguage(preferredLanguage);
      if (preferredLanguage && preferredLanguage !== 'English') {
        setShouldPreferredLanguagePopupBeOpened(true);
      }
    }
  );

  useResetAppointmentStore();

  const [tab] = useState(searchParams.get('tab'));
  useEffect(() => {
    if (tab) {
      useAppointmentStore.setState({ currentTab: tab });
      searchParams.delete('tab');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, tab]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <AppointmentHeader />

      <PreferredLanguagePopup
        isOpen={isPreferredLanguagePopupOpen}
        onClose={closePreferredLanguagePopup}
        preferredLanguage={preferredLanguage}
      />

      <HearingRelayPopup isOpen={isHearingRelayPopupOpen} onClose={closeHearingRelayPopup} />

      <Box sx={{ display: 'flex', flex: 1 }}>
        <AppointmentSidePanel />

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            m: 3,
            width: '100%',
          }}
        >
          {meetingData && (
            <ThemeProvider theme={lightTheme}>
              <GlobalStyles />
              <MeetingProvider>
                <VideoChatContainer />
              </MeetingProvider>
            </ThemeProvider>
          )}

          <Box sx={{ width: '100%' }}>
            <AppointmentTabs />
          </Box>
        </Box>
      </Box>

      <AppointmentFooter />

      <div id="prescribe-dialog" />
    </Box>
  );
};

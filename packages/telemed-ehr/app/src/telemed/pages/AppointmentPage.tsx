import { Box } from '@mui/material';
import { GlobalStyles, MeetingProvider, lightTheme } from 'amazon-chime-sdk-component-library-react';
import {
  Appointment,
  DocumentReference,
  Encounter,
  FhirResource,
  Location,
  Patient,
  QuestionnaireResponse,
} from 'fhir/r4';
import { FC, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { SCHOOL_WORK_NOTE_CODE, getQuestionnaireResponseByLinkId } from 'ehr-utils';
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
import { useIsReadOnly } from '../hooks';
import {
  EXAM_OBSERVATIONS_INITIAL,
  RefreshableAppointmentData,
  useAppointmentStore,
  useExamObservationsStore,
  useGetTelemedAppointment,
  useRefreshableAppointmentData,
  useVideoCallStore,
} from '../state';
import { EXAM_CARDS_INITIAL, useExamCardsStore } from '../state/appointment/exam-cards.store';
import { arraysEqual, extractPhotoUrlsFromAppointmentData } from '../utils';

export const AppointmentPage: FC = () => {
  const { id } = useParams();

  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);
  useIsReadOnly();

  const { patientPhotoUrls: currentPatientPhotosUrls } = getSelectors(useAppointmentStore, ['patientPhotoUrls']);

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

  useRefreshableAppointmentData(
    {
      appointmentId: id,
    },
    (refreshedData: RefreshableAppointmentData) => {
      const updatedPatientConditionPhotoUrs = refreshedData.patientConditionPhotoUrs;
      const hasPhotosUpdates = !arraysEqual(currentPatientPhotosUrls, updatedPatientConditionPhotoUrs);
      if (hasPhotosUpdates) {
        useAppointmentStore.setState({
          patientPhotoUrls: updatedPatientConditionPhotoUrs,
        });
      }
    },
  );

  const { isFetching } = useGetTelemedAppointment(
    {
      appointmentId: id,
    },
    (data) => {
      const questionnaireResponse = data?.find(
        (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse',
      ) as unknown as QuestionnaireResponse;
      useAppointmentStore.setState({
        appointment: data?.find(
          (resource: FhirResource) => resource.resourceType === 'Appointment',
        ) as unknown as Appointment,
        patient: data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as unknown as Patient,
        location: data?.find((resource: FhirResource) => resource.resourceType === 'Location') as unknown as Location,
        encounter: data?.find(
          (resource: FhirResource) => resource.resourceType === 'Encounter',
        ) as unknown as Encounter,
        questionnaireResponse,
        patientPhotoUrls: extractPhotoUrlsFromAppointmentData(data),
        schoolWorkNoteUrls:
          (data
            ?.filter(
              (resource: FhirResource) =>
                resource.resourceType === 'DocumentReference' &&
                resource.status === 'current' &&
                resource.type?.coding?.[0].code === SCHOOL_WORK_NOTE_CODE,
            )
            .flatMap((docRef: FhirResource) => (docRef as DocumentReference).content.map((cnt) => cnt.attachment.url))
            .filter(Boolean) as string[]) || [],
      });

      const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer.find(
        Boolean,
      )?.valueString;
      if (relayPhone?.toLowerCase() === 'yes') {
        setShouldHearingRelayPopupBeOpened(true);
      }
      const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer[0]
        .valueString;
      setPreferredLanguage(preferredLanguage);
      if (preferredLanguage && preferredLanguage !== 'English') {
        setShouldPreferredLanguagePopupBeOpened(true);
      }
    },
  );

  useEffect(() => {
    useAppointmentStore.setState({
      appointment: undefined,
      patient: undefined,
      location: undefined,
      encounter: {} as Encounter,
      questionnaireResponse: undefined,
      patientPhotoUrls: [],
      schoolWorkNoteUrls: [],
      chartData: undefined,
      currentTab: 'hpi',
    });
    useExamObservationsStore.setState(EXAM_OBSERVATIONS_INITIAL);
    useVideoCallStore.setState({ meetingData: null });
    useExamCardsStore.setState(EXAM_CARDS_INITIAL);

    return () => useAppointmentStore.setState({ patientPhotoUrls: [] });
  }, []);

  useEffect(() => {
    useAppointmentStore.setState({ isAppointmentLoading: isFetching });
  }, [isFetching]);

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
    </Box>
  );
};

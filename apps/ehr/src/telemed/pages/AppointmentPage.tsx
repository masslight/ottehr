import { Box } from '@mui/material';
import { GlobalStyles, lightTheme, MeetingProvider } from 'amazon-chime-sdk-component-library-react';
import { FC, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import {
  getQuestionnaireResponseByLinkId,
  getSelectors,
  mapStatusToTelemed,
  RefreshableAppointmentData,
  TelemedAppointmentStatusEnum,
} from 'utils';
import HearingRelayPopup from '../components/HearingRelayPopup';
import PreferredLanguagePopup from '../components/PreferredLanguagePopup';
import {
  AppointmentFooter,
  AppointmentHeader,
  AppointmentSidePanel,
  AppointmentTabs,
  VideoChatContainer,
} from '../features/appointment';
import { useResetAppointmentStore } from '../hooks/useResetAppointmentStore';
import {
  useAppointmentData,
  useAppTelemedLocalStore,
  useRefreshableAppointmentData,
  useVideoCallStore,
} from '../state';
import { arraysEqual } from '../utils';

export const AppointmentPage: FC = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  useResetAppointmentStore();

  useEffect(() => {
    if (tab) {
      useAppTelemedLocalStore.setState({ currentTab: tab });
      searchParams.delete('tab');
      setSearchParams(searchParams);
    }
  }, [tab, searchParams, setSearchParams]);

  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  const { appointment, encounter, patientPhotoUrls, appointmentSetState, questionnaireResponse } = useAppointmentData();

  useEffect(() => {
    if (!questionnaireResponse) return;

    const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.find(Boolean)
      ?.valueString;

    if (relayPhone?.toLowerCase() === 'yes') {
      setShouldHearingRelayPopupBeOpened(true);
    }

    const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
      ?.valueString;

    setPreferredLanguage(preferredLanguage);

    if (preferredLanguage && preferredLanguage !== 'English') {
      setShouldPreferredLanguagePopupBeOpened(true);
    }
  }, [questionnaireResponse]);

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
      const hasPhotosUpdates = !arraysEqual(patientPhotoUrls, updatedPatientConditionPhotoUrs);
      if (hasPhotosUpdates) {
        appointmentSetState({ patientPhotoUrls: updatedPatientConditionPhotoUrs });
      }
    }
  );

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

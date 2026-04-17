import { Mic } from '@mui/icons-material';
import { Container, Fab, Paper } from '@mui/material';
import { GlobalStyles, lightTheme, MeetingProvider } from 'amazon-chime-sdk-component-library-react';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { getAdmitterPractitionerId, getAttendingPractitionerId, getSelectors, isTelemedAppointment } from 'utils';
import { Sidebar } from '../../shared/components/Sidebar';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useResetAppointmentStore } from '../../shared/hooks/useResetAppointmentStore';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { VideoChatContainer } from '../../telemed/components/appointment/VideoChatContainer';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { Header } from '../components/Header';
import { InfoAlert } from '../components/InfoAlert';
import { RecordAudioContainer } from '../components/progress-note/RecordAudioContainer';
import { VirtualAppointmentFooter } from '../components/VirtualAppointmentFooter';
import { BottomNavigation } from './BottomNavigation';

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
};

const mainBlocksStyle: React.CSSProperties = {
  display: 'flex',
  flexGrow: 1,
  overflow: 'hidden',
};

const contentWrapperStyle: React.CSSProperties = {
  flexGrow: 1,
  padding: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'auto',
};

export const InPersonLayout: React.FC = () => {
  const { encounter, appointment } = useAppointmentData();
  const [recordingAnchorElement, setRecordingAnchorElement] = React.useState<HTMLButtonElement | null>(null);
  const recordingElementID = 'recording-element';
  const recordingOpen = Boolean(recordingAnchorElement);
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';

  useResetAppointmentStore();
  const { chartData } = useChartData({ shouldUpdateExams: true });
  const assignedIntakePerformerId = getAdmitterPractitionerId(encounter);
  const assignedProviderId = getAttendingPractitionerId(encounter);
  const virtual = isTelemedAppointment(appointment);
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  return (
    <div style={layoutStyle}>
      <Header />
      <div style={mainBlocksStyle}>
        <Sidebar />
        <div style={contentWrapperStyle}>
          {!isFollowup && (
            <Container>
              <Fab
                color="primary"
                aria-label=""
                aria-describedby={recordingElementID}
                sx={{ position: 'fixed', right: 8, bottom: 130 }}
                onClick={(event) =>
                  recordingOpen ? setRecordingAnchorElement(null) : setRecordingAnchorElement(event.currentTarget)
                }
              >
                <Mic />
              </Fab>
              {encounter.id && (
                <Paper
                  sx={{
                    position: 'fixed',
                    right: '15px',
                    bottom: '75px',
                    zIndex: '10',
                    ...(!recordingOpen && { display: 'none' }),
                  }}
                >
                  <RecordAudioContainer
                    visitID={encounter.id}
                    aiChat={chartData?.aiChat}
                    setRecordingAnchorElement={setRecordingAnchorElement}
                  />
                </Paper>
              )}
            </Container>
          )}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 20px 24px 20px',
            }}
          >
            {(isFollowup || assignedIntakePerformerId) && assignedProviderId ? (
              <>
                <Outlet />
              </>
            ) : (
              <InfoAlert text="Select an intake performer and a provider in order to begin charting." persistent />
            )}
          </div>
          <BottomNavigation />
        </div>
      </div>
      {virtual && <VirtualAppointmentFooter />}
      {virtual && meetingData && (
        <ThemeProvider theme={lightTheme}>
          <GlobalStyles />
          <MeetingProvider>
            <VideoChatContainer />
          </MeetingProvider>
        </ThemeProvider>
      )}
    </div>
  );
};

export const CSSSettingsLayout: React.FC = () => (
  <div style={layoutStyle}>
    <Header />
    <div style={mainBlocksStyle}>
      <div style={contentWrapperStyle}>
        <Outlet />
      </div>
    </div>
  </div>
);

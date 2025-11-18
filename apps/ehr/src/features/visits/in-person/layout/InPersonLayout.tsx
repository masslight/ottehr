import { Mic } from '@mui/icons-material';
import { Container, Fab, Paper } from '@mui/material';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { getAdmitterPractitionerId } from 'utils';
import { Sidebar } from '../../shared/components/Sidebar';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useResetAppointmentStore } from '../../shared/hooks/useResetAppointmentStore';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { CommonLayoutBreadcrumbs } from '../components/breadcrumbs/CommonLayoutBreadcrumbs';
import { Header } from '../components/Header';
import { InfoAlert } from '../components/InfoAlert';
import { RecordAudioContainer } from '../components/progress-note/RecordAudioContainer';
import { BottomNavigation } from './BottomNavigation';

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
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
  const { encounter } = useAppointmentData();
  const [recordingAnchorElement, setRecordingAnchorElement] = React.useState<HTMLButtonElement | null>(null);
  const recordingElementID = 'recording-element';
  const recordingOpen = Boolean(recordingAnchorElement);
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';

  useResetAppointmentStore();
  const { chartData } = useChartData({ shouldUpdateExams: true });
  const assignedIntakePerformerId = getAdmitterPractitionerId(encounter);

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
                sx={{ position: 'fixed', right: 8, bottom: 8 }}
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
            {isFollowup || assignedIntakePerformerId ? (
              <>
                <CommonLayoutBreadcrumbs />
                <Outlet />
              </>
            ) : (
              <InfoAlert text="Select an intake performer in order to begin charting." persistent />
            )}
          </div>
          <BottomNavigation />
        </div>
      </div>
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

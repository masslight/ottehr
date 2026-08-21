import { Mic } from '@mui/icons-material';
import { Container, Fab, Paper } from '@mui/material';
import {
  BackgroundBlurProvider,
  BackgroundReplacementProvider,
  GlobalStyles,
  lightTheme,
  MeetingProvider,
} from 'amazon-chime-sdk-component-library-react';
import React from 'react';
import { Outlet, useMatch } from 'react-router-dom';
import { CommandPaletteInPersonRegistrations } from 'src/components/CommandPaletteRegistrations';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import { ThemeProvider } from 'styled-components';
import { isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { getSelectors } from 'utils/lib/store';
import { isVisitFinished } from 'utils/lib/utils/visitUtils';
import { Sidebar } from '../../shared/components/Sidebar';
import { useAiResourcesPolling } from '../../shared/components/useAiResourcesPolling';
import { useAiSuggestionsPolling } from '../../shared/hooks/useAiSuggestionsPolling';
import { useAssignedProvider } from '../../shared/hooks/useAssignedProvider';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useResetAppointmentStore } from '../../shared/hooks/useResetAppointmentStore';
import { useStopAmbientScribeOnLeave } from '../../shared/hooks/useStopAmbientScribeOnLeave';
import { useAppointmentData, useChartData } from '../../shared/stores/appointment/appointment.store';
import { VideoChatContainer } from '../../telemed/components/appointment/VideoChatContainer';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';
import { Header } from '../components/Header';
import { InfoAlert } from '../components/InfoAlert';
import { RecordAudioContainer } from '../components/progress-note/RecordAudioContainer';
import { VirtualAppointmentFooter } from '../components/VirtualAppointmentFooter';
import { ROUTER_PATH } from '../routing/routesInPerson';
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
  const { visitType, isAppointmentReadOnly } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';
  // Easy Chart gets the header and nothing else around it. It is a two-column layout in its own right —
  // the note beside the assistant, each with its own scroll — and it needs every pixel of width for that;
  // a section list down the left is also the wrong navigation for it, which is why it is reached from the
  // header switch instead. Match on the splat, the same way the navigation context reads the current tab.
  const isEasyChart = useMatch('/in-person/:id/*')?.params['*'] === ROUTER_PATH.EASY_CHARTING;

  useResetAppointmentStore();
  useAiSuggestionsPolling();
  // Keep the Ambient Scribe recording alive across rotation; stop & save it on leaving the visit.
  useStopAmbientScribeOnLeave({ hostKey: encounter.id ?? '' });
  const { chartData, refetch: refetchChartData } = useChartData({ shouldUpdateExams: true });
  const { oystehr } = useApiClients();
  // Mounted here (not in the OttehrAi route) so a pending recording or AI interview keeps getting
  // refetched no matter which tab the provider is on — the Ambient Scribe panel above reads
  // chartData.aiChat straight from the same query cache this refetch loop keeps warm.
  useAiResourcesPolling({
    appointment,
    encounter,
    oystehr,
    chartDataHasResources: (chartData?.aiChat?.documents?.length ?? 0) > 0,
    hasPendingRecording: Boolean(chartData?.aiChat?.hasPendingRecording),
    onRefetch: refetchChartData,
  });
  const { isAssignedProviderEligible, isAssignedProviderStale, assignedProviderName } = useAssignedProvider();
  // A finished visit is a record, not work in progress. The provider gate exists to stop new
  // charting and signing under an unassignable provider; applying it to finished visits too would
  // retroactively hide every past note the moment its provider left or changed role.
  //
  // The status check carries this rather than the lock tag alone: the tag is only written by
  // sign-appointment, so visits signed before locking landed carry none and awaiting-approval
  // visits are never tagged. Unlocking a visit for editing leaves its status finished, so the chart
  // stays readable — re-signing it is still blocked, by ReviewAndSignButton and by the zambda.
  const canChart = isAppointmentReadOnly || isVisitFinished(appointment, encounter) || isAssignedProviderEligible;
  // A stale assignment gets its own wording: the Provider picker renders blank once the assignee
  // drops off the provider roster, so "select a provider" alone reads as though nothing happened.
  const staleProviderLabel = assignedProviderName || 'The assigned provider';
  const selectProviderText = isAssignedProviderStale
    ? `${staleProviderLabel} is no longer available as a provider. Select a provider in order to begin charting.`
    : 'Select a provider in order to begin charting.';
  const virtual = isTelemedAppointment(appointment);
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  return (
    <div style={layoutStyle}>
      <CommandPaletteInPersonRegistrations />
      <Header />
      <div style={mainBlocksStyle}>
        {!isEasyChart && <Sidebar />}
        <div style={contentWrapperStyle}>
          {/* Telemed visits record audio automatically via the Oystehr telemed service, so the manual
              start/pause/stop Ambient Scribe recorder is only shown for in-person visits. */}
          {!isFollowup && !virtual && (
            <Container>
              <Fab
                color="primary"
                aria-label=""
                aria-describedby={recordingElementID}
                sx={{ position: 'fixed', right: 8, bottom: virtual ? 130 : 8 }}
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
            {canChart ? (
              <>
                <Outlet />
              </>
            ) : (
              <InfoAlert
                text={selectProviderText}
                persistent
                dataTestId={dataTestIds.inPersonLayout.selectProviderAlert}
              />
            )}
          </div>
          <BottomNavigation />
        </div>
      </div>
      {virtual && <VirtualAppointmentFooter />}
      {virtual && meetingData && (
        <ThemeProvider theme={lightTheme}>
          <GlobalStyles />
          <BackgroundBlurProvider>
            <BackgroundReplacementProvider>
              <MeetingProvider>
                <VideoChatContainer />
              </MeetingProvider>
            </BackgroundReplacementProvider>
          </BackgroundBlurProvider>
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

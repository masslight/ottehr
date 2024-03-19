import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { OttehrThemeProvider } from './OttehrThemeProvider';
import { ScrollToTop, PrivateRoute } from './components';
import { VideoSettings, CheckIn, PostCall, Dashboard, Profile, VideoChatPage, WaitingRoom, Version } from './pages';
import { ParticipantProvider, VideoParticipantProvider, PractitionerProvider } from './store';
import { ThemeProvider } from 'styled-components';
import { MeetingProvider, lightTheme, GlobalStyles } from 'amazon-chime-sdk-component-library-react';
export default function App(): JSX.Element {
  return (
    <OttehrThemeProvider>
      <ThemeProvider theme={lightTheme}>
        <GlobalStyles />
        <MeetingProvider>
          <Router>
            <ScrollToTop />
            <VideoParticipantProvider>
              <Routes>
                <Route element={<PractitionerProvider />}>
                  <Route element={<ParticipantProvider />}>
                    <Route element={<Version />} path="/" />
                    <Route
                      element={
                        <PrivateRoute>
                          <Dashboard />
                        </PrivateRoute>
                      }
                      path={'/dashboard'}
                    />
                    <Route
                      element={
                        <PrivateRoute>
                          <Profile />
                        </PrivateRoute>
                      }
                      path={'/profile'}
                    />
                    <Route
                      element={
                        <PrivateRoute>
                          <PostCall />
                        </PrivateRoute>
                      }
                      path={'/provider-post-call'}
                    />
                    <Route element={<VideoChatPage />} path={'/video-call'} />;
                    <Route element={<VideoSettings />} path={'/video-settings'} />;
                    <Route element={<WaitingRoom />} path={'/waiting-room'} />;
                    <Route element={<CheckIn />} path={'/:slug'} />;
                    <Route element={<PostCall />} path={'/patient-post-call'} />;
                  </Route>
                </Route>
              </Routes>
            </VideoParticipantProvider>
          </Router>
        </MeetingProvider>
      </ThemeProvider>
    </OttehrThemeProvider>
  );
}

import { useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { OttEHRThemeProvider } from './OttEHRThemeProvider';
import { ScrollToTop } from './components';
import {
  CheckInPermission,
  PatientCheckIn,
  PostCall,
  ProviderDashboard,
  ProviderRegistration,
  ProviderSettings,
  Version,
  WaitingRoom,
  VideoChatPage,
} from './pages';
import { PatientProvider, VideoParticipantProvider } from './store';

export default function App(): JSX.Element {
  const { isAuthenticated } = useAuth0();

  return (
    <OttEHRThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          {!isAuthenticated ? (
            <Routes>
              <Route element={<Version />} path={'/'} />;
              <Route element={<PatientProvider />}>
                <Route element={<PatientCheckIn />} path={'/checkin'} />;
                <Route element={<CheckInPermission />} path={'/checkin-permission'} />;
                <Route element={<PostCall />} path={'/post-call'} />;
                <Route element={<ProviderRegistration />} path={'/registration'} />;
                <Route element={<WaitingRoom />} path={'/waiting-room'} />;
                <Route element={<VideoChatPage />} path={'/video-call'} />;
              </Route>
              <Route element={<ProviderDashboard />} path={'/dashboard'} />;
              <Route element={<ProviderSettings />} path={'/provider-profile'} />;
            </Routes>
          ) : (
            <Routes>
              <Route element={<Version />} path={'/'} />;
            </Routes>
          )}
        </VideoParticipantProvider>
      </Router>
    </OttEHRThemeProvider>
  );
}

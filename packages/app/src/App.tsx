import { useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { OttehrThemeProvider } from './OttehrThemeProvider';
import { ScrollToTop } from './components';
import {
  VideoSettings,
  CheckIn,
  PostCall,
  Dashboard,
  Register,
  Profile,
  Version,
  VideoChatPage,
  WaitingRoom,
} from './pages';
import { PatientProvider, VideoParticipantProvider } from './store';

export default function App(): JSX.Element {
  const { isAuthenticated } = useAuth0();

  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          {!isAuthenticated ? (
            <Routes>
              <Route element={<Version />} path={'/'} />;
              <Route element={<PatientProvider />}>
                <Route element={<CheckIn />} path={'/check-in'} />;
                <Route element={<PostCall />} path={'/post-call'} />;
                <Route element={<Register />} path={'/register'} />;
                <Route element={<VideoChatPage />} path={'/video-call'} />;
                <Route element={<VideoSettings />} path={'/video-settings'} />;
                <Route element={<WaitingRoom />} path={'/waiting-room'} />;
              </Route>
              <Route element={<Dashboard />} path={'/dashboard'} />;
              <Route element={<Profile />} path={'/profile'} />;
            </Routes>
          ) : (
            <Routes>
              <Route element={<Version />} path={'/'} />;
            </Routes>
          )}
        </VideoParticipantProvider>
      </Router>
    </OttehrThemeProvider>
  );
}

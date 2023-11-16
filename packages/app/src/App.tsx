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
  VideoChatPage,
  WaitingRoom,
  Version,
} from './pages';
import { PatientProvider, VideoParticipantProvider, PractitionerProvider } from './store';
import PrivateRoute from './components/ProviderRoute';

export default function App(): JSX.Element {
  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          <Routes>
            <Route element={<PractitionerProvider />}>
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
            </Route>
            <Route element={<PatientProvider />}>
              <Route element={<CheckIn />} path={'/check-in'} />;
              <Route element={<PostCall />} path={'/patient-post-call'} />;
              <Route element={<Register />} path={'/register'} />;
              <Route element={<VideoChatPage />} path={'/video-call'} />;
              <Route element={<VideoSettings />} path={'/video-settings'} />;
              <Route element={<WaitingRoom />} path={'/waiting-room'} />;
            </Route>
          </Routes>
        </VideoParticipantProvider>
      </Router>
    </OttehrThemeProvider>
  );
}

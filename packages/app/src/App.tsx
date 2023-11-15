import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { OttehrThemeProvider } from './OttehrThemeProvider';
import { ScrollToTop, PrivateRoute } from './components';
import {
  VideoSettings,
  CheckIn,
  PostCall,
  Dashboard,
  Register,
  Profile,
  VideoChatPage,
  WaitingRoom,
  // Version,
} from './pages';
import { PatientProvider, VideoParticipantProvider, PractitionerProvider } from './store';

export default function App(): JSX.Element {
  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          <Routes>
            <Route element={<PractitionerProvider />}>
              {/* <Route element={<Version />} path="/" /> */}
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
            </Route>
            <Route element={<PatientProvider />}>
              <Route element={<PostCall />} path={'/post-call'} />;
              <Route element={<Register />} path={'/register'} />;
              <Route element={<VideoChatPage />} path={'/video-call'} />;
              <Route element={<VideoSettings />} path={'/video-settings'} />;
              <Route element={<WaitingRoom />} path={'/waiting-room'} />;
              <Route element={<CheckIn />} path={'/:slug'} />;
            </Route>
          </Routes>
        </VideoParticipantProvider>
      </Router>
    </OttehrThemeProvider>
  );
}

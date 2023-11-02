import { useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { OttehrThemeProvider } from './OttehrThemeProvider';
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
import { useEffect } from 'react';
import axios from 'axios';

export default function App(): JSX.Element {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const fetchUserDetails = async (): Promise<void> => {
      if (!isAuthenticated) {
        try {
          const token = await getAccessTokenSilently();
          console.log('token is', token);
          axios
            .get('http://localhost:3301/local/zambda/get-slug-availability/execute-public', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
            .then((response) => {
              if (response.status === 404) {
                console.log('user not found');
              }
            })
            .catch((error) => {
              console.error('An error occurred:', error);
            });
        } catch (e) {
          console.error('Error while getting the access token:', e);
        }
      }
    };

    fetchUserDetails().catch((error) => {
      console.error('An error occurred while fetching user details:', error);
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  return (
    <OttehrThemeProvider>
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
    </OttehrThemeProvider>
  );
}

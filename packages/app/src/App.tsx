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
} from './pages';
import { PatientProvider } from './store';
import { useEffect } from 'react';
import axios from 'axios';

export default function App(): JSX.Element {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const fetchUserDetails = async (): Promise<void> => {
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently();
          axios
            .get('your-server/me-endpoint', {
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
    <OttEHRThemeProvider>
      <Router>
        <ScrollToTop />
        {!isAuthenticated ? (
          <Routes>
            <Route path={'/'} element={<Version />} />;
            <Route element={<PatientProvider />}>
              <Route path={'/checkin'} element={<PatientCheckIn />} />;
              <Route path={'/checkin-permission'} element={<CheckInPermission />} />;
              <Route path={'/post-call'} element={<PostCall />} />;
              <Route path={'/registration'} element={<ProviderRegistration />} />;
              <Route path={'/waiting-room'} element={<WaitingRoom />} />;
            </Route>
            <Route path={'/dashboard'} element={<ProviderDashboard />} />;
            <Route path={'/provider-profile'} element={<ProviderSettings />} />;
          </Routes>
        ) : (
          <Routes>
            <Route path={'/'} element={<Version />} />;
          </Routes>
        )}
      </Router>
    </OttEHRThemeProvider>
  );
}

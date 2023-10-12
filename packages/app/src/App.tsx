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

export default function App(): JSX.Element {
  const { isAuthenticated } = useAuth0();

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

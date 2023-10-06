import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ScrollToTop } from './components';
import { IntakeThemeProvider } from './IntakeThemeProvider';
import Version from './pages/Version';
import ProviderRegistration from './pages/ProviderRegistration';
import PatientCheckIn from './pages/PatientCheckin';
import CheckInPermission from './pages/CheckInPermission';
import ProviderDashboard from './pages/ProviderDashboard';
import ProviderSettings from './pages/ProviderSettings';
import WaitingRoom from './pages/WaitingRoom';
import PostCall from './pages/PostCall';

function App(): JSX.Element {
  const { isAuthenticated } = useAuth0();

  return (
    <IntakeThemeProvider>
      <Router>
        <ScrollToTop />
        {!isAuthenticated ? (
          <Routes>
            <Route path={'/'} element={<Version />} />;
            <Route path={'/registration'} element={<ProviderRegistration />} />;
            <Route path={'/checkin'} element={<PatientCheckIn />} />;
            <Route path={'/checkin-permission'} element={<CheckInPermission />} />;
            <Route path={'/postcall'} element={<PostCall />} />;
            <Route path={'/waitingroom'} element={<WaitingRoom />} />;
            <Route path={'/dashboard'} element={<ProviderDashboard />} />;
            <Route path={'/ProviderProfile'} element={<ProviderSettings />} />;
          </Routes>
        ) : (
          <Routes>
            <Route path={'/'} element={<Version />} />;
          </Routes>
        )}
      </Router>
    </IntakeThemeProvider>
  );
}

export default App;

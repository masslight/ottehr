import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ScrollToTop } from './components';
import { IntakeThemeProvider } from './IntakeThemeProvider';
import Version from './pages/Version';
import ProviderRegistration from './pages/ProviderRegistration';
import PatientCheckIn from './pages/PatientCheckin';

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

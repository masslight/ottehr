import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { ScrollToTop } from './components';
import { IntakeThemeProvider } from './IntakeThemeProvider';
import Version from './pages/Version';

function App(): JSX.Element {
  const { isAuthenticated } = useAuth0();

  return (
    <IntakeThemeProvider>
      <Router>
        <ScrollToTop />
        {!isAuthenticated ? (
          <Routes>
            <Route path={'/'} element={<Version />} />;
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

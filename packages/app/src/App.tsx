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
import { DataContext, PatientProvider, VideoParticipantProvider, setFhirClient, PractitionerProvider } from './store';
import { useContext, useEffect } from 'react';
import { zapehrApi } from './api/zapehrApi';
// import axios from 'axios';

export default function App(): JSX.Element {
  const { state, dispatch } = useContext(DataContext);
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    async function setFhirClientToken(): Promise<void> {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently();
        console.log('accessToken', accessToken);
        const user = await zapehrApi.getUser(accessToken);
        const userId = user.profile.split('/')[1];
        console.log('user', user);
        setFhirClient(accessToken, dispatch);
        const fhirClient = state.fhirClient;
        const profile = await fhirClient?.readResource({
          resourceId: userId,
          resourceType: 'Practitioner',
        });

        console.log('profile', profile);
      }
    }
    setFhirClientToken().catch((error) => {
      console.log(error);
    });
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  // TO DO redirect only for provider pages
  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
    });
  }

  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          <PractitionerProvider>
            {isAuthenticated ? (
              <Routes>
                <Route element={<Version />} path={'/'} />;
                <Route element={<Dashboard />} path={'/dashboard'} />;
                <Route element={<Profile />} path={'/profile'} />;
              </Routes>
            ) : (
              <Routes>
                <Route element={<Version />} path={'/'} />;
              </Routes>
            )}
          </PractitionerProvider>
          <Routes>
            <Route element={<PatientProvider />}>
              <Route element={<CheckIn />} path={'/check-in'} />;
              <Route element={<PostCall />} path={'/post-call'} />;
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

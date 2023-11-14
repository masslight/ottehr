import { useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { OttehrThemeProvider } from './OttehrThemeProvider';
import { ScrollToTop } from './components';
import { VideoSettings, CheckIn, PostCall, Dashboard, Register, Profile, VideoChatPage, WaitingRoom } from './pages';
import { DataContext, PatientProvider, VideoParticipantProvider, setFhirClient, PractitionerProvider } from './store';
import { useContext, useEffect } from 'react';
import { zapehrApi } from './api/zapehrApi';
import PrivateRoute from './components/ProviderRoute';
// import axios from 'axios';

export default function App(): JSX.Element {
  const { state, dispatch } = useContext(DataContext);
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

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

  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          <PractitionerProvider>
            <Routes>
              {/* <Route element={<Version />} path="/" /> */}
              <Route
                element={
                  <PrivateRoute>
                    <Routes>
                      <Route element={<Dashboard />} path="/dashboard" />
                      <Route element={<Profile />} path="/profile" />
                    </Routes>
                  </PrivateRoute>
                }
                path="/"
              />
            </Routes>
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

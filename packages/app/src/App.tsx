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
import { DataContext, PatientProvider, VideoParticipantProvider, setFhirClient } from './store';
import { useContext, useEffect } from 'react';
import { getUser } from './api';
// import axios from 'axios';

export default function App(): JSX.Element {
  const { dispatch } = useContext(DataContext);
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    async function setFhirClientToken(): Promise<void> {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently();
        console.log('accessToken', accessToken);
        const user = await getUser(accessToken);
        console.log('user', user);
        setFhirClient(accessToken, dispatch);
      }
    }
    setFhirClientToken().catch((error) => {
      console.log(error);
    });
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  console.log('isAuthenticated', isAuthenticated);
  // if (!isAuthenticated && !isLoading) {
  //   loginWithRedirect().catch((error) => {
  //     throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
  //   });
  // }

  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          {isAuthenticated ? (
            <Routes>
              <Route element={<Version />} path={'/'} />;
              <Route element={<Dashboard />} path={'/dashboard'} />;
              <Route element={<Profile />} path={'/profile'} />;
              <Route element={<PatientProvider />}>
                <Route element={<PostCall />} path={'/post-call'} />;
                <Route element={<Register />} path={'/register'} />;
                <Route element={<VideoChatPage />} path={'/video-call'} />;
                <Route element={<VideoSettings />} path={'/video-settings'} />;
                <Route element={<WaitingRoom />} path={'/waiting-room'} />;
                <Route element={<CheckIn />} path={'/:slug'} />;
              </Route>
            </Routes>
          ) : (
            <Routes>
              <Route element={<PatientProvider />}>
                <Route element={<PostCall />} path={'/post-call'} />;
                <Route element={<Register />} path={'/register'} />;
                <Route element={<VideoChatPage />} path={'/video-call'} />;
                <Route element={<VideoSettings />} path={'/video-settings'} />;
                <Route element={<WaitingRoom />} path={'/waiting-room'} />;
                <Route element={<CheckIn />} path={'/:slug'} />;
              </Route>
            </Routes>
          )}
        </VideoParticipantProvider>
      </Router>
    </OttehrThemeProvider>
  );
}

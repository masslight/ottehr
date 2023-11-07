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
// import axios from 'axios';

export default function App(): JSX.Element {
  const { dispatch } = useContext(DataContext);
  const { isLoading, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    async function setFhirClientToken(): Promise<void> {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently();
        setFhirClient(accessToken, dispatch);
      }
    }
    setFhirClientToken().catch((error) => {
      console.log(error);
    });
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  if (!isAuthenticated && !isLoading) {
    loginWithRedirect().catch((error) => {
      throw new Error(`Error calling loginWithRedirect Auth0 ${error}`);
    });
  }

  // useEffect(() => {
  //   const fetchAccessToken = async (): Promise<void> => {
  //     try {
  //       console.log('auth', isAuthenticated);
  //       if (isLoading && isAuthenticated) {
  //         const token = await getAccessTokenSilently();
  //         console.log('Access token:', token);
  //       } else {
  //         setTimeout(async () => {
  //           await loginWithRedirect();
  //         }, 1000);
  //       }
  //     } catch (error) {
  //       console.error('Error occurred while fetching the access token:', error);
  //     }
  //   };
  //   setTimeout(async () => {
  //     fetchAccessToken()
  //       .then(() => {
  //         console.log('Access token fetched successfully');
  //       })
  //       .catch((error) => {
  //         console.error('Error fetching access token:', error);
  //       });
  //   }, 5000);
  // }, [isLoading, isAuthenticated, getAccessTokenSilently, loginWithRedirect]);

  // useEffect(() => {
  //   const fetchUserDetails = async (): Promise<void> => {
  //     if (isAuthenticated) {
  //       try {
  //         const token = await getAccessTokenSilently();
  //         console.log('token is', token);
  //         axios
  //           .get('http://localhost:3301/local/zambda/get-slug-availability/execute-public', {
  //             headers: {
  //               Authorization: `Bearer ${token}`,
  //             },
  //           })
  //           .then((response) => {
  //             if (response.status === 404) {
  //               console.log('user not found');
  //             }
  //           })
  //           .catch((error) => {
  //             console.error('An error occurred:', error);
  //           });
  //       } catch (e) {
  //         console.error('Error while getting the access token:', e);
  //       }
  //     }
  //   };

  //   fetchUserDetails().catch((error) => {
  //     console.error('An error occurred while fetching user details:', error);
  //   });
  // }, [isAuthenticated, getAccessTokenSilently]);

  return (
    <OttehrThemeProvider>
      <Router>
        <ScrollToTop />
        <VideoParticipantProvider>
          {!isAuthenticated ? (
            <Routes>
              <Route element={<Version />} path={'/'} />;
              <Route element={<PatientProvider />}>
                <Route element={<CheckIn />} path={'/check-in'} />;
                <Route element={<PostCall />} path={'/post-call'} />;
                <Route element={<Register />} path={'/register'} />;
                <Route element={<VideoChatPage />} path={'/video-call'} />;
                <Route element={<VideoSettings />} path={'/video-settings'} />;
                <Route element={<WaitingRoom />} path={'/waiting-room'} />;
              </Route>
              <Route element={<Dashboard />} path={'/dashboard'} />;
              <Route element={<Profile />} path={'/profile'} />;
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

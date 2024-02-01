import { useContext, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { IntakeDataContext } from '../store/IntakeContext';
import {
  setAppClient,
  setFhirClient,
  setZ3Client,
  setZambdaClient,
  setIntakeZambdaClient,
} from '../store/IntakeActions';
import { useAuth0 } from '@auth0/auth0-react';

function IntakeFlow(): JSX.Element {
  const { dispatch } = useContext(IntakeDataContext);
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    async function setClients(): Promise<void> {
      const token = await getAccessTokenSilently();
      setZambdaClient(token, dispatch);
      setIntakeZambdaClient(token, dispatch);
      setAppClient(token, dispatch);
      setFhirClient(token, dispatch);
      setZ3Client(token, dispatch);
    }
    if (isAuthenticated) {
      setClients().catch((error) => console.log(error));
    } else {
      setZambdaClient(undefined, dispatch);
      setIntakeZambdaClient(undefined, dispatch);
      setAppClient(undefined, dispatch);
      setFhirClient(undefined, dispatch);
      setZ3Client(undefined, dispatch);
    }
  }, [dispatch, getAccessTokenSilently, isAuthenticated]);

  return <Outlet />; // https://reactrouter.com/en/main/start/concepts#outlets
}

export default IntakeFlow;

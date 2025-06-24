import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components';

const Redirect = (): JSX.Element => {
  const { handleRedirectCallback } = useAuth0();
  const navigate = useNavigate();
  const shouldRedirect = useRef(true);

  useEffect(() => {
    const handleRedirect = async (): Promise<void> => {
      const { appState } = await handleRedirectCallback();
      const redirectURL = appState.target;
      navigate(redirectURL);
    };

    // prevents the throwing of an invalid state error when calling handleRedirectCallback()
    // https://community.auth0.com/t/error-invalid-state-when-calling-handleredirectcallback-on-react-app/95329/3
    if (shouldRedirect.current) {
      shouldRedirect.current = false;
      handleRedirect().catch((e) => console.log('error', e));
    }
  }, [handleRedirectCallback, navigate]);

  return (
    <PageContainer title="Loading...">
      <span></span>
    </PageContainer>
  );
};

export default Redirect;

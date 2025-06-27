import { useAuth0 } from '@auth0/auth0-react';
import { t } from 'i18next';
import { useEffect } from 'react';
import { Navigate, Outlet, useBeforeUnload, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getSelectors, PROJECT_WEBSITE } from 'utils';
import { useIntakeCommonStore } from '../features/common';
import { getRedirectPath } from '../helpers';
import { ErrorDialog, UnexpectedErrorDescription } from './ErrorDialog';

function IntakeFlow(): JSX.Element {
  const { pathname } = useLocation();
  const params = useParams();
  const { redirectDestination, networkError, lastUsedLocationPath } = getSelectors(useIntakeCommonStore, [
    'networkError',
    'redirectDestination',
    'lastUsedLocationPath',
  ]);
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  useBeforeUnload(() => {
    // Reset the networkError on page refresh
    useIntakeCommonStore.setState({ networkError: false });
  });

  useEffect(() => {
    // console.log('effect fired here');
    // todo: simplify
    if (!isLoading) {
      if (isAuthenticated && pathname === '/') {
        if (lastUsedLocationPath) {
          navigate(lastUsedLocationPath);
        } else {
          window.location.href = PROJECT_WEBSITE;
        }
      } else {
        if (!isAuthenticated && redirectDestination) {
          // console.log('navigating to redirect destination');
          const redirect = `${redirectDestination}`;
          useIntakeCommonStore.setState({ redirectDestination: undefined });
          navigate(redirect);
        } else {
          const redirect = getRedirectPath({ slug: params.slug, visit_type: params.visit_type }, pathname);
          if (redirect.relative) {
            // console.log('navigating to redirect relative');
            navigate(redirect.relative);
          } else if (redirect.absolute) {
            window.location.href = redirect.absolute;
          }
        }
      }
    }
  }, [
    navigate,
    params.slug,
    params.visit_type,
    pathname,
    isAuthenticated,
    redirectDestination,
    isLoading,
    lastUsedLocationPath,
  ]);

  // to account for the transition away from /appointment to /visit
  const userOnAppointmentPage = location.pathname.startsWith('/appointment');
  if (userOnAppointmentPage) {
    return <Navigate to={location.pathname.replace('appointment', 'visit')} />;
  }

  if (networkError) {
    return (
      <>
        <Outlet />
        <ErrorDialog
          open={networkError}
          handleClose={() => useIntakeCommonStore.setState({ networkError: false })}
          title={t('general.errors.unexpected.title')}
          description={UnexpectedErrorDescription}
          closeButtonText={t('general.button.close')}
        ></ErrorDialog>
      </>
    );
  }

  return <Outlet />; // https://reactrouter.com/en/main/start/concepts#outlets
}

export default IntakeFlow;

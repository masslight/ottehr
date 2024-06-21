import { useContext } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { FORM_PAGES, IntakeFlowPageRoute } from '../App';
import { IntakeDataContext } from '../store';
import { updateNetworkError } from '../store/IntakeActions';
import { ErrorDialog } from 'ottehr-components';

function IntakeFlow(): JSX.Element {
  const location = useLocation();
  const { state, dispatch } = useContext(IntakeDataContext);

  // If a user starts on a form page, redirect them to the welcome page
  const formPaths = Object.values(FORM_PAGES).map((pageTemp) => pageTemp.path);
  formPaths.push('/paperwork');
  const existingVisitType = localStorage.getItem('visitType');
  const slug = localStorage.getItem('slug');
  const userOnFormPage = formPaths.some((formPath) => location.pathname.startsWith(formPath));
  if (userOnFormPage && Object.keys(state).length === 0 && !slug) {
    console.log('Do not have state, do not have slug, redirecting to the welcome page');
    return <Navigate to={IntakeFlowPageRoute.Welcome.path} />;
  } else if (userOnFormPage && Object.keys(state).length === 0 && existingVisitType) {
    console.log('Do not have state, have slug, have visit type, redirecting to the location welcome visittype page');
    return <Navigate to={`/location/${slug}/${existingVisitType}`} />;
  } else if (userOnFormPage && Object.keys(state).length === 0) {
    console.log(
      'Do not have state, have slug, do not have visit type, redirecting to the location welcome prebook page',
    );
    return <Navigate to={`/location/${slug}/prebook`} />;
  }

  if (state.networkError) {
    return (
      <>
        <Outlet />
        <ErrorDialog
          open={state.networkError}
          handleClose={() => updateNetworkError(false, dispatch)}
          title="Unexpected error"
          description={
            <>
              There was an unexpected error. Please try again and if the error persists{' '}
              <Link to="https://ottehr.com" target="_blank">
                contact us
              </Link>
              .
            </>
          }
          closeButtonText="Close"
        ></ErrorDialog>
      </>
    );
  }

  return <Outlet />; // https://reactrouter.com/en/main/start/concepts#outlets
}

export default IntakeFlow;

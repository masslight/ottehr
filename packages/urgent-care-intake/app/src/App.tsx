import { ReactElement } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { MixpanelContextProps, setupMixpanel, setupSentry, ScrollToTop } from 'ottehr-components';
import { IntakeThemeProvider } from './IntakeThemeProvider';
import { IntakeFlow } from './components';
import { GetReadyForVisit, NewUser, Version, Welcome } from './pages';
import Appointments from './pages/Appointments';
import CancellationConfirmation from './pages/CancellationConfirmation';
import CancellationReason from './pages/CancellationReason';
import CheckIn from './pages/CheckIn';
import PaperworkPage from './pages/PaperworkPage';
import PatientInformation from './pages/PatientInformation';
import Review from './pages/Review';
import ReviewPaperwork from './pages/ReviewPaperwork';
import ThankYou from './pages/ThankYou';
import WelcomeBack from './pages/WelcomeBack';

if (import.meta.env.MODE === 'dev' || import.meta.env.MODE === 'staging' || import.meta.env.MODE === 'testing') {
  setupSentry({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    networkDetailAllowUrls: [import.meta.env.VITE_APP_PROJECT_API_URL, import.meta.env.VITE_APP_FHIR_API_URL],
    // tracePropagationTargets: [import.meta.env.VITE_APP_PROJECT_API_URL, import.meta.env.VITE_APP_FHIR_API_URL],
  });
}
import ConfirmDateOfBirth from './pages/ConfirmDateOfBirth';

// https://stackoverflow.com/a/51398471
export class IntakeFlowPageRoute {
  static readonly Welcome = new IntakeFlowPageRoute('/', <Welcome />);
  static readonly WelcomeType = new IntakeFlowPageRoute('/location/:slug/:visit_type', <Welcome />);
  static readonly Appointments = new IntakeFlowPageRoute('/appointments', <Appointments />);
  static readonly CheckIn = new IntakeFlowPageRoute('appointment/:id/check-in', <CheckIn />);
  static readonly Reschedule = new IntakeFlowPageRoute('/appointment/:id/:visit_type', <Welcome />);
  static readonly WelcomeBack = new IntakeFlowPageRoute('/patients', <WelcomeBack />);
  static readonly GetReadyForVisit = new IntakeFlowPageRoute('/get-ready', <GetReadyForVisit />);
  static readonly NewUser = new IntakeFlowPageRoute('/new-user', <NewUser />);
  static readonly PaperworkInformation = new IntakeFlowPageRoute('/paperwork/:paperwork_page', <PaperworkPage />);
  static readonly PatientInformation = new IntakeFlowPageRoute('/patient-information', <PatientInformation />);
  static readonly CancellationReason = new IntakeFlowPageRoute('/appointment/:id/cancel', <CancellationReason />);
  static readonly Review = new IntakeFlowPageRoute('/review', <Review />);
  static readonly ReviewPaperwork = new IntakeFlowPageRoute('/review-paperwork', <ReviewPaperwork />);
  static readonly ThankYou = new IntakeFlowPageRoute('/appointment/:id', <ThankYou />);
  static readonly CancellationConfirmation = new IntakeFlowPageRoute(
    '/cancellation-confirmation',
    <CancellationConfirmation />,
  );
  static readonly ConfirmDateOfBirth = new IntakeFlowPageRoute('/confirm-date-of-birth', <ConfirmDateOfBirth />);

  private constructor(
    public readonly path: string,
    public readonly page: ReactElement,
  ) {}
}

const MIXPANEL_SETTINGS: MixpanelContextProps = {
  token: import.meta.env.VITE_APP_MIXPANEL_TOKEN,
  registerProps: { appname: 'Urgent Care' },
};

setupMixpanel(MIXPANEL_SETTINGS);

export const FORM_PAGES = [
  IntakeFlowPageRoute.NewUser,
  IntakeFlowPageRoute.PatientInformation,
  IntakeFlowPageRoute.Review,
  IntakeFlowPageRoute.ReviewPaperwork,
  IntakeFlowPageRoute.ConfirmDateOfBirth,
];

function App(): JSX.Element {
  return (
    <IntakeThemeProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path={'/version'} element={<Version />} />;
          <Route path="/" element={<IntakeFlow />}>
            <Route index element={IntakeFlowPageRoute.Welcome.page} />
            <Route path={IntakeFlowPageRoute.WelcomeType.path} element={IntakeFlowPageRoute.WelcomeType.page} />
            <Route path="*" element={<Navigate to="/"></Navigate>} />
            <Route path={IntakeFlowPageRoute.CheckIn.path} element={IntakeFlowPageRoute.CheckIn.page} />
            <Route path={IntakeFlowPageRoute.Appointments.path} element={IntakeFlowPageRoute.Appointments.page} />
            <Route path={IntakeFlowPageRoute.Reschedule.path} element={IntakeFlowPageRoute.Reschedule.page} />
            <Route path={IntakeFlowPageRoute.WelcomeBack.path} element={IntakeFlowPageRoute.WelcomeBack.page} />
            <Route
              path={IntakeFlowPageRoute.ConfirmDateOfBirth.path}
              element={IntakeFlowPageRoute.ConfirmDateOfBirth.page}
            />
            <Route
              path={IntakeFlowPageRoute.GetReadyForVisit.path}
              element={IntakeFlowPageRoute.GetReadyForVisit.page}
            />
            <Route path={IntakeFlowPageRoute.NewUser.path} element={IntakeFlowPageRoute.NewUser.page} />
            <Route
              path={IntakeFlowPageRoute.PatientInformation.path}
              element={IntakeFlowPageRoute.PatientInformation.page}
            />
            <Route
              path={IntakeFlowPageRoute.PaperworkInformation.path}
              element={IntakeFlowPageRoute.PaperworkInformation.page}
            />
            <Route
              path={IntakeFlowPageRoute.CancellationReason.path}
              element={IntakeFlowPageRoute.CancellationReason.page}
            />
            <Route path={IntakeFlowPageRoute.Review.path} element={IntakeFlowPageRoute.Review.page} />
            <Route
              path={IntakeFlowPageRoute.CancellationConfirmation.path}
              element={IntakeFlowPageRoute.CancellationConfirmation.page}
            />
            <Route path={IntakeFlowPageRoute.ReviewPaperwork.path} element={IntakeFlowPageRoute.ReviewPaperwork.page} />
            <Route path={IntakeFlowPageRoute.ThankYou.path} element={IntakeFlowPageRoute.ThankYou.page} />
          </Route>
        </Routes>
      </Router>
    </IntakeThemeProvider>
  );
}

export default App;

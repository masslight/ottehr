import { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { MixpanelContextProps, ScrollToTop, setupMixpanel, setupSentry } from 'ottehr-components';
import { IntakeThemeProvider } from './IntakeThemeProvider';
import { ProtectedRoute } from './features/auth';
import { ErrorFallbackScreen, LoadingScreen } from './features/common';
import './lib/i18n';
import AuthPage from './pages/AuthPage';
import CreateAccount from './pages/CreateAccount';
import Homepage from './pages/Homepage';
import NewUser from './pages/NewUser';
import PaperworkPage from './pages/PaperworkPage';
import PatientInformation from './pages/PatientInformation';
import ReviewPaperwork from './pages/ReviewPaperwork';
import UserFlowRoot from './pages/UserFlowRoot';
import VideoChatPage from './pages/VideoChatPage';
import WaitingRoom from './pages/WaitingRoom';
import Welcome from './pages/Welcome';
import RequestVisit from './pages/RequestVisit';

const isLowerEnvs =
  import.meta.env.MODE === 'dev' ||
  import.meta.env.MODE === 'staging' ||
  import.meta.env.MODE === 'testing' ||
  import.meta.env.MODE === 'training';

const isLowerEnvsOrProd = isLowerEnvs || import.meta.env.MODE === 'production';

if (isLowerEnvsOrProd) {
  setupSentry({
    dsn: import.meta.env.VITE_APP_SENTRY_DSN,
    environment: import.meta.env.MODE,
    networkDetailAllowUrls: isLowerEnvs
      ? [import.meta.env.VITE_APP_FHIR_API_URL, import.meta.env.VITE_APP_PROJECT_API_URL]
      : [],
  });
}

const MIXPANEL_SETTINGS: MixpanelContextProps = {
  token: import.meta.env.VITE_APP_MIXPANEL_TOKEN,
  registerProps: { appname: 'Telemed QRS' },
};

setupMixpanel(MIXPANEL_SETTINGS);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export class IntakeFlowPageRoute {
  static readonly Homepage = new IntakeFlowPageRoute('/home', <Homepage />);
  static readonly RequestVisit = new IntakeFlowPageRoute('/request-visit', <RequestVisit />);
  static readonly CreateAccount = new IntakeFlowPageRoute('/create-account', <CreateAccount />);
  static readonly PatientInformation = new IntakeFlowPageRoute('/about-patient', <PatientInformation />);
  static readonly AuthPage = new IntakeFlowPageRoute('/auth', <AuthPage />);
  static readonly Welcome = new IntakeFlowPageRoute('/welcome', <Welcome />);
  static readonly NewUser = new IntakeFlowPageRoute('/new-user', <NewUser />);
  static readonly PaperworkPage = new IntakeFlowPageRoute('/paperwork/:slug', <PaperworkPage />);
  static readonly WaitingRoom = new IntakeFlowPageRoute('/waiting-room', <WaitingRoom />);
  static readonly ReviewPaperwork = new IntakeFlowPageRoute('/review-paperwork', <ReviewPaperwork />);
  static readonly VideoCall = new IntakeFlowPageRoute('/video-call', <VideoChatPage />);
  private constructor(
    public readonly path: string,
    public readonly page: ReactElement,
  ) {}
}

function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <IntakeThemeProvider>
        <Router>
          <ScrollToTop />
          <Routes>
            <Route path={IntakeFlowPageRoute.AuthPage.path} element={IntakeFlowPageRoute.AuthPage.page} />
            <Route path={IntakeFlowPageRoute.Welcome.path} element={IntakeFlowPageRoute.Welcome.page} />
            <Route
              element={
                <ProtectedRoute
                  loadingFallback={<LoadingScreen />}
                  errorFallback={<ErrorFallbackScreen />}
                  unauthorizedFallback={<Navigate to={IntakeFlowPageRoute.Welcome.path} />}
                />
              }
            >
              <Route path="/" element={<UserFlowRoot />} />
              <Route path={IntakeFlowPageRoute.NewUser.path} element={IntakeFlowPageRoute.NewUser.page} />
              <Route path={IntakeFlowPageRoute.Homepage.path} element={IntakeFlowPageRoute.Homepage.page} />
              <Route path={IntakeFlowPageRoute.RequestVisit.path} element={IntakeFlowPageRoute.RequestVisit.page} />
              <Route path={IntakeFlowPageRoute.CreateAccount.path} element={IntakeFlowPageRoute.CreateAccount.page} />
              <Route
                path={IntakeFlowPageRoute.PatientInformation.path}
                element={IntakeFlowPageRoute.PatientInformation.page}
              />
              <Route path={IntakeFlowPageRoute.WaitingRoom.path} element={IntakeFlowPageRoute.WaitingRoom.page} />
              <Route path={IntakeFlowPageRoute.PaperworkPage.path} element={IntakeFlowPageRoute.PaperworkPage.page} />
              <Route
                path={IntakeFlowPageRoute.ReviewPaperwork.path}
                element={IntakeFlowPageRoute.ReviewPaperwork.page}
              />
              <Route path={IntakeFlowPageRoute.VideoCall.path} element={IntakeFlowPageRoute.VideoCall.page} />
            </Route>
            <Route path="*" element={<Navigate to={IntakeFlowPageRoute.Welcome.path} />} />
          </Routes>
        </Router>
      </IntakeThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

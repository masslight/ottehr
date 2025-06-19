import { useAuth0 } from '@auth0/auth0-react';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { MixpanelContextProps, ScrollToTop, setupMixpanel, setupSentry } from 'ui-components';
import { TestErrorPage } from './components/TestErrorPage';
import { IntakeThemeProvider } from './IntakeThemeProvider';
import { BookingHome, GetReadyForVisit, NewUser, Reschedule, Version } from './pages';
import AIInterview from './pages/AIInterview';
import Appointments from './pages/Appointments';
import CancellationConfirmation from './pages/CancellationConfirmation';
import CancellationReason from './pages/CancellationReason';
import CheckIn from './pages/CheckIn';
import WelcomeBack from './pages/ChoosePatient';
import ConfirmDateOfBirth from './pages/ConfirmDateOfBirth';
import Homepage from './pages/Homepage';
import MyPatients from './pages/MyPatients';
import { PaperworkHome, PaperworkPage } from './pages/PaperworkPage';
import PastVisits from './pages/PastVisits';
import PatientInformation from './pages/PatientInformation';
import PrebookVisit from './pages/PrebookVisit';
import Review from './pages/Review';
import ReviewPaperwork from './pages/ReviewPaperwork';
import StartVirtualVisit from './pages/StartVirtualVisit';
import ThankYou from './pages/ThankYou';
import VisitDetails from './pages/VisitDetails';
import { WalkinLanding } from './pages/WalkinLanding';
import { ErrorAlert } from './telemed/components/ErrorAlert';
import { IOSMessagesHandler } from './telemed/components/IOSMessagesHandler';
import { ProtectedRoute } from './telemed/features/auth';
import { ErrorFallbackScreen, LoadingScreen } from './telemed/features/common';
import { useIOSAppSync } from './telemed/features/ios-communication/useIOSAppSync';
import AuthPage from './telemed/pages/AuthPage';
import CallEndedPage from './telemed/pages/CallEndedPage';
import { IOSCallEndedPage } from './telemed/pages/IOS/IOSCallEndedPage';
import { IOSPatientManageParticipantsPage } from './telemed/pages/IOS/IOSManageParticipantsPage';
import { IOSPatientPhotosEditPage } from './telemed/pages/IOS/IOSPatientPhotosEditPage';
import { IOSVideoCallMenu } from './telemed/pages/IOS/IOSVideoCallMenu';
import VideoChatPage from './telemed/pages/VideoChatPage';
import WaitingRoom from './telemed/pages/WaitingRoom';
import Welcome from './telemed/pages/Welcome';
const {
  MODE: environment,
  VITE_APP_FHIR_API_URL,
  VITE_APP_MIXPANEL_TOKEN,
  VITE_APP_PROJECT_API_URL,
  VITE_APP_SENTRY_DSN,
} = import.meta.env;

const isLowerEnvs = ['dev', 'testing', 'staging', 'training'].includes(environment);

const isLowerEnvsOrProd = isLowerEnvs || import.meta.env.MODE === 'production';

if (isLowerEnvsOrProd) {
  setupSentry({
    dsn: VITE_APP_SENTRY_DSN,
    environment,
    networkDetailAllowUrls: isLowerEnvs ? [VITE_APP_FHIR_API_URL, VITE_APP_PROJECT_API_URL] : [],
  });
}

const MIXPANEL_SETTINGS: MixpanelContextProps = {
  token: VITE_APP_MIXPANEL_TOKEN,
  // cSpell:disable-next appname
  registerProps: { appname: 'In Person' },
};

setupMixpanel(MIXPANEL_SETTINGS);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const BOOKING_SLOT_ID_PARAM = 'slotId';
export const BOOKING_SERVICE_MODE_PARAM = 'service_mode';
export const BOOKING_SCHEDULE_TYPE_QUERY_PARAM = 'scheduleType';
export const BOOKING_SCHEDULE_ON_QUERY_PARAM = 'bookingOn';
export const BOOKING_SCHEDULE_SELECTED_SLOT = 'slot';

export const bookingBasePath = `/book/:${BOOKING_SLOT_ID_PARAM}`;
export const paperworkBasePath = '/paperwork/:id';
export const telemedPaperworkBasePath = `/telemed${paperworkBasePath}`;
export const visitBasePath = '/visit/:id';
export const intakeFlowPageRoute = {
  Homepage: {
    path: '/home',
    getPage: () => <Homepage />,
  },
  AuthPage: {
    path: '/redirect',
    getPage: () => <AuthPage />,
  },
  Welcome: {
    path: '/welcome',
    getPage: () => <Welcome />,
  },
  WalkinLanding: {
    path: '/walkin/schedule/:id',
    getPage: () => <WalkinLanding />,
  },
  WalkinLandingByLocationName: {
    path: '/walkin/location/:name',
    getPage: () => <WalkinLanding />,
  },
  Appointments: {
    path: '/visits',
    getPage: () => <Appointments />,
  },
  MyPatients: {
    path: '/my-patients',
    getPage: () => <MyPatients />,
  },
  PastVisits: {
    path: '/my-patients/:patientId/past-visits',
    getPage: () => <PastVisits />,
  },
  VisitDetails: {
    path: '/my-patients/:patientId/past-visits/:visitId',
    getPage: () => <VisitDetails />,
  },

  // paperwork routers
  PaperworkHomeRoute: {
    path: paperworkBasePath,
    getPage: () => <PaperworkHome />,
  },
  PaperworkInformation: {
    path: `${paperworkBasePath}/:slug`,
    getPage: () => <PaperworkPage />,
  },
  ReviewPaperwork: {
    path: `${paperworkBasePath}/review`,
    getPage: () => <ReviewPaperwork />,
  },

  // visit routes
  ThankYou: {
    path: visitBasePath,
    getPage: () => <ThankYou />,
  },
  CheckIn: {
    path: `${visitBasePath}/check-in`,
    getPage: () => <CheckIn />,
  },
  Reschedule: {
    path: `${visitBasePath}/reschedule`,
    getPage: () => <Reschedule />,
  },
  CancellationConfirmation: {
    path: `${visitBasePath}/cancellation-confirmation`,
    getPage: () => <CancellationConfirmation />,
  },
  CancellationReason: {
    path: `${visitBasePath}/cancel`,
    getPage: () => <CancellationReason />,
  },
  AIInterview: {
    path: `${visitBasePath}/ai-interview`,
    getPage: () => <AIInterview />,
  },
  TelemedGetReadyForVisit: {
    path: '/paperwork/get-ready-for-the-visit',
    getPage: () => <GetReadyForVisit />,
  },
  WaitingRoom: {
    path: '/waiting-room',
    getPage: () => <WaitingRoom />,
  },
  InvitedWaitingRoom: {
    path: '/invited-waiting-room',
    getPage: () => <WaitingRoom />,
  },
  VideoCall: {
    path: '/video-call',
    getPage: () => <VideoChatPage />,
  },
  InvitedVideoCall: {
    path: '/invited-video-call',
    getPage: () => <VideoChatPage />,
  },
  CallEnded: {
    path: '/call-ended',
    getPage: () => <CallEndedPage />,
  },
  InvitedCallEnded: {
    path: '/invited-call-ended',
    getPage: () => <CallEndedPage />,
  },

  IOSPatientPhotosEdit: {
    path: '/ios-patient-photos',
    getPage: () => <IOSPatientPhotosEditPage />,
  },
  IOSPatientManageParticipants: {
    path: '/ios-manage-participants',
    getPage: () => <IOSPatientManageParticipantsPage />,
  },
  IOSVideoCallMenu: {
    path: '/ios-video-call-menu',
    getPage: () => <IOSVideoCallMenu />,
  },
  IOSCallEnded: {
    path: '/ios-call-ended',
    getPage: () => <IOSCallEndedPage />,
  },

  // booking routes
  PrebookVisit: {
    path: '/prebook',
    getPage: () => <PrebookVisit />,
  },
  PrebookVisitDynamic: {
    path: `/prebook/:${BOOKING_SERVICE_MODE_PARAM}`,
    getPage: () => <PrebookVisit />,
  },
  StartVirtualVisit: {
    path: '/start-virtual',
    getPage: () => <StartVirtualVisit />,
  },
  BookingHome: {
    path: bookingBasePath,
    getPage: () => <BookingHome />,
  },
  ChoosePatient: {
    path: `${bookingBasePath}/patients`,
    getPage: () => <WelcomeBack />,
  },
  GetReadyForVisit: {
    path: `${bookingBasePath}/get-ready`,
    getPage: () => <GetReadyForVisit />,
  },
  ConfirmDateOfBirth: {
    path: `${bookingBasePath}/confirm-date-of-birth`,
    getPage: () => <ConfirmDateOfBirth />,
  },
  PatientInformation: {
    path: `${bookingBasePath}/patient-information`,
    getPage: () => <PatientInformation />,
  },
  Review: {
    path: `${bookingBasePath}/review`,
    getPage: () => <Review />,
  },
  NewUser: {
    path: `${bookingBasePath}/new-user`,
    getPage: () => <NewUser />,
  },
  TestErrorPage: {
    path: '/test-error',
    getPage: () => <TestErrorPage />,
  },
} as const;

function App(): JSX.Element {
  useIOSAppSync();

  const { user } = useAuth0();
  useEffect(() => {
    mixpanel.identify();
  }, []);
  useEffect(() => {
    // user.name = user's verified phone number
    if (user?.name) {
      mixpanel.people.set({
        $phone: user.name,
      });
    }
  }, [user?.name]);

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <Helmet>
          {/* initialize google tag manager */}
          <script>
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${import.meta.env.VITE_APP_GTM_ID}');`}
          </script>
          {/* define a dummy gtag function so it'll stop complaining. possibly caused by race condition when triggering events? */}
          <script>{`function gtag(){};`}</script>
        </Helmet>
        <IntakeThemeProvider>
          <Router>
            <ScrollToTop />
            <ErrorAlert />
            <IOSMessagesHandler />
            <Routes>
              {/*<Route path="/" element={<UserFlowRoot />} />*/}
              <Route path={intakeFlowPageRoute.Homepage.path} element={intakeFlowPageRoute.Homepage.getPage()} />
              <Route path={'/version'} element={<Version />} />;
              <Route path={intakeFlowPageRoute.AuthPage.path} element={intakeFlowPageRoute.AuthPage.getPage()} />;
              <Route path={intakeFlowPageRoute.Welcome.path} element={intakeFlowPageRoute.Welcome.getPage()} />
              <Route
                path={intakeFlowPageRoute.InvitedVideoCall.path}
                element={intakeFlowPageRoute.InvitedVideoCall.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.InvitedCallEnded.path}
                element={intakeFlowPageRoute.InvitedCallEnded.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.InvitedWaitingRoom.path}
                element={intakeFlowPageRoute.InvitedWaitingRoom.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.PrebookVisit.path}
                element={intakeFlowPageRoute.PrebookVisit.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.WalkinLanding.path}
                element={intakeFlowPageRoute.WalkinLanding.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.WalkinLandingByLocationName.path}
                element={intakeFlowPageRoute.WalkinLandingByLocationName.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.PrebookVisitDynamic.path}
                element={intakeFlowPageRoute.PrebookVisitDynamic.getPage()}
              />
              <Route
                path={intakeFlowPageRoute.StartVirtualVisit.path}
                element={intakeFlowPageRoute.StartVirtualVisit.getPage()}
              />
              <Route
                element={<ProtectedRoute loadingFallback={<LoadingScreen />} errorFallback={<ErrorFallbackScreen />} />}
              >
                <Route path={intakeFlowPageRoute.MyPatients.path} element={intakeFlowPageRoute.MyPatients.getPage()}>
                  <Route
                    path={intakeFlowPageRoute.PastVisits.path}
                    element={intakeFlowPageRoute.PastVisits.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.VisitDetails.path}
                    element={intakeFlowPageRoute.VisitDetails.getPage()}
                  />
                </Route>
                <Route
                  path={intakeFlowPageRoute.WaitingRoom.path}
                  element={intakeFlowPageRoute.WaitingRoom.getPage()}
                />
                <Route
                  path={intakeFlowPageRoute.TelemedGetReadyForVisit.path}
                  element={intakeFlowPageRoute.TelemedGetReadyForVisit.getPage()}
                />
                <Route path={intakeFlowPageRoute.VideoCall.path} element={intakeFlowPageRoute.VideoCall.getPage()} />
                <Route path={intakeFlowPageRoute.CallEnded.path} element={intakeFlowPageRoute.CallEnded.getPage()} />
                <Route path={intakeFlowPageRoute.BookingHome.path} element={intakeFlowPageRoute.BookingHome.getPage()}>
                  <Route
                    path={intakeFlowPageRoute.ChoosePatient.path}
                    element={intakeFlowPageRoute.ChoosePatient.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.GetReadyForVisit.path}
                    element={intakeFlowPageRoute.GetReadyForVisit.getPage()}
                  />
                  <Route path={intakeFlowPageRoute.NewUser.path} element={intakeFlowPageRoute.NewUser.getPage()} />
                  <Route
                    path={intakeFlowPageRoute.PatientInformation.path}
                    element={intakeFlowPageRoute.PatientInformation.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.ConfirmDateOfBirth.path}
                    element={intakeFlowPageRoute.ConfirmDateOfBirth.getPage()}
                  />
                  <Route path={intakeFlowPageRoute.Review.path} element={intakeFlowPageRoute.Review.getPage()} />
                </Route>
                <Route
                  path={intakeFlowPageRoute.Appointments.path}
                  element={intakeFlowPageRoute.Appointments.getPage()}
                />
                <Route
                  path={intakeFlowPageRoute.PaperworkHomeRoute.path}
                  element={intakeFlowPageRoute.PaperworkHomeRoute.getPage()}
                >
                  <Route
                    path={intakeFlowPageRoute.PaperworkInformation.path}
                    element={intakeFlowPageRoute.PaperworkInformation.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.ReviewPaperwork.path}
                    element={intakeFlowPageRoute.ReviewPaperwork.getPage()}
                  />
                </Route>
                <Route path={intakeFlowPageRoute.ThankYou.path} element={intakeFlowPageRoute.ThankYou.getPage()}>
                  <Route path={intakeFlowPageRoute.CheckIn.path} element={intakeFlowPageRoute.CheckIn.getPage()} />
                  <Route
                    path={intakeFlowPageRoute.Reschedule.path}
                    element={intakeFlowPageRoute.Reschedule.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.CancellationReason.path}
                    element={intakeFlowPageRoute.CancellationReason.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.CancellationConfirmation.path}
                    element={intakeFlowPageRoute.CancellationConfirmation.getPage()}
                  />
                  <Route
                    path={intakeFlowPageRoute.AIInterview.path}
                    element={intakeFlowPageRoute.AIInterview.getPage()}
                  />
                </Route>
                {/* TODO: make IOS routes be under protected route but without custom container */}
                <Route
                  path={intakeFlowPageRoute.IOSPatientPhotosEdit.path}
                  element={intakeFlowPageRoute.IOSPatientPhotosEdit.getPage()}
                />
                <Route
                  path={intakeFlowPageRoute.IOSPatientManageParticipants.path}
                  element={intakeFlowPageRoute.IOSPatientManageParticipants.getPage()}
                />
                <Route
                  path={intakeFlowPageRoute.IOSVideoCallMenu.path}
                  element={intakeFlowPageRoute.IOSVideoCallMenu.getPage()}
                />
                <Route
                  path={intakeFlowPageRoute.IOSCallEnded.path}
                  element={intakeFlowPageRoute.IOSCallEnded.getPage()}
                />
              </Route>
              <Route
                path={intakeFlowPageRoute.TestErrorPage.path}
                element={intakeFlowPageRoute.TestErrorPage.getPage()}
              />
              <Route path="*" element={<Navigate to={intakeFlowPageRoute.Welcome.path} />} />
            </Routes>
          </Router>
        </IntakeThemeProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;

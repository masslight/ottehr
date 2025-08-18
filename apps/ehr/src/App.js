"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showEnvironmentBanner = exports.STATES_URL = exports.INSURANCES_URL = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
// import Alert from '@mui/material/Alert';
var x_data_grid_pro_1 = require("@mui/x-data-grid-pro");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_idle_timer_1 = require("react-idle-timer");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var Banner_1 = require("./components/Banner");
var LogoutWarning_1 = require("./components/dialogs/LogoutWarning");
var LoadingScreen_1 = require("./components/LoadingScreen");
var Navbar_1 = require("./components/navigation/Navbar");
var AddPatientFollowup_1 = require("./components/patient/AddPatientFollowup");
var PatientFollowup_1 = require("./components/patient/PatientFollowup");
var ProtectedRoute_1 = require("./components/routing/ProtectedRoute");
var TestErrorPage_1 = require("./components/TestErrorPage");
var CustomThemeProvider_1 = require("./CustomThemeProvider");
var featureFlags_1 = require("./features/css-module/context/featureFlags");
var useAppClients_1 = require("./hooks/useAppClients");
var useEvolveUser_1 = require("./hooks/useEvolveUser");
var AddEmployeePage_1 = require("./pages/AddEmployeePage");
var AddPatient_1 = require("./pages/AddPatient");
var AddSchedulePage_1 = require("./pages/AddSchedulePage");
var AppointmentPage_1 = require("./pages/AppointmentPage");
var Appointments_1 = require("./pages/Appointments");
var Data_1 = require("./pages/Data");
var EditEmployee_1 = require("./pages/EditEmployee");
var Employees_1 = require("./pages/Employees");
var GroupPage_1 = require("./pages/GroupPage");
var Logout_1 = require("./pages/Logout");
var PatientDocumentsExplorerPage_1 = require("./pages/PatientDocumentsExplorerPage");
var PatientInformationPage_1 = require("./pages/PatientInformationPage");
var PatientPage_1 = require("./pages/PatientPage");
var Patients_1 = require("./pages/Patients");
var SchedulePage_1 = require("./pages/SchedulePage");
var Schedules_1 = require("./pages/Schedules");
var TelemedAdminPage_1 = require("./pages/TelemedAdminPage");
var rcm_1 = require("./rcm");
var nav_store_1 = require("./state/nav.store");
var EditInsurance_1 = require("./telemed/features/telemed-admin/EditInsurance");
var EditState_1 = require("./telemed/features/telemed-admin/EditState");
var PatientVisitDetailsPage_1 = require("./telemed/pages/PatientVisitDetailsPage");
var _a = import.meta.env, VITE_APP_SENTRY_DSN = _a.VITE_APP_SENTRY_DSN, VITE_APP_SENTRY_ENV = _a.VITE_APP_SENTRY_ENV;
(0, utils_1.setupSentry)({
    dsn: VITE_APP_SENTRY_DSN,
    environment: VITE_APP_SENTRY_ENV,
});
var CSSRoutingLazy = (0, react_1.lazy)(function () { return Promise.resolve().then(function () { return require('./features/css-module/routing/CSSRouting'); }); });
var TelemedTrackingBoardPageLazy = (0, react_1.lazy)(function () { return __awaiter(void 0, void 0, void 0, function () {
    var TrackingBoardPage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('./telemed/pages/TrackingBoardPage'); })];
            case 1:
                TrackingBoardPage = _a.sent();
                return [2 /*return*/, { default: TrackingBoardPage.TrackingBoardPage }];
        }
    });
}); });
var TelemedAppointmentPageLazy = (0, react_1.lazy)(function () { return __awaiter(void 0, void 0, void 0, function () {
    var TelemedAppointmentPage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('./telemed/pages/AppointmentPage'); })];
            case 1:
                TelemedAppointmentPage = _a.sent();
                return [2 /*return*/, { default: TelemedAppointmentPage.AppointmentPage }];
        }
    });
}); });
exports.INSURANCES_URL = '/telemed-admin/insurances';
exports.STATES_URL = '/telemed-admin/states';
var MUI_X_LICENSE_KEY = import.meta.env.VITE_APP_MUI_X_LICENSE_KEY;
if (MUI_X_LICENSE_KEY != null) {
    x_data_grid_pro_1.LicenseInfo.setLicenseKey(MUI_X_LICENSE_KEY);
}
exports.showEnvironmentBanner = import.meta.env.VITE_APP_ENV !== 'production';
function App() {
    var _a;
    (0, useAppClients_1.useApiClients)();
    var currentUser = (0, useEvolveUser_1.default)();
    var currentTab = (0, nav_store_1.useNavStore)(function (state) { return state.currentTab; }) || 'In Person';
    var _b = (0, react_1.useState)(false), isModalOpen = _b[0], setIsModalOpen = _b[1];
    var _c = (0, react_1.useState)(60), timeLeft = _c[0], setTimeLeft = _c[1];
    var handleOnIdle = function () {
        window.location.href = '/logout';
    };
    var handleOnPrompt = function () {
        setIsModalOpen(true);
        setTimeLeft(Math.ceil(getRemainingTime() / 1000));
    };
    var handleContinue = function () {
        setIsModalOpen(false);
        reset();
    };
    var handleEndSession = function () {
        setIsModalOpen(false);
        handleOnIdle();
    };
    var _d = (0, react_idle_timer_1.useIdleTimer)({
        timeout: 60 * 60 * 1000, // 60 minutes
        onIdle: handleOnIdle,
        onPrompt: handleOnPrompt,
        promptBeforeIdle: 1 * 60 * 1000, // 60 second warning
        debounce: 500,
    }), reset = _d.reset, getRemainingTime = _d.getRemainingTime;
    var roleUnknown = !currentUser || !currentUser.hasRole([utils_1.RoleType.Administrator, utils_1.RoleType.Staff, utils_1.RoleType.Manager, utils_1.RoleType.Provider]);
    return (<CustomThemeProvider_1.CustomThemeProvider>
      <featureFlags_1.FeatureFlagsProvider>
        <material_1.CssBaseline />
        <LogoutWarning_1.default modalOpen={isModalOpen} onEnd={handleEndSession} onContinue={handleContinue} timeoutInSeconds={timeLeft}/>
        {exports.showEnvironmentBanner && (<>
            <Banner_1.default text={"".concat((_a = import.meta.env.VITE_APP_ENV) === null || _a === void 0 ? void 0 : _a.toUpperCase(), " environment")} icon="warning" iconSize="medium" bgcolor="info.main" color="info.contrast"/>
          </>)}
        <react_router_dom_1.BrowserRouter>
          <react_router_dom_1.Routes>
            <react_router_dom_1.Route path="/in-person/:id/*" element={<ProtectedRoute_1.ProtectedRoute showWhenAuthenticated={<react_1.Suspense fallback={<LoadingScreen_1.LoadingScreen />}>
                      <CSSRoutingLazy />
                    </react_1.Suspense>}/>}/>
            <react_router_dom_1.Route element={<lab_1.TabContext value={currentTab}>
                  <Navbar_1.default />
                  <ProtectedRoute_1.ProtectedRoute showWhenAuthenticated={<>
                        <react_router_dom_1.Outlet />
                      </>}/>
                </lab_1.TabContext>}>
              {roleUnknown && (<>
                  <react_router_dom_1.Route path="/logout" element={<Logout_1.default />}/>
                  <react_router_dom_1.Route path="*" element={<LoadingScreen_1.LoadingScreen />}/>
                </>)}
              {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.hasRole([utils_1.RoleType.Administrator])) && (<>
                  <react_router_dom_1.Route path="/data" element={<Data_1.default />}/>
                </>)}
              {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.hasRole([utils_1.RoleType.Administrator, utils_1.RoleType.Manager])) && (<>
                  <react_router_dom_1.Route path="/" element={<react_router_dom_1.Navigate to="/visits"/>}/>
                  <react_router_dom_1.Route path="/logout" element={<Logout_1.default />}/>
                  <react_router_dom_1.Route path="/visits" element={<Appointments_1.default />}/>
                  <react_router_dom_1.Route path="/visits/add" element={<AddPatient_1.default />}/>
                  <react_router_dom_1.Route path="/visit/:id" element={<AppointmentPage_1.default />}/>
                  <react_router_dom_1.Route path="/schedules" element={<Schedules_1.default />}/>
                  <react_router_dom_1.Route path="/schedule/:schedule-type/add" element={<AddSchedulePage_1.default />}/>
                  <react_router_dom_1.Route path="/group/id/:group-id" element={<GroupPage_1.default />}/>
                  <react_router_dom_1.Route path="/schedule/id/:schedule-id" element={<SchedulePage_1.default />}/>
                  <react_router_dom_1.Route path="/schedule/new/:schedule-type/:owner-id" element={<SchedulePage_1.default />}/>
                  <react_router_dom_1.Route path="/employees" element={<Employees_1.default />}/>
                  <react_router_dom_1.Route path="/employees/add" element={<AddEmployeePage_1.default />}/>
                  <react_router_dom_1.Route path="/employee/:id" element={<EditEmployee_1.default />}/>
                  <react_router_dom_1.Route path="/patients" element={<Patients_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id" element={<PatientPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/info" element={<PatientInformationPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/details" element={<PatientVisitDetailsPage_1.PatientVisitDetails />}/>
                  <react_router_dom_1.Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/followup/add" element={<AddPatientFollowup_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup_1.default />}/>
                  <react_router_dom_1.Route path="/telemed-admin" element={<react_router_dom_1.Navigate to={exports.INSURANCES_URL}/>}/>
                  <react_router_dom_1.Route path={"".concat(exports.STATES_URL)} element={<TelemedAdminPage_1.TelemedAdminPage />}/>
                  <react_router_dom_1.Route path={"".concat(exports.STATES_URL, "/:state")} element={<EditState_1.default />}/>
                  <react_router_dom_1.Route path={exports.INSURANCES_URL} element={<TelemedAdminPage_1.TelemedAdminPage />}/>
                  <react_router_dom_1.Route path={"".concat(exports.INSURANCES_URL, "/:insurance")} element={<EditInsurance_1.default />}/>
                  {/** telemed */}
                  <react_router_dom_1.Route path="/telemed/appointments" element={<react_1.Suspense fallback={<LoadingScreen_1.LoadingScreen />}>
                        <TelemedTrackingBoardPageLazy />
                      </react_1.Suspense>}></react_router_dom_1.Route>
                  <react_router_dom_1.Route path="/telemed/appointments/:id" element={<react_1.Suspense fallback={<LoadingScreen_1.LoadingScreen />}>
                        <TelemedAppointmentPageLazy />
                      </react_1.Suspense>}/>
                  <react_router_dom_1.Route path="*" element={<react_router_dom_1.Navigate to={'/'}/>}/>
                </>)}
              {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.hasRole([utils_1.RoleType.Staff, utils_1.RoleType.Provider])) && (<>
                  <react_router_dom_1.Route path="/" element={<react_router_dom_1.Navigate to="/visits"/>}/>
                  <react_router_dom_1.Route path="/logout" element={<Logout_1.default />}/>
                  <react_router_dom_1.Route path="/visits" element={<Appointments_1.default />}/>
                  <react_router_dom_1.Route path="/visits/add" element={<AddPatient_1.default />}/>
                  <react_router_dom_1.Route path="/visit/:id" element={<AppointmentPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id" element={<PatientPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/info" element={<PatientInformationPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/details" element={<PatientVisitDetailsPage_1.PatientVisitDetails />}/>
                  <react_router_dom_1.Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/followup/add" element={<AddPatientFollowup_1.default />}/>
                  <react_router_dom_1.Route path="/patient/:id/followup/:encounterId" element={<PatientFollowup_1.default />}/>
                  <react_router_dom_1.Route path="/patients" element={<Patients_1.default />}/>

                  <react_router_dom_1.Route path="/rcm/claims" element={<rcm_1.Claims />}/>
                  <react_router_dom_1.Route path="/rcm/claims/:id" element={<rcm_1.Claim />}/>
                  {/** telemed */}
                  <react_router_dom_1.Route path="/telemed/appointments" element={<react_1.Suspense fallback={<LoadingScreen_1.LoadingScreen />}>
                        <TelemedTrackingBoardPageLazy />
                      </react_1.Suspense>}></react_router_dom_1.Route>
                  <react_router_dom_1.Route path="/telemed/appointments/:id" element={<react_1.Suspense fallback={<LoadingScreen_1.LoadingScreen />}>
                        <TelemedAppointmentPageLazy />
                      </react_1.Suspense>}/>
                  <react_router_dom_1.Route path="*" element={<react_router_dom_1.Navigate to={'/'}/>}/>
                </>)}
            </react_router_dom_1.Route>
            <react_router_dom_1.Route path="/test-error" element={<TestErrorPage_1.TestErrorPage />}/>
          </react_router_dom_1.Routes>
          <notistack_1.SnackbarProvider maxSnack={5} autoHideDuration={6000}/>
        </react_router_dom_1.BrowserRouter>
      </featureFlags_1.FeatureFlagsProvider>
    </CustomThemeProvider_1.CustomThemeProvider>);
}
exports.default = App;
//# sourceMappingURL=App.js.map
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.Header = void 0;
var ArrowBack_1 = require("@mui/icons-material/ArrowBack");
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../../../api/api");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var useAppClients_1 = require("../../../hooks/useAppClients");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var NavigationContext_1 = require("../context/NavigationContext");
var useAppointment_1 = require("../hooks/useAppointment");
var usePractitioner_1 = require("../hooks/usePractitioner");
var ChangeStatusDropdown_1 = require("./ChangeStatusDropdown");
var InternalNotes_1 = require("./InternalNotes");
var PrintVisitLabelButton_1 = require("./PrintVisitLabelButton");
var ProfileAvatar_1 = require("./ProfileAvatar");
var SwitchIntakeModeButton_1 = require("./SwitchIntakeModeButton");
var HeaderWrapper = (0, system_1.styled)(material_1.Box)(function (_a) {
    var theme = _a.theme;
    return ({
        backgroundColor: theme.palette.background.paper,
        padding: '8px 16px 8px 0',
        borderBottom: "1px solid ".concat(theme.palette.divider),
        boxShadow: '0px 2px 4px -1px #00000033',
    });
});
var PatientName = (0, system_1.styled)(material_1.Typography)(function (_a) {
    var theme = _a.theme;
    return (__assign(__assign({}, (theme === null || theme === void 0 ? void 0 : theme.typography).h4), { textAlign: 'left', fontWeight: 'bold', color: theme.palette.primary.dark, cursor: 'pointer' }));
});
var PatientMetadata = (0, system_1.styled)(material_1.Typography)(function (_a) {
    var theme = _a.theme;
    return ({
        fontSize: '14px',
        fontWeight: 400,
        color: theme.palette.text.secondary,
    });
});
var PatientInfoWrapper = (0, system_1.styled)(material_1.Box)({
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
});
var format = function (value, placeholder, keepPlaceholderIfValueFulfilled, emptyValuePlaceholder) {
    if (placeholder === void 0) { placeholder = ''; }
    if (keepPlaceholderIfValueFulfilled === void 0) { keepPlaceholderIfValueFulfilled = false; }
    if (emptyValuePlaceholder === void 0) { emptyValuePlaceholder = 'N/A'; }
    var prefix = !value || (keepPlaceholderIfValueFulfilled && value) ? "".concat(placeholder, ": ") : '';
    return prefix + (value || emptyValuePlaceholder);
};
var Header = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _j = (0, useAppointment_1.useAppointment)(appointmentID), _k = _j.resources, appointment = _k.appointment, patient = _k.patient, mappedData = _j.mappedData, telemedData = _j.visitState, refetch = _j.refetch;
    var encounter = telemedData.encounter;
    var chartData = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['chartData']).chartData;
    var encounterId = encounter === null || encounter === void 0 ? void 0 : encounter.id;
    var assignedIntakePerformerId = encounter ? (0, utils_1.getAdmitterPractitionerId)(encounter) : undefined;
    var assignedProviderId = encounter ? (0, utils_1.getAttendingPractitionerId)(encounter) : undefined;
    var patientName = format(mappedData === null || mappedData === void 0 ? void 0 : mappedData.patientName, 'Name');
    var pronouns = format(mappedData === null || mappedData === void 0 ? void 0 : mappedData.pronouns, 'Pronouns');
    var gender = format(mappedData === null || mappedData === void 0 ? void 0 : mappedData.gender, 'Gender');
    var language = format(mappedData === null || mappedData === void 0 ? void 0 : mappedData.preferredLanguage, 'Lang');
    var dob = format(mappedData === null || mappedData === void 0 ? void 0 : mappedData.DOB, 'DOB', true);
    var allergies = format((_c = (_b = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.allergies) === null || _a === void 0 ? void 0 : _a.filter(function (allergy) { return allergy.current === true; })) === null || _b === void 0 ? void 0 : _b.map(function (allergy) { return allergy.name; })) === null || _c === void 0 ? void 0 : _c.join(', '), 'Allergy', true, 'none');
    var reasonForVisit = format(appointment === null || appointment === void 0 ? void 0 : appointment.description, 'Reason for Visit');
    var userId = format(patient === null || patient === void 0 ? void 0 : patient.id);
    var _l = (0, react_1.useState)(undefined), _status = _l[0], setStatus = _l[1];
    var _m = (0, NavigationContext_1.useNavigationContext)(), interactionMode = _m.interactionMode, setInteractionMode = _m.setInteractionMode;
    var nextMode = interactionMode === 'intake' ? 'provider' : 'intake';
    var _o = (0, usePractitioner_1.usePractitionerActions)(encounter, 'start', utils_1.PRACTITIONER_CODINGS.Admitter), isUpdatingPractitionerForIntake = _o.isEncounterUpdatePending, handleUpdatePractitionerForIntake = _o.handleUpdatePractitioner;
    var _p = (0, usePractitioner_1.usePractitionerActions)(encounter, 'start', utils_1.PRACTITIONER_CODINGS.Attender), isUpdatingPractitionerForProvider = _p.isEncounterUpdatePending, handleUpdatePractitionerForProvider = _p.handleUpdatePractitioner;
    var isEncounterUpdatePending = isUpdatingPractitionerForIntake || isUpdatingPractitionerForProvider;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _q = (0, react_query_1.useQuery)(['get-employees', { oystehrZambda: oystehrZambda }], function () { return __awaiter(void 0, void 0, void 0, function () {
        var getEmployeesRes, providers, formattedProviders, nonProviders, formattedNonProviders;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehrZambda) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, api_1.getEmployees)(oystehrZambda)];
                case 1:
                    getEmployeesRes = _a.sent();
                    providers = getEmployeesRes.employees.filter(function (employee) { return employee.isProvider; });
                    formattedProviders = providers.map(function (prov) {
                        var id = prov.profile.split('/')[1];
                        return {
                            practitionerId: id,
                            name: "".concat(prov.firstName, " ").concat(prov.lastName),
                        };
                    });
                    nonProviders = getEmployeesRes.employees;
                    formattedNonProviders = nonProviders.map(function (prov) {
                        var id = prov.profile.split('/')[1];
                        return {
                            practitionerId: id,
                            name: "".concat(prov.firstName, " ").concat(prov.lastName),
                        };
                    });
                    return [2 /*return*/, {
                            providers: formattedProviders,
                            nonProviders: formattedNonProviders,
                        }];
                case 2: return [2 /*return*/, null];
            }
        });
    }); }), employees = _q.data, employeesIsFetching = _q.isFetching;
    if (employeesIsFetching) {
        return <HeaderSkeleton />;
    }
    if (!employees) {
        return <material_1.Box sx={{ padding: '16px' }}>There must be some employees registered to use charting.</material_1.Box>;
    }
    var handleUpdateIntakeAssignment = function (practitionerId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!appointmentID)
                        return [2 /*return*/];
                    return [4 /*yield*/, handleUpdatePractitionerForIntake(practitionerId)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, refetch()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.log(error_1.message);
                    (0, notistack_1.enqueueSnackbar)("An error occurred trying to update the intake assignment. Please try again.", {
                        variant: 'error',
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleUpdateProviderAssignment = function (practitionerId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!appointmentID)
                        return [2 /*return*/];
                    return [4 /*yield*/, handleUpdatePractitionerForProvider(practitionerId)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, refetch()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.log(error_2.message);
                    (0, notistack_1.enqueueSnackbar)("An error occurred trying to update the provider assignment. Please try again.", {
                        variant: 'error',
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleSwitchMode = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                if (!appointmentID)
                    return [2 /*return*/];
                setInteractionMode(nextMode, true);
            }
            catch (error) {
                console.log(error.message);
                (0, notistack_1.enqueueSnackbar)("An error occurred trying to switch to ".concat(nextMode, " mode. Please try again."), {
                    variant: 'error',
                });
            }
            return [2 /*return*/];
        });
    }); };
    return (<HeaderWrapper data-testid={data_test_ids_1.dataTestIds.cssHeader.container}>
      <material_1.Stack flexDirection="row">
        <material_1.Box sx={{ width: 70 }} display="flex" alignItems="center" justifyContent="center">
          <material_1.IconButton onClick={function () { return navigate('/visits'); }} sx={{ width: 40, height: 40 }}>
            <ArrowBack_1.default />
          </material_1.IconButton>
        </material_1.Box>
        <material_1.Grid container spacing={2} sx={{ padding: '0 18px 0 4px' }}>
          <material_1.Grid item xs={12}>
            <material_1.Grid container alignItems="center" justifyContent="space-between">
              <material_1.Grid item>
                <material_1.Grid container alignItems="center" spacing={2}>
                  <material_1.Grid item>
                    <ChangeStatusDropdown_1.ChangeStatusDropdown appointmentID={appointmentID} onStatusChange={setStatus}/>
                  </material_1.Grid>
                  <material_1.Grid item>
                    <PatientMetadata>
                      PID:{' '}
                      <u style={{ cursor: 'pointer' }} onClick={function () { return navigate("/patient/".concat(userId)); }}>
                        {userId}
                      </u>
                    </PatientMetadata>
                  </material_1.Grid>
                  <material_1.Grid item>
                    <material_1.Stack direction="row" spacing={2}>
                      <material_1.Stack direction="row" spacing={1} alignItems="center">
                        <PatientMetadata>Intake: </PatientMetadata>
                        <material_1.TextField select fullWidth data-testid={data_test_ids_1.dataTestIds.cssHeader.intakePractitionerInput} sx={{ minWidth: 120 }} variant="standard" value={assignedIntakePerformerId !== null && assignedIntakePerformerId !== void 0 ? assignedIntakePerformerId : ''} disabled={isUpdatingPractitionerForIntake} onChange={function (e) {
            void handleUpdateIntakeAssignment(e.target.value);
        }}>
                          {(_e = (_d = employees.nonProviders) === null || _d === void 0 ? void 0 : _d.sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); })) === null || _e === void 0 ? void 0 : _e.map(function (nonProvider) { return (<material_1.MenuItem key={nonProvider.practitionerId} value={nonProvider.practitionerId}>
                                {nonProvider.name}
                              </material_1.MenuItem>); })}
                        </material_1.TextField>
                      </material_1.Stack>

                      <material_1.Stack direction="row" spacing={1} alignItems="center">
                        <PatientMetadata>Provider: </PatientMetadata>
                        <material_1.TextField select fullWidth data-testid={data_test_ids_1.dataTestIds.cssHeader.providerPractitionerInput} sx={{ minWidth: 120 }} variant="standard" value={assignedProviderId !== null && assignedProviderId !== void 0 ? assignedProviderId : ''} disabled={isUpdatingPractitionerForProvider} onChange={function (e) {
            void handleUpdateProviderAssignment(e.target.value);
        }}>
                          {(_g = (_f = employees.providers) === null || _f === void 0 ? void 0 : _f.sort(function (a, b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); })) === null || _g === void 0 ? void 0 : _g.map(function (provider) { return (<material_1.MenuItem key={provider.practitionerId} value={provider.practitionerId}>
                                {provider.name}
                              </material_1.MenuItem>); })}
                        </material_1.TextField>
                      </material_1.Stack>
                    </material_1.Stack>
                  </material_1.Grid>
                </material_1.Grid>
              </material_1.Grid>
              <material_1.Grid item>
                <material_1.IconButton onClick={function () { return navigate('/visits'); }}>
                  <Close_1.default />
                </material_1.IconButton>
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Grid>
          <material_1.Grid item xs={12} sx={{ mt: -2 }}>
            <material_1.Grid container alignItems="center" spacing={2}>
              <material_1.Grid item>
                <ProfileAvatar_1.ProfileAvatar appointmentID={appointmentID}/>
              </material_1.Grid>
              <material_1.Grid item xs>
                <PatientInfoWrapper>
                  <PatientName data-testid={data_test_ids_1.dataTestIds.cssHeader.patientName} onClick={function () { return navigate("/patient/".concat(userId)); }}>
                    {patientName}
                  </PatientName>
                  <PrintVisitLabelButton_1.PrintVisitLabelButton encounterId={encounterId}/>
                  <PatientMetadata sx={{ fontWeight: 500 }}>{dob}</PatientMetadata> |
                  <PatientMetadata noWrap sx={{ fontWeight: ((_h = chartData === null || chartData === void 0 ? void 0 : chartData.allergies) === null || _h === void 0 ? void 0 : _h.length) ? 700 : 400, maxWidth: '250px' }}>
                    {allergies}
                  </PatientMetadata>
                </PatientInfoWrapper>
                <PatientInfoWrapper>
                  <PatientMetadata>{pronouns}</PatientMetadata> | <PatientMetadata>{gender}</PatientMetadata> |
                  <PatientMetadata>{language}</PatientMetadata> |<PatientMetadata>{reasonForVisit}</PatientMetadata>
                </PatientInfoWrapper>
              </material_1.Grid>
              <material_1.Grid item sx={{
            '@media (max-width: 1179px)': {
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
            },
        }}>
                <SwitchIntakeModeButton_1.SwitchIntakeModeButton isDisabled={!appointmentID || isEncounterUpdatePending} handleSwitchMode={handleSwitchMode} nextMode={nextMode}/>
                {encounterId ? <InternalNotes_1.InternalNotes encounterId={encounterId}/> : null}
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.Grid>
      </material_1.Stack>
    </HeaderWrapper>);
};
exports.Header = Header;
var HeaderSkeleton = function () {
    return (<HeaderWrapper>
      <material_1.Stack flexDirection="row">
        <material_1.Box sx={{ width: 70 }} display="flex" alignItems="center" justifyContent="center">
          <material_1.Skeleton sx={{ height: 40, width: 40 }} animation="wave" variant="circular"/>
        </material_1.Box>
        <material_1.Grid container spacing={2} sx={{ padding: '0 18px 0 4px' }}>
          <material_1.Grid item xs={12}>
            <material_1.Grid container alignItems="center" justifyContent="space-between">
              <material_1.Grid item>
                <material_1.Grid container alignItems="center" spacing={2}>
                  <material_1.Grid item>
                    <material_1.Skeleton sx={{ width: 120, height: 40 }} animation="wave"/>
                  </material_1.Grid>
                  <material_1.Grid item>
                    <material_1.Skeleton sx={{ width: 200 }} animation="wave" variant="text"/>
                  </material_1.Grid>
                  <material_1.Grid item>
                    <material_1.Stack direction="row" spacing={2}>
                      <material_1.Stack direction="row" spacing={1} alignItems="center">
                        <material_1.Skeleton sx={{ width: 60 }} animation="wave" variant="text"/>
                        <material_1.Skeleton sx={{ width: 120 }} animation="wave"/>
                      </material_1.Stack>

                      <material_1.Stack direction="row" spacing={1} alignItems="center">
                        <material_1.Skeleton sx={{ width: 60 }} animation="wave" variant="text"/>
                        <material_1.Skeleton sx={{ width: 120 }} animation="wave"/>
                      </material_1.Stack>
                    </material_1.Stack>
                  </material_1.Grid>
                </material_1.Grid>
              </material_1.Grid>
              <material_1.Grid item>
                <material_1.Skeleton sx={{ height: 40, width: 40 }} animation="wave" variant="circular"/>
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Grid>
          <material_1.Grid item xs={12} sx={{ mt: -2 }}>
            <material_1.Grid container alignItems="center" spacing={2}>
              <material_1.Grid item>
                <material_1.Skeleton sx={{ height: 50, width: 50 }} animation="wave" variant="circular"/>
              </material_1.Grid>
              <material_1.Grid item xs>
                <PatientInfoWrapper>
                  <material_1.Skeleton sx={{ width: 160 }} animation="wave" variant="text"/>
                  <material_1.Skeleton sx={{ width: 120 }} animation="wave" variant="text"/>
                </PatientInfoWrapper>
                <PatientInfoWrapper>
                  <material_1.Skeleton sx={{ width: 120 }} animation="wave" variant="text"/>
                  <material_1.Skeleton sx={{ width: 140 }} animation="wave" variant="text"/>
                </PatientInfoWrapper>
              </material_1.Grid>
              <material_1.Grid item sx={{
            '@media (max-width: 1179px)': {
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
            },
        }}>
                <material_1.Skeleton width={200} height={40} animation="wave"/>
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.Grid>
      </material_1.Stack>
    </HeaderWrapper>);
};
//# sourceMappingURL=Header.js.map
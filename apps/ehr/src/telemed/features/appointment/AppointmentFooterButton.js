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
exports.AppointmentFooterButton = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var components_1 = require("../../components");
var hooks_1 = require("../../hooks");
var useOystehrAPIClient_1 = require("../../hooks/useOystehrAPIClient");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var FooterButton = (0, material_1.styled)(lab_1.LoadingButton)(function (_a) {
    var theme = _a.theme;
    return ({
        textTransform: 'none',
        fontSize: '15px',
        fontWeight: 500,
        borderRadius: 20,
        backgroundColor: theme.palette.primary.light,
        '&:hover': { backgroundColor: (0, material_1.darken)(theme.palette.primary.light, 0.125) },
        '&.MuiLoadingButton-loading': {
            backgroundColor: (0, material_1.darken)(theme.palette.primary.light, 0.25),
        },
        '& .MuiLoadingButton-loadingIndicator': {
            color: (0, material_1.darken)(theme.palette.primary.contrastText, 0.25),
        },
    });
});
var AppointmentFooterButton = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'encounter',
        'appointment',
        'isAppointmentLoading',
    ]), encounter = _a.encounter, appointment = _a.appointment, isAppointmentLoading = _a.isAppointmentLoading;
    var user = (0, useEvolveUser_1.default)();
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var location = (0, react_router_dom_1.useLocation)();
    var theme = (0, material_1.useTheme)();
    var queryClient = (0, react_query_1.useQueryClient)();
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var changeTelemedAppointmentStatusEnum = (0, state_1.useChangeTelemedAppointmentStatusMutation)();
    var initTelemedSession = (0, state_1.useInitTelemedSessionMutation)();
    var getMeetingData = (0, state_1.useGetMeetingData)(getAccessTokenSilently, function (data) {
        state_1.useVideoCallStore.setState({ meetingData: data });
    }, function () {
        (0, notistack_1.enqueueSnackbar)('Error trying to connect to a patient.', {
            variant: 'error',
        });
    });
    var _b = (0, react_1.useState)(null), buttonType = _b[0], setButtonType = _b[1];
    var appointmentAccessibility = (0, hooks_1.useGetAppointmentAccessibility)();
    (0, react_1.useEffect)(function () {
        if (appointmentAccessibility.status !== utils_1.TelemedAppointmentStatusEnum.ready &&
            !appointmentAccessibility.isStatusEditable) {
            setButtonType(null);
        }
        else if (appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
            appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum.ready) {
            setButtonType('assignMe');
        }
        else if (appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
            appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum['pre-video']) {
            setButtonType('connectUnassign');
        }
        else if (appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
            appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum['on-video']) {
            setButtonType('reconnect');
        }
    }, [appointmentAccessibility]);
    var onAssignMe = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!apiClient || !(appointment === null || appointment === void 0 ? void 0 : appointment.id)) {
                        throw new Error('api client not defined or appointment id not provided');
                    }
                    return [4 /*yield*/, changeTelemedAppointmentStatusEnum.mutateAsync({ apiClient: apiClient, appointmentId: appointment.id, newStatus: utils_1.TelemedAppointmentStatusEnum['pre-video'] }, {})];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, queryClient.invalidateQueries({ queryKey: ['telemed-appointment'] })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var onConnect = (0, react_1.useCallback)(function () {
        if ((0, utils_1.mapStatusToTelemed)(encounter.status, appointment === null || appointment === void 0 ? void 0 : appointment.status) === utils_1.TelemedAppointmentStatusEnum['on-video']) {
            void getMeetingData.refetch({ throwOnError: true });
        }
        else {
            if (!apiClient || !user || !(appointment === null || appointment === void 0 ? void 0 : appointment.id)) {
                throw new Error('api client not defined or userId not provided');
            }
            initTelemedSession.mutate({ apiClient: apiClient, appointmentId: appointment.id, userId: user === null || user === void 0 ? void 0 : user.id }, {
                onSuccess: function (response) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        state_1.useVideoCallStore.setState({
                            meetingData: response.meetingData,
                        });
                        state_1.useAppointmentStore.setState({
                            encounter: __assign(__assign({}, encounter), { status: 'in-progress', statusHistory: (0, utils_2.updateEncounterStatusHistory)('in-progress', encounter.statusHistory) }),
                        });
                        return [2 /*return*/];
                    });
                }); },
                onError: function () {
                    (0, notistack_1.enqueueSnackbar)('Error trying to connect to a patient.', {
                        variant: 'error',
                    });
                },
            });
        }
    }, [apiClient, appointment === null || appointment === void 0 ? void 0 : appointment.id, appointment === null || appointment === void 0 ? void 0 : appointment.status, encounter, getMeetingData, initTelemedSession, user]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
            appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum['on-video']) {
            if ((_a = location.state) === null || _a === void 0 ? void 0 : _a.reconnect) {
                navigate(location.pathname, {});
                onConnect();
            }
        }
    }, [
        appointmentAccessibility.isCurrentUserHasAccessToAppointment,
        appointmentAccessibility.status,
        location,
        navigate,
        onConnect,
    ]);
    var onUnassign = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!apiClient || !(appointment === null || appointment === void 0 ? void 0 : appointment.id)) {
                        throw new Error('api client not defined or appointment id not provided');
                    }
                    return [4 /*yield*/, changeTelemedAppointmentStatusEnum.mutateAsync({ apiClient: apiClient, appointmentId: appointment.id, newStatus: utils_1.TelemedAppointmentStatusEnum.ready }, {})];
                case 1:
                    _a.sent();
                    navigate('/telemed/appointments');
                    return [2 /*return*/];
            }
        });
    }); };
    switch (buttonType) {
        case 'assignMe': {
            return (<components_1.ConfirmationDialog title="Do you want to assign this appointment?" response={onAssignMe} actionButtons={{
                    proceed: {
                        text: 'Assign me',
                    },
                    back: { text: 'Cancel' },
                }}>
          {function (showDialog) { return (<FooterButton loading={changeTelemedAppointmentStatusEnum.isLoading || isAppointmentLoading} onClick={showDialog} variant="contained" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonAssignMe}>
              Assign to me
            </FooterButton>); }}
        </components_1.ConfirmationDialog>);
        }
        case 'connectUnassign': {
            return (<material_1.Box sx={{ display: 'flex', gap: 1 }}>
          <components_1.ConfirmationDialog title="Do you want to connect to the patient?" description="This action will start the video call." response={onConnect} actionButtons={{
                    proceed: {
                        text: 'Connect to Patient',
                    },
                    back: { text: 'Cancel' },
                }}>
            {function (showDialog) { return (<FooterButton loading={initTelemedSession.isLoading || getMeetingData.isLoading} onClick={showDialog} variant="contained" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonConnectToPatient}>
                Connect to Patient
              </FooterButton>); }}
          </components_1.ConfirmationDialog>

          <components_1.ConfirmationDialog title="Do you want to unassign this appointment?" response={onUnassign} actionButtons={{
                    proceed: {
                        text: 'Unassign',
                        color: 'error',
                    },
                    back: { text: 'Cancel' },
                }}>
            {function (showDialog) { return (<FooterButton loading={changeTelemedAppointmentStatusEnum.isLoading} onClick={showDialog} variant="contained" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.footerButtonUnassign} sx={{
                        backgroundColor: theme.palette.error.main,
                        '&:hover': { backgroundColor: (0, material_1.darken)(theme.palette.error.main, 0.125) },
                        '&.MuiLoadingButton-loading': {
                            backgroundColor: (0, material_1.darken)(theme.palette.error.main, 0.25),
                        },
                        '& .MuiLoadingButton-loadingIndicator': {
                            color: (0, material_1.darken)(theme.palette.error.contrastText, 0.25),
                        },
                    }}>
                Unassign
              </FooterButton>); }}
          </components_1.ConfirmationDialog>
        </material_1.Box>);
        }
        case 'reconnect': {
            return (<FooterButton loading={initTelemedSession.isLoading || getMeetingData.isLoading} onClick={onConnect} variant="contained">
          Reconnect
        </FooterButton>);
        }
        default: {
            return null;
        }
    }
};
exports.AppointmentFooterButton = AppointmentFooterButton;
//# sourceMappingURL=AppointmentFooterButton.js.map
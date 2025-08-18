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
exports.TrackingBoardTableButton = void 0;
var lab_1 = require("@mui/lab");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var components_1 = require("../../components");
var hooks_1 = require("../../hooks");
var useOystehrAPIClient_1 = require("../../hooks/useOystehrAPIClient");
var state_1 = require("../../state");
var baseStyles = {
    borderRadius: 8,
    textTransform: 'none',
    fontSize: '15px',
    fontWeight: 500,
};
var TrackingBoardTableButton = function (props) {
    var appointment = props.appointment;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var mutation = (0, state_1.useChangeTelemedAppointmentStatusMutation)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var queryClient = (0, react_query_1.useQueryClient)();
    var goToAppointment = function (state) {
        navigate("/telemed/appointments/".concat(appointment.id), { state: state });
    };
    var changeStatus = function (newStatus, invalidate) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!apiClient) {
                        throw new Error('api client not defined');
                    }
                    return [4 /*yield*/, mutation.mutateAsync({ apiClient: apiClient, appointmentId: appointment.id, newStatus: newStatus }, {})];
                case 1:
                    _a.sent();
                    if (!invalidate) return [3 /*break*/, 3];
                    return [4 /*yield*/, queryClient.invalidateQueries({ queryKey: ['telemed-appointments'] })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var changeStatusAndGoTo = function (newStatus) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, changeStatus(newStatus)];
                case 1:
                    _a.sent();
                    goToAppointment();
                    return [2 /*return*/];
            }
        });
    }); };
    var type = (0, hooks_1.useTrackingBoardTableButtonType)({ appointment: appointment }).type;
    switch (type) {
        case 'viewContained':
        case 'viewOutlined': {
            return (<lab_1.LoadingButton onClick={function () { return goToAppointment(); }} variant={type === 'viewContained' ? 'contained' : 'outlined'} sx={baseStyles} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardViewButton(appointment.id)}>
          View
        </lab_1.LoadingButton>);
        }
        case 'assignMe': {
            return (<components_1.ConfirmationDialog title="Do you want to assign this appointment?" response={function () { return changeStatusAndGoTo(utils_1.TelemedAppointmentStatusEnum['pre-video']); }} actionButtons={{
                    proceed: {
                        text: 'Assign me',
                    },
                    back: { text: 'Cancel' },
                }}>
          {function (showDialog) { return (<lab_1.LoadingButton onClick={showDialog} loading={mutation.isLoading} variant="contained" sx={baseStyles} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardAssignButton}>
              Assign me
            </lab_1.LoadingButton>); }}
        </components_1.ConfirmationDialog>);
        }
        case 'unassign': {
            return (<components_1.ConfirmationDialog title="Do you want to unassign this appointment?" response={function () { return changeStatus(utils_1.TelemedAppointmentStatusEnum.ready, true); }} actionButtons={{
                    proceed: {
                        text: 'Unassign',
                        color: 'error',
                    },
                    back: { text: 'Cancel' },
                }}>
          {function (showDialog) { return (<lab_1.LoadingButton onClick={showDialog} loading={mutation.isLoading} color="error" variant="outlined" sx={baseStyles}>
              Unassign
            </lab_1.LoadingButton>); }}
        </components_1.ConfirmationDialog>);
        }
        case 'reconnect': {
            return (<lab_1.LoadingButton onClick={function () { return goToAppointment({ reconnect: true }); }} loading={mutation.isLoading} variant="contained" sx={baseStyles}>
          Reconnect
        </lab_1.LoadingButton>);
        }
        default: {
            return null;
        }
    }
};
exports.TrackingBoardTableButton = TrackingBoardTableButton;
//# sourceMappingURL=TrackingBoardTableButton.js.map
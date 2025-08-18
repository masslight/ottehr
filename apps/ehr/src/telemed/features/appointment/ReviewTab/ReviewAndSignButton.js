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
exports.ReviewAndSignButton = void 0;
var Check_1 = require("@mui/icons-material/Check");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../features/css-module/context/featureFlags");
var useAppointment_1 = require("../../../../features/css-module/hooks/useAppointment");
var usePractitioner_1 = require("../../../../features/css-module/hooks/usePractitioner");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var useOystehrAPIClient_1 = require("../../../hooks/useOystehrAPIClient");
var state_1 = require("../../../state");
var utils_2 = require("../../../utils");
var ReviewAndSignButton = function (_a) {
    var _b, _c, _d;
    var onSigned = _a.onSigned;
    var _e = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'patient',
        'appointment',
        'encounter',
        'chartData',
    ]), patient = _e.patient, appointment = _e.appointment, encounter = _e.encounter, chartData = _e.chartData;
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var _f = (0, state_1.useChangeTelemedAppointmentStatusMutation)(), changeTelemedAppointmentStatus = _f.mutateAsync, isChangeLoading = _f.isLoading;
    var _g = (0, state_1.useSignAppointmentMutation)(), signAppointment = _g.mutateAsync, isSignLoading = _g.isLoading;
    var _h = (0, react_1.useState)(false), openTooltip = _h[0], setOpenTooltip = _h[1];
    var refetch = (0, useAppointment_1.useAppointment)(appointment === null || appointment === void 0 ? void 0 : appointment.id).refetch;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var appointmentAccessibility = (0, hooks_1.useGetAppointmentAccessibility)();
    var primaryDiagnosis = ((chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) || []).find(function (item) { return item.isPrimary; });
    var medicalDecision = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _b === void 0 ? void 0 : _b.text;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    var patientInfoConfirmed = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.patientInfoConfirmed) === null || _c === void 0 ? void 0 : _c.value;
    var inHouseLabResultsPending = (_d = chartData === null || chartData === void 0 ? void 0 : chartData.inHouseLabResults) === null || _d === void 0 ? void 0 : _d.resultsPending;
    var patientName = (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).firstLastName;
    var isEncounterUpdatePending = (0, usePractitioner_1.usePractitionerActions)(encounter, 'end', utils_1.PRACTITIONER_CODINGS.Attender).isEncounterUpdatePending;
    var isLoading = isChangeLoading || isSignLoading || isEncounterUpdatePending;
    var inPersonStatus = (0, react_1.useMemo)(function () { return appointment && (0, utils_1.getVisitStatus)(appointment, encounter); }, [appointment, encounter]);
    var completed = (0, react_1.useMemo)(function () {
        if (css) {
            return inPersonStatus === 'completed';
        }
        return appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum.complete;
    }, [css, inPersonStatus, appointmentAccessibility.status]);
    var errorMessage = (0, react_1.useMemo)(function () {
        var messages = [];
        if (completed) {
            return messages;
        }
        if (css && inPersonStatus) {
            if (inPersonStatus === 'provider') {
                messages.push('You must discharge the patient before signing');
            }
            else if (inPersonStatus !== 'discharged') {
                messages.push('The appointment must be in the status of discharged');
            }
        }
        else {
            if (appointmentAccessibility.status !== utils_1.TelemedAppointmentStatusEnum.unsigned) {
                messages.push('You need to finish a video call with the patient');
            }
        }
        if (!primaryDiagnosis || !medicalDecision || !emCode) {
            messages.push('You need to fill in the missing data');
        }
        if (!patientInfoConfirmed) {
            messages.push('You need to confirm patient information');
        }
        if (inHouseLabResultsPending) {
            messages.push('In-House lab results pending');
        }
        return messages;
    }, [
        css,
        completed,
        inPersonStatus,
        primaryDiagnosis,
        medicalDecision,
        emCode,
        patientInfoConfirmed,
        appointmentAccessibility.status,
        inHouseLabResultsPending,
    ]);
    var handleCloseTooltip = function () {
        setOpenTooltip(false);
    };
    var handleOpenTooltip = function () {
        setOpenTooltip(true);
    };
    var handleSign = function () { return __awaiter(void 0, void 0, void 0, function () {
        var tz, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!apiClient || !(appointment === null || appointment === void 0 ? void 0 : appointment.id)) {
                        throw new Error('api client not defined or appointmentId not provided');
                    }
                    if (!css) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    tz = luxon_1.DateTime.now().zoneName;
                    return [4 /*yield*/, signAppointment({
                            apiClient: apiClient,
                            appointmentId: appointment.id,
                            timezone: tz,
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refetch()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.log(error_1.message);
                    return [3 /*break*/, 5];
                case 5: return [3 /*break*/, 8];
                case 6: return [4 /*yield*/, changeTelemedAppointmentStatus({
                        apiClient: apiClient,
                        appointmentId: appointment.id,
                        newStatus: utils_1.TelemedAppointmentStatusEnum.complete,
                    })];
                case 7:
                    _a.sent();
                    state_1.useAppointmentStore.setState({
                        encounter: __assign(__assign({}, encounter), { status: 'finished' }),
                        appointment: __assign(__assign({}, appointment), { status: 'fulfilled' }),
                    });
                    _a.label = 8;
                case 8:
                    if (onSigned) {
                        onSigned();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'end' }}>
      <material_1.Tooltip placement="top" open={openTooltip && errorMessage.length > 0} onClose={handleCloseTooltip} onOpen={handleOpenTooltip} title={errorMessage.map(function (message) { return (<material_1.Typography key={message}>{message}</material_1.Typography>); })}>
        <material_1.Box>
          <components_1.ConfirmationDialog title={"Review & Sign ".concat(patientName)} description="Are you sure you have reviewed the patient chart, performed the examination, defined the diagnoses, medical decision making and E&M code and are ready to sign this patient." response={handleSign} actionButtons={{
            proceed: {
                text: 'Sign',
            },
            back: { text: 'Cancel' },
        }}>
            {function (showDialog) { return (<RoundedButton_1.RoundedButton disabled={errorMessage.length > 0 || isLoading || completed || inPersonStatus === 'provider'} loading={isLoading} variant="contained" onClick={showDialog} startIcon={completed ? <Check_1.default color="inherit"/> : undefined} data-testid={data_test_ids_1.dataTestIds.progressNotePage.reviewAndSignButton}>
                {completed ? 'Signed' : 'Review & Sign'}
              </RoundedButton_1.RoundedButton>); }}
          </components_1.ConfirmationDialog>
        </material_1.Box>
      </material_1.Tooltip>
    </material_1.Box>);
};
exports.ReviewAndSignButton = ReviewAndSignButton;
//# sourceMappingURL=ReviewAndSignButton.js.map
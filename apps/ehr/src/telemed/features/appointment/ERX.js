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
exports.ERX = exports.ERXStatus = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var useChartData_1 = require("src/features/css-module/hooks/useChartData");
var useEvolveUser_1 = require("src/hooks/useEvolveUser");
var utils_1 = require("src/shared/utils");
var utils_2 = require("utils");
var create_vitals_search_config_helper_1 = require("utils/lib/helpers/visit-note/create-vitals-search-config.helper");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var ERXDialog_1 = require("./ERXDialog");
var ERXStatus;
(function (ERXStatus) {
    ERXStatus[ERXStatus["INITIAL"] = 0] = "INITIAL";
    ERXStatus[ERXStatus["LOADING"] = 1] = "LOADING";
    ERXStatus[ERXStatus["READY"] = 2] = "READY";
    ERXStatus[ERXStatus["ERROR"] = 3] = "ERROR";
})(ERXStatus || (exports.ERXStatus = ERXStatus = {}));
var ERX = function (_a) {
    var _b, _c;
    var _d, _e, _f, _g, _h;
    var onStatusChanged = _a.onStatusChanged, showDefaultAlert = _a.showDefaultAlert;
    var _j = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient', 'encounter']), patient = _j.patient, encounter = _j.encounter;
    var phoneNumber = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _d === void 0 ? void 0 : _d.find(function (telecom) { return telecom.system === 'phone'; })) === null || _e === void 0 ? void 0 : _e.value;
    var user = (0, useEvolveUser_1.default)();
    var practitioner = user === null || user === void 0 ? void 0 : user.profileResource;
    var _k = (0, react_1.useState)(showDefaultAlert ? 'If something goes wrong - please reload the page.' : null), alertMessage = _k[0], setAlertMessage = _k[1];
    var practitionerMissingFields = (0, react_1.useMemo)(function () {
        return practitioner ? (0, utils_1.getPractitionerMissingFields)(practitioner) : [];
    }, [practitioner]);
    var _l = (0, react_1.useState)(false), isTimeout = _l[0], setIsTimeout = _l[1];
    // Step 1: Get patient vitals
    var heightSearchConfig = (0, create_vitals_search_config_helper_1.createVitalsSearchConfig)(utils_2.VitalFieldNames.VitalHeight, 'patient', 1);
    var weightSearchConfig = (0, create_vitals_search_config_helper_1.createVitalsSearchConfig)(utils_2.VitalFieldNames.VitalWeight, 'patient', 1);
    var _m = (0, useChartData_1.useChartData)({
        encounterId: encounter.id,
        requestedFields: (_b = {}, _b[heightSearchConfig.fieldName] = heightSearchConfig.searchParams, _b),
        enabled: Boolean(encounter === null || encounter === void 0 ? void 0 : encounter.id),
    }), heightVitalObservationResponse = _m.chartData, isHeightLoading = _m.isLoading, isHeightFetched = _m.isFetched;
    var _o = (0, useChartData_1.useChartData)({
        encounterId: encounter.id,
        requestedFields: (_c = {}, _c[weightSearchConfig.fieldName] = weightSearchConfig.searchParams, _c),
        enabled: Boolean(encounter === null || encounter === void 0 ? void 0 : encounter.id),
    }), weightVitalObservationResponse = _o.chartData, isWeightLoading = _o.isLoading, isWeightFetched = _o.isFetched;
    var hasVitals = Boolean(((_f = heightVitalObservationResponse === null || heightVitalObservationResponse === void 0 ? void 0 : heightVitalObservationResponse.vitalsObservations) === null || _f === void 0 ? void 0 : _f.find(function (obs) { return obs.field === utils_2.VitalFieldNames.VitalHeight; })) &&
        ((_g = weightVitalObservationResponse === null || weightVitalObservationResponse === void 0 ? void 0 : weightVitalObservationResponse.vitalsObservations) === null || _g === void 0 ? void 0 : _g.find(function (obs) { return obs.field === utils_2.VitalFieldNames.VitalWeight; })));
    var isVitalsLoading = isHeightLoading || isWeightLoading;
    var isVitalsFetched = isHeightFetched && isWeightFetched;
    console.log(isVitalsLoading, hasVitals, practitionerMissingFields);
    // Step 2: Check practitioner enrollment
    var _p = (0, state_1.useCheckPractitionerEnrollment)({
        enabled: !isVitalsLoading && hasVitals && practitionerMissingFields.length === 0,
    }), practitionerEnrollmentStatus = _p.data, isPractitionerEnrollmentChecked = _p.isFetched, refetchPractitionerEnrollment = _p.refetch;
    (0, react_1.useEffect)(function () {
        if (practitionerMissingFields.length > 0) {
            onStatusChanged(ERXStatus.ERROR);
        }
    }, [onStatusChanged, practitionerMissingFields]);
    // Step 3: Sync patient
    var _q = (0, state_1.useSyncERXPatient)({
        patient: patient,
        enabled: Boolean((practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.confirmed) && hasVitals),
        onError: function (error) {
            var _a, _b;
            var errorMsg = 'Something went wrong while trying to sync patient to eRx';
            if (error.status === 400) {
                if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('phone')) {
                    errorMsg = "Patient has specified some wrong phone number: ".concat(phoneNumber, ". Please provide a real patient's phone number");
                }
                else if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('eRx service is not configured')) {
                    errorMsg = "eRx service is not configured. Please contact support.";
                }
                else {
                    errorMsg = "Something is wrong with patient data.";
                }
            }
            (0, notistack_1.enqueueSnackbar)(errorMsg, { variant: 'error' });
            onStatusChanged(ERXStatus.ERROR);
        },
    }), isPatientSynced = _q.isFetched, isPatientSyncing = _q.isLoading;
    // Step 4: Handle practitioner enrollment
    var _r = (0, state_1.useEnrollPractitionerToERX)({
        onError: function () {
            (0, notistack_1.enqueueSnackbar)('Enrolling practitioner to eRx failed', { variant: 'error' });
            onStatusChanged(ERXStatus.ERROR);
        },
    }), enrollPractitioner = _r.mutateAsync, isEnrollingPractitioner = _r.isLoading, isEnrollPractitionerError = _r.isError, isEnrollPractitionerSuccess = _r.isSuccess;
    var enrollPractitionerFn = (0, react_1.useCallback)(function (practitionerId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, enrollPractitioner(practitionerId)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, refetchPractitionerEnrollment()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('Error enrolling practitioner:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [enrollPractitioner, refetchPractitionerEnrollment]);
    // Step 5: Connect practitioner
    var _s = (0, state_1.useConnectPractitionerToERX)({ patientId: patient === null || patient === void 0 ? void 0 : patient.id, encounterId: encounter.id }), ssoLink = _s.data, isConnectingPractitioner = _s.isLoading, connectPractitioner = _s.mutateAsync, isPractitionerConnected = _s.isSuccess;
    var _t = (0, state_1.useConnectPractitionerToERX)({}), ssoLinkForEnrollment = _t.data, isConnectingPractitionerForConfirmation = _t.isLoading, connectPractitionerForConfirmation = _t.mutateAsync, isPractitionerConnectedForConfirmation = _t.isSuccess;
    var connectPractitionerFn = (0, react_1.useCallback)(function (mode) { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (mode === 'confirmation' ? connectPractitionerForConfirmation() : connectPractitioner())];
                case 1:
                    _a.sent();
                    if (mode === 'confirmation') {
                        setAlertMessage('When you complete the RxLink Agreement, please reload the page.');
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    (0, notistack_1.enqueueSnackbar)('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
                    console.error('Error trying to connect practitioner to eRx: ', error_2);
                    onStatusChanged(ERXStatus.ERROR);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, [connectPractitioner, connectPractitionerForConfirmation, onStatusChanged]);
    // Handle vitals validation
    (0, react_1.useEffect)(function () {
        if (isVitalsFetched && !hasVitals) {
            (0, notistack_1.enqueueSnackbar)("Patient doesn't have height or weight vital specified. Please specify it first on the `Vitals` tab", { variant: 'error' });
            onStatusChanged(ERXStatus.ERROR);
        }
    }, [isVitalsFetched, hasVitals, onStatusChanged]);
    // Handle practitioner enrollment
    (0, react_1.useEffect)(function () {
        var _a;
        if (isPractitionerEnrollmentChecked &&
            !(practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.registered) &&
            ((_a = user === null || user === void 0 ? void 0 : user.profileResource) === null || _a === void 0 ? void 0 : _a.id) &&
            !isEnrollingPractitioner &&
            !isEnrollPractitionerError &&
            !isEnrollPractitionerSuccess) {
            void enrollPractitionerFn(user.profileResource.id);
        }
    }, [
        isPractitionerEnrollmentChecked,
        practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.registered,
        (_h = user === null || user === void 0 ? void 0 : user.profileResource) === null || _h === void 0 ? void 0 : _h.id,
        enrollPractitionerFn,
        isEnrollingPractitioner,
        isEnrollPractitionerError,
        isEnrollPractitionerSuccess,
    ]);
    // Handle practitioner connection for eRx
    (0, react_1.useEffect)(function () {
        if ((practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.confirmed) &&
            isPatientSynced &&
            !isConnectingPractitioner &&
            !isPractitionerConnected) {
            void connectPractitionerFn('ordering');
        }
    }, [
        practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.confirmed,
        isPatientSynced,
        connectPractitionerFn,
        isConnectingPractitioner,
        isPractitionerConnected,
    ]);
    // Handle practitioner connection for confirmation
    (0, react_1.useEffect)(function () {
        if ((practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.registered) &&
            (!(practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.confirmed) || !(practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.identityVerified)) &&
            !isConnectingPractitionerForConfirmation &&
            !isPractitionerConnectedForConfirmation) {
            void connectPractitionerFn('confirmation');
        }
    }, [
        isPatientSynced,
        connectPractitionerFn,
        isConnectingPractitionerForConfirmation,
        isPractitionerConnectedForConfirmation,
        practitionerEnrollmentStatus,
    ]);
    // Handle ready state
    (0, react_1.useEffect)(function () {
        if (isPractitionerConnected) {
            onStatusChanged(ERXStatus.READY);
        }
    }, [onStatusChanged, isPractitionerConnected]);
    (0, react_1.useEffect)(function () {
        if (isTimeout && !isPractitionerConnected) {
            onStatusChanged(ERXStatus.ERROR);
        }
        else if (isHeightLoading ||
            isWeightLoading ||
            isPatientSyncing ||
            isEnrollingPractitioner ||
            isConnectingPractitioner ||
            isConnectingPractitionerForConfirmation) {
            onStatusChanged(ERXStatus.LOADING);
        }
    }, [
        isHeightLoading,
        isWeightLoading,
        isPatientSyncing,
        onStatusChanged,
        isEnrollingPractitioner,
        isConnectingPractitioner,
        isConnectingPractitionerForConfirmation,
        isTimeout,
        isPractitionerConnected,
    ]);
    // Timeout after 30 seconds
    (0, react_1.useEffect)(function () {
        setTimeout(function () {
            setIsTimeout(true);
        }, 30000);
    }, []);
    return (<>
      <material_1.Box>
        {(practitionerMissingFields.length > 0 && (<material_1.Alert severity="warning">
            To be able to prescribe please fill in the following fields in your profile:{' '}
            {practitionerMissingFields.join(', ')}.
          </material_1.Alert>)) ||
            (alertMessage && <material_1.Alert severity="info">{alertMessage}</material_1.Alert>)}
        {(ssoLink || ssoLinkForEnrollment) && <ERXDialog_1.ERXDialog ssoLink={ssoLink || ssoLinkForEnrollment || ''}/>}
      </material_1.Box>
    </>);
};
exports.ERX = ERX;
//# sourceMappingURL=ERX.js.map
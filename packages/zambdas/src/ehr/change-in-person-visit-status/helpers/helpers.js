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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeInPersonVisitStatusIfPossible = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var utils_1 = require("utils");
var changeInPersonVisitStatusIfPossible = function (oystehr, resourcesToUpdate, user, updatedStatus) { return __awaiter(void 0, void 0, void 0, function () {
    var updateInPersonAppointmentStatusOp, updateInPersonEncounterStatusOp, requests, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!((_a = resourcesToUpdate.encounter) === null || _a === void 0 ? void 0 : _a.id) || !((_b = resourcesToUpdate.appointment) === null || _b === void 0 ? void 0 : _b.id)) {
                    throw new Error('Invalid Encounter or Appointment ID');
                }
                return [4 /*yield*/, getUpdateInPersonAppointmentStatusOperation(resourcesToUpdate.appointment, resourcesToUpdate.encounter, oystehr, user, updatedStatus)];
            case 1:
                updateInPersonAppointmentStatusOp = _c.sent();
                return [4 /*yield*/, getUpdateInPersonEncounterStatusOperation(resourcesToUpdate.encounter, oystehr, updatedStatus)];
            case 2:
                updateInPersonEncounterStatusOp = _c.sent();
                console.log('Appointment Patch Ops:', JSON.stringify(updateInPersonAppointmentStatusOp, null, 2));
                console.log('Encounter Patch Ops:', JSON.stringify(updateInPersonEncounterStatusOp, null, 2));
                if (!(updateInPersonAppointmentStatusOp.length > 0 || updateInPersonEncounterStatusOp.length > 0)) return [3 /*break*/, 7];
                requests = __spreadArray(__spreadArray([], (updateInPersonEncounterStatusOp.length > 0
                    ? [
                        (0, utils_1.getPatchBinary)({
                            resourceType: 'Encounter',
                            resourceId: resourcesToUpdate.encounter.id,
                            patchOperations: updateInPersonEncounterStatusOp,
                        }),
                    ]
                    : []), true), (updateInPersonAppointmentStatusOp.length > 0
                    ? [
                        (0, utils_1.getPatchBinary)({
                            resourceType: 'Appointment',
                            resourceId: resourcesToUpdate.appointment.id,
                            patchOperations: updateInPersonAppointmentStatusOp,
                        }),
                    ]
                    : []), true);
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: requests,
                    })];
            case 4:
                _c.sent();
                return [3 /*break*/, 6];
            case 5:
                error_1 = _c.sent();
                (0, aws_serverless_1.captureException)(error_1, {
                    tags: {
                        encounterId: resourcesToUpdate.encounter.id,
                        appointmentId: resourcesToUpdate.appointment.id,
                        userId: user.id,
                        function: 'changeInPersonVisitStatusIfPossible',
                    },
                    contexts: {
                        extra: {
                            updatedStatus: updatedStatus,
                        },
                    },
                });
                console.error('Error in transaction request:', error_1);
                throw error_1;
            case 6: return [3 /*break*/, 8];
            case 7:
                console.log('No patch operations to perform');
                _c.label = 8;
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.changeInPersonVisitStatusIfPossible = changeInPersonVisitStatusIfPossible;
var getUpdateInPersonAppointmentStatusOperation = function (appointment, encounter, oystehr, user, updatedStatus) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentStatus, appointmentPatchOps, statusUpdatePatchValue, attenderParticipant;
    var _a;
    return __generator(this, function (_b) {
        if (!(appointment === null || appointment === void 0 ? void 0 : appointment.id) || !oystehr) {
            throw new Error('Missing required data');
        }
        appointmentStatus = utils_1.visitStatusToFhirAppointmentStatusMap[updatedStatus];
        if (!appointmentStatus) {
            console.warn("Unknown appointment status: ".concat(updatedStatus));
            return [2 /*return*/, []];
        }
        appointmentPatchOps = [{ op: 'replace', path: '/status', value: appointmentStatus }];
        if (appointment.status === 'cancelled') {
            appointmentPatchOps.push({ op: 'remove', path: '/cancelationReason' });
        }
        statusUpdatePatchValue = updatedStatus;
        if (updatedStatus === 'ready for provider') {
            attenderParticipant = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.find(function (p) { var _a; return (_a = p === null || p === void 0 ? void 0 : p.type) === null || _a === void 0 ? void 0 : _a.find(function (t) { var _a; return (_a = t === null || t === void 0 ? void 0 : t.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.code === 'ATND'; }); }); });
            // if the provider is already assigned then the visit is essentially skipping 'ready for provider' and being moved straight to provider
            // so the status update we want to record is for provider
            if (attenderParticipant)
                statusUpdatePatchValue = 'provider';
        }
        console.log('statusUpdatePatchValue', statusUpdatePatchValue);
        appointmentPatchOps.push.apply(appointmentPatchOps, (0, utils_1.getAppointmentMetaTagOpForStatusUpdate)(appointment, statusUpdatePatchValue, { user: user }));
        return [2 /*return*/, appointmentPatchOps];
    });
}); };
/**
 * Periods are handled based on the status determination logic:
 *
 * const STATUS_DEFINITIONS = {
 *   PENDING: {
 *     appointmentStatus: 'booked',
 *     encounterStatus: 'planned',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   },
 *   ARRIVED: {
 *     appointmentStatus: 'arrived',
 *     encounterStatus: 'arrived',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   },
 *   READY: {
 *     appointmentStatus: 'checked-in',
 *     encounterStatus: 'arrived',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   },
 *   INTAKE: {
 *     appointmentStatus: 'checked-in',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1} ← NO END!',
 *     atndParticipant: 'N/A'
 *   },
 *   READY_FOR_PROVIDER: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1, end: T2} ← CLOSED',
 *     atndParticipant: 'N/A'
 *   },
 *   PROVIDER: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1, end: T2}',
 *     atndParticipant: '{start: T3} ← NO END!'
 *   },
 *   DISCHARGED: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'in-progress',
 *     admParticipant: '{start: T1, end: T2}',
 *     atndParticipant: '{start: T3, end: T4} ← CLOSED'
 *   },
 *   COMPLETED: {
 *     appointmentStatus: 'fulfilled',
 *     encounterStatus: 'finished',
 *     admParticipant: '{start: T1, end: T2}',
 *     atndParticipant: '{start: T3, end: T4}'
 *   },
 *   CANCELLED: {
 *     appointmentStatus: 'cancelled',
 *     encounterStatus: 'cancelled',
 *     admParticipant: 'depends',
 *     atndParticipant: 'depends'
 *   },
 *   NO_SHOW: {
 *     appointmentStatus: 'noshow',
 *     encounterStatus: 'cancelled',
 *     admParticipant: 'N/A',
 *     atndParticipant: 'N/A'
 *   }
 * };
 */
var getUpdateInPersonEncounterStatusOperation = function (encounter, oystehr, updatedStatus) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterStatus, encounterPatchOps, dateNow, encounterStatusHistoryUpdate;
    return __generator(this, function (_a) {
        if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id) || !oystehr) {
            throw new Error('Missing required data');
        }
        encounterStatus = utils_1.visitStatusToFhirEncounterStatusMap[updatedStatus];
        if (!encounterStatus) {
            console.warn("Unknown encounter status: ".concat(updatedStatus));
            return [2 /*return*/, []];
        }
        encounterPatchOps = [{ op: 'replace', path: '/status', value: encounterStatus }];
        dateNow = new Date().toISOString();
        if (updatedStatus === 'pending' ||
            updatedStatus === 'arrived' ||
            updatedStatus === 'ready' ||
            updatedStatus === 'cancelled' ||
            updatedStatus === 'no show') {
            updateAdmitterPeriod(encounterPatchOps, { encounter: encounter, deleteStartTime: true, deleteEndTime: true });
            updateAttenderPeriod(encounterPatchOps, { encounter: encounter, deleteStartTime: true, deleteEndTime: true });
        }
        else if (updatedStatus === 'intake') {
            updateAdmitterPeriod(encounterPatchOps, {
                encounter: encounter,
                startTime: dateNow,
                overrideStartTimeIfExists: true,
                deleteEndTime: true,
            });
            updateAttenderPeriod(encounterPatchOps, { encounter: encounter, deleteStartTime: true, deleteEndTime: true });
        }
        else if (updatedStatus === 'ready for provider') {
            updateAdmitterPeriod(encounterPatchOps, {
                encounter: encounter,
                startTime: dateNow,
                overrideStartTimeIfExists: false,
                endTime: dateNow,
                overrideEndTimeIfExists: true,
            });
            updateAttenderPeriod(encounterPatchOps, { encounter: encounter, deleteStartTime: true, deleteEndTime: true });
        }
        else if (updatedStatus === 'provider') {
            updateAdmitterPeriod(encounterPatchOps, {
                encounter: encounter,
                startTime: dateNow,
                overrideStartTimeIfExists: false,
                endTime: dateNow,
                overrideEndTimeIfExists: false,
            });
            updateAttenderPeriod(encounterPatchOps, {
                encounter: encounter,
                startTime: dateNow,
                overrideStartTimeIfExists: true,
                deleteEndTime: true,
            });
        }
        else if (updatedStatus === 'discharged' ||
            updatedStatus === 'awaiting supervisor approval' ||
            updatedStatus === 'completed') {
            updateAdmitterPeriod(encounterPatchOps, {
                encounter: encounter,
                startTime: dateNow,
                overrideStartTimeIfExists: false,
                endTime: dateNow,
                overrideEndTimeIfExists: false,
            });
            updateAttenderPeriod(encounterPatchOps, {
                encounter: encounter,
                startTime: dateNow,
                overrideStartTimeIfExists: false,
                endTime: dateNow,
                overrideEndTimeIfExists: true,
            });
        }
        encounterStatusHistoryUpdate = (0, utils_1.getEncounterStatusHistoryUpdateOp)(encounter, encounterStatus, updatedStatus);
        encounterPatchOps.push(encounterStatusHistoryUpdate);
        return [2 /*return*/, encounterPatchOps];
    });
}); };
var updateAdmitterPeriod = function (operations, _a) {
    var encounter = _a.encounter, endTime = _a.endTime, startTime = _a.startTime, overrideEndTimeIfExists = _a.overrideEndTimeIfExists, overrideStartTimeIfExists = _a.overrideStartTimeIfExists, deleteEndTime = _a.deleteEndTime, deleteStartTime = _a.deleteStartTime;
    var participantIndex = findAdmitterIndex(encounter);
    if (participantIndex >= 0) {
        operations.push.apply(operations, updateParticipantPeriod({
            encounter: encounter,
            endTime: endTime,
            startTime: startTime,
            participantIndex: participantIndex,
            overrideEndTimeIfExists: overrideEndTimeIfExists,
            overrideStartTimeIfExists: overrideStartTimeIfExists,
            deleteEndTime: deleteEndTime,
            deleteStartTime: deleteStartTime,
        }));
    }
};
var updateAttenderPeriod = function (operations, _a) {
    var encounter = _a.encounter, endTime = _a.endTime, startTime = _a.startTime, overrideEndTimeIfExists = _a.overrideEndTimeIfExists, overrideStartTimeIfExists = _a.overrideStartTimeIfExists, deleteEndTime = _a.deleteEndTime, deleteStartTime = _a.deleteStartTime;
    var participantIndex = findAttenderIndex(encounter);
    if (participantIndex >= 0) {
        operations.push.apply(operations, updateParticipantPeriod({
            encounter: encounter,
            endTime: endTime,
            startTime: startTime,
            participantIndex: participantIndex,
            overrideEndTimeIfExists: overrideEndTimeIfExists,
            overrideStartTimeIfExists: overrideStartTimeIfExists,
            deleteEndTime: deleteEndTime,
            deleteStartTime: deleteStartTime,
        }));
    }
};
var updateParticipantPeriod = function (_a) {
    var _b, _c;
    var encounter = _a.encounter, endTime = _a.endTime, startTime = _a.startTime, _d = _a.deleteEndTime, deleteEndTime = _d === void 0 ? false : _d, _e = _a.deleteStartTime, deleteStartTime = _e === void 0 ? false : _e, _f = _a.overrideEndTimeIfExists, overrideEndTimeIfExists = _f === void 0 ? false : _f, _g = _a.overrideStartTimeIfExists, overrideStartTimeIfExists = _g === void 0 ? false : _g, participantIndex = _a.participantIndex;
    var participantPeriod = (_c = (_b = encounter.participant) === null || _b === void 0 ? void 0 : _b[participantIndex]) === null || _c === void 0 ? void 0 : _c.period;
    var canUpdateStart = Boolean(startTime && (!(participantPeriod === null || participantPeriod === void 0 ? void 0 : participantPeriod.start) || overrideStartTimeIfExists));
    var canUpdateEnd = Boolean(endTime && (!(participantPeriod === null || participantPeriod === void 0 ? void 0 : participantPeriod.end) || overrideEndTimeIfExists));
    var canDeleteEnd = Boolean(deleteEndTime && (participantPeriod === null || participantPeriod === void 0 ? void 0 : participantPeriod.end));
    var canDeleteStart = Boolean(deleteStartTime && (participantPeriod === null || participantPeriod === void 0 ? void 0 : participantPeriod.start));
    if (!canUpdateStart && !canUpdateEnd && !canDeleteEnd && !canDeleteStart) {
        return [];
    }
    var updatedPeriod = __assign({}, participantPeriod);
    if (canUpdateStart) {
        updatedPeriod.start = startTime;
    }
    if (canUpdateEnd) {
        updatedPeriod.end = endTime;
    }
    if (canDeleteEnd) {
        delete updatedPeriod.end;
    }
    if (canDeleteStart) {
        delete updatedPeriod.start;
    }
    if (Object.keys(updatedPeriod).length === 0) {
        return [
            {
                op: 'remove',
                path: "/participant/".concat(participantIndex, "/period"),
            },
        ];
    }
    return [
        {
            op: 'add',
            path: "/participant/".concat(participantIndex, "/period"),
            value: updatedPeriod,
        },
    ];
};
var findAdmitterIndex = function (encounter) {
    var _a;
    var index = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.findIndex(function (p) { var _a; return (_a = p === null || p === void 0 ? void 0 : p.type) === null || _a === void 0 ? void 0 : _a.some(function (t) { var _a; return (_a = t === null || t === void 0 ? void 0 : t.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding.code === utils_1.PRACTITIONER_CODINGS.Admitter[0].code; }); }); });
    return typeof index === 'number' ? index : -1;
};
var findAttenderIndex = function (encounter) {
    var _a;
    var index = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.findIndex(function (p) { var _a; return (_a = p === null || p === void 0 ? void 0 : p.type) === null || _a === void 0 ? void 0 : _a.some(function (t) { var _a; return (_a = t === null || t === void 0 ? void 0 : t.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding.code === utils_1.PRACTITIONER_CODINGS.Attender[0].code; }); }); });
    return typeof index === 'number' ? index : -1;
};

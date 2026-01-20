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
exports.performEffect = exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var createProvenanceForEncounter_1 = require("../../shared/createProvenanceForEncounter");
var createPublishExcuseNotesOps_1 = require("../../shared/createPublishExcuseNotesOps");
var helpers_1 = require("../../shared/helpers");
var get_video_resources_1 = require("../../shared/pdf/visit-details-pdf/get-video-resources");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'sign-appointment';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, oystehrCurrentUser, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                oystehrCurrentUser = (0, helpers_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                console.log('Created Oystehr client');
                return [4 /*yield*/, (0, exports.performEffect)(oystehr, oystehrCurrentUser, validatedParameters)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error('Stringified error: ' + JSON.stringify(error_1));
                console.error('Error: ' + error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (oystehr, oystehrCurrentUser, params) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, encounterId, timezone, supervisorApprovalEnabled, visitResources, encounter, patient, appointment, isFollowup, currentStatus, followupPDFTaskResource, visitNoteTaskPromise, taskCreationResults, tasks, sendClaimTaskResource, shouldCreateVisitNoteTask, extensionIndex, awaitingSupervisorApproval, visitNoteTaskResource, taskCreationResults;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                appointmentId = params.appointmentId, encounterId = params.encounterId, timezone = params.timezone, supervisorApprovalEnabled = params.supervisorApprovalEnabled;
                return [4 /*yield*/, (0, get_video_resources_1.getAppointmentAndRelatedResources)(oystehr, appointmentId, true, encounterId)];
            case 1:
                visitResources = _c.sent();
                if (!visitResources) {
                    {
                        throw new Error("Visit resources are not properly defined for appointment ".concat(appointmentId));
                    }
                }
                if (timezone) {
                    // if the timezone is provided, it will be taken as the tz to use here rather than the location's schedule
                    // this allows the provider to specify their working location in the case of virtual encounters
                    visitResources.timezone = timezone;
                }
                encounter = visitResources.encounter, patient = visitResources.patient, appointment = visitResources.appointment;
                isFollowup = (0, utils_1.isFollowupEncounter)(encounter);
                if (((_a = encounter === null || encounter === void 0 ? void 0 : encounter.subject) === null || _a === void 0 ? void 0 : _a.reference) === undefined) {
                    throw new Error("No subject reference defined for encounter ".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id));
                }
                if (!patient) {
                    throw new Error("No patient found for encounter ".concat(encounter.id));
                }
                console.log("appointment and encounter statuses: ".concat(appointment.status, ", ").concat(encounter.status));
                currentStatus = (0, utils_1.getInPersonVisitStatus)(appointment, encounter);
                if (!isFollowup) return [3 /*break*/, 5];
                if (!currentStatus) return [3 /*break*/, 3];
                return [4 /*yield*/, changeFollowupEncounterStatusToCompleted(oystehr, oystehrCurrentUser, visitResources, supervisorApprovalEnabled)];
            case 2:
                _c.sent();
                _c.label = 3;
            case 3:
                console.debug("Follow-up encounter status has been changed.");
                if (appointment.id === undefined) {
                    throw new Error('Appointment ID is not defined');
                }
                followupPDFTaskResource = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.visitNotePDFAndEmail, appointment.id, encounterId);
                visitNoteTaskPromise = oystehr.fhir.create(followupPDFTaskResource);
                return [4 /*yield*/, Promise.all([visitNoteTaskPromise])];
            case 4:
                taskCreationResults = _c.sent();
                console.log('Follow-up task creation results ', taskCreationResults);
                return [3 /*break*/, 9];
            case 5:
                if (!currentStatus) return [3 /*break*/, 7];
                return [4 /*yield*/, changeStatusToCompleted(oystehr, oystehrCurrentUser, visitResources, supervisorApprovalEnabled)];
            case 6:
                _c.sent();
                _c.label = 7;
            case 7:
                console.debug("Status has been changed.");
                if (appointment.id === undefined) {
                    throw new Error('Appointment ID is not defined');
                }
                tasks = [];
                sendClaimTaskResource = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.sendClaim, appointment.id);
                tasks.push(oystehr.fhir.create(sendClaimTaskResource));
                shouldCreateVisitNoteTask = true;
                if (supervisorApprovalEnabled) {
                    extensionIndex = (0, utils_1.findExtensionIndex)(visitResources.encounter.extension || [], 'awaiting-supervisor-approval');
                    if (extensionIndex != null && extensionIndex >= 0) {
                        awaitingSupervisorApproval = (0, utils_1.extractExtensionValue)((_b = visitResources.encounter.extension) === null || _b === void 0 ? void 0 : _b[extensionIndex]);
                        if (awaitingSupervisorApproval) {
                            shouldCreateVisitNoteTask = false;
                        }
                    }
                }
                if (shouldCreateVisitNoteTask) {
                    visitNoteTaskResource = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.visitNotePDFAndEmail, appointment.id);
                    tasks.push(oystehr.fhir.create(visitNoteTaskResource));
                }
                return [4 /*yield*/, Promise.all(tasks)];
            case 8:
                taskCreationResults = _c.sent();
                console.log('Task creation results ', taskCreationResults);
                _c.label = 9;
            case 9: return [2 /*return*/, {
                    message: 'Appointment status successfully changed.',
                }];
        }
    });
}); };
exports.performEffect = performEffect;
var changeFollowupEncounterStatusToCompleted = function (oystehr, oystehrCurrentUser, resourcesToUpdate, supervisorApprovalEnabled) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterStatus, encounterPatchOps, user, encounterStatusHistoryUpdate, provenanceCreate, extensionIndex, awaitingSupervisorApproval, documentPatch, encounterPatch;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!resourcesToUpdate.encounter || !resourcesToUpdate.encounter.id) {
                    throw new Error('Encounter is not defined');
                }
                encounterStatus = utils_1.visitStatusToFhirEncounterStatusMap['completed'];
                encounterPatchOps = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: encounterStatus,
                    },
                ];
                return [4 /*yield*/, oystehrCurrentUser.user.me()];
            case 1:
                user = _c.sent();
                encounterStatusHistoryUpdate = (0, utils_1.getEncounterStatusHistoryUpdateOp)(resourcesToUpdate.encounter, encounterStatus, 'completed');
                encounterPatchOps.push(encounterStatusHistoryUpdate);
                if (supervisorApprovalEnabled) {
                    extensionIndex = (0, utils_1.findExtensionIndex)(resourcesToUpdate.encounter.extension || [], 'awaiting-supervisor-approval');
                    if (extensionIndex != null && extensionIndex >= 0) {
                        awaitingSupervisorApproval = (0, utils_1.extractExtensionValue)((_a = resourcesToUpdate.encounter.extension) === null || _a === void 0 ? void 0 : _a[extensionIndex]);
                        if (awaitingSupervisorApproval) {
                            encounterPatchOps.push({
                                op: 'replace',
                                path: "/extension/".concat(extensionIndex, "/valueBoolean"),
                                value: false,
                            });
                            provenanceCreate = {
                                method: 'POST',
                                url: '/Provenance',
                                resource: (0, createProvenanceForEncounter_1.createProvenanceForEncounter)(resourcesToUpdate.encounter.id, user.profile.split('/')[1], 'verifier'),
                            };
                        }
                    }
                }
                documentPatch = (0, createPublishExcuseNotesOps_1.createPublishExcuseNotesOps)((_b = resourcesToUpdate === null || resourcesToUpdate === void 0 ? void 0 : resourcesToUpdate.documentReferences) !== null && _b !== void 0 ? _b : []);
                encounterPatch = (0, utils_1.getPatchBinary)({
                    resourceType: 'Encounter',
                    resourceId: resourcesToUpdate.encounter.id,
                    patchOperations: encounterPatchOps,
                });
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: __spreadArray(__spreadArray([
                            encounterPatch
                        ], (provenanceCreate ? [provenanceCreate] : []), true), documentPatch, true),
                    })];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); };
var changeStatusToCompleted = function (oystehr, oystehrCurrentUser, resourcesToUpdate, supervisorApprovalEnabled) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentStatus, encounterStatus, patchOps, user, encounterPatchOps, encounterStatusHistoryUpdate, provenanceCreate, extensionIndex, awaitingSupervisorApproval, documentPatch, appointmentPatch, encounterPatch;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!resourcesToUpdate.appointment || !resourcesToUpdate.appointment.id) {
                    throw new Error('Appointment is not defined');
                }
                if (!resourcesToUpdate.encounter || !resourcesToUpdate.encounter.id) {
                    throw new Error('Encounter is not defined');
                }
                appointmentStatus = utils_1.visitStatusToFhirAppointmentStatusMap['completed'];
                encounterStatus = utils_1.visitStatusToFhirEncounterStatusMap['completed'];
                patchOps = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: appointmentStatus,
                    },
                ];
                return [4 /*yield*/, oystehrCurrentUser.user.me()];
            case 1:
                user = _c.sent();
                patchOps.push.apply(patchOps, (0, utils_1.getAppointmentMetaTagOpForStatusUpdate)(resourcesToUpdate.appointment, 'completed', { user: user }));
                // Add locked meta tag when appointment is signed/completed
                patchOps.push.apply(patchOps, (0, utils_1.getAppointmentLockMetaTagOperations)(resourcesToUpdate.appointment, true));
                encounterPatchOps = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: encounterStatus,
                    },
                ];
                encounterStatusHistoryUpdate = (0, utils_1.getEncounterStatusHistoryUpdateOp)(resourcesToUpdate.encounter, encounterStatus, 'completed');
                encounterPatchOps.push(encounterStatusHistoryUpdate);
                if (supervisorApprovalEnabled) {
                    extensionIndex = (0, utils_1.findExtensionIndex)(resourcesToUpdate.encounter.extension || [], 'awaiting-supervisor-approval');
                    if (extensionIndex != null && extensionIndex >= 0) {
                        awaitingSupervisorApproval = (0, utils_1.extractExtensionValue)((_a = resourcesToUpdate.encounter.extension) === null || _a === void 0 ? void 0 : _a[extensionIndex]);
                        if (awaitingSupervisorApproval) {
                            encounterPatchOps.push({
                                op: 'replace',
                                path: "/extension/".concat(extensionIndex, "/valueBoolean"),
                                value: false,
                            });
                            provenanceCreate = {
                                method: 'POST',
                                url: '/Provenance',
                                resource: (0, createProvenanceForEncounter_1.createProvenanceForEncounter)(resourcesToUpdate.encounter.id, user.profile.split('/')[1], 'verifier'),
                            };
                        }
                    }
                }
                documentPatch = (0, createPublishExcuseNotesOps_1.createPublishExcuseNotesOps)((_b = resourcesToUpdate === null || resourcesToUpdate === void 0 ? void 0 : resourcesToUpdate.documentReferences) !== null && _b !== void 0 ? _b : []);
                appointmentPatch = (0, utils_1.getPatchBinary)({
                    resourceType: 'Appointment',
                    resourceId: resourcesToUpdate.appointment.id,
                    patchOperations: patchOps,
                });
                encounterPatch = (0, utils_1.getPatchBinary)({
                    resourceType: 'Encounter',
                    resourceId: resourcesToUpdate.encounter.id,
                    patchOperations: encounterPatchOps,
                });
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: __spreadArray(__spreadArray([
                            appointmentPatch,
                            encounterPatch
                        ], (provenanceCreate ? [provenanceCreate] : []), true), documentPatch, true),
                    })];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); };

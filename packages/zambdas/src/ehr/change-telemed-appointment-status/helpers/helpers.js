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
exports.changeStatusIfPossible = void 0;
exports.makeAppointmentChargeItem = makeAppointmentChargeItem;
exports.makeReceiptPdfDocumentReference = makeReceiptPdfDocumentReference;
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var createPublishExcuseNotesOps_1 = require("../../../shared/createPublishExcuseNotesOps");
var fhir_res_patch_operations_1 = require("./fhir-res-patch-operations");
var changeStatusIfPossible = function (oystehr, resourcesToUpdate, currentStatus, newStatus, practitionerId, ENVIRONMENT) { return __awaiter(void 0, void 0, void 0, function () {
    var patient, appointment, appointmentPatchOp, encounterPatchOp, smsToSend, patchOperationsBinaries, addPractitionerOp, removePractitionerOr, updateNotesOps, promises;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                patient = resourcesToUpdate.patient, appointment = resourcesToUpdate.appointment;
                appointmentPatchOp = [];
                encounterPatchOp = [];
                smsToSend = undefined;
                patchOperationsBinaries = [];
                if (!(currentStatus === 'ready' && newStatus === 'pre-video')) return [3 /*break*/, 2];
                encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
                return [4 /*yield*/, getAddPractitionerToEncounterOperation(resourcesToUpdate.encounter, practitionerId)];
            case 1:
                addPractitionerOp = _b.sent();
                if (addPractitionerOp) {
                    encounterPatchOp.push(addPractitionerOp);
                }
                smsToSend = 'Thank you for waiting. The clinician will see you within around 5 minutes.';
                return [3 /*break*/, 3];
            case 2:
                if (currentStatus === 'pre-video' && newStatus === 'ready') {
                    encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
                    removePractitionerOr = getRemovePractitionerFromEncounterOperation(resourcesToUpdate.encounter, practitionerId);
                    if (removePractitionerOr) {
                        encounterPatchOp.push(removePractitionerOr);
                    }
                    smsToSend =
                        'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
                }
                else if (currentStatus === 'on-video' && newStatus === 'unsigned') {
                    encounterPatchOp = defaultEncounterOperations(newStatus, resourcesToUpdate);
                    encounterPatchOp.push((0, fhir_res_patch_operations_1.addPeriodEndOp)(now()));
                    if (appointment.id)
                        smsToSend = "Thanks for visiting. Tap https://feedbackURL/220116034976149?VisitID=".concat(appointment.id, " to let us know how it went.");
                }
                else if (currentStatus === 'unsigned' && newStatus === 'complete') {
                    encounterPatchOp = encounterOperationsWrapper(newStatus, resourcesToUpdate, function (_newEncounterStatus, statusHistoryLength) {
                        var statusHistory = resourcesToUpdate.encounter.statusHistory || [];
                        if (statusHistoryLength >= 2 &&
                            statusHistory[statusHistoryLength - 1].status === 'finished' &&
                            statusHistory[statusHistoryLength - 2].status === 'finished') {
                            return mergeUnsignedStatusesTimesOp(statusHistory);
                        }
                        else {
                            return [(0, fhir_res_patch_operations_1.changeStatusRecordPeriodValueOp)(statusHistoryLength - 1, 'end', now())];
                        }
                    });
                    appointmentPatchOp.push({ path: '/end', value: now(), op: 'add' });
                    updateNotesOps = (0, createPublishExcuseNotesOps_1.createPublishExcuseNotesOps)((_a = resourcesToUpdate.documentReferences) !== null && _a !== void 0 ? _a : []);
                    if (updateNotesOps.length > 0) {
                        patchOperationsBinaries.push.apply(patchOperationsBinaries, updateNotesOps);
                    }
                    appointmentPatchOp = [(0, fhir_res_patch_operations_1.changeStatusOp)('fulfilled')];
                }
                else if (currentStatus === 'complete' && newStatus === 'unsigned') {
                    encounterPatchOp = encounterOperationsWrapper(newStatus, resourcesToUpdate, function (newEncounterStatus, statusHistoryLength) {
                        return [
                            (0, fhir_res_patch_operations_1.addStatusHistoryRecordOp)(statusHistoryLength, newEncounterStatus, now()),
                            (0, fhir_res_patch_operations_1.changeStatusOp)(newEncounterStatus),
                        ];
                    });
                    appointmentPatchOp = [(0, fhir_res_patch_operations_1.changeStatusOp)('arrived')];
                }
                else {
                    console.error("Status change between current status: '".concat(currentStatus, "', and desired status: '").concat(newStatus, "', is not possible."));
                    throw new Error("Status change between current status: '".concat(currentStatus, "', and desired status: '").concat(newStatus, "', is not possible."));
                }
                _b.label = 3;
            case 3:
                if (resourcesToUpdate.appointment.id && appointmentPatchOp.length > 0) {
                    patchOperationsBinaries.push((0, utils_1.getPatchBinary)({
                        resourceType: 'Appointment',
                        resourceId: resourcesToUpdate.appointment.id,
                        patchOperations: appointmentPatchOp,
                    }));
                }
                patchOperationsBinaries.push((0, utils_1.getPatchBinary)({
                    resourceType: 'Encounter',
                    resourceId: resourcesToUpdate.encounter.id,
                    patchOperations: encounterPatchOp,
                }));
                promises = [];
                promises.push(oystehr.fhir.transaction({ requests: patchOperationsBinaries }));
                if (smsToSend)
                    promises.push((0, shared_1.sendSmsForPatient)(smsToSend, oystehr, patient, ENVIRONMENT).catch(function (error) {
                        return console.error('Error trying to send SMS message to patient on appointment change', error, smsToSend);
                    }));
                return [4 /*yield*/, Promise.all(promises)];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.changeStatusIfPossible = changeStatusIfPossible;
/**
 * handle complete status after appointment already was in complete status, so we
 * wanna summarize all time appointment was in unsigned status. For example:
 * unsigned - 3 min wait
 * complete - 5 min
 * unsigned - 9 min - practitioner decided to change something in and moved it to unsigned again.
 * So we wanna record 3 min initial + 9 min in unsigned to result record, because time in
 * complete status doesn't count
 */
var mergeUnsignedStatusesTimesOp = function (statusHistory) {
    var encounterOperations = [];
    var statusHistoryLength = statusHistory.length;
    var lastRecord = statusHistory[statusHistoryLength - 1];
    var beforeLastRecord = statusHistory[statusHistoryLength - 2];
    if (lastRecord.status === 'finished' &&
        beforeLastRecord.status === 'finished' &&
        lastRecord.period.start &&
        beforeLastRecord.period.start &&
        beforeLastRecord.period.end) {
        var firstUnsignedStart = new Date(beforeLastRecord.period.start).getTime();
        var firstUnsignedEnd = new Date(beforeLastRecord.period.end).getTime();
        var secondUnsignedStart = new Date(lastRecord.period.start).getTime();
        var secondUnsignedEnd = new Date().getTime();
        var unsignedTimeSummary = Math.abs(firstUnsignedEnd - firstUnsignedStart) + Math.abs(secondUnsignedEnd - secondUnsignedStart);
        var unsignedSummaryStart = new Date(Math.abs(new Date().getTime() - unsignedTimeSummary)).toISOString();
        var unsignedSummaryEnd = now();
        encounterOperations.push((0, fhir_res_patch_operations_1.deleteStatusHistoryRecordOp)(statusHistoryLength - 1));
        statusHistoryLength--;
        encounterOperations = encounterOperations.concat([
            (0, fhir_res_patch_operations_1.changeStatusRecordPeriodValueOp)(statusHistoryLength - 1, 'start', unsignedSummaryStart),
            (0, fhir_res_patch_operations_1.changeStatusRecordPeriodValueOp)(statusHistoryLength - 1, 'end', unsignedSummaryEnd),
        ]);
    }
    return encounterOperations;
};
var defaultEncounterOperations = function (newTelemedStatus, resourcesToUpdate) {
    return encounterOperationsWrapper(newTelemedStatus, resourcesToUpdate, function (newEncounterStatus, statusHistoryLength) {
        return [
            (0, fhir_res_patch_operations_1.changeStatusRecordPeriodValueOp)(statusHistoryLength - 1, 'end', now()),
            (0, fhir_res_patch_operations_1.addStatusHistoryRecordOp)(statusHistoryLength, newEncounterStatus, now()),
            (0, fhir_res_patch_operations_1.changeStatusOp)(newEncounterStatus),
        ];
    });
};
var encounterOperationsWrapper = function (newTelemedStatus, resourcesToUpdate, callback) {
    var _a;
    var newEncounterStatus = (0, shared_1.telemedStatusToEncounter)(newTelemedStatus);
    var statusHistoryLength = ((_a = resourcesToUpdate.encounter.statusHistory) === null || _a === void 0 ? void 0 : _a.length) || 1;
    return (0, fhir_res_patch_operations_1.handleEmptyEncounterStatusHistoryOp)(resourcesToUpdate).concat(callback(newEncounterStatus, statusHistoryLength));
};
var now = function () {
    return luxon_1.DateTime.utc().toISO();
};
var getAddPractitionerToEncounterOperation = function (encounter, practitionerId) { return __awaiter(void 0, void 0, void 0, function () {
    var existingParticipant, participants;
    var _a;
    return __generator(this, function (_b) {
        existingParticipant = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.find(function (participant) { var _a; return ((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) === "Practitioner/".concat(practitionerId); });
        if (existingParticipant)
            return [2 /*return*/, undefined];
        participants = encounter.participant;
        participants !== null && participants !== void 0 ? participants : (participants = []);
        participants.push({ individual: { reference: "Practitioner/".concat(practitionerId) } });
        if (!existingParticipant) {
            return [2 /*return*/, {
                    op: encounter.participant ? 'replace' : 'add',
                    path: '/participant',
                    value: participants,
                }];
        }
        return [2 /*return*/, undefined];
    });
}); };
var getRemovePractitionerFromEncounterOperation = function (encounter, practitionerId) {
    var _a;
    var existingParticipant = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.find(function (participant) { var _a; return ((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) === "Practitioner/".concat(practitionerId); });
    if (!existingParticipant || !encounter.participant)
        return undefined;
    var participants = encounter.participant.filter(function (participant) { var _a; return ((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) && participant.individual.reference !== "Practitioner/".concat(practitionerId); });
    return {
        op: 'replace',
        path: '/participant',
        value: participants,
    };
};
function makeAppointmentChargeItem(encounter, organizationId, account) {
    var _a;
    return {
        resourceType: 'ChargeItem',
        status: 'billable',
        code: {
            coding: [
                {
                    system: 'http://snomed.info/sct',
                    code: '448337001',
                    display: 'Telemedicine consultation with patient',
                    userSelected: false,
                },
            ],
        },
        account: [{ reference: "Account/".concat(account === null || account === void 0 ? void 0 : account.id) }],
        subject: {
            type: 'Patient',
            reference: (_a = encounter.subject) === null || _a === void 0 ? void 0 : _a.reference,
        },
        context: {
            type: 'Encounter',
            reference: "Encounter/".concat(encounter.id),
        },
        priceOverride: {
            currency: 'USD',
            value: 100,
        },
        performingOrganization: {
            type: 'Organization',
            reference: "Organization/".concat(organizationId),
        },
    };
}
function makeReceiptPdfDocumentReference(oystehr, pdfInfo, patientId, encounterId, listResources) {
    return __awaiter(this, void 0, void 0, function () {
        var docRefs, documentReference, error_1, errorMsg;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                        files: [
                            {
                                url: pdfInfo.uploadURL,
                                title: pdfInfo.title,
                            },
                        ],
                        type: {
                            coding: [
                                {
                                    system: 'http://loinc.org',
                                    code: utils_1.RECEIPT_CODE,
                                    display: 'Telehealth Payment Receipt',
                                },
                            ],
                        },
                        references: {
                            subject: {
                                reference: "Patient/".concat(patientId),
                            },
                            context: {
                                encounter: [{ reference: "Encounter/".concat(encounterId) }],
                            },
                        },
                        dateCreated: (_a = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _a !== void 0 ? _a : '',
                        oystehr: oystehr,
                        generateUUID: crypto_1.randomUUID,
                        meta: {
                            tag: [{ code: utils_1.OTTEHR_MODULE.TM }],
                        },
                        searchParams: [
                            { name: 'encounter', value: "Encounter/".concat(encounterId) },
                            { name: 'subject', value: "Patient/".concat(patientId) },
                        ],
                        listResources: listResources,
                    })];
                case 1:
                    docRefs = (_c.sent()).docRefs;
                    documentReference = docRefs.find(function (docRef) { return docRef.status === 'current'; });
                    if (!(documentReference === null || documentReference === void 0 ? void 0 : documentReference.id)) return [3 /*break*/, 5];
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'DocumentReference',
                            id: documentReference.id,
                            operations: [
                                {
                                    op: 'replace',
                                    path: '/date',
                                    value: (_b = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _b !== void 0 ? _b : '',
                                },
                            ],
                        })];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _c.sent();
                    errorMsg = "Failed to update DocumentReference date for id ".concat(documentReference.id, ": ").concat(error_1);
                    console.error(errorMsg);
                    throw new Error(errorMsg);
                case 5: return [2 /*return*/, documentReference];
            }
        });
    });
}

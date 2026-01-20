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
exports.handleUpdateOrderLevelNote = exports.handleAddOrderLevelNote = exports.handleRejectedUnsolicitedResult = exports.handleRejectedAbn = exports.handleMatchUnsolicitedRequest = exports.makePstCompletePatchRequests = exports.makeQrPatchRequest = exports.makeSpecimenPatchRequest = exports.getSpecimenPatchAndMostRecentCollectionDate = void 0;
var luxon_1 = require("luxon");
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
var tasks_1 = require("../../shared/tasks");
var labs_1 = require("../shared/labs");
var getSpecimenPatchAndMostRecentCollectionDate = function (specimenResources, specimenCollectionDates, practitionerIdFromCurrentUser) {
    var mostRecentCollectionDate;
    var sampleCollectionDates = [];
    var specimenPatchRequests = [];
    for (var _i = 0, specimenResources_1 = specimenResources; _i < specimenResources_1.length; _i++) {
        var specimen = specimenResources_1[_i];
        var dateToPatch = specimenCollectionDates && specimen.id ? specimenCollectionDates[specimen.id].date : undefined;
        var date = dateToPatch ? luxon_1.DateTime.fromISO(dateToPatch) : undefined;
        if (date) {
            sampleCollectionDates.push(date);
            var request = (0, exports.makeSpecimenPatchRequest)(specimen, date, practitionerIdFromCurrentUser);
            specimenPatchRequests.push(request);
        }
        else {
            console.error("issue parsing specimen collection date for ".concat(specimen.id, ", date passed: ").concat(dateToPatch));
            throw (0, utils_1.EXTERNAL_LAB_ERROR)('Error parsing specimen collection date');
        }
    }
    if (sampleCollectionDates.length > 0) {
        mostRecentCollectionDate = luxon_1.DateTime.max.apply(luxon_1.DateTime, sampleCollectionDates);
        console.log('mostRecentCollectionDate', mostRecentCollectionDate);
    }
    return { specimenPatchRequests: specimenPatchRequests, mostRecentCollectionDate: mostRecentCollectionDate };
};
exports.getSpecimenPatchAndMostRecentCollectionDate = getSpecimenPatchAndMostRecentCollectionDate;
var makeSpecimenPatchRequest = function (specimen, date, practitionerIdFromCurrentUser) {
    var _a, _b;
    var hasSpecimenCollection = specimen.collection;
    var hasSpecimenDateTime = (_a = specimen.collection) === null || _a === void 0 ? void 0 : _a.collectedDateTime;
    var hasSpecimenCollector = (_b = specimen.collection) === null || _b === void 0 ? void 0 : _b.collector;
    // new values
    var specimenCollector = { reference: "Practitioner/".concat(practitionerIdFromCurrentUser) };
    var operations = [];
    if (hasSpecimenCollection) {
        console.log('specimen collection found');
        operations.push({
            path: '/collection/collector',
            op: hasSpecimenCollector ? 'replace' : 'add',
            value: specimenCollector,
        }, {
            path: '/collection/collectedDateTime',
            op: hasSpecimenDateTime ? 'replace' : 'add',
            value: date,
        });
    }
    else {
        console.log('adding collection to specimen');
        operations.push({
            path: '/collection',
            op: 'add',
            value: {
                collectedDateTime: date,
                collector: specimenCollector,
            },
        });
    }
    var specimenPatchRequest = {
        method: 'PATCH',
        url: "Specimen/".concat(specimen.id),
        operations: operations,
    };
    return specimenPatchRequest;
};
exports.makeSpecimenPatchRequest = makeSpecimenPatchRequest;
var makeQrPatchRequest = function (qr, data, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var questionnaireResponseItems;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, labs_1.populateQuestionnaireResponseItems)(qr, data, m2mToken)];
            case 1:
                questionnaireResponseItems = (_a.sent()).questionnaireResponseItems;
                return [2 /*return*/, {
                        method: 'PATCH',
                        url: "QuestionnaireResponse/".concat(qr.id),
                        operations: [
                            { op: 'add', path: '/item', value: questionnaireResponseItems },
                            { op: 'replace', path: '/status', value: 'completed' },
                        ],
                    }];
        }
    });
}); };
exports.makeQrPatchRequest = makeQrPatchRequest;
var makePstCompletePatchRequests = function (oystehr, pstTask, sr, practitionerIdFromCurrentUser, now) { return __awaiter(void 0, void 0, void 0, function () {
    var curUserReference, provenanceFhirUrl, provenanceFhir, pstTaskOperations, currentUserPractitioner, requests;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                curUserReference = { reference: "Practitioner/".concat(practitionerIdFromCurrentUser) };
                provenanceFhirUrl = "urn:uuid:".concat((0, short_uuid_1.uuid)());
                provenanceFhir = {
                    resourceType: 'Provenance',
                    target: [
                        {
                            reference: "ServiceRequest/".concat(sr.id),
                        },
                    ],
                    recorded: now.toISO(),
                    location: pstTask.location,
                    agent: [{ who: curUserReference }],
                    activity: {
                        coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask],
                    },
                };
                pstTaskOperations = [
                    {
                        op: 'add',
                        path: '/relevantHistory',
                        value: [
                            {
                                reference: provenanceFhirUrl,
                            },
                        ],
                    },
                    {
                        op: 'replace',
                        path: '/status',
                        value: 'completed',
                    },
                ];
                if (!!pstTask.owner) return [3 /*break*/, 2];
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: practitionerIdFromCurrentUser,
                    })];
            case 1:
                currentUserPractitioner = _b.sent();
                pstTaskOperations.push({
                    path: '/owner',
                    op: 'add',
                    value: (0, tasks_1.createOwnerReference)(practitionerIdFromCurrentUser, (_a = (0, utils_1.getFullestAvailableName)(currentUserPractitioner)) !== null && _a !== void 0 ? _a : ''),
                });
                _b.label = 2;
            case 2:
                requests = [
                    {
                        method: 'POST',
                        url: '/Provenance',
                        fullUrl: provenanceFhirUrl,
                        resource: provenanceFhir,
                    },
                    (0, utils_1.getPatchBinary)({
                        resourceType: 'Task',
                        resourceId: pstTask.id || 'unknown',
                        patchOperations: pstTaskOperations,
                    }),
                ];
                return [2 /*return*/, requests];
        }
    });
}); };
exports.makePstCompletePatchRequests = makePstCompletePatchRequests;
/**
 * Marks the unsolicited result task as complete.
 * Links the patient to the diagnostic report.
 *
 * If a service request ID is provided:
 * - Links the service request to the diagnostic report.
 * - If the diagnostic report status is 'final', updates the service request status to 'completed'.
 */
var handleMatchUnsolicitedRequest = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var diagnosticReportResource, task, taskOperations, currentUserPractitioner, markTaskAsCompleteRequest, updatedDiagnosticReport, curSubjectRef, serviceRequestPatch, diagnosticReportPutRequest, requests;
    var _c, _d, _e, _f, _g;
    var oystehr = _b.oystehr, taskId = _b.taskId, diagnosticReportId = _b.diagnosticReportId, patientToMatchId = _b.patientToMatchId, practitionerIdFromCurrentUser = _b.practitionerIdFromCurrentUser, srToMatchId = _b.srToMatchId;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                console.log('getting the diagnostic report', diagnosticReportId);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'DiagnosticReport',
                        id: diagnosticReportId,
                    })];
            case 1:
                diagnosticReportResource = _h.sent();
                console.log('formatting fhir patch requests to handle matching unsolicited results');
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Task',
                        id: taskId,
                    })];
            case 2:
                task = _h.sent();
                taskOperations = [{ op: 'replace', path: '/status', value: 'completed' }];
                if (!!task.owner) return [3 /*break*/, 4];
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: practitionerIdFromCurrentUser,
                    })];
            case 3:
                currentUserPractitioner = _h.sent();
                taskOperations.push({
                    path: '/owner',
                    op: 'add',
                    value: (0, tasks_1.createOwnerReference)(practitionerIdFromCurrentUser, (_c = (0, utils_1.getFullestAvailableName)(currentUserPractitioner)) !== null && _c !== void 0 ? _c : ''),
                });
                _h.label = 4;
            case 4:
                markTaskAsCompleteRequest = {
                    method: 'PATCH',
                    url: "Task/".concat(taskId),
                    operations: taskOperations,
                };
                updatedDiagnosticReport = __assign({}, diagnosticReportResource);
                curSubjectRef = (_e = (_d = diagnosticReportResource.subject) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.replace('#', '');
                console.log('dr curSubjectRef', curSubjectRef);
                updatedDiagnosticReport.subject = { reference: "Patient/".concat(patientToMatchId) };
                updatedDiagnosticReport.contained = (_f = diagnosticReportResource.contained) === null || _f === void 0 ? void 0 : _f.filter(function (resource) { return resource.id !== curSubjectRef; });
                serviceRequestPatch = [];
                if (srToMatchId) {
                    console.log('srToMatchId passed: ', srToMatchId);
                    if (updatedDiagnosticReport.basedOn) {
                        updatedDiagnosticReport.basedOn.push({ reference: "ServiceRequest/".concat(srToMatchId) });
                    }
                    else {
                        updatedDiagnosticReport.basedOn = [{ reference: "ServiceRequest/".concat(srToMatchId) }];
                    }
                    // this write normally happens on the oystehr side but since the result came in as unsolicited it would not have happened there
                    if (updatedDiagnosticReport.status === 'final') {
                        console.log('dr status is final so patching sr status to completed');
                        serviceRequestPatch.push({
                            method: 'PATCH',
                            url: "ServiceRequest/".concat(srToMatchId),
                            operations: [{ op: 'replace', path: '/status', value: 'completed' }],
                        });
                    }
                }
                diagnosticReportPutRequest = {
                    method: 'PUT',
                    url: "DiagnosticReport/".concat(diagnosticReportResource.id),
                    resource: updatedDiagnosticReport,
                    ifMatch: ((_g = diagnosticReportResource.meta) === null || _g === void 0 ? void 0 : _g.versionId) ? "W/\"".concat(diagnosticReportResource.meta.versionId, "\"") : undefined,
                };
                requests = __spreadArray([diagnosticReportPutRequest, markTaskAsCompleteRequest], serviceRequestPatch, true);
                console.log('making fhir requests, total requests to make: ', requests.length);
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 5:
                _h.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.handleMatchUnsolicitedRequest = handleMatchUnsolicitedRequest;
var handleRejectedAbn = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var resourceSearch, initial, _c, abnDocRef, serviceRequest, srExtension, srPatch, curUserReference, provenancePost;
    var oystehr = _b.oystehr, serviceRequestId = _b.serviceRequestId, practitionerIdFromCurrentUser = _b.practitionerIdFromCurrentUser;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'ServiceRequest',
                    params: [
                        {
                            name: '_id',
                            value: serviceRequestId,
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:related', // to validate there is an abn doc
                        },
                    ],
                })];
            case 1:
                resourceSearch = (_d.sent()).unbundle();
                console.log("resource search for handleRejectedAbn returned ".concat(resourceSearch.length));
                initial = {
                    abnDocRef: undefined,
                    serviceRequest: undefined,
                };
                _c = resourceSearch.reduce(function (acc, resource) {
                    if (resource.resourceType === 'ServiceRequest' && resource.status !== 'completed') {
                        acc.serviceRequest = resource;
                    }
                    if (resource.resourceType === 'DocumentReference') {
                        if ((0, utils_1.docRefIsAbnAndCurrent)(resource))
                            acc.abnDocRef = resource;
                    }
                    return acc;
                }, initial), abnDocRef = _c.abnDocRef, serviceRequest = _c.serviceRequest;
                if (!abnDocRef) {
                    throw new Error("ABN rejection failed: there is no current abn document reference for this lab. ".concat(serviceRequestId));
                }
                if (!serviceRequest) {
                    throw new Error("ABN rejection failed: did not find service request resource. ".concat(serviceRequestId));
                }
                console.log('formatting requests for handleRejectedAbn');
                srExtension = serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.extension;
                srPatch = {
                    method: 'PATCH',
                    url: "ServiceRequest/".concat(serviceRequestId),
                    operations: [
                        {
                            op: 'add',
                            path: srExtension ? '/extension/-' : '/extension',
                            value: srExtension ? utils_1.SR_REVOKED_REASON_EXT : [utils_1.SR_REVOKED_REASON_EXT],
                        },
                    ],
                };
                curUserReference = { reference: "Practitioner/".concat(practitionerIdFromCurrentUser) };
                provenancePost = {
                    method: 'POST',
                    url: '/Provenance',
                    resource: {
                        resourceType: 'Provenance',
                        target: [
                            {
                                reference: "ServiceRequest/".concat(serviceRequestId),
                            },
                        ],
                        recorded: luxon_1.DateTime.now().toISO(),
                        agent: [{ who: curUserReference }],
                        activity: {
                            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.abnRejected],
                        },
                    },
                };
                console.log('revoking the service request due to rejected abn');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: [srPatch, provenancePost] })];
            case 2:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.handleRejectedAbn = handleRejectedAbn;
var handleRejectedUnsolicitedResult = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var resources, _c, fhirTask, fhirDiagnosticReport, requests;
    var _d, _e;
    var oystehr = _b.oystehr, taskId = _b.taskId;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                console.log('searching for task and diagnostic report within handleRejectedUnsolicitedResult');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Task',
                        params: [
                            {
                                name: '_id',
                                value: taskId,
                            },
                            {
                                name: '_include:iterate',
                                value: 'Task:based-on',
                            },
                        ],
                    })];
            case 1:
                resources = (_f.sent()).unbundle();
                console.log('number of resources returned from search:', resources.length);
                _c = resources.reduce(function (acc, resource) {
                    if (resource.resourceType === 'Task')
                        acc.fhirTask = resource;
                    if (resource.resourceType === 'DiagnosticReport')
                        acc.fhirDiagnosticReport = resource;
                    return acc;
                }, { fhirTask: undefined, fhirDiagnosticReport: undefined }), fhirTask = _c.fhirTask, fhirDiagnosticReport = _c.fhirDiagnosticReport;
                if (!fhirTask)
                    throw new Error("Something has gone awry getting this task during handleRejectedUnsolicitedResult: ".concat(taskId));
                requests = [
                    {
                        method: 'PATCH',
                        url: "Task/".concat(taskId),
                        operations: [
                            {
                                op: 'replace',
                                path: '/status',
                                value: 'cancelled',
                            },
                        ],
                    },
                ];
                // this means it was matched and is being rejected AFTER being matched
                if (fhirDiagnosticReport && ((_e = (_d = fhirDiagnosticReport.subject) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.startsWith('Patient/'))) {
                    console.log('it appears this unsolicited result has been matched to a patient - the subject patient will be removed and the task will be cancelled');
                    requests.push({
                        method: 'PATCH',
                        url: "DiagnosticReport/".concat(fhirDiagnosticReport.id),
                        operations: [
                            {
                                op: 'remove',
                                path: '/subject',
                            },
                        ],
                    });
                }
                else {
                    console.log('this unsolicited result is being rejected before matching to a patient, the only action to be taken is cancelling the task');
                }
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 2:
                _f.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.handleRejectedUnsolicitedResult = handleRejectedUnsolicitedResult;
var handleAddOrderLevelNote = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var serviceRequests, communicationConfig;
    var oystehr = _b.oystehr, requisitionNumber = _b.requisitionNumber, note = _b.note;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'ServiceRequest',
                    params: [
                        {
                            name: 'identifier',
                            value: "".concat(utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, "|").concat(requisitionNumber),
                        },
                    ],
                })];
            case 1:
                serviceRequests = (_c.sent()).unbundle();
                console.log("serviceRequests for handleAddOrderLevelNote returned ".concat(serviceRequests.length));
                communicationConfig = {
                    resourceType: 'Communication',
                    status: 'completed',
                    identifier: [
                        {
                            system: utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
                            value: requisitionNumber,
                        },
                    ],
                    basedOn: serviceRequests.map(function (sr) { return ({ reference: "ServiceRequest/".concat(sr.id) }); }),
                    category: [
                        {
                            coding: [utils_1.LAB_ORDER_LEVEL_NOTE_CATEGORY],
                        },
                    ],
                    payload: [{ contentString: note }],
                };
                return [4 /*yield*/, oystehr.fhir.create(communicationConfig)];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.handleAddOrderLevelNote = handleAddOrderLevelNote;
var handleUpdateOrderLevelNote = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var resourceSearch, communication;
    var _c;
    var oystehr = _b.oystehr, requisitionNumber = _b.requisitionNumber, note = _b.note;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log('searching for the order level note communication');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Communication',
                        params: [
                            {
                                name: 'identifier',
                                value: "".concat(utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, "|").concat(requisitionNumber),
                            },
                            {
                                name: 'category',
                                value: "".concat(utils_1.LAB_ORDER_LEVEL_NOTE_CATEGORY.system, "|").concat(utils_1.LAB_ORDER_LEVEL_NOTE_CATEGORY.code),
                            },
                        ],
                    })];
            case 1:
                resourceSearch = (_d.sent()).unbundle();
                console.log("resource search for handleAddOrderLevelNote returned ".concat(resourceSearch.length));
                if (resourceSearch.length !== 1) {
                    throw new Error("An unexpected number of resources were returned when searching to update the order level note for requisition ".concat(requisitionNumber, ". Return count: ").concat(resourceSearch.length));
                }
                communication = resourceSearch.find(function (resource) { return resource.resourceType === 'Communication'; });
                if (!communication) {
                    throw new Error("Could not find the order level note communication for requsition $requisitionNumber}");
                }
                if (!note) return [3 /*break*/, 3];
                console.log('Updating order level note');
                return [4 /*yield*/, oystehr.fhir.update(__assign(__assign({}, communication), { payload: [
                            {
                                contentString: note,
                            },
                        ] }), { optimisticLockingVersionId: (_c = communication.meta) === null || _c === void 0 ? void 0 : _c.versionId })];
            case 2:
                _d.sent();
                return [3 /*break*/, 5];
            case 3:
                if (!communication.id)
                    throw new Error("no id for this communication ?? ".concat(JSON.stringify(communication)));
                console.log('note was sent as an empty string, we will delete the communication');
                return [4 /*yield*/, oystehr.fhir.delete({ resourceType: 'Communication', id: communication.id })];
            case 4:
                _d.sent();
                _d.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.handleUpdateOrderLevelNote = handleUpdateOrderLevelNote;

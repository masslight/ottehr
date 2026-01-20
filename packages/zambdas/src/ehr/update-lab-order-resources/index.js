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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var external_labs_label_pdf_1 = require("../../shared/pdf/external-labs-label-pdf");
var labs_results_form_pdf_1 = require("../../shared/pdf/labs-results-form-pdf");
var tasks_1 = require("../../shared/tasks");
var labs_1 = require("../shared/labs");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'update-lab-order-resources';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, validatedParameters, oystehr, oystehrCurrentUser, practitionerIdFromCurrentUser, _a, taskId, serviceRequestId, diagnosticReportId, updateTransactionRequest, serviceRequestId, specimenId, date, updateTransactionRequest, serviceRequestId, data, specimenCollectionDates, presignedLabelURL, taskId, taskId, diagnosticReportId, srToMatchId, patientToMatchId, serviceRequestId, requisitionNumber, note, event_1, actionWord, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log("update-lab-order-resources started, input: ".concat(JSON.stringify(input)));
                secrets = input.secrets;
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                }
                catch (error) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({
                                message: "Invalid request parameters. ".concat(error.message || error),
                            }),
                        }];
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 22, , 23]);
                secrets = validatedParameters.secrets;
                console.log('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 3:
                practitionerIdFromCurrentUser = _b.sent();
                _a = validatedParameters.event;
                switch (_a) {
                    case 'reviewed': return [3 /*break*/, 4];
                    case 'specimenDateChanged': return [3 /*break*/, 6];
                    case 'saveOrderCollectionData': return [3 /*break*/, 8];
                    case utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.cancelUnsolicitedResultTask: return [3 /*break*/, 10];
                    case utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.matchUnsolicitedResult: return [3 /*break*/, 12];
                    case utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.rejectedAbn: return [3 /*break*/, 14];
                    case utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.addOrderLevelNote: return [3 /*break*/, 16];
                    case utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.updateOrderLevelNote: return [3 /*break*/, 16];
                }
                return [3 /*break*/, 21];
            case 4:
                taskId = validatedParameters.taskId, serviceRequestId = validatedParameters.serviceRequestId, diagnosticReportId = validatedParameters.diagnosticReportId;
                return [4 /*yield*/, handleReviewedEvent({
                        oystehr: oystehr,
                        practitionerIdFromCurrentUser: practitionerIdFromCurrentUser,
                        taskId: taskId,
                        serviceRequestId: serviceRequestId,
                        diagnosticReportId: diagnosticReportId,
                        secrets: secrets,
                    })];
            case 5:
                updateTransactionRequest = _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully updated Task/".concat(taskId, ". Status set to 'completed' and Practitioner set."),
                            transaction: updateTransactionRequest,
                        }),
                    }];
            case 6:
                serviceRequestId = validatedParameters.serviceRequestId, specimenId = validatedParameters.specimenId, date = validatedParameters.date;
                return [4 /*yield*/, handleSpecimenDateChangedEvent({
                        oystehr: oystehr,
                        serviceRequestId: serviceRequestId,
                        specimenId: specimenId,
                        date: date,
                        practitionerIdFromCurrentUser: practitionerIdFromCurrentUser,
                    })];
            case 7:
                updateTransactionRequest = _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully updated Specimen/".concat(specimenId, ". Date set to '").concat(date, "'."),
                            transaction: updateTransactionRequest,
                        }),
                    }];
            case 8:
                serviceRequestId = validatedParameters.serviceRequestId, data = validatedParameters.data, specimenCollectionDates = validatedParameters.specimenCollectionDates;
                return [4 /*yield*/, handleSaveCollectionData(oystehr, m2mToken, secrets, practitionerIdFromCurrentUser, {
                        serviceRequestId: serviceRequestId,
                        data: data,
                        specimenCollectionDates: specimenCollectionDates,
                    })];
            case 9:
                presignedLabelURL = (_b.sent()).presignedLabelURL;
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully updated saved order collection data",
                            presignedLabelURL: presignedLabelURL,
                        }),
                    }];
            case 10:
                console.log('handling cancel task to match unsolicited result');
                taskId = validatedParameters.taskId;
                return [4 /*yield*/, (0, helpers_1.handleRejectedUnsolicitedResult)({ oystehr: oystehr, taskId: taskId })];
            case 11:
                _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully cancelled match unsolicited result task with id ".concat(taskId),
                        }),
                    }];
            case 12:
                taskId = validatedParameters.taskId, diagnosticReportId = validatedParameters.diagnosticReportId, srToMatchId = validatedParameters.srToMatchId, patientToMatchId = validatedParameters.patientToMatchId;
                console.log('handling match unsolicited result');
                return [4 /*yield*/, (0, helpers_1.handleMatchUnsolicitedRequest)({
                        oystehr: oystehr,
                        taskId: taskId,
                        diagnosticReportId: diagnosticReportId,
                        srToMatchId: srToMatchId,
                        patientToMatchId: patientToMatchId,
                        practitionerIdFromCurrentUser: practitionerIdFromCurrentUser,
                    })];
            case 13:
                _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully matched unsolicited result",
                        }),
                    }];
            case 14:
                serviceRequestId = validatedParameters.serviceRequestId;
                console.log('handling rejected abn');
                return [4 /*yield*/, (0, helpers_1.handleRejectedAbn)({ oystehr: oystehr, serviceRequestId: serviceRequestId, practitionerIdFromCurrentUser: practitionerIdFromCurrentUser })];
            case 15:
                _b.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully revoked sr for lab with rejected abn",
                        }),
                    }];
            case 16:
                requisitionNumber = validatedParameters.requisitionNumber, note = validatedParameters.note, event_1 = validatedParameters.event;
                actionWord = event_1 === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.addOrderLevelNote ? 'created' : 'updated';
                if (!(event_1 === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.addOrderLevelNote)) return [3 /*break*/, 18];
                console.log('handling add order level note');
                return [4 /*yield*/, (0, helpers_1.handleAddOrderLevelNote)({ oystehr: oystehr, requisitionNumber: requisitionNumber, note: note })];
            case 17:
                _b.sent();
                return [3 /*break*/, 20];
            case 18:
                if (!(event_1 === utils_1.LAB_ORDER_UPDATE_RESOURCES_EVENTS.updateOrderLevelNote)) return [3 /*break*/, 20];
                console.log('handling update order level note');
                return [4 /*yield*/, (0, helpers_1.handleUpdateOrderLevelNote)({ oystehr: oystehr, requisitionNumber: requisitionNumber, note: note })];
            case 19:
                _b.sent();
                _b.label = 20;
            case 20: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify({
                        message: "Successfully ".concat(actionWord, " order level note communication"),
                    }),
                }];
            case 21: return [3 /*break*/, 23];
            case 22:
                error_1 = _b.sent();
                console.error('Error updating external lab order resource:', error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-lab-order-resources', error_1, ENVIRONMENT)];
            case 23: return [2 /*return*/];
        }
    });
}); });
var handleReviewedEvent = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var resources, serviceRequest, maybeServiceRequest, diagnosticReport, specificDrTypeFromTag, resultIsDrDriven, task, observationId, locationReference, tempProvenanceUuid, target, provenanceRequest, isPreliminary, shouldAddRelevantHistory, taskPatchOperations, currentUserPractitioner, taskPatchRequest, requests, updateTransactionRequest;
    var _c, _d, _e, _f, _g;
    var oystehr = _b.oystehr, practitionerIdFromCurrentUser = _b.practitionerIdFromCurrentUser, taskId = _b.taskId, serviceRequestId = _b.serviceRequestId, diagnosticReportId = _b.diagnosticReportId, secrets = _b.secrets;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'DiagnosticReport',
                    params: [
                        { name: '_id', value: diagnosticReportId }, // diagnostic report
                        { name: '_include', value: 'DiagnosticReport:based-on' }, // service request
                        { name: '_revinclude', value: 'Task:based-on' }, // tasks
                        { name: '_include', value: 'DiagnosticReport:result' }, // observation
                    ],
                })];
            case 1:
                resources = (_h.sent()).unbundle();
                maybeServiceRequest = resources.find(function (r) { return r.resourceType === 'ServiceRequest' && r.id === serviceRequestId; });
                if (maybeServiceRequest) {
                    serviceRequest = maybeServiceRequest;
                }
                diagnosticReport = resources.find(function (r) { return r.resourceType === 'DiagnosticReport' && r.id === diagnosticReportId; });
                specificDrTypeFromTag = (0, labs_1.diagnosticReportSpecificResultType)(diagnosticReport);
                resultIsDrDriven = !!specificDrTypeFromTag;
                console.log('handleReviewedEvent specificDrTypeFromTag', specificDrTypeFromTag);
                console.log('resultIsDrDriven', resultIsDrDriven);
                task = resources.find(function (r) { return r.resourceType === 'Task' && r.id === taskId; });
                if (!serviceRequest && !resultIsDrDriven) {
                    throw new Error("ServiceRequest/".concat(serviceRequestId, " not found for diagnostic report, ").concat(diagnosticReportId));
                }
                if (!diagnosticReport) {
                    throw new Error("DiagnosticReport/".concat(diagnosticReportId, " not found"));
                }
                if (!task) {
                    throw new Error("Task/".concat(taskId, " not found"));
                }
                observationId = (_e = (_d = (_c = diagnosticReport.result) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.split('/').pop();
                if (!observationId) {
                    throw new Error("Observation Id not found in DiagnosticReport/".concat(diagnosticReportId));
                }
                locationReference = (_f = serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.locationReference) === null || _f === void 0 ? void 0 : _f[0];
                tempProvenanceUuid = "urn:uuid:".concat(crypto.randomUUID());
                target = [
                    { reference: "DiagnosticReport/".concat(diagnosticReport.id) },
                    { reference: "Observation/".concat(observationId) },
                ];
                if (serviceRequest) {
                    target.push({ reference: "ServiceRequest/".concat(serviceRequest.id) });
                }
                provenanceRequest = {
                    method: 'POST',
                    url: '/Provenance',
                    resource: {
                        resourceType: 'Provenance',
                        target: target,
                        recorded: luxon_1.DateTime.now().toUTC().toISO(),
                        location: locationReference, // TODO: should we throw error if locationReference is not present?
                        agent: [
                            {
                                who: {
                                    reference: "Practitioner/".concat(practitionerIdFromCurrentUser),
                                },
                            },
                        ],
                        activity: {
                            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.review],
                        },
                    },
                    fullUrl: tempProvenanceUuid,
                };
                isPreliminary = diagnosticReport.status === 'preliminary';
                shouldAddRelevantHistory = !isPreliminary;
                taskPatchOperations = __spreadArray([
                    {
                        op: 'replace',
                        path: '/status',
                        value: 'completed',
                    }
                ], (shouldAddRelevantHistory
                    ? [
                        {
                            op: 'add',
                            path: '/relevantHistory',
                            value: [
                                {
                                    reference: tempProvenanceUuid,
                                },
                            ],
                        },
                    ]
                    : []), true);
                if (!!task.owner) return [3 /*break*/, 3];
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: practitionerIdFromCurrentUser,
                    })];
            case 2:
                currentUserPractitioner = _h.sent();
                taskPatchOperations.push({
                    path: '/owner',
                    op: 'add',
                    value: (0, tasks_1.createOwnerReference)(practitionerIdFromCurrentUser, (_g = (0, utils_1.getFullestAvailableName)(currentUserPractitioner)) !== null && _g !== void 0 ? _g : ''),
                });
                _h.label = 3;
            case 3:
                taskPatchRequest = (0, utils_1.getPatchBinary)({
                    resourceType: 'Task',
                    resourceId: taskId,
                    patchOperations: taskPatchOperations,
                });
                requests = shouldAddRelevantHistory ? [provenanceRequest, taskPatchRequest] : [taskPatchRequest];
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: requests,
                    })];
            case 4:
                updateTransactionRequest = _h.sent();
                if (!specificDrTypeFromTag) return [3 /*break*/, 6];
                console.log('creating pdf for unsolicited result:', diagnosticReportId);
                return [4 /*yield*/, (0, labs_results_form_pdf_1.createExternalLabResultPDFBasedOnDr)(oystehr, specificDrTypeFromTag, diagnosticReportId, true, secrets, m2mToken)];
            case 5:
                _h.sent();
                return [3 /*break*/, 9];
            case 6:
                if (!serviceRequestId) return [3 /*break*/, 8];
                console.log('creating pdf for solicited result:', diagnosticReportId);
                return [4 /*yield*/, (0, labs_results_form_pdf_1.createExternalLabResultPDF)(oystehr, serviceRequestId, diagnosticReport, true, secrets, m2mToken)];
            case 7:
                _h.sent();
                return [3 /*break*/, 9];
            case 8:
                console.log('skipping review pdf re-generation');
                _h.label = 9;
            case 9: return [2 /*return*/, updateTransactionRequest];
        }
    });
}); };
var handleSpecimenDateChangedEvent = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var resources, specimen, specimenPatchRequest, updateTransactionRequest;
    var oystehr = _b.oystehr, serviceRequestId = _b.serviceRequestId, specimenId = _b.specimenId, date = _b.date, practitionerIdFromCurrentUser = _b.practitionerIdFromCurrentUser;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!luxon_1.DateTime.fromISO(date).isValid) {
                    throw new Error("Invalid date value: ".concat(date));
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: [
                            { name: '_id', value: serviceRequestId },
                            { name: '_include', value: 'ServiceRequest:specimen' },
                        ],
                    })];
            case 1:
                resources = (_c.sent()).unbundle();
                specimen = resources.find(function (r) { return r.resourceType === 'Specimen' && r.id === specimenId; });
                if (!(specimen === null || specimen === void 0 ? void 0 : specimen.id)) {
                    throw new Error("Specimen/".concat(specimenId, " not found in ServiceRequest/").concat(serviceRequestId));
                }
                specimenPatchRequest = (0, helpers_1.makeSpecimenPatchRequest)(specimen, luxon_1.DateTime.fromISO(date), practitionerIdFromCurrentUser);
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [specimenPatchRequest],
                    })];
            case 2:
                updateTransactionRequest = _c.sent();
                return [2 /*return*/, updateTransactionRequest];
        }
    });
}); };
/**
 * saves sample collection dates
 * saves aoe question entry & marks QR as complete
 * update pre-submission task to complete and create provenance for who did that
 *  makes specimen label
 */
var handleSaveCollectionData = function (oystehr, m2mToken, secrets, practitionerIdFromCurrentUser, input) { return __awaiter(void 0, void 0, void 0, function () {
    var serviceRequestId, data, specimenCollectionDates, now, _a, serviceRequest, patient, questionnaireResponse, preSubmissionTask, encounter, labOrganization, specimenResources, location, orderNumber, requests, mostRecentSampleCollectionDate, _b, specimenPatchRequests, mostRecentCollectionDate, qrPatchRequest, presignedLabelURL, pstCompletedRequests, labelConfig;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                console.log('double check input', JSON.stringify(input));
                serviceRequestId = input.serviceRequestId, data = input.data, specimenCollectionDates = input.specimenCollectionDates;
                now = luxon_1.DateTime.now();
                console.log('getting resources needed for saving collection data');
                return [4 /*yield*/, (0, labs_1.getExternalLabOrderResourcesViaServiceRequest)(oystehr, serviceRequestId)];
            case 1:
                _a = _e.sent(), serviceRequest = _a.serviceRequest, patient = _a.patient, questionnaireResponse = _a.questionnaireResponse, preSubmissionTask = _a.preSubmissionTask, encounter = _a.encounter, labOrganization = _a.labOrganization, specimenResources = _a.specimens, location = _a.location;
                console.log('resources retrieved');
                orderNumber = (0, utils_1.getOrderNumber)(serviceRequest);
                console.log('orderNumber', orderNumber);
                if (!orderNumber)
                    throw Error("requisition number could not be parsed from the service request ".concat(serviceRequest.id));
                requests = [];
                console.log('specimenResources', JSON.stringify(specimenResources));
                console.log('specimenCollectionDates', JSON.stringify(specimenCollectionDates));
                if (specimenResources.length > 0 && specimenCollectionDates) {
                    _b = (0, helpers_1.getSpecimenPatchAndMostRecentCollectionDate)(specimenResources, specimenCollectionDates, practitionerIdFromCurrentUser), specimenPatchRequests = _b.specimenPatchRequests, mostRecentCollectionDate = _b.mostRecentCollectionDate;
                    requests.push.apply(requests, specimenPatchRequests);
                    mostRecentSampleCollectionDate = mostRecentCollectionDate;
                }
                if (!(questionnaireResponse !== undefined && questionnaireResponse.id)) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, helpers_1.makeQrPatchRequest)(questionnaireResponse, data, m2mToken)];
            case 2:
                qrPatchRequest = _e.sent();
                requests.push(qrPatchRequest);
                _e.label = 3;
            case 3:
                presignedLabelURL = undefined;
                return [4 /*yield*/, (0, helpers_1.makePstCompletePatchRequests)(oystehr, preSubmissionTask, serviceRequest, practitionerIdFromCurrentUser, now)];
            case 4:
                pstCompletedRequests = _e.sent();
                requests.push.apply(requests, pstCompletedRequests);
                if (!!(0, utils_1.isPSCOrder)(serviceRequest)) return [3 /*break*/, 6];
                labelConfig = {
                    labelConfig: utils_1.DYMO_30334_LABEL_CONFIG,
                    content: {
                        patientId: patient.id,
                        patientFirstName: (_c = (0, utils_1.getPatientFirstName)(patient)) !== null && _c !== void 0 ? _c : '',
                        patientLastName: (_d = (0, utils_1.getPatientLastName)(patient)) !== null && _d !== void 0 ? _d : '',
                        patientDateOfBirth: patient.birthDate ? luxon_1.DateTime.fromISO(patient.birthDate) : undefined,
                        sampleCollectionDate: mostRecentSampleCollectionDate,
                        orderNumber: orderNumber,
                        accountNumber: (labOrganization && location && (0, utils_1.getAccountNumberFromLocationAndOrganization)(location, labOrganization)) || '',
                    },
                };
                console.log('creating labs order label and getting url');
                return [4 /*yield*/, (0, external_labs_label_pdf_1.createExternalLabsLabelPDF)(labelConfig, encounter.id, serviceRequest.id, secrets, m2mToken, oystehr)];
            case 5:
                presignedLabelURL = (_e.sent()).presignedURL;
                _e.label = 6;
            case 6:
                console.log('making fhir requests');
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 7:
                _e.sent();
                return [2 /*return*/, { presignedLabelURL: presignedLabelURL }];
        }
    });
}); };

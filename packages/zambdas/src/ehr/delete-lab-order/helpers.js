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
exports.makeCommunicationRequestForClinicalInfoNote = exports.makeCommunicationRequestForOrderNote = exports.getLabOrderRelatedResources = exports.makeDeleteResourceRequest = void 0;
var labs_constants_1 = require("utils/lib/types/data/labs/labs.constants");
var helpers_1 = require("../get-lab-orders/helpers");
var helpers_2 = require("../lab/shared/helpers");
var makeDeleteResourceRequest = function (resourceType, id) { return ({
    method: 'DELETE',
    url: "".concat(resourceType, "/").concat(id),
}); };
exports.makeDeleteResourceRequest = makeDeleteResourceRequest;
var getLabOrderRelatedResources = function (oystehr, params) { return __awaiter(void 0, void 0, void 0, function () {
    var serviceRequestResponse, initAccumulator, _a, serviceRequests, tasks, conditions, encounters, orderLevelNotesByUser, clinicalInfoNotesByUser, documentReferences, diagnosticReports, communications, serviceRequest_1, encounter_1, labConditions, questionnaireResponse, drRefSet_1, filteredTasks, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: [
                            {
                                name: '_id',
                                value: params.serviceRequestId,
                            },
                            {
                                name: '_include',
                                value: 'ServiceRequest:encounter',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Condition:encounter',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Communication:based-on', // order level notes & clinical info notes
                            },
                            // if the lab has been sent there are some additional resources we need to check for
                            {
                                name: '_revinclude',
                                value: 'DiagnosticReport:based-on',
                            },
                            // will pull tasks based on the service request and the diagnostic report
                            {
                                name: '_revinclude:iterate',
                                value: 'Task:based-on',
                            },
                            // order pdf, label pdf, result pdf, ABNs
                            {
                                name: '_revinclude:iterate',
                                value: 'DocumentReference:related',
                            },
                        ],
                    })];
            case 1:
                serviceRequestResponse = (_b.sent()).unbundle();
                initAccumulator = {
                    serviceRequests: [],
                    tasks: [],
                    conditions: [],
                    encounters: [],
                    orderLevelNotesByUser: [],
                    clinicalInfoNotesByUser: [],
                    documentReferences: [],
                    diagnosticReports: [],
                };
                _a = serviceRequestResponse.reduce(function (acc, resource) {
                    var _a;
                    if (resource.resourceType === 'ServiceRequest' && resource.id === params.serviceRequestId) {
                        acc.serviceRequests.push(resource);
                    }
                    else if (resource.resourceType === 'Task' &&
                        resource.status !== 'cancelled' &&
                        resource.status !== 'completed') {
                        acc.tasks.push(resource);
                    }
                    else if (resource.resourceType === 'Condition') {
                        acc.conditions.push(resource);
                    }
                    else if (resource.resourceType === 'Encounter') {
                        acc.encounters.push(resource);
                    }
                    else if (resource.resourceType === 'Communication') {
                        var labCommType = (0, helpers_1.labOrderCommunicationType)(resource);
                        if (labCommType === 'order-level-note')
                            acc.orderLevelNotesByUser.push(resource);
                        if (labCommType === 'clinical-info-note')
                            acc.clinicalInfoNotesByUser.push(resource);
                    }
                    else if (resource.resourceType === 'DocumentReference' && resource.status === 'current') {
                        var isAbnDoc = (_a = resource.category) === null || _a === void 0 ? void 0 : _a.some(function (cat) {
                            var _a;
                            return (_a = cat.coding) === null || _a === void 0 ? void 0 : _a.some(function (code) {
                                return code.system === labs_constants_1.OYSTEHR_ABN_DOC_CATEGORY_CODING.system &&
                                    code.code === labs_constants_1.OYSTEHR_ABN_DOC_CATEGORY_CODING.code;
                            });
                        });
                        // since the ABN may be related to other labs in an order we will not delete this
                        // todo labs at some point in the future it may make sense to do the work of actually determining if the abn SHOULD be deleted
                        // but for now we will err on the side of caution
                        if (!isAbnDoc)
                            acc.documentReferences.push(resource);
                    }
                    else if (resource.resourceType === 'DiagnosticReport') {
                        acc.diagnosticReports.push(resource);
                    }
                    return acc;
                }, initAccumulator), serviceRequests = _a.serviceRequests, tasks = _a.tasks, conditions = _a.conditions, encounters = _a.encounters, orderLevelNotesByUser = _a.orderLevelNotesByUser, clinicalInfoNotesByUser = _a.clinicalInfoNotesByUser, documentReferences = _a.documentReferences, diagnosticReports = _a.diagnosticReports;
                communications = void 0;
                if (orderLevelNotesByUser.length > 0 || clinicalInfoNotesByUser.length > 0) {
                    communications = {
                        orderLevelNotesByUser: orderLevelNotesByUser,
                        clinicalInfoNotesByUser: clinicalInfoNotesByUser,
                    };
                }
                serviceRequest_1 = serviceRequests[0];
                if (!(serviceRequest_1 === null || serviceRequest_1 === void 0 ? void 0 : serviceRequest_1.id)) {
                    console.error('Lab order not found or invalid response', serviceRequestResponse);
                    throw new Error("Service request for delete request is misconfigured: ".concat(serviceRequest_1 === null || serviceRequest_1 === void 0 ? void 0 : serviceRequest_1.id));
                }
                encounter_1 = encounters.find(function (encounter) { var _a, _b; return encounter.id === ((_b = (_a = serviceRequest_1.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1]); });
                labConditions = conditions.filter(function (condition) {
                    var _a, _b;
                    return ((_a = condition.encounter) === null || _a === void 0 ? void 0 : _a.reference) === "Encounter/".concat(encounter_1 === null || encounter_1 === void 0 ? void 0 : encounter_1.id) &&
                        ((_b = condition.extension) === null || _b === void 0 ? void 0 : _b.some(function (ext) { return ext.url === labs_constants_1.ADDED_VIA_LAB_ORDER_SYSTEM && ext.valueBoolean === true; }));
                });
                return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var questionnaireResponseId, questionnaireResponse_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(serviceRequest_1.supportingInfo && serviceRequest_1.supportingInfo.length > 0)) return [3 /*break*/, 2];
                                    questionnaireResponseId = serviceRequest_1.supportingInfo
                                        .filter(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('QuestionnaireResponse/'); })
                                        .map(function (ref) { return ref.reference.split('/')[1]; })[0];
                                    if (!questionnaireResponseId) return [3 /*break*/, 2];
                                    return [4 /*yield*/, oystehr.fhir.search({
                                            resourceType: 'QuestionnaireResponse',
                                            params: [
                                                {
                                                    name: '_id',
                                                    value: questionnaireResponseId,
                                                },
                                            ],
                                        })];
                                case 1:
                                    questionnaireResponse_1 = (_a.sent()).unbundle()[0];
                                    if (questionnaireResponse_1.id === questionnaireResponseId) {
                                        return [2 /*return*/, questionnaireResponse_1];
                                    }
                                    return [2 /*return*/, null];
                                case 2: return [2 /*return*/, null];
                            }
                        });
                    }); })()];
            case 2:
                questionnaireResponse = _b.sent();
                drRefSet_1 = new Set(diagnosticReports.map(function (dr) { return "DiagnosticReport/".concat(dr.id); }));
                filteredTasks = tasks.filter(function (task) {
                    var _a;
                    return !!((_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (ref) {
                        var basedOn = ref.reference;
                        if (!basedOn)
                            return false;
                        var isBasedOnServiceRequest = basedOn.endsWith("ServiceRequest/".concat(params.serviceRequestId));
                        var isBasedOnSomeDR = drRefSet_1.has(basedOn);
                        return isBasedOnServiceRequest || isBasedOnSomeDR;
                    }));
                });
                return [2 /*return*/, {
                        serviceRequest: serviceRequest_1,
                        questionnaireResponse: questionnaireResponse,
                        tasks: filteredTasks,
                        labConditions: labConditions,
                        communications: communications,
                        documentReferences: documentReferences,
                        diagnosticReports: diagnosticReports,
                    }];
            case 3:
                error_1 = _b.sent();
                console.error('Error fetching external lab order and related resources:', error_1);
                throw error_1;
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.getLabOrderRelatedResources = getLabOrderRelatedResources;
var makeCommunicationRequestForOrderNote = function (orderLevelNotes, serviceRequest) {
    var _a, _b, _c;
    if (!orderLevelNotes || orderLevelNotes.length === 0)
        return;
    if (orderLevelNotes.length !== 1) {
        throw new Error("Too many order level notes found for this service request: ".concat(orderLevelNotes.map(function (comm) { return "Communication/".concat(comm.id); })));
    }
    var orderLevelNote = orderLevelNotes[0];
    if (!orderLevelNote.basedOn || orderLevelNote.basedOn.length === 0) {
        console.warn("This communication is not linked to any service requests: ".concat(orderLevelNote.id));
        return;
    }
    if (((_a = orderLevelNote.basedOn) === null || _a === void 0 ? void 0 : _a.length) === 1) {
        // confirm the service request matches
        var sameServiceRequest = orderLevelNote.basedOn[0].reference === "ServiceRequest/".concat(serviceRequest.id);
        if (sameServiceRequest && orderLevelNote.id) {
            console.log('will delete the order level note communication', orderLevelNote.id);
            return {
                batchRequest: (0, helpers_2.makeSoftDeleteStatusPatchRequest)('Communication', orderLevelNote.id),
                targetReference: { reference: "Communication/".concat(orderLevelNote.id) },
            };
        }
        else {
            console.warn("This communication is linked to an unexpected service request: ".concat(orderLevelNote.id));
            return;
        }
    }
    else {
        // if other service requests are linked to the communication, just remove this one
        var pathIdx = (_b = orderLevelNote.basedOn) === null || _b === void 0 ? void 0 : _b.findIndex(function (serviceRequestRef) { return serviceRequestRef.reference === "ServiceRequest/".concat(serviceRequest.id); });
        console.log('will patch order level note communication, removing this service request', orderLevelNote.id);
        var communicationPatchRequest = {
            method: 'PATCH',
            url: "Communication/".concat(orderLevelNote.id),
            operations: [{ op: 'remove', path: "/basedOn/".concat(pathIdx) }],
            ifMatch: ((_c = orderLevelNote.meta) === null || _c === void 0 ? void 0 : _c.versionId) ? "W/\"".concat(orderLevelNote.meta.versionId, "\"") : undefined,
        };
        return {
            batchRequest: communicationPatchRequest,
            targetReference: { reference: "Communication/".concat(orderLevelNote.id) },
        };
    }
};
exports.makeCommunicationRequestForOrderNote = makeCommunicationRequestForOrderNote;
var makeCommunicationRequestForClinicalInfoNote = function (clinicalInfoNotesByUser, serviceRequest) {
    var _a;
    if (!clinicalInfoNotesByUser || clinicalInfoNotesByUser.length === 0)
        return;
    if (clinicalInfoNotesByUser.length > 1) {
        // if there is more than one clinical info note, something has gone wrong
        throw new Error("Something is misconfigured with notes for the lab you are trying to delete, related: ServiceRequest/".concat(serviceRequest.id, " ").concat(clinicalInfoNotesByUser.map(function (note) { return "Communication/".concat(note.id); })));
    }
    var clinicalInfoNote = clinicalInfoNotesByUser[0];
    if (((_a = clinicalInfoNote.basedOn) === null || _a === void 0 ? void 0 : _a.length) !== 1) {
        // if there is more than one service request linked to this note, something has gone wrong
        throw new Error("Something is misconfigured with the clinical info note for the lab you are trying to delete");
    }
    if (!clinicalInfoNote.id)
        throw new Error("communication is missing an id ".concat(clinicalInfoNote.id));
    return {
        batchRequest: (0, helpers_2.makeSoftDeleteStatusPatchRequest)('Communication', clinicalInfoNote.id),
        targetReference: { reference: "Communication/".concat(clinicalInfoNote.id) },
    };
};
exports.makeCommunicationRequestForClinicalInfoNote = makeCommunicationRequestForClinicalInfoNote;

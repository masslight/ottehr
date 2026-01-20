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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../lab/shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var canDeleteInHouseLabOrder = function (serviceRequest) {
    // these SR statuses cover the currently supported states of an order, so a user will be able to delete an order "at any point"
    // but it will reject already soft-deleted orders or any unexpected statuses
    return ['draft', 'active', 'completed'].includes(serviceRequest.status);
};
var getInHouseLabOrderRelatedResources = function (oystehr, serviceRequestId) { return __awaiter(void 0, void 0, void 0, function () {
    var searchResponse, results, serviceRequests, tasks, diagnosticReports, documentReferences, specimens, serviceRequest, task, diagnosticReport, documentReference, specimen, errorMessage, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: [
                            {
                                name: '_id',
                                value: serviceRequestId,
                            },
                            // this will grab any results for orders being deleted once results are already entered
                            {
                                name: '_revinclude',
                                value: 'DiagnosticReport:based-on',
                            },
                            // this will grab the result pdf if the order has had results entered
                            {
                                name: '_revinclude:iterate',
                                value: 'DocumentReference:related',
                            },
                            // this will grab tasks based on SR and DR, although there are no DR tasks for in house labs currently (e.g. a review task)
                            {
                                name: '_revinclude:iterate',
                                value: 'Task:based-on',
                            },
                            {
                                name: '_include',
                                value: 'ServiceRequest:specimen',
                            },
                        ],
                    })];
            case 1:
                searchResponse = (_a.sent()).unbundle();
                results = searchResponse.reduce(function (acc, resource) {
                    var _a;
                    if (resource.resourceType === 'ServiceRequest' && resource.id === serviceRequestId) {
                        acc.serviceRequests.push(resource);
                    }
                    else if (resource.resourceType === 'Task' &&
                        ((_a = resource.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (ref) { return ref.reference === "ServiceRequest/".concat(serviceRequestId); })) &&
                        ['ready', 'in-progress'].includes(resource.status)) {
                        acc.tasks.push(resource);
                    }
                    else if (resource.resourceType === 'DiagnosticReport') {
                        acc.diagnosticReports.push(resource);
                    }
                    else if (resource.resourceType === 'DocumentReference' && resource.status === 'current') {
                        acc.documentReferences.push(resource);
                    }
                    else if (resource.resourceType === 'Specimen') {
                        acc.specimens.push(resource);
                    }
                    return acc;
                }, {
                    serviceRequests: [],
                    tasks: [],
                    diagnosticReports: [],
                    documentReferences: [],
                    specimens: [],
                });
                console.log('These are the resources to soft delete: ', Object.fromEntries(Object.entries(results).map(function (_a) {
                    var key = _a[0], arr = _a[1];
                    return [key, arr.map(function (item) { return "".concat(item.resourceType, "/").concat(item.id); })];
                })));
                serviceRequests = results.serviceRequests, tasks = results.tasks, diagnosticReports = results.diagnosticReports, documentReferences = results.documentReferences, specimens = results.specimens;
                serviceRequest = serviceRequests[0] || null;
                task = tasks[0] || null;
                diagnosticReport = diagnosticReports[0] || null;
                documentReference = documentReferences[0] || null;
                specimen = specimens[0] || null;
                if (diagnosticReport || documentReference)
                    console.log("Found DiagnosticReport or DocRef to delete: DiagnosticReport/".concat(diagnosticReport.id, " or DocumentReference/").concat(documentReference.id));
                if (serviceRequest && !canDeleteInHouseLabOrder(serviceRequest)) {
                    errorMessage = "Cannot delete in-house lab order; ServiceRequest has status: ".concat(serviceRequest.status, ". Only draft, active, or completed orders can be deleted.");
                    console.error(errorMessage);
                    throw new Error(errorMessage);
                }
                return [2 /*return*/, {
                        serviceRequest: serviceRequest,
                        task: task,
                        diagnosticReport: diagnosticReport,
                        documentReference: documentReference,
                        specimen: specimen,
                    }];
            case 2:
                error_1 = _a.sent();
                console.error('Error fetching in-house lab order and related resources:', error_1);
                throw error_1;
            case 3: return [2 /*return*/];
        }
    });
}); };
var ZAMBDA_NAME = 'delete-in-house-lab-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, validatedParameters, serviceRequestId, userToken, oystehr, oystehrCurrentUser, currentUserPractitionerId, resources, requests_1, updatedResourceReferences_1, provenancePost, transactionResponse, response, error_2, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("delete-in-house-lab-order started, input: ".concat(JSON.stringify(input)));
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
                _a.label = 1;
            case 1:
                _a.trys.push([1, 7, , 8]);
                secrets = validatedParameters.secrets;
                serviceRequestId = validatedParameters.serviceRequestId, userToken = validatedParameters.userToken;
                console.log('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 3:
                currentUserPractitionerId = _a.sent();
                console.log("User initiating delete action is Practitioner/".concat(currentUserPractitionerId));
                return [4 /*yield*/, getInHouseLabOrderRelatedResources(oystehr, serviceRequestId)];
            case 4:
                resources = _a.sent();
                if (!resources.serviceRequest) {
                    return [2 /*return*/, {
                            statusCode: 404,
                            body: JSON.stringify({
                                message: "In-house lab order with ServiceRequest ID ".concat(serviceRequestId, " not found"),
                            }),
                        }];
                }
                requests_1 = [];
                updatedResourceReferences_1 = [];
                Object.values(resources).forEach(function (resource) {
                    if (resource && resource.id) {
                        requests_1.push((0, helpers_1.makeSoftDeleteStatusPatchRequest)(resource.resourceType, resource.id));
                        updatedResourceReferences_1.push({
                            reference: "".concat(resource.resourceType, "/").concat(resource.id),
                        });
                    }
                });
                provenancePost = {
                    method: 'POST',
                    url: '/Provenance',
                    resource: {
                        resourceType: 'Provenance',
                        target: updatedResourceReferences_1,
                        recorded: luxon_1.DateTime.now().toISO(),
                        agent: [{ who: { reference: "Practitioner/".concat(currentUserPractitionerId) } }],
                        activity: {
                            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder],
                        },
                    },
                };
                requests_1.push(provenancePost);
                if (!(requests_1.length > 0)) return [3 /*break*/, 6];
                console.log("Deleting in-house lab order for ServiceRequest ID: ".concat(serviceRequestId, "; requests: ").concat(JSON.stringify(requests_1, null, 2)));
                if (!(requests_1.length > 0)) return [3 /*break*/, 6];
                console.log("Deleting external lab order for service request id: ".concat(serviceRequestId, "; request: ").concat(JSON.stringify(requests_1, null, 2)));
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests_1 })];
            case 5:
                transactionResponse = _a.sent();
                console.log("Successfully soft deleted in house lab order. Response: ".concat(JSON.stringify(transactionResponse)));
                _a.label = 6;
            case 6:
                response = {};
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 7:
                error_2 = _a.sent();
                console.error('Error deleting in-house lab order:', error_2);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('delete-in-house-lab-order', error_2, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });

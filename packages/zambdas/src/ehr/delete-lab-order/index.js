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
var helpers_2 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('delete-lab-order', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, serviceRequestId, secrets, oystehr, oystehrCurrentUser, practitionerIdFromCurrentUser, _a, serviceRequest, questionnaireResponse, tasks, labConditions, communications, documentReferences, diagnosticReports, requests_1, targetResourcesForProvenance_1, orderNoteCommunicationRequest, clinicalInfoNoteRequest, curUserReference, provenancePost, response, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                serviceRequestId = validatedParameters.serviceRequestId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 2:
                practitionerIdFromCurrentUser = _b.sent();
                return [4 /*yield*/, (0, helpers_2.getLabOrderRelatedResources)(oystehr, validatedParameters)];
            case 3:
                _a = _b.sent(), serviceRequest = _a.serviceRequest, questionnaireResponse = _a.questionnaireResponse, tasks = _a.tasks, labConditions = _a.labConditions, communications = _a.communications, documentReferences = _a.documentReferences, diagnosticReports = _a.diagnosticReports;
                if (!serviceRequest) {
                    return [2 /*return*/, {
                            statusCode: 404,
                            body: JSON.stringify({ message: "Lab order with ID ".concat(serviceRequestId, " not found") }),
                        }];
                }
                requests_1 = [];
                targetResourcesForProvenance_1 = [];
                requests_1.push((0, helpers_1.makeSoftDeleteStatusPatchRequest)('ServiceRequest', serviceRequestId));
                targetResourcesForProvenance_1.push({ reference: "ServiceRequest/".concat(serviceRequestId) });
                if (questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.id) {
                    requests_1.push((0, helpers_1.makeSoftDeleteStatusPatchRequest)('QuestionnaireResponse', questionnaireResponse.id));
                    targetResourcesForProvenance_1.push({ reference: "QuestionnaireResponse/".concat(questionnaireResponse.id) });
                }
                if (tasks.length > 0) {
                    tasks.forEach(function (task) {
                        if (task.id) {
                            requests_1.push((0, helpers_1.makeSoftDeleteStatusPatchRequest)('Task', task.id));
                            targetResourcesForProvenance_1.push({ reference: "Task/".concat(task.id) });
                        }
                    });
                }
                labConditions.forEach(function (condition) {
                    if (condition.id) {
                        requests_1.push((0, helpers_2.makeDeleteResourceRequest)('Condition', condition.id));
                    }
                });
                orderNoteCommunicationRequest = (0, helpers_2.makeCommunicationRequestForOrderNote)(communications === null || communications === void 0 ? void 0 : communications.orderLevelNotesByUser, serviceRequest);
                if (orderNoteCommunicationRequest) {
                    requests_1.push(orderNoteCommunicationRequest.batchRequest);
                    targetResourcesForProvenance_1.push(orderNoteCommunicationRequest.targetReference);
                }
                clinicalInfoNoteRequest = (0, helpers_2.makeCommunicationRequestForClinicalInfoNote)(communications === null || communications === void 0 ? void 0 : communications.clinicalInfoNotesByUser, serviceRequest);
                if (clinicalInfoNoteRequest) {
                    requests_1.push(clinicalInfoNoteRequest.batchRequest);
                    targetResourcesForProvenance_1.push(clinicalInfoNoteRequest.targetReference);
                }
                if (documentReferences.length > 0) {
                    documentReferences.forEach(function (docRef) {
                        if (docRef.id) {
                            requests_1.push((0, helpers_1.makeSoftDeleteStatusPatchRequest)('DocumentReference', docRef.id));
                            targetResourcesForProvenance_1.push({ reference: "DocumentReference/".concat(docRef.id) });
                        }
                    });
                }
                if (diagnosticReports.length > 0) {
                    diagnosticReports.forEach(function (diagnosticReport) {
                        if (diagnosticReport.id) {
                            requests_1.push((0, helpers_1.makeSoftDeleteStatusPatchRequest)('DiagnosticReport', diagnosticReport.id));
                            targetResourcesForProvenance_1.push({ reference: "DiagnosticReport/".concat(diagnosticReport.id) });
                        }
                    });
                }
                curUserReference = { reference: "Practitioner/".concat(practitionerIdFromCurrentUser) };
                provenancePost = {
                    method: 'POST',
                    url: '/Provenance',
                    resource: {
                        resourceType: 'Provenance',
                        target: targetResourcesForProvenance_1,
                        recorded: luxon_1.DateTime.now().toISO(),
                        agent: [{ who: curUserReference }],
                        activity: {
                            coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder],
                        },
                    },
                };
                requests_1.push(provenancePost);
                if (!(requests_1.length > 0)) return [3 /*break*/, 5];
                console.log("Deleting external lab order for service request id: ".concat(serviceRequestId, "; request: ").concat(JSON.stringify(requests_1, null, 2)));
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests_1 })];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5:
                response = {};
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('delete-lab-order', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });

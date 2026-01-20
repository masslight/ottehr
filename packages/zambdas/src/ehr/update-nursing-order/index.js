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
exports.index = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, aws_serverless_1.wrapHandler)(function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, userToken, serviceRequestId_1, action, secrets, oystehr_1, oystehrCurrentUser, _practitionerIdFromCurrentUser, nursingOrderResourcesRequest, userPractitionerIdRequest, _a, orderResources, userPractitionerId, _b, serviceRequestSearchResults_1, taskSearchResults, serviceRequest, locationRef, relatedTask, taskStatus, taskPatchRequest, provenanceActivity, provenanceConfig, requestStatus, serviceRequestPatchRequest, transactionResponse, error_1, ENVIRONMENT;
    var _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                console.log("update-nursing-order started, input: ".concat(JSON.stringify(input)));
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
                _f.label = 1;
            case 1:
                _f.trys.push([1, 6, , 7]);
                userToken = validatedParameters.userToken, serviceRequestId_1 = validatedParameters.serviceRequestId, action = validatedParameters.action, secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _f.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 3:
                _practitionerIdFromCurrentUser = _f.sent();
                nursingOrderResourcesRequest = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, oystehr_1.fhir.search({
                                    resourceType: 'ServiceRequest',
                                    params: [
                                        {
                                            name: '_id',
                                            value: serviceRequestId_1,
                                        },
                                        {
                                            name: '_revinclude',
                                            value: 'Task:based-on',
                                        },
                                    ],
                                })];
                            case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                        }
                    });
                }); };
                userPractitionerIdRequest = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var oystehrCurrentUser_1, _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _b.trys.push([0, 2, , 3]);
                                oystehrCurrentUser_1 = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser_1)];
                            case 1: return [2 /*return*/, _b.sent()];
                            case 2:
                                _a = _b.sent();
                                throw Error('Resource configuration error - user creating this order must have a Practitioner resource linked');
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.all([
                        nursingOrderResourcesRequest(),
                        userPractitionerIdRequest(),
                    ])];
            case 4:
                _a = _f.sent(), orderResources = _a[0], userPractitionerId = _a[1];
                _b = orderResources.reduce(function (acc, resource) {
                    if (resource.resourceType === 'ServiceRequest')
                        acc.serviceRequestSearchResults.push(resource);
                    if (resource.resourceType === 'ServiceRequest')
                        acc.serviceRequestSearchResults.push(resource);
                    if (resource.resourceType === 'Task')
                        acc.taskSearchResults.push(resource);
                    if (resource.resourceType === 'Task')
                        acc.taskSearchResults.push(resource);
                    return acc;
                }, {
                    serviceRequestSearchResults: [],
                    taskSearchResults: [],
                }), serviceRequestSearchResults_1 = _b.serviceRequestSearchResults, taskSearchResults = _b.taskSearchResults;
                serviceRequest = (function () {
                    var targetEncounter = serviceRequestSearchResults_1.find(function (serviceRequest) { return serviceRequest.id === serviceRequestId_1; });
                    if (!targetEncounter)
                        throw Error('Encounter not found');
                    return targetEncounter;
                })();
                locationRef = (_c = serviceRequest.locationReference) === null || _c === void 0 ? void 0 : _c[0].reference;
                relatedTask = taskSearchResults[0];
                if (!relatedTask.id)
                    throw Error('related Task not found');
                taskStatus = getTaskStatusForAction(action);
                taskPatchRequest = (0, utils_1.getPatchBinary)({
                    resourceType: 'Task',
                    resourceId: relatedTask.id,
                    patchOperations: [
                        {
                            op: 'replace',
                            path: '/status',
                            value: taskStatus,
                        },
                    ],
                });
                provenanceActivity = getProvenanceActivity(action);
                provenanceConfig = __assign(__assign({ resourceType: 'Provenance', activity: {
                        coding: [provenanceActivity],
                    }, target: [{ reference: "ServiceRequest/".concat(serviceRequest.id) }] }, (locationRef && { location: { reference: locationRef } })), { recorded: luxon_1.DateTime.now().toISO(), agent: [
                        {
                            who: { reference: "Practitioner/".concat(userPractitionerId) },
                            onBehalfOf: { reference: (_d = serviceRequest.requester) === null || _d === void 0 ? void 0 : _d.reference },
                        },
                    ] });
                requestStatus = getRequestStatusForAction(action);
                serviceRequestPatchRequest = (0, utils_1.getPatchBinary)({
                    resourceType: 'ServiceRequest',
                    resourceId: serviceRequestId_1,
                    patchOperations: [
                        {
                            op: 'replace',
                            path: '/status',
                            value: requestStatus,
                        },
                    ],
                });
                return [4 /*yield*/, oystehr_1.fhir.transaction({
                        requests: [
                            taskPatchRequest,
                            serviceRequestPatchRequest,
                            {
                                method: 'POST',
                                url: '/Provenance',
                                resource: provenanceConfig,
                            },
                        ],
                    })];
            case 5:
                transactionResponse = _f.sent();
                if (!((_e = transactionResponse.entry) === null || _e === void 0 ? void 0 : _e.every(function (entry) { var _a; return ((_a = entry.response) === null || _a === void 0 ? void 0 : _a.status[0]) === '2'; }))) {
                    throw Error('Error creating nursing order in transaction');
                }
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            transactionResponse: transactionResponse,
                        }),
                    }];
            case 6:
                error_1 = _f.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-nursing-order', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
var getTaskStatusForAction = function (action) {
    switch (action) {
        case 'COMPLETE ORDER':
            return 'completed';
        case 'CANCEL ORDER':
            return 'cancelled';
        default:
            throw new Error("Unsupported action: ".concat(action));
    }
};
var getRequestStatusForAction = function (action) {
    switch (action) {
        case 'COMPLETE ORDER':
            return 'completed';
        case 'CANCEL ORDER':
            return 'revoked';
        default:
            throw new Error("Unsupported action: ".concat(action));
    }
};
var getProvenanceActivity = function (action) {
    switch (action) {
        case 'COMPLETE ORDER':
            return utils_1.NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.completeOrder;
        case 'CANCEL ORDER':
            return utils_1.NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.cancelOrder;
        default:
            throw new Error("Unsupported action: ".concat(action));
    }
};

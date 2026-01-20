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
var crypto_1 = require("crypto");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var tasks_1 = require("../../shared/tasks");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'collect-in-house-lab-specimen';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, validatedParameters, oystehr, oystehrCurrentUser, encounterId, serviceRequestId, data, userPractitionerId, _a, serviceRequestResources, tasksCSTResources, userPractitioner, encounter, practitionerFromEncounterId, serviceRequestEncounterId, serviceRequest, collectionTask, specimenFullUrl, specimenConfig, serviceRequestUpdateConfig, collectionTaskUpdateConfig, inputResultTaskConfig, transactionResponse, response, error_1, ENVIRONMENT;
    var _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                console.log("collect-in-house-lab-specimen started, input: ".concat(JSON.stringify(input)));
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
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, , 7]);
                secrets = validatedParameters.secrets;
                console.log('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _h.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                encounterId = validatedParameters.encounterId, serviceRequestId = validatedParameters.serviceRequestId, data = validatedParameters.data;
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 3:
                userPractitionerId = _h.sent();
                return [4 /*yield*/, Promise.all([
                        oystehr.fhir.get({
                            resourceType: 'ServiceRequest',
                            id: serviceRequestId,
                        }),
                        oystehr.fhir
                            .search({
                            resourceType: 'Task',
                            params: [
                                {
                                    name: 'based-on',
                                    value: "ServiceRequest/".concat(serviceRequestId),
                                },
                                {
                                    name: 'code',
                                    value: "".concat(utils_1.IN_HOUSE_LAB_TASK.system, "|").concat(utils_1.IN_HOUSE_LAB_TASK.code.collectSampleTask),
                                },
                            ],
                        })
                            .then(function (bundle) { return bundle.unbundle(); }),
                        oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: userPractitionerId,
                        }),
                        oystehr.fhir.get({
                            resourceType: 'Encounter',
                            id: encounterId,
                        }),
                    ])];
            case 4:
                _a = _h.sent(), serviceRequestResources = _a[0], tasksCSTResources = _a[1], userPractitioner = _a[2], encounter = _a[3];
                practitionerFromEncounterId = (0, utils_1.getAttendingPractitionerId)(encounter);
                if (practitionerFromEncounterId !== validatedParameters.data.specimen.collectedBy.id &&
                    userPractitionerId !== validatedParameters.data.specimen.collectedBy.id) {
                    // todo: not sure about this check, but looks better to have it, without this any participant may be set with custom request
                    throw Error('Practitioner mismatch');
                }
                serviceRequestEncounterId = (_c = (_b = serviceRequestResources === null || serviceRequestResources === void 0 ? void 0 : serviceRequestResources.encounter) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Encounter/', '');
                if (!serviceRequestEncounterId || serviceRequestEncounterId !== encounterId) {
                    throw Error("ServiceRequest with id ".concat(serviceRequestId, " is not associated with encounter ").concat(encounterId));
                }
                serviceRequest = serviceRequestResources;
                if (tasksCSTResources.length !== 1) {
                    throw Error("Expected 1 collection task, found ".concat(tasksCSTResources.length));
                }
                console.log('These are the tasksCSTResources', JSON.stringify(tasksCSTResources));
                collectionTask = tasksCSTResources[0];
                if (!collectionTask.id) {
                    throw Error('Collection task has no ID');
                }
                if (collectionTask.status === 'completed') {
                    console.error('Detected completed CST task');
                    throw Error('Collection task has already been completed. Refresh the page before continuing.');
                }
                specimenFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                specimenConfig = {
                    resourceType: 'Specimen',
                    status: 'available',
                    request: [
                        {
                            reference: "ServiceRequest/".concat(serviceRequestId),
                        },
                    ],
                    subject: {
                        reference: ((_d = serviceRequest.subject) === null || _d === void 0 ? void 0 : _d.reference) || '',
                    },
                    collection: {
                        collector: {
                            reference: "Practitioner/".concat(data.specimen.collectedBy.id),
                            display: data.specimen.collectedBy.name,
                        },
                        collectedDateTime: data.specimen.collectionDate,
                        bodySite: {
                            coding: [
                                {
                                    // todo when we have a standardize input we should switch this system
                                    system: utils_1.SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
                                    display: data.specimen.source,
                                },
                            ],
                        },
                    },
                };
                serviceRequestUpdateConfig = __assign(__assign({}, serviceRequest), { status: 'active', specimen: [{ reference: specimenFullUrl }] });
                collectionTaskUpdateConfig = __assign(__assign({}, collectionTask), { status: 'completed', owner: collectionTask.owner
                        ? collectionTask.owner
                        : (0, tasks_1.createOwnerReference)((_e = userPractitioner.id) !== null && _e !== void 0 ? _e : '', (_f = (0, utils_1.getFullestAvailableName)(userPractitioner)) !== null && _f !== void 0 ? _f : '') });
                inputResultTaskConfig = (0, tasks_1.createTask)({
                    category: utils_1.IN_HOUSE_LAB_TASK.category,
                    code: {
                        system: utils_1.IN_HOUSE_LAB_TASK.system,
                        code: utils_1.IN_HOUSE_LAB_TASK.code.inputResultsTask,
                    },
                    encounterId: encounterId,
                    location: (0, tasks_1.getTaskLocation)(collectionTask),
                    input: collectionTask.input,
                    basedOn: ["ServiceRequest/".concat(serviceRequestId)],
                });
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [
                            {
                                method: 'POST',
                                url: '/Specimen',
                                resource: specimenConfig,
                                fullUrl: specimenFullUrl,
                            },
                            {
                                method: 'PUT',
                                url: "/ServiceRequest/".concat(serviceRequestId),
                                resource: serviceRequestUpdateConfig,
                            },
                            {
                                method: 'PUT',
                                url: "/Task/".concat(collectionTask.id),
                                resource: collectionTaskUpdateConfig,
                            },
                            {
                                method: 'POST',
                                url: '/Task',
                                resource: inputResultTaskConfig,
                            },
                        ],
                    })];
            case 5:
                transactionResponse = _h.sent();
                if (!((_g = transactionResponse.entry) === null || _g === void 0 ? void 0 : _g.every(function (entry) { var _a; return ((_a = entry.response) === null || _a === void 0 ? void 0 : _a.status[0]) === '2'; }))) {
                    throw Error('Error collecting in-house lab specimen in transaction');
                }
                response = {};
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _h.sent();
                console.error('Error collecting in-house lab specimen:', error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('collect-in-house-lab-specimen', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });

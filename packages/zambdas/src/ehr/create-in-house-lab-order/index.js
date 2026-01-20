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
exports.index = void 0;
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var tasks_1 = require("../../shared/tasks");
var labs_1 = require("../shared/labs");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'create-in-house-lab-order';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, validatedParameters, oystehr_1, oystehrCurrentUser, encounterId_1, testItem_1, cptCode, diagnosesAll, diagnosesNew, isRepeatTest_1, notes, encounterResourcesRequest, activeDefinitionRequest, userPractitionerIdRequest, requests, initialServiceRequestSearch, results, _a, encounterResources, activeDefinitionResources_1, userPractitionerId, initialServiceRequestResources_1, _b, encounterSearchResults_1, coverageSearchResults, accountSearchResults_1, patientsSearchResults_1, locationsSearchResults, activityDefinition, parentTestCanonicalUrl_1, encounter, patient, account, initialServiceRequest, attendingPractitionerId, _c, currentUserPractitionerName, attendingPractitionerName, coverage, location_1, serviceRequestFullUrl, serviceRequestConfig, taskConfig, provenanceConfig, procedureConfig, transactionResponse, resources, newServiceRequest, saveChartDataResponse, _d, response, error_1, body, statusCode, _e, code, message;
    var _f, _g, _h, _j, _k, _l, _m, _o, _p;
    return __generator(this, function (_q) {
        switch (_q.label) {
            case 0:
                console.log("create-in-house-lab-order started, input: ".concat(JSON.stringify(input)));
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
                _q.label = 1;
            case 1:
                _q.trys.push([1, 10, , 11]);
                secrets = validatedParameters.secrets;
                console.log('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _q.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                encounterId_1 = validatedParameters.encounterId, testItem_1 = validatedParameters.testItem, cptCode = validatedParameters.cptCode, diagnosesAll = validatedParameters.diagnosesAll, diagnosesNew = validatedParameters.diagnosesNew, isRepeatTest_1 = validatedParameters.isRepeatTest, notes = validatedParameters.notes;
                encounterResourcesRequest = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, oystehr_1.fhir.search({
                                    resourceType: 'Encounter',
                                    params: [
                                        {
                                            name: '_id',
                                            value: encounterId_1,
                                        },
                                        {
                                            name: '_include',
                                            value: 'Encounter:patient',
                                        },
                                        {
                                            name: '_include',
                                            value: 'Encounter:location',
                                        },
                                        {
                                            name: '_revinclude:iterate',
                                            value: 'Coverage:patient',
                                        },
                                        {
                                            name: '_revinclude:iterate',
                                            value: 'Account:patient',
                                        },
                                    ],
                                })];
                            case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                        }
                    });
                }); };
                activeDefinitionRequest = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, oystehr_1.fhir.search({
                                    resourceType: 'ActivityDefinition',
                                    params: [
                                        {
                                            name: 'url',
                                            value: testItem_1.adUrl,
                                        },
                                        {
                                            name: 'version',
                                            value: testItem_1.adVersion,
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
                                throw Error('Resource configuration error - user creating this in-house lab order must have a Practitioner resource linked');
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                requests = [encounterResourcesRequest(), activeDefinitionRequest(), userPractitionerIdRequest()];
                if (isRepeatTest_1) {
                    console.log('run as repeat for', cptCode, testItem_1.name);
                    initialServiceRequestSearch = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, oystehr_1.fhir.search({
                                        resourceType: 'ServiceRequest',
                                        params: [
                                            {
                                                name: 'encounter',
                                                value: "Encounter/".concat(encounterId_1),
                                            },
                                            {
                                                name: 'instantiates-canonical',
                                                value: "".concat(testItem_1.adUrl, "|").concat(testItem_1.adVersion),
                                            },
                                        ],
                                    })];
                                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
                            }
                        });
                    }); };
                    requests.push(initialServiceRequestSearch());
                }
                return [4 /*yield*/, Promise.all(requests)];
            case 3:
                results = _q.sent();
                _a = results, encounterResources = _a[0], activeDefinitionResources_1 = _a[1], userPractitionerId = _a[2], initialServiceRequestResources_1 = _a[3];
                _b = encounterResources.reduce(function (acc, resource) {
                    if (resource.resourceType === 'Encounter')
                        acc.encounterSearchResults.push(resource);
                    if (resource.resourceType === 'Patient')
                        acc.patientsSearchResults.push(resource);
                    if (resource.resourceType === 'Location')
                        acc.locationsSearchResults.push(resource);
                    if (resource.resourceType === 'Coverage' && resource.status === 'active')
                        acc.coverageSearchResults.push(resource);
                    if (resource.resourceType === 'Account' && resource.status === 'active') {
                        if ((0, labs_1.accountIsPatientBill)(resource))
                            acc.accountSearchResults.push(resource);
                    }
                    return acc;
                }, {
                    encounterSearchResults: [],
                    patientsSearchResults: [],
                    coverageSearchResults: [],
                    accountSearchResults: [],
                    locationsSearchResults: [],
                }), encounterSearchResults_1 = _b.encounterSearchResults, coverageSearchResults = _b.coverageSearchResults, accountSearchResults_1 = _b.accountSearchResults, patientsSearchResults_1 = _b.patientsSearchResults, locationsSearchResults = _b.locationsSearchResults;
                activityDefinition = (function () {
                    if (activeDefinitionResources_1.length !== 1) {
                        throw Error("ActivityDefinition not found, results contain ".concat(activeDefinitionResources_1.length, " activity definitions, ids: ").concat(activeDefinitionResources_1
                            .map(function (resource) { return "ActivityDefinition/".concat(resource.id); })
                            .join(', ')));
                    }
                    var activeDefinition = activeDefinitionResources_1[0];
                    if (activeDefinition.status !== 'active' || !activeDefinition.id || !activeDefinition.url) {
                        throw Error("ActivityDefinition is not active or has no id or is missing a canonical url, status: ".concat(activeDefinition.status, ", id: ").concat(activeDefinition.id, ", url: ").concat(activeDefinition.url));
                    }
                    return activeDefinition;
                })();
                (_f = activityDefinition.relatedArtifact) === null || _f === void 0 ? void 0 : _f.forEach(function (artifact) {
                    var isDependent = artifact.type === 'depends-on';
                    var isRelatedViaReflex = artifact.display === utils_1.REFLEX_ARTIFACT_DISPLAY;
                    if (isDependent && isRelatedViaReflex) {
                        // todo labs this will take the last one it finds, so if we ever have a test be triggered by multiple parents, we'll need to update this
                        parentTestCanonicalUrl_1 = artifact.resource;
                    }
                });
                encounter = (function () {
                    var targetEncounter = encounterSearchResults_1.find(function (encounter) { return encounter.id === encounterId_1; });
                    if (!targetEncounter)
                        throw Error('Encounter not found');
                    return targetEncounter;
                })();
                patient = (function () {
                    if (patientsSearchResults_1.length !== 1) {
                        throw Error("Patient not found, results contain ".concat(patientsSearchResults_1.length, " patients"));
                    }
                    return patientsSearchResults_1[0];
                })();
                account = (function () {
                    if (accountSearchResults_1.length !== 1) {
                        throw Error("Account not found, results contain ".concat(accountSearchResults_1.length, " accounts"));
                    }
                    return accountSearchResults_1[0];
                })();
                return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var possibleInitialSRs, initialSR, serviceRequestSearch, parentRequest;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!isRepeatTest_1) return [3 /*break*/, 1];
                                    if (!initialServiceRequestResources_1 || initialServiceRequestResources_1.length === 0) {
                                        throw (0, utils_1.IN_HOUSE_LAB_ERROR)('You cannot run this as repeat, no initial tests could be found for this encounter.');
                                    }
                                    possibleInitialSRs = initialServiceRequestResources_1.reduce(function (acc, sr) {
                                        if (!sr.basedOn)
                                            acc.push(sr);
                                        return acc;
                                    }, []);
                                    if (possibleInitialSRs.length > 1) {
                                        console.log('More than one initial tests found for this encounter');
                                        // this really shouldn't happen, something is misconfigured
                                        throw (0, utils_1.IN_HOUSE_LAB_ERROR)('Could not deduce which test is initial since more than one test has previously been run today');
                                    }
                                    if (possibleInitialSRs.length === 0) {
                                        // this really shouldn't happen, something is misconfigured
                                        throw (0, utils_1.IN_HOUSE_LAB_ERROR)('No initial tests could be found for this encounter.');
                                    }
                                    initialSR = possibleInitialSRs[0];
                                    return [2 /*return*/, initialSR];
                                case 1:
                                    if (!parentTestCanonicalUrl_1) return [3 /*break*/, 3];
                                    console.log('searching for parent test', parentTestCanonicalUrl_1);
                                    return [4 /*yield*/, oystehr_1.fhir.search({
                                            resourceType: 'ServiceRequest',
                                            params: [
                                                {
                                                    name: 'encounter',
                                                    value: "Encounter/".concat(encounterId_1),
                                                },
                                                {
                                                    name: 'code',
                                                    value: "".concat(utils_1.IN_HOUSE_TEST_CODE_SYSTEM, "|"),
                                                },
                                                {
                                                    name: '_sort',
                                                    value: '-_lastUpdated',
                                                },
                                            ],
                                        })];
                                case 2:
                                    serviceRequestSearch = (_a.sent()).unbundle();
                                    parentRequest = serviceRequestSearch.find(function (sr) {
                                        var _a, _b, _c;
                                        var isParentTest = (_a = sr.instantiatesCanonical) === null || _a === void 0 ? void 0 : _a.some(function (url) { return url === parentTestCanonicalUrl_1; });
                                        var hasPendingTestTag = (_c = (_b = sr.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (t) {
                                            return t.system === utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM &&
                                                t.code === utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending;
                                        });
                                        return isParentTest && hasPendingTestTag;
                                    });
                                    console.log('parentRequest', parentRequest === null || parentRequest === void 0 ? void 0 : parentRequest.id);
                                    return [2 /*return*/, parentRequest];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); })()];
            case 4:
                initialServiceRequest = _q.sent();
                attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                if (!attendingPractitionerId)
                    throw Error('Attending practitioner not found');
                return [4 /*yield*/, Promise.all([
                        oystehrCurrentUser.fhir.get({
                            resourceType: 'Practitioner',
                            id: userPractitionerId,
                        }),
                        oystehrCurrentUser.fhir.get({
                            resourceType: 'Practitioner',
                            id: attendingPractitionerId,
                        }),
                    ]).then(function (_a) {
                        var currentUserPractitioner = _a[0], attendingPractitioner = _a[1];
                        return {
                            currentUserPractitionerName: (0, utils_1.getFullestAvailableName)(currentUserPractitioner),
                            attendingPractitionerName: (0, utils_1.getFullestAvailableName)(attendingPractitioner),
                        };
                    })];
            case 5:
                _c = _q.sent(), currentUserPractitionerName = _c.currentUserPractitionerName, attendingPractitionerName = _c.attendingPractitionerName;
                coverage = (0, labs_1.getPrimaryInsurance)(account, coverageSearchResults);
                location_1 = locationsSearchResults[0];
                serviceRequestFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                serviceRequestConfig = __assign(__assign(__assign(__assign({ resourceType: 'ServiceRequest', status: 'draft', intent: 'order', subject: {
                        reference: "Patient/".concat(patient.id),
                    }, encounter: {
                        reference: "Encounter/".concat(encounterId_1),
                    }, requester: {
                        reference: "Practitioner/".concat(attendingPractitionerId),
                    }, authoredOn: luxon_1.DateTime.now().toISO() || undefined, priority: 'stat', code: {
                        coding: (_g = activityDefinition.code) === null || _g === void 0 ? void 0 : _g.coding,
                        text: activityDefinition.name,
                    }, reasonCode: __spreadArray([], diagnosesAll, true).map(function (diagnosis) {
                        return {
                            coding: [
                                {
                                    system: utils_1.FHIR_IDC10_VALUESET_SYSTEM,
                                    code: diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.code,
                                    display: diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.display,
                                },
                            ],
                            text: diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.display,
                        };
                    }) }, (location_1 && {
                    locationReference: [
                        {
                            type: 'Location',
                            reference: "Location/".concat(location_1.id),
                        },
                    ],
                })), (notes && { note: [{ text: notes }] })), (coverage && { insurance: [{ reference: "Coverage/".concat(coverage.id) }] })), { instantiatesCanonical: ["".concat(activityDefinition.url, "|").concat(activityDefinition.version)] });
                // if an initialServiceRequest is defined, the test being ordered is repeat OR reflex and should be linked to the
                // original test represented by initialServiceRequest
                if (initialServiceRequest) {
                    serviceRequestConfig.basedOn = [
                        {
                            reference: "ServiceRequest/".concat(initialServiceRequest.id),
                        },
                    ];
                }
                taskConfig = (0, tasks_1.createTask)({
                    category: utils_1.IN_HOUSE_LAB_TASK.category,
                    code: {
                        system: utils_1.IN_HOUSE_LAB_TASK.system,
                        code: utils_1.IN_HOUSE_LAB_TASK.code.collectSampleTask,
                    },
                    encounterId: encounterId_1,
                    location: (location_1 === null || location_1 === void 0 ? void 0 : location_1.id)
                        ? {
                            id: location_1.id,
                        }
                        : undefined,
                    input: [
                        {
                            type: utils_1.IN_HOUSE_LAB_TASK.input.testName,
                            valueString: activityDefinition.name,
                        },
                        {
                            type: utils_1.IN_HOUSE_LAB_TASK.input.patientName,
                            valueString: (0, utils_1.getFullestAvailableName)(patient),
                        },
                        {
                            type: utils_1.IN_HOUSE_LAB_TASK.input.providerName,
                            valueString: currentUserPractitionerName !== null && currentUserPractitionerName !== void 0 ? currentUserPractitionerName : 'Unknown',
                        },
                        {
                            type: utils_1.IN_HOUSE_LAB_TASK.input.orderDate,
                            valueString: serviceRequestConfig.authoredOn,
                        },
                        {
                            type: utils_1.IN_HOUSE_LAB_TASK.input.appointmentId,
                            valueString: (_l = (_k = (_j = (_h = encounter.appointment) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.split('/')) === null || _l === void 0 ? void 0 : _l[1],
                        },
                    ],
                    basedOn: [serviceRequestFullUrl],
                });
                provenanceConfig = __assign(__assign({ resourceType: 'Provenance', activity: {
                        coding: [utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
                    }, target: [{ reference: serviceRequestFullUrl }] }, (location_1 && { location: { reference: "Location/".concat(location_1.id) } })), { recorded: luxon_1.DateTime.now().toISO(), agent: [
                        {
                            who: {
                                reference: "Practitioner/".concat(userPractitionerId),
                                display: currentUserPractitionerName,
                            },
                            onBehalfOf: {
                                reference: "Practitioner/".concat(attendingPractitionerId),
                                display: attendingPractitionerName,
                            },
                        },
                    ] });
                procedureConfig = {
                    resourceType: 'Procedure',
                    status: 'completed',
                    subject: {
                        reference: "Patient/".concat(patient.id),
                    },
                    encounter: {
                        reference: "Encounter/".concat(encounterId_1),
                    },
                    performer: [
                        {
                            actor: {
                                reference: "Practitioner/".concat(attendingPractitionerId),
                            },
                        },
                    ],
                    code: {
                        coding: [
                            __assign(__assign({}, (_o = (_m = activityDefinition.code) === null || _m === void 0 ? void 0 : _m.coding) === null || _o === void 0 ? void 0 : _o.find(function (coding) { return coding.system === 'http://www.ama-assn.org/go/cpt'; })), { display: activityDefinition.name }),
                        ],
                    },
                    meta: (0, shared_1.fillMeta)('cpt-code', 'cpt-code'), // This is necessary to get the Assessment part of the chart showing the CPT codes. It is some kind of save-chart-data feature that this meta is used to find and save the CPT codes instead of just looking at the FHIR Procedure resources code values.
                };
                return [4 /*yield*/, oystehr_1.fhir.transaction({
                        requests: [
                            {
                                method: 'POST',
                                url: '/ServiceRequest',
                                resource: serviceRequestConfig,
                                fullUrl: serviceRequestFullUrl,
                            },
                            {
                                method: 'POST',
                                url: '/Task',
                                resource: taskConfig,
                            },
                            {
                                method: 'POST',
                                url: '/Provenance',
                                resource: provenanceConfig,
                            },
                            {
                                method: 'POST',
                                url: '/Procedure',
                                resource: procedureConfig,
                            },
                        ],
                    })];
            case 6:
                transactionResponse = _q.sent();
                resources = (0, shared_1.parseCreatedResourcesBundle)(transactionResponse);
                newServiceRequest = resources.find(function (r) { return r.resourceType === 'ServiceRequest'; });
                if (!((_p = transactionResponse.entry) === null || _p === void 0 ? void 0 : _p.every(function (entry) { var _a; return ((_a = entry.response) === null || _a === void 0 ? void 0 : _a.status[0]) === '2'; }))) {
                    throw Error('Error creating in-house lab order in transaction');
                }
                if (!diagnosesNew.length) return [3 /*break*/, 8];
                return [4 /*yield*/, oystehrCurrentUser.zambda.execute({
                        id: 'save-chart-data',
                        encounterId: encounterId_1,
                        diagnosis: diagnosesNew,
                    })];
            case 7:
                _d = _q.sent();
                return [3 /*break*/, 9];
            case 8:
                _d = {};
                _q.label = 9;
            case 9:
                saveChartDataResponse = _d;
                response = __assign({ transactionResponse: transactionResponse, saveChartDataResponse: saveChartDataResponse }, (newServiceRequest && { serviceRequestId: newServiceRequest.id }));
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 10:
                error_1 = _q.sent();
                console.error('Error creating in-house lab order:', JSON.stringify(error_1), error_1);
                body = JSON.stringify({ message: "Error creating in-house lab order: ".concat(error_1.message || error_1) });
                statusCode = 500;
                if ((0, utils_1.isApiError)(error_1)) {
                    _e = error_1, code = _e.code, message = _e.message;
                    body = JSON.stringify({ message: message, code: code });
                    statusCode = 400;
                    return [2 /*return*/, {
                            statusCode: statusCode,
                            body: body,
                        }];
                }
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 11: return [2 /*return*/];
        }
    });
}); });

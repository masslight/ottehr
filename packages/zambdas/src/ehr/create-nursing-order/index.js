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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var labs_1 = require("../shared/labs");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('create-nursing-order', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, userToken_1, secrets_1, encounterId_1, notes, oystehr_1, encounterResourcesRequest, userPractitionerIdRequest, _a, encounterResources, userPractitionerId, _b, encounterSearchResults_1, coverageSearchResults, accountSearchResults_1, patientsSearchResults_1, locationsSearchResults, encounter_1, patient, account, attendingPractitionerId, coverage, location_1, serviceRequestFullUrl, serviceRequestConfig, taskConfig, provenanceConfig, transactionResponse, error_1, ENVIRONMENT;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log("create-nursing-order started, input: ".concat(JSON.stringify(input)));
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
                _d.label = 1;
            case 1:
                _d.trys.push([1, 5, , 6]);
                userToken_1 = validatedParameters.userToken, secrets_1 = validatedParameters.secrets, encounterId_1 = validatedParameters.encounterId, notes = validatedParameters.notes;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets_1)];
            case 2:
                m2mToken = _d.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets_1);
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
                userPractitionerIdRequest = function () { return __awaiter(void 0, void 0, void 0, function () {
                    var oystehrCurrentUser, _a;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _b.trys.push([0, 2, , 3]);
                                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken_1, secrets_1);
                                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
                            case 1: return [2 /*return*/, _b.sent()];
                            case 2:
                                _a = _b.sent();
                                throw Error('Resource configuration error - user creating this order must have a Practitioner resource linked');
                            case 3: return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.all([
                        encounterResourcesRequest(),
                        userPractitionerIdRequest(),
                    ])];
            case 3:
                _a = _d.sent(), encounterResources = _a[0], userPractitionerId = _a[1];
                _b = encounterResources.reduce(function (acc, resource) {
                    var _a, _b;
                    if (resource.resourceType === 'Encounter')
                        acc.encounterSearchResults.push(resource);
                    if (resource.resourceType === 'Patient')
                        acc.patientsSearchResults.push(resource);
                    if (resource.resourceType === 'Location')
                        acc.locationsSearchResults.push(resource);
                    if (resource.resourceType === 'Coverage' && resource.status === 'active')
                        acc.coverageSearchResults.push(resource);
                    if (resource.resourceType === 'Account' &&
                        resource.status === 'active' &&
                        ((_b = (_a = resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) {
                            var _a, _b;
                            return coding.code === ((_a = utils_1.PATIENT_BILLING_ACCOUNT_TYPE === null || utils_1.PATIENT_BILLING_ACCOUNT_TYPE === void 0 ? void 0 : utils_1.PATIENT_BILLING_ACCOUNT_TYPE.coding) === null || _a === void 0 ? void 0 : _a[0].code) &&
                                coding.system === ((_b = utils_1.PATIENT_BILLING_ACCOUNT_TYPE === null || utils_1.PATIENT_BILLING_ACCOUNT_TYPE === void 0 ? void 0 : utils_1.PATIENT_BILLING_ACCOUNT_TYPE.coding) === null || _b === void 0 ? void 0 : _b[0].system);
                        })))
                        acc.accountSearchResults.push(resource);
                    return acc;
                }, {
                    encounterSearchResults: [],
                    patientsSearchResults: [],
                    coverageSearchResults: [],
                    accountSearchResults: [],
                    locationsSearchResults: [],
                }), encounterSearchResults_1 = _b.encounterSearchResults, coverageSearchResults = _b.coverageSearchResults, accountSearchResults_1 = _b.accountSearchResults, patientsSearchResults_1 = _b.patientsSearchResults, locationsSearchResults = _b.locationsSearchResults;
                encounter_1 = (function () {
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
                attendingPractitionerId = (function () {
                    var practitionerId = (0, utils_1.getAttendingPractitionerId)(encounter_1);
                    if (!practitionerId)
                        throw Error('Attending practitioner not found');
                    return practitionerId;
                })();
                coverage = (0, labs_1.getPrimaryInsurance)(account, coverageSearchResults);
                location_1 = locationsSearchResults[0];
                serviceRequestFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                serviceRequestConfig = __assign(__assign(__assign(__assign({ resourceType: 'ServiceRequest', status: 'draft', intent: 'order', subject: {
                        reference: "Patient/".concat(patient.id),
                    }, encounter: {
                        reference: "Encounter/".concat(encounterId_1),
                    }, requester: {
                        reference: "Practitioner/".concat(attendingPractitionerId),
                    }, authoredOn: luxon_1.DateTime.now().toISO() || undefined, priority: 'stat' }, (location_1 && {
                    locationReference: [
                        {
                            type: 'Location',
                            reference: "Location/".concat(location_1.id),
                        },
                    ],
                })), { meta: (0, shared_1.fillMeta)('nursing order', 'order-type-tag') }), (notes && { note: [{ text: notes }] })), (coverage && { insurance: [{ reference: "Coverage/".concat(coverage.id) }] }));
                taskConfig = __assign({ resourceType: 'Task', status: 'requested', basedOn: [{ reference: serviceRequestFullUrl }], encounter: { reference: "Encounter/".concat(encounterId_1) }, authoredOn: luxon_1.DateTime.now().toISO(), intent: 'order' }, (location_1 && { location: { reference: "Location/".concat(location_1.id) } }));
                provenanceConfig = __assign(__assign({ resourceType: 'Provenance', activity: {
                        coding: [utils_1.NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
                    }, target: [{ reference: serviceRequestFullUrl }] }, (location_1 && { location: { reference: "Location/".concat(location_1.id) } })), { recorded: luxon_1.DateTime.now().toISO(), agent: [
                        {
                            who: { reference: "Practitioner/".concat(userPractitionerId) },
                            onBehalfOf: { reference: "Practitioner/".concat(attendingPractitionerId) },
                        },
                    ] });
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
                        ],
                    })];
            case 4:
                transactionResponse = _d.sent();
                if (!((_c = transactionResponse.entry) === null || _c === void 0 ? void 0 : _c.every(function (entry) { var _a; return ((_a = entry.response) === null || _a === void 0 ? void 0 : _a.status[0]) === '2'; }))) {
                    throw Error('Error creating nursing order in transaction');
                }
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            transactionResponse: transactionResponse,
                        }),
                    }];
            case 5:
                error_1 = _d.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-nursing-order', error_1, ENVIRONMENT)];
            case 6: return [2 /*return*/];
        }
    });
}); });

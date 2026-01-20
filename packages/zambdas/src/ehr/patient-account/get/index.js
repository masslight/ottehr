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
var utils_1 = require("utils");
var utils_2 = require("utils");
var shared_1 = require("../../../shared");
var harvest_1 = require("../../shared/harvest");
var ZAMBDA_NAME = 'get-patient-account';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, resources, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, performEffect(validatedParameters, oystehr)];
            case 2:
                resources = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(resources),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, accountAndCoverages, primaryCarePhysician, eligibilityCheckIds, eligibilityCheckResults, coverageIdsToFetch, coverageRequests, coverages, mapped, patient, pharmacy;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                patientId = input.patientId;
                console.log('performing effect for patient account get');
                console.time('getAccountAndCoverageResourcesForPatient');
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehr)];
            case 1:
                accountAndCoverages = _e.sent();
                console.timeEnd('getAccountAndCoverageResourcesForPatient');
                primaryCarePhysician = (_b = (_a = accountAndCoverages.patient) === null || _a === void 0 ? void 0 : _a.contained) === null || _b === void 0 ? void 0 : _b.find(function (resource) { return resource.resourceType === 'Practitioner' && resource.active === true; });
                // due to really huge CEResponses causing response-too-large errors, we need to chop our querying for the CEResponses into
                // manageable chunks. We'll do this by first querying for just the IDs of the CEResponses, then querying for the full resources in parallel.
                // Even just two resources returned in a query can still result in response-too-large errors based on prod data we've encountered.
                console.time('fetching CER IDs');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'CoverageEligibilityResponse',
                        params: [
                            {
                                name: "patient._id",
                                value: patientId,
                            },
                            {
                                name: '_sort',
                                value: '-created',
                            },
                            {
                                name: '_elements',
                                value: 'id',
                            },
                            {
                                name: '_count', // we shouldn't need more than the most recent 10 eligibility checks
                                value: '10',
                            },
                        ],
                    })];
            case 2:
                eligibilityCheckIds = (_e.sent())
                    .unbundle()
                    .map(function (cer) { return cer.id; })
                    .filter(function (id) { return !!id; });
                console.log('fetching the following CERs:', JSON.stringify(eligibilityCheckIds));
                return [4 /*yield*/, Promise.all(eligibilityCheckIds.map(function (id) {
                        return oystehr.fhir.get({ resourceType: 'CoverageEligibilityResponse', id: id });
                    }))];
            case 3:
                eligibilityCheckResults = _e.sent();
                coverageIdsToFetch = eligibilityCheckResults.flatMap(function (ecr) {
                    var _a, _b, _c;
                    if ((_c = (_b = (_a = ecr.insurance) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference) {
                        var _d = ecr.insurance[0].coverage.reference.split('/'), resourceType = _d[0], id = _d[1];
                        if (resourceType === 'Coverage') {
                            return id;
                        }
                    }
                    return [];
                });
                coverageRequests = coverageIdsToFetch.map(function (id) { return ({
                    method: 'GET',
                    url: "Coverage/".concat(id),
                }); });
                return [4 /*yield*/, oystehr.fhir.batch({ requests: coverageRequests })];
            case 4:
                coverages = (_d = (_c = (_e.sent()).entry) === null || _c === void 0 ? void 0 : _c.flatMap(function (e) { var _a; return (_a = e.resource) !== null && _a !== void 0 ? _a : []; })) !== null && _d !== void 0 ? _d : [];
                mapped = eligibilityCheckResults
                    .map(function (result) {
                    var _a;
                    var coverage = __spreadArray(__spreadArray([], coverages, true), ((_a = result.contained) !== null && _a !== void 0 ? _a : []), true).find(function (resource) {
                        var _a, _b, _c, _d, _e;
                        return resource.resourceType === 'Coverage' &&
                            ((_d = (_c = (_b = (_a = result.insurance) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.coverage) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.includes((_e = resource.id) !== null && _e !== void 0 ? _e : ''));
                    });
                    // console.log('coverageDetails', JSON.stringify(coverage, null, 2));
                    if (!coverage) {
                        return null;
                    }
                    var coverageDetails = (0, utils_1.pullCoverageIdentifyingDetails)(coverage);
                    if (!coverageDetails) {
                        return null;
                    }
                    return __assign(__assign({}, (0, utils_2.parseCoverageEligibilityResponse)(result)), coverageDetails);
                })
                    .filter(function (result) { return result !== null; });
                console.timeEnd('fetching CER IDs');
                patient = accountAndCoverages.patient;
                pharmacy = (0, utils_1.getPreferredPharmacyFromPatient)(patient);
                return [2 /*return*/, __assign(__assign({}, accountAndCoverages), { primaryCarePhysician: primaryCarePhysician, coverageChecks: mapped, pharmacy: pharmacy })];
        }
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
    // at some point and it should always be available, so throwing it in the input interface anticipatorily
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('user token unexpectedly missing');
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var patientId = JSON.parse(input.body).patientId;
    if (!patientId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['patientId']);
    }
    if ((0, utils_1.isValidUUID)(patientId) === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('patientId');
    }
    return {
        secrets: secrets,
        userToken: userToken,
        patientId: patientId,
    };
};

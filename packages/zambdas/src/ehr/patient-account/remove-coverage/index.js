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
var shared_1 = require("../../../shared");
var harvest_1 = require("../../shared/harvest");
var ZAMBDA_NAME = 'remove-coverage';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 3:
                _a.sent();
                response = { message: 'Successfully removed coverage' };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('remove-coverage', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var account, coverage, providerProfileReference, patientId, batchRequests, currentAccountCoverage, newCoverage, resultBundle, e_1, ae_1, ae;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                account = input.account, coverage = input.coverage, providerProfileReference = input.providerProfileReference, patientId = input.patientId;
                batchRequests = [];
                currentAccountCoverage = account === null || account === void 0 ? void 0 : account.coverage;
                if (currentAccountCoverage) {
                    newCoverage = currentAccountCoverage.filter(function (tempCov) {
                        if (tempCov.coverage.reference === "Coverage/".concat(coverage.id)) {
                            return false;
                        }
                        return true;
                    });
                    console.log('new coverage', newCoverage, coverage.id);
                    batchRequests.push({
                        method: 'PATCH',
                        url: "Account/".concat(account === null || account === void 0 ? void 0 : account.id),
                        operations: [
                            {
                                op: 'replace',
                                path: '/coverage',
                                value: newCoverage,
                            },
                        ],
                    });
                }
                batchRequests.push({
                    method: 'PATCH',
                    url: "Coverage/".concat(coverage.id),
                    operations: [
                        {
                            op: 'replace',
                            path: '/status',
                            value: 'cancelled',
                        },
                    ],
                });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 5]);
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: batchRequests })];
            case 2:
                resultBundle = _a.sent();
                return [3 /*break*/, 5];
            case 3:
                e_1 = _a.sent();
                console.error('error updating patient account from questionnaire', e_1);
                return [4 /*yield*/, writeAuditEvent({ resultBundle: null, providerProfileReference: providerProfileReference, patientId: patientId }, oystehr)];
            case 4:
                ae_1 = _a.sent();
                console.log('wrote audit event: ', "AuditEvent/".concat(ae_1.id));
                throw e_1;
            case 5: return [4 /*yield*/, writeAuditEvent({ resultBundle: resultBundle, providerProfileReference: providerProfileReference, patientId: patientId }, oystehr)];
            case 6:
                ae = _a.sent();
                console.log('wrote audit event: ', "AuditEvent/".concat(ae.id));
                return [2 /*return*/];
        }
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('user token unexpectedly missing');
    }
    var secrets = input.secrets;
    var _a = JSON.parse(input.body), patientId = _a.patientId, coverageId = _a.coverageId;
    if (!patientId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['patientId']);
    }
    if (!coverageId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['coverageId']);
    }
    if ((0, utils_1.isValidUUID)(patientId) === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('patientId');
    }
    if ((0, utils_1.isValidUUID)(coverageId) === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('coverageId');
    }
    return {
        secrets: secrets,
        userToken: userToken,
        patientId: patientId,
        coverageId: coverageId,
    };
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, coverageId, userToken, secrets, userOystehr, user, providerProfileReference, accountAndCoverages, effectInput, coverages, coverage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = input.patientId, coverageId = input.coverageId, userToken = input.userToken, secrets = input.secrets;
                userOystehr = (0, shared_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, userOystehr.user.me()];
            case 1:
                user = _a.sent();
                if (!user) {
                    throw utils_1.NOT_AUTHORIZED;
                }
                providerProfileReference = user.profile;
                if (!providerProfileReference) {
                    throw utils_1.NOT_AUTHORIZED;
                }
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehr)];
            case 2:
                accountAndCoverages = _a.sent();
                effectInput = {
                    account: accountAndCoverages.account,
                    providerProfileReference: providerProfileReference,
                    patientId: patientId,
                };
                coverages = accountAndCoverages.coverages;
                if (coverages.primary && coverages.primary.id === coverageId) {
                    coverage = coverages.primary;
                }
                if (coverages.secondary && coverages.secondary.id === coverageId) {
                    coverage = coverages.secondary;
                }
                if (!coverage) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Coverage');
                }
                effectInput.coverage = coverage;
                return [2 /*return*/, effectInput];
        }
    });
}); };
var writeAuditEvent = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var resultBundle, providerProfileReference, patientId, outcome, entity, auditEvent;
    return __generator(this, function (_a) {
        resultBundle = input.resultBundle, providerProfileReference = input.providerProfileReference, patientId = input.patientId;
        // todo: check that bundle outcome was successful
        console.log('result bundle', JSON.stringify(resultBundle, null, 2));
        outcome = (function () {
            if (!resultBundle) {
                return utils_1.AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
            }
            return (0, utils_1.checkBundleOutcomeOk)(resultBundle)
                ? utils_1.AUDIT_EVENT_OUTCOME_CODE.success
                : utils_1.AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
        })();
        entity = [
            {
                what: {
                    reference: "Patient/".concat(patientId),
                },
                role: {
                    system: 'http://terminology.hl7.org/CodeSystem/object-role',
                    code: '1',
                    display: 'Patient',
                },
            },
        ];
        if (resultBundle) {
            entity.push.apply(entity, (0, utils_1.getVersionedReferencesFromBundleResources)(resultBundle).map(function (reference) {
                return {
                    what: reference,
                    role: {
                        system: 'http://terminology.hl7.org/CodeSystem/object-role',
                        code: '4',
                        display: 'Domain Resource',
                    },
                    description: 'Resource updated as a result of processing a remove Coverage request',
                };
            }));
        }
        auditEvent = {
            resourceType: 'AuditEvent',
            type: {
                system: 'http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle',
                code: 'unlink',
                display: 'Unlink Record Lifecycle Event',
            },
            recorded: luxon_1.DateTime.now().toISO(),
            outcome: outcome,
            agent: [
                {
                    type: {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                                code: 'AUT',
                                display: 'author (originator)',
                            },
                        ],
                    },
                    who: {
                        reference: providerProfileReference,
                    },
                    requestor: true,
                },
            ],
            source: {
                site: 'Ottehr',
                observer: {
                    reference: providerProfileReference,
                },
            },
            entity: entity,
        };
        return [2 /*return*/, oystehr.fhir.create(auditEvent)];
    });
}); };

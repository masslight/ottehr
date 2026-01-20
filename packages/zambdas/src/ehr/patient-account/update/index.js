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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var harvest_1 = require("../../shared/harvest");
var ZAMBDA_NAME = 'update-patient-account';
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
                console.log('complexly validating request parameters');
                return [4 /*yield*/, complexValidation(validatedParameters)];
            case 2:
                effectInput = _a.sent();
                console.log('complex validation successful');
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 3:
                _a.sent();
                response = { result: 'success' };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-patient-account-from-questionnaire', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var questionnaireResponse, items, patientId, providerProfileReference, preserveOmittedCoverages, questionnaireForEnableWhenFiltering, patientResource, patientPatchOps, pharmacyPatchOps, resultBundle, e_1, ae_1, _a, account, guarantorResource, stripeClient, e_2, ae_2, ae;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                questionnaireResponse = input.questionnaireResponse, items = input.items, patientId = input.patientId, providerProfileReference = input.providerProfileReference, preserveOmittedCoverages = input.preserveOmittedCoverages, questionnaireForEnableWhenFiltering = input.questionnaireForEnableWhenFiltering;
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Patient',
                        id: patientId,
                    })];
            case 1:
                patientResource = _b.sent();
                console.log('creating patch operations');
                patientPatchOps = (0, harvest_1.createMasterRecordPatchOperations)(items || [], patientResource, questionnaireForEnableWhenFiltering);
                console.log('All Patient patch operations being attempted: ', JSON.stringify(patientPatchOps, null, 2));
                if (!(patientPatchOps.patient.patchOpsForDirectUpdate.length > 0)) return [3 /*break*/, 3];
                console.time('patching patient resource');
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Patient',
                        id: patientResource.id,
                        operations: patientPatchOps.patient.patchOpsForDirectUpdate,
                    })];
            case 2:
                patientResource = _b.sent();
                console.timeEnd('patching patient resource');
                return [3 /*break*/, 4];
            case 3:
                console.log('no patient patch operations to perform--skipping');
                _b.label = 4;
            case 4:
                pharmacyPatchOps = (0, harvest_1.createUpdatePharmacyPatchOps)(patientResource, (0, utils_1.flattenQuestionnaireAnswers)(items));
                console.log('Pharmacy patch operations being attempted: ', JSON.stringify(pharmacyPatchOps, null, 2));
                if (!(pharmacyPatchOps.length > 0)) return [3 /*break*/, 6];
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Patient',
                        id: patientResource.id,
                        operations: pharmacyPatchOps,
                    })];
            case 5:
                _b.sent();
                return [3 /*break*/, 7];
            case 6:
                console.log('no pharmacy patch operations to perform--skipping');
                _b.label = 7;
            case 7:
                _b.trys.push([7, 9, , 11]);
                return [4 /*yield*/, (0, harvest_1.updatePatientAccountFromQuestionnaire)({ questionnaireResponseItem: items, patientId: patientId, preserveOmittedCoverages: preserveOmittedCoverages }, oystehr)];
            case 8:
                resultBundle = _b.sent();
                return [3 /*break*/, 11];
            case 9:
                e_1 = _b.sent();
                console.error('error updating patient account from questionnaire', e_1);
                return [4 /*yield*/, writeAuditEvent({ resultBundle: null, providerProfileReference: providerProfileReference, questionnaireResponse: questionnaireResponse, patientId: patientId }, oystehr)];
            case 10:
                ae_1 = _b.sent();
                console.log('wrote audit event: ', "AuditEvent/".concat(ae_1.id));
                throw e_1;
            case 11:
                _b.trys.push([11, 16, , 19]);
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehr)];
            case 12:
                _a = _b.sent(), account = _a.account, guarantorResource = _a.guarantorResource;
                stripeClient = (0, shared_1.getStripeClient)(input.secrets);
                if (!(!account || !guarantorResource)) return [3 /*break*/, 13];
                console.log('could not find account or guarantor, skipping stripe update');
                return [3 /*break*/, 15];
            case 13: return [4 /*yield*/, (0, harvest_1.updateStripeCustomer)({
                    account: account,
                    guarantorResource: guarantorResource,
                    stripeClient: stripeClient,
                })];
            case 14:
                _b.sent();
                _b.label = 15;
            case 15: return [3 /*break*/, 19];
            case 16:
                e_2 = _b.sent();
                console.error('error updating stripe details', e_2);
                return [4 /*yield*/, writeAuditEvent({ resultBundle: resultBundle, providerProfileReference: providerProfileReference, questionnaireResponse: questionnaireResponse, patientId: patientId }, oystehr)];
            case 17:
                ae_2 = _b.sent();
                console.log('wrote audit event: ', "AuditEvent/".concat(ae_2.id));
                return [4 /*yield*/, (0, shared_1.sendErrors)(e_2, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 18:
                _b.sent();
                return [3 /*break*/, 19];
            case 19:
                console.log('resultBundle', JSON.stringify(resultBundle, null, 2));
                return [4 /*yield*/, writeAuditEvent({ resultBundle: resultBundle, providerProfileReference: providerProfileReference, questionnaireResponse: questionnaireResponse, patientId: patientId }, oystehr)];
            case 20:
                ae = _b.sent();
                console.log('wrote audit event: ', "AuditEvent/".concat(ae.id));
                return [2 /*return*/];
        }
    });
}); };
var writeAuditEvent = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var resultBundle, providerProfileReference, patientId, questionnaireResponse, outcome, contained, entity, auditEvent;
    return __generator(this, function (_a) {
        resultBundle = input.resultBundle, providerProfileReference = input.providerProfileReference, patientId = input.patientId, questionnaireResponse = input.questionnaireResponse;
        outcome = (function () {
            if (!resultBundle) {
                return utils_1.AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
            }
            return (0, utils_1.checkBundleOutcomeOk)(resultBundle)
                ? utils_1.AUDIT_EVENT_OUTCOME_CODE.success
                : utils_1.AUDIT_EVENT_OUTCOME_CODE.seriousFailure;
        })();
        contained = [__assign(__assign({}, questionnaireResponse), { id: 'inputQR' })];
        entity = [
            {
                what: {
                    reference: '#inputQR',
                    type: 'QuestionnaireResponse',
                },
                role: {
                    system: 'http://terminology.hl7.org/CodeSystem/object-role',
                    code: '4',
                    display: 'Domain Resource',
                },
                description: 'Resource submitted by the author describing changes to the patient record',
            },
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
                    description: 'Resource updated as a result of processing a QuestionnaireResponse submitted by the author',
                };
            }));
        }
        auditEvent = {
            resourceType: 'AuditEvent',
            contained: contained,
            type: {
                system: 'http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle',
                code: 'originate',
                display: 'Originate/Retain Record Lifecycle Event',
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
var validateRequestParameters = function (input) {
    var _a, _b;
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('user token unexpectedly missing');
    }
    var secrets = input.secrets;
    var questionnaireResponse = JSON.parse(input.body).questionnaireResponse;
    if (questionnaireResponse === undefined) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['questionnaireResponse']);
    }
    if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse must be of type QuestionnaireResponse');
    }
    if (!((_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.length)) {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse.item may not be missing or empty');
    }
    if (!questionnaireResponse.questionnaire) {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse must have a canonical reference on its "questionnaire" field');
    }
    else if (questionnaireResponse.questionnaire.split('|').length !== 2) {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse must have a valid canonical reference on its "questionnaire" field');
    }
    var subject = (_b = questionnaireResponse.subject) === null || _b === void 0 ? void 0 : _b.reference;
    if (!subject) {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse.subject may not be missing');
    }
    var _c = subject.split('/'), resourceType = _c[0], patientId = _c[1];
    if (resourceType !== 'Patient') {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse.subject must be of type Patient');
    }
    if ((0, utils_1.isValidUUID)(patientId) === false) {
        throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR)('questionnaireResponse.subject must have a valid UUID');
    }
    return {
        questionnaireResponse: questionnaireResponse,
        secrets: secrets,
        userToken: userToken,
        patientId: patientId,
    };
};
var complexValidation = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, userToken, questionnaireResponse, oystehr, user, providerProfileReference, questionnaire, preserveOmittedCoverages, questionnaireItems, validationSchema, e_3, validationErrors, errorPaths, pageAndFieldErrors, items;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                secrets = input.secrets, userToken = input.userToken, questionnaireResponse = input.questionnaireResponse;
                console.log('questionnaireResponse', JSON.stringify(questionnaireResponse));
                oystehr = (0, shared_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, oystehr.user.me()];
            case 1:
                user = _d.sent();
                if (!user) {
                    throw utils_1.NOT_AUTHORIZED;
                }
                providerProfileReference = user.profile;
                if (!providerProfileReference) {
                    throw utils_1.NOT_AUTHORIZED;
                }
                questionnaire = (0, utils_1.PATIENT_RECORD_QUESTIONNAIRE)();
                preserveOmittedCoverages = ((_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.length) === 1;
                console.log('preserveOmittedCoverages', preserveOmittedCoverages);
                questionnaireItems = (0, utils_1.mapQuestionnaireAndValueSetsToItemsList)((_b = questionnaire.item) !== null && _b !== void 0 ? _b : [], []);
                validationSchema = (0, utils_1.makeValidationSchema)(questionnaireItems, undefined);
                _d.label = 2;
            case 2:
                _d.trys.push([2, 4, , 5]);
                return [4 /*yield*/, validationSchema.validate(questionnaireResponse.item, { abortEarly: false })];
            case 3:
                _d.sent();
                return [3 /*break*/, 5];
            case 4:
                e_3 = _d.sent();
                validationErrors = e_3.inner;
                if (Array.isArray(validationErrors)) {
                    errorPaths = validationErrors
                        .map(function (e) {
                        var _a, _b;
                        return (_b = (_a = e.path) === null || _a === void 0 ? void 0 : _a.split('.')) === null || _b === void 0 ? void 0 : _b[0];
                    })
                        .filter(function (i) { return !!i; });
                    console.log('validationErrors', JSON.stringify(validationErrors, null, 2));
                    console.log('errorPaths', JSON.stringify(errorPaths));
                    if (errorPaths.length === 0) {
                        // this will be a 500
                        throw validationErrors;
                    }
                    pageAndFieldErrors = errorPaths.reduce(function (accum, currentPath) {
                        var _a;
                        var pageName;
                        var fieldName;
                        questionnaireItems.forEach(function (page) {
                            var _a, _b;
                            var itemWithError = ((_a = page.item) !== null && _a !== void 0 ? _a : []).find(function (i) {
                                return i.linkId === currentPath;
                            });
                            if (itemWithError) {
                                pageName = page.linkId;
                                fieldName = (_b = itemWithError.text) !== null && _b !== void 0 ? _b : itemWithError.linkId;
                            }
                        });
                        if (pageName && fieldName) {
                            var currentErrorList = (_a = accum[pageName]) !== null && _a !== void 0 ? _a : [];
                            currentErrorList.push(fieldName);
                            accum[pageName] = currentErrorList;
                        }
                        return accum;
                    }, {});
                    if (Object.keys(pageAndFieldErrors).length === 0) {
                        throw validationErrors;
                    }
                    console.log('pages with errors: ', JSON.stringify(pageAndFieldErrors));
                    throw (0, utils_1.QUESTIONNAIRE_RESPONSE_INVALID_ERROR)(pageAndFieldErrors);
                }
                else {
                    console.log('guess its not an array', e_3);
                    throw validationErrors;
                }
                return [3 /*break*/, 5];
            case 5:
                items = (_c = questionnaireResponse.item) !== null && _c !== void 0 ? _c : [];
                return [2 /*return*/, __assign(__assign({}, input), { providerProfileReference: providerProfileReference, items: items, preserveOmittedCoverages: preserveOmittedCoverages, questionnaireForEnableWhenFiltering: questionnaire })];
        }
    });
}); };

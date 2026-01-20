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
exports.performEffect = exports.index = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var utils_1 = require("utils");
var harvest_1 = require("../../../ehr/shared/harvest");
var helpers_1 = require("../../../patient/payment-methods/helpers");
var shared_1 = require("../../../shared");
var helpers_2 = require("../../appointment/appointment-chart-data-prefilling/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('sub-intake-harvest', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, qr, secrets, oystehr, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Intake Harvest Hath Been Invoked');
                console.log("Input: ".concat(JSON.stringify(input)));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                qr = validatedParameters.qr, secrets = validatedParameters.secrets;
                console.log('questionnaire response id', qr.id);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 3];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 2:
                oystehrToken = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                console.log('already have token');
                _a.label = 4;
            case 4:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                return [4 /*yield*/, (0, exports.performEffect)(validatedParameters, oystehr)];
            case 5:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('qr-subscription', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
// this is exported to facilitate integration testing
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var qr, secrets, tasksFailed, updatedAccount, workersCompAccount, resources, questionnaireForEnableWhenFiltering, encounterResource, patientResource, listResources, documentReferenceResources, locationResource, appointmentResource, patientPatchOps, error_2, pharmacyPatchOps, preserveOmittedCoverages, error_3, _a, latestAccount, updatedGuarantorResource, latestWorkersCompAccount, stripeClient, error_4, paperwork, flattenedPaperwork, hipaa, consentToTreat, error_5, error_6, error_7, paymentOption, paymentVariant, updatedEncounter, encounterPatchOperations, patientAccountReference, workersCompAccountReference, _b, updatedEncounterAccounts, accountsChanged, error_8, relatedPerson, patientPatches, erxContactOperation, addDefaultCountryOperation, error_9, additionalQuestions, saveOrUpdateChartDataResourceRequests_1, newTags, patchOps, error_10, response, ENVIRONMENT;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
    return __generator(this, function (_z) {
        switch (_z.label) {
            case 0:
                qr = input.qr, secrets = input.secrets;
                if (qr.status !== 'completed' && qr.status !== 'amended') {
                    console.log("Skipping harvest for QR ".concat(qr.id, " with status=").concat(qr.status));
                    return [2 /*return*/, "skipped: status=".concat(qr.status)];
                }
                tasksFailed = [];
                console.time('querying for resources to support qr harvest');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: (_e = (_d = (_c = qr.encounter) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.replace('Encounter/', '')) !== null && _e !== void 0 ? _e : '',
                            },
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'List:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'DocumentReference:patient',
                            },
                        ],
                    })];
            case 1:
                resources = (_z.sent()).unbundle();
                console.timeEnd('querying for resources to support qr harvest');
                return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var parts, error_11;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!qr.questionnaire) return [3 /*break*/, 4];
                                    parts = qr.questionnaire.split('|');
                                    if (!(parts.length === 2 && parts[0] && parts[1])) return [3 /*break*/, 4];
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, (0, utils_1.getCanonicalQuestionnaire)({ url: parts[0], version: parts[1] }, oystehr)];
                                case 2: return [2 /*return*/, _a.sent()];
                                case 3:
                                    error_11 = _a.sent();
                                    console.warn("Failed to fetch questionnaire ".concat(qr.questionnaire, ":"), error_11);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/, undefined];
                            }
                        });
                    }); })()];
            case 2:
                questionnaireForEnableWhenFiltering = _z.sent();
                encounterResource = resources.find(function (res) { return res.resourceType === 'Encounter'; });
                patientResource = resources.find(function (res) { return res.resourceType === 'Patient'; });
                listResources = resources.filter(function (res) { return res.resourceType === 'List'; });
                documentReferenceResources = resources.filter(function (res) { return res.resourceType === 'DocumentReference'; });
                locationResource = resources.find(function (res) { return res.resourceType === 'Location'; });
                appointmentResource = resources.find(function (res) { return res.resourceType === 'Appointment'; });
                if (patientResource === undefined || patientResource.id === undefined) {
                    throw new Error('Patient resource not found');
                }
                console.log('creating patch operations');
                patientPatchOps = (0, harvest_1.createMasterRecordPatchOperations)(qr.item || [], patientResource, questionnaireForEnableWhenFiltering);
                console.log('All Patient patch operations being attempted: ', JSON.stringify(patientPatchOps, null, 2));
                if (!(patientPatchOps.patient.patchOpsForDirectUpdate.length > 0)) return [3 /*break*/, 6];
                console.time('patching patient resource');
                _z.label = 3;
            case 3:
                _z.trys.push([3, 5, , 6]);
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Patient',
                        id: patientResource.id,
                        operations: patientPatchOps.patient.patchOpsForDirectUpdate,
                    })];
            case 4:
                patientResource = _z.sent();
                console.timeEnd('patching patient resource');
                console.log('Patient update successful');
                return [3 /*break*/, 6];
            case 5:
                error_2 = _z.sent();
                tasksFailed.push('patch patient');
                console.log("Failed to update Patient: ".concat(JSON.stringify(error_2)));
                (0, aws_serverless_1.captureException)(error_2);
                return [3 /*break*/, 6];
            case 6:
                pharmacyPatchOps = (0, harvest_1.createUpdatePharmacyPatchOps)(patientResource, (0, utils_1.flattenQuestionnaireAnswers)((_f = qr.item) !== null && _f !== void 0 ? _f : []));
                if (!(pharmacyPatchOps.length > 0)) return [3 /*break*/, 8];
                console.log('Applying pharmacy patch operations: ', JSON.stringify(pharmacyPatchOps, null, 2));
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Patient',
                        id: patientResource.id,
                        operations: pharmacyPatchOps,
                    })];
            case 7:
                patientResource = _z.sent();
                _z.label = 8;
            case 8:
                if (patientResource === undefined || patientResource.id === undefined) {
                    throw new Error('Patient resource not found');
                }
                console.log("Running harvest for QR ".concat(qr.id));
                _z.label = 9;
            case 9:
                _z.trys.push([9, 11, , 12]);
                preserveOmittedCoverages = ((_m = (_l = (_k = (_j = (_h = (_g = qr.item) === null || _g === void 0 ? void 0 : _g.find(function (item) { return item.linkId === 'payment-option-page'; })) === null || _h === void 0 ? void 0 : _h.item) === null || _j === void 0 ? void 0 : _j.find(function (subItem) { return subItem.linkId === 'payment-option'; })) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString) === utils_1.SELF_PAY_OPTION;
                return [4 /*yield*/, (0, harvest_1.updatePatientAccountFromQuestionnaire)({ patientId: patientResource.id, questionnaireResponseItem: (_o = qr.item) !== null && _o !== void 0 ? _o : [], preserveOmittedCoverages: preserveOmittedCoverages }, oystehr)];
            case 10:
                _z.sent();
                return [3 /*break*/, 12];
            case 11:
                error_3 = _z.sent();
                tasksFailed.push("Failed to update Account: ".concat(JSON.stringify(error_3)));
                console.log("Failed to update Account: ".concat(JSON.stringify(error_3)));
                (0, aws_serverless_1.captureException)(error_3);
                return [3 /*break*/, 12];
            case 12:
                _z.trys.push([12, 17, , 18]);
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientResource.id, oystehr)];
            case 13:
                _a = _z.sent(), latestAccount = _a.account, updatedGuarantorResource = _a.guarantorResource, latestWorkersCompAccount = _a.workersCompAccount;
                updatedAccount = latestAccount;
                workersCompAccount = latestWorkersCompAccount;
                if (!(updatedAccount && updatedGuarantorResource)) return [3 /*break*/, 15];
                console.time('updating stripe customer');
                stripeClient = (0, helpers_1.getStripeClient)(secrets);
                return [4 /*yield*/, (0, harvest_1.updateStripeCustomer)({
                        account: updatedAccount,
                        guarantorResource: updatedGuarantorResource,
                        stripeClient: stripeClient,
                    })];
            case 14:
                _z.sent();
                console.timeEnd('updating stripe customer');
                return [3 /*break*/, 16];
            case 15:
                console.log('Stripe customer id, account or guarantor resource missing, skipping stripe customer update');
                _z.label = 16;
            case 16: return [3 /*break*/, 18];
            case 17:
                error_4 = _z.sent();
                tasksFailed.push('update stripe customer');
                console.log("Failed to update stripe customer: ".concat(JSON.stringify(error_4)));
                (0, aws_serverless_1.captureException)(error_4);
                return [3 /*break*/, 18];
            case 18:
                paperwork = (_p = qr.item) !== null && _p !== void 0 ? _p : [];
                flattenedPaperwork = (0, utils_1.flattenIntakeQuestionnaireItems)(paperwork);
                hipaa = (_s = (_r = (_q = flattenedPaperwork.find(function (data) { return data.linkId === 'hipaa-acknowledgement'; })) === null || _q === void 0 ? void 0 : _q.answer) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.valueBoolean;
                consentToTreat = (_v = (_u = (_t = flattenedPaperwork.find(function (data) { return data.linkId === 'consent-to-treat'; })) === null || _t === void 0 ? void 0 : _t.answer) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.valueBoolean;
                console.log('Flattened paperwork: ', JSON.stringify(flattenedPaperwork, null, 2));
                console.log('HIPAA: ', hipaa);
                console.log('Consent to Treat: ', consentToTreat);
                console.log('qr.status', qr.status);
                if (appointmentResource === undefined || appointmentResource.id === undefined) {
                    throw new Error('Appointment resource not found');
                }
                if (!(hipaa === true && consentToTreat === true && qr.status === 'completed')) return [3 /*break*/, 23];
                console.time('creating consent resources');
                _z.label = 19;
            case 19:
                _z.trys.push([19, 21, , 22]);
                return [4 /*yield*/, (0, harvest_1.createConsentResources)({
                        questionnaireResponse: qr,
                        patientResource: patientResource,
                        locationResource: locationResource,
                        appointmentId: appointmentResource.id,
                        oystehrAccessToken: oystehrToken,
                        oystehr: oystehr,
                        secrets: secrets,
                        listResources: listResources,
                    })];
            case 20:
                _z.sent();
                return [3 /*break*/, 22];
            case 21:
                error_5 = _z.sent();
                tasksFailed.push('create consent resources');
                console.log("Failed to create consent resources: ".concat(error_5));
                (0, aws_serverless_1.captureException)(error_5);
                return [3 /*break*/, 22];
            case 22:
                console.timeEnd('creating consent resources');
                _z.label = 23;
            case 23:
                console.time('creating insurances cards, condition photo, work school notes resources');
                _z.label = 24;
            case 24:
                _z.trys.push([24, 26, , 27]);
                return [4 /*yield*/, (0, harvest_1.createDocumentResources)(qr, patientResource.id, appointmentResource.id, oystehr, listResources, documentReferenceResources)];
            case 25:
                _z.sent();
                return [3 /*break*/, 27];
            case 26:
                error_6 = _z.sent();
                tasksFailed.push('create insurances cards, condition photo, work school notes resources');
                console.log("Failed to create insurances cards, condition photo, work school notes resources: ".concat(error_6));
                (0, aws_serverless_1.captureException)(error_6);
                return [3 /*break*/, 27];
            case 27:
                console.timeEnd('creating insurances cards, condition photo, work school notes resources');
                if (encounterResource === undefined || encounterResource.id === undefined) {
                    throw new Error('Encounter resource not found');
                }
                if (!(qr.status === 'amended')) return [3 /*break*/, 31];
                _z.label = 28;
            case 28:
                _z.trys.push([28, 30, , 31]);
                console.log('flagging paperwork edit');
                return [4 /*yield*/, (0, harvest_1.flagPaperworkEdit)(patientResource.id, encounterResource.id, oystehr)];
            case 29:
                _z.sent();
                return [3 /*break*/, 31];
            case 30:
                error_7 = _z.sent();
                tasksFailed.push('flag paperwork edit');
                console.log("Failed to update flag paperwork edit: ".concat(error_7));
                (0, aws_serverless_1.captureException)(error_7);
                return [3 /*break*/, 31];
            case 31:
                if (!(qr.status === 'completed' || qr.status === 'amended')) return [3 /*break*/, 36];
                _z.label = 32;
            case 32:
                _z.trys.push([32, 35, , 36]);
                console.log('updating encounter payment variant and account references');
                paymentOption = (_y = (_x = (_w = flattenedPaperwork.find(function (response) { return response.linkId === 'payment-option'; })) === null || _w === void 0 ? void 0 : _w.answer) === null || _x === void 0 ? void 0 : _x[0]) === null || _y === void 0 ? void 0 : _y.valueString;
                paymentVariant = utils_1.PaymentVariant.selfPay;
                if (paymentOption === utils_1.INSURANCE_PAY_OPTION) {
                    paymentVariant = utils_1.PaymentVariant.insurance;
                }
                if (paymentOption === 'Employer') {
                    paymentVariant = utils_1.PaymentVariant.employer;
                }
                updatedEncounter = (0, utils_1.updateEncounterPaymentVariantExtension)(encounterResource, paymentVariant);
                encounterPatchOperations = [
                    {
                        op: encounterResource.extension !== undefined ? 'replace' : 'add',
                        path: '/extension',
                        value: updatedEncounter.extension,
                    },
                ];
                patientAccountReference = (updatedAccount === null || updatedAccount === void 0 ? void 0 : updatedAccount.id) ? "Account/".concat(updatedAccount.id) : undefined;
                workersCompAccountReference = (workersCompAccount === null || workersCompAccount === void 0 ? void 0 : workersCompAccount.id) ? "Account/".concat(workersCompAccount.id) : undefined;
                _b = mergeEncounterAccounts(encounterResource.account, [patientAccountReference, workersCompAccountReference]), updatedEncounterAccounts = _b.accounts, accountsChanged = _b.changed;
                if (accountsChanged && updatedEncounterAccounts) {
                    encounterPatchOperations.push({
                        op: encounterResource.account ? 'replace' : 'add',
                        path: '/account',
                        value: updatedEncounterAccounts,
                    });
                }
                if (!encounterPatchOperations.length) return [3 /*break*/, 34];
                return [4 /*yield*/, oystehr.fhir.patch({
                        id: encounterResource.id,
                        resourceType: 'Encounter',
                        operations: encounterPatchOperations,
                    })];
            case 33:
                _z.sent();
                _z.label = 34;
            case 34:
                console.log('payment variant and account references updated on encounter');
                return [3 /*break*/, 36];
            case 35:
                error_8 = _z.sent();
                tasksFailed.push('update encounter payment variant/accounts');
                console.log("Failed to update encounter payment variant/accounts: ".concat(error_8));
                (0, aws_serverless_1.captureException)(error_8);
                return [3 /*break*/, 36];
            case 36:
                console.time('querying for related person for patient self');
                return [4 /*yield*/, (0, utils_1.getRelatedPersonForPatient)(patientResource.id, oystehr)];
            case 37:
                relatedPerson = _z.sent();
                console.timeEnd('querying for related person for patient self');
                if (!relatedPerson || !relatedPerson.id) {
                    throw new Error('RelatedPerson for patient is not defined or does not have ID');
                }
                patientPatches = [];
                erxContactOperation = (0, harvest_1.createErxContactOperation)(relatedPerson, patientResource);
                if (erxContactOperation)
                    patientPatches.push(erxContactOperation);
                addDefaultCountryOperation = {
                    op: 'add',
                    path: '/address/0/country',
                    value: 'US',
                };
                patientPatches.push(addDefaultCountryOperation);
                if (!(patientPatches.length > 0)) return [3 /*break*/, 41];
                _z.label = 38;
            case 38:
                _z.trys.push([38, 40, , 41]);
                console.time('patching patient resource');
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Patient',
                        id: patientResource.id,
                        operations: patientPatches,
                    })];
            case 39:
                _z.sent();
                console.timeEnd('patching patient resource');
                return [3 /*break*/, 41];
            case 40:
                error_9 = _z.sent();
                tasksFailed.push(JSON.stringify(error_9));
                console.log("Failed to update Patient: ".concat(JSON.stringify(error_9)));
                (0, aws_serverless_1.captureException)(error_9);
                return [3 /*break*/, 41];
            case 41:
                _z.trys.push([41, 43, , 44]);
                additionalQuestions = (0, helpers_2.createAdditionalQuestions)(qr);
                saveOrUpdateChartDataResourceRequests_1 = [];
                additionalQuestions.forEach(function (observation) {
                    console.log('additionalQuestion: ', JSON.stringify(observation));
                    saveOrUpdateChartDataResourceRequests_1.push((0, shared_1.saveResourceRequest)((0, shared_1.makeObservationResource)(encounterResource.id, patientResource.id, '', undefined, observation, utils_1.ADDITIONAL_QUESTIONS_META_SYSTEM)));
                });
                newTags = [utils_1.FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG];
                patchOps = (0, utils_1.getPatchOperationsForNewMetaTags)(appointmentResource, newTags);
                saveOrUpdateChartDataResourceRequests_1.push({
                    method: 'PATCH',
                    url: "Appointment/".concat(appointmentResource.id),
                    operations: patchOps,
                });
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: saveOrUpdateChartDataResourceRequests_1,
                    })];
            case 42:
                _z.sent();
                return [3 /*break*/, 44];
            case 43:
                error_10 = _z.sent();
                tasksFailed.push('create additional questions chart data resource or patch appointment tag', JSON.stringify(error_10));
                console.log("Failed to create additional questions chart data resource or patch appointment tag: ".concat(error_10));
                (0, aws_serverless_1.captureException)(error_10);
                return [3 /*break*/, 44];
            case 44:
                response = tasksFailed.length
                    ? "".concat(tasksFailed.length, " failed: ").concat(tasksFailed)
                    : 'all tasks executed successfully';
                console.log(response);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                if (!(tasksFailed.length && ENVIRONMENT !== 'local')) return [3 /*break*/, 46];
                return [4 /*yield*/, (0, shared_1.triggerSlackAlarm)("Alert in ".concat(ENVIRONMENT, " zambda qr-subscription.\n\nOne or more harvest paperwork tasks failed for QR ").concat(qr.id, ":\n\n").concat(tasksFailed), secrets)];
            case 45:
                _z.sent();
                _z.label = 46;
            case 46: return [2 /*return*/, response];
        }
    });
}); };
exports.performEffect = performEffect;
var mergeEncounterAccounts = function (existingAccounts, references) {
    var sanitizedReferences = references.filter(function (reference) { return Boolean(reference); });
    if (!sanitizedReferences.length) {
        return { accounts: existingAccounts, changed: false };
    }
    var normalizedAccounts = existingAccounts ? __spreadArray([], existingAccounts, true) : [];
    var existingRefSet = new Set((existingAccounts !== null && existingAccounts !== void 0 ? existingAccounts : [])
        .map(function (account) { return account.reference; })
        .filter(function (reference) { return Boolean(reference); }));
    var changed = false;
    sanitizedReferences.forEach(function (reference) {
        if (!existingRefSet.has(reference)) {
            normalizedAccounts.push({ reference: reference });
            existingRefSet.add(reference);
            changed = true;
        }
    });
    return {
        accounts: changed ? normalizedAccounts : existingAccounts,
        changed: changed,
    };
};

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
exports.DEFAULT_TEST_TIMEOUT = exports.appointment = exports.responsiblePartyInfoData = exports.insuranceTypeData = exports.patientData = exports.formsData = exports.insuranceData = void 0;
var sdk_1 = require("@oystehr/sdk");
var vitest_1 = require("vitest");
var shared_1 = require("../src/shared");
var secrets_1 = require("./data/secrets");
exports.insuranceData = {
    additionalInfo: '',
    relationship: 'parent',
    sex: 'female',
    dateOfBirth: '08/01/2023',
    lastName: 'test',
    firstName: 'test',
    insuranceType: 'ppo',
    memberId: '11200000',
    insurance: 'Fidelis Care',
};
exports.formsData = {
    relationship: 'Self',
    fullName: 'james',
    signature: 'james',
    consentToTreat: 'true',
    HIPAA: 'true',
};
exports.patientData = {
    reasonForVisit: ['OCD'],
    race: 'Asian',
    ethnicity: 'Hispanic or Latino',
    sex: 'male',
    dateOfBirth: '2023-08-08',
    lastName: 'test',
    firstName: 'test',
    newPatient: true,
};
exports.insuranceTypeData = 'insurance';
exports.responsiblePartyInfoData = {
    phoneNumber: '',
    birthSex: 'male',
    dateOfBirth: '08/01/2023',
    lastName: 'test',
    firstName: 'test',
    relationship: 'Self',
};
exports.appointment = 'f21ad419-d8ab-4a41-8dbd-2e2e3a7b4333';
exports.DEFAULT_TEST_TIMEOUT = 200000;
describe.skip('paperwork tests', function () {
    var oystehr = null;
    var token = null;
    vitest_1.vi.setConfig({ testTimeout: exports.DEFAULT_TEST_TIMEOUT });
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var FHIR_API, AUTH0_ENDPOINT, AUTH0_AUDIENCE, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, PROJECT_API;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    FHIR_API = secrets_1.SECRETS.FHIR_API, AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, AUTH0_CLIENT_TESTS = secrets_1.SECRETS.AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS = secrets_1.SECRETS.AUTH0_SECRET_TESTS, PROJECT_API = secrets_1.SECRETS.PROJECT_API;
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                            AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                            AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
                            AUTH0_SECRET: AUTH0_SECRET_TESTS,
                            AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                        })];
                case 1:
                    token = _a.sent();
                    oystehr = new sdk_1.default({ accessToken: token, fhirApiUrl: FHIR_API, projectApiUrl: PROJECT_API });
                    return [2 /*return*/];
            }
        });
    }); });
    function updatePaperwork(body) {
        if (!oystehr) {
            throw new Error('zambdaClient is not defined');
        }
        return oystehr.zambda.execute(__assign({ id: 'update-paperwork' }, body));
    }
    test('Create paperwork as a new patient under the insurance payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, insuranceCoverageResource, cardHolderDetailsResource, responsiblePartyResource, formsConsentResource;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: exports.insuranceTypeData,
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _e.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Coverage',
                            id: (_a = response === null || response === void 0 ? void 0 : response.insurance) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    insuranceCoverageResource = _e.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_b = response === null || response === void 0 ? void 0 : response.cardHolderInfo) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 3:
                    cardHolderDetailsResource = _e.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_c = response === null || response === void 0 ? void 0 : response.relatedPerson) === null || _c === void 0 ? void 0 : _c.id,
                        })];
                case 4:
                    responsiblePartyResource = _e.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Consent',
                            id: (_d = response === null || response === void 0 ? void 0 : response.consentForm) === null || _d === void 0 ? void 0 : _d.id,
                        })];
                case 5:
                    formsConsentResource = _e.sent();
                    if (!insuranceCoverageResource) {
                        throw new Error('Insurance coverage not found!');
                    }
                    if (!cardHolderDetailsResource) {
                        throw new Error('Card holder details not found!');
                    }
                    if (!responsiblePartyResource) {
                        throw new Error('Responsible Party not found!');
                    }
                    if (!formsConsentResource) {
                        throw new Error('Forms Consent information not found!');
                    }
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.insurance).toEqual(insuranceCoverageResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.cardHolderInfo).toEqual(cardHolderDetailsResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.relatedPerson).toEqual(responsiblePartyResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.consentForm).toEqual(formsConsentResource);
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create paperwork as a returning patient under the insurance payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, insuranceCoverageResource, cardHolderDetailsResource, responsiblePartyResource, formsConsentResource;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: exports.insuranceTypeData,
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: {
                                reasonForVisit: ['OCD'],
                                race: 'Asian',
                                ethnicity: 'Hispanic or Latino',
                                sex: 'male',
                                dateOfBirth: '2023-08-08',
                                lastName: 'test',
                                firstName: 'test',
                                newPatient: false,
                            },
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _e.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Coverage',
                            id: (_a = response === null || response === void 0 ? void 0 : response.insurance) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    insuranceCoverageResource = _e.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_b = response === null || response === void 0 ? void 0 : response.cardHolderInfo) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 3:
                    cardHolderDetailsResource = _e.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_c = response === null || response === void 0 ? void 0 : response.relatedPerson) === null || _c === void 0 ? void 0 : _c.id,
                        })];
                case 4:
                    responsiblePartyResource = _e.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Consent',
                            id: (_d = response === null || response === void 0 ? void 0 : response.consentForm) === null || _d === void 0 ? void 0 : _d.id,
                        })];
                case 5:
                    formsConsentResource = _e.sent();
                    if (!insuranceCoverageResource) {
                        throw new Error('Insurance coverage not found!');
                    }
                    if (!cardHolderDetailsResource) {
                        throw new Error('Card holder details not found!');
                    }
                    if (!responsiblePartyResource) {
                        throw new Error('Responsible Party not found!');
                    }
                    if (!formsConsentResource) {
                        throw new Error('Forms Consent information not found!');
                    }
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.insurance).toEqual(insuranceCoverageResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.cardHolderInfo).toEqual(cardHolderDetailsResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.relatedPerson).toEqual(responsiblePartyResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.consentForm).toEqual(formsConsentResource);
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create paperwork as a new patient under the self-pay payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, accountResource;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: 'self-pay',
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _b.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Account',
                            id: (_a = response === null || response === void 0 ? void 0 : response.account) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    accountResource = _b.sent();
                    if (!accountResource) {
                        throw new Error('Account not found!');
                    }
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.account).toEqual(accountResource);
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create paperwork and then update the paperwork under the insurance payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, insuranceCoverageResource, cardHolderDetailsResource, responsiblePartyResource, formsConsentResource, updateResponse, updatedInsuranceCoverageResource;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return __generator(this, function (_p) {
            switch (_p.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: exports.insuranceTypeData,
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _p.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Coverage',
                            id: (_a = response === null || response === void 0 ? void 0 : response.insurance) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    insuranceCoverageResource = _p.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_b = response === null || response === void 0 ? void 0 : response.cardHolderInfo) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 3:
                    cardHolderDetailsResource = _p.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_c = response === null || response === void 0 ? void 0 : response.relatedPerson) === null || _c === void 0 ? void 0 : _c.id,
                        })];
                case 4:
                    responsiblePartyResource = _p.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Consent',
                            id: (_d = response === null || response === void 0 ? void 0 : response.consentForm) === null || _d === void 0 ? void 0 : _d.id,
                        })];
                case 5:
                    formsConsentResource = _p.sent();
                    if (!insuranceCoverageResource) {
                        throw new Error('Insurance coverage not found!');
                    }
                    if (!cardHolderDetailsResource) {
                        throw new Error('Card holder details not found!');
                    }
                    if (!responsiblePartyResource) {
                        throw new Error('Responsible Party not found!');
                    }
                    if (!formsConsentResource) {
                        throw new Error('Forms Consent information not found!');
                    }
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.insurance).toEqual(insuranceCoverageResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.cardHolderInfo).toEqual(cardHolderDetailsResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.relatedPerson).toEqual(responsiblePartyResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.consentForm).toEqual(formsConsentResource);
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: {
                                additionalInfo: '',
                                relationship: 'parent',
                                sex: 'male',
                                dateOfBirth: '08/01/2023',
                                lastName: 'doe',
                                firstName: 'john',
                                insuranceType: 'ppo',
                                memberId: '11200000',
                                insurance: 'Fidelis Care',
                            },
                            insuranceType: exports.insuranceTypeData,
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: {
                                reasonForVisit: ['OCD'],
                                race: 'Asian',
                                ethnicity: 'Hispanic or Latino',
                                sex: 'male',
                                dateOfBirth: '2023-08-08',
                                lastName: 'test',
                                firstName: 'test',
                                newPatient: false,
                            },
                            appointmentID: exports.appointment,
                        })];
                case 6:
                    updateResponse = _p.sent();
                    (0, vitest_1.expect)(updateResponse.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Coverage',
                            id: (_e = response === null || response === void 0 ? void 0 : response.insurance) === null || _e === void 0 ? void 0 : _e.id,
                        })];
                case 7:
                    updatedInsuranceCoverageResource = _p.sent();
                    if (!updatedInsuranceCoverageResource) {
                        throw new Error('Insurance coverage not found!');
                    }
                    console.log(updateResponse);
                    (0, vitest_1.expect)((_j = (_h = (_g = (_f = updateResponse === null || updateResponse === void 0 ? void 0 : updateResponse.cardHolderInfo) === null || _f === void 0 ? void 0 : _f.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.given) === null || _j === void 0 ? void 0 : _j[0]).toEqual('john');
                    (0, vitest_1.expect)((_m = (_l = (_k = updateResponse === null || updateResponse === void 0 ? void 0 : updateResponse.cardHolderInfo) === null || _k === void 0 ? void 0 : _k.name) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.family).toEqual('doe');
                    (0, vitest_1.expect)((_o = updateResponse === null || updateResponse === void 0 ? void 0 : updateResponse.cardHolderInfo) === null || _o === void 0 ? void 0 : _o.gender).toEqual('male');
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create paperwork and then update the paperwork under the self-pay payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, accountResource, updatedResponse, updatedAccountResource;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: 'self-pay',
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _c.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Account',
                            id: (_a = response === null || response === void 0 ? void 0 : response.account) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    accountResource = _c.sent();
                    if (!accountResource) {
                        throw new Error('Account not found!');
                    }
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.account).toEqual(accountResource);
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: {
                                additionalInfo: '',
                                relationship: 'parent',
                                sex: 'male',
                                dateOfBirth: '08/01/2023',
                                lastName: 'doe',
                                firstName: 'john',
                                insuranceType: 'ppo',
                                memberId: '11200000',
                                insurance: 'Fidelis Care',
                            },
                            insuranceType: 'self-pay',
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: {
                                reasonForVisit: ['OCD'],
                                race: 'Asian',
                                ethnicity: 'Hispanic or Latino',
                                sex: 'male',
                                dateOfBirth: '2023-08-08',
                                lastName: 'test',
                                firstName: 'test',
                                newPatient: false,
                            },
                            appointmentID: exports.appointment,
                        })];
                case 3:
                    updatedResponse = _c.sent();
                    (0, vitest_1.expect)(updatedResponse.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Account',
                            id: (_b = updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.account) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 4:
                    updatedAccountResource = _c.sent();
                    if (!updatedAccountResource) {
                        throw new Error('Account not found!');
                    }
                    (0, vitest_1.expect)(updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.account).toEqual(updatedAccountResource);
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create paperwork under insurance option and then update the paperwork under the self-pay payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, insuranceCoverageResource, cardHolderDetailsResource, responsiblePartyResource, formsConsentResource, updatedResponse, updatedAccountResource;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: exports.insuranceTypeData,
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _f.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Coverage',
                            id: (_a = response === null || response === void 0 ? void 0 : response.insurance) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    insuranceCoverageResource = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_b = response === null || response === void 0 ? void 0 : response.cardHolderInfo) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 3:
                    cardHolderDetailsResource = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_c = response === null || response === void 0 ? void 0 : response.relatedPerson) === null || _c === void 0 ? void 0 : _c.id,
                        })];
                case 4:
                    responsiblePartyResource = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Consent',
                            id: (_d = response === null || response === void 0 ? void 0 : response.consentForm) === null || _d === void 0 ? void 0 : _d.id,
                        })];
                case 5:
                    formsConsentResource = _f.sent();
                    if (!insuranceCoverageResource) {
                        throw new Error('Insurance coverage not found!');
                    }
                    if (!cardHolderDetailsResource) {
                        throw new Error('Card holder details not found!');
                    }
                    if (!responsiblePartyResource) {
                        throw new Error('Responsible Party not found!');
                    }
                    if (!formsConsentResource) {
                        throw new Error('Forms Consent information not found!');
                    }
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.insurance).toEqual(insuranceCoverageResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.cardHolderInfo).toEqual(cardHolderDetailsResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.relatedPerson).toEqual(responsiblePartyResource);
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.consentForm).toEqual(formsConsentResource);
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: 'self-pay',
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 6:
                    updatedResponse = _f.sent();
                    (0, vitest_1.expect)(updatedResponse.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Account',
                            id: (_e = updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.account) === null || _e === void 0 ? void 0 : _e.id,
                        })];
                case 7:
                    updatedAccountResource = _f.sent();
                    if (!updatedAccountResource) {
                        throw new Error('Account not found!');
                    }
                    (0, vitest_1.expect)(updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.account).toEqual(updatedAccountResource);
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create paperwork under self-pay option and then update the paperwork under the insurance payment option, success', function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, updatedAccountResource, updatedResponse, insuranceCoverageResource, cardHolderDetailsResource, responsiblePartyResource, formsConsentResource;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('oystehr is not defined');
                    }
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: 'self-pay',
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 1:
                    response = _f.sent();
                    (0, vitest_1.expect)(response.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Account',
                            id: (_a = response === null || response === void 0 ? void 0 : response.account) === null || _a === void 0 ? void 0 : _a.id,
                        })];
                case 2:
                    updatedAccountResource = _f.sent();
                    if (!updatedAccountResource) {
                        throw new Error('Account not found!');
                    }
                    (0, vitest_1.expect)(response === null || response === void 0 ? void 0 : response.account).toEqual(updatedAccountResource);
                    return [4 /*yield*/, updatePaperwork({
                            forms: exports.formsData,
                            insurance: exports.insuranceData,
                            insuranceType: exports.insuranceTypeData,
                            responsibleParty: exports.responsiblePartyInfoData,
                            patient: exports.patientData,
                            appointmentID: exports.appointment,
                        })];
                case 3:
                    updatedResponse = _f.sent();
                    (0, vitest_1.expect)(updatedResponse.message).toEqual('Successfully updated paperwork');
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Coverage',
                            id: (_b = updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.insurance) === null || _b === void 0 ? void 0 : _b.id,
                        })];
                case 4:
                    insuranceCoverageResource = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_c = updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.cardHolderInfo) === null || _c === void 0 ? void 0 : _c.id,
                        })];
                case 5:
                    cardHolderDetailsResource = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'RelatedPerson',
                            id: (_d = updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.relatedPerson) === null || _d === void 0 ? void 0 : _d.id,
                        })];
                case 6:
                    responsiblePartyResource = _f.sent();
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Consent',
                            id: (_e = updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.consentForm) === null || _e === void 0 ? void 0 : _e.id,
                        })];
                case 7:
                    formsConsentResource = _f.sent();
                    if (!insuranceCoverageResource) {
                        throw new Error('Insurance coverage not found!');
                    }
                    if (!cardHolderDetailsResource) {
                        throw new Error('Card holder details not found!');
                    }
                    if (!responsiblePartyResource) {
                        throw new Error('Responsible Party not found!');
                    }
                    if (!formsConsentResource) {
                        throw new Error('Forms Consent information not found!');
                    }
                    (0, vitest_1.expect)(updatedResponse.message).toEqual('Successfully updated paperwork');
                    (0, vitest_1.expect)(updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.insurance).toEqual(insuranceCoverageResource);
                    (0, vitest_1.expect)(updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.cardHolderInfo).toEqual(cardHolderDetailsResource);
                    (0, vitest_1.expect)(updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.relatedPerson).toEqual(responsiblePartyResource);
                    (0, vitest_1.expect)(updatedResponse === null || updatedResponse === void 0 ? void 0 : updatedResponse.consentForm).toEqual(formsConsentResource);
                    return [2 /*return*/];
            }
        });
    }); });
});

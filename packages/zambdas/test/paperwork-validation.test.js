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
var utils_1 = require("utils");
var vitest_1 = require("vitest");
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
    birthSex: '',
    dateOfBirth: '08/01/2023',
    lastName: 'test',
    firstName: 'test',
    relationship: 'Self',
};
exports.appointment = 'f21ad419-d8ab-4a41-8dbd-2e2e3a7b4333';
exports.DEFAULT_TEST_TIMEOUT = 100000;
describe.skip('paperwork validation tests', function () {
    var oystehr = null;
    var incompletePatientError = 'These fields are required: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.ethnicity", "patient.race", "patient.reasonForVisit"';
    var incompleteInsuranceError = "When insuranceType is not self-pay, these fields are required: \"insurance.firstName\", \"insurance.lastName\", \"insurance.dateOfBirth\", \"insurance.sex\". insurance.relationship\", \"insurance.insuranceType\", \"insurance.insurance\", \"insurance.memberId\"";
    var incompleteFormsError = "These fields are required: \"forms.fullName\", \"forms.HIPAA\", \"forms.consentToTreat\", \"forms.signature\", \"forms.relationship\"";
    // const incompleteResponsiblePartyError = `These fields are required: "responsiblePartyInfo.relationship", "responsiblePartyInfo.firstName", "responsiblePartyInfo.lastName", "responsiblePartyInfo.dateOfBirth"`;
    vitest_1.vi.setConfig({ testTimeout: exports.DEFAULT_TEST_TIMEOUT });
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var PROJECT_API;
        return __generator(this, function (_a) {
            PROJECT_API = secrets_1.SECRETS.PROJECT_API;
            oystehr = new sdk_1.default({ projectApiUrl: PROJECT_API });
            return [2 /*return*/];
        });
    }); });
    function editPaperwork(body) {
        if (!oystehr) {
            throw new Error('zambdaClient is not defined');
        }
        return oystehr.zambda.execute(__assign({ id: 'update-paperwork' }, body));
    }
    test('Edit paperwork without a body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork()).rejects.toEqual({
                        error: 'No request body provided',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with an empty body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({})).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with incomplete patient date in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: exports.formsData,
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: {
                            reasonForVisit: ['OCD'],
                            race: '',
                            ethnicity: 'Hispanic or Latino',
                            sex: 'male',
                            dateOfBirth: '2023-08-08',
                            lastName: 'test',
                            newPatient: true,
                        },
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: incompletePatientError,
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with missing responsiblePartyInfo in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: exports.formsData,
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with incomplete responsible party data in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: exports.formsData,
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        appointmentID: exports.appointment,
                        responsibleParty: {
                            phoneNumber: '',
                            birthSex: '',
                            dateOfBirth: '08/01/2023',
                            relationship: 'Self',
                        },
                    })).rejects.toEqual({
                        error: 'These fields are required: "responsibleParty.relationship", "responsibleParty.firstName", "responsibleParty.lastName", "responsibleParty.dateOfBirth"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with incomplete insurance data in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: exports.formsData,
                        insurance: {
                            additionalInfo: '',
                            relationship: 'parent',
                            sex: 'female',
                            dateOfBirth: '08/01/2023',
                            firstName: '',
                            insuranceType: 'ppo',
                            insurance: 'Fidelis Care',
                        },
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        appointmentID: exports.appointment,
                        responsibleParty: exports.responsiblePartyInfoData,
                    })).rejects.toEqual({
                        error: incompleteInsuranceError,
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with missing appointmentID in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: exports.formsData,
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with incomplete forms data in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: {
                            relationship: 'Self',
                            fullName: 'james',
                            signature: 'james',
                        },
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: incompleteFormsError,
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with appointmentID as empty string in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        forms: exports.formsData,
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: '',
                    })).rejects.toEqual({
                        error: "\"appointmentID\" cannot be an empty string",
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with missing forms in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with missing insurance type in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insurance: exports.insuranceData,
                        forms: exports.formsData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with missing patient in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        forms: exports.formsData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with incorrect patient sex for patient object in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insurance: exports.insuranceData,
                        insuranceType: exports.insuranceTypeData,
                        forms: exports.formsData,
                        patient: {
                            reasonForVisit: ['OCD'],
                            race: 'Asian',
                            ethnicity: 'Hispanic or Latino',
                            sex: 'NA',
                            dateOfBirth: '2023-08-08',
                            lastName: 'test',
                            firstName: 'test',
                            newPatient: true,
                        },
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: "\"patient.sex\" must be one of the following values: ".concat(JSON.stringify(Object.values(utils_1.PersonSex))),
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with missing insurance in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: exports.insuranceTypeData,
                        forms: exports.formsData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insurance", "responsibleParty", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with malformed date in insurance in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: exports.insuranceTypeData,
                        forms: exports.formsData,
                        insurance: {
                            additionalInfo: '',
                            relationship: 'parent',
                            sex: 'female',
                            dateOfBirth: '08/01/1023',
                            lastName: 'test',
                            firstName: 'test',
                            insuranceType: 'ppo',
                            memberId: '11200000',
                            insurance: 'Fidelis Care',
                        },
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: '"insurance.dateOfBirth" was not read as a valid date',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork with no signature in forms in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: exports.insuranceTypeData,
                        forms: {
                            relationship: 'Self',
                            fullName: 'james',
                            signature: '',
                            consentToTreat: 'true',
                            HIPAA: 'true',
                        },
                        insurance: exports.insuranceData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: "\"forms.signature\" cannot be an empty string",
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork when insurance type is not self-pay but missing information in insurance field in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: exports.insuranceTypeData,
                        forms: exports.formsData,
                        insurance: {
                            additionalInfo: '',
                            relationship: 'parent',
                            sex: 'female',
                            dateOfBirth: '08/01/2023',
                            lastName: 'test',
                            firstName: 'test',
                            insuranceType: 'ppo',
                            insurance: 'Fidelis Care',
                        },
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: "When insuranceType is not self-pay, these fields are required: \"insurance.firstName\", \"insurance.lastName\", \"insurance.dateOfBirth\", \"insurance.sex\". insurance.relationship\", \"insurance.insuranceType\", \"insurance.insurance\", \"insurance.memberId\"",
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork when insurance type is self-pay but information in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: 'self-pay',
                        patient: exports.patientData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: 'These fields are required: "patient", "insuranceType", "forms", "appointmentID"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork when insurance type is not self-pay but missing information in insurance field in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: exports.insuranceTypeData,
                        forms: exports.formsData,
                        insurance: {
                            additionalInfo: '',
                            relationship: 'parent',
                            sex: 'female',
                            dateOfBirth: '08/01/2023',
                            lastName: 'test',
                            firstName: 'test',
                            insuranceType: 'ppo',
                            insurance: 'Fidelis Care',
                        },
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: "When insuranceType is not self-pay, these fields are required: \"insurance.firstName\", \"insurance.lastName\", \"insurance.dateOfBirth\", \"insurance.sex\". insurance.relationship\", \"insurance.insuranceType\", \"insurance.insurance\", \"insurance.memberId\"",
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Edit paperwork when HIPAA and consent to treat agreement is not accepted for forms in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: exports.insuranceTypeData,
                        forms: {
                            relationship: 'Self',
                            fullName: 'james',
                            signature: 'james',
                            consentToTreat: 'false',
                            HIPAA: 'false',
                        },
                        insurance: exports.insuranceData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: "\"forms.HIPAA\" and \"forms.consentToTreat\" agreement must be accepted",
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // test('Edit paperwork when relationship is invalid for forms in request body, fail', async () => {
    //   await expect(
    //     editPaperwork({
    //       insuranceType: insuranceTypeData,
    //       forms: {
    //         relationship: 'TEST',
    //         fullName: 'james',
    //         signature: 'james',
    //         consentToTreat: 'true',
    //         HIPAA: 'true',
    //       },
    //       insurance: insuranceData,
    //       patient: patientData,
    //       responsibleParty: responsiblePartyInfoData,
    //       appointmentID: appointment,
    //     })
    //   ).rejects.toEqual({
    //     error: `"forms.relationship" must be one of the following values: ${JSON.stringify(
    //       Object.values(RelationshipToPatient)
    //     )}`,
    //   });
    // });
    test('Edit paperwork when insurance type is not self-pay or insurance in request body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(editPaperwork({
                        insuranceType: 'neither',
                        forms: exports.formsData,
                        insurance: exports.insuranceData,
                        patient: exports.patientData,
                        responsibleParty: exports.responsiblePartyInfoData,
                        appointmentID: exports.appointment,
                    })).rejects.toEqual({
                        error: '"insuranceType" must be either "self-pay" or "insurance"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    // test('Edit paperwork when insurance provider is not within the eligible insurance providers in request body, fail', async () => {
    //   await expect(
    //     editPaperwork({
    //       insuranceType: insuranceTypeData,
    //       forms: formsData,
    //       insurance: {
    //         additionalInfo: '',
    //         relationship: 'parent',
    //         sex: 'female',
    //         dateOfBirth: '08/01/2023',
    //         lastName: 'test',
    //         firstName: 'test',
    //         insuranceType: 'test',
    //         memberId: '11200000',
    //         insurance: 'xxx',
    //       },
    //       patient: patientData,
    //       responsibleParty: responsiblePartyInfoData,
    //       appointmentID: appointment,
    //     })
    //   ).rejects.toEqual({
    //     error: `"insuranceType" must be one of the following values: ${JSON.stringify(Object.values(Insurance))}`,
    //   });
    // });
});

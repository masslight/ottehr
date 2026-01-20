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
exports.DEFAULT_TEST_TIMEOUT = exports.contact = exports.healthcareContacts = exports.location = exports.patient = void 0;
var sdk_1 = require("@oystehr/sdk");
var vitest_1 = require("vitest");
var secrets_1 = require("./data/secrets");
exports.patient = {
    firstName: 'a',
    lastName: 'a',
    sex: 'male',
    dateOfBirth: '2010-01-01',
    ethnicity: 'Hispanic or Latino',
    race: 'American Indian or Alaska Native',
    reasonForVisit: ['a'],
};
exports.location = '71bc5925-65d6-471f-abd0-be357043172a';
exports.healthcareContacts = {
    physicianFirstName: 'a',
    physicianLastName: 'a',
    physicianPhoneNumber: '(123) 456-7890',
    pharmacyName: 'a',
    pharmacyAddress: 'a',
};
exports.contact = {
    streetAddressLine1: 'a',
    streetAddressLine2: '',
    city: 'a',
    state: 'AL',
    zip: '12345',
    formUser: 'patient',
    patientEmail: 'a@a.com',
    patientNumber: '(123) 721-7372',
    parentEmail: 'test@test.com',
    parentNumber: '(123) 721-7372',
};
exports.DEFAULT_TEST_TIMEOUT = 100000;
describe.skip('appointments validation tests', function () {
    var oystehr = null;
    var incompletePatientError = 'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.ethnicity", "patient.race", "patient.reasonForVisit"';
    var incompleteHealthcareContactsError = 'These fields are required and may not be empty: "healthcareContacts.physicianFirstName", "healthcareContacts.physicianLastName", "healthcareContacts.physicianPhoneNumber", "healthcareContacts.pharmacyName ",  "healthcareContacts.pharmacyAddress"';
    vitest_1.vi.setConfig({ testTimeout: exports.DEFAULT_TEST_TIMEOUT });
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var PROJECT_API;
        return __generator(this, function (_a) {
            PROJECT_API = secrets_1.SECRETS.PROJECT_API;
            oystehr = new sdk_1.default({ projectApiUrl: PROJECT_API });
            return [2 /*return*/];
        });
    }); });
    function createAppointment(body) {
        if (!oystehr) {
            throw new Error('zambdaClient is not defined');
        }
        return oystehr.zambda.execute(__assign({ id: 'create-appointment' }, body));
    }
    test('Create an appointment without a body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(createAppointment()).rejects.toEqual({
                        error: 'No request body provided',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with an empty body, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({})).rejects.toEqual({
                        error: 'These fields are required: "slot", "patient", "healthcareContacts", "contact", "timezone", "location"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment without full patient information, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.firstName;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 1:
                    _a.sent();
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.lastName;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 2:
                    _a.sent();
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.sex;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 3:
                    _a.sent();
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.dateOfBirth;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 4:
                    _a.sent();
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.ethnicity;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 5:
                    _a.sent();
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.race;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 6:
                    _a.sent();
                    patientTemp = structuredClone(exports.patient);
                    delete patientTemp.reasonForVisit;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: {},
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment without full healthcare information, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var healthcareContactsTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    healthcareContactsTemp = structuredClone(exports.healthcareContacts);
                    delete healthcareContactsTemp.physicianFirstName;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: healthcareContactsTemp,
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteHealthcareContactsError,
                        })];
                case 1:
                    _a.sent();
                    healthcareContactsTemp = structuredClone(exports.healthcareContacts);
                    delete healthcareContactsTemp.physicianLastName;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: healthcareContactsTemp,
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteHealthcareContactsError,
                        })];
                case 2:
                    _a.sent();
                    healthcareContactsTemp = structuredClone(exports.healthcareContacts);
                    delete healthcareContactsTemp.physicianPhoneNumber;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: healthcareContactsTemp,
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteHealthcareContactsError,
                        })];
                case 3:
                    _a.sent();
                    healthcareContactsTemp = structuredClone(exports.healthcareContacts);
                    delete healthcareContactsTemp.pharmacyName;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: healthcareContactsTemp,
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteHealthcareContactsError,
                        })];
                case 4:
                    _a.sent();
                    healthcareContactsTemp = structuredClone(exports.healthcareContacts);
                    delete healthcareContactsTemp.pharmacyAddress;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: healthcareContactsTemp,
                            contact: {},
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteHealthcareContactsError,
                        })];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment without full contact information, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var incompleteContactError, contactTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    incompleteContactError = 'These fields are required: "contact.streetAddressLine1", "contact.city", "contact.state", "contact.zip"';
                    contactTemp = structuredClone(exports.contact);
                    delete contactTemp.streetAddressLine1;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteContactError,
                        })];
                case 1:
                    _a.sent();
                    contactTemp = structuredClone(exports.contact);
                    delete contactTemp.city;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteContactError,
                        })];
                case 2:
                    _a.sent();
                    contactTemp = structuredClone(exports.contact);
                    delete contactTemp.state;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteContactError,
                        })];
                case 3:
                    _a.sent();
                    contactTemp = structuredClone(exports.contact);
                    delete contactTemp.zip;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteContactError,
                        })];
                case 4:
                    _a.sent();
                    contactTemp = structuredClone(exports.contact);
                    delete contactTemp.patientEmail;
                    delete contactTemp.patientNumber;
                    delete contactTemp.parentEmail;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: 'If patient email and number are undefined or empty, guardian email and number must be defined',
                        })];
                case 5:
                    _a.sent();
                    contactTemp = structuredClone(exports.contact);
                    delete contactTemp.parentEmail;
                    delete contactTemp.parentNumber;
                    delete contactTemp.patientNumber;
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: 'If guardian email and number are undefined or empty, patient email and number must be defined',
                        })];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted patient sex, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientTemp = structuredClone(exports.patient);
                    patientTemp.sex = 'test';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: exports.healthcareContacts,
                            contact: exports.contact,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"patient.sex" must be one of the following values: ["male","female","other"]',
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted patient ethnicity, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientTemp = structuredClone(exports.patient);
                    patientTemp.ethnicity = 'test';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: exports.healthcareContacts,
                            contact: exports.contact,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"patient.ethnicity" must be one of the following values: ["Hispanic or Latino","Not Hispanic or Latino","Unknown"]',
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted patient race, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientTemp = structuredClone(exports.patient);
                    patientTemp.race = 'test';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: exports.healthcareContacts,
                            contact: exports.contact,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"patient.race" must be one of the following values: ["American Indian or Alaska Native","Asian","Black or African American","Hawaiian or Pacific Islander","Other","Unknown","Decline to Specify","White"]',
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted patient date of birth, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientTemp = structuredClone(exports.patient);
                    patientTemp.dateOfBirth = '01-01-1990';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: exports.healthcareContacts,
                            contact: exports.contact,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"patient.dateOfBirth" was not read as a valid date',
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted patient first name, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var patientTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    patientTemp = structuredClone(exports.patient);
                    patientTemp.firstName = '';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: patientTemp,
                            healthcareContacts: exports.healthcareContacts,
                            contact: exports.contact,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompletePatientError,
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted healthcareContacts physician first name, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var healthcareContactsTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    healthcareContactsTemp = structuredClone(exports.healthcareContacts);
                    healthcareContactsTemp.physicianFirstName = '';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: healthcareContactsTemp,
                            contact: exports.contact,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: incompleteHealthcareContactsError,
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create appointment with invalid zip code, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var contactTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    contactTemp = structuredClone(exports.contact);
                    contactTemp.zip = 'hello';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"contact.zip" must be 5 digits',
                        })];
                case 1:
                    _a.sent();
                    contactTemp.zip = '1234';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"contact.zip" must be 5 digits',
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with unaccepted contact state, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        var contactTemp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    contactTemp = structuredClone(exports.contact);
                    contactTemp.state = 'A';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"contact.state" and "patient.state" must be 2 letters',
                        })];
                case 1:
                    _a.sent();
                    contactTemp.state = 'AB';
                    return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                            slot: '2023-08-26T04:00:00Z',
                            patient: exports.patient,
                            healthcareContacts: exports.healthcareContacts,
                            contact: contactTemp,
                            timezone: 'America/New_York',
                            location: exports.location,
                        })).rejects.toEqual({
                            error: '"contact.state" must be one of the following values: ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VI","VT","WA","WV","WI","WY"]',
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with no timezone provided, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                        slot: '2023-08-26T04:00:00Z',
                        patient: exports.patient,
                        healthcareContacts: exports.healthcareContacts,
                        contact: exports.contact,
                        timezone: undefined,
                        location: exports.location,
                    })).rejects.toEqual({
                        error: 'These fields are required: "slot", "patient", "healthcareContacts", "contact", "timezone", "location"',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('Create an appointment with invalid slot provided, fail', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, vitest_1.expect)(createAppointment({
                        slot: '2023-08-26T',
                        patient: exports.patient,
                        healthcareContacts: exports.healthcareContacts,
                        contact: exports.contact,
                        timezone: 'America/New_York',
                        location: exports.location,
                    })).rejects.toEqual({
                        error: '"slot" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS+zz:zz)',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});

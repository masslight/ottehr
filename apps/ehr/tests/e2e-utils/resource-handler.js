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
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
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
var _ResourceHandler_apiClient, _ResourceHandler_authToken, _ResourceHandler_resources, _ResourceHandler_createAppointmentZambdaId, _ResourceHandler_flow, _ResourceHandler_initPromise, _ResourceHandler_paperworkAnswers, _ResourceHandler_processId;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceHandler = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_STATE = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_CITY = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME = exports.PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME = exports.PATIENT_INSURANCE_MEMBER_ID_2 = exports.PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = exports.PATIENT_INSURANCE_POLICY_HOLDER_ZIP = exports.PATIENT_INSURANCE_POLICY_HOLDER_STATE = exports.PATIENT_INSURANCE_POLICY_HOLDER_CITY = exports.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = exports.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS = exports.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT = exports.PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX = exports.PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = exports.PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME = exports.PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME = exports.PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME = exports.PATIENT_INSURANCE_MEMBER_ID = exports.PATIENT_REASON_FOR_VISIT = exports.PATIENT_POSTAL_CODE = exports.PATIENT_STATE = exports.PATIENT_LINE_2 = exports.PATIENT_LINE = exports.PATIENT_CITY = exports.PATIENT_EMAIL = exports.PATIENT_PHONE_NUMBER = exports.PATIENT_BIRTH_DATE_LONG = exports.PATIENT_BIRTH_DATE_SHORT = exports.PATIENT_BIRTHDAY = exports.PATIENT_GENDER = exports.PATIENT_LAST_NAME = exports.PATIENT_FIRST_NAME = void 0;
exports.getAccessToken = getAccessToken;
var sdk_1 = require("@oystehr/sdk");
var fs_1 = require("fs");
var luxon_1 = require("luxon");
var path_1 = require("path");
var url_1 = require("url");
var utils_1 = require("utils");
var in_person_intake_questionnaire_json_1 = require("../../../../packages/utils/lib/deployed-resources/questionnaires/in-person-intake-questionnaire.json");
var getAuth0Token_1 = require("./auth/getAuth0Token");
var employees_1 = require("./resource/employees");
var seed_ehr_appointment_data_json_1 = require("./seed-data/seed-ehr-appointment-data.json");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = (0, path_1.dirname)(__filename);
function getAccessToken() {
    var userJsonPath = (0, path_1.join)(__dirname, '../../playwright/user.json');
    var userData = JSON.parse((0, fs_1.readFileSync)(userJsonPath, 'utf-8'));
    var authData = userData.origins[0].localStorage.find(function (item) {
        return item.name.includes('api.zapehr.com');
    });
    if (!authData) {
        throw new Error('Auth data not found');
    }
    var token = JSON.parse(authData.value).body.access_token;
    return token;
}
var EightDigitsString = '20250519';
exports.PATIENT_FIRST_NAME = 'Jon';
exports.PATIENT_LAST_NAME = 'Snow';
exports.PATIENT_GENDER = 'Male';
exports.PATIENT_BIRTHDAY = '2002-07-07';
exports.PATIENT_BIRTH_DATE_SHORT = '07/07/2002';
exports.PATIENT_BIRTH_DATE_LONG = 'July 07, 2002';
exports.PATIENT_PHONE_NUMBER = '21' + EightDigitsString;
exports.PATIENT_EMAIL = "john.doe.".concat(EightDigitsString, "3@example.com");
exports.PATIENT_CITY = 'New York';
exports.PATIENT_LINE = "".concat(EightDigitsString, " Test Line");
exports.PATIENT_LINE_2 = 'Apt 4B';
exports.PATIENT_STATE = 'NY';
exports.PATIENT_POSTAL_CODE = '06001';
exports.PATIENT_REASON_FOR_VISIT = 'Fever';
exports.PATIENT_INSURANCE_MEMBER_ID = '123123';
exports.PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME = 'John';
exports.PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME = 'Doe';
exports.PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Michael';
exports.PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '1990-01-01';
exports.PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Male';
exports.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT = false;
exports.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS = '123 Main St';
exports.PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'Apt 1';
exports.PATIENT_INSURANCE_POLICY_HOLDER_CITY = 'San Sebastian';
exports.PATIENT_INSURANCE_POLICY_HOLDER_STATE = 'CA';
exports.PATIENT_INSURANCE_POLICY_HOLDER_ZIP = '92000';
exports.PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Parent';
exports.PATIENT_INSURANCE_MEMBER_ID_2 = '234234';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME = 'Jane';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME = 'Doe';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME = 'Michael';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH = '1991-01-01';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX = 'Female';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT = false;
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS = '123 Main St';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE = 'Apt 1';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_CITY = 'New York';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_STATE = 'NY';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP = '06001';
exports.PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED = 'Parent';
var ResourceHandler = /** @class */ (function () {
    function ResourceHandler(processId, flow, paperworkAnswers) {
        if (flow === void 0) { flow = 'in-person'; }
        _ResourceHandler_apiClient.set(this, void 0);
        _ResourceHandler_authToken.set(this, void 0);
        _ResourceHandler_resources.set(this, void 0);
        _ResourceHandler_createAppointmentZambdaId.set(this, void 0);
        _ResourceHandler_flow.set(this, void 0);
        _ResourceHandler_initPromise.set(this, void 0);
        _ResourceHandler_paperworkAnswers.set(this, void 0);
        _ResourceHandler_processId.set(this, void 0);
        __classPrivateFieldSet(this, _ResourceHandler_flow, flow, "f");
        __classPrivateFieldSet(this, _ResourceHandler_paperworkAnswers, paperworkAnswers, "f");
        __classPrivateFieldSet(this, _ResourceHandler_initPromise, this.initApi(), "f");
        __classPrivateFieldSet(this, _ResourceHandler_processId, processId, "f");
        __classPrivateFieldSet(this, _ResourceHandler_createAppointmentZambdaId, 'create-appointment', "f");
    }
    ResourceHandler.getOystehr = function () {
        return __awaiter(this, void 0, void 0, function () {
            var authToken, oystehr;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, getAuth0Token_1.getAuth0Token)()];
                    case 1:
                        authToken = _a.sent();
                        oystehr = new sdk_1.default({
                            accessToken: authToken,
                            fhirApiUrl: process.env.FHIR_API,
                            projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
                        });
                        return [2 /*return*/, oystehr];
                }
            });
        });
    };
    Object.defineProperty(ResourceHandler.prototype, "apiClient", {
        get: function () {
            return __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f");
        },
        enumerable: false,
        configurable: true
    });
    ResourceHandler.prototype.initApi = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (__classPrivateFieldGet(this, _ResourceHandler_apiClient, "f") && __classPrivateFieldGet(this, _ResourceHandler_authToken, "f")) {
                            return [2 /*return*/];
                        }
                        _a = [this, _ResourceHandler_authToken];
                        return [4 /*yield*/, (0, getAuth0Token_1.getAuth0Token)()];
                    case 1:
                        __classPrivateFieldSet.apply(void 0, _a.concat([_b.sent(), "f"]));
                        __classPrivateFieldSet(this, _ResourceHandler_apiClient, new sdk_1.default({
                            accessToken: __classPrivateFieldGet(this, _ResourceHandler_authToken, "f"),
                            fhirApiUrl: process.env.FHIR_API,
                            projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
                        }), "f");
                        return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.createAppointment = function (inputParams) {
        return __awaiter(this, void 0, void 0, function () {
            var address, patientData, appointmentData, error_1;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_initPromise, "f")];
                    case 1:
                        _p.sent();
                        _p.label = 2;
                    case 2:
                        _p.trys.push([2, 4, , 5]);
                        address = {
                            city: (_a = inputParams === null || inputParams === void 0 ? void 0 : inputParams.city) !== null && _a !== void 0 ? _a : exports.PATIENT_CITY,
                            line: [(_b = inputParams === null || inputParams === void 0 ? void 0 : inputParams.line) !== null && _b !== void 0 ? _b : exports.PATIENT_LINE],
                            state: (_c = inputParams === null || inputParams === void 0 ? void 0 : inputParams.state) !== null && _c !== void 0 ? _c : exports.PATIENT_STATE,
                            postalCode: (_d = inputParams === null || inputParams === void 0 ? void 0 : inputParams.postalCode) !== null && _d !== void 0 ? _d : exports.PATIENT_POSTAL_CODE,
                        };
                        patientData = {
                            firstNames: [(_e = inputParams === null || inputParams === void 0 ? void 0 : inputParams.firstName) !== null && _e !== void 0 ? _e : exports.PATIENT_FIRST_NAME],
                            lastNames: [(_f = inputParams === null || inputParams === void 0 ? void 0 : inputParams.lastName) !== null && _f !== void 0 ? _f : exports.PATIENT_LAST_NAME],
                            numberOfAppointments: 1,
                            reasonsForVisit: [(_g = inputParams === null || inputParams === void 0 ? void 0 : inputParams.reasonsForVisit) !== null && _g !== void 0 ? _g : exports.PATIENT_REASON_FOR_VISIT],
                            phoneNumbers: [(_h = inputParams === null || inputParams === void 0 ? void 0 : inputParams.phoneNumber) !== null && _h !== void 0 ? _h : exports.PATIENT_PHONE_NUMBER],
                            emails: [(_j = inputParams === null || inputParams === void 0 ? void 0 : inputParams.email) !== null && _j !== void 0 ? _j : exports.PATIENT_EMAIL],
                            gender: (_k = inputParams === null || inputParams === void 0 ? void 0 : inputParams.gender) !== null && _k !== void 0 ? _k : exports.PATIENT_GENDER.toLowerCase(),
                            birthDate: (_l = inputParams === null || inputParams === void 0 ? void 0 : inputParams.birthDate) !== null && _l !== void 0 ? _l : exports.PATIENT_BIRTHDAY,
                            address: [address],
                        };
                        if (!process.env.PROJECT_API_ZAMBDA_URL) {
                            throw new Error('PROJECT_API_ZAMBDA_URL is not set');
                        }
                        if (!process.env.LOCATION_ID) {
                            throw new Error('LOCATION_ID is not set');
                        }
                        if (!process.env.STATE_ONE) {
                            throw new Error('STATE_ONE is not set');
                        }
                        if (!process.env.PROJECT_ID) {
                            throw new Error('PROJECT_ID is not set');
                        }
                        return [4 /*yield*/, (0, utils_1.createSampleAppointments)({
                                oystehr: __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f"),
                                authToken: getAccessToken(),
                                phoneNumber: (0, utils_1.formatPhoneNumber)(exports.PATIENT_PHONE_NUMBER),
                                createAppointmentZambdaId: __classPrivateFieldGet(this, _ResourceHandler_createAppointmentZambdaId, "f"),
                                zambdaUrl: process.env.PROJECT_API_ZAMBDA_URL,
                                serviceMode: __classPrivateFieldGet(this, _ResourceHandler_flow, "f") === 'telemed' ? utils_1.ServiceMode.virtual : utils_1.ServiceMode['in-person'],
                                selectedLocationId: (_m = inputParams === null || inputParams === void 0 ? void 0 : inputParams.selectedLocationId) !== null && _m !== void 0 ? _m : process.env.LOCATION_ID,
                                locationState: (_o = inputParams === null || inputParams === void 0 ? void 0 : inputParams.telemedLocationState) !== null && _o !== void 0 ? _o : process.env.STATE_ONE, // todo: check why state is used here
                                demoData: patientData,
                                projectId: process.env.PROJECT_ID,
                                paperworkAnswers: __classPrivateFieldGet(this, _ResourceHandler_paperworkAnswers, "f"),
                                appointmentMetadata: getProcessMetaTag(__classPrivateFieldGet(this, _ResourceHandler_processId, "f")),
                            })];
                    case 3:
                        appointmentData = _p.sent();
                        if (!(appointmentData === null || appointmentData === void 0 ? void 0 : appointmentData.resources)) {
                            throw new Error('Appointment not created');
                        }
                        Object.values(appointmentData.resources).forEach(function (resource) {
                            console.log("\u2705 created ".concat(resource.resourceType, ": ").concat(resource.id));
                        });
                        if (appointmentData.relatedPersonId) {
                            console.log("\u2705 created relatedPerson: ".concat(appointmentData.relatedPersonId));
                        }
                        return [2 /*return*/, appointmentData];
                    case 4:
                        error_1 = _p.sent();
                        console.error('❌ Failed to create resources:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.setResources = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createAppointment(params)];
                    case 1:
                        response = _a.sent();
                        __classPrivateFieldSet(this, _ResourceHandler_resources, __assign(__assign({}, response.resources), { 
                            // add relatedPerson to resources to make possible to clean it up; endpoint returns only id
                            relatedPerson: {
                                id: response.relatedPersonId,
                                resourceType: 'RelatedPerson',
                            } }), "f");
                        return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.setResourcesFast = function (_params) {
        return __awaiter(this, void 0, void 0, function () {
            var schedule, seedDataString, hydratedFastSeedJSON, createdResources;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_initPromise, "f")];
                    case 1:
                        _c.sent();
                        if (process.env.LOCATION_ID == null) {
                            throw new Error('LOCATION_ID is not set');
                        }
                        return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f").fhir.search({
                                resourceType: 'Schedule',
                                params: [
                                    {
                                        name: 'actor',
                                        value: "Location/".concat(process.env.LOCATION_ID),
                                    },
                                ],
                            })];
                    case 2:
                        schedule = (_c.sent()).unbundle()[0];
                        seedDataString = JSON.stringify(seed_ehr_appointment_data_json_1.default);
                        seedDataString = seedDataString.replace(/\{\{locationId\}\}/g, process.env.LOCATION_ID);
                        seedDataString = seedDataString.replace(/\{\{scheduleId\}\}/g, schedule.id);
                        seedDataString = seedDataString.replace(/\{\{questionnaireUrl\}\}/g, "".concat(in_person_intake_questionnaire_json_1.default.resource.url, "|").concat(in_person_intake_questionnaire_json_1.default.resource.version));
                        seedDataString = seedDataString.replace(/\{\{date\}\}/g, luxon_1.DateTime.now().toUTC().toFormat('yyyy-MM-dd'));
                        hydratedFastSeedJSON = JSON.parse(seedDataString);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f").fhir.transaction({
                                requests: hydratedFastSeedJSON.entry.map(function (entry) {
                                    if (entry.request.method !== 'POST') {
                                        throw new Error('Only POST method is supported in fast mode');
                                    }
                                    var resource = entry.resource;
                                    if (resource.resourceType === 'Appointment') {
                                        resource = addProcessIdMetaTagToResource(resource, __classPrivateFieldGet(_this, _ResourceHandler_processId, "f"));
                                    }
                                    return {
                                        method: entry.request.method,
                                        url: entry.request.url,
                                        fullUrl: entry.fullUrl,
                                        resource: entry.resource,
                                    };
                                }),
                            })];
                    case 3:
                        createdResources = (_b = (_a = (_c.sent()).entry) === null || _a === void 0 ? void 0 : _a.map(function (entry) { return entry.resource; }).filter(function (entry) { return entry !== undefined; })) !== null && _b !== void 0 ? _b : [];
                        __classPrivateFieldSet(this, _ResourceHandler_resources, {
                            patient: createdResources.find(function (resource) { return resource.resourceType === 'Patient'; }),
                            relatedPerson: {
                                id: createdResources.find(function (resource) { return resource.resourceType === 'RelatedPerson'; }).id,
                                resourceType: 'RelatedPerson',
                            },
                            appointment: createdResources.find(function (resource) { return resource.resourceType === 'Appointment'; }),
                            encounter: createdResources.find(function (resource) { return resource.resourceType === 'Encounter'; }),
                            questionnaire: createdResources.find(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; }),
                        }, "f");
                        return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.cleanupResources = function () {
        return __awaiter(this, void 0, void 0, function () {
            var metaTagCoding;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        metaTagCoding = getProcessMetaTag(__classPrivateFieldGet(this, _ResourceHandler_processId, "f"));
                        if (!((_a = metaTagCoding === null || metaTagCoding === void 0 ? void 0 : metaTagCoding.tag) === null || _a === void 0 ? void 0 : _a[0])) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, utils_1.cleanAppointmentGraph)(metaTagCoding.tag[0], __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f"))];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.waitTillAppointmentPreprocessed = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var i, appointment, tags, isProcessed, e_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, this.initApi()];
                    case 1:
                        _b.sent();
                        i = 0;
                        _b.label = 2;
                    case 2:
                        if (!(i < 10)) return [3 /*break*/, 6];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f").fhir.search({
                                resourceType: 'Appointment',
                                params: [
                                    {
                                        name: '_id',
                                        value: id,
                                    },
                                ],
                            })];
                    case 3:
                        appointment = (_b.sent()).unbundle()[0];
                        tags = ((_a = appointment === null || appointment === void 0 ? void 0 : appointment.meta) === null || _a === void 0 ? void 0 : _a.tag) || [];
                        isProcessed = tags.some(function (tag) { return (tag === null || tag === void 0 ? void 0 : tag.code) === utils_1.FHIR_APPOINTMENT_PREPROCESSED_TAG.code; });
                        if (isProcessed) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 3000); })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        i++;
                        return [3 /*break*/, 2];
                    case 6: throw new Error("Appointment wasn't preprocessed");
                    case 7:
                        e_1 = _b.sent();
                        console.error('Error during waitTillAppointmentPreprocessed', e_1);
                        throw e_1;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.waitTillHarvestingDone = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            var i, appointment, tags, isHarvestingDone, e_2;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, this.initApi()];
                    case 1:
                        _b.sent();
                        i = 0;
                        _b.label = 2;
                    case 2:
                        if (!(i < 10)) return [3 /*break*/, 6];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f").fhir.search({
                                resourceType: 'Appointment',
                                params: [
                                    {
                                        name: '_id',
                                        value: appointmentId,
                                    },
                                ],
                            })];
                    case 3:
                        appointment = (_b.sent()).unbundle()[0];
                        tags = ((_a = appointment === null || appointment === void 0 ? void 0 : appointment.meta) === null || _a === void 0 ? void 0 : _a.tag) || [];
                        isHarvestingDone = tags.some(function (tag) { return (tag === null || tag === void 0 ? void 0 : tag.code) === utils_1.FHIR_APPOINTMENT_INTAKE_HARVESTING_COMPLETED_TAG.code; });
                        if (isHarvestingDone) {
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 6000); })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        i++;
                        return [3 /*break*/, 2];
                    case 6: throw new Error("Appointment wasn't harvested by sub-intake-harvest module");
                    case 7:
                        e_2 = _b.sent();
                        console.error('Error during waitTillHarvestingDone', e_2);
                        throw e_2;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.setEmployees = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, employee1, employee2, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_initPromise, "f")];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, Promise.all([
                                (0, employees_1.inviteTestEmployeeUser)(employees_1.TEST_EMPLOYEE_1, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f"), __classPrivateFieldGet(this, _ResourceHandler_authToken, "f")),
                                (0, employees_1.inviteTestEmployeeUser)(employees_1.TEST_EMPLOYEE_2, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f"), __classPrivateFieldGet(this, _ResourceHandler_authToken, "f")),
                            ])];
                    case 2:
                        _a = _b.sent(), employee1 = _a[0], employee2 = _a[1];
                        this.testEmployee1 = employee1;
                        this.testEmployee2 = employee2;
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _b.sent();
                        console.error('❌ New providers were not invited', error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    ResourceHandler.prototype.deleteEmployees = function () {
        return __awaiter(this, void 0, void 0, function () {
            var e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        if (!(process.env.AUTH0_CLIENT_TESTS && process.env.AUTH0_SECRET_TESTS)) return [3 /*break*/, 2];
                        return [4 /*yield*/, Promise.all([
                                (0, employees_1.removeUser)(this.testEmployee1.id, this.testEmployee1.profile.id, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f"), __classPrivateFieldGet(this, _ResourceHandler_authToken, "f")),
                                (0, employees_1.removeUser)(this.testEmployee2.id, this.testEmployee2.profile.id, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f"), __classPrivateFieldGet(this, _ResourceHandler_authToken, "f")),
                            ])];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2: throw new Error('No "AUTH0_CLIENT_TESTS" or "AUTH0_SECRET_TESTS" secret provided');
                    case 3: return [3 /*break*/, 5];
                    case 4:
                        e_3 = _a.sent();
                        console.error('❌ Failed to delete users: ', e_3);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(ResourceHandler.prototype, "patient", {
        get: function () {
            return this.findResourceByType('Patient');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ResourceHandler.prototype, "appointment", {
        get: function () {
            return this.findResourceByType('Appointment');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ResourceHandler.prototype, "encounter", {
        get: function () {
            return this.findResourceByType('Encounter');
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ResourceHandler.prototype, "questionnaireResponse", {
        get: function () {
            return this.findResourceByType('QuestionnaireResponse');
        },
        enumerable: false,
        configurable: true
    });
    ResourceHandler.prototype.findResourceByType = function (resourceType) {
        var resource = Object.values(__classPrivateFieldGet(this, _ResourceHandler_resources, "f")).find(function (resource) { return resource.resourceType === resourceType; });
        if (!resource) {
            throw new Error("Resource ".concat(resourceType, " not found in the resources"));
        }
        return resource;
    };
    ResourceHandler.prototype.patientIdByAppointmentId = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            var appointment, patientId;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f").fhir.get({
                            resourceType: 'Appointment',
                            id: appointmentId,
                        })];
                    case 1:
                        appointment = _d.sent();
                        patientId = (_c = (_b = (_a = appointment.participant
                            .find(function (participant) { var _a, _b; return (_b = (_a = participant.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
                        if (patientId == null) {
                            throw new Error("Patient for appointment ".concat(appointmentId, " not found"));
                        }
                        return [2 /*return*/, patientId];
                }
            });
        });
    };
    ResourceHandler.prototype.getTestsUserAndPractitioner = function () {
        return __awaiter(this, void 0, void 0, function () {
            var oystehrProjectId, oystFetch, users, user, practitioner;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_initPromise, "f")];
                    case 1:
                        _a.sent();
                        oystehrProjectId = process.env.PROJECT_ID;
                        if (!oystehrProjectId)
                            throw new Error('secret PROJECT_ID is not set');
                        oystFetch = (0, utils_1.createFetchClientWithOystAuth)({ authToken: __classPrivateFieldGet(this, _ResourceHandler_authToken, "f"), projectId: oystehrProjectId }).oystFetch;
                        return [4 /*yield*/, oystFetch('GET', 'https://project-api.zapehr.com/v1/user')];
                    case 2:
                        users = _a.sent();
                        user = users === null || users === void 0 ? void 0 : users.find(function (user) { return user.email === process.env.TEXT_USERNAME; });
                        if (!user)
                            throw new Error('Failed to find authorized user');
                        return [4 /*yield*/, __classPrivateFieldGet(this, _ResourceHandler_apiClient, "f").fhir.get({
                                resourceType: 'Practitioner',
                                id: user.profile.replace('Practitioner/', ''),
                            })];
                    case 3:
                        practitioner = (_a.sent());
                        return [2 /*return*/, {
                                id: user.id,
                                name: user.name,
                                email: user.email,
                                practitioner: practitioner,
                            }];
                }
            });
        });
    };
    return ResourceHandler;
}());
exports.ResourceHandler = ResourceHandler;
_ResourceHandler_apiClient = new WeakMap(), _ResourceHandler_authToken = new WeakMap(), _ResourceHandler_resources = new WeakMap(), _ResourceHandler_createAppointmentZambdaId = new WeakMap(), _ResourceHandler_flow = new WeakMap(), _ResourceHandler_initPromise = new WeakMap(), _ResourceHandler_paperworkAnswers = new WeakMap(), _ResourceHandler_processId = new WeakMap();
var addProcessIdMetaTagToResource = function (resource, processId) {
    var _a;
    var existingMeta = resource.meta || { tag: [] };
    var existingTags = (_a = existingMeta.tag) !== null && _a !== void 0 ? _a : [];
    resource.meta = __assign(__assign({}, existingMeta), { tag: __spreadArray(__spreadArray([], existingTags, true), [
            {
                system: utils_1.E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
                code: processId,
            },
        ], false) });
    return resource;
};
var getProcessMetaTag = function (processId) {
    return {
        tag: [
            {
                system: utils_1.E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
                code: processId,
            },
        ],
    };
};
//# sourceMappingURL=resource-handler.js.map
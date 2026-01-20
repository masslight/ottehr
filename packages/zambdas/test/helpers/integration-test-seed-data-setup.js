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
exports.setupIntegrationTest = exports.cleanupResources = exports.insertInPersonAppointmentBase = exports.getProcessMetaTag = exports.addProcessIdMetaTagToResource = exports.createProcessId = exports.INTEGRATION_TEST_PROCESS_ID_SYSTEM = void 0;
var node_console_1 = require("node:console");
var sdk_1 = require("@oystehr/sdk");
var seed_data_1 = require("ehr-ui/tests/e2e-utils/seed-data");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var in_person_intake_questionnaire_json_1 = require("../../../../config/oystehr/in-person-intake-questionnaire.json");
var local_json_1 = require("../../.env/local.json");
var shared_1 = require("../../src/shared");
var secrets_1 = require("../data/secrets");
/**
 * Constants for integration test setup
 */
exports.INTEGRATION_TEST_PROCESS_ID_SYSTEM = 'INTEGRATION_TEST_PROCESS_ID_SYSTEM';
/**
 * Creates a unique process ID for the test run
 * @param testFileName - The name of the test file (e.g., 'get-chart-data.test.ts')
 * @returns A unique process ID string
 */
var createProcessId = function (testFileName) {
    return "".concat(testFileName, "-").concat(luxon_1.DateTime.now().toMillis());
};
exports.createProcessId = createProcessId;
/**
 * Adds a process ID meta tag to a FHIR resource for tracking and cleanup
 * @param resource - The FHIR resource to tag
 * @param processId - The process ID to tag the resource with
 * @returns The resource with the added meta tag
 */
var addProcessIdMetaTagToResource = function (resource, processId) {
    var _a;
    var existingMeta = resource.meta || { tag: [] };
    var existingTags = (_a = existingMeta.tag) !== null && _a !== void 0 ? _a : [];
    resource.meta = __assign(__assign({}, existingMeta), { tag: __spreadArray(__spreadArray([], existingTags, true), [
            {
                system: exports.INTEGRATION_TEST_PROCESS_ID_SYSTEM,
                code: processId,
            },
        ], false) });
    return resource;
};
exports.addProcessIdMetaTagToResource = addProcessIdMetaTagToResource;
/**
 * Gets the process meta tag structure for querying
 * @param processId - The process ID
 * @returns Meta tag object for the process ID
 */
var getProcessMetaTag = function (processId) {
    return {
        tag: [
            {
                system: exports.INTEGRATION_TEST_PROCESS_ID_SYSTEM,
                code: processId,
            },
        ],
    };
};
exports.getProcessMetaTag = getProcessMetaTag;
/**
 * Inserts a full set of appointment data into the FHIR server
 * Creates a Location and Schedule first, then uses those IDs to create the rest of the resources
 * @param oystehr - The Oystehr client instance
 * @param processId - The process ID for tagging resources
 * @returns The created Patient, RelatedPerson, Appointment, Encounter, and QuestionnaireResponse
 */
var insertInPersonAppointmentBase = function (oystehr, processId) { return __awaiter(void 0, void 0, void 0, function () {
    var locationSpec, location, scheduleSpec, schedule, questionnaireKey, fhirResourcesAny, seedDataString, hydratedFastSeedJSON, createdResources;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                locationSpec = (0, exports.addProcessIdMetaTagToResource)({
                    resourceType: 'Location',
                }, processId);
                return [4 /*yield*/, oystehr.fhir.create(locationSpec)];
            case 1:
                location = _c.sent();
                scheduleSpec = (0, exports.addProcessIdMetaTagToResource)({
                    resourceType: 'Schedule',
                    actor: [{ reference: "Location/".concat(location.id) }],
                }, processId);
                return [4 /*yield*/, oystehr.fhir.create(scheduleSpec)];
            case 2:
                schedule = _c.sent();
                questionnaireKey = Object.keys(in_person_intake_questionnaire_json_1.default.fhirResources)[0];
                fhirResourcesAny = in_person_intake_questionnaire_json_1.default.fhirResources;
                seedDataString = JSON.stringify(seed_data_1.default);
                seedDataString = seedDataString.replace(/\{\{locationId\}\}/g, location.id);
                seedDataString = seedDataString.replace(/\{\{scheduleId\}\}/g, schedule.id);
                seedDataString = seedDataString.replace(/\{\{questionnaireUrl\}\}/g, "".concat(fhirResourcesAny[questionnaireKey].resource.url, "|").concat(fhirResourcesAny[questionnaireKey].resource.version));
                seedDataString = seedDataString.replace(/\{\{date\}\}/g, luxon_1.DateTime.now().toUTC().toFormat('yyyy-MM-dd'));
                hydratedFastSeedJSON = JSON.parse(seedDataString);
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: hydratedFastSeedJSON.entry.map(function (entry) {
                            if (entry.request.method !== 'POST') {
                                throw new Error('Only POST method is supported in fast mode');
                            }
                            var resource = entry.resource;
                            if (resource.resourceType === 'Appointment') {
                                resource = (0, exports.addProcessIdMetaTagToResource)(resource, processId);
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
                return [2 /*return*/, {
                        patient: createdResources.find(function (resource) { return resource.resourceType === 'Patient'; }),
                        relatedPerson: createdResources.find(function (resource) { return resource.resourceType === 'RelatedPerson'; }),
                        appointment: createdResources.find(function (resource) { return resource.resourceType === 'Appointment'; }),
                        encounter: createdResources.find(function (resource) { return resource.resourceType === 'Encounter'; }),
                        questionnaireResponse: createdResources.find(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; }),
                        clinicalImpression: createdResources.find(function (resource) { return resource.resourceType === 'ClinicalImpression'; }),
                    }];
        }
    });
}); };
exports.insertInPersonAppointmentBase = insertInPersonAppointmentBase;
/**
 * Cleans up all resources created during the test
 * @param oystehr - The Oystehr client instance
 * @param processId - The process ID used to tag resources
 */
var cleanupResources = function (oystehr, processId) { return __awaiter(void 0, void 0, void 0, function () {
    var metaTagCoding;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                metaTagCoding = (0, exports.getProcessMetaTag)(processId);
                if (!((_a = metaTagCoding === null || metaTagCoding === void 0 ? void 0 : metaTagCoding.tag) === null || _a === void 0 ? void 0 : _a[0])) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, utils_1.cleanAppointmentGraph)(metaTagCoding.tag[0], oystehr)];
            case 1:
                _b.sent();
                _b.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
exports.cleanupResources = cleanupResources;
/**
 * Sets up all necessary clients and data for integration tests
 * This function should be called in the beforeAll hook of integration tests
 * @param testFileName - The name of the test file (e.g., 'get-chart-data.test.ts')
 * @returns An object containing all setup data and cleanup function
 */
var setupIntegrationTest = function (testFileName, m2mClientMockType) { return __awaiter(void 0, void 0, void 0, function () {
    var AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID, token, EXECUTE_ZAMBDA_URL, oystehrAdmin, m2mListSearchResultData, testUserM2M, projectRoles, patientRoleId, patientForM2M, providerRoleId, practitionerForM2M, testUserM2MClientId, testUserM2MClientSecret, testUserM2MToken, oystehrTestUserM2M, processId, cleanup;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, FHIR_API = secrets_1.SECRETS.FHIR_API, PROJECT_ID = secrets_1.SECRETS.PROJECT_ID;
                return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                        AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                        AUTH0_CLIENT: local_json_1.AUTH0_CLIENT_TESTS,
                        AUTH0_SECRET: local_json_1.AUTH0_SECRET_TESTS,
                        AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                    })];
            case 1:
                token = _c.sent();
                EXECUTE_ZAMBDA_URL = (0, vitest_1.inject)('EXECUTE_ZAMBDA_URL');
                if (!EXECUTE_ZAMBDA_URL) {
                    throw new Error('EXECUTE_ZAMBDA_URL is not defined in vitest inject');
                }
                oystehrAdmin = new sdk_1.default({
                    accessToken: token,
                    fhirApiUrl: FHIR_API,
                    projectId: PROJECT_ID,
                });
                return [4 /*yield*/, oystehrAdmin.m2m.listV2({
                        name: testFileName,
                    })];
            case 2:
                m2mListSearchResultData = (_c.sent()).data;
                if (!(m2mListSearchResultData.length > 0)) return [3 /*break*/, 4];
                console.log('found existing M2M client for tests');
                return [4 /*yield*/, oystehrAdmin.m2m.get({
                        id: m2mListSearchResultData[0].id,
                    })];
            case 3:
                testUserM2M = _c.sent();
                (0, node_console_1.assert)(testUserM2M.description === m2mClientMockType, 'Found Test User M2M client should have correct mock type');
                return [3 /*break*/, 11];
            case 4:
                console.log('creating new M2M client for tests');
                return [4 /*yield*/, oystehrAdmin.role.list()];
            case 5:
                projectRoles = _c.sent();
                if (!(m2mClientMockType === utils_1.M2MClientMockType.patient)) return [3 /*break*/, 8];
                patientRoleId = (_a = projectRoles.find(function (role) { return role.name === 'Patient'; })) === null || _a === void 0 ? void 0 : _a.id;
                expect(patientRoleId).toBeDefined();
                return [4 /*yield*/, oystehrAdmin.fhir.create({
                        resourceType: 'Patient',
                        name: [{ given: ['M2M'], family: 'Client' }],
                        birthDate: '1978-01-01',
                        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
                    })];
            case 6:
                patientForM2M = _c.sent();
                return [4 /*yield*/, oystehrAdmin.m2m.create({
                        name: testFileName,
                        description: utils_1.M2MClientMockType.patient,
                        profile: "Patient/".concat(patientForM2M.id),
                        roles: [patientRoleId],
                    })];
            case 7:
                testUserM2M = _c.sent();
                return [3 /*break*/, 11];
            case 8:
                providerRoleId = (_b = projectRoles.find(function (role) { return role.name === utils_1.RoleType.Provider; })) === null || _b === void 0 ? void 0 : _b.id;
                expect(providerRoleId).toBeDefined();
                return [4 /*yield*/, oystehrAdmin.fhir.create({
                        resourceType: 'Practitioner',
                        name: [{ given: ['M2M'], family: 'Client' }],
                        birthDate: '1978-01-01',
                        telecom: [{ system: 'phone', value: '+11231231234', use: 'mobile' }],
                    })];
            case 9:
                practitionerForM2M = _c.sent();
                return [4 /*yield*/, oystehrAdmin.m2m.create({
                        name: testFileName,
                        description: utils_1.M2MClientMockType.provider,
                        profile: "Practitioner/".concat(practitionerForM2M.id),
                        roles: [providerRoleId],
                    })];
            case 10:
                testUserM2M = _c.sent();
                _c.label = 11;
            case 11:
                testUserM2MClientId = testUserM2M.clientId;
                return [4 /*yield*/, oystehrAdmin.m2m.rotateSecret({
                        id: testUserM2M.id,
                    })];
            case 12:
                testUserM2MClientSecret = (_c.sent()).secret;
                return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                        AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                        AUTH0_CLIENT: testUserM2MClientId,
                        AUTH0_SECRET: testUserM2MClientSecret,
                        AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                    })];
            case 13:
                testUserM2MToken = _c.sent();
                oystehrTestUserM2M = new sdk_1.default({
                    accessToken: testUserM2MToken,
                    fhirApiUrl: FHIR_API,
                    projectApiUrl: EXECUTE_ZAMBDA_URL,
                    projectId: PROJECT_ID,
                });
                processId = (0, exports.createProcessId)(testFileName);
                cleanup = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!oystehrAdmin) {
                                    throw new Error('oystehr is null! could not clean up!');
                                }
                                return [4 /*yield*/, (0, exports.cleanupResources)(oystehrAdmin, processId)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [2 /*return*/, {
                        oystehr: oystehrAdmin,
                        oystehrTestUserM2M: oystehrTestUserM2M,
                        token: token,
                        processId: processId,
                        cleanup: cleanup,
                    }];
        }
    });
}); };
exports.setupIntegrationTest = setupIntegrationTest;

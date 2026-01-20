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
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var lab_script_consts_1 = require("./lab-script-consts");
var lab_script_helpers_1 = require("./lab-script-helpers");
var EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging'];
var PATIENT = { first: 'PatientFirstName', last: 'PatientLastName', dob: '2001-01-01' };
var PRACTITIONER = { first: 'PractitionerFirstName', last: 'PractitionerLastName' };
var TEST = { code: '57021-8', display: 'CBC W Auto Differential panel in Blood' };
var AUTO_LAB_GUID = '790b282d-77e9-4697-9f59-0cef8238033a';
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var ENV, envConfig, token, oystehr, autoLabOrgSearch, autoLabOrg, autoLabOrgId, fillerId, labTransmissionAccountId, drIdentifier, obs, obsFullUrl, dr, drFullUrl, projectId, attachmentDocRef, requests, results, resultsToLog, e_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (process.argv.length !== 3) {
                    console.log("exiting, incorrect number of arguments passed\n");
                    console.log("Usage: npm run mock-unsolicited-result [".concat(EXAMPLE_ENVS.join(' | '), "]\n"));
                    process.exit(1);
                }
                ENV = process.argv[2];
                try {
                    envConfig = JSON.parse(fs_1.default.readFileSync(".env/".concat(ENV, ".json"), 'utf8'));
                }
                catch (error) {
                    console.error("Error parsing secrets for ENV '".concat(ENV, "'. Error: ").concat(JSON.stringify(error)));
                }
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(envConfig)];
            case 1:
                token = _b.sent();
                if (!token) {
                    throw new Error('Failed to fetch auth token.');
                }
                oystehr = (0, shared_1.createOystehrClient)(token, envConfig);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Organization',
                        params: [
                            {
                                name: 'identifier',
                                value: AUTO_LAB_GUID,
                            },
                        ],
                    })];
            case 2:
                autoLabOrgSearch = (_b.sent()).unbundle();
                autoLabOrg = autoLabOrgSearch[0];
                autoLabOrgId = autoLabOrg === null || autoLabOrg === void 0 ? void 0 : autoLabOrg.id;
                if (!autoLabOrgId) {
                    console.log('could not find lab org for auto lab, searching with lab guid', AUTO_LAB_GUID);
                    process.exit(1);
                }
                fillerId = {
                    value: createFillerNumber(),
                    use: 'usual',
                    type: {
                        coding: [
                            {
                                code: 'FILL',
                            },
                        ],
                        text: 'Filler entity id',
                    },
                };
                labTransmissionAccountId = {
                    system: 'https://identifiers.fhir.oystehr.com/lab-transmission-account-number',
                    value: 'test',
                    assigner: {
                        reference: "Organization/".concat(autoLabOrgId),
                    },
                };
                drIdentifier = [fillerId, labTransmissionAccountId];
                obs = createObs();
                obsFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                dr = createUnsolicitedResultDr({
                    drIdentifier: drIdentifier,
                    obsFullUrl: obsFullUrl,
                    patient: PATIENT,
                    practitioner: PRACTITIONER,
                    test: TEST,
                    labOrgId: autoLabOrgId,
                });
                drFullUrl = "urn:uuid:".concat((0, crypto_1.randomUUID)());
                projectId = envConfig.PROJECT_ID;
                if (!projectId)
                    throw new Error("Could not get projectId");
                attachmentDocRef = (0, lab_script_helpers_1.createResultAttachmentDocRef)({
                    ENV: ENV,
                    projectId: projectId,
                    relatedDiagnosticReportReferences: [{ reference: drFullUrl }],
                    encounterRef: undefined,
                    patientRef: undefined,
                });
                requests = [
                    { method: 'POST', fullUrl: obsFullUrl, url: '/Observation', resource: obs },
                    { method: 'POST', fullUrl: drFullUrl, url: '/DiagnosticReport', resource: dr },
                    { method: 'POST', url: '/DocumentReference', resource: attachmentDocRef },
                ];
                _b.label = 3;
            case 3:
                _b.trys.push([3, 5, , 6]);
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 4:
                results = _b.sent();
                console.log('success!');
                resultsToLog = (_a = results.entry) === null || _a === void 0 ? void 0 : _a.map(function (entryItem) { return entryItem.resource; });
                resultsToLog === null || resultsToLog === void 0 ? void 0 : resultsToLog.forEach(function (result) { return console.log("".concat(result === null || result === void 0 ? void 0 : result.resourceType, "/").concat(result === null || result === void 0 ? void 0 : result.id)); });
                return [3 /*break*/, 6];
            case 5:
                e_1 = _b.sent();
                console.log('error creating resources: ', e_1);
                throw e_1;
            case 6: return [2 /*return*/];
        }
    });
}); };
var createObs = function () {
    var obs = {
        resourceType: 'Observation',
        code: {
            coding: [
                {
                    code: '718-7',
                    system: 'http://loinc.org',
                    display: 'Hemoglobin [Mass/volume] in Blood',
                },
            ],
        },
        status: 'final',
        interpretation: [
            {
                coding: [
                    {
                        code: 'H',
                        display: 'High',
                        system: 'https://hl7.org/fhir/R4B/valueset-observation-interpretation.html',
                    },
                ],
            },
        ],
        referenceRange: [
            {
                text: '2.5-5.3',
            },
        ],
        valueQuantity: {
            value: 5.5,
            system: '(HL7_V2)',
            code: 'mEq/L',
        },
    };
    return obs;
};
var createUnsolicitedResultDr = function (_a) {
    var drIdentifier = _a.drIdentifier, obsFullUrl = _a.obsFullUrl, patient = _a.patient, practitioner = _a.practitioner, test = _a.test, labOrgId = _a.labOrgId;
    var dr = {
        resourceType: 'DiagnosticReport',
        extension: [
            {
                url: utils_1.OYSTEHR_LABS_RESULT_ORDERING_PROVIDER_EXT_URL,
                valueReference: {
                    reference: '#resultOrderingProviderPractitionerId',
                },
            },
        ],
        identifier: drIdentifier,
        result: [{ reference: obsFullUrl }],
        status: 'final',
        code: {
            coding: [
                {
                    code: test.code,
                    system: 'http://loinc.org',
                    display: test.display,
                },
            ],
        },
        effectiveDateTime: luxon_1.DateTime.now().toISO(),
        meta: {
            tag: [lab_script_consts_1.DR_UNSOLICITED_RESULT_TAG],
        },
        subject: {
            reference: '#unsolicitedResultPatientId',
        },
        performer: [
            {
                reference: "Organization/".concat(labOrgId),
            },
        ],
        specimen: [
            {
                reference: '#resultSpecimenId',
            },
        ],
        contained: [
            {
                resourceType: 'Patient',
                id: 'unsolicitedResultPatientId',
                name: [
                    {
                        family: patient.last,
                        given: [patient.first],
                    },
                ],
                birthDate: patient.dob,
                gender: 'female',
            },
            {
                resourceType: 'Practitioner',
                id: utils_1.DR_CONTAINED_PRACTITIONER_REF,
                name: [
                    {
                        given: [practitioner.first],
                        family: practitioner.last,
                    },
                ],
                identifier: [
                    {
                        system: 'http://hl7.org/fhir/sid/us-npi',
                        value: '1932929191',
                    },
                ],
            },
            {
                resourceType: 'Specimen',
                id: 'resultSpecimenId',
                collection: {
                    bodySite: {
                        coding: [
                            {
                                system: 'https://terminology.fhir.oystehr.com/CodeSystem/lab-result-specimen-source',
                                display: 'URINARY TRACT',
                            },
                        ],
                    },
                    quantity: {
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/lab-result-collection-volume',
                        code: '2100',
                        unit: 'mL',
                    },
                    collectedDateTime: luxon_1.DateTime.now().toISO(),
                },
            },
        ],
        category: [{ coding: [utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY] }],
    };
    return dr;
};
var createFillerNumber = function () {
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var result = '';
    var randomArray = new Uint8Array(20);
    (0, crypto_1.getRandomValues)(randomArray);
    randomArray.forEach(function (number) {
        result += chars[number % chars.length];
    });
    return result;
};
main().catch(function (error) {
    console.log(error, JSON.stringify(error, null, 2));
    throw error;
});

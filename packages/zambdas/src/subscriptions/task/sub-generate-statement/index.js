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
var candidhealth_1 = require("candidhealth");
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var harvest_1 = require("../../../ehr/shared/harvest");
var shared_1 = require("../../../shared");
var presigned_file_urls_1 = require("../../../shared/presigned-file-urls");
var draw_1 = require("./draw");
var ZAMBDA_NAME = 'generate-statement';
var STATEMENT = 'Statement';
var oystehrToken;
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterId, userTimezone, secrets_1, oystehr, resources, guarantorResource, encounter, encounterReference, candidEncounterId, candid, candidEncounterResponse, candidClaimId, candidClaimResponse, itemizationResponse, pdfDocument, timestamp, fileName, patientId, baseFileUrl, presignedUrl, error_1, patientReference, listResources, _b, appointmentDate, appointmentTime, docRefs, error_2, ENVIRONMENT;
    var _c, _d, _e, _f, _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                _l.trys.push([0, 16, , 17]);
                _a = validateInput(input), encounterId = _a.encounterId, userTimezone = _a.userTimezone, secrets_1 = _a.secrets;
                return [4 /*yield*/, createOystehr(secrets_1)];
            case 1:
                oystehr = _l.sent();
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets_1)];
            case 2:
                m2mToken = _l.sent();
                return [4 /*yield*/, getResources(encounterId, oystehr)];
            case 3:
                resources = _l.sent();
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)((_c = resources.patient.id) !== null && _c !== void 0 ? _c : '', oystehr)];
            case 4:
                guarantorResource = (_l.sent()).guarantorResource;
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Encounter',
                        id: encounterId,
                    })];
            case 5:
                encounter = _l.sent();
                encounterReference = "Encounter/".concat(encounterId);
                candidEncounterId = (0, shared_1.getCandidEncounterIdFromEncounter)(encounter);
                if (!candidEncounterId) {
                    throw new Error("Candid encounter id is missing for \"".concat(encounterReference, "\""));
                }
                candid = (0, utils_1.createCandidApiClient)(secrets_1);
                return [4 /*yield*/, candid.encounters.v4.get(candidhealth_1.CandidApi.EncounterId(candidEncounterId))];
            case 6:
                candidEncounterResponse = _l.sent();
                candidClaimId = candidEncounterResponse && candidEncounterResponse.ok
                    ? (_f = (_e = (_d = candidEncounterResponse.body) === null || _d === void 0 ? void 0 : _d.claims) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.claimId
                    : undefined;
                if (!candidClaimId) {
                    throw new Error("Candid encounter \"".concat(candidEncounterId, "\" has no claim"));
                }
                return [4 /*yield*/, candid.patientAr.v1.itemize(candidhealth_1.CandidApi.ClaimId(candidClaimId))];
            case 7:
                candidClaimResponse = _l.sent();
                itemizationResponse = candidClaimResponse && candidClaimResponse.ok ? candidClaimResponse === null || candidClaimResponse === void 0 ? void 0 : candidClaimResponse.body : undefined;
                if (!itemizationResponse) {
                    throw new Error('Failed to get itemization response');
                }
                return [4 /*yield*/, (0, draw_1.generatePdf)(__assign(__assign({}, resources), { itemizationResponse: itemizationResponse, timezone: userTimezone, responsibleParty: guarantorResource, procedureNameProvider: function (procedureCode) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, getProcedureCodeTitle(procedureCode, secrets_1)];
                            });
                        }); } }))];
            case 8:
                pdfDocument = _l.sent();
                timestamp = luxon_1.DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
                fileName = "Statement-".concat(encounterId, "-").concat(timestamp, ".pdf");
                patientId = (_h = (_g = encounter.subject) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.split('/')[1];
                if (!patientId) {
                    throw new Error("Patient id not found in \"".concat(encounterReference, "\""));
                }
                baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({
                    secrets: secrets_1,
                    fileName: fileName,
                    bucketName: utils_1.BUCKET_NAMES.STATEMENTS,
                    patientID: patientId,
                });
                console.log('Uploading file to bucket, ', utils_1.BUCKET_NAMES.STATEMENTS);
                presignedUrl = void 0;
                _l.label = 9;
            case 9:
                _l.trys.push([9, 12, , 13]);
                return [4 /*yield*/, (0, shared_1.createPresignedUrl)(m2mToken, baseFileUrl, 'upload')];
            case 10:
                presignedUrl = _l.sent();
                return [4 /*yield*/, (0, shared_1.uploadObjectToZ3)(pdfDocument, presignedUrl)];
            case 11:
                _l.sent();
                return [3 /*break*/, 13];
            case 12:
                error_1 = _l.sent();
                throw new Error("failed uploading pdf to z3:  ".concat(JSON.stringify(error_1.message)));
            case 13:
                patientReference = "Patient/".concat(patientId);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'List',
                        params: [
                            {
                                name: 'patient',
                                value: patientReference,
                            },
                        ],
                    })];
            case 14:
                listResources = (_l.sent()).unbundle();
                _b = (_k = (0, utils_1.formatDateToMDYWithTime)((_j = resources.appointment) === null || _j === void 0 ? void 0 : _j.start, userTimezone)) !== null && _k !== void 0 ? _k : {}, appointmentDate = _b.date, appointmentTime = _b.time;
                return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                        files: [
                            {
                                url: baseFileUrl,
                                title: "".concat(STATEMENT, "-").concat(appointmentDate, "-").concat(appointmentTime),
                            },
                        ],
                        type: {
                            coding: [
                                {
                                    system: 'http://loinc.org',
                                    code: utils_1.STATEMENT_CODE,
                                    display: STATEMENT,
                                },
                            ],
                            text: STATEMENT,
                        },
                        dateCreated: luxon_1.DateTime.now().toUTC().toISO(),
                        searchParams: [
                            {
                                name: 'encounter',
                                value: encounterReference,
                            },
                            {
                                name: 'subject',
                                value: patientReference,
                            },
                            {
                                name: 'type',
                                value: utils_1.STATEMENT_CODE,
                            },
                        ],
                        references: {
                            subject: {
                                reference: patientReference,
                            },
                            context: {
                                encounter: [
                                    {
                                        reference: encounterReference,
                                    },
                                ],
                            },
                        },
                        oystehr: oystehr,
                        generateUUID: crypto_1.randomUUID,
                        listResources: listResources,
                        meta: {
                            tag: [{ code: utils_1.OTTEHR_MODULE.IP }, { code: utils_1.OTTEHR_MODULE.TM }],
                        },
                    })];
            case 15:
                docRefs = (_l.sent()).docRefs;
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            documentReference: 'DocumentReference/' + docRefs[0].id,
                        }),
                    }];
            case 16:
                error_2 = _l.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_2, ENVIRONMENT)];
            case 17: return [2 /*return*/];
        }
    });
}); });
function validateInput(input) {
    var _a, _b, _c, _d;
    var inputJson = (0, shared_1.validateJsonBody)(input);
    if (inputJson.resourceType !== 'Task') {
        throw new Error("Input needs to be a Task resource");
    }
    var task = inputJson;
    return {
        encounterId: (0, shared_1.validateString)((_b = (_a = task.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1], 'encounterId'),
        userTimezone: (_d = (_c = (0, utils_1.getExtension)(task, utils_1.USER_TIMEZONE_EXTENSION_URL)) === null || _c === void 0 ? void 0 : _c.valueString) !== null && _d !== void 0 ? _d : 'America/New_York',
        secrets: (0, shared_1.assertDefined)(input.secrets, 'input.secrets'),
    };
}
function createOystehr(secrets) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehrToken == null)) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    oystehrToken = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, (0, shared_1.createOystehrClient)(oystehrToken, secrets)];
            }
        });
    });
}
var getResources = function (encounterId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var items, appointment, encounter, patient, location;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Encounter',
                    params: [
                        {
                            name: '_id',
                            value: encounterId,
                        },
                        {
                            name: '_include',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_include',
                            value: 'Encounter:subject',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:location',
                        },
                    ],
                })];
            case 1:
                items = (_a.sent()).unbundle();
                appointment = items.find(function (item) {
                    return item.resourceType === 'Appointment';
                });
                if (!appointment)
                    throw new Error('Appointment not found');
                encounter = items.find(function (item) {
                    return item.resourceType === 'Encounter';
                });
                if (!encounter)
                    throw new Error('Encounter not found');
                patient = items.find(function (item) {
                    return item.resourceType === 'Patient';
                });
                if (!patient)
                    throw new Error('Patient not found');
                location = items.find(function (item) {
                    return item.resourceType === 'Location';
                });
                return [2 /*return*/, {
                        appointment: appointment,
                        encounter: encounter,
                        patient: patient,
                        location: location,
                    }];
        }
    });
}); };
function getProcedureCodeTitle(code, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, names, name;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = (0, utils_1.getSecret)(utils_1.SecretsKeys.NLM_API_KEY, secrets);
                    return [4 /*yield*/, Promise.all([searchCodeName(code, 'HCPT', apiKey), searchCodeName(code, 'HCPCS', apiKey)])];
                case 1:
                    names = _a.sent();
                    name = names.find(function (name) { return name != null; });
                    return [2 /*return*/, name ? "".concat(code, " - ").concat(name) : code];
            }
        });
    });
}
function searchCodeName(code, sabs, apiKey) {
    return __awaiter(this, void 0, void 0, function () {
        var response, responseBody;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, fetch("https://uts-ws.nlm.nih.gov/rest/search/current?apiKey=".concat(apiKey, "&returnIdType=code&inputType=code&string=").concat(code, "&sabs=").concat(sabs, "&partialSearch=true&searchType=rightTruncation"))];
                case 1:
                    response = _b.sent();
                    if (!response.ok) {
                        return [2 /*return*/, undefined];
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    responseBody = (_b.sent());
                    return [2 /*return*/, (_a = responseBody.result.results.find(function (entry) { return entry; })) === null || _a === void 0 ? void 0 : _a.name];
            }
        });
    });
}

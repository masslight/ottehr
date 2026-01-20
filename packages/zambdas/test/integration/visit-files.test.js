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
var sdk_1 = require("@oystehr/sdk");
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var luxon_1 = require("luxon");
var path_1 = require("path");
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var local_json_1 = require("../../.env/local.json");
var shared_1 = require("../../src/shared");
var questionnaire_response_1_json_1 = require("../data/questionnaire-response-1.json");
var secrets_1 = require("../data/secrets");
var configureTestM2MClient_1 = require("../helpers/configureTestM2MClient");
var testScheduleUtils_1 = require("../helpers/testScheduleUtils");
// 'insurance-card-front-2' // 'insurance-card-back-2' // 'photo-id-front' // 'photo-id-back'
describe('saving card files from EHR', function () {
    var oystehr;
    var token;
    var processId;
    var z3ObjectsToCleanUp = [];
    var makeCardInZ3AndReturnAttachment = function (cardType, appointmentId) { return __awaiter(void 0, void 0, void 0, function () {
        var file, filePath, fileBuffer, filePath, fileBuffer, _a, presignedURL, z3URL;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if ("".concat(cardType).includes('front')) {
                        filePath = (0, path_1.join)(__dirname, '..', 'data', 'files', '00InsuranceCard.png');
                        fileBuffer = (0, fs_1.readFileSync)(filePath);
                        file = new File([Uint8Array.from(fileBuffer)], cardType, { type: 'image/png' });
                    }
                    else {
                        filePath = (0, path_1.join)(__dirname, '..', 'data', 'files', '00Insurance_back.jpg');
                        fileBuffer = (0, fs_1.readFileSync)(filePath);
                        file = new File([Uint8Array.from(fileBuffer)], cardType, { type: 'image/jpg' });
                    }
                    return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                            var response, jsonToUse;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, oystehr.zambda.executePublic({
                                            id: 'get-presigned-file-url',
                                            appointmentID: appointmentId,
                                            fileType: cardType,
                                            fileFormat: file.type.split('/')[1],
                                        })];
                                    case 1:
                                        response = _a.sent();
                                        jsonToUse = (0, utils_1.chooseJson)(response);
                                        return [2 /*return*/, jsonToUse];
                                }
                            });
                        }); })()];
                case 1:
                    _a = _b.sent(), presignedURL = _a.presignedURL, z3URL = _a.z3URL;
                    return [4 /*yield*/, fetch(presignedURL, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': file.type,
                            },
                            body: file,
                        })];
                case 2:
                    _b.sent();
                    z3ObjectsToCleanUp.push(z3URL);
                    return [2 /*return*/, {
                            url: z3URL,
                            title: cardType,
                            creation: luxon_1.DateTime.now().toISO(),
                        }];
            }
        });
    }); };
    var makeTestResources = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var patientId, testPatient, partialPatient, now_1, birthDate, now, appointment, batchInputApp, encounter, batchInputEnc, batchResults, createdEncounter, createdAppointment, testQR, createdQR, error_1;
        var _c;
        var _d;
        var processId = _b.processId, oystehr = _b.oystehr, _e = _b.addDays, addDays = _e === void 0 ? 0 : _e, patientAge = _b.patientAge, existingPatientId = _b.existingPatientId, patientSex = _b.patientSex, unconfirmedDob = _b.unconfirmedDob;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    patientId = existingPatientId;
                    if (!!patientId) return [3 /*break*/, 2];
                    partialPatient = {};
                    if (patientAge) {
                        now_1 = luxon_1.DateTime.now();
                        birthDate = now_1.minus((_c = {}, _c[patientAge.units] = patientAge.value, _c));
                        partialPatient.birthDate = birthDate.toFormat(utils_1.DOB_DATE_FORMAT);
                    }
                    if (patientSex) {
                        partialPatient.gender = patientSex;
                    }
                    return [4 /*yield*/, (0, testScheduleUtils_1.persistTestPatient)({ patient: (0, testScheduleUtils_1.makeTestPatient)(partialPatient), processId: processId }, oystehr)];
                case 1:
                    testPatient = _f.sent();
                    expect(testPatient).toBeDefined();
                    patientId = testPatient.id;
                    _f.label = 2;
                case 2:
                    expect(patientId).toBeDefined();
                    (0, vitest_1.assert)(patientId);
                    now = luxon_1.DateTime.now().plus({ days: addDays });
                    appointment = {
                        resourceType: 'Appointment',
                        status: 'fulfilled',
                        start: now.toISO(),
                        end: now.plus({ minutes: 15 }).toISO(),
                        participant: [
                            {
                                actor: {
                                    reference: "Patient/".concat(patientId),
                                },
                                status: 'accepted',
                            },
                        ],
                        extension: unconfirmedDob
                            ? [
                                {
                                    url: utils_1.FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
                                    valueString: unconfirmedDob,
                                },
                            ]
                            : undefined,
                    };
                    batchInputApp = {
                        method: 'POST',
                        resource: appointment,
                        url: 'Appointment',
                        fullUrl: "urn:uuid:".concat((0, crypto_1.randomUUID)()),
                    };
                    encounter = {
                        resourceType: 'Encounter',
                        status: 'in-progress',
                        class: {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            code: 'AMB',
                            display: 'ambulatory',
                        },
                        subject: {
                            reference: "Patient/".concat(patientId),
                        },
                        appointment: [
                            {
                                reference: "".concat(batchInputApp.fullUrl),
                            },
                        ],
                        period: {
                            start: now.toISO(),
                        },
                    };
                    batchInputEnc = {
                        method: 'POST',
                        resource: encounter,
                        url: 'Encounter',
                    };
                    _f.label = 3;
                case 3:
                    _f.trys.push([3, 6, , 7]);
                    return [4 /*yield*/, oystehr.fhir.transaction({
                            requests: [batchInputApp, batchInputEnc],
                        })];
                case 4:
                    batchResults = ((_d = (_f.sent()).entry) === null || _d === void 0 ? void 0 : _d.flatMap(function (entry) { var _a; return (_a = entry.resource) !== null && _a !== void 0 ? _a : []; })) || [];
                    expect(batchResults).toBeDefined();
                    createdEncounter = batchResults.find(function (entry) { return entry.resourceType === 'Encounter'; });
                    expect(createdEncounter === null || createdEncounter === void 0 ? void 0 : createdEncounter.id).toBeDefined();
                    (0, vitest_1.assert)(createdEncounter);
                    createdAppointment = batchResults.find(function (entry) { return entry.resourceType === 'Appointment'; });
                    expect(createdAppointment === null || createdAppointment === void 0 ? void 0 : createdAppointment.id).toBeDefined();
                    (0, vitest_1.assert)(createdAppointment);
                    testQR = __assign(__assign({}, questionnaire_response_1_json_1.default), { subject: { reference: "Patient/".concat(patientId) }, encounter: { reference: "Encounter/".concat(createdEncounter.id) } });
                    return [4 /*yield*/, oystehr.fhir.create(testQR)];
                case 5:
                    createdQR = _f.sent();
                    expect(createdQR).toBeDefined();
                    expect(createdQR.id).toBeDefined();
                    return [2 /*return*/, { encounter: createdEncounter, patient: testPatient, appointment: createdAppointment, qr: createdQR }];
                case 6:
                    error_1 = _f.sent();
                    expect(error_1).toBeUndefined();
                    throw new Error("Error creating test resources: ".concat(error_1));
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var getVisitFiles = function (appointmentId) { return __awaiter(void 0, void 0, void 0, function () {
        var visitFilesOutput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.zambda.execute({
                        id: 'GET-VISIT-FILES',
                        appointmentId: appointmentId,
                    })];
                case 1:
                    visitFilesOutput = (_a.sent()).output;
                    return [2 /*return*/, visitFilesOutput];
            }
        });
    }); };
    var updateVisitFiles = function (input) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // implement when needed
                return [4 /*yield*/, oystehr.zambda.execute(__assign({ id: 'UPDATE-VISIT-FILES' }, input))];
                case 1:
                    // implement when needed
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID, EXECUTE_ZAMBDA_URL;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    processId = (0, crypto_1.randomUUID)();
                    AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, FHIR_API = secrets_1.SECRETS.FHIR_API, PROJECT_ID = secrets_1.SECRETS.PROJECT_ID;
                    EXECUTE_ZAMBDA_URL = (0, vitest_1.inject)('EXECUTE_ZAMBDA_URL');
                    expect(EXECUTE_ZAMBDA_URL).toBeDefined();
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)({
                            AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                            AUTH0_CLIENT: local_json_1.AUTH0_CLIENT_TESTS,
                            AUTH0_SECRET: local_json_1.AUTH0_SECRET_TESTS,
                            AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                        })];
                case 1:
                    token = _a.sent();
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: FHIR_API,
                        projectApiUrl: EXECUTE_ZAMBDA_URL,
                        projectId: PROJECT_ID,
                    });
                    return [4 /*yield*/, (0, configureTestM2MClient_1.ensureM2MPractitionerProfile)(token)];
                case 2:
                    _a.sent();
                    expect(oystehr).toBeDefined();
                    expect(oystehr.fhir).toBeDefined();
                    expect(oystehr.zambda).toBeDefined();
                    return [2 /*return*/];
            }
        });
    }); });
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var _i, z3ObjectsToCleanUp_1, z3Url, path, bucketName, objectPath, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not clean up!');
                    }
                    // this will clean up everything connect to the test patient too
                    return [4 /*yield*/, (0, testScheduleUtils_1.cleanupTestScheduleResources)(processId, oystehr)];
                case 1:
                    // this will clean up everything connect to the test patient too
                    _a.sent();
                    _i = 0, z3ObjectsToCleanUp_1 = z3ObjectsToCleanUp;
                    _a.label = 2;
                case 2:
                    if (!(_i < z3ObjectsToCleanUp_1.length)) return [3 /*break*/, 7];
                    z3Url = z3ObjectsToCleanUp_1[_i];
                    path = z3Url.split('z3/')[1];
                    bucketName = path.split('/')[0];
                    objectPath = path.split('/').slice(1).join('/');
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, oystehr.z3.deleteObject({ bucketName: bucketName, 'objectPath+': objectPath })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_2 = _a.sent();
                    console.error('Error deleting z3 object:', error_2);
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve primary insurance front and back', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, visitFiles, photoIdCards, insuranceCards, insuranceCardsSecondary, frontAttachment, filesWithFront, backAttachment, filesWithBack, backCard;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'male',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    (0, vitest_1.assert)(appointment.id);
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 2:
                    visitFiles = _a.sent();
                    photoIdCards = visitFiles.photoIdCards, insuranceCards = visitFiles.insuranceCards, insuranceCardsSecondary = visitFiles.insuranceCardsSecondary;
                    expect(photoIdCards).toBeDefined();
                    expect(insuranceCards).toBeDefined();
                    expect(insuranceCardsSecondary).toBeDefined();
                    expect(photoIdCards.length).toBe(0);
                    expect(insuranceCards.length).toBe(0);
                    expect(insuranceCardsSecondary.length).toBe(0);
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment('insurance-card-front', appointment.id)];
                case 3:
                    frontAttachment = _a.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: frontAttachment,
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 5:
                    filesWithFront = _a.sent();
                    expect(filesWithFront.insuranceCards.length).toBe(1);
                    expect(filesWithFront.insuranceCards[0].z3Url).toBe(frontAttachment.url);
                    expect(filesWithFront.insuranceCards[0].type).toBe('insurance-card-front');
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment('insurance-card-back', appointment.id)];
                case 6:
                    backAttachment = _a.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-back',
                            attachment: backAttachment,
                        })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 8:
                    filesWithBack = _a.sent();
                    expect(filesWithBack.insuranceCards.length).toBe(2);
                    backCard = filesWithBack.insuranceCards.find(function (card) { return card.type === 'insurance-card-back'; });
                    expect(backCard).toBeDefined();
                    (0, vitest_1.assert)(backCard);
                    expect(backCard.z3Url).toBe(backAttachment.url);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save when providing patient id instead of appointment id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, appointment, patient, visitFiles, photoIdCards, insuranceCards, insuranceCardsSecondary, frontAttachment, filesWithFront, backAttachment, filesWithBack, backCard;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'male',
                        })];
                case 1:
                    _a = _b.sent(), appointment = _a.appointment, patient = _a.patient;
                    expect(appointment).toBeDefined();
                    (0, vitest_1.assert)(appointment.id);
                    expect(patient).toBeDefined();
                    (0, vitest_1.assert)(patient === null || patient === void 0 ? void 0 : patient.id);
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 2:
                    visitFiles = _b.sent();
                    photoIdCards = visitFiles.photoIdCards, insuranceCards = visitFiles.insuranceCards, insuranceCardsSecondary = visitFiles.insuranceCardsSecondary;
                    expect(photoIdCards).toBeDefined();
                    expect(insuranceCards).toBeDefined();
                    expect(insuranceCardsSecondary).toBeDefined();
                    expect(photoIdCards.length).toBe(0);
                    expect(insuranceCards.length).toBe(0);
                    expect(insuranceCardsSecondary.length).toBe(0);
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment('insurance-card-front', appointment.id)];
                case 3:
                    frontAttachment = _b.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            patientId: patient.id,
                            fileType: 'insurance-card-front',
                            attachment: frontAttachment,
                        })];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 5:
                    filesWithFront = _b.sent();
                    expect(filesWithFront.insuranceCards.length).toBe(1);
                    expect(filesWithFront.insuranceCards[0].z3Url).toBe(frontAttachment.url);
                    expect(filesWithFront.insuranceCards[0].type).toBe('insurance-card-front');
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment('insurance-card-back', appointment.id)];
                case 6:
                    backAttachment = _b.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            patientId: patient.id,
                            fileType: 'insurance-card-back',
                            attachment: backAttachment,
                        })];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 8:
                    filesWithBack = _b.sent();
                    expect(filesWithBack.insuranceCards.length).toBe(2);
                    backCard = filesWithBack.insuranceCards.find(function (card) { return card.type === 'insurance-card-back'; });
                    expect(backCard).toBeDefined();
                    (0, vitest_1.assert)(backCard);
                    expect(backCard.z3Url).toBe(backAttachment.url);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve secondary insurance front and back', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, visitFiles, photoIdCards, insuranceCards, insuranceCardsSecondary, FRONT_CARD_NAME, BACK_CARD_NAME, frontAttachment, filesWithFront, backAttachment, filesWithBack, backCard;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'male',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    (0, vitest_1.assert)(appointment.id);
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 2:
                    visitFiles = _a.sent();
                    photoIdCards = visitFiles.photoIdCards, insuranceCards = visitFiles.insuranceCards, insuranceCardsSecondary = visitFiles.insuranceCardsSecondary;
                    expect(photoIdCards).toBeDefined();
                    expect(insuranceCards).toBeDefined();
                    expect(insuranceCardsSecondary).toBeDefined();
                    expect(photoIdCards.length).toBe(0);
                    expect(insuranceCards.length).toBe(0);
                    expect(insuranceCardsSecondary.length).toBe(0);
                    FRONT_CARD_NAME = 'insurance-card-front-2';
                    BACK_CARD_NAME = 'insurance-card-back-2';
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment(FRONT_CARD_NAME, appointment.id)];
                case 3:
                    frontAttachment = _a.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: FRONT_CARD_NAME,
                            attachment: frontAttachment,
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 5:
                    filesWithFront = _a.sent();
                    expect(filesWithFront.insuranceCardsSecondary.length).toBe(1);
                    expect(filesWithFront.insuranceCardsSecondary[0].z3Url).toBe(frontAttachment.url);
                    expect(filesWithFront.insuranceCardsSecondary[0].type).toBe(FRONT_CARD_NAME);
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment(BACK_CARD_NAME, appointment.id)];
                case 6:
                    backAttachment = _a.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: BACK_CARD_NAME,
                            attachment: backAttachment,
                        })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 8:
                    filesWithBack = _a.sent();
                    expect(filesWithBack.insuranceCardsSecondary.length).toBe(2);
                    backCard = filesWithBack.insuranceCardsSecondary.find(function (card) { return card.type === BACK_CARD_NAME; });
                    expect(backCard).toBeDefined();
                    (0, vitest_1.assert)(backCard);
                    expect(backCard.z3Url).toBe(backAttachment.url);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('can save and retrieve id card front and back', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, visitFiles, photoIdCards, insuranceCards, insuranceCardsSecondary, FRONT_CARD_NAME, BACK_CARD_NAME, frontAttachment, filesWithFront, backAttachment, filesWithBack, backCard;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 30 },
                            patientSex: 'male',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    (0, vitest_1.assert)(appointment.id);
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 2:
                    visitFiles = _a.sent();
                    photoIdCards = visitFiles.photoIdCards, insuranceCards = visitFiles.insuranceCards, insuranceCardsSecondary = visitFiles.insuranceCardsSecondary;
                    expect(photoIdCards).toBeDefined();
                    expect(insuranceCards).toBeDefined();
                    expect(insuranceCardsSecondary).toBeDefined();
                    expect(photoIdCards.length).toBe(0);
                    expect(insuranceCards.length).toBe(0);
                    expect(insuranceCardsSecondary.length).toBe(0);
                    FRONT_CARD_NAME = 'photo-id-front';
                    BACK_CARD_NAME = 'photo-id-back';
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment(FRONT_CARD_NAME, appointment.id)];
                case 3:
                    frontAttachment = _a.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: FRONT_CARD_NAME,
                            attachment: frontAttachment,
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 5:
                    filesWithFront = _a.sent();
                    expect(filesWithFront.photoIdCards.length).toBe(1);
                    expect(filesWithFront.photoIdCards[0].z3Url).toBe(frontAttachment.url);
                    expect(filesWithFront.photoIdCards[0].type).toBe(FRONT_CARD_NAME);
                    return [4 /*yield*/, makeCardInZ3AndReturnAttachment(BACK_CARD_NAME, appointment.id)];
                case 6:
                    backAttachment = _a.sent();
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: BACK_CARD_NAME,
                            attachment: backAttachment,
                        })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 8:
                    filesWithBack = _a.sent();
                    expect(filesWithBack.photoIdCards.length).toBe(2);
                    backCard = filesWithBack.photoIdCards.find(function (card) { return card.type === BACK_CARD_NAME; });
                    expect(backCard).toBeDefined();
                    (0, vitest_1.assert)(backCard);
                    expect(backCard.z3Url).toBe(backAttachment.url);
                    return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when all required parameters are missing', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: undefined,
                            attachment: undefined,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_3 = _a.sent();
                    expect(error_3.message).toBe('The following required parameters were missing: fileType, attachment');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when given invalid appointment id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_4, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    attachment = {
                        url: 'http://example.com',
                        title: 'insurance-card-front',
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: 'invalid',
                            attachment: attachment,
                            fileType: 'insurance-card-front',
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_4 = _a.sent();
                    expect(error_4.message).toBe('"appointmentId" must be a valid UUID.');
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: (0, crypto_1.randomUUID)(),
                            attachment: attachment,
                            fileType: 'insurance-card-front',
                        })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_5 = _a.sent();
                    expect(error_5.message).toBe('The requested Appointment resource could not be found');
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when no attachment is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: undefined,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_6 = _a.sent();
                    expect(error_6.message).toBe('The following required parameters were missing: attachment');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when given invalid patient id', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, appointment, patient, error_7, error_8;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    _a = _b.sent(), appointment = _a.appointment, patient = _a.patient;
                    expect(appointment).toBeDefined();
                    expect(patient).toBeDefined();
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            patientId: 'invalid',
                            attachment: {
                                url: 'http://example.com',
                                title: 'insurance-card-front',
                                creation: luxon_1.DateTime.now().toISO(),
                            },
                            fileType: 'insurance-card-front',
                        })];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_7 = _b.sent();
                    expect(error_7.message).toBe('"patientId" must be a valid UUID.');
                    return [3 /*break*/, 5];
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, updateVisitFiles({
                            patientId: (0, crypto_1.randomUUID)(),
                            attachment: {
                                url: 'http://example.com',
                                title: 'insurance-card-front',
                                creation: luxon_1.DateTime.now().toISO(),
                            },
                            fileType: 'insurance-card-front',
                        })];
                case 6:
                    _b.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_8 = _b.sent();
                    expect(error_8.message).toBe('The requested Patient resource could not be found');
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when no fileType is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    attachment = {
                        url: 'http://example.com',
                        title: 'insurance-card-front',
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: undefined,
                            attachment: attachment,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_9 = _a.sent();
                    expect(error_9.message).toBe('The following required parameters were missing: fileType');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when invalid fileType is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_10;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    attachment = {
                        url: 'http://example.com',
                        title: 'insurance-card-front',
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'costco-card-front',
                            attachment: attachment,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_10 = _a.sent();
                    expect(error_10.message).toBe('"fileType" is invalid. must be one of photo-id-front, photo-id-back, insurance-card-front, insurance-card-back, insurance-card-front-2, insurance-card-back-2');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when attachment has missing fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_11, error_12, error_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    attachment = {
                        url: undefined,
                        title: 'insurance-card-front',
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_11 = _a.sent();
                    expect(error_11.message).toBe("\"attachment\" must be an object with \"url\", \"title\", and \"creation\" fields");
                    return [3 /*break*/, 5];
                case 5:
                    attachment = {
                        url: 'http://example.com',
                        title: undefined,
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_12 = _a.sent();
                    expect(error_12.message).toBe("\"attachment\" must be an object with \"url\", \"title\", and \"creation\" fields");
                    return [3 /*break*/, 9];
                case 9:
                    attachment = {
                        url: 'http://example.com',
                        title: 'insurance-card-front',
                        creation: undefined,
                    };
                    _a.label = 10;
                case 10:
                    _a.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 11:
                    _a.sent();
                    return [3 /*break*/, 13];
                case 12:
                    error_13 = _a.sent();
                    expect(error_13.message).toBe("\"attachment\" must be an object with \"url\", \"title\", and \"creation\" fields");
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when invalid attachment.url is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_14;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    attachment = {
                        url: '',
                        title: 'insurance-card-front',
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_14 = _a.sent();
                    expect(error_14.message).toBe('"attachment.url" must be a non-empty string.');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when invalid attachment.type is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_15;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    expect(appointment).toBeDefined();
                    attachment = {
                        url: 'http://example.com',
                        title: '',
                        creation: luxon_1.DateTime.now().toISO(),
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_15 = _a.sent();
                    expect(error_15.message).toBe('"attachment.title" must be a non-empty string.');
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('update fails gracefully when invalid attachment.creation is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, attachment, error_16, error_17;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    attachment = {
                        url: 'http://example.com',
                        title: 'insurance-card-front',
                        creation: 'not-a-date',
                    };
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_16 = _a.sent();
                    expect(error_16.message).toBe("\"attachment.creation\" must be a valid ISO date string.");
                    return [3 /*break*/, 5];
                case 5:
                    attachment = {
                        url: 'http://example.com',
                        title: 'insurance-card-front',
                        creation: '',
                    };
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, updateVisitFiles({
                            appointmentId: appointment.id,
                            fileType: 'insurance-card-front',
                            attachment: attachment,
                        })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_17 = _a.sent();
                    expect(error_17.message).toBe("\"attachment.creation\" must be a valid ISO date string.");
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); });
    test.concurrent('get fails gracefully when invalid appointmentId is provided', function () { return __awaiter(void 0, void 0, void 0, function () {
        var appointment, error_18, error_19;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr || !processId) {
                        throw new Error('oystehr or processId is null! could not run test!');
                    }
                    return [4 /*yield*/, makeTestResources({
                            processId: processId,
                            oystehr: oystehr,
                            patientAge: { units: 'years', value: 3 }, // so we can test DOB changes
                            patientSex: 'female',
                        })];
                case 1:
                    appointment = (_a.sent()).appointment;
                    return [4 /*yield*/, getVisitFiles(appointment.id)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, getVisitFiles(undefined)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_18 = _a.sent();
                    expect(error_18.message).toBe("The following required parameters were missing: appointmentId");
                    return [3 /*break*/, 6];
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, getVisitFiles('1234')];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_19 = _a.sent();
                    expect(error_19.message).toBe("\"appointmentId\" value must be a valid UUID");
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); });
});

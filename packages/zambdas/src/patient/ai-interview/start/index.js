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
exports.index = exports.INTERVIEW_COMPLETED = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var ai_1 = require("../../../shared/ai");
exports.INTERVIEW_COMPLETED = 'Interview completed.';
function buildPatientInfoString(patient, appointment) {
    if (!patient) {
        return 'Patient information not available.';
    }
    var firstName = (0, utils_1.getPatientFirstName)(patient);
    var lastName = (0, utils_1.getPatientLastName)(patient);
    var name = firstName && lastName ? "".concat(firstName, " ").concat(lastName) : firstName || lastName || 'Unknown';
    var age = (0, utils_1.calculatePatientAge)(patient.birthDate);
    var sex = patient.gender || 'unknown';
    var reasonForVisit = (0, utils_1.getReasonForVisitFromAppointment)(appointment) || 'not specified';
    return "The patient is ".concat(name, ", ").concat(age, " old ").concat(sex, " with reason for visit: ").concat(reasonForVisit, ".");
}
var buildInitialUserMessageUrgentCare = function (patientInfo) { return "Perform a medical history intake session in the manner of a physician preparing me or my dependent for an urgent care visit, without using a fake name:\n\u2022\tUse a friendly and concerned physician's tone\n\u2022\t".concat(patientInfo, "\n\u2022\tDetermine if you are communicating with the patient directly or a parent/guardian.\n\u2022\tAsk only one question at a time.\n\u2022\tAsk no more than 8 questions total.\n\u2022\tDon't number the questions.\n\u2022\tCover all the major domains efficiently: chief complaint, history of present illness, past medical history, past surgical history, medications, allergies, family history, social history, hospitalizations, and relevant review of systems.\n\u2022\tPhrase questions in a clear, patient-friendly way that keeps the conversation moving quickly.\n\u2022\tIf I give vague or incomplete answers, ask a brief follow-up before moving on.\n\u2022\tWhen you have gathered all useful information, end by saying: \"No further questions, thanks for chatting. We've sent the information to your nurse or doctor to review. ").concat(exports.INTERVIEW_COMPLETED, "\""); };
var buildInitialUserMessageInjuryJob = function (patientInfo) { return "Perform a medical history intake session in the manner of a physician doing patient intake for a potential job related injury.\n\u2022 Use a friendly and concerned physician's tone, but do not give yourself a name\n\u2022 ".concat(patientInfo, "\n\u2022 Determine if you are communicating with the patient directly or a parent/guardian.\n\u2022 Ask only one question at a time.\n\u2022 Ask no more than 8 questions total.\n\u2022 Don't number the questions.\n\nBe sure to cover the following:\nWhen did the injury happen?\nHow did the injury happen?\nWhat body part(s) got injured?\nWas this related to work or an auto accident?\nDate and time of injury (very specific)\nLocation where injury occurred (workplace/job site)\nActivity being performed at time of injury\nDetailed description of what happened\nBody part(s) affected\nSymptoms noted at time of injury\n\nIf this was related to an auto-accident, cover these topics:\nPatient's role (driver, passenger, pedestrian, cyclist)\nType of collision (rear-end, T-bone, head-on, rollover, etc.)\nSpeed estimate (if available)\nRestraint use (seatbelt, airbag triggered)\nAny loss of consciousness\nImmediate symptoms\n\nIf time permits ask about past medical history, past surgical history, medications, allergies, family history, social history, hospitalizations, and relevant review of systems.\n\u2022 Phrase questions in a clear, patient-friendly way that keeps the conversation moving quickly.\n\u2022 If I give vague or incomplete answers, ask a brief follow-up before moving on.\n\u2022 When you have gathered all useful information, end by saying: \"No further questions, thanks for chatting. We've sent the information to your nurse or doctor to review. ").concat(exports.INTERVIEW_COMPLETED, "\""); };
var oystehrToken;
var ZAMBDA_NAME = 'ai-interview-start';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, appointmentId, secrets, oystehr, resources, encounter, encounterId, appointment, patientResources, patient, patientInfo, questionnaireResponse, existingQuestionnaireResponse, prompt_1, error_1;
    var _b, _c, _d, _e, _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                _g.label = 1;
            case 1:
                _g.trys.push([1, 9, , 10]);
                _a = validateInput(input), appointmentId = _a.appointmentId, secrets = _a.secrets;
                return [4 /*yield*/, createOystehr(secrets)];
            case 2:
                oystehr = _g.sent();
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: 'appointment',
                                value: 'Appointment/' + appointmentId,
                            },
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
            case 3:
                resources = (_g.sent()).unbundle();
                encounter = resources.find(function (resource) { return resource.resourceType === 'Encounter'; });
                encounterId = encounter === null || encounter === void 0 ? void 0 : encounter.id;
                if (encounter == null || encounterId == null) {
                    throw new Error("Encounter for appointment ID ".concat(appointmentId, " not found"));
                }
                appointment = resources.find(function (resource) { return resource.resourceType === 'Appointment'; });
                if (appointment == null) {
                    throw new Error("Appointment for appointment ID ".concat(appointmentId, " not found"));
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Patient',
                        params: [
                            {
                                name: '_id',
                                value: ((_e = (_d = (_c = (_b = appointment.participant) === null || _b === void 0 ? void 0 : _b.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _c === void 0 ? void 0 : _c.actor) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.replace('Patient/', '')) || '',
                            },
                        ],
                    })];
            case 4:
                patientResources = (_g.sent()).unbundle();
                patient = patientResources[0];
                patientInfo = buildPatientInfoString(patient, appointment);
                questionnaireResponse = void 0;
                return [4 /*yield*/, findAIInterviewQuestionnaireResponse(encounterId, oystehr)];
            case 5:
                existingQuestionnaireResponse = _g.sent();
                prompt_1 = buildInitialUserMessageUrgentCare(patientInfo);
                if ((_f = appointment.serviceCategory) === null || _f === void 0 ? void 0 : _f.find(function (serviceCategory) {
                    var _a;
                    return (_a = serviceCategory.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.SERVICE_CATEGORY_SYSTEM && coding.code === 'workers-comp'; });
                })) {
                    console.log('Using workers compensation prompt');
                    prompt_1 = buildInitialUserMessageInjuryJob(patientInfo);
                }
                if (!(existingQuestionnaireResponse != null)) return [3 /*break*/, 6];
                questionnaireResponse = existingQuestionnaireResponse;
                return [3 /*break*/, 8];
            case 6: return [4 /*yield*/, createQuestionnaireResponse(encounterId, prompt_1, oystehr, secrets)];
            case 7:
                questionnaireResponse = _g.sent();
                _g.label = 8;
            case 8: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify(questionnaireResponse),
                }];
            case 9:
                error_1 = _g.sent();
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 10: return [2 /*return*/];
        }
    });
}); });
function validateInput(input) {
    var appointmentId = (0, shared_1.validateJsonBody)(input).appointmentId;
    return {
        appointmentId: (0, shared_1.validateString)(appointmentId, 'appointmentId'),
        secrets: input.secrets,
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
                case 2: return [2 /*return*/, (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets))];
            }
        });
    });
}
function findAIInterviewQuestionnaireResponse(encounterId, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'QuestionnaireResponse',
                        params: [
                            {
                                name: 'encounter',
                                value: 'Encounter/' + encounterId,
                            },
                            {
                                name: 'questionnaire',
                                value: '#' + utils_1.AI_QUESTIONNAIRE_ID,
                            },
                        ],
                    })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()[0]];
            }
        });
    });
}
// #aiInterview: start ai interview questionnaire
function createQuestionnaireResponse(encounterId, prompt, oystehr, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var firstAIQuestion;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, ai_1.invokeChatbot)([{ role: 'user', content: prompt }], secrets)];
                case 1:
                    firstAIQuestion = (_a.sent()).content.toString();
                    return [2 /*return*/, oystehr.fhir.create({
                            resourceType: 'QuestionnaireResponse',
                            status: 'in-progress',
                            questionnaire: '#' + utils_1.AI_QUESTIONNAIRE_ID,
                            encounter: {
                                reference: 'Encounter/' + encounterId,
                            },
                            item: [
                                {
                                    linkId: '0',
                                    answer: [
                                        {
                                            valueString: prompt,
                                        },
                                    ],
                                },
                            ],
                            contained: [
                                {
                                    resourceType: 'Questionnaire',
                                    id: utils_1.AI_QUESTIONNAIRE_ID,
                                    status: 'active',
                                    item: [
                                        {
                                            linkId: '0',
                                            text: 'Initial message',
                                            type: 'text',
                                        },
                                        {
                                            linkId: '1',
                                            text: firstAIQuestion,
                                            type: 'text',
                                        },
                                    ],
                                },
                            ],
                        })];
            }
        });
    });
}

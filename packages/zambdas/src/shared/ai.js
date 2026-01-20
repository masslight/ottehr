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
exports.ClaudeClient = void 0;
exports.invokeChatbotVertexAI = invokeChatbotVertexAI;
exports.invokeChatbot = invokeChatbot;
exports.createResourcesFromAiInterview = createResourcesFromAiInterview;
exports.generateIcdTenCodesFromNotes = generateIcdTenCodesFromNotes;
var anthropic_1 = require("@langchain/anthropic");
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
var index_1 = require("./chart-data/index");
var helpers_1 = require("./helpers");
var resources_helpers_1 = require("./resources.helpers");
var ClaudeClient = /** @class */ (function () {
    function ClaudeClient(anthropicApiKey, model) {
        if (model === void 0) { model = 'claude-haiku-4-5-20251001'; }
        this.chatbot = new anthropic_1.ChatAnthropic({
            model: model,
            anthropicApiKey: anthropicApiKey,
            temperature: 0,
            clientOptions: {
                timeout: 5000, // 5 seconds (in milliseconds)
                maxRetries: 5, // Number of retries on failure
            },
        });
    }
    ClaudeClient.prototype.invoke = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.chatbot.invoke(input)];
            });
        });
    };
    return ClaudeClient;
}());
exports.ClaudeClient = ClaudeClient;
var chatbot;
// let chatbotVertexAI: ChatVertexAI;
function getPrompt(fields) {
    return "I'll give you a transcript of a chat between a healthcare provider and a patient. \nPlease generate ".concat(fields, " with ICD-10 codes for the patient. \nPlease present a response in JSON format. Don't add markdown. Use property names in camel case. For ICD-10 codes use \"icd10\" property.  \nUse a single string property in JSON for each section except potential diagnoses. \nThe transcript: ");
}
var AI_RESPONSE_KEY_TO_FIELD = {
    historyOfPresentIllness: utils_1.AiObservationField.HistoryOfPresentIllness,
    mechanismOfInjury: utils_1.AiObservationField.MechanismOfInjury,
    pastMedicalHistory: utils_1.AiObservationField.PastMedicalHistory,
    pastSurgicalHistory: utils_1.AiObservationField.PastSurgicalHistory,
    medicationsHistory: utils_1.AiObservationField.MedicationsHistory,
    allergies: utils_1.AiObservationField.Allergies,
    socialHistory: utils_1.AiObservationField.SocialHistory,
    familyHistory: utils_1.AiObservationField.FamilyHistory,
    hospitalizationsHistory: utils_1.AiObservationField.HospitalizationsHistory,
    labs: utils_1.AiObservationField.Labs,
    erx: utils_1.AiObservationField.eRX,
    procedures: utils_1.AiObservationField.Procedures,
};
function invokeChatbotVertexAI(input, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY, RETRY_COUNT, FIRST_DELAY_MS, JITTER, backoffTimes, requests, response;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    GOOGLE_CLOUD_PROJECT_ID = (0, utils_1.getSecret)(utils_1.SecretsKeys.GOOGLE_CLOUD_PROJECT_ID, secrets);
                    GOOGLE_CLOUD_API_KEY = (0, utils_1.getSecret)(utils_1.SecretsKeys.GOOGLE_CLOUD_API_KEY, secrets);
                    RETRY_COUNT = 3;
                    FIRST_DELAY_MS = 3000;
                    JITTER = 0.01;
                    backoffTimes = Array.from({ length: RETRY_COUNT }, function (_, i) {
                        // This ends up with an array of exponential backoff times with small perturbations like [ 0, 3002, 5964, 12077, 24109 ]
                        // for more information about this approach see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
                        return i === 0 ? 0 : Math.pow(2, (i - 1)) * FIRST_DELAY_MS * (1 - JITTER + Math.random() * JITTER * 2);
                    });
                    requests = backoffTimes.map(function (backoffTime) { return __awaiter(_this, void 0, void 0, function () {
                        var error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, backoffTime); })];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, fetch("https://aiplatform.googleapis.com/v1/projects/".concat(GOOGLE_CLOUD_PROJECT_ID, "/locations/global/publishers/google/models/gemini-2.5-flash-lite:generateContent?key=").concat(GOOGLE_CLOUD_API_KEY), {
                                            method: 'POST',
                                            body: JSON.stringify({
                                                contents: [{ role: 'user', parts: [input] }],
                                                generationConfig: {
                                                    temperature: 0,
                                                },
                                            }),
                                        })];
                                case 2:
                                    error_1 = _a.sent();
                                    console.error('Error invoking Vertex AI:', error_1);
                                    (0, aws_serverless_1.captureException)(error_1);
                                    throw error_1;
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.any(requests)];
                case 1: return [4 /*yield*/, (_a.sent()).json()];
                case 2:
                    response = _a.sent();
                    console.log(JSON.stringify(response));
                    return [2 /*return*/, response.candidates[0].content.parts[0].text];
            }
        });
    });
}
function invokeChatbot(input, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            process.env.ANTHROPIC_API_KEY = (0, utils_1.getSecret)(utils_1.SecretsKeys.ANTHROPIC_API_KEY, secrets);
            if (chatbot == null) {
                chatbot = new anthropic_1.ChatAnthropic({
                    model: 'claude-haiku-4-5-20251001',
                    temperature: 0,
                    clientOptions: {
                        timeout: 5000, // 5 seconds (in milliseconds)
                        maxRetries: 5, // Number of retries on failure
                    },
                });
            }
            return [2 /*return*/, chatbot.invoke(input)];
        });
    });
}
function createResourcesFromAiInterview(oystehr, encounterID, chatTranscript, z3URL, duration, mimeType, providerUserProfile, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var fields, resources, encounter, appointment, source, aiResponseString, aiResponse, encounterId, patientId, requests, documentReferenceCreateUrl, transactionBundle, createdResources;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    fields = 'history of present illness, past medical history, past surgical history, medications history, allergies, social history, family history, hospitalizations history and potential diagnoses';
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Encounter',
                            params: [
                                {
                                    name: '_id',
                                    value: encounterID,
                                },
                                {
                                    name: '_include',
                                    value: 'Encounter:appointment',
                                },
                            ],
                        })];
                case 1:
                    resources = (_d.sent()).unbundle();
                    encounter = resources.find(function (resource) { return resource.resourceType === 'Encounter'; });
                    appointment = resources.find(function (resource) { return resource.resourceType === 'Appointment'; });
                    if ((_a = appointment === null || appointment === void 0 ? void 0 : appointment.serviceCategory) === null || _a === void 0 ? void 0 : _a.find(function (serviceCategory) {
                        var _a;
                        return (_a = serviceCategory.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.SERVICE_CATEGORY_SYSTEM && coding.code === 'workers-comp'; });
                    })) {
                        fields = 'mechanism of injury, ' + fields;
                    }
                    source = providerUserProfile ? 'audio-recording' : 'chat';
                    if (source === 'audio-recording') {
                        fields = 'labs, erx, procedures, ' + fields;
                    }
                    return [4 /*yield*/, invokeChatbot([{ role: 'user', content: getPrompt(fields) + '\n' + chatTranscript }], secrets)];
                case 2:
                    aiResponseString = (_d.sent()).content.toString();
                    console.log("AI response: \"".concat(aiResponseString, "\""));
                    try {
                        aiResponse = JSON.parse(aiResponseString);
                    }
                    catch (error) {
                        console.warn('Failed to parse AI response, attempting to fix JSON format:', error);
                        aiResponse = (0, utils_1.fixAndParseJsonObjectFromString)(aiResponseString);
                    }
                    if (!encounter) {
                        throw new Error("Encounter ID ".concat(encounterID, " not found"));
                    }
                    encounterId = (0, helpers_1.assertDefined)(encounter.id, 'encounter.id');
                    patientId = (0, helpers_1.assertDefined)((_c = (_b = encounter.subject) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1], 'patientId');
                    requests = [];
                    documentReferenceCreateUrl = "urn:uuid:".concat((0, short_uuid_1.uuid)());
                    requests.push(createDocumentReference(encounterID, patientId, providerUserProfile, documentReferenceCreateUrl, z3URL, chatTranscript, duration, mimeType));
                    requests.push.apply(requests, createObservations(aiResponse, documentReferenceCreateUrl, encounterId, patientId));
                    console.log('Transaction requests: ' + JSON.stringify(requests, null, 2));
                    return [4 /*yield*/, oystehr.fhir.transaction({
                            requests: requests,
                        })];
                case 3:
                    transactionBundle = _d.sent();
                    createdResources = (0, resources_helpers_1.parseCreatedResourcesBundle)(transactionBundle)
                        .map(function (resource) { return resource.resourceType + '/' + resource.id; })
                        .join(',');
                    console.log('Created ' + createdResources);
                    return [2 /*return*/, createdResources];
            }
        });
    });
}
function createDocumentReference(encounterID, patientID, providerUserProfile, documentReferenceCreateUrl, z3URL, transcript, duration, mimeType) {
    var documentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
            coding: [utils_1.VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE],
        },
        category: [
            {
                coding: [
                    {
                        system: 'http://loinc.org',
                        code: '34133-9',
                        display: 'Summarization of episode note',
                    },
                ],
            },
        ],
        description: z3URL ? utils_1.DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO : utils_1.DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT,
        subject: {
            reference: "Patient/".concat(patientID),
        },
        date: luxon_1.DateTime.now().toISO(),
        content: __spreadArray(__spreadArray([], (mimeType && z3URL
            ? [
                {
                    attachment: {
                        contentType: mimeType,
                        url: z3URL,
                        title: "Audio recording (".concat(duration ? (0, utils_1.getFormatDuration)(duration) : 'unknown', ")"),
                    },
                },
            ]
            : []), true), [
            {
                attachment: {
                    contentType: utils_1.MIME_TYPES.TXT,
                    title: 'Transcript',
                    data: btoa(unescape(encodeURIComponent(transcript))),
                },
            },
        ], false),
        context: {
            encounter: [
                {
                    reference: "Encounter/".concat(encounterID),
                },
            ],
        },
        extension: providerUserProfile
            ? [
                {
                    url: "".concat(utils_1.PUBLIC_EXTENSION_BASE_URL, "/provider"),
                    valueReference: {
                        reference: providerUserProfile,
                    },
                },
            ]
            : [],
    };
    return (0, resources_helpers_1.saveResourceRequest)(documentReference, documentReferenceCreateUrl);
}
function createObservations(aiResponse, documentReferenceCreateUrl, encounterId, patientId) {
    return Object.entries(AI_RESPONSE_KEY_TO_FIELD).flatMap(function (_a) {
        var key = _a[0], field = _a[1];
        if (aiResponse[key] != null) {
            return [
                (0, resources_helpers_1.saveResourceRequest)((0, index_1.makeObservationResource)(encounterId, patientId, '', documentReferenceCreateUrl, {
                    field: field,
                    value: aiResponse[key],
                }, utils_1.AI_OBSERVATION_META_SYSTEM)),
            ];
        }
        return [];
    });
}
function getIcdTenCodesPrompt(hpiText, mdmText) {
    var content = [];
    if (hpiText) {
        content.push("History of Present Illness: ".concat(hpiText));
    }
    if (mdmText) {
        content.push("Medical Decision Making: ".concat(mdmText));
    }
    return "Based on the following clinical notes, suggest potential ICD-10 diagnoses for a patient\n\n".concat(content.join('\n\n'), "\n\nProvide a JSON response with this example format. Do not include markdown formatting.\n\n{\n  \"potentialDiagnoses\": [\n    {\n      \"diagnosis\": \"Diagnosis description\",\n      \"icd10\": \"ICD-10 Code\"\n    }\n  ]\n}\n\nOnly suggest diagnoses that are supported by the clinical information provided. Provide at most 5 results. If there are not relevant results, return an empty list");
}
function generateIcdTenCodesFromNotes(aiClient, hpiText, mdmText) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt_1, aiResponseString, aiResponse, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    prompt_1 = getIcdTenCodesPrompt(hpiText, mdmText);
                    return [4 /*yield*/, aiClient.invoke([{ role: 'user', content: prompt_1 }])];
                case 1:
                    aiResponseString = (_a.sent()).content.toString();
                    console.log("AI ICD-10 codes response: \"".concat(aiResponseString, "\""));
                    aiResponse = void 0;
                    try {
                        aiResponse = JSON.parse(aiResponseString);
                    }
                    catch (parseError) {
                        console.warn('Failed to parse AI ICD-10 response, attempting to fix JSON format:', parseError);
                        aiResponse = (0, utils_1.fixAndParseJsonObjectFromString)(aiResponseString);
                    }
                    return [2 /*return*/, aiResponse.potentialDiagnoses || []];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error generating ICD-10 codes:', error_2);
                    (0, aws_serverless_1.captureException)(error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}

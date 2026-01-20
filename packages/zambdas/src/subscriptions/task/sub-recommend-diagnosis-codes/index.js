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
exports.index = void 0;
exports.handler = handler;
exports.createDiagnosisCodeRecommendations = createDiagnosisCodeRecommendations;
var anthropic_1 = require("@langchain/anthropic");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var ai_1 = require("../../../shared/ai");
var helpers_1 = require("../helpers");
var ZAMBDA_NAME = 'sub-recommend-diagnosis-codes';
exports.index = (0, helpers_1.wrapTaskHandler)(ZAMBDA_NAME, handler);
function handler(input, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var aiClient;
        return __generator(this, function (_a) {
            aiClient = new anthropic_1.ChatAnthropic({
                model: 'claude-haiku-4-5-20251001',
                anthropicApiKey: (0, utils_1.getSecret)(utils_1.SecretsKeys.ANTHROPIC_API_KEY, input.secrets),
                temperature: 0,
                clientOptions: {
                    timeout: 5000, // 5 seconds (in milliseconds)
                    maxRetries: 5, // Number of retries on failure
                },
            });
            return [2 /*return*/, createDiagnosisCodeRecommendations(input.task, oystehr, aiClient)];
        });
    });
}
function createDiagnosisCodeRecommendations(task, oystehr, aiClient) {
    return __awaiter(this, void 0, void 0, function () {
        var encounterId, allResources, encounter, patient, hpiTextUpdated, mdmTextUpdated, existingChiefComplaint, existingMedicalDecision, saveOrUpdateRequests, potentialDiagnoses, existingAiDiagnoses, result;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    encounterId = (_b = (_a = task.focus) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '');
                    if (!encounterId) {
                        throw new Error("No valid Encounter focus found on Task ".concat(task.id));
                    }
                    console.time('time');
                    console.timeLog('time', 'before creating fhir client and token resources');
                    console.log('Getting token');
                    console.timeLog('time', 'before fetching resources');
                    console.log("Getting encounter ".concat(encounterId));
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Encounter',
                            params: [
                                {
                                    name: '_id',
                                    value: encounterId,
                                },
                                {
                                    name: '_include',
                                    value: 'Encounter:subject',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Condition:encounter',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'ClinicalImpression:encounter',
                                },
                            ],
                        })];
                case 1:
                    allResources = (_f.sent()).unbundle();
                    console.timeLog('time', 'after fetching resources');
                    encounter = allResources.find(function (resource) { return resource.resourceType === 'Encounter'; });
                    if (!encounter) {
                        throw new Error("Encounter ".concat(encounterId, " not found"));
                    }
                    patient = allResources.find(function (resource) { var _a, _b; return resource.resourceType === 'Patient' && resource.id === ((_b = (_a = encounter.subject) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Patient/', '')); });
                    if (!patient) {
                        throw new Error("Patient for Encounter ".concat(encounterId, " not found"));
                    }
                    existingChiefComplaint = allResources.find(function (resource) { var _a, _b; return resource.resourceType === 'Condition' && ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === 'chief-complaint'; })); });
                    if ((_c = existingChiefComplaint === null || existingChiefComplaint === void 0 ? void 0 : existingChiefComplaint.note) === null || _c === void 0 ? void 0 : _c[0].text) {
                        console.log('Using existing chief complaint text');
                        hpiTextUpdated = (_d = existingChiefComplaint.note) === null || _d === void 0 ? void 0 : _d[0].text;
                    }
                    existingMedicalDecision = allResources.find(function (resource) {
                        var _a, _b;
                        return resource.resourceType === 'ClinicalImpression' &&
                            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === 'medical-decision'; }));
                    });
                    if (existingMedicalDecision === null || existingMedicalDecision === void 0 ? void 0 : existingMedicalDecision.summary) {
                        console.log('Using existing medical decision text');
                        mdmTextUpdated = existingMedicalDecision.summary;
                    }
                    saveOrUpdateRequests = [];
                    console.timeLog('time', 'before generating codes');
                    potentialDiagnoses = [];
                    if (!(!hpiTextUpdated && !mdmTextUpdated)) return [3 /*break*/, 2];
                    console.log('No HPI or MDM text available, skipping ICD-10 code generation');
                    return [3 /*break*/, 4];
                case 2:
                    console.log('Generating ICD-10 codes from clinical notes');
                    return [4 /*yield*/, (0, ai_1.generateIcdTenCodesFromNotes)(aiClient, hpiTextUpdated, mdmTextUpdated)];
                case 3:
                    potentialDiagnoses = _f.sent();
                    _f.label = 4;
                case 4:
                    console.timeLog('time', 'after generating codes');
                    existingAiDiagnoses = allResources.filter(function (resource) {
                        var _a, _b, _c;
                        return resource.resourceType === 'Condition' &&
                            ((_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/ai-potential-diagnosis"); })) === null || _c === void 0 ? void 0 : _c.code) ===
                                'ai-potential-diagnosis';
                    });
                    // suggestions that are not suggested any more
                    existingAiDiagnoses.forEach(function (existingDiagnosis) {
                        if (existingDiagnosis.id &&
                            !potentialDiagnoses.some(function (diagnosis) { var _a, _b, _c; return diagnosis.icd10 === ((_c = (_b = (_a = existingDiagnosis.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code); })) {
                            saveOrUpdateRequests.push({ method: 'DELETE', url: "/Condition/".concat(existingDiagnosis.id) });
                        }
                    });
                    potentialDiagnoses.forEach(function (diagnosis) {
                        // Try to not create duplicate suggestions
                        if (existingAiDiagnoses.some(function (temp) { var _a, _b, _c; return ((_c = (_b = (_a = temp.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code) === diagnosis.icd10; })) {
                            return;
                        }
                        saveOrUpdateRequests.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeDiagnosisConditionResource)(encounterId, patient.id, {
                            code: diagnosis.icd10,
                            display: diagnosis.diagnosis,
                            isPrimary: false,
                        }, 'ai-potential-diagnosis', 'hpi-mdm')));
                    });
                    console.timeLog('time', 'before saving resources');
                    return [4 /*yield*/, oystehr.fhir.batch({
                            requests: saveOrUpdateRequests,
                        })];
                case 5:
                    result = _f.sent();
                    console.timeLog('time', 'after saving resources');
                    (_e = result.entry) === null || _e === void 0 ? void 0 : _e.forEach(function (_a) {
                        var _b;
                        var response = _a.response;
                        if (response && Number(response.status) >= 300) {
                            var outcome = ((_b = response.outcome) === null || _b === void 0 ? void 0 : _b.resourceType) === 'OperationOutcome' ? response.outcome : undefined;
                            console.error("Error modifying resource: ".concat(response.status, " ").concat(outcome === null || outcome === void 0 ? void 0 : outcome.issue.map(function (issue) { var _a; return (_a = issue.details) === null || _a === void 0 ? void 0 : _a.text; }).join(', ')));
                        }
                    });
                    console.timeEnd('time');
                    return [2 /*return*/, {
                            taskStatus: 'completed',
                            statusReason: "Recommended ".concat(potentialDiagnoses.length, " diagnosis codes"),
                        }];
            }
        });
    });
}

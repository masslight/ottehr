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
var ZAMBDA_NAME = 'ai-interview-summary';
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, questionnaireResponse, secrets, chatTranscript, oystehr, encounterID, createdResources, error_1;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                (0, shared_1.configSentry)('sub-ai-interview-summary', input.secrets);
                console.log('AI interview summary invoked');
                console.log("Input: ".concat(JSON.stringify(input)));
                _e.label = 1;
            case 1:
                _e.trys.push([1, 4, , 5]);
                _a = validateInput(input), questionnaireResponse = _a.questionnaireResponse, secrets = _a.secrets;
                chatTranscript = createChatTranscript(questionnaireResponse);
                return [4 /*yield*/, createOystehr(secrets)];
            case 2:
                oystehr = _e.sent();
                encounterID = (_d = (_c = (_b = questionnaireResponse.encounter) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1]) !== null && _d !== void 0 ? _d : '';
                return [4 /*yield*/, (0, ai_1.createResourcesFromAiInterview)(oystehr, encounterID, chatTranscript, null, undefined, null, null, secrets)];
            case 3:
                createdResources = _e.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify("Successfully created " + createdResources),
                    }];
            case 4:
                error_1 = _e.sent();
                console.log('error', error_1, error_1.issue);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
function createChatTranscript(questionnaireResponse) {
    var _a, _b;
    var questionnaire = (_a = questionnaireResponse.contained) === null || _a === void 0 ? void 0 : _a[0];
    return ((_b = questionnaire.item) !== null && _b !== void 0 ? _b : [])
        .sort(function (itemA, itemB) { return parseInt(itemA.linkId) - parseInt(itemB.linkId); })
        .flatMap(function (questionItem) {
        var _a, _b, _c;
        if (questionItem.linkId == '0') {
            return [];
        }
        var answerItem = (_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.find(function (answerItem) { return answerItem.linkId === questionItem.linkId; });
        var answerText = (_c = (_b = answerItem === null || answerItem === void 0 ? void 0 : answerItem.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
        var result = ["Provider: \"".concat(questionItem.text, "\"")];
        if (answerText != null) {
            result.push("Patient: \"".concat(answerText, "\""));
        }
        return result;
    })
        .join('\n');
}
function validateInput(input) {
    var questionnaireResponse = (0, shared_1.validateJsonBody)(input);
    if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
        throw new Error("QuestionnaireResponse is expected as request's body but received \"".concat(JSON.stringify(questionnaireResponse), "\""));
    }
    return {
        questionnaireResponse: questionnaireResponse,
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

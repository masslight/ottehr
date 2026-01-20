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
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var ai_1 = require("../../../shared/ai");
var start_1 = require("../start");
var ZAMBDA_NAME = 'handle-answer';
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, questionnaireResponseId, linkId, answer, secrets, oystehr, questionnaireResponse, chatbotInput, chatbotResponse, _b, _c, error_1;
    var _d;
    var _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                _h.label = 1;
            case 1:
                _h.trys.push([1, 6, , 7]);
                _a = validateInput(input), questionnaireResponseId = _a.questionnaireResponseId, linkId = _a.linkId, answer = _a.answer, secrets = _a.secrets;
                return [4 /*yield*/, createOystehr(secrets)];
            case 2:
                oystehr = _h.sent();
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'QuestionnaireResponse',
                        id: questionnaireResponseId,
                    })];
            case 3:
                questionnaireResponse = _h.sent();
                if (questionnaireResponse.status === 'completed') {
                    throw new Error('QuestionnaireResponse is completed.');
                }
                (_e = questionnaireResponse.item) === null || _e === void 0 ? void 0 : _e.push({
                    linkId: linkId,
                    answer: [
                        {
                            valueString: answer,
                        },
                    ],
                });
                chatbotInput = createChatbotInput(questionnaireResponse);
                if (chatbotInput == null || chatbotInput.length === 0) {
                    throw new Error("Invalid chatbot input \"".concat(chatbotInput, "\""));
                }
                console.log("chatbotInput: ".concat(JSON.stringify(chatbotInput)));
                return [4 /*yield*/, (0, ai_1.invokeChatbot)(chatbotInput, secrets)];
            case 4:
                chatbotResponse = (_h.sent()).content.toString();
                (_g = ((_f = questionnaireResponse.contained) === null || _f === void 0 ? void 0 : _f[0]).item) === null || _g === void 0 ? void 0 : _g.push({
                    linkId: (parseInt(linkId) + 1).toString(),
                    text: chatbotResponse,
                    type: 'text',
                });
                if (chatbotResponse.includes(start_1.INTERVIEW_COMPLETED)) {
                    questionnaireResponse.status = 'completed';
                }
                _d = {
                    statusCode: 200
                };
                _c = (_b = JSON).stringify;
                return [4 /*yield*/, oystehr.fhir.update(questionnaireResponse)];
            case 5: return [2 /*return*/, (_d.body = _c.apply(_b, [_h.sent()]),
                    _d)];
            case 6:
                error_1 = _h.sent();
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 7: return [2 /*return*/];
        }
    });
}); });
function validateInput(input) {
    var _a = (0, shared_1.validateJsonBody)(input), questionnaireResponseId = _a.questionnaireResponseId, linkId = _a.linkId, answer = _a.answer;
    return {
        questionnaireResponseId: (0, shared_1.validateString)(questionnaireResponseId, 'questionnaireResponseId'),
        linkId: (0, shared_1.validateString)(linkId, 'linkId'),
        answer: (0, shared_1.validateString)(answer, 'answer'),
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
function createChatbotInput(questionnaireResponse) {
    var _a, _b, _c;
    var questionnaire = (_a = questionnaireResponse.contained) === null || _a === void 0 ? void 0 : _a[0];
    return (_c = (_b = questionnaire.item) === null || _b === void 0 ? void 0 : _b.sort(function (itemA, itemB) { return parseInt(itemA.linkId) - parseInt(itemB.linkId); })) === null || _c === void 0 ? void 0 : _c.flatMap(function (questionItem) {
        var _a, _b, _c;
        var answerItem = (0, shared_1.assertDefined)((_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.find(function (answerItem) { return answerItem.linkId === questionItem.linkId; }), "Answer for question \"".concat(questionItem.linkId, "\""));
        var questionText = (0, shared_1.assertDefined)(questionItem.text, "Text of question \"".concat(questionItem.linkId, "\""));
        var answerText = (0, shared_1.assertDefined)((_c = (_b = answerItem.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString, "Text of answer to question \"".concat(questionItem.linkId, "\""));
        if (questionItem.linkId == '0') {
            return [{ role: 'user', content: answerText }];
        }
        return [
            { role: 'assistant', content: questionText },
            { role: 'user', content: answerText },
        ];
    });
}

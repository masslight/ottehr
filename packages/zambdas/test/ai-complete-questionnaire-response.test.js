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
var vitest_1 = require("vitest");
var ai_complete_questionnaire_response_1 = require("../src/shared/ai-complete-questionnaire-response");
// Mock Oystehr SDK
var mockOystehr = {
    fhir: {
        search: vitest_1.vi.fn(),
        update: vitest_1.vi.fn(),
    },
};
(0, vitest_1.describe)('AI Questionnaire Helper', function () {
    (0, vitest_1.beforeEach)(function () {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('should skip if no AI QuestionnaireResponse found', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Mock no QR found
                    mockOystehr.fhir.search.mockResolvedValue({
                        unbundle: function () { return []; },
                    });
                    return [4 /*yield*/, (0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(mockOystehr, 'encounter-123')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockOystehr.fhir.search).toHaveBeenCalledWith({
                        resourceType: 'QuestionnaireResponse',
                        params: [
                            { name: 'encounter', value: 'Encounter/encounter-123' },
                            { name: 'questionnaire', value: '#aiInterviewQuestionnaire' },
                        ],
                    });
                    (0, vitest_1.expect)(mockOystehr.fhir.update).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should skip if AI resources already exist (idempotency)', function () { return __awaiter(void 0, void 0, void 0, function () {
        var inProgressQR;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    inProgressQR = {
                        resourceType: 'QuestionnaireResponse',
                        id: 'qr-123',
                        status: 'in-progress',
                        questionnaire: '#aiInterviewQuestionnaire',
                    };
                    mockOystehr.fhir.search
                        .mockResolvedValueOnce({
                        unbundle: function () { return [inProgressQR]; },
                    })
                        // Mock existing DocumentReference found
                        .mockResolvedValueOnce({
                        unbundle: function () { return [{ resourceType: 'DocumentReference', id: 'doc-123' }]; },
                    });
                    return [4 /*yield*/, (0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(mockOystehr, 'encounter-123')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockOystehr.fhir.update).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should skip if AI QuestionnaireResponse is already completed', function () { return __awaiter(void 0, void 0, void 0, function () {
        var completedQR;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    completedQR = {
                        resourceType: 'QuestionnaireResponse',
                        id: 'qr-123',
                        status: 'completed',
                        questionnaire: '#aiInterviewQuestionnaire',
                    };
                    mockOystehr.fhir.search.mockResolvedValueOnce({
                        unbundle: function () { return [completedQR]; },
                    });
                    return [4 /*yield*/, (0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(mockOystehr, 'encounter-123')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockOystehr.fhir.update).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should skip if AI QuestionnaireResponse has no user answers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrWithoutAnswers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    qrWithoutAnswers = {
                        resourceType: 'QuestionnaireResponse',
                        id: 'qr-123',
                        status: 'in-progress',
                        questionnaire: '#aiInterviewQuestionnaire',
                        item: [
                            {
                                linkId: '0', // Initial AI message
                                answer: [{ valueString: 'Initial AI message' }],
                            },
                        ],
                    };
                    mockOystehr.fhir.search
                        .mockResolvedValueOnce({
                        unbundle: function () { return [qrWithoutAnswers]; },
                    })
                        // Mock no existing DocumentReference
                        .mockResolvedValueOnce({
                        unbundle: function () { return []; },
                    });
                    return [4 /*yield*/, (0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(mockOystehr, 'encounter-123')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockOystehr.fhir.update).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should complete AI QuestionnaireResponse with user answers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var qrWithAnswers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    qrWithAnswers = {
                        resourceType: 'QuestionnaireResponse',
                        id: 'qr-123',
                        status: 'in-progress',
                        questionnaire: '#aiInterviewQuestionnaire',
                        item: [
                            {
                                linkId: '0', // Initial AI message
                                answer: [{ valueString: 'Initial AI message' }],
                            },
                            {
                                linkId: '1', // User answer
                                answer: [{ valueString: 'My head hurts' }],
                            },
                            {
                                linkId: '2', // Another user answer
                                answer: [{ valueString: 'Since yesterday' }],
                            },
                        ],
                    };
                    mockOystehr.fhir.search
                        .mockResolvedValueOnce({
                        unbundle: function () { return [qrWithAnswers]; },
                    })
                        // Mock no existing DocumentReference
                        .mockResolvedValueOnce({
                        unbundle: function () { return []; },
                    });
                    return [4 /*yield*/, (0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(mockOystehr, 'encounter-123')];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(mockOystehr.fhir.update).toHaveBeenCalledWith(__assign(__assign({}, qrWithAnswers), { status: 'completed' }));
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should handle errors gracefully without throwing', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockOystehr.fhir.search.mockRejectedValue(new Error('FHIR search failed'));
                    // Should not throw
                    return [4 /*yield*/, (0, vitest_1.expect)((0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(mockOystehr, 'encounter-123')).resolves.toBeUndefined()];
                case 1:
                    // Should not throw
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});

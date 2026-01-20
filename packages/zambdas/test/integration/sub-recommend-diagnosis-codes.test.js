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
var testing_1 = require("@langchain/core/utils/testing");
var utils_1 = require("utils");
var sub_recommend_diagnosis_codes_1 = require("../../src/subscriptions/task/sub-recommend-diagnosis-codes");
var integration_test_seed_data_setup_1 = require("../helpers/integration-test-seed-data-setup");
var baseResources;
describe('sub-recommend-diagnosis-codes integration tests', function () {
    // let oystehrLocalZambdas: Oystehr;
    var oystehr;
    var cleanup;
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var setup;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, integration_test_seed_data_setup_1.setupIntegrationTest)('sub-recommend-diagnosis-codes.test.ts', utils_1.M2MClientMockType.provider)];
                case 1:
                    setup = _a.sent();
                    // oystehrLocalZambdas = setup.oystehrTestUserM2M;
                    oystehr = setup.oystehr;
                    return [4 /*yield*/, (0, integration_test_seed_data_setup_1.insertInPersonAppointmentBase)(setup.oystehr, setup.processId)];
                case 2:
                    baseResources = _a.sent();
                    cleanup = setup.cleanup;
                    return [2 /*return*/];
            }
        });
    }); }, 60000);
    afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, cleanup()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('sub-recommend-diagnosis-codes happy paths', function () {
        it('should retrieve recommendations and save them-- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var task, mockAIClient, result, error, err_1, savedConditions, aiConditions;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        task = {
                            id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
                            resourceType: 'Task',
                            status: 'requested',
                            intent: 'order',
                            focus: { reference: "Encounter/".concat(baseResources.encounter.id) },
                            code: {
                                coding: [
                                    {
                                        system: utils_1.OttehrTaskSystem,
                                        code: 'recommend-diagnosis-codes',
                                    },
                                ],
                            },
                        };
                        mockAIClient = new testing_1.FakeListChatModel({
                            responses: [
                                "{\n  \"potentialDiagnoses\": [\n    {\n      \"diagnosis\": \"Allergic contact dermatitis\",\n      \"icd10\": \"L23.9\"\n    }\n  ]\n}",
                            ],
                        });
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, sub_recommend_diagnosis_codes_1.createDiagnosisCodeRecommendations)(task, oystehr, mockAIClient)];
                    case 2:
                        result = _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _e.sent();
                        error = err_1;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(error).toBeUndefined();
                        expect(result).toBeDefined();
                        expect(result).toHaveProperty('taskStatus');
                        expect(result === null || result === void 0 ? void 0 : result.taskStatus).toEqual('completed');
                        expect(result).toHaveProperty('statusReason');
                        expect(result === null || result === void 0 ? void 0 : result.statusReason).toEqual('Recommended 1 diagnosis codes');
                        return [4 /*yield*/, oystehr.fhir.search({
                                resourceType: 'Condition',
                                params: [{ name: 'encounter', value: baseResources.encounter.id }],
                            })];
                    case 5:
                        savedConditions = (_e.sent()).unbundle();
                        aiConditions = savedConditions.filter(function (resource) {
                            var _a, _b, _c;
                            return (((_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/ai-potential-diagnosis"); })) === null || _c === void 0 ? void 0 : _c.code) === 'ai-potential-diagnosis');
                        });
                        expect(aiConditions.length).toBe(1);
                        expect((_b = (_a = aiConditions[0].code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code).toBe('L23.9');
                        expect((_d = (_c = aiConditions[0].code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].display).toBe('Allergic contact dermatitis');
                        return [2 /*return*/];
                }
            });
        }); });
        it('handles multiple results in json in markdown-- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var task, mockAIClient, result, error, err_2, savedConditions, aiConditions;
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        task = {
                            id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
                            resourceType: 'Task',
                            status: 'requested',
                            intent: 'order',
                            focus: { reference: "Encounter/".concat(baseResources.encounter.id) },
                            code: {
                                coding: [
                                    {
                                        system: utils_1.OttehrTaskSystem,
                                        code: 'recommend-diagnosis-codes',
                                    },
                                ],
                            },
                        };
                        mockAIClient = new testing_1.FakeListChatModel({
                            responses: [
                                "```json\n{\n  \"potentialDiagnoses\": [\n    {\n      \"diagnosis\": \"Allergic contact dermatitis\",\n      \"icd10\": \"L23.9\"\n    },\n    {\n      \"diagnosis\": \"Influenza virus infection\",\n      \"icd10\": \"J11.1\"\n    }\n  ]\n}\n```",
                            ],
                        });
                        _j.label = 1;
                    case 1:
                        _j.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, sub_recommend_diagnosis_codes_1.createDiagnosisCodeRecommendations)(task, oystehr, mockAIClient)];
                    case 2:
                        result = _j.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _j.sent();
                        error = err_2;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(error).toBeUndefined();
                        expect(result).toBeDefined();
                        expect(result).toHaveProperty('taskStatus');
                        expect(result === null || result === void 0 ? void 0 : result.taskStatus).toEqual('completed');
                        expect(result).toHaveProperty('statusReason');
                        expect(result === null || result === void 0 ? void 0 : result.statusReason).toEqual('Recommended 2 diagnosis codes');
                        return [4 /*yield*/, oystehr.fhir.search({
                                resourceType: 'Condition',
                                params: [
                                    { name: 'encounter', value: baseResources.encounter.id },
                                    { name: '_sort', value: '_lastUpdated' },
                                ],
                            })];
                    case 5:
                        savedConditions = (_j.sent()).unbundle();
                        aiConditions = savedConditions.filter(function (resource) {
                            var _a, _b, _c;
                            return (((_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/ai-potential-diagnosis"); })) === null || _c === void 0 ? void 0 : _c.code) === 'ai-potential-diagnosis');
                        });
                        expect(aiConditions.length).toBe(2);
                        expect((_b = (_a = aiConditions[0].code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code).toBe('L23.9');
                        expect((_d = (_c = aiConditions[0].code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].display).toBe('Allergic contact dermatitis');
                        expect((_f = (_e = aiConditions[1].code) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f[0].code).toBe('J11.1');
                        expect((_h = (_g = aiConditions[1].code) === null || _g === void 0 ? void 0 : _g.coding) === null || _h === void 0 ? void 0 : _h[0].display).toBe('Influenza virus infection');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should remove prior recommendations-- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var task, mockAIClient, result, error, err_3, savedConditions, aiConditions;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        task = {
                            id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
                            resourceType: 'Task',
                            status: 'requested',
                            intent: 'order',
                            focus: { reference: "Encounter/".concat(baseResources.encounter.id) },
                            code: {
                                coding: [
                                    {
                                        system: utils_1.OttehrTaskSystem,
                                        code: 'recommend-diagnosis-codes',
                                    },
                                ],
                            },
                        };
                        mockAIClient = new testing_1.FakeListChatModel({
                            responses: [
                                "{\n  \"potentialDiagnoses\": [\n    {\n      \"diagnosis\": \"Sneezing\",\n      \"icd10\": \"R06.02\"\n    }\n  ]\n}",
                            ],
                        });
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, sub_recommend_diagnosis_codes_1.createDiagnosisCodeRecommendations)(task, oystehr, mockAIClient)];
                    case 2:
                        result = _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_3 = _e.sent();
                        error = err_3;
                        return [3 /*break*/, 4];
                    case 4:
                        expect(error).toBeUndefined();
                        expect(result).toBeDefined();
                        expect(result).toHaveProperty('taskStatus');
                        expect(result === null || result === void 0 ? void 0 : result.taskStatus).toEqual('completed');
                        expect(result).toHaveProperty('statusReason');
                        expect(result === null || result === void 0 ? void 0 : result.statusReason).toEqual('Recommended 1 diagnosis codes');
                        return [4 /*yield*/, oystehr.fhir.search({
                                resourceType: 'Condition',
                                params: [{ name: 'encounter', value: baseResources.encounter.id }],
                            })];
                    case 5:
                        savedConditions = (_e.sent()).unbundle();
                        aiConditions = savedConditions.filter(function (resource) {
                            var _a, _b, _c;
                            return (((_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/ai-potential-diagnosis"); })) === null || _c === void 0 ? void 0 : _c.code) === 'ai-potential-diagnosis');
                        });
                        expect(aiConditions.length).toBe(1);
                        expect((_b = (_a = aiConditions[0].code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code).toBe('R06.02');
                        expect((_d = (_c = aiConditions[0].code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].display).toBe('Sneezing');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should remove all prior recommendations when all input is empty-- success', function () { return __awaiter(void 0, void 0, void 0, function () {
            var task, mockAIClient, result, error, err_4, savedConditions, aiConditions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        task = {
                            id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
                            resourceType: 'Task',
                            status: 'requested',
                            intent: 'order',
                            focus: { reference: "Encounter/".concat(baseResources.encounter.id) },
                            code: {
                                coding: [
                                    {
                                        system: utils_1.OttehrTaskSystem,
                                        code: 'recommend-diagnosis-codes',
                                    },
                                ],
                            },
                        };
                        mockAIClient = new testing_1.FakeListChatModel({
                            responses: [
                                "{\n  \"potentialDiagnoses\": [\n    {\n      \"diagnosis\": \"Sneezing\",\n      \"icd10\": \"R06.02\"\n    }\n  ]\n}",
                            ],
                        });
                        return [4 /*yield*/, oystehr.fhir.delete({ resourceType: 'ClinicalImpression', id: baseResources.clinicalImpression.id })];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, (0, sub_recommend_diagnosis_codes_1.createDiagnosisCodeRecommendations)(task, oystehr, mockAIClient)];
                    case 3:
                        result = _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        err_4 = _a.sent();
                        error = err_4;
                        return [3 /*break*/, 5];
                    case 5:
                        expect(error).toBeUndefined();
                        expect(result).toBeDefined();
                        expect(result).toHaveProperty('taskStatus');
                        expect(result === null || result === void 0 ? void 0 : result.taskStatus).toEqual('completed');
                        expect(result).toHaveProperty('statusReason');
                        expect(result === null || result === void 0 ? void 0 : result.statusReason).toEqual('Recommended 0 diagnosis codes');
                        return [4 /*yield*/, oystehr.fhir.search({
                                resourceType: 'Condition',
                                params: [{ name: 'encounter', value: baseResources.encounter.id }],
                            })];
                    case 6:
                        savedConditions = (_a.sent()).unbundle();
                        aiConditions = savedConditions.filter(function (resource) {
                            var _a, _b, _c;
                            return (((_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/ai-potential-diagnosis"); })) === null || _c === void 0 ? void 0 : _c.code) === 'ai-potential-diagnosis');
                        });
                        expect(aiConditions.length).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});

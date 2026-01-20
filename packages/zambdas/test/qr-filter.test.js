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
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var shared_1 = require("../src/shared");
var questionnaire_responses_json_1 = require("./data/questionnaire-responses.json");
var secrets_1 = require("./data/secrets");
// where does this come form, and how can we get the questionnaire id instead?
// const APPOINTMENT_ID = '94a90465-8c4f-422d-b752-ca3d154d7175';
describe.skip('qr recursive filter validation tests', function () {
    var questions = [];
    vitest_1.vi.setConfig({ testTimeout: 100000 });
    beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
        var FHIR_API, AUTH0_ENDPOINT, AUTH0_AUDIENCE, AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS, SECRETS, token, oystehr, maybeData, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    FHIR_API = secrets_1.SECRETS.FHIR_API, AUTH0_ENDPOINT = secrets_1.SECRETS.AUTH0_ENDPOINT, AUTH0_AUDIENCE = secrets_1.SECRETS.AUTH0_AUDIENCE, AUTH0_CLIENT_TESTS = secrets_1.SECRETS.AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS = secrets_1.SECRETS.AUTH0_SECRET_TESTS;
                    SECRETS = {
                        FHIR_API: FHIR_API,
                        AUTH0_ENDPOINT: AUTH0_ENDPOINT,
                        AUTH0_AUDIENCE: AUTH0_AUDIENCE,
                        AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
                        AUTH0_SECRET: AUTH0_SECRET_TESTS,
                    };
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(SECRETS)];
                case 1:
                    token = _a.sent();
                    oystehr = (0, shared_1.createOystehrClient)(token, SECRETS);
                    return [4 /*yield*/, (0, utils_1.getQuestionnaireItemsAndProgress)('some_questionnaire_response_id', oystehr)];
                case 2:
                    maybeData = _a.sent();
                    if (!maybeData) {
                        throw new Error('No items');
                    }
                    items = maybeData.items;
                    questions = items;
                    (0, vitest_1.expect)(questions.length).toBeGreaterThan(0);
                    return [2 /*return*/];
            }
        });
    }); });
    test('filter test 1', function () { return __awaiter(void 0, void 0, void 0, function () {
        var stuffNeedingFilter, item, filtered, paymentOptionPage, secondaryInsurance, nonPaymentOptionItems, paymentOptionItem, contactInfoPage, psa;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            stuffNeedingFilter = questionnaire_responses_json_1.default.full.find(function (i) { return i.description === 'insurance-fields-filtered-based-on-payment-option --valid'; });
            (0, vitest_1.expect)(stuffNeedingFilter).toBeDefined();
            if (!stuffNeedingFilter) {
                return [2 /*return*/];
            }
            item = stuffNeedingFilter.item;
            filtered = (0, utils_1.recursiveGroupTransform)(questions, item);
            console.log('filtered', JSON.stringify(filtered));
            (0, vitest_1.expect)(filtered).toBeDefined();
            paymentOptionPage = filtered.find(function (p) { return p.linkId === 'payment-option-page'; });
            (0, vitest_1.expect)(paymentOptionPage).toBeDefined();
            (0, vitest_1.expect)(paymentOptionPage.item).toBeDefined();
            secondaryInsurance = paymentOptionPage.item.find(function (p) {
                return (p === null || p === void 0 ? void 0 : p.linkId) === 'secondary-insurance';
            });
            (0, vitest_1.expect)(secondaryInsurance === null || secondaryInsurance === void 0 ? void 0 : secondaryInsurance.item).toBeUndefined();
            nonPaymentOptionItems = paymentOptionPage.item.filter(function (i) {
                return i !== undefined && (i === null || i === void 0 ? void 0 : i.linkId) !== 'payment-option' && ((i === null || i === void 0 ? void 0 : i.item) !== undefined || (i === null || i === void 0 ? void 0 : i.answer) !== undefined);
            });
            (0, vitest_1.expect)(nonPaymentOptionItems.length).toBe(0);
            paymentOptionItem = paymentOptionPage.item.find(function (i) {
                return (i === null || i === void 0 ? void 0 : i.linkId) === 'payment-option';
            });
            (0, vitest_1.expect)(paymentOptionItem).toBeDefined();
            (0, vitest_1.expect)(paymentOptionItem.item).toBeUndefined();
            (0, vitest_1.expect)((_b = (_a = paymentOptionItem.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString).toBe('I will pay without insurance');
            contactInfoPage = filtered.find(function (p) { return (p === null || p === void 0 ? void 0 : p.linkId) === 'contact-information-page'; });
            (0, vitest_1.expect)(contactInfoPage === null || contactInfoPage === void 0 ? void 0 : contactInfoPage.item).toBeDefined();
            psa = (_c = contactInfoPage === null || contactInfoPage === void 0 ? void 0 : contactInfoPage.item) === null || _c === void 0 ? void 0 : _c.find(function (i) { return (i === null || i === void 0 ? void 0 : i.linkId) === 'patient-street-address'; });
            (0, vitest_1.expect)((_e = (_d = psa === null || psa === void 0 ? void 0 : psa.answer) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.valueString).toBeDefined();
            return [2 /*return*/];
        });
    }); });
    test('filter test 2 - normalizing some fhir-invalid no-value cases so that they are fhir-valid', function () { return __awaiter(void 0, void 0, void 0, function () {
        var stuffNeedingFilter, pageQuestions, paymentOptionPageItem, secondaryInsurance, insuranceCardBack, paymentOptionItem;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            stuffNeedingFilter = questionnaire_responses_json_1.default.page['payment-option-page'].find(function (i) { return i.description === 'insurance-fields-with-fhir-invalid-no-value-cases --valid'; });
            (0, vitest_1.expect)(stuffNeedingFilter).toBeDefined();
            if (!stuffNeedingFilter) {
                return [2 /*return*/];
            }
            pageQuestions = questions.find(function (q) { return q.linkId === 'payment-option-page'; });
            paymentOptionPageItem = (0, utils_1.recursiveGroupTransform)((_a = pageQuestions === null || pageQuestions === void 0 ? void 0 : pageQuestions.item) !== null && _a !== void 0 ? _a : [], stuffNeedingFilter.item);
            console.log('payment option page item', JSON.stringify(paymentOptionPageItem));
            secondaryInsurance = paymentOptionPageItem.find(function (p) {
                return (p === null || p === void 0 ? void 0 : p.linkId) === 'secondary-insurance';
            });
            (0, vitest_1.expect)(secondaryInsurance === null || secondaryInsurance === void 0 ? void 0 : secondaryInsurance.item).toBeDefined();
            (0, vitest_1.expect)(secondaryInsurance === null || secondaryInsurance === void 0 ? void 0 : secondaryInsurance.answer).toBeUndefined();
            insuranceCardBack = paymentOptionPageItem.find(function (p) {
                return (p === null || p === void 0 ? void 0 : p.linkId) === 'insurance-card-back';
            });
            (0, vitest_1.expect)(insuranceCardBack === null || insuranceCardBack === void 0 ? void 0 : insuranceCardBack.item).toBeUndefined();
            (0, vitest_1.expect)(insuranceCardBack === null || insuranceCardBack === void 0 ? void 0 : insuranceCardBack.answer).toBeUndefined();
            paymentOptionItem = paymentOptionPageItem.find(function (i) {
                return (i === null || i === void 0 ? void 0 : i.linkId) === 'payment-option';
            });
            (0, vitest_1.expect)(paymentOptionItem).toBeDefined();
            (0, vitest_1.expect)(paymentOptionItem.item).toBeUndefined();
            (0, vitest_1.expect)((_c = (_b = paymentOptionItem.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString).toBe('I have insurance');
            return [2 /*return*/];
        });
    }); });
});

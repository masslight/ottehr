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
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var in_person_intake_questionnaire_json_1 = require("../../../config/oystehr/in-person-intake-questionnaire.json");
var virtual_intake_questionnaire_json_1 = require("../../../config/oystehr/virtual-intake-questionnaire.json");
var booking_questionnaire_json_1 = require("./data/booking-questionnaire.json");
var intake_paperwork_questionnaire_json_1 = require("./data/intake-paperwork-questionnaire.json");
var patient_record_questionnaire_json_1 = require("./data/patient-record-questionnaire.json");
var virtual_intake_paperwork_questionnaire_json_1 = require("./data/virtual-intake-paperwork-questionnaire.json");
describe('testing Questionnaire generation from config objects', function () {
    vitest_1.test.concurrent('in person intake paperwork config JSON matches generated questionnaire', function () {
        var generatedQuestionnaire = (0, utils_1.IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE)();
        var key = Object.keys(in_person_intake_questionnaire_json_1.default.fhirResources)[0];
        var actualConfigQuestionnaire = in_person_intake_questionnaire_json_1.default.fhirResources[key].resource;
        (0, vitest_1.expect)(actualConfigQuestionnaire).toBeDefined();
        (0, vitest_1.expect)(generatedQuestionnaire).toEqual(actualConfigQuestionnaire);
    });
    vitest_1.test.concurrent('virtual intake paperwork config JSON matches generated questionnaire', function () {
        var generatedQuestionnaire = (0, utils_1.VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE)();
        var key = Object.keys(virtual_intake_questionnaire_json_1.default.fhirResources)[0];
        var actualConfigQuestionnaire = virtual_intake_questionnaire_json_1.default.fhirResources[key].resource;
        (0, vitest_1.expect)(actualConfigQuestionnaire).toBeDefined();
        (0, vitest_1.expect)(generatedQuestionnaire).toEqual(actualConfigQuestionnaire);
    });
    vitest_1.test
        .skipIf(utils_1.BRANDING_CONFIG.projectName !== 'Ottehr')
        .concurrent('patient record questionnaire config generates expected questionnaire items', function () { return __awaiter(void 0, void 0, void 0, function () {
        var questionnaireItems;
        return __generator(this, function (_a) {
            questionnaireItems = (0, utils_1.createQuestionnaireItemFromConfig)(utils_1.PATIENT_RECORD_CONFIG);
            (0, vitest_1.expect)(questionnaireItems).toBeDefined();
            (0, vitest_1.expect)(questionnaireItems).toEqual(patient_record_questionnaire_json_1.default);
            return [2 /*return*/];
        });
    }); });
    vitest_1.test
        .skipIf(utils_1.BRANDING_CONFIG.projectName !== 'Ottehr')
        .concurrent('booking questionnaire config generates expected questionnaire items', function () { return __awaiter(void 0, void 0, void 0, function () {
        var questionnaireItems;
        return __generator(this, function (_a) {
            questionnaireItems = (0, utils_1.createQuestionnaireItemFromConfig)(utils_1.BOOKING_CONFIG.formConfig);
            (0, vitest_1.expect)(questionnaireItems).toBeDefined();
            (0, vitest_1.expect)(questionnaireItems).toEqual(booking_questionnaire_json_1.default.item);
            return [2 /*return*/];
        });
    }); });
    vitest_1.test
        .skipIf(utils_1.BRANDING_CONFIG.projectName !== 'Ottehr')
        .concurrent('intake paperwork questionnaire generates expected questionnaire', function () { return __awaiter(void 0, void 0, void 0, function () {
        var generatedQuestionnaire, generatedSections, expectedSections, _loop_1, i;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            generatedQuestionnaire = (0, utils_1.IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE)();
            (0, vitest_1.expect)(generatedQuestionnaire).toBeDefined();
            generatedSections = generatedQuestionnaire.item;
            expectedSections = intake_paperwork_questionnaire_json_1.default.item;
            // Compare each section
            (0, vitest_1.expect)(generatedSections === null || generatedSections === void 0 ? void 0 : generatedSections.length).toBe(expectedSections === null || expectedSections === void 0 ? void 0 : expectedSections.length);
            _loop_1 = function (i) {
                var expSection = expectedSections[i];
                var genSection = generatedSections[i];
                // Compare section-level properties
                (0, vitest_1.expect)(genSection.linkId).toBe(expSection.linkId);
                (0, vitest_1.expect)(genSection.text).toBe(expSection.text);
                (0, vitest_1.expect)(genSection.type).toBe(expSection.type);
                // Compare section-level extensions if present
                if (expSection.extension) {
                    (0, vitest_1.expect)(genSection.extension).toEqual(expSection.extension);
                }
                if (expSection.enableWhen) {
                    (0, vitest_1.expect)(genSection.enableWhen).toEqual(expSection.enableWhen);
                }
                if (expSection.enableBehavior) {
                    (0, vitest_1.expect)(genSection.enableBehavior).toBe(expSection.enableBehavior);
                }
                // Separate logical items from regular items
                var isLogicalItem = function (item) { return item.readOnly === true || (item.required === false && !item.text); };
                var expLogicalItems = ((_a = expSection.item) === null || _a === void 0 ? void 0 : _a.filter(isLogicalItem)) || [];
                var expRegularItems = ((_b = expSection.item) === null || _b === void 0 ? void 0 : _b.filter(function (item) { return !isLogicalItem(item); })) || [];
                var genLogicalItems = ((_c = genSection.item) === null || _c === void 0 ? void 0 : _c.filter(isLogicalItem)) || [];
                var genRegularItems = ((_d = genSection.item) === null || _d === void 0 ? void 0 : _d.filter(function (item) { return !isLogicalItem(item); })) || [];
                // Check that all logical items are present (order doesn't matter)
                var expLogicalIds = new Set(expLogicalItems.map(function (i) { return i.linkId; }));
                var genLogicalIds = new Set(genLogicalItems.map(function (i) { return i.linkId; }));
                (0, vitest_1.expect)(genLogicalIds).toEqual(expLogicalIds);
                var _loop_2 = function (expLogical) {
                    var genLogical = genLogicalItems.find(function (g) { return g.linkId === expLogical.linkId; });
                    (0, vitest_1.expect)(genLogical).toBeDefined();
                    (0, vitest_1.expect)(genLogical).toEqual(expLogical);
                };
                // For each logical item, check that it exists with the same properties (order-independent)
                for (var _i = 0, expLogicalItems_1 = expLogicalItems; _i < expLogicalItems_1.length; _i++) {
                    var expLogical = expLogicalItems_1[_i];
                    _loop_2(expLogical);
                }
                // Helper to normalize items by sorting extensions (order-independent comparison)
                var normalizeItem = function (item) {
                    if (!item)
                        return item;
                    var normalized = __assign({}, item);
                    if (normalized.extension && Array.isArray(normalized.extension)) {
                        normalized.extension = __spreadArray([], normalized.extension, true).sort(function (a, b) {
                            return (a.url || '').localeCompare(b.url || '');
                        });
                    }
                    return normalized;
                };
                // Check that regular items are in the exact expected order
                (0, vitest_1.expect)(genRegularItems.length).toBe(expRegularItems.length);
                for (var j = 0; j < expRegularItems.length; j++) {
                    var normalizedGen = normalizeItem(genRegularItems[j]);
                    var normalizedExp = normalizeItem(expRegularItems[j]);
                    (0, vitest_1.expect)(normalizedGen).toEqual(normalizedExp);
                }
            };
            for (i = 0; i < ((expectedSections === null || expectedSections === void 0 ? void 0 : expectedSections.length) || 0); i++) {
                _loop_1(i);
            }
            return [2 /*return*/];
        });
    }); });
    vitest_1.test
        .skipIf(utils_1.BRANDING_CONFIG.projectName !== 'Ottehr')
        .concurrent('virtual intake paperwork questionnaire generates expected questionnaire', function () { return __awaiter(void 0, void 0, void 0, function () {
        var generatedQuestionnaire, generatedSections, expectedSections, _loop_3, i;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            generatedQuestionnaire = (0, utils_1.VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE)();
            (0, vitest_1.expect)(generatedQuestionnaire).toBeDefined();
            generatedSections = generatedQuestionnaire.item;
            expectedSections = virtual_intake_paperwork_questionnaire_json_1.default;
            // Compare each section
            (0, vitest_1.expect)(generatedSections === null || generatedSections === void 0 ? void 0 : generatedSections.length).toBe(expectedSections === null || expectedSections === void 0 ? void 0 : expectedSections.length);
            _loop_3 = function (i) {
                var expSection = expectedSections[i];
                var genSection = generatedSections[i];
                // Compare section-level properties
                (0, vitest_1.expect)(genSection.linkId).toBe(expSection.linkId);
                (0, vitest_1.expect)(genSection.text).toBe(expSection.text);
                (0, vitest_1.expect)(genSection.type).toBe(expSection.type);
                // Compare section-level extensions if present
                if (expSection.extension) {
                    (0, vitest_1.expect)(genSection.extension).toEqual(expSection.extension);
                }
                if (expSection.enableWhen) {
                    (0, vitest_1.expect)(genSection.enableWhen).toEqual(expSection.enableWhen);
                }
                if (expSection.enableBehavior) {
                    (0, vitest_1.expect)(genSection.enableBehavior).toBe(expSection.enableBehavior);
                }
                // Separate logical items from regular items
                var isLogicalItem = function (item) { return item.readOnly === true || (item.required === false && !item.text); };
                var expLogicalItems = ((_a = expSection.item) === null || _a === void 0 ? void 0 : _a.filter(isLogicalItem)) || [];
                var expRegularItems = ((_b = expSection.item) === null || _b === void 0 ? void 0 : _b.filter(function (item) { return !isLogicalItem(item); })) || [];
                var genLogicalItems = ((_c = genSection.item) === null || _c === void 0 ? void 0 : _c.filter(isLogicalItem)) || [];
                var genRegularItems = ((_d = genSection.item) === null || _d === void 0 ? void 0 : _d.filter(function (item) { return !isLogicalItem(item); })) || [];
                // Check that all logical items are present (order doesn't matter)
                var expLogicalIds = new Set(expLogicalItems.map(function (i) { return i.linkId; }));
                var genLogicalIds = new Set(genLogicalItems.map(function (i) { return i.linkId; }));
                (0, vitest_1.expect)(genLogicalIds).toEqual(expLogicalIds);
                var _loop_4 = function (expLogical) {
                    var genLogical = genLogicalItems.find(function (g) { return g.linkId === expLogical.linkId; });
                    (0, vitest_1.expect)(genLogical).toBeDefined();
                    (0, vitest_1.expect)(genLogical).toEqual(expLogical);
                };
                // For each logical item, check that it exists with the same properties (order-independent)
                for (var _i = 0, expLogicalItems_2 = expLogicalItems; _i < expLogicalItems_2.length; _i++) {
                    var expLogical = expLogicalItems_2[_i];
                    _loop_4(expLogical);
                }
                // Helper to normalize items by sorting extensions (order-independent comparison)
                var normalizeItem = function (item) {
                    if (!item)
                        return item;
                    var normalized = __assign({}, item);
                    if (normalized.extension && Array.isArray(normalized.extension)) {
                        normalized.extension = __spreadArray([], normalized.extension, true).sort(function (a, b) {
                            return (a.url || '').localeCompare(b.url || '');
                        });
                    }
                    return normalized;
                };
                // Check that regular items are in the exact expected order
                (0, vitest_1.expect)(genRegularItems.length).toBe(expRegularItems.length);
                for (var j = 0; j < expRegularItems.length; j++) {
                    var normalizedGen = normalizeItem(genRegularItems[j]);
                    var normalizedExp = normalizeItem(expRegularItems[j]);
                    (0, vitest_1.expect)(normalizedGen).toEqual(normalizedExp);
                }
            };
            for (i = 0; i < ((expectedSections === null || expectedSections === void 0 ? void 0 : expectedSections.length) || 0); i++) {
                _loop_3(i);
            }
            return [2 /*return*/];
        });
    }); });
});

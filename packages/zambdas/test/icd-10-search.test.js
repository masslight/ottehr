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
var vitest_1 = require("vitest");
var icd_10_search_1 = require("../src/shared/icd-10-search");
(0, vitest_1.describe)('icd-10-search tests', function () {
    (0, vitest_1.it)('should find J06 codes correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, j06Codes, j060, j069;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('J06')];
                case 1:
                    results = _a.sent();
                    // Should return results
                    (0, vitest_1.expect)(results).toBeDefined();
                    (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
                    (0, vitest_1.expect)(results.length).toBeGreaterThan(0);
                    // All results should have the required structure
                    results.forEach(function (code) {
                        (0, vitest_1.expect)(code).toHaveProperty('code');
                        (0, vitest_1.expect)(code).toHaveProperty('display');
                        (0, vitest_1.expect)(typeof code.code).toBe('string');
                        (0, vitest_1.expect)(typeof code.display).toBe('string');
                        (0, vitest_1.expect)(code.code.length).toBeGreaterThan(0);
                        (0, vitest_1.expect)(code.display.length).toBeGreaterThan(0);
                    });
                    j06Codes = results.filter(function (code) { return code.code.startsWith('J06'); });
                    (0, vitest_1.expect)(j06Codes.length).toBeGreaterThan(0);
                    j060 = results.find(function (code) { return code.code === 'J06.0'; });
                    (0, vitest_1.expect)(j060).toBeDefined();
                    (0, vitest_1.expect)(j060 === null || j060 === void 0 ? void 0 : j060.display).toContain('Acute laryngopharyngitis');
                    j069 = results.find(function (code) { return code.code === 'J06.9'; });
                    (0, vitest_1.expect)(j069).toBeDefined();
                    (0, vitest_1.expect)(j069 === null || j069 === void 0 ? void 0 : j069.display).toContain('Acute upper respiratory infection, unspecified');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should find exactly J06.9 code correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, j069;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('J06.9')];
                case 1:
                    results = _a.sent();
                    // Should return results
                    (0, vitest_1.expect)(results).toBeDefined();
                    (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
                    (0, vitest_1.expect)(results.length).toBe(1);
                    j069 = results.find(function (code) { return code.code === 'J06.9'; });
                    (0, vitest_1.expect)(j069).toBeDefined();
                    (0, vitest_1.expect)(j069 === null || j069 === void 0 ? void 0 : j069.display).toContain('Acute upper respiratory infection, unspecified');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should find exactly J06.9 in first place when searching on "respiratory infection"', function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, j069;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('respiratory infection')];
                case 1:
                    results = _a.sent();
                    // Should return results
                    (0, vitest_1.expect)(results).toBeDefined();
                    (0, vitest_1.expect)(Array.isArray(results)).toBe(true);
                    (0, vitest_1.expect)(results.length).toBeGreaterThan(1);
                    j069 = results[0];
                    (0, vitest_1.expect)(j069).toBeDefined();
                    (0, vitest_1.expect)(j069 === null || j069 === void 0 ? void 0 : j069.display).toContain('Acute upper respiratory infection, unspecified');
                    (0, vitest_1.expect)(j069 === null || j069 === void 0 ? void 0 : j069.code).toBe('J06.9');
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should handle seventh character codes correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
        var results, s82821Codes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('S82.821')];
                case 1:
                    results = _a.sent();
                    // S82.821 should NOT be returned (not billable by itself)
                    (0, vitest_1.expect)(results.some(function (code) { return code.code === 'S82.821'; })).toBe(false);
                    // S82.821A (with seventh character) SHOULD be returned
                    (0, vitest_1.expect)(results.some(function (code) { return code.code === 'S82.821A'; })).toBe(true);
                    s82821Codes = results.filter(function (code) { return code.code.startsWith('S82.821'); });
                    (0, vitest_1.expect)(s82821Codes.length).toBeGreaterThan(1);
                    // Check that all variants have seventh characters
                    s82821Codes.forEach(function (code) {
                        (0, vitest_1.expect)(code.code.length).toBe(8); // S82.821 + one character = 8 total
                        (0, vitest_1.expect)(code.code.charAt(7)).toMatch(/[A-Z]/); // Seventh character should be a letter
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should handle W21.89 codes correctly with X padding', function () { return __awaiter(void 0, void 0, void 0, function () {
        var resultsInvalidCode, resultsValidCode, allW2189Results, w2189Codes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('W21.89A')];
                case 1:
                    resultsInvalidCode = _a.sent();
                    (0, vitest_1.expect)(resultsInvalidCode.length).toBe(0);
                    return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('W21.89XA')];
                case 2:
                    resultsValidCode = _a.sent();
                    (0, vitest_1.expect)(resultsValidCode.length).toBe(1);
                    (0, vitest_1.expect)(resultsValidCode[0].code).toBe('W21.89XA');
                    (0, vitest_1.expect)(resultsValidCode[0].display).toContain('Striking against or struck by other sports equipment');
                    return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('W21.89')];
                case 3:
                    allW2189Results = _a.sent();
                    w2189Codes = allW2189Results.filter(function (code) { return code.code.startsWith('W21.89'); });
                    // Should have multiple variants with different seventh characters (A, D, S)
                    (0, vitest_1.expect)(w2189Codes.length).toBeGreaterThan(1);
                    // All should have X in the seventh position and an eighth character
                    w2189Codes.forEach(function (code) {
                        (0, vitest_1.expect)(code.code.length).toBe(8); // W21.89X + one character = 8 total
                        (0, vitest_1.expect)(code.code.charAt(6)).toBe('X'); // Seventh character should be X (padding)
                        (0, vitest_1.expect)(code.code.charAt(7)).toMatch(/[ADS]/); // Eighth character should be A, D, or S
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should handle ICD-10 padding correctly for different code lengths', function () { return __awaiter(void 0, void 0, void 0, function () {
        var w214Results, w214Codes, w2189Results, w2189Codes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('W21.4')];
                case 1:
                    w214Results = _a.sent();
                    w214Codes = w214Results.filter(function (code) { return code.code.startsWith('W21.4') && code.code.length > 5; });
                    (0, vitest_1.expect)(w214Codes.length).toBeGreaterThan(0);
                    w214Codes.forEach(function (code) {
                        (0, vitest_1.expect)(code.code.length).toBe(8); // W21.4XX + one character = 8 total
                        (0, vitest_1.expect)(code.code.substring(5, 7)).toBe('XX'); // Should have XX padding
                        (0, vitest_1.expect)(code.code.charAt(7)).toMatch(/[ADS]/); // Eighth character should be A, D, or S
                    });
                    return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)('W21.89')];
                case 2:
                    w2189Results = _a.sent();
                    w2189Codes = w2189Results.filter(function (code) { return code.code.startsWith('W21.89') && code.code.length > 6; });
                    (0, vitest_1.expect)(w2189Codes.length).toBeGreaterThan(0);
                    w2189Codes.forEach(function (code) {
                        (0, vitest_1.expect)(code.code.length).toBe(8); // W21.89X + one character = 8 total
                        (0, vitest_1.expect)(code.code.charAt(6)).toBe('X'); // Should have X padding
                        (0, vitest_1.expect)(code.code.charAt(7)).toMatch(/[ADS]/); // Eighth character should be A, D, or S
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});

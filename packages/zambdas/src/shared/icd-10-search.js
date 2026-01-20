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
exports.searchIcd10Codes = searchIcd10Codes;
var fs = require("fs");
var xml2js = require("xml2js");
var cachedCodes = null;
function loadAndParseIcd10Data() {
    return __awaiter(this, void 0, void 0, function () {
        function extractCodesFromDiagNode(diagNode, parentSevenChrDef) {
            var _a, _b, _c;
            var code = (_a = diagNode.name) === null || _a === void 0 ? void 0 : _a[0];
            var desc = (_b = diagNode.desc) === null || _b === void 0 ? void 0 : _b[0];
            // Check if this node has its own sevenChrDef
            var currentSevenChrDef;
            if (diagNode.sevenChrDef && ((_c = diagNode.sevenChrDef[0]) === null || _c === void 0 ? void 0 : _c.extension)) {
                currentSevenChrDef = diagNode.sevenChrDef[0].extension.map(function (ext) { return ({
                    char: ext.$.char,
                    desc: ext._,
                }); });
            }
            // Use current sevenChrDef or inherit from parent
            var activeSevenChrDef = currentSevenChrDef || parentSevenChrDef;
            if (code && desc) {
                // Check if this is a leaf node (no child diag nodes)
                var isLeafNode = !diagNode.diag || diagNode.diag.length === 0;
                if (isLeafNode) {
                    if (activeSevenChrDef) {
                        // Generate billable codes with seventh characters
                        activeSevenChrDef.forEach(function (extension) {
                            var trimmedCode = code.trim();
                            var finalCode = trimmedCode;
                            // Pad with "X" so that "seventh" character is in the correct position
                            finalCode = trimmedCode.padEnd(7, 'X');
                            codes.push({
                                code: "".concat(finalCode).concat(extension.char),
                                display: "".concat(desc.trim(), ", ").concat(extension.desc),
                            });
                        });
                    }
                    else {
                        // No seventh character required, this is a billable code as-is
                        codes.push({
                            code: code.trim(),
                            display: desc.trim(),
                        });
                    }
                }
            }
            // Recursively process child nodes, passing down the sevenChrDef
            if (diagNode.diag && Array.isArray(diagNode.diag)) {
                diagNode.diag.forEach(function (childDiag) { return extractCodesFromDiagNode(childDiag, activeSevenChrDef); });
            }
        }
        var xmlFilePath, xmlData, parser, parsed, codes, _i, _a, chapter, _b, _c, section;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (cachedCodes) {
                        return [2 /*return*/, cachedCodes];
                    }
                    console.log('Loading and parsing ICD-10-CM data...');
                    xmlFilePath = './icd-10-cm-tabular/icd10cm_tabular_2026.xml';
                    if (!fs.existsSync(xmlFilePath)) {
                        throw new Error("ICD-10-CM data file not found at ".concat(xmlFilePath));
                    }
                    xmlData = fs.readFileSync(xmlFilePath, 'utf-8');
                    parser = new xml2js.Parser({ explicitArray: true });
                    return [4 /*yield*/, parser.parseStringPromise(xmlData)];
                case 1:
                    parsed = _e.sent();
                    codes = [];
                    // Process all chapters and sections
                    if ((_d = parsed['ICD10CM.tabular']) === null || _d === void 0 ? void 0 : _d.chapter) {
                        for (_i = 0, _a = parsed['ICD10CM.tabular'].chapter; _i < _a.length; _i++) {
                            chapter = _a[_i];
                            if (chapter.section && Array.isArray(chapter.section)) {
                                for (_b = 0, _c = chapter.section; _b < _c.length; _b++) {
                                    section = _c[_b];
                                    if (section.diag && Array.isArray(section.diag)) {
                                        section.diag.forEach(function (diag) { return extractCodesFromDiagNode(diag); });
                                    }
                                }
                            }
                        }
                    }
                    console.log("Loaded ".concat(codes.length, " billable ICD-10-CM codes"));
                    cachedCodes = codes;
                    return [2 /*return*/, codes];
            }
        });
    });
}
function searchIcd10Codes(searchTerm) {
    return __awaiter(this, void 0, void 0, function () {
        var allCodes, normalizedSearch, matches, _i, allCodes_1, code, normalizedCode, normalizedDisplay, score, searchWords, displayWords, matchingWords, _a, searchWords_1, searchWord, _b, displayWords_1, displayWord;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, loadAndParseIcd10Data()];
                case 1:
                    allCodes = _c.sent();
                    if (!searchTerm || searchTerm.trim().length === 0) {
                        return [2 /*return*/, []];
                    }
                    normalizedSearch = searchTerm.toLowerCase().trim();
                    matches = [];
                    for (_i = 0, allCodes_1 = allCodes; _i < allCodes_1.length; _i++) {
                        code = allCodes_1[_i];
                        normalizedCode = code.code.toLowerCase();
                        normalizedDisplay = code.display.toLowerCase();
                        score = 0;
                        // Exact code match (highest priority)
                        if (normalizedCode === normalizedSearch) {
                            score = 1000;
                        }
                        // Code starts with search term
                        else if (normalizedCode.startsWith(normalizedSearch)) {
                            score = 900;
                        }
                        // Code contains search term
                        else if (normalizedCode.includes(normalizedSearch)) {
                            score = 800;
                        }
                        // Exact display match
                        else if (normalizedDisplay === normalizedSearch) {
                            score = 700;
                        }
                        // Display starts with search term
                        else if (normalizedDisplay.startsWith(normalizedSearch)) {
                            score = 600;
                        }
                        // Display contains search term
                        else if (normalizedDisplay.includes(normalizedSearch)) {
                            score = 500;
                        }
                        // Fuzzy match: display contains all words from search term
                        else {
                            searchWords = normalizedSearch.split(/\s+/).filter(function (word) { return word.length > 0; });
                            displayWords = normalizedDisplay.split(/\s+/);
                            matchingWords = 0;
                            for (_a = 0, searchWords_1 = searchWords; _a < searchWords_1.length; _a++) {
                                searchWord = searchWords_1[_a];
                                for (_b = 0, displayWords_1 = displayWords; _b < displayWords_1.length; _b++) {
                                    displayWord = displayWords_1[_b];
                                    if (displayWord.includes(searchWord)) {
                                        matchingWords++;
                                        break;
                                    }
                                }
                            }
                            if (matchingWords === searchWords.length) {
                                score = 400;
                            }
                            else if (matchingWords > 0) {
                                score = 200 + (matchingWords / searchWords.length) * 100;
                            }
                        }
                        if (score > 0) {
                            matches.push({ code: code, score: score });
                        }
                    }
                    // Sort by score (descending) and limit results
                    matches.sort(function (a, b) { return b.score - a.score; });
                    return [2 /*return*/, matches.slice(0, 100).map(function (match) { return match.code; })];
            }
        });
    });
}

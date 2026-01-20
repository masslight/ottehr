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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'icd-search';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, search, sabs, radiologyOnly, apiKey, responseCodes, codes, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets, search = validatedParameters.search, sabs = validatedParameters.sabs, radiologyOnly = validatedParameters.radiologyOnly;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                apiKey = (0, utils_1.getSecret)(utils_1.SecretsKeys.NLM_API_KEY, secrets);
                if (!apiKey) {
                    throw utils_1.MISSING_NLM_API_KEY_ERROR;
                }
                responseCodes = void 0;
                if (!(sabs === 'CPT')) return [3 /*break*/, 2];
                return [4 /*yield*/, Promise.all([
                        // fetching both NAME and CODE search results in parallel
                        searchTerminology(apiKey, search, 'HCPCS', 'NAME', radiologyOnly),
                        searchTerminology(apiKey, search, 'HCPCS', 'CODE', radiologyOnly),
                        searchTerminology(apiKey, search, 'HCPT', 'NAME', radiologyOnly),
                        searchTerminology(apiKey, search, 'HCPT', 'CODE', radiologyOnly),
                    ])];
            case 1:
                responseCodes = _a.sent();
                return [3 /*break*/, 5];
            case 2:
                if (!(sabs === 'ICD10CM')) return [3 /*break*/, 4];
                return [4 /*yield*/, Promise.all([
                        // fetching both NAME and CODE search results in parallel
                        searchTerminology(apiKey, search, sabs, 'NAME', radiologyOnly),
                        searchTerminology(apiKey, search, sabs, 'CODE', radiologyOnly),
                    ])];
            case 3:
                responseCodes = _a.sent();
                return [3 /*break*/, 5];
            case 4: throw new Error("Unsupported sabs value: ".concat(sabs, ". Supported values are 'ICD10CM' and 'CPT'."));
            case 5:
                codes = responseCodes
                    .flatMap(function (result) { return result.codes; }) // Flatten the array of arrays into a single array and map to codes.
                    .filter(function (codeValues, index, self) { return index === self.findIndex(function (t) { return t.code === codeValues.code; }); }) // Remove duplicates based on code
                    .sort(function (a, b) { return a.code.localeCompare(b.code); });
                response = {
                    codes: codes,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('ehr-icd-search', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
var searchTerminology = function (apiKey_1, search_1, sabs_1, codeOrName_1) {
    var args_1 = [];
    for (var _i = 4; _i < arguments.length; _i++) {
        args_1[_i - 4] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([apiKey_1, search_1, sabs_1, codeOrName_1], args_1, true), void 0, function (apiKey, search, sabs, codeOrName, radiologyOnly) {
        var results, encodedSearchString, baseQueryParams, completeQueryParams, urlToFetch, icdResponse, icdResponseBody, error_2;
        if (radiologyOnly === void 0) { radiologyOnly = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = { codes: [] };
                    encodedSearchString = encodeURIComponent(search);
                    baseQueryParams = "apiKey=".concat(apiKey, "&pageSize=50&returnIdType=code&inputType=sourceUi&string=").concat(encodedSearchString, "&sabs=").concat(sabs);
                    if (codeOrName === 'NAME') {
                        completeQueryParams = "".concat(baseQueryParams, "&searchType=normalizedWords&partialSearch=true");
                    }
                    else {
                        // codeOrName === 'CODE'
                        completeQueryParams = "".concat(baseQueryParams, "&searchType=rightTruncation&partialSearch=true");
                    }
                    urlToFetch = "https://uts-ws.nlm.nih.gov/rest/search/current?".concat(completeQueryParams);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch(urlToFetch)];
                case 2:
                    icdResponse = _a.sent();
                    if (!icdResponse.ok) {
                        throw new Error(icdResponse.statusText);
                    }
                    return [4 /*yield*/, icdResponse.json()];
                case 3:
                    icdResponseBody = (_a.sent());
                    results.codes = icdResponseBody.result.results.map(function (entry) { return ({
                        code: entry.ui,
                        display: entry.name,
                    }); });
                    if ((sabs === 'HCPCS' || sabs === 'HCPT') && radiologyOnly) {
                        results.codes = results.codes.filter(function (code) {
                            return code.code >= '7000' && code.code <= '7999'; // Filter codes to only include ICD-10 codes in the radiology range.
                        });
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error('Error while trying to request NLM ICD10 search endpoint', error_2, JSON.stringify(error_2));
                    throw new Error('Error while trying to get ICD-10 codes');
                case 5: return [2 /*return*/, results];
            }
        });
    });
};

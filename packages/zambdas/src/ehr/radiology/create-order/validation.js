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
exports.validateSecrets = exports.validateInput = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var icd_10_search_1 = require("../../../shared/icd-10-search");
var validateInput = function (input, secrets, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedBody, callerAccessToken;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, validateBody(input, secrets, oystehr)];
            case 1:
                validatedBody = _a.sent();
                callerAccessToken = input.headers.Authorization.replace('Bearer ', '');
                if (callerAccessToken == null) {
                    throw new Error('Caller access token is required');
                }
                return [2 /*return*/, {
                        body: validatedBody,
                        callerAccessToken: callerAccessToken,
                    }];
        }
    });
}); };
exports.validateInput = validateInput;
var validateBody = function (input, secrets, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, diagnosisCode, cptCode, encounterId, stat, clinicalHistory, diagnosis, cpt, encounter;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = (0, shared_1.validateJsonBody)(input), diagnosisCode = _a.diagnosisCode, cptCode = _a.cptCode, encounterId = _a.encounterId, stat = _a.stat, clinicalHistory = _a.clinicalHistory;
                return [4 /*yield*/, validateICD10Code(diagnosisCode)];
            case 1:
                diagnosis = _b.sent();
                return [4 /*yield*/, validateCPTCode(cptCode, secrets)];
            case 2:
                cpt = _b.sent();
                return [4 /*yield*/, fetchEncounter(encounterId, oystehr)];
            case 3:
                encounter = _b.sent();
                if (typeof stat !== 'boolean') {
                    throw new Error('Stat is required and must be a boolean');
                }
                if (!clinicalHistory || typeof clinicalHistory !== 'string') {
                    throw new Error('Clinical history is required and must be a string');
                }
                if (clinicalHistory.length > 255) {
                    throw new Error('Clinical history must be 255 characters or less');
                }
                return [2 /*return*/, {
                        diagnosis: diagnosis,
                        cpt: cpt,
                        encounter: encounter,
                        stat: stat,
                        clinicalHistory: clinicalHistory,
                    }];
        }
    });
}); };
var validateSecrets = function (secrets) {
    if (!secrets) {
        throw new Error('Secrets are required');
    }
    var ADVAPACS_CLIENT_ID = secrets.ADVAPACS_CLIENT_ID, ADVAPACS_CLIENT_SECRET = secrets.ADVAPACS_CLIENT_SECRET, AUTH0_ENDPOINT = secrets.AUTH0_ENDPOINT, AUTH0_CLIENT = secrets.AUTH0_CLIENT, AUTH0_SECRET = secrets.AUTH0_SECRET, AUTH0_AUDIENCE = secrets.AUTH0_AUDIENCE, NLM_API_KEY = secrets.NLM_API_KEY, FHIR_API = secrets.FHIR_API, PROJECT_API = secrets.PROJECT_API, ENVIRONMENT = secrets.ENVIRONMENT;
    if (!ADVAPACS_CLIENT_ID ||
        !ADVAPACS_CLIENT_SECRET ||
        !AUTH0_ENDPOINT ||
        !AUTH0_CLIENT ||
        !AUTH0_SECRET ||
        !AUTH0_AUDIENCE ||
        !NLM_API_KEY ||
        !FHIR_API ||
        !PROJECT_API ||
        !ENVIRONMENT) {
        throw new Error('Missing required secrets');
    }
    return {
        ADVAPACS_CLIENT_ID: ADVAPACS_CLIENT_ID,
        ADVAPACS_CLIENT_SECRET: ADVAPACS_CLIENT_SECRET,
        AUTH0_ENDPOINT: AUTH0_ENDPOINT,
        AUTH0_CLIENT: AUTH0_CLIENT,
        AUTH0_SECRET: AUTH0_SECRET,
        AUTH0_AUDIENCE: AUTH0_AUDIENCE,
        NLM_API_KEY: NLM_API_KEY,
        FHIR_API: FHIR_API,
        PROJECT_API: PROJECT_API,
        ENVIRONMENT: ENVIRONMENT,
    };
};
exports.validateSecrets = validateSecrets;
var validateICD10Code = function (diagnosisCode) { return __awaiter(void 0, void 0, void 0, function () {
    var searchResult, dx;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                // validate diagnosisCode is a string
                if (diagnosisCode == null || typeof diagnosisCode !== 'string') {
                    throw new Error('diagnosisCode is required and must be a string');
                }
                return [4 /*yield*/, (0, icd_10_search_1.searchIcd10Codes)(diagnosisCode)];
            case 1:
                searchResult = _a.sent();
                if (searchResult.length < 1) {
                    throw new Error('ICD-10 code is invalid');
                }
                else if (searchResult.length > 1) {
                    throw new Error('ICD-10 code is ambiguous');
                }
                dx = {
                    code: diagnosisCode,
                    display: searchResult[0].display,
                    system: utils_1.CODE_SYSTEM_ICD_10,
                };
                console.log('ICD-10 code validated:', dx);
                return [2 /*return*/, dx];
        }
    });
}); };
var validateCPTCode = function (cptCode, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var cptResponseBody, apiKey, icdResponse, _a, cpt;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                cptResponseBody = null;
                // CPT codes are at least 5 digits long
                if (cptCode == null || typeof cptCode !== 'string' || cptCode.length < 5) {
                    throw new Error('cptCode is required and must be a string of length 5 or more');
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                apiKey = (0, utils_1.getSecret)(utils_1.SecretsKeys.NLM_API_KEY, secrets);
                return [4 /*yield*/, fetch("https://uts-ws.nlm.nih.gov/rest/search/current?apiKey=".concat(apiKey, "&pageSize=50&returnIdType=code&inputType=sourceUi&string=").concat(cptCode, "&sabs=CPT&searchType=exact"))];
            case 2:
                icdResponse = _b.sent();
                if (!icdResponse.ok) {
                    throw new Error(icdResponse.statusText);
                }
                return [4 /*yield*/, icdResponse.json()];
            case 3:
                cptResponseBody = (_b.sent());
                return [3 /*break*/, 5];
            case 4:
                _a = _b.sent();
                throw new Error('Error while trying to validate CPT code');
            case 5:
                if (cptResponseBody.result.recCount < 1) {
                    throw new Error('CPT code is invalid');
                }
                else if (cptResponseBody.result.recCount > 1) {
                    throw new Error('CPT code is ambiguous');
                }
                cpt = {
                    code: cptCode,
                    display: cptResponseBody.result.results[0].name,
                    system: utils_1.CODE_SYSTEM_ICD_10,
                };
                console.log('CPT code validated:', cpt);
                return [2 /*return*/, cpt];
        }
    });
}); };
var fetchEncounter = function (encounterId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (encounterId == null || typeof encounterId !== 'string') {
                    throw new Error('Encounter ID is required and must be a string.');
                }
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Encounter',
                        id: encounterId,
                    })];
            case 2: return [2 /*return*/, _b.sent()];
            case 3:
                _a = _b.sent();
                throw new Error('Error while trying to fetch encounter');
            case 4: return [2 /*return*/];
        }
    });
}); };

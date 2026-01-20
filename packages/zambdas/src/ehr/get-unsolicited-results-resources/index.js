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
var shared_1 = require("../../shared");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'get-unsolicited-results-resources';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, requestType, secrets, oystehr, response, _a, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 16, , 17]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                requestType = validatedParameters.requestType, secrets = validatedParameters.secrets;
                console.log('requestType: ', requestType);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                response = void 0;
                _a = requestType;
                switch (_a) {
                    case utils_1.UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_ICON: return [3 /*break*/, 2];
                    case utils_1.UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_TASKS: return [3 /*break*/, 4];
                    case utils_1.UnsolicitedResultsRequestType.MATCH_UNSOLICITED_RESULTS: return [3 /*break*/, 6];
                    case utils_1.UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_RELATED_REQUESTS: return [3 /*break*/, 8];
                    case utils_1.UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_DETAIL: return [3 /*break*/, 10];
                    case utils_1.UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_PATIENT_LIST: return [3 /*break*/, 12];
                }
                return [3 /*break*/, 14];
            case 2:
                console.log('handling unsolicited-results-icon request');
                return [4 /*yield*/, (0, helpers_1.handleIconResourceRequest)(oystehr)];
            case 3:
                response = _b.sent();
                return [3 /*break*/, 15];
            case 4:
                console.log('handling get-unsolicited-results-tasks request');
                return [4 /*yield*/, (0, helpers_1.handleGetTasks)(oystehr)];
            case 5:
                response = _b.sent();
                return [3 /*break*/, 15];
            case 6:
                console.log('handling match-unsolicited-result request');
                return [4 /*yield*/, (0, helpers_1.handleUnsolicitedRequestMatch)(oystehr, validatedParameters.diagnosticReportId)];
            case 7:
                response = _b.sent();
                return [3 /*break*/, 15];
            case 8:
                console.log('handling get-unsolicited-result-related-requests request');
                return [4 /*yield*/, (0, helpers_1.handleGetPossibleRelatedRequestsToUnsolicitedResult)(oystehr, validatedParameters.diagnosticReportId, validatedParameters.patientId)];
            case 9:
                response = _b.sent();
                return [3 /*break*/, 15];
            case 10:
                console.log('handling unsolicited-results-detail request');
                return [4 /*yield*/, (0, helpers_1.handleUnsolicitedResultDetailRequest)(oystehr, validatedParameters.diagnosticReportId, m2mToken)];
            case 11:
                response = _b.sent();
                return [3 /*break*/, 15];
            case 12:
                console.log('handling unsolicited-results-patient-list request');
                return [4 /*yield*/, (0, helpers_1.handleUnsolicitedResultPatientListRequest)(oystehr, validatedParameters.patientId)];
            case 13:
                response = _b.sent();
                return [3 /*break*/, 15];
            case 14:
                {
                    throw Error('request type invalid');
                }
                _b.label = 15;
            case 15: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify(response),
                }];
            case 16:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 17: return [2 /*return*/];
        }
    });
}); });

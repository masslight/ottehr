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
exports.performEffect = exports.complexValidation = exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var ai_complete_questionnaire_response_1 = require("../../shared/ai-complete-questionnaire-response");
var helpers_1 = require("../../shared/helpers");
var helpers_2 = require("../../shared/practitioner/helpers");
var helpers_3 = require("./helpers/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'change-in-person-visit-status';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, validatedData, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Created Oystehr client');
                return [4 /*yield*/, (0, exports.complexValidation)(oystehr, validatedParameters)];
            case 2:
                validatedData = _a.sent();
                return [4 /*yield*/, (0, exports.performEffect)(oystehr, validatedData)];
            case 3:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                console.error('Stringified error: ' + JSON.stringify(error_1));
                console.error('Error: ' + error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
var complexValidation = function (oystehr, params) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterId, userToken, updatedStatus, secrets, visitResources, encounter, appointment, user;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounterId = params.encounterId, userToken = params.userToken, updatedStatus = params.updatedStatus, secrets = params.secrets;
                return [4 /*yield*/, (0, helpers_2.getVisitResources)(oystehr, encounterId)];
            case 1:
                visitResources = _a.sent();
                if (!visitResources) {
                    throw new Error("Visit resources are not properly defined for encounter ".concat(encounterId));
                }
                encounter = visitResources.encounter, appointment = visitResources.appointment;
                if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id))
                    throw new Error('Encounter not found');
                return [4 /*yield*/, (0, utils_1.userMe)(userToken, secrets)];
            case 2:
                user = _a.sent();
                if (!user) {
                    throw new Error('user unexpectedly not found');
                }
                return [2 /*return*/, {
                        encounter: encounter,
                        appointment: appointment,
                        oystehr: oystehr,
                        user: user,
                        updatedStatus: updatedStatus,
                    }];
        }
    });
}); };
exports.complexValidation = complexValidation;
var performEffect = function (oystehr, validatedData) { return __awaiter(void 0, void 0, void 0, function () {
    var encounter, appointment, user, updatedStatus;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounter = validatedData.encounter, appointment = validatedData.appointment, user = validatedData.user, updatedStatus = validatedData.updatedStatus;
                return [4 /*yield*/, (0, helpers_3.changeInPersonVisitStatusIfPossible)(oystehr, { encounter: encounter, appointment: appointment }, user, updatedStatus)];
            case 1:
                _a.sent();
                if (!(updatedStatus === 'ready for provider' && encounter.id)) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, ai_complete_questionnaire_response_1.completeInProgressAiQuestionnaireResponseIfPossible)(oystehr, encounter.id)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3: return [2 /*return*/, {}];
        }
    });
}); };
exports.performEffect = performEffect;

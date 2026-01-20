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
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var helpers_2 = require("./helpers");
var ZAMBDA_NAME = 'save-followup-encounter';
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var encounterDetails = JSON.parse(input.body).encounterDetails;
    if (!encounterDetails.patientId || !encounterDetails.followupType) {
        throw new Error("Missing required input param(s): ".concat(!encounterDetails.patientId ? 'patientId' : '', " ").concat(!encounterDetails.followupType ? 'followupType' : ''));
    }
    if (!utils_1.FOLLOWUP_TYPES.includes(encounterDetails.followupType)) {
        throw new Error("followupType must be one of the following ".concat(utils_1.FOLLOWUP_TYPES));
    }
    if (!input.secrets) {
        throw new Error('No secrets provided');
    }
    return {
        secrets: input.secrets,
        encounterDetails: encounterDetails,
    };
}
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, secrets, encounterDetails, oystehr, encounter, response, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                console.log("Input: ".concat(JSON.stringify(input)));
                _a = validateRequestParameters(input), secrets = _a.secrets, encounterDetails = _a.encounterDetails;
                console.log('updated encounter details', encounterDetails);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                encounter = void 0;
                if (!encounterDetails.encounterId) return [3 /*break*/, 3];
                console.log('updating a follow up encounter', encounterDetails.encounterId);
                return [4 /*yield*/, (0, helpers_2.updateEncounterResource)(encounterDetails.encounterId, encounterDetails, oystehr)];
            case 2:
                encounter = _b.sent();
                return [3 /*break*/, 5];
            case 3:
                console.log('creating a followup encounter for patient', encounterDetails.patientId);
                return [4 /*yield*/, (0, helpers_2.createEncounterResource)(encounterDetails, oystehr)];
            case 4:
                encounter = _b.sent();
                _b.label = 5;
            case 5:
                if (encounter.id === undefined) {
                    throw new Error('Encounter ID is undefined after creation or update');
                }
                response = {
                    encounterId: encounter.id,
                };
                return [2 /*return*/, {
                        body: JSON.stringify(response),
                        statusCode: 200,
                    }];
            case 6:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-save-followup-encounter', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });

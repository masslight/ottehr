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
var ai_1 = require("../../shared/ai");
var validateRequestParameters_1 = require("./validateRequestParameters");
exports.index = (0, shared_1.wrapHandler)('recommend-billing-suggestions', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, diagnoses, billing, secrets, prompt_1, aiResponseString, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 4]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                diagnoses = validatedParameters.diagnoses, billing = validatedParameters.billing, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                prompt_1 = 'Take on a persona of a medical biller and coder looking for errors that might cause a claim to be rejected in an urgent care setting. Review the following claim based on provided ICD and CPT codes and provide a very concise single sentence explaining any possible issues or say "No coding changes." Do not include markdown.';
                if (diagnoses && diagnoses.length > 0) {
                    prompt_1 += " ICD: ".concat(diagnoses
                        .map(function (diagnosis) { return "".concat(diagnosis.code, " (").concat(diagnosis.isPrimary ? 'primary' : 'secondary', ")"); })
                        .join(', '), ".");
                }
                if (billing && billing.length > 0) {
                    prompt_1 += " CPT: ".concat(billing.map(function (code) { return code.code; }).join(', '), ".");
                }
                return [4 /*yield*/, (0, ai_1.invokeChatbot)([{ role: 'user', content: prompt_1 }], secrets)];
            case 1:
                aiResponseString = (_a.sent()).content.toString();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(aiResponseString),
                    }];
            case 2:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [4 /*yield*/, (0, shared_1.topLevelCatch)('recommend-billing-suggestions', error_1, ENVIRONMENT)];
            case 3:
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 500,
                        body: JSON.stringify({ message: "Error recommending billing suggestions: ".concat(error_1) }),
                    }];
            case 4: return [2 /*return*/];
        }
    });
}); });

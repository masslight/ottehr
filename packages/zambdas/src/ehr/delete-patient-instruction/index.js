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
var helpers_1 = require("../../shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'delete-patient-instructions';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, instructionId, secrets, userToken, oystehr, oystehrCurrentUser, isProviderInstruction, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                console.log("Input: ".concat(JSON.stringify(input)));
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), instructionId = _a.instructionId, secrets = _a.secrets, userToken = _a.userToken;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                oystehrCurrentUser = (0, helpers_1.createOystehrClient)(userToken, secrets);
                return [4 /*yield*/, checkIfBelongsToCurrentProvider(oystehrCurrentUser, instructionId)];
            case 2:
                isProviderInstruction = _b.sent();
                if (!isProviderInstruction)
                    throw new Error('Instruction deletion failed. Instruction does not belongs to provider');
                return [4 /*yield*/, deleteCommunication(oystehr, instructionId)];
            case 3:
                _b.sent();
                return [2 /*return*/, {
                        body: JSON.stringify({
                            message: "Successfully deleted patient instruction: ".concat(instructionId),
                        }),
                        statusCode: 200,
                    }];
            case 4:
                error_1 = _b.sent();
                console.log(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('delete-patient-instruction', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
function deleteCommunication(oystehr, id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.delete({ resourceType: 'Communication', id: id })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function checkIfBelongsToCurrentProvider(oystehr, resourceId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, resource, myUser;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Promise.all([
                        oystehr.fhir.get({ resourceType: 'Communication', id: resourceId }),
                        oystehr.user.me(),
                    ])];
                case 1:
                    _a = _c.sent(), resource = _a[0], myUser = _a[1];
                    return [2 /*return*/, ((_b = resource.sender) === null || _b === void 0 ? void 0 : _b.reference) === myUser.profile];
            }
        });
    });
}

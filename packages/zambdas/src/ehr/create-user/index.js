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
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('create-user', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedInput, email, applicationID, firstName, lastName, secrets, oystehr, roles, staffRole, userId, user, error_1, response, error_2, ENVIRONMENT;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 7, , 8]);
                validatedInput = (0, validateRequestParameters_1.validateRequestParameters)(input);
                email = validatedInput.email, applicationID = validatedInput.applicationID, firstName = validatedInput.firstName, lastName = validatedInput.lastName, secrets = validatedInput.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _c.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, oystehr.role.list()];
            case 2:
                roles = _c.sent();
                staffRole = roles.find(function (role) { return role.name === 'Staff'; });
                if (!staffRole) {
                    throw {
                        code: utils_1.APIErrorCode.INVALID_INPUT,
                        message: 'Staff role not found',
                        statusCode: 500,
                    };
                }
                userId = void 0;
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, oystehr.user.invite({
                        email: email,
                        resource: {
                            resourceType: 'Practitioner',
                            name: [
                                {
                                    family: lastName,
                                    given: [firstName],
                                },
                            ],
                        },
                        applicationId: applicationID,
                        roles: [staffRole.id],
                    })];
            case 4:
                user = _c.sent();
                userId = user.id;
                return [3 /*break*/, 6];
            case 5:
                error_1 = _c.sent();
                if ((error_1 === null || error_1 === void 0 ? void 0 : error_1.code) === '4004' || ((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _a === void 0 ? void 0 : _a.includes('already a member'))) {
                    throw __assign(__assign({}, utils_1.USER_ALREADY_EXISTS_ERROR), { statusCode: 409 });
                }
                throw {
                    code: utils_1.APIErrorCode.INVALID_INPUT,
                    message: "Failed to create user: ".concat((_b = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) !== null && _b !== void 0 ? _b : 'Unknown error'),
                    statusCode: 400,
                };
            case 6:
                response = {
                    userID: userId,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 7:
                error_2 = _c.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-user', error_2, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });

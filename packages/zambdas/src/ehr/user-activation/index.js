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
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('user-activation', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, userId, mode, secrets, PROJECT_API, oystehr, fetchClient, user, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 8, , 9]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                userId = validatedParameters.userId, mode = validatedParameters.mode, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, secrets)];
            case 1:
                oystehrToken = _a.sent();
                PROJECT_API = (0, utils_1.getSecret)('PROJECT_API', secrets);
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                fetchClient = (0, utils_1.createFetchClientWithOystehrAuth)({ authToken: oystehrToken });
                return [4 /*yield*/, oystehr.user.get({ id: userId })];
            case 2:
                user = _a.sent();
                console.log("user before ".concat(mode, "ing: "), JSON.stringify(user));
                response = {};
                if (!(mode === 'activate')) return [3 /*break*/, 4];
                return [4 /*yield*/, activateUser(user, fetchClient, PROJECT_API)];
            case 3:
                response = _a.sent();
                return [3 /*break*/, 6];
            case 4:
                if (!(mode === 'deactivate')) return [3 /*break*/, 6];
                return [4 /*yield*/, deactivateUser(user, fetchClient, PROJECT_API)];
            case 5:
                response = _a.sent();
                _a.label = 6;
            case 6: return [4 /*yield*/, oystehr.user.get({ id: userId })];
            case 7:
                user = _a.sent();
                console.log("user after ".concat(mode, "ing: "), JSON.stringify(user));
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-user-activation', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
function deactivateUser(user, client, projectApi) {
    return __awaiter(this, void 0, void 0, function () {
        var userRoles, userRoleIds, userInactive, existingRoles, error_2, inactiveRole, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userRoles = user.roles;
                    userRoleIds = userRoles.map(function (role) { return role.id; });
                    userInactive = userRoles.find(function (role) { return role.name === 'Inactive'; });
                    if (!!userInactive) return [3 /*break*/, 9];
                    console.log('searching for Inactive role in the the project');
                    existingRoles = void 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.oystehrFetch('GET', "".concat(projectApi, "/iam/role"))];
                case 2:
                    existingRoles = _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error(error_2);
                    throw new Error('Error searching for existing roles');
                case 4:
                    inactiveRole = existingRoles.find(function (role) { return role.name === 'Inactive'; });
                    if (!inactiveRole) {
                        throw new Error('Error searching for Inactive role');
                    }
                    console.log('deactivating user');
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, client.oystehrFetch('PATCH', "".concat(projectApi, "/user/").concat(user.id), {
                            roles: __spreadArray(__spreadArray([], userRoleIds, true), [inactiveRole.id], false),
                        })];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 8];
                case 7:
                    error_3 = _a.sent();
                    console.error(error_3);
                    throw new Error('Failed to deactivate user');
                case 8: return [3 /*break*/, 10];
                case 9: return [2 /*return*/, { message: 'User is already deactivated.' }];
                case 10: return [2 /*return*/, { message: 'User successfully deactivated.' }];
            }
        });
    });
}
function activateUser(user, client, projectApi) {
    return __awaiter(this, void 0, void 0, function () {
        var userRoles, userInactive, userRoleIds, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    userRoles = user.roles;
                    userInactive = userRoles.find(function (role) { return role.name === 'Inactive'; });
                    if (!userInactive) return [3 /*break*/, 5];
                    userRoleIds = userRoles.filter(function (role) { return role.id !== userInactive.id; }).map(function (role) { return role.id; });
                    console.log('activating user');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, client.oystehrFetch('PATCH', "".concat(projectApi, "/user/").concat(user.id), {
                            roles: __spreadArray([], userRoleIds, true),
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    console.error(error_4);
                    throw new Error('Failed to activate user');
                case 4: return [3 /*break*/, 6];
                case 5: return [2 /*return*/, { message: 'User is already activated.' }];
                case 6: return [2 /*return*/, { message: 'User successfully activated.' }];
            }
        });
    });
}

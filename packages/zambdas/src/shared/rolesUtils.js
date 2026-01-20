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
exports.filterIdsOnlyToTheseRoles = exports.updateUserRoles = exports.allNonPatientRoles = void 0;
exports.getRoleId = getRoleId;
var utils_1 = require("utils");
var shared_1 = require("../shared/");
function getRoleId(roleName, token, projectApiUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, existingRolesResponse, existingRoles, roleId;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    headers = {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        Authorization: "Bearer ".concat(token),
                    };
                    return [4 /*yield*/, fetch("".concat(projectApiUrl, "/iam/role"), {
                            method: 'GET',
                            headers: headers,
                        })];
                case 1:
                    existingRolesResponse = _b.sent();
                    return [4 /*yield*/, existingRolesResponse.json()];
                case 2:
                    existingRoles = _b.sent();
                    roleId = (_a = existingRoles.find(function (existingRole) { return existingRole.name === roleName; })) === null || _a === void 0 ? void 0 : _a.id;
                    if (!roleId) {
                        throw new Error('Role not found');
                    }
                    return [2 /*return*/, roleId];
            }
        });
    });
}
exports.allNonPatientRoles = [
    { name: utils_1.RoleType.Administrator, accessPolicy: shared_1.ADMINISTRATOR_RULES },
    { name: utils_1.RoleType.CustomerSupport, accessPolicy: shared_1.CUSTOMER_SUPPORT_RULES },
    { name: utils_1.RoleType.FrontDesk, accessPolicy: shared_1.FRONT_DESK_RULES },
    { name: utils_1.RoleType.Inactive, accessPolicy: shared_1.INACTIVE_RULES },
    { name: utils_1.RoleType.Manager, accessPolicy: shared_1.MANAGER_RULES },
    { name: utils_1.RoleType.Prescriber, accessPolicy: shared_1.PRESCRIBER_RULES },
    { name: utils_1.RoleType.Provider, accessPolicy: shared_1.PROVIDER_RULES },
    { name: utils_1.RoleType.Staff, accessPolicy: shared_1.STAFF_RULES },
];
var updateUserRoles = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var existingRoles, _a, allRoles, _loop_1, _i, allNonPatientRoles_1, role;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('Updating user roles.');
                console.log('searching for existing roles for the project');
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, oystehr.role.list()];
            case 2:
                existingRoles = _b.sent();
                return [3 /*break*/, 4];
            case 3:
                _a = _b.sent();
                throw new Error('Error searching for existing roles');
            case 4:
                console.log('existingRoles: ', existingRoles);
                allRoles = exports.allNonPatientRoles.map(function (role) {
                    var _a;
                    return (_a = {}, _a[role.name] = undefined, _a);
                });
                _loop_1 = function (role) {
                    var roleName, foundRole, roleResult, err_1, err_2;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                roleName = role.name;
                                foundRole = void 0;
                                if (existingRoles.length > 0) {
                                    foundRole = existingRoles.find(function (existingRole) { return existingRole.name === roleName; });
                                }
                                roleResult = void 0;
                                if (!foundRole) return [3 /*break*/, 5];
                                console.log("".concat(roleName, " role found: "), foundRole);
                                _c.label = 1;
                            case 1:
                                _c.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, oystehr.role.update({
                                        roleId: foundRole.id,
                                        accessPolicy: role.accessPolicy,
                                    })];
                            case 2:
                                roleResult = _c.sent();
                                console.log("".concat(roleName, " role accessPolicy patched: "), roleResult, JSON.stringify(roleResult.accessPolicy));
                                return [3 /*break*/, 4];
                            case 3:
                                err_1 = _c.sent();
                                console.error(err_1);
                                throw new Error("Failed to patch role ".concat(roleName));
                            case 4: return [3 /*break*/, 9];
                            case 5:
                                console.log("creating ".concat(roleName, " role"));
                                _c.label = 6;
                            case 6:
                                _c.trys.push([6, 8, , 9]);
                                return [4 /*yield*/, oystehr.role.create({ name: roleName, accessPolicy: role.accessPolicy })];
                            case 7:
                                roleResult = _c.sent();
                                console.log("".concat(roleName, " role: "), roleResult, JSON.stringify(roleResult.accessPolicy));
                                return [3 /*break*/, 9];
                            case 8:
                                err_2 = _c.sent();
                                console.error(err_2);
                                throw new Error("Failed to create role ".concat(roleName));
                            case 9:
                                allRoles[roleResult.name] = roleResult.id;
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, allNonPatientRoles_1 = exports.allNonPatientRoles;
                _b.label = 5;
            case 5:
                if (!(_i < allNonPatientRoles_1.length)) return [3 /*break*/, 8];
                role = allNonPatientRoles_1[_i];
                return [5 /*yield**/, _loop_1(role)];
            case 6:
                _b.sent();
                _b.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 5];
            case 8: return [2 /*return*/, allRoles];
        }
    });
}); };
exports.updateUserRoles = updateUserRoles;
var filterIdsOnlyToTheseRoles = function (roles, allowedRoles) {
    return Object.entries(roles)
        .map(function (_a) {
        var roleName = _a[0], id = _a[1];
        if (id && allowedRoles.includes(roleName)) {
            return id;
        }
        return undefined;
    })
        .filter(function (roleId) { return roleId !== undefined; });
};
exports.filterIdsOnlyToTheseRoles = filterIdsOnlyToTheseRoles;

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
exports.TEST_EMPLOYEE_2 = exports.TEST_EMPLOYEE_1_UPDATED_INFO = exports.TEST_EMPLOYEE_1 = exports.testEmployeeGivenNamePattern = void 0;
exports.invitationParamsForEmployee = invitationParamsForEmployee;
exports.inviteTestEmployeeUser = inviteTestEmployeeUser;
exports.removeUser = removeUser;
// cSpell:ignore ASSISTA, CISW, CMSW
var node_crypto_1 = require("node:crypto");
var utils_1 = require("utils");
var testEmployeeUsernamePattern = 'e2e-employee-';
exports.testEmployeeGivenNamePattern = 'employeeTestE2E';
exports.TEST_EMPLOYEE_1 = {
    givenName: "".concat(exports.testEmployeeGivenNamePattern, "1"),
    middleName: 'middle',
    telecomPhone: '0734324300',
    npi: '1111111111',
    credentials: 'credentials',
    roles: [utils_1.RoleType.Provider],
    qualification: [
        {
            code: 'CISW',
            state: 'AR',
            number: '12345',
            date: '2026-04-23',
            active: true,
        },
        {
            code: 'PHARMACY-ASSISTA',
            state: 'AK',
            number: '54321',
            date: '2026-04-23',
            active: true,
        },
    ],
};
exports.TEST_EMPLOYEE_1_UPDATED_INFO = {
    givenName: "new ".concat(exports.testEmployeeGivenNamePattern),
    middleName: 'new middle',
    telecomPhone: '0734324301',
    credentials: 'new credentials',
    npi: '2222222222',
    roles: [utils_1.RoleType.Provider, utils_1.RoleType.Staff],
    qualification: [
        {
            code: 'CISW',
            state: 'AR',
            number: '12345',
            date: '2026-04-23',
            active: true,
        },
        {
            code: 'PHARMACY-ASSISTA',
            state: 'AK',
            number: '54321',
            date: '2026-04-23',
            active: true,
        },
        {
            code: 'CMSW',
            state: 'CA',
            number: '15243',
            date: '2026-04-23',
            active: true,
        },
    ],
};
exports.TEST_EMPLOYEE_2 = {
    givenName: "".concat(exports.testEmployeeGivenNamePattern, "2"),
    middleName: 'middle2',
    telecomPhone: '0734324300',
    npi: '1111111111',
    credentials: 'credentials',
    roles: [utils_1.RoleType.Provider],
    qualification: [
        {
            code: 'PODIATRIC-ASSIST',
            state: 'AK',
            active: true,
        },
    ],
};
function invitationParamsForEmployee(employee, roles) {
    var _a, _b, _c;
    if (!process.env.EHR_APPLICATION_ID)
        throw new Error('EHR_APPLICATION_ID is not set');
    var uuid = (0, node_crypto_1.randomUUID)();
    var uniqueLastName = (0, node_crypto_1.randomUUID)();
    return {
        username: (_a = employee.userName) !== null && _a !== void 0 ? _a : "".concat(testEmployeeUsernamePattern).concat(uuid),
        email: (_b = employee.email) !== null && _b !== void 0 ? _b : "e2e-tests+".concat(uuid, "@ottehr.com"),
        applicationId: process.env.EHR_APPLICATION_ID,
        roles: roles,
        resource: {
            identifier: [
                {
                    value: employee.npi,
                    system: 'http://hl7.org/fhir/sid/us-npi',
                },
            ],
            resourceType: 'Practitioner',
            active: true,
            name: [
                {
                    family: (_c = employee.familyName) !== null && _c !== void 0 ? _c : uniqueLastName,
                    given: [employee.givenName, employee.middleName],
                    suffix: [employee.credentials],
                },
            ],
            telecom: [
                {
                    system: 'email',
                    value: employee.email,
                },
                {
                    value: employee.telecomPhone,
                    system: 'sms',
                },
            ],
            qualification: employee.qualification.map(function (qualification) { return (0, utils_1.makeQualificationForPractitioner)(qualification); }),
        },
    };
}
function inviteTestEmployeeUser(employee, oystehr, authToken) {
    return __awaiter(this, void 0, void 0, function () {
        var oystehrProjectId, oystFetch, rolesRaw, providerRoleId, response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    oystehrProjectId = process.env.PROJECT_ID;
                    if (!oystehrProjectId)
                        throw new Error('secret PROJECT_ID is not set');
                    oystFetch = (0, utils_1.createFetchClientWithOystAuth)({ authToken: authToken, projectId: oystehrProjectId }).oystFetch;
                    return [4 /*yield*/, oystFetch('GET', 'https://project-api.zapehr.com/v1/iam/role')];
                case 1:
                    rolesRaw = _b.sent();
                    providerRoleId = (_a = rolesRaw.find(function (role) { return role.name === utils_1.RoleType.Provider; })) === null || _a === void 0 ? void 0 : _a.id;
                    if (!providerRoleId)
                        throw new Error("Didn't found any role with name: ".concat(utils_1.RoleType.Provider));
                    return [4 /*yield*/, oystFetch('POST', 'https://project-api.zapehr.com/v1/user/invite', invitationParamsForEmployee(employee, [providerRoleId]))];
                case 2:
                    response = _b.sent();
                    return [4 /*yield*/, parseTestUser(response, oystehr)];
                case 3: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
function removeUser(userId, practitionerId, oystehr, authToken) {
    return __awaiter(this, void 0, void 0, function () {
        var oystehrProjectId, oystFetch, removeUser, removeUserPractitioner;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    oystehrProjectId = process.env.PROJECT_ID;
                    if (!oystehrProjectId)
                        throw new Error('secret PROJECT_ID is not set');
                    oystFetch = (0, utils_1.createFetchClientWithOystAuth)({ authToken: authToken, projectId: oystehrProjectId }).oystFetch;
                    removeUser = oystFetch('DELETE', "https://project-api.zapehr.com/v1/user/".concat(userId));
                    removeUserPractitioner = oystehr.fhir.delete({ resourceType: 'Practitioner', id: practitionerId });
                    return [4 /*yield*/, Promise.all([removeUser, removeUserPractitioner])];
                case 1:
                    _a.sent();
                    console.log("\u2705 employee deleted ".concat(userId));
                    console.log("\u2705 practitioner for employee deleted ".concat(practitionerId));
                    return [2 /*return*/];
            }
        });
    });
}
function parseTestUser(user, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var practitioner, firstName, middleName, lastName, phone, npi, qualification, credentials;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: user.profile.replace('Practitioner/', ''),
                    })];
                case 1:
                    practitioner = _d.sent();
                    firstName = (0, utils_1.getFirstName)(practitioner);
                    middleName = (0, utils_1.getMiddleName)(practitioner);
                    lastName = (0, utils_1.getLastName)(practitioner);
                    if (!firstName || !middleName || !lastName)
                        throw new Error("Error parsing user full name: ".concat(user.id));
                    phone = (_b = (_a = practitioner.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecom) { return telecom.system === 'sms'; })) === null || _b === void 0 ? void 0 : _b.value;
                    npi = (_c = (0, utils_1.getPractitionerNPIIdentifier)(practitioner)) === null || _c === void 0 ? void 0 : _c.value;
                    qualification = (0, utils_1.allLicensesForPractitioner)(practitioner);
                    credentials = (0, utils_1.getSuffix)(practitioner);
                    if (!phone)
                        throw new Error("No phone for this user: ".concat(user.id));
                    if (!npi)
                        throw new Error("No npi for this user: ".concat(user.id));
                    if (!credentials)
                        throw new Error("No credentials for this user: ".concat(user.id));
                    return [2 /*return*/, {
                            id: user.id,
                            userName: user.name,
                            email: user.email,
                            phoneNumber: user.phoneNumber,
                            authenticationMethod: user.authenticationMethod,
                            profile: practitioner,
                            givenName: firstName,
                            middleName: middleName,
                            familyName: lastName,
                            telecomPhone: phone,
                            npi: npi,
                            credentials: credentials,
                            roles: user.roles.map(function (role) { return role.name; }),
                            qualification: qualification,
                        }];
            }
        });
    });
}
//# sourceMappingURL=employees.js.map
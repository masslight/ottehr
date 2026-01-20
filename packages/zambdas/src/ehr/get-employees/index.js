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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('get-employees', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, promises, _a, allEmployees, existingRoles, inactiveRoleId, providerRoleId, customerSupportRoleId, practitionerIds, encounterCutDate, getResourcesRequest, mixedPromises, _b, inactiveRoleMembers, providerRoleMembers, customerSupportRoleMembers, resources_1, inactiveMemberIds_1, providerMemberIds_1, customerSupportMemberIds_1, recentlyActivePractitioners_1, employeeDetails, response, error_1, ENVIRONMENT;
    var _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _f.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _f.label = 3;
            case 3:
                oystehr = (0, helpers_1.createOystehrClient)(oystehrToken, secrets);
                promises = [getEmployees(oystehr), getRoles(oystehr)];
                return [4 /*yield*/, Promise.all(promises)];
            case 4:
                _a = _f.sent(), allEmployees = _a[0], existingRoles = _a[1];
                console.log("Fetched ".concat(allEmployees.length, " employees and ").concat(existingRoles.length, " roles."));
                inactiveRoleId = (_c = existingRoles.find(function (role) { return role.name === utils_1.RoleType.Inactive; })) === null || _c === void 0 ? void 0 : _c.id;
                providerRoleId = (_d = existingRoles.find(function (role) { return role.name === utils_1.RoleType.Provider; })) === null || _d === void 0 ? void 0 : _d.id;
                customerSupportRoleId = (_e = existingRoles.find(function (role) { return role.name === utils_1.RoleType.CustomerSupport; })) === null || _e === void 0 ? void 0 : _e.id;
                if (!inactiveRoleId || !providerRoleId || !customerSupportRoleId) {
                    throw new Error('Error searching for Inactive, Provider or CustomerSupport role.');
                }
                console.log('Preparing the FHIR batch request.');
                practitionerIds = allEmployees.map(function (employee) { return employee.profile.split('/')[1]; });
                encounterCutDate = luxon_1.DateTime.now().minus({ minutes: 30 }).toFormat("yyyy-MM-dd'T'HH:mm");
                getResourcesRequest = (0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, [
                    "Practitioner?_id=".concat(practitionerIds.join(','), "&_elements=id,meta,qualification,name,extension,telecom"),
                    "Encounter?status=in-progress&_elements=id,participant",
                    "Encounter?status=finished&date=gt".concat(encounterCutDate, "&_elements=id,participant"),
                ]);
                console.log('Do mixed promises in parallel...');
                mixedPromises = [
                    (0, shared_1.getRoleMembers)(inactiveRoleId, oystehr),
                    (0, shared_1.getRoleMembers)(providerRoleId, oystehr),
                    (0, shared_1.getRoleMembers)(customerSupportRoleId, oystehr),
                    getResourcesRequest,
                ];
                return [4 /*yield*/, Promise.all(mixedPromises)];
            case 5:
                _b = _f.sent(), inactiveRoleMembers = _b[0], providerRoleMembers = _b[1], customerSupportRoleMembers = _b[2], resources_1 = _b[3];
                console.log("Fetched ".concat(inactiveRoleMembers.length, " Inactive, ").concat(providerRoleMembers.length, " Provider and ").concat(customerSupportRoleMembers.length, " CustomerSupport role members."));
                inactiveMemberIds_1 = inactiveRoleMembers.length > 0 ? inactiveRoleMembers === null || inactiveRoleMembers === void 0 ? void 0 : inactiveRoleMembers.map(function (member) { return member.id; }) : undefined;
                providerMemberIds_1 = providerRoleMembers.map(function (member) { return member.id; });
                customerSupportMemberIds_1 = customerSupportRoleMembers.map(function (member) { return member.id; });
                recentlyActivePractitioners_1 = extractParticipantsRefsFromResources(resources_1);
                console.log('recentlyActivePractitioners.length:', recentlyActivePractitioners_1.length);
                employeeDetails = allEmployees.map(function (employee) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                    var status = (inactiveMemberIds_1 === null || inactiveMemberIds_1 === void 0 ? void 0 : inactiveMemberIds_1.includes(employee.id)) ? 'Deactivated' : 'Active';
                    var practitionerId = employee.profile.split('/')[1];
                    var practitioner = resources_1.find(function (resource) { return resource.id === practitionerId; });
                    var phone = (_b = (_a = practitioner === null || practitioner === void 0 ? void 0 : practitioner.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecom) { return telecom.system === 'sms'; })) === null || _b === void 0 ? void 0 : _b.value;
                    var licenses = [];
                    if (practitioner === null || practitioner === void 0 ? void 0 : practitioner.qualification) {
                        practitioner.qualification.forEach(function (qualification) {
                            var _a, _b, _c, _d, _e, _f, _g;
                            var qualificationStatusCode = (_d = (_c = (_b = (_a = qualification.extension) === null || _a === void 0 ? void 0 : _a[0].extension) === null || _b === void 0 ? void 0 : _b[1].valueCodeableConcept) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code;
                            var qualificationCode = (_e = qualification.code.coding) === null || _e === void 0 ? void 0 : _e[0].code;
                            if (qualificationStatusCode && qualificationCode) {
                                // Use direct mapping same as in get-user lambda, without checking for extension.urls.
                                licenses.push({
                                    state: qualificationStatusCode,
                                    code: qualificationCode,
                                    active: ((_g = (_f = qualification.extension) === null || _f === void 0 ? void 0 : _f[0].extension) === null || _g === void 0 ? void 0 : _g[0].valueCode) === 'active',
                                });
                            }
                        });
                    }
                    return {
                        id: employee.id,
                        profile: employee.profile,
                        name: employee.name,
                        email: employee.email,
                        status: status,
                        isProvider: Boolean(providerMemberIds_1.includes(employee.id)),
                        isCustomerSupport: Boolean(customerSupportMemberIds_1.includes(employee.id)),
                        lastLogin: (_f = (_e = (_d = (_c = practitioner === null || practitioner === void 0 ? void 0 : practitioner.meta) === null || _c === void 0 ? void 0 : _c.tag) === null || _d === void 0 ? void 0 : _d.find(function (tag) { return tag.system === 'last-login'; })) === null || _e === void 0 ? void 0 : _e.code) !== null && _f !== void 0 ? _f : '',
                        firstName: (_j = (_h = (_g = practitioner === null || practitioner === void 0 ? void 0 : practitioner.name) === null || _g === void 0 ? void 0 : _g[0].given) === null || _h === void 0 ? void 0 : _h.join(' ')) !== null && _j !== void 0 ? _j : '',
                        lastName: (_l = (_k = practitioner === null || practitioner === void 0 ? void 0 : practitioner.name) === null || _k === void 0 ? void 0 : _k[0].family) !== null && _l !== void 0 ? _l : '',
                        phoneNumber: phone ? (0, utils_1.standardizePhoneNumber)(phone) : '',
                        licenses: licenses,
                        seenPatientRecently: recentlyActivePractitioners_1.includes(employee.profile),
                        gettingAlerts: ((_m = (0, utils_1.getProviderNotificationSettingsForPractitioner)(practitioner)) === null || _m === void 0 ? void 0 : _m.enabled) || false,
                    };
                });
                response = {
                    message: "Successfully retrieved employee details",
                    employees: employeeDetails,
                };
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, response)];
            case 6:
                error_1 = _f.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-get-employee-details', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
function getEmployees(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var allEmployees;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Getting all employees..');
                    return [4 /*yield*/, oystehr.user.list()];
                case 1:
                    allEmployees = (_a.sent()).filter(function (user) { return !user.name.startsWith('+') && user.profile.includes('Practitioner'); });
                    return [2 /*return*/, allEmployees];
            }
        });
    });
}
function getRoles(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log('Getting roles...');
            return [2 /*return*/, oystehr.role.list()];
        });
    });
}
function extractParticipantsRefsFromResources(bundleResources) {
    var participantSet = [];
    bundleResources.forEach(function (res) {
        if (res.resourceType === 'Encounter' && res.participant) {
            res.participant.forEach(function (participant) {
                var _a;
                if ((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) {
                    participantSet.push(participant.individual.reference);
                }
            });
        }
    });
    return participantSet.filter(function (participant) { return participant && participant.match(/^Practitioner\//) !== null; });
}

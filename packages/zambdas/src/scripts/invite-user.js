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
exports.inviteUser = inviteUser;
var utils_1 = require("utils");
var shared_1 = require("../shared");
var DEFAULTS = {
    firstName: 'Example',
    lastName: 'Doctor',
    phone: '+12125551212',
    npi: '1234567890',
};
function inviteUser(oystehr_1, email_1) {
    return __awaiter(this, arguments, void 0, function (oystehr, email, firstName, lastName, applicationId, includeDefaultSchedule, slug) {
        var defaultRoleNames, allRoleIds, defaultRoleIds, practitionerQualificationExtension, practitioner, activeUsers, activeUsersCursor, usersPage, invitedUser, err_1;
        if (firstName === void 0) { firstName = DEFAULTS.firstName; }
        if (lastName === void 0) { lastName = DEFAULTS.lastName; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    defaultRoleNames = [
                        utils_1.RoleType.Administrator,
                        utils_1.RoleType.CustomerSupport,
                        utils_1.RoleType.Manager,
                        utils_1.RoleType.Prescriber,
                        utils_1.RoleType.Provider,
                    ];
                    return [4 /*yield*/, (0, shared_1.updateUserRoles)(oystehr)];
                case 1:
                    allRoleIds = _a.sent();
                    defaultRoleIds = (0, shared_1.filterIdsOnlyToTheseRoles)(allRoleIds, defaultRoleNames);
                    practitionerQualificationExtension = [];
                    utils_1.AllStatesValues.map(function (state) { return ({ state: state, code: 'MD', active: true }); }).forEach(function (license) {
                        practitionerQualificationExtension.push((0, utils_1.makeQualificationForPractitioner)(license));
                    });
                    practitioner = {
                        resourceType: 'Practitioner',
                        active: true,
                        identifier: [
                            {
                                use: 'official',
                                value: DEFAULTS.npi,
                                system: 'http://hl7.org/fhir/sid/us-npi',
                            },
                            { system: utils_1.SLUG_SYSTEM, value: slug },
                        ],
                        name: [{ family: lastName, given: [firstName] }],
                        telecom: [
                            {
                                system: 'email',
                                value: email,
                            },
                            {
                                use: 'mobile',
                                value: DEFAULTS.phone,
                                system: 'sms',
                            },
                        ],
                        qualification: practitionerQualificationExtension,
                    };
                    if (includeDefaultSchedule) {
                        practitioner.extension = [
                            {
                                url: utils_1.SCHEDULE_EXTENSION_URL,
                                valueString: '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
                            },
                            {
                                url: utils_1.TIMEZONE_EXTENSION_URL,
                                valueString: 'America/New_York',
                            },
                        ];
                    }
                    activeUsers = [];
                    _a.label = 2;
                case 2: return [4 /*yield*/, oystehr.user.listV2({})];
                case 3:
                    usersPage = _a.sent();
                    activeUsers.push.apply(activeUsers, usersPage.data);
                    activeUsersCursor = usersPage.metadata.nextCursor;
                    _a.label = 4;
                case 4:
                    if (activeUsersCursor) return [3 /*break*/, 2];
                    _a.label = 5;
                case 5:
                    if (!activeUsers.find(function (user) { return user.email === email; })) return [3 /*break*/, 6];
                    console.log('User is already invited to project');
                    return [2 /*return*/, { invitationUrl: undefined, userProfileId: undefined }];
                case 6:
                    console.log('Inviting user to project');
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, oystehr.user.invite({
                            email: email,
                            applicationId: applicationId,
                            resource: practitioner,
                            roles: defaultRoleIds,
                        })];
                case 8:
                    invitedUser = _a.sent();
                    console.log('User invited:', invitedUser);
                    return [2 /*return*/, { invitationUrl: invitedUser.invitationUrl, userProfileId: invitedUser.profile.split('/')[1] }];
                case 9:
                    err_1 = _a.sent();
                    console.error(err_1);
                    throw new Error('Failed to create user');
                case 10: return [2 /*return*/];
            }
        });
    });
}

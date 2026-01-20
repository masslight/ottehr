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
var helpers_1 = require("../../shared/helpers");
var rolesUtils_1 = require("../../shared/rolesUtils");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'update-user';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, userId, firstName, middleName, lastName, providerType, providerTypeText, selectedRoles, licenses, phoneNumber, npi, birthDate, faxNumber, addressLine1, addressLine2, addressCity, addressState, addressZip, PROJECT_API_1, headers, oystehr, user, userProfile, userProfileString, practitionerId, roles, promises, updatedUserResponse, practitionerQualificationExtension_1, existingPractitionerResource, error_1, providerTypeExtension, name_1, suffix, existingTelecom, smsIndex, phoneIndex, faxIndex, updatedTelecom, npiIndex, existingAddress, workAddressIndex, updatedAddress, error_2, _a, _b, response, error_3, ENVIRONMENT;
    var _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 18, , 19]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                console.log('validatedParameters:', JSON.stringify(validatedParameters, null, 4));
                secrets = validatedParameters.secrets, userId = validatedParameters.userId, firstName = validatedParameters.firstName, middleName = validatedParameters.middleName, lastName = validatedParameters.lastName, providerType = validatedParameters.providerType, providerTypeText = validatedParameters.providerTypeText, selectedRoles = validatedParameters.selectedRoles, licenses = validatedParameters.licenses, phoneNumber = validatedParameters.phoneNumber, npi = validatedParameters.npi, birthDate = validatedParameters.birthDate, faxNumber = validatedParameters.faxNumber, addressLine1 = validatedParameters.addressLine1, addressLine2 = validatedParameters.addressLine2, addressCity = validatedParameters.addressCity, addressState = validatedParameters.addressState, addressZip = validatedParameters.addressZip;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                PROJECT_API_1 = (0, utils_1.getSecret)('PROJECT_API', secrets);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _f.sent();
                headers = {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: "Bearer ".concat(m2mToken),
                };
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, oystehr.user.get({ id: userId })];
            case 2:
                user = _f.sent();
                userProfile = user.profile;
                userProfileString = userProfile.split('/');
                practitionerId = userProfileString[1];
                roles = [];
                if (!(selectedRoles && selectedRoles.length > 0)) return [3 /*break*/, 4];
                promises = selectedRoles
                    .filter(function (roleName) { return roleName !== 'Inactive'; })
                    .map(function (roleName) { return (0, rolesUtils_1.getRoleId)(roleName, m2mToken, PROJECT_API_1); });
                return [4 /*yield*/, Promise.all(promises)];
            case 3:
                roles = _f.sent();
                _f.label = 4;
            case 4: return [4 /*yield*/, fetch("".concat(PROJECT_API_1, "/user/").concat(userId), {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({
                        roles: roles,
                    }),
                })];
            case 5:
                updatedUserResponse = _f.sent();
                _f.label = 6;
            case 6:
                _f.trys.push([6, 15, , 16]);
                practitionerQualificationExtension_1 = [];
                licenses === null || licenses === void 0 ? void 0 : licenses.forEach(function (license) {
                    practitionerQualificationExtension_1.push((0, utils_1.makeQualificationForPractitioner)(license));
                });
                existingPractitionerResource = null;
                _f.label = 7;
            case 7:
                _f.trys.push([7, 9, , 10]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: practitionerId,
                    })];
            case 8:
                existingPractitionerResource = (_f.sent());
                return [3 /*break*/, 10];
            case 9:
                error_1 = _f.sent();
                if (error_1.resourceType === 'OperationOutcome' &&
                    error_1.issue &&
                    error_1.issue.some(function (issue) { return issue.severity === 'error' && issue.code === 'not-found'; })) {
                    existingPractitionerResource = null;
                }
                else {
                    throw new Error("Failed to get Practitioner: ".concat(JSON.stringify(error_1)));
                }
                return [3 /*break*/, 10];
            case 10:
                providerTypeExtension = (0, utils_1.makeProviderTypeExtension)(providerType, providerTypeText);
                name_1 = {};
                if (firstName)
                    name_1.given = [firstName];
                if (middleName)
                    ((_c = name_1.given) !== null && _c !== void 0 ? _c : (name_1.given = [])).push(middleName);
                if (lastName)
                    name_1.family = lastName;
                suffix = (0, utils_1.getSuffixFromProviderTypeExtension)(providerTypeExtension);
                if (suffix)
                    name_1.suffix = suffix;
                if (Object.keys(name_1).length === 0)
                    name_1 = undefined;
                if (!!existingPractitionerResource) return [3 /*break*/, 12];
                return [4 /*yield*/, oystehr.fhir.create({
                        resourceType: 'Practitioner',
                        id: practitionerId,
                        name: name_1 ? [name_1] : undefined,
                        qualification: practitionerQualificationExtension_1,
                        extension: providerTypeExtension,
                        telecom: phoneNumber
                            ? [
                                { system: 'sms', value: phoneNumber },
                                { system: 'phone', value: phoneNumber },
                            ]
                            : undefined,
                    })];
            case 11:
                _f.sent();
                return [3 /*break*/, 14];
            case 12:
                existingTelecom = existingPractitionerResource.telecom || [];
                smsIndex = existingTelecom.findIndex(function (tel) { return tel.system === 'sms'; });
                phoneIndex = existingTelecom.findIndex(function (tel) { return tel.system === 'phone'; });
                faxIndex = existingTelecom.findIndex(function (tel) { return tel.system === 'fax'; });
                updatedTelecom = __spreadArray([], existingTelecom, true);
                if (phoneNumber) {
                    if (smsIndex >= 0) {
                        updatedTelecom[smsIndex] = { system: 'sms', value: phoneNumber };
                    }
                    else {
                        updatedTelecom.push({ system: 'sms', value: phoneNumber });
                    }
                    if (phoneIndex >= 0) {
                        updatedTelecom[phoneIndex] = { system: 'phone', value: phoneNumber };
                    }
                    else {
                        updatedTelecom.push({ system: 'phone', value: phoneNumber });
                    }
                }
                else {
                    updatedTelecom = updatedTelecom.filter(function (tel) { return tel.system !== 'sms' && tel.system !== 'phone'; });
                }
                if (faxNumber) {
                    if (faxIndex >= 0) {
                        updatedTelecom[faxIndex] = { system: 'fax', value: faxNumber };
                    }
                    else {
                        updatedTelecom.push({ system: 'fax', value: faxNumber });
                    }
                }
                else {
                    updatedTelecom = updatedTelecom.filter(function (tel) { return tel.system !== 'fax'; });
                }
                if (npi) {
                    if (!existingPractitionerResource.identifier) {
                        existingPractitionerResource.identifier = [];
                    }
                    npiIndex = existingPractitionerResource.identifier.findIndex(function (id) { return id.system === utils_1.FHIR_IDENTIFIER_NPI; });
                    if (npiIndex >= 0) {
                        existingPractitionerResource.identifier[npiIndex].value = npi;
                    }
                    else {
                        existingPractitionerResource.identifier.push({
                            system: utils_1.FHIR_IDENTIFIER_NPI,
                            value: npi,
                        });
                    }
                }
                else {
                    if (existingPractitionerResource.identifier) {
                        existingPractitionerResource.identifier = existingPractitionerResource.identifier.filter(function (id) { return id.system !== utils_1.FHIR_IDENTIFIER_NPI; });
                    }
                }
                if (birthDate) {
                    existingPractitionerResource.birthDate = birthDate;
                }
                existingAddress = existingPractitionerResource.address || [];
                workAddressIndex = existingAddress.findIndex(function (address) { return address.use === 'work'; });
                updatedAddress = __spreadArray([], existingAddress, true);
                // if any address fields are provided, add or update the work address
                if (addressCity || addressState || addressZip || addressLine1 || addressLine2) {
                    if (workAddressIndex < 0) {
                        updatedAddress.push({
                            use: 'work',
                        });
                        workAddressIndex = updatedAddress.length - 1;
                    }
                    if (addressLine1) {
                        updatedAddress[workAddressIndex].line = [addressLine1];
                        if (addressLine2) {
                            (_d = updatedAddress[workAddressIndex].line) === null || _d === void 0 ? void 0 : _d.push(addressLine2);
                        }
                    }
                    updatedAddress[workAddressIndex].city = addressCity || undefined;
                    updatedAddress[workAddressIndex].state = addressState || undefined;
                    updatedAddress[workAddressIndex].postalCode = addressZip || undefined;
                }
                else {
                    // if no address fields are provided, remove the work address
                    updatedAddress = updatedAddress.filter(function (address) { return address.use !== 'work'; });
                }
                return [4 /*yield*/, oystehr.fhir.update(__assign(__assign({}, existingPractitionerResource), { identifier: ((_e = existingPractitionerResource.identifier) === null || _e === void 0 ? void 0 : _e.length) || 0 > 0
                            ? existingPractitionerResource.identifier
                            : undefined, photo: existingPractitionerResource.photo, name: name_1 ? [name_1] : undefined, qualification: practitionerQualificationExtension_1, extension: providerTypeExtension, telecom: updatedTelecom.length > 0 ? updatedTelecom : undefined, address: updatedAddress.length > 0 ? updatedAddress : undefined, birthDate: birthDate ? birthDate : undefined }))];
            case 13:
                _f.sent();
                _f.label = 14;
            case 14: return [3 /*break*/, 16];
            case 15:
                error_2 = _f.sent();
                throw new Error("Failed to update Practitioner: ".concat(JSON.stringify(error_2)));
            case 16:
                _b = (_a = console).log;
                return [4 /*yield*/, updatedUserResponse.json()];
            case 17:
                _b.apply(_a, [_f.sent()]);
                if (!updatedUserResponse.ok) {
                    throw new Error('Failed to update user');
                }
                response = {
                    message: "Successfully updated user ".concat(userId),
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 18:
                error_3 = _f.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-update-user', error_3, ENVIRONMENT)];
            case 19: return [2 /*return*/];
        }
    });
}); });

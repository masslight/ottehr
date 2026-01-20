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
var ZAMBDA_NAME = 'get-user';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, userId, oystehr, response, getUserResponse, existingPractitionerResource, schedule, userProfile, userProfileString, practitionerId, _a, practitionerResource, scheduleSearch, error_1, allLicenses_1, error_2, error_3, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 10, , 11]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets, userId = validatedParameters.userId;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                response = null;
                _b.label = 2;
            case 2:
                _b.trys.push([2, 8, , 9]);
                return [4 /*yield*/, oystehr.user.get({ id: userId })];
            case 3:
                getUserResponse = _b.sent();
                existingPractitionerResource = undefined;
                schedule = void 0;
                userProfile = getUserResponse.profile;
                userProfileString = userProfile.split('/');
                practitionerId = userProfileString[1];
                _b.label = 4;
            case 4:
                _b.trys.push([4, 6, , 7]);
                return [4 /*yield*/, Promise.all([
                        oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: practitionerId,
                        }),
                        oystehr.fhir
                            .search({
                            resourceType: 'Schedule',
                            params: [
                                {
                                    name: 'actor',
                                    value: "Practitioner/".concat(practitionerId),
                                },
                            ],
                        })
                            .then(function (bundle) {
                            var resources = bundle.unbundle();
                            var schedule = resources.find(function (r) { return r.resourceType === 'Schedule'; });
                            return schedule;
                        }),
                    ])];
            case 5:
                _a = _b.sent(), practitionerResource = _a[0], scheduleSearch = _a[1];
                existingPractitionerResource = practitionerResource;
                schedule = scheduleSearch;
                console.log('Existing practitioner: ' + JSON.stringify(existingPractitionerResource));
                return [3 /*break*/, 7];
            case 6:
                error_1 = _b.sent();
                if (error_1.resourceType === 'OperationOutcome' &&
                    error_1.issue &&
                    error_1.issue.some(function (issue) { return issue.severity === 'error' && issue.code === 'not-found'; })) {
                    existingPractitionerResource = undefined;
                }
                else {
                    throw new Error("Failed to get Practitioner: ".concat(JSON.stringify(error_1)));
                }
                return [3 /*break*/, 7];
            case 7:
                allLicenses_1 = [];
                console.log(existingPractitionerResource);
                if (existingPractitionerResource === null || existingPractitionerResource === void 0 ? void 0 : existingPractitionerResource.qualification) {
                    existingPractitionerResource === null || existingPractitionerResource === void 0 ? void 0 : existingPractitionerResource.qualification.forEach(function (qualification) {
                        var newLicense = {
                            state: qualification.extension[0].extension[1].valueCodeableConcept.coding[0].code,
                            code: qualification.code.coding[0].code,
                            active: qualification.extension[0].extension[0].valueCode === 'active',
                        };
                        allLicenses_1.push(newLicense);
                    });
                }
                response = {
                    message: "Successfully got user ".concat(userId),
                    user: __assign(__assign({}, getUserResponse), { profileResource: existingPractitionerResource, licenses: allLicenses_1 !== null && allLicenses_1 !== void 0 ? allLicenses_1 : [] }),
                    userScheduleId: schedule === null || schedule === void 0 ? void 0 : schedule.id,
                };
                return [3 /*break*/, 9];
            case 8:
                error_2 = _b.sent();
                throw new Error("Failed to get User: ".concat(JSON.stringify(error_2)));
            case 9: return [2 /*return*/, {
                    statusCode: 200,
                    body: JSON.stringify(response),
                }];
            case 10:
                error_3 = _b.sent();
                console.log('Error: ', JSON.stringify(error_3.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_3, ENVIRONMENT)];
            case 11: return [2 /*return*/];
        }
    });
}); });

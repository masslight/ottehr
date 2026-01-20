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
var jose_1 = require("jose");
var jsonpath_plus_1 = require("jsonpath-plus");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'join-call';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var authorization, validatedParameters, appointmentId, secrets, projectApiURL, websiteUrl, telemedClientId, telemedClientSecret, jwt, claims, isInvitedParticipant, user, secret, error_1, oystehr, appointment, patientRef, patientId, videoEncounter, userProfile, relatedPersonRef, subject, relatedPerson, userToken, joinCallResponse, error_2;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 21, , 22]);
                authorization = input.headers.Authorization;
                if (!authorization) {
                    console.log('User is not authenticated yet');
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(401, { message: 'Unauthorized' })];
                }
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                    console.log(JSON.stringify(validatedParameters, null, 4));
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                appointmentId = validatedParameters.appointmentId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                projectApiURL = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
                websiteUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                telemedClientId = (0, utils_1.getSecret)(utils_1.SecretsKeys.AUTH0_CLIENT, secrets);
                telemedClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.AUTH0_SECRET, secrets);
                jwt = authorization.replace('Bearer ', '');
                claims = (0, jose_1.decodeJwt)(jwt);
                console.log('JWT claims:', claims);
                isInvitedParticipant = false;
                user = void 0;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 6, , 7]);
                if (!(claims.iss === utils_1.PROJECT_WEBSITE)) return [3 /*break*/, 3];
                isInvitedParticipant = true;
                secret = new TextEncoder().encode(telemedClientSecret);
                return [4 /*yield*/, (0, jose_1.jwtVerify)(jwt, secret, {
                        audience: "".concat(websiteUrl, "/waiting-room/appointment/").concat(appointmentId),
                    })];
            case 2:
                _c.sent();
                if (!claims.sub) {
                    throw new Error('clams.sub is expected!');
                }
                return [3 /*break*/, 5];
            case 3:
                console.log('getting user');
                return [4 /*yield*/, (0, shared_1.getUser)(jwt, secrets)];
            case 4:
                user = _c.sent();
                console.log("user: ".concat(user === null || user === void 0 ? void 0 : user.name));
                _c.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                error_1 = _c.sent();
                console.log('User verification error:', error_1);
                return [2 /*return*/, (0, shared_1.lambdaResponse)(401, { message: 'Unauthorized' })];
            case 7:
                if (!!oystehrToken) return [3 /*break*/, 9];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 8:
                oystehrToken = _c.sent(); // keeping token externally for reuse
                return [3 /*break*/, 10];
            case 9:
                console.log('already have a token, no need to update');
                _c.label = 10;
            case 10:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                appointment = undefined;
                console.log("getting appointment resource for id ".concat(appointmentId));
                return [4 /*yield*/, (0, utils_1.getAppointmentResourceById)(appointmentId, oystehr)];
            case 11:
                appointment = _c.sent();
                if (!appointment) {
                    console.log('Appointment is not found');
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(404, { message: 'Appointment is not found' })];
                }
                patientRef = (_b = (_a = appointment.participant.find(function (p) { var _a, _b; return ((_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.match(/^Patient/)) !== null; })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference;
                patientId = patientRef === null || patientRef === void 0 ? void 0 : patientRef.replace(/^Patient\//, '');
                console.log('Patient ID from appointment:', patientId);
                if (!patientId) {
                    throw new Error('Could not find the patient reference in appointment resource.'); // 500
                }
                videoEncounter = undefined;
                return [4 /*yield*/, (0, shared_1.getVideoEncounterForAppointment)(appointment.id || 'Unknown', oystehr)];
            case 12:
                videoEncounter = _c.sent();
                console.log('Encounter status:', videoEncounter === null || videoEncounter === void 0 ? void 0 : videoEncounter.status);
                if (!(videoEncounter === null || videoEncounter === void 0 ? void 0 : videoEncounter.id) ||
                    videoEncounter.status !== 'in-progress' ||
                    !(0, utils_1.getVirtualServiceResourceExtension)(videoEncounter, utils_1.TELEMED_VIDEO_ROOM_CODE)) {
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, utils_1.CANNOT_JOIN_CALL_NOT_STARTED_ERROR)];
                }
                userProfile = void 0;
                relatedPersonRef = void 0;
                if (!isInvitedParticipant) return [3 /*break*/, 15];
                subject = claims.sub || '';
                return [4 /*yield*/, isParticipantInvited(subject, videoEncounter.id, oystehr)];
            case 13:
                if (!(_c.sent())) {
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(401, { message: 'Unauthorized' })];
                }
                return [4 /*yield*/, getM2MUserProfile(oystehrToken, projectApiURL, telemedClientId)];
            case 14:
                userProfile = _c.sent();
                return [3 /*break*/, 18];
            case 15:
                // user is defined here cause it's not invited participant
                user = user;
                userProfile = user.profile;
                return [4 /*yield*/, (0, shared_1.userHasAccessToPatient)(user, patientId, oystehr)];
            case 16:
                if (!(_c.sent())) {
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(403, utils_1.NO_READ_ACCESS_TO_PATIENT_ERROR)];
                }
                return [4 /*yield*/, (0, utils_1.getRelatedPersonForPatient)(patientId, oystehr)];
            case 17:
                relatedPerson = _c.sent();
                relatedPersonRef = "RelatedPerson/".concat(relatedPerson === null || relatedPerson === void 0 ? void 0 : relatedPerson.id);
                _c.label = 18;
            case 18:
                console.log('User profile:', userProfile);
                console.log('RelatedPerson:', relatedPersonRef);
                return [4 /*yield*/, addUserToVideoEncounterIfNeeded(videoEncounter, userProfile, relatedPersonRef, oystehr)];
            case 19:
                videoEncounter = _c.sent();
                if (!videoEncounter.id) {
                    throw new Error("Video encounter was not found for the appointment ".concat(appointment.id));
                }
                userToken = isInvitedParticipant ? oystehrToken : jwt;
                return [4 /*yield*/, joinTelemedMeeting(projectApiURL, userToken, videoEncounter.id, isInvitedParticipant)];
            case 20:
                joinCallResponse = _c.sent();
                return [2 /*return*/, (0, shared_1.lambdaResponse)(200, joinCallResponse)];
            case 21:
                error_2 = _c.sent();
                console.log(error_2);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_2, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 22: return [2 /*return*/];
        }
    });
}); });
function addUserToVideoEncounterIfNeeded(encounter, fhirParticipantRef, fhirRelatedPersonRef, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var extension, otherParticipantExt, filter, path, otherParticipantsDenormalized, updateOperations, participants, updatedEncounter, err_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 4, , 5]);
                    extension = __spreadArray([], ((_a = encounter.extension) !== null && _a !== void 0 ? _a : []), true);
                    otherParticipantExt = extension.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Encounter.otherParticipants.url; });
                    filter = utils_1.FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url;
                    path = "$.extension[?(@.url == '".concat(filter, "')].extension[?(@.url == 'reference')].valueReference.reference");
                    otherParticipantsDenormalized = (0, jsonpath_plus_1.JSONPath)({ path: path, json: otherParticipantExt !== null && otherParticipantExt !== void 0 ? otherParticipantExt : {} });
                    console.log('otherParticipantsDenormalized:', otherParticipantsDenormalized);
                    updateOperations = [];
                    if (otherParticipantsDenormalized.includes(fhirParticipantRef)) {
                        console.log("User '".concat(fhirParticipantRef, "' is already added to the participant list."));
                    }
                    else {
                        (_b = otherParticipantExt === null || otherParticipantExt === void 0 ? void 0 : otherParticipantExt.extension) === null || _b === void 0 ? void 0 : _b.push({
                            url: utils_1.FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url,
                            extension: [
                                {
                                    url: 'period',
                                    valuePeriod: {
                                        start: luxon_1.DateTime.now().toUTC().toISO(),
                                    },
                                },
                                {
                                    url: 'reference',
                                    valueReference: {
                                        reference: fhirParticipantRef,
                                    },
                                },
                            ],
                        });
                        updateOperations.push({
                            op: 'replace',
                            path: '/extension',
                            value: extension,
                        });
                    }
                    if (!fhirRelatedPersonRef ||
                        (encounter.participant &&
                            encounter.participant.findIndex(function (p) { var _a; return ((_a = p.individual) === null || _a === void 0 ? void 0 : _a.reference) === fhirRelatedPersonRef; }) >= 0)) {
                        console.log('Encounter.participant list will not be updated.');
                    }
                    else {
                        console.log("Adding RelatedPerson/'".concat(fhirRelatedPersonRef, "' to Encounter.participant."));
                        participants = __spreadArray([], ((_c = encounter.participant) !== null && _c !== void 0 ? _c : []), true);
                        participants.push({
                            individual: {
                                reference: fhirRelatedPersonRef,
                            },
                        });
                        updateOperations.push({
                            op: encounter.participant ? 'replace' : 'add',
                            path: '/participant',
                            value: participants,
                        });
                    }
                    if (!(updateOperations.length > 0)) return [3 /*break*/, 2];
                    console.log(JSON.stringify(updateOperations, null, 4));
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Encounter',
                            id: (_d = encounter.id) !== null && _d !== void 0 ? _d : '',
                            operations: updateOperations,
                        })];
                case 1:
                    updatedEncounter = _e.sent();
                    return [2 /*return*/, updatedEncounter];
                case 2:
                    console.log('Nothing to update for the encounter.');
                    return [2 /*return*/, encounter];
                case 3: return [3 /*break*/, 5];
                case 4:
                    err_1 = _e.sent();
                    console.error('Error while trying to update video encounter with user participant', err_1);
                    throw err_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function isParticipantInvited(subject, encounterId, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var emailPattern, isEmail, relatedPersons, telecom;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    isEmail = emailPattern.test(subject);
                    return [4 /*yield*/, (0, shared_1.searchInvitedParticipantResourcesByEncounterId)(encounterId, oystehr)];
                case 1:
                    relatedPersons = _a.sent();
                    telecom = (0, jsonpath_plus_1.JSONPath)({
                        path: "$..telecom[?(@.system == \"".concat(isEmail ? 'email' : 'phone', "\")].value"),
                        json: relatedPersons,
                    });
                    console.log("".concat(isEmail ? 'Email addresses' : 'Phone numbers', " that were invited:"), telecom);
                    return [2 /*return*/, telecom.includes(subject)];
            }
        });
    });
}
function joinTelemedMeeting(projectApiURL_1, userToken_1, encounterId_1) {
    return __awaiter(this, arguments, void 0, function (projectApiURL, userToken, encounterId, anonymous) {
        var joinUrl, response, _a, _b, _c, _d;
        if (anonymous === void 0) { anonymous = false; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    joinUrl = "".concat(projectApiURL, "/telemed/v2/meeting/").concat(encounterId, "/join").concat(anonymous ? '?anonymous=true' : '');
                    return [4 /*yield*/, fetch(joinUrl, {
                            headers: {
                                Authorization: "Bearer ".concat(userToken),
                                'content-type': 'application/json',
                            },
                            method: 'GET',
                        })];
                case 1:
                    response = _e.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    _a = Error.bind;
                    _b = "API call failed: ".concat;
                    _d = (_c = JSON).stringify;
                    return [4 /*yield*/, response.json()];
                case 2: throw new (_a.apply(Error, [void 0, _b.apply("API call failed: ", [_d.apply(_c, [_e.sent()])])]))();
                case 3: return [4 /*yield*/, response.json()];
                case 4: return [2 /*return*/, (_e.sent())];
            }
        });
    });
}
function getM2MUserProfile(token, projectApiURL, telemedClientId) {
    return __awaiter(this, void 0, void 0, function () {
        var url, response, data, telemedDevice, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    url = "".concat(projectApiURL, "/m2m");
                    return [4 /*yield*/, fetch(url, {
                            headers: {
                                Authorization: "Bearer ".concat(token),
                            },
                            method: 'GET',
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Failed to fetch M2M user details: ".concat(response.statusText));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    telemedDevice = data.find(function (device) { return device.clientId === telemedClientId; });
                    if (!telemedDevice) {
                        throw new Error('No device matches the provided AUTH0_CLIENT');
                    }
                    return [2 /*return*/, telemedDevice.profile];
                case 3:
                    error_3 = _a.sent();
                    console.error('Error fetching M2M user details:', error_3);
                    throw error_3;
                case 4: return [2 /*return*/];
            }
        });
    });
}

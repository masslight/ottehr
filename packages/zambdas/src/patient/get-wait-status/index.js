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
var jose_1 = require("jose");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var constants_1 = require("../../shared/appointment/constants");
var fhir_1 = require("./utils/fhir");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'get-wait-status';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentID, secrets, authorization, websiteUrl, telemedClientSecret, jwt, claims, secret, user, error_1, oystehr, _a, appointment, videoEncounter, locationId, telemedStatus, appointments, estimatedTime, numberInLine, response, response, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 15, , 16]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                console.log(JSON.stringify(validatedParameters, null, 4));
                appointmentID = validatedParameters.appointmentID, secrets = validatedParameters.secrets, authorization = validatedParameters.authorization;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                // for now, require patient to log in
                if (!authorization) {
                    console.log('User is not authenticated yet');
                    // TODO: not sure what to do with yet
                    return [2 /*return*/, {
                            statusCode: 401,
                            body: JSON.stringify({ message: 'Unauthorized' }),
                        }];
                }
                websiteUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                telemedClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.AUTH0_SECRET, secrets);
                jwt = authorization.replace('Bearer ', '');
                claims = void 0;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 6, , 7]);
                claims = (0, jose_1.decodeJwt)(jwt);
                console.log('JWT claims:', claims);
                if (!(claims.iss === utils_1.PROJECT_WEBSITE)) return [3 /*break*/, 3];
                secret = new TextEncoder().encode(telemedClientSecret);
                return [4 /*yield*/, (0, jose_1.jwtVerify)(jwt, secret, {
                        audience: "".concat(websiteUrl, "/waiting-room/appointment/").concat(appointmentID),
                    })];
            case 2:
                _b.sent();
                return [3 /*break*/, 5];
            case 3:
                console.log('getting user');
                return [4 /*yield*/, (0, shared_1.getUser)(jwt, secrets)];
            case 4:
                user = _b.sent();
                console.log("user: ".concat(user.name));
                _b.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                error_1 = _b.sent();
                console.log('User verification error:', error_1);
                return [2 /*return*/, {
                        statusCode: 401,
                        body: JSON.stringify({ message: 'Unauthorized' }),
                    }];
            case 7:
                if (!!oystehrToken) return [3 /*break*/, 9];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 8:
                oystehrToken = _b.sent(); // keeping token externally for reuse
                return [3 /*break*/, 10];
            case 9:
                console.log('already have a token, no need to update');
                _b.label = 10;
            case 10:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                console.log("getting appointment resource for id ".concat(appointmentID));
                return [4 /*yield*/, Promise.all([
                        (0, utils_1.getAppointmentResourceById)(appointmentID, oystehr),
                        (0, shared_1.getVideoEncounterForAppointment)(appointmentID || 'Unknown', oystehr),
                    ])];
            case 11:
                _a = _b.sent(), appointment = _a[0], videoEncounter = _a[1];
                if (!appointment || !videoEncounter) {
                    console.log("Appointment/Encounter is not found for appointment id ".concat(appointmentID));
                    return [2 /*return*/, {
                            statusCode: 404,
                            body: JSON.stringify({ message: 'Appointment is not found' }),
                        }];
                }
                console.log("Encounter found for appointment id ".concat(appointmentID, ": "), JSON.stringify(videoEncounter));
                locationId = (0, utils_1.getLocationIdFromAppointment)(appointment);
                if (!locationId) {
                    console.log("Location ID is not found in appointment: ".concat(JSON.stringify(appointment)));
                    return [2 /*return*/, {
                            statusCode: 404,
                            body: JSON.stringify({ message: 'Location ID not found in appointment' }),
                        }];
                }
                telemedStatus = (0, utils_1.getTelemedVisitStatus)(videoEncounter.status, appointment.status);
                if (!(telemedStatus === 'ready' || telemedStatus === 'pre-video' || telemedStatus === 'on-video')) return [3 /*break*/, 13];
                return [4 /*yield*/, getAppointmentsForLocation(oystehr, locationId)];
            case 12:
                appointments = _b.sent();
                estimatedTime = calculateEstimatedTime(appointments);
                numberInLine = getNumberInLine(appointments, appointmentID);
                response = {
                    statusCode: 200,
                    body: JSON.stringify({
                        status: telemedStatus === 'on-video' ? telemedStatus : utils_1.TelemedAppointmentStatusEnum.ready,
                        estimatedTime: estimatedTime,
                        numberInLine: numberInLine,
                        encounterId: telemedStatus === 'on-video' ? videoEncounter === null || videoEncounter === void 0 ? void 0 : videoEncounter.id : undefined,
                        appointmentType: (0, utils_1.appointmentTypeForAppointment)(appointment),
                    }),
                };
                console.log(JSON.stringify(response, null, 4));
                return [2 /*return*/, response];
            case 13:
                console.log(videoEncounter.status, appointment.status);
                response = {
                    statusCode: 200,
                    body: JSON.stringify({
                        status: telemedStatus === 'cancelled' ? telemedStatus : utils_1.TelemedAppointmentStatusEnum.complete,
                    }),
                };
                console.log(JSON.stringify(response, null, 4));
                return [2 /*return*/, response];
            case 14: return [3 /*break*/, 16];
            case 15:
                error_2 = _b.sent();
                console.log(error_2, JSON.stringify(error_2));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_2, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 16: return [2 /*return*/];
        }
    });
}); });
var getAppointmentsForLocation = function (oystehr, locationId) { return __awaiter(void 0, void 0, void 0, function () {
    var location, currentState, statesGroup, locationsIdsToSearchWith;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, readLocationResource(oystehr, locationId)];
            case 1:
                location = _b.sent();
                currentState = (_a = location === null || location === void 0 ? void 0 : location.address) === null || _a === void 0 ? void 0 : _a.state;
                if (!(location && currentState))
                    return [2 /*return*/, []];
                statesGroup = getStatesGroupForSearch(currentState);
                return [4 /*yield*/, (0, fhir_1.convertStatesAbbreviationsToLocationIds)(oystehr, statesGroup)];
            case 2:
                locationsIdsToSearchWith = _b.sent();
                return [4 /*yield*/, (0, fhir_1.getAllAppointmentsByLocations)(oystehr, locationsIdsToSearchWith)];
            case 3: return [2 /*return*/, _b.sent()];
        }
    });
}); };
var calculateEstimatedTime = function (appointments) {
    var waitingTimeInMills = calculateLongestWaitingTime(appointments);
    var additionalTime = 15 * 60000;
    return waitingTimeInMills + additionalTime;
};
var getNumberInLine = function (appointments, appointmentId) {
    for (var i = 0; i < appointments.length; i++) {
        if (appointments[i].id === appointmentId) {
            return i + 1;
        }
    }
    return 0;
};
var readLocationResource = function (oystehr, locationId) { return __awaiter(void 0, void 0, void 0, function () {
    var location;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.get({
                    resourceType: 'Location',
                    id: locationId,
                })];
            case 1:
                location = _a.sent();
                return [2 /*return*/, location];
        }
    });
}); };
var getStatesGroupForSearch = function (currentState) {
    return constants_1.estimatedTimeStatesGroups.find(function (group) { return group.includes(currentState); }) || [currentState];
};
var calculateLongestWaitingTime = function (appointments) {
    var longestTime = 0;
    appointments.forEach(function (appointment) {
        var rawDate = appointment.start;
        if (rawDate) {
            var apptDate = new Date(rawDate);
            var timeDifference = Math.abs(new Date().getTime() - apptDate.getTime());
            if (timeDifference > longestTime)
                longestTime = timeDifference;
        }
    });
    return longestTime;
};

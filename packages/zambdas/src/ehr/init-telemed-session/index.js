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
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var video_room_creation_1 = require("./video-room-creation");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'init-telemed-session';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, appointmentId, secrets, oystehr, _b, appointment, encounters, videoEncounter, encounterResource, userToken, meetingData, output, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 5, , 6]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), appointmentId = _a.appointmentId, secrets = _a.secrets;
                console.log('Getting token');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _c.sent();
                console.log('token', m2mToken);
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                console.log("Getting appointment ".concat(appointmentId));
                return [4 /*yield*/, getAppointmentWithEncounters({ appointmentId: appointmentId, oystehr: oystehr })];
            case 2:
                _b = _c.sent(), appointment = _b.appointment, encounters = _b.encounters;
                videoEncounter = encounters.find(function (enc) { return Boolean((0, helpers_1.getVideoRoomResourceExtension)(enc)); });
                if (!videoEncounter) {
                    throw new Error("Appointment ".concat(appointmentId, " doesn't have virtual video encounter"));
                }
                console.log("Creating video room");
                return [4 /*yield*/, (0, video_room_creation_1.createVideoRoom)(appointment, videoEncounter, oystehr, secrets)];
            case 3:
                encounterResource = _c.sent();
                console.log("Encounter for video room id: ".concat(encounterResource.id));
                console.log("Getting video room token");
                userToken = input.headers.Authorization.replace('Bearer ', '');
                return [4 /*yield*/, execJoinVideoRoomRequest(secrets, encounterResource.id, userToken)];
            case 4:
                meetingData = _c.sent();
                console.log("Video room token received: ".concat(meetingData, ". Sending response to client"));
                output = {
                    meetingData: meetingData,
                    encounterId: encounterResource.id,
                };
                return [2 /*return*/, {
                        body: JSON.stringify(output),
                        statusCode: 200,
                    }];
            case 5:
                error_1 = _c.sent();
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
function getAppointmentWithEncounters(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var resources, fhirAppointment, encounters;
        var oystehr = _b.oystehr, appointmentId = _b.appointmentId;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentId || '',
                            },
                            {
                                name: '_revinclude',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
                case 1:
                    resources = (_c.sent()).unbundle();
                    fhirAppointment = resources.find(function (res) { return res.resourceType === 'Appointment'; });
                    encounters = resources.filter(function (resourceTemp) {
                        var _a;
                        return resourceTemp.resourceType === 'Encounter' &&
                            ((_a = resourceTemp.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) === "Appointment/".concat(fhirAppointment.id);
                    });
                    return [2 /*return*/, { appointment: fhirAppointment, encounters: encounters }];
            }
        });
    });
}
var execJoinVideoRoomRequest = function (secrets, encounterId, userToken) { return __awaiter(void 0, void 0, void 0, function () {
    var response, responseData;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch("".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets), "/telemed/v2/meeting/").concat(encounterId, "/join"), {
                    headers: {
                        Authorization: "Bearer ".concat(userToken),
                    },
                    method: 'GET',
                })];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Getting telemed token call failed: ".concat(response.statusText));
                }
                return [4 /*yield*/, response.json()];
            case 2:
                responseData = (_a.sent());
                return [2 /*return*/, responseData];
        }
    });
}); };

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
var auth_1 = require("../../shared/auth");
var userAuditLog_1 = require("../../shared/userAuditLog");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('check-in', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var userToken, user, _a, formattedUserNumber, checkedInBy, validatedParameters, appointmentID, secrets, oystehr, allResources, appointment_1, patient_1, encounter_1, questionnaireResponse_1, location_1, missingResources, checkedIn, paperworkCompleted, locationInformation, response, error_1, ENVIRONMENT;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 11, , 12]);
                console.time('check-in-zambda');
                console.group('validateRequestParameters');
                console.log('getting user');
                userToken = (_b = input.headers.Authorization) === null || _b === void 0 ? void 0 : _b.replace('Bearer ', '');
                _a = userToken;
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, auth_1.getUser)(userToken, input.secrets)];
            case 1:
                _a = (_e.sent());
                _e.label = 2;
            case 2:
                user = _a;
                formattedUserNumber = (0, utils_1.formatPhoneNumberDisplay)((_c = user === null || user === void 0 ? void 0 : user.name) === null || _c === void 0 ? void 0 : _c.replace('+1', ''));
                checkedInBy = "Patient".concat(formattedUserNumber ? " ".concat(formattedUserNumber) : '');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentID = validatedParameters.appointmentId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 4];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 3:
                oystehrToken = _e.sent();
                return [3 /*break*/, 5];
            case 4:
                console.log('already have token');
                _e.label = 5;
            case 5:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                console.log('getting all fhir resources');
                console.time('resource search for check in');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentID,
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_revinclude',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'QuestionnaireResponse:encounter',
                            },
                        ],
                    })];
            case 6:
                allResources = (_e.sent())
                    .unbundle()
                    .filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; });
                console.timeEnd('resource search for check in');
                allResources.forEach(function (resource) {
                    if (resource.resourceType === 'Appointment') {
                        appointment_1 = resource;
                    }
                    if (resource.resourceType === 'Patient') {
                        patient_1 = resource;
                    }
                    if (resource.resourceType === 'Encounter' && !(0, utils_1.isFollowupEncounter)(resource)) {
                        encounter_1 = resource;
                    }
                    if (resource.resourceType === 'Location') {
                        location_1 = resource;
                    }
                    if (resource.resourceType === 'QuestionnaireResponse') {
                        questionnaireResponse_1 = resource;
                    }
                });
                if (!appointment_1) {
                    throw utils_1.APPOINTMENT_NOT_FOUND_ERROR;
                }
                missingResources = "".concat(!patient_1 ? 'patient, ' : '').concat(!encounter_1 ? 'encounter, ' : '').concat(!location_1 ? 'location, ' : '');
                if (!encounter_1 || !patient_1 || !location_1) {
                    throw new Error("The following vital resources are missing: ".concat(missingResources));
                }
                checkedIn = appointment_1.status !== 'booked';
                if (!!checkedIn) return [3 /*break*/, 9];
                console.log('checking in the patient');
                return [4 /*yield*/, checkIn(oystehr, checkedInBy, appointment_1, encounter_1)];
            case 7:
                _e.sent();
                return [4 /*yield*/, (0, userAuditLog_1.createAuditEvent)(userAuditLog_1.AuditableZambdaEndpoints.appointmentCheckIn, oystehr, input, patient_1.id || '', secrets)];
            case 8:
                _e.sent();
                return [3 /*break*/, 10];
            case 9:
                console.log('Appointment is already checked in');
                _e.label = 10;
            case 10:
                paperworkCompleted = false;
                if (questionnaireResponse_1) {
                    paperworkCompleted = (0, shared_1.checkPaperworkComplete)(questionnaireResponse_1);
                }
                console.log('organizing location information');
                locationInformation = (0, utils_1.getLocationInformation)(location_1);
                console.timeEnd('check-in-zambda');
                if (!appointment_1.start) {
                    throw new Error('Appointment start time is missing');
                }
                response = {
                    location: locationInformation,
                    visitType: (_d = appointment_1.appointmentType) === null || _d === void 0 ? void 0 : _d.text, // TODO safely check value is a VisitType
                    start: appointment_1.start,
                    paperworkCompleted: paperworkCompleted,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 11:
                error_1 = _e.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('check-in', error_1, ENVIRONMENT)];
            case 12: return [2 /*return*/];
        }
    });
}); });
function checkIn(oystehr, checkedInBy, appointment, encounter) {
    return __awaiter(this, void 0, void 0, function () {
        var now, plannedHistoryIdx, arrivedHistoryIdx, encounterPatchOperations, appointmentPatchOperations, appointmentPatchRequest, encounterPatchRequest, checkInTextTask, taskRequest;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = luxon_1.DateTime.now().setZone('UTC').toISO() || '';
                    plannedHistoryIdx = (0, utils_1.getEncounterStatusHistoryIdx)(encounter, 'planned');
                    console.log('planned history index:', plannedHistoryIdx);
                    arrivedHistoryIdx = (0, utils_1.getEncounterStatusHistoryIdx)(encounter, 'arrived');
                    console.log('arrived history index:', arrivedHistoryIdx);
                    console.log('current encounter status history:', JSON.stringify(encounter.statusHistory));
                    encounterPatchOperations = [
                        {
                            op: 'replace',
                            path: '/status',
                            value: 'arrived',
                        },
                    ];
                    if (plannedHistoryIdx >= 0) {
                        encounterPatchOperations.push({
                            op: 'add',
                            path: "/statusHistory/".concat(plannedHistoryIdx, "/period/end"),
                            value: now,
                        });
                    }
                    if (arrivedHistoryIdx === -1) {
                        encounterPatchOperations.push({
                            op: 'add',
                            path: "/statusHistory/-",
                            value: {
                                status: 'arrived',
                                period: {
                                    start: now,
                                },
                                extension: [
                                    {
                                        url: utils_1.FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url,
                                        valueCode: 'arrived',
                                    },
                                ],
                            },
                        });
                    }
                    appointmentPatchOperations = [
                        {
                            op: 'replace',
                            path: '/status',
                            value: 'arrived',
                        },
                    ];
                    appointmentPatchOperations.push.apply(appointmentPatchOperations, (0, utils_1.getAppointmentMetaTagOpForStatusUpdate)(appointment, 'arrived', { updatedByOverride: checkedInBy }));
                    appointmentPatchRequest = (0, utils_1.getPatchBinary)({
                        resourceType: 'Appointment',
                        resourceId: appointment.id || 'Unknown',
                        patchOperations: appointmentPatchOperations,
                    });
                    encounterPatchRequest = (0, utils_1.getPatchBinary)({
                        resourceType: 'Encounter',
                        resourceId: encounter.id || 'Unknown',
                        patchOperations: encounterPatchOperations,
                    });
                    checkInTextTask = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.checkInText, appointment.id || '');
                    taskRequest = {
                        method: 'POST',
                        url: '/Task',
                        resource: checkInTextTask,
                    };
                    console.log('making transaction request to patch appointment and encounter and create task to send text');
                    return [4 /*yield*/, oystehr.fhir.transaction({
                            requests: [appointmentPatchRequest, encounterPatchRequest, taskRequest],
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}

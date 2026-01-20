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
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('update-appointment', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentID, inputSlot, secrets, oystehr, slot, startTime, endTime, allResources, fhirAppointment, appointmentDateTime, formattedDate, fhirLocation, fhirHS, fhirPractitioner, fhirSchedule, scheduleOwner, scheduleType, scheduleData, availableSlots, slotAlreadyPersisted, response_1, updatedAppointment, fhirPatient, confirmationTextTask, error_1, response, error_2, ENVIRONMENT;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 13, , 14]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentID = validatedParameters.appointmentID, inputSlot = validatedParameters.slot, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _c.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _c.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                slot = (0, utils_1.normalizeSlotToUTC)(inputSlot);
                startTime = slot.start;
                endTime = slot.end;
                if (!(0, utils_1.checkValidBookingTime)(startTime)) {
                    throw utils_1.APPOINTMENT_CANT_BE_IN_PAST_ERROR;
                }
                console.log('getting appointment and related schedule resource');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentID,
                            },
                            {
                                name: '_include',
                                value: 'Appointment:actor',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:slot',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Slot:schedule',
                            },
                        ],
                    })];
            case 4:
                allResources = (_c.sent()).unbundle();
                console.log("successfully retrieved ".concat(allResources.length, " appointment resources"));
                fhirAppointment = allResources.find(function (resource) { return resource.resourceType === 'Appointment'; });
                if ((0, utils_1.isPostTelemedAppointment)(fhirAppointment)) {
                    throw utils_1.POST_TELEMED_APPOINTMENT_CANT_BE_MODIFIED_ERROR;
                }
                console.log("checking appointment with id ".concat(appointmentID, " is not checked in"));
                // https://github.com/masslight/ottehr/issues/2431
                // todo: remove the second condition once virtual prebook appointments begin in 'booked' status
                if (fhirAppointment.status === 'arrived' && !(0, utils_1.isTelemedAppointment)(fhirAppointment)) {
                    throw utils_1.CANT_UPDATE_CHECKED_IN_APT_ERROR;
                }
                else if (fhirAppointment.status === 'cancelled') {
                    throw utils_1.CANT_UPDATE_CANCELED_APT_ERROR;
                }
                console.log("checking appointment with id ".concat(appointmentID, " is not in the past"));
                appointmentDateTime = luxon_1.DateTime.fromISO((_a = fhirAppointment === null || fhirAppointment === void 0 ? void 0 : fhirAppointment.start) !== null && _a !== void 0 ? _a : '');
                formattedDate = appointmentDateTime.toISO();
                if (!(0, utils_1.checkValidBookingTime)(formattedDate !== null && formattedDate !== void 0 ? formattedDate : '')) {
                    throw utils_1.PAST_APPOINTMENT_CANT_BE_MODIFIED_ERROR;
                }
                fhirLocation = allResources.find(function (resource) { return resource.resourceType === 'Location'; });
                fhirHS = allResources.find(function (resource) { return resource.resourceType === 'HealthcareService'; });
                fhirPractitioner = allResources.find(function (resource) { return resource.resourceType === 'Practitioner'; });
                fhirSchedule = allResources.find(function (resource) { return resource.resourceType === 'Schedule'; });
                scheduleOwner = void 0;
                if (fhirLocation) {
                    scheduleOwner = fhirLocation;
                }
                else if (fhirHS) {
                    scheduleOwner = fhirHS;
                }
                else if (fhirPractitioner) {
                    scheduleOwner = fhirPractitioner;
                }
                if (!scheduleOwner || !fhirSchedule) {
                    console.log('scheduleResource is missing');
                    throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                }
                scheduleType = void 0;
                if (scheduleOwner.resourceType === 'Location') {
                    scheduleType = utils_1.ScheduleType.location;
                }
                else if (scheduleOwner.resourceType === 'Practitioner') {
                    scheduleType = utils_1.ScheduleType.provider;
                }
                else {
                    scheduleType = utils_1.ScheduleType.group;
                }
                scheduleData = {
                    scheduleList: [
                        {
                            schedule: fhirSchedule,
                            owner: scheduleOwner,
                        },
                    ],
                    metadata: {
                        type: scheduleType,
                    },
                };
                return [4 /*yield*/, (0, utils_1.getAvailableSlotsForSchedules)({
                        now: luxon_1.DateTime.now(),
                        scheduleList: scheduleData.scheduleList,
                    }, oystehr)];
            case 5:
                availableSlots = (_c.sent()).availableSlots;
                slotAlreadyPersisted = (0, utils_1.isValidUUID)((_b = slot.id) !== null && _b !== void 0 ? _b : '');
                if (slotAlreadyPersisted || availableSlots.map(function (si) { return (0, utils_1.normalizeSlotToUTC)(si.slot).start; }).includes(slot.start)) {
                    console.log('slot is available');
                }
                else {
                    console.log('slot start', slot.start, availableSlots[0].slot.start);
                    console.log('slot is unavailable', slot);
                    response_1 = {
                        message: 'Slot unavailable',
                        appointmentID: undefined,
                        availableSlots: availableSlots,
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response_1),
                        }];
                }
                console.log("updating appointment with id ".concat(appointmentID));
                return [4 /*yield*/, (0, shared_1.updateAppointmentTime)(fhirAppointment, startTime, endTime, oystehr, slot)];
            case 6:
                updatedAppointment = _c.sent();
                console.log('getting patient');
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Patient',
                        id: (0, shared_1.getParticipantFromAppointment)(updatedAppointment, 'Patient'),
                    })];
            case 7:
                fhirPatient = _c.sent();
                if (!fhirAppointment.id) return [3 /*break*/, 11];
                confirmationTextTask = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.confirmationMessages, fhirAppointment.id);
                _c.label = 8;
            case 8:
                _c.trys.push([8, 10, , 11]);
                return [4 /*yield*/, oystehr.fhir.create(confirmationTextTask)];
            case 9:
                _c.sent();
                return [3 /*break*/, 11];
            case 10:
                error_1 = _c.sent();
                console.error('Error creating confirmation text task:', error_1);
                (0, aws_serverless_1.captureException)(error_1);
                return [3 /*break*/, 11];
            case 11:
                response = {
                    message: 'Successfully updated an appointment',
                    appointmentID: updatedAppointment.id,
                };
                return [4 /*yield*/, (0, shared_1.createAuditEvent)(shared_1.AuditableZambdaEndpoints.appointmentUpdate, oystehr, input, fhirPatient.id || '', secrets)];
            case 12:
                _c.sent();
                // todo 1.10: define an output type for this, as it's actually a very tricky type that is differently shaped
                // depending on whether the slot was unavailable or not
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 13:
                error_2 = _c.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-appointment', error_2, ENVIRONMENT)];
            case 14: return [2 /*return*/];
        }
    });
}); });

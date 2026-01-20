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
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'get-appointment-details';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentID, secrets, oystehr, DISPLAY_TOMORROW_SLOTS_AT_HOUR, allResources, fhirAppointment, fhirLocation, fhirHS, fhirPractitioner, fhirSlot, fhirSchedule, scheduleOwner, slotEnd, appointmentDateTime, locationInformation, appointment, availableSlots, response, error_1, ENVIRONMENT;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentID = validatedParameters.appointmentID, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _e.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _e.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                DISPLAY_TOMORROW_SLOTS_AT_HOUR = parseInt((0, utils_1.getSecret)(utils_1.SecretsKeys.IN_PERSON_PREBOOK_DISPLAY_TOMORROW_SLOTS_AT_HOUR, secrets));
                console.log('getting all appointment resources');
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
                            {
                                name: '_revinclude:iterate',
                                value: 'Schedule:actor:Location',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Schedule:actor:Practitioner',
                            },
                        ],
                    })];
            case 4:
                allResources = (_e.sent()).unbundle();
                console.log("successfully retrieved ".concat(allResources.length, " appointment resources"));
                fhirAppointment = allResources.find(function (resource) { return resource.resourceType === 'Appointment'; });
                fhirLocation = allResources.find(function (resource) { return resource.resourceType === 'Location'; });
                fhirHS = allResources.find(function (resource) { return resource.resourceType === 'HealthcareService'; });
                fhirPractitioner = allResources.find(function (resource) { return resource.resourceType === 'Practitioner'; });
                fhirSlot = allResources.find(function (resource) { return resource.resourceType === 'Slot'; });
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
                if (!fhirAppointment) {
                    throw utils_1.APPOINTMENT_NOT_FOUND_ERROR;
                }
                if (!scheduleOwner) {
                    console.log('scheduleResource is missing');
                    throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                }
                if (!fhirSchedule) {
                    console.log('scheduleResource is missing', fhirAppointment.participant);
                    throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                }
                // once we're using a slot on the appointment in all cases we can get rid of this
                if (!fhirSlot) {
                    slotEnd = (_a = fhirAppointment.end) !== null && _a !== void 0 ? _a : '';
                    if (!slotEnd) {
                        appointmentDateTime = luxon_1.DateTime.fromISO((_b = fhirAppointment === null || fhirAppointment === void 0 ? void 0 : fhirAppointment.start) !== null && _b !== void 0 ? _b : '');
                        slotEnd = (_c = appointmentDateTime.plus({ minutes: 15 }).toISO()) !== null && _c !== void 0 ? _c : '';
                    }
                    fhirSlot = {
                        resourceType: 'Slot',
                        id: "".concat(fhirSchedule.id, "-").concat(fhirAppointment.start),
                        status: 'busy',
                        start: fhirAppointment.start,
                        end: slotEnd,
                        schedule: {
                            reference: "Schedule/".concat(fhirSchedule.id),
                        },
                    };
                }
                locationInformation = (0, utils_1.getLocationInformation)(scheduleOwner, fhirSchedule);
                appointment = {
                    start: fhirAppointment.start || 'Unknown',
                    location: locationInformation,
                    status: fhirAppointment === null || fhirAppointment === void 0 ? void 0 : fhirAppointment.status,
                    visitType: ((_d = fhirAppointment.appointmentType) === null || _d === void 0 ? void 0 : _d.text) || 'Unknown',
                    slot: fhirSlot,
                };
                console.log('current appointment slot: ', fhirSlot);
                return [4 /*yield*/, (0, utils_1.getAvailableSlotsForSchedules)({
                        now: luxon_1.DateTime.now(),
                        scheduleList: [{ schedule: fhirSchedule, owner: scheduleOwner }],
                    }, oystehr)];
            case 5:
                availableSlots = (_e.sent()).availableSlots;
                response = {
                    appointment: appointment,
                    availableSlots: availableSlots,
                    displayTomorrowSlotsAtHour: DISPLAY_TOMORROW_SLOTS_AT_HOUR,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _e.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-appointment-details', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });

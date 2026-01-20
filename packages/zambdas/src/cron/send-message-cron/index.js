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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../ehr/schedules/shared");
var shared_2 = require("../../shared");
var communication_1 = require("../../shared/communication");
var oystehrToken;
exports.index = (0, shared_2.wrapHandler)('send-message-cron', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr_1, nowUTC, startTime_1, allResources_1, appointments, next90MinuteAppointments, nextHourAppointments, nextHourAppointmentPromises, encounterResources_1, questionnaireResponseResources_1, next90MinuteAppointmentPromises, appointmentPromises, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                secrets = input.secrets;
                if (!!oystehrToken) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, shared_2.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, 5, , 6]);
                oystehr_1 = (0, shared_2.createOystehrClient)(oystehrToken, secrets);
                nowUTC = luxon_1.DateTime.now().toUTC();
                startTime_1 = roundToNearestQuarterHour(nowUTC.plus({ hour: 1 }));
                console.log("Getting booked appointments between ".concat(startTime_1.toISO(), " and ").concat(startTime_1
                    .plus({ minute: 45 })
                    .toISO(), " and the related patients and location resources"));
                return [4 /*yield*/, oystehr_1.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            { name: 'status', value: 'booked' },
                            { name: 'date', value: "ge".concat(startTime_1.toISO()) },
                            { name: 'date', value: "lt".concat(startTime_1.plus({ minute: 45 }).toISO()) },
                            { name: '_sort', value: 'date' },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:slot',
                            },
                            {
                                name: '_revinclude',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'QuestionnaireResponse:encounter',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Slot:schedule',
                            },
                        ],
                    })];
            case 3:
                allResources_1 = (_a.sent())
                    .unbundle()
                    .filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; });
                console.log('successfully retrieved resources');
                appointments = allResources_1.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Appointment'; });
                next90MinuteAppointments = appointments.filter(function (appointment) {
                    return (appointment.start &&
                        appointment.start >= (startTime_1.plus({ minute: 30 }).toISO() || '') &&
                        appointment.start < (startTime_1.plus({ minute: 45 }).toISO() || ''));
                });
                if (next90MinuteAppointments.length === 0)
                    console.log('no appointments to remind in the next 90 minutes');
                nextHourAppointments = appointments.filter(function (appointment) {
                    return appointment.start && appointment.start < (startTime_1.plus({ minute: 15 }).toISO() || '');
                });
                if (nextHourAppointments.length === 0)
                    console.log('no appointments to remind in the next hour');
                nextHourAppointmentPromises = nextHourAppointments.map(function (appointment) { return __awaiter(void 0, void 0, void 0, function () {
                    var fhirAppointment, created, _a, schedule, scheduleOwner, startTimeFormatted, locationName, message, ENVIRONMENT;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                fhirAppointment = appointment;
                                created = luxon_1.DateTime.fromISO(fhirAppointment.created || '');
                                _a = getScheduleForAppointment(fhirAppointment, allResources_1), schedule = _a.schedule, scheduleOwner = _a.scheduleOwner;
                                startTimeFormatted = getPrettyStartTime(fhirAppointment, schedule);
                                locationName = scheduleOwner ? (0, shared_1.getNameForOwner)(scheduleOwner) : '';
                                if (!(startTime_1.diff(created, 'minutes').minutes > 120 && locationName && startTimeFormatted)) return [3 /*break*/, 2];
                                message = "Your check-in time at ".concat(locationName, " is ").concat(startTimeFormatted, ". See you soon!");
                                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                                return [4 /*yield*/, sendAutomatedText(fhirAppointment, oystehr_1, ENVIRONMENT, message)];
                            case 1:
                                _b.sent();
                                _b.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                }); });
                encounterResources_1 = allResources_1.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Encounter'; });
                questionnaireResponseResources_1 = allResources_1.filter(function (resourceTemp) { return resourceTemp.resourceType === 'QuestionnaireResponse'; });
                next90MinuteAppointmentPromises = next90MinuteAppointments.map(function (appointment) { return __awaiter(void 0, void 0, void 0, function () {
                    var fhirAppointment, _a, schedule, scheduleOwner, created, encounter, questionnaireResponse, isPaperworkComplete, patientID_1, fhirPatient, patientEmail, WEBSITE_URL, message, ENVIRONMENT, prettyStartTime, address, locationName, missingData, templateData, emailClient;
                    var _b, _c, _d, _e, _f;
                    return __generator(this, function (_g) {
                        switch (_g.label) {
                            case 0:
                                fhirAppointment = appointment;
                                _a = getScheduleForAppointment(fhirAppointment, allResources_1), schedule = _a.schedule, scheduleOwner = _a.scheduleOwner;
                                created = luxon_1.DateTime.fromISO(fhirAppointment.created || '');
                                encounter = encounterResources_1.find(function (resource) { var _a; return ((_a = resource.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) === "Appointment/".concat(fhirAppointment === null || fhirAppointment === void 0 ? void 0 : fhirAppointment.id); });
                                questionnaireResponse = questionnaireResponseResources_1.find(function (resource) { var _a; return ((_a = resource.encounter) === null || _a === void 0 ? void 0 : _a.reference) === "Encounter/".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id); });
                                console.log('paperwork status: ', questionnaireResponse.status);
                                isPaperworkComplete = questionnaireResponse.status == 'completed' || questionnaireResponse.status == 'amended';
                                if (!(startTime_1.plus({ minutes: 30 }).diff(created, 'minutes').minutes > 120 && !isPaperworkComplete)) return [3 /*break*/, 4];
                                console.log('send reminder for appointment with incomplete paperwork scheduled within the next 90 minutes and created 2 hours before visit time');
                                patientID_1 = (_d = (_c = (_b = fhirAppointment.participant
                                    .find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _b === void 0 ? void 0 : _b.actor) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')[1];
                                fhirPatient = allResources_1.find(function (resourceTemp) { return resourceTemp.id === patientID_1; });
                                patientEmail = (0, utils_1.getPatientContactEmail)(fhirPatient);
                                WEBSITE_URL = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                                message = "To prevent delays, please complete your paperwork prior to arrival. For ".concat((_f = (_e = fhirPatient.name) === null || _e === void 0 ? void 0 : _e[0].given) === null || _f === void 0 ? void 0 : _f[0], ", click here: ").concat(WEBSITE_URL, "/paperwork/").concat(fhirAppointment === null || fhirAppointment === void 0 ? void 0 : fhirAppointment.id);
                                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                                return [4 /*yield*/, sendAutomatedText(fhirAppointment, oystehr_1, ENVIRONMENT, message)];
                            case 1:
                                _g.sent();
                                prettyStartTime = getPrettyStartTime(fhirAppointment, schedule);
                                address = (0, utils_1.getAddressStringForScheduleResource)(scheduleOwner) || '';
                                locationName = scheduleOwner ? (0, shared_1.getNameForOwner)(scheduleOwner) : '';
                                missingData = [];
                                if (!patientEmail)
                                    missingData.push('patient email');
                                if (!schedule)
                                    missingData.push('schedule');
                                if (!scheduleOwner)
                                    missingData.push('schedule owner');
                                if (!fhirAppointment.id)
                                    missingData.push('appointment ID');
                                if (!locationName)
                                    missingData.push('location name');
                                if (!address)
                                    missingData.push('address');
                                if (!prettyStartTime)
                                    missingData.push('appointment time');
                                if (!(missingData.length === 0 && patientEmail && fhirAppointment.id && prettyStartTime)) return [3 /*break*/, 3];
                                templateData = {
                                    location: locationName,
                                    time: prettyStartTime,
                                    'address-url': (0, communication_1.makeAddressUrl)(address),
                                    'modify-visit-url': (0, communication_1.makeModifyVisitUrl)(fhirAppointment.id, secrets),
                                    'cancel-visit-url': (0, communication_1.makeCancelVisitUrl)(fhirAppointment.id, secrets),
                                    'paperwork-url': (0, communication_1.makePaperworkUrl)(fhirAppointment.id, secrets),
                                    address: address,
                                };
                                emailClient = (0, communication_1.getEmailClient)(secrets);
                                return [4 /*yield*/, emailClient.sendInPersonReminderEmail(patientEmail, templateData)];
                            case 2:
                                _g.sent();
                                return [3 /*break*/, 4];
                            case 3:
                                console.log("not sending email, missing data: ".concat(missingData.join(', ')));
                                _g.label = 4;
                            case 4: return [2 /*return*/];
                        }
                    });
                }); });
                appointmentPromises = __spreadArray(__spreadArray([], nextHourAppointmentPromises, true), next90MinuteAppointmentPromises, true);
                return [4 /*yield*/, Promise.all(appointmentPromises)];
            case 4:
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({ status: 'hola' }),
                    }];
            case 5:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_2.topLevelCatch)('send-message-cron', error_1, ENVIRONMENT)];
            case 6: return [2 /*return*/];
        }
    });
}); });
function roundToNearestQuarterHour(date) {
    var roundedDateTime = date.startOf('hour').plus({
        minutes: Math.round(date.minute / 15) * 15,
    });
    return roundedDateTime;
}
function sendAutomatedText(fhirAppointment, oystehr, ENVIRONMENT, message) {
    return __awaiter(this, void 0, void 0, function () {
        var messageInput, resource, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 7]);
                    console.log('getting conversationSID for appointment', fhirAppointment.id);
                    return [4 /*yield*/, (0, communication_1.getMessageRecipientForAppointment)(fhirAppointment, oystehr)];
                case 1:
                    messageInput = _a.sent();
                    if (!messageInput) return [3 /*break*/, 3];
                    resource = messageInput.resource;
                    return [4 /*yield*/, oystehr.transactionalSMS.send({
                            resource: resource,
                            message: message,
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    console.log('no conversationSID returned for appointment:', fhirAppointment.id);
                    void (0, shared_2.sendErrors)('no conversationSID when sending automated text', ENVIRONMENT);
                    _a.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    error_2 = _a.sent();
                    console.log('error trying to send message: ', error_2, JSON.stringify(error_2));
                    return [4 /*yield*/, (0, shared_2.sendErrors)(error_2, ENVIRONMENT)];
                case 6:
                    _a.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    });
}
var getScheduleForAppointment = function (appointment, resourceBundle) {
    var _a, _b, _c, _d, _e, _f;
    var appointmentSlotId = (_b = (_a = appointment.slot) === null || _a === void 0 ? void 0 : _a[0].reference) === null || _b === void 0 ? void 0 : _b.split('/')[1];
    if (appointmentSlotId) {
        var slot = resourceBundle.find(function (res) { return res.resourceType === 'Slot' && res.id === appointmentSlotId; });
        if (slot) {
            var scheduleId_1 = (_d = (_c = slot.schedule) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')[1];
            var schedule = resourceBundle.find(function (res) { return res.resourceType === 'Schedule' && res.id === scheduleId_1; });
            var scheduleOwnerRef = (_f = (_e = schedule === null || schedule === void 0 ? void 0 : schedule.actor) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.reference;
            var scheduleOwner = void 0;
            if (scheduleOwnerRef) {
                var scheduleOwnerType_1 = scheduleOwnerRef.split('/')[0];
                var scheduleOwnerId_1 = scheduleOwnerRef.split('/')[1];
                scheduleOwner = resourceBundle.find(function (res) {
                    return res.resourceType === scheduleOwnerType_1 &&
                        res.id === scheduleOwnerId_1 &&
                        (res.resourceType === 'Practitioner' || res.resourceType === 'Location');
                });
            }
            return { schedule: schedule, scheduleOwner: scheduleOwner };
        }
    }
    return {};
};
var getPrettyStartTime = function (fhirAppointment, schedule) {
    if (schedule && fhirAppointment.start) {
        var tz = (0, utils_1.getTimezone)(schedule);
        return luxon_1.DateTime.fromISO(fhirAppointment.start).setZone(tz).toFormat(utils_1.DATETIME_FULL_NO_YEAR);
    }
    return undefined;
};

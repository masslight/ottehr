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
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var communication_1 = require("../../../shared/communication");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('cancel-appointment', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var userToken, user, _a, isEHRUser, validatedParameters, appointmentID, languageInput, cancellationReason, silent, secrets, language, oystehr, appointment, formattedUserNumber, cancelledBy, appointmentPatchOperations, _b, encounter, curStatusHistoryIdx, canceledHistoryIdx, now, encounterPatchOperations, appointmentPatchRequest, encounterPatchRequest, slotId, deleteSlotRequests, getAppointmentRequest, transactionBundle, _c, appointmentUpdated, scheduleResource, patient, _d, startTime, email, emailClient, WEBSITE_URL_1, readableTime, address, location_1, templateData, error_1, WEBSITE_URL, url, message, messageSpanish, selectedMessage, relatedPerson, e_1, ENVIRONMENT, response, error_2, ENVIRONMENT;
    var _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                _k.trys.push([0, 26, , 27]);
                console.group('validateRequestParameters');
                console.log('getting user');
                userToken = (_e = input.headers.Authorization) === null || _e === void 0 ? void 0 : _e.replace('Bearer ', '');
                _a = userToken;
                if (!_a) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, shared_1.getUser)(input.headers.Authorization.replace('Bearer ', ''), input.secrets)];
            case 1:
                _a = (_k.sent());
                _k.label = 2;
            case 2:
                user = _a;
                isEHRUser = user && (0, shared_1.checkIsEHRUser)(user);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentID = validatedParameters.appointmentID, languageInput = validatedParameters.language, cancellationReason = validatedParameters.cancellationReason, silent = validatedParameters.silent, secrets = validatedParameters.secrets;
                language = languageInput || 'en';
                console.groupEnd();
                console.debug('validateRequestParameters success');
                // Get email props
                console.group('gettingEmailProps');
                if (!!oystehrToken) return [3 /*break*/, 4];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 3:
                oystehrToken = _k.sent();
                return [3 /*break*/, 5];
            case 4:
                console.log('already have token');
                _k.label = 5;
            case 5:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                return [4 /*yield*/, (0, utils_1.getAppointmentResourceById)(appointmentID, oystehr)];
            case 6:
                appointment = _k.sent();
                if (!appointment) {
                    throw utils_1.APPOINTMENT_NOT_FOUND_ERROR;
                }
                if ((user && !isEHRUser) || !user) {
                    if ((0, utils_1.isPostTelemedAppointment)(appointment)) {
                        throw utils_1.POST_TELEMED_APPOINTMENT_CANT_BE_CANCELED_ERROR;
                    }
                    console.log("checking appointment with id ".concat(appointmentID, " is not checked in"));
                    if (appointment.status !== 'booked') {
                        if ((0, utils_1.isTelemedAppointment)(appointment)) {
                            // https://github.com/masslight/ottehr/issues/2431
                            // todo: remove this once prebooked virtual appointments begin in 'booked' status
                            console.log("appointment is virtual, allowing cancellation");
                        }
                        else {
                            throw utils_1.CANT_CANCEL_CHECKED_IN_APT_ERROR;
                        }
                    }
                }
                else if (user && isEHRUser) {
                    console.log('cancelled by EHR user');
                }
                formattedUserNumber = (0, utils_1.formatPhoneNumberDisplay)((_f = user === null || user === void 0 ? void 0 : user.name) === null || _f === void 0 ? void 0 : _f.replace('+1', ''));
                cancelledBy = user && isEHRUser ? "Staff ".concat(user === null || user === void 0 ? void 0 : user.email) : "Patient".concat(formattedUserNumber ? " ".concat(formattedUserNumber) : '');
                appointmentPatchOperations = __spreadArray(__spreadArray([], (0, utils_1.getAppointmentMetaTagOpForStatusUpdate)(appointment, 'cancelled', { updatedByOverride: cancelledBy }), true), [
                    {
                        op: 'replace',
                        path: '/status',
                        value: 'cancelled',
                    },
                    {
                        op: 'add',
                        path: '/cancelationReason',
                        value: {
                            coding: [
                                {
                                    // todo reassess codes and reasons, just using custom codes atm
                                    system: "".concat(utils_1.FHIR_ZAPEHR_URL, "/CodeSystem/appointment-cancellation-reason"),
                                    code: cancellationReason,
                                    display: cancellationReason,
                                },
                            ],
                        },
                    },
                ], false);
                console.log("getting encounter details for appointment with id ".concat(appointmentID));
                return [4 /*yield*/, (0, shared_1.getEncounterDetails)(appointmentID, oystehr)];
            case 7:
                _b = _k.sent(), encounter = _b.encounter, curStatusHistoryIdx = _b.curStatusHistoryIdx, canceledHistoryIdx = _b.canceledHistoryIdx;
                console.log("successfully retrieved encounter details for id ".concat(encounter.id));
                now = luxon_1.DateTime.now().setZone('UTC').toISO() || '';
                encounterPatchOperations = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: 'cancelled',
                    },
                ];
                if (curStatusHistoryIdx >= 0) {
                    encounterPatchOperations.push({
                        op: 'add',
                        path: "/statusHistory/".concat(curStatusHistoryIdx, "/period/end"),
                        value: now,
                    });
                }
                if (canceledHistoryIdx === -1) {
                    encounterPatchOperations.push({
                        op: 'add',
                        path: "/statusHistory/-",
                        value: {
                            status: 'cancelled',
                            period: {
                                start: now,
                            },
                        },
                    });
                }
                appointmentPatchRequest = (0, utils_1.getPatchBinary)({
                    resourceType: 'Appointment',
                    resourceId: appointmentID,
                    patchOperations: appointmentPatchOperations,
                });
                encounterPatchRequest = (0, utils_1.getPatchBinary)({
                    resourceType: 'Encounter',
                    resourceId: encounter.id || 'Unknown',
                    patchOperations: encounterPatchOperations,
                });
                slotId = (_j = (_h = (_g = appointment.slot) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.reference) === null || _j === void 0 ? void 0 : _j.split('/')[1];
                deleteSlotRequests = [];
                if (slotId) {
                    deleteSlotRequests.push({
                        url: "/Slot/".concat(slotId),
                        method: 'DELETE',
                    });
                }
                getAppointmentRequest = {
                    url: "/Appointment?_id=".concat(appointmentID, "&_include=Appointment:patient&_include=Appointment:actor"),
                    method: 'GET',
                };
                console.log('making transaction request for getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest');
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: __spreadArray([getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest], deleteSlotRequests, true),
                    })];
            case 8:
                transactionBundle = _k.sent();
                console.log('getting appointment from transaction bundle');
                _c = (0, shared_1.validateBundleAndExtractAppointment)(transactionBundle), appointmentUpdated = _c.appointment, scheduleResource = _c.scheduleResource, patient = _c.patient;
                return [4 /*yield*/, getCancellationDetails(appointmentUpdated, patient, scheduleResource)];
            case 9:
                _d = _k.sent(), startTime = _d.startTime, email = _d.email;
                console.groupEnd();
                console.debug('gettingEmailProps success');
                console.log('building location information');
                if (!!silent) return [3 /*break*/, 23];
                if (!email) return [3 /*break*/, 14];
                console.group('sendCancellationEmail');
                _k.label = 10;
            case 10:
                _k.trys.push([10, 12, , 13]);
                emailClient = (0, communication_1.getEmailClient)(secrets);
                WEBSITE_URL_1 = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                readableTime = startTime.toFormat(utils_1.DATETIME_FULL_NO_YEAR);
                address = (0, utils_1.getAddressStringForScheduleResource)(scheduleResource);
                if (!address) {
                    throw new Error('Address is required to send reminder email');
                }
                location_1 = (0, utils_1.getNameFromScheduleResource)(scheduleResource);
                if (!location_1) {
                    throw new Error('Location is required to send reminder email');
                }
                templateData = {
                    time: readableTime,
                    location: location_1,
                    address: address,
                    'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(address || '')),
                    'book-again-url': "".concat(WEBSITE_URL_1, "/home"),
                };
                return [4 /*yield*/, emailClient.sendInPersonCancelationEmail(email, templateData)];
            case 11:
                _k.sent();
                return [3 /*break*/, 13];
            case 12:
                error_1 = _k.sent();
                (0, aws_serverless_1.captureException)(error_1);
                console.error('error sending cancellation email', error_1);
                return [3 /*break*/, 13];
            case 13:
                console.groupEnd();
                return [3 /*break*/, 15];
            case 14:
                console.log('No email found. Skipping sending email.');
                _k.label = 15;
            case 15:
                console.group('Send cancel message request');
                WEBSITE_URL = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                url = "".concat(WEBSITE_URL, "/home");
                message = "Your visit for ".concat((0, utils_1.getPatientFirstName)(patient), " has been canceled. Tap ").concat(url, " to book a new visit.");
                messageSpanish = "Su consulta para ".concat((0, utils_1.getPatientFirstName)(patient
                // cSpell:disable-next Spanish
                ), " ha sido cancelada. Toque ").concat(url, " para reservar una nueva consulta.");
                selectedMessage = void 0;
                switch (language.split('-')[0]) {
                    case 'es':
                        selectedMessage = messageSpanish;
                        break;
                    case 'en':
                    default:
                        selectedMessage = message;
                        break;
                }
                return [4 /*yield*/, (0, utils_1.getRelatedPersonForPatient)(patient.id || '', oystehr)];
            case 16:
                relatedPerson = _k.sent();
                if (!relatedPerson) return [3 /*break*/, 21];
                console.log('sending text message to relatedperson', relatedPerson.id);
                _k.label = 17;
            case 17:
                _k.trys.push([17, 19, , 20]);
                return [4 /*yield*/, oystehr.transactionalSMS.send({
                        resource: "RelatedPerson/".concat(relatedPerson.id),
                        message: selectedMessage,
                    })];
            case 18:
                _k.sent();
                return [3 /*break*/, 20];
            case 19:
                e_1 = _k.sent();
                console.log('failing silently, error sending cancellation text message');
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                void (0, shared_1.sendErrors)(e_1, ENVIRONMENT);
                return [3 /*break*/, 20];
            case 20: return [3 /*break*/, 22];
            case 21:
                console.log("No RelatedPerson found for patient ".concat(patient.id, " not sending text message"));
                _k.label = 22;
            case 22:
                console.groupEnd();
                return [3 /*break*/, 24];
            case 23:
                console.log('Cancelling silently. Skipping email and text.');
                _k.label = 24;
            case 24: return [4 /*yield*/, (0, shared_1.createAuditEvent)(shared_1.AuditableZambdaEndpoints.appointmentCancel, oystehr, input, patient.id || '', secrets)];
            case 25:
                _k.sent();
                response = {};
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 26:
                error_2 = _k.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('cancel-appointment', error_2, ENVIRONMENT)];
            case 27: return [2 /*return*/];
        }
    });
}); });
var getCancellationDetails = function (appointment, patient, scheduleResource) { return __awaiter(void 0, void 0, void 0, function () {
    var email, timezone, visitType;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        try {
            if (!appointment.start) {
                throw new Error("These fields are required for the cancelation email: appointment.start");
            }
            email = (0, utils_1.getPatientContactEmail)(patient);
            timezone = (_b = (_a = scheduleResource.extension) === null || _a === void 0 ? void 0 : _a.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _b === void 0 ? void 0 : _b.valueString;
            visitType = (_d = (_c = appointment.appointmentType) === null || _c === void 0 ? void 0 : _c.text) !== null && _d !== void 0 ? _d : 'Unknown';
            return [2 /*return*/, {
                    startTime: luxon_1.DateTime.fromISO(appointment.start).setZone(timezone),
                    email: email,
                    patient: patient,
                    visitType: visitType,
                }];
        }
        catch (error) {
            throw new Error("error getting cancellation email details: ".concat(error, ", ").concat(JSON.stringify(error)));
        }
        return [2 /*return*/];
    });
}); };

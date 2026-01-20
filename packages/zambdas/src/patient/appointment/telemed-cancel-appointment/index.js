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
var ZAMBDA_NAME = 'telemed-cancel-appointment';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Telemed Cancelation Input: ".concat(JSON.stringify(input)));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, validatedParameters.secrets)];
            case 2:
                oystehrToken = _a.sent();
                return [4 /*yield*/, performEffect({ input: input, params: validatedParameters })];
            case 3:
                response = _a.sent();
                return [2 /*return*/, response];
            case 4:
                error_1 = _a.sent();
                console.log("Error: ".concat(error_1, " Error stringified: "), JSON.stringify(error_1, null, 4));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
function performEffect(props) {
    return __awaiter(this, void 0, void 0, function () {
        var input, _a, secrets, appointmentID, cancellationReason, cancellationReasonAdditional, fhirAPI, projectAPI, oystehr, appointmentPatchOperations, _b, encounter, existedAppointment, now, encounterPatchOperations, previousStatusHistoryRecordIndex, appointmentPatchRequest, encounterPatchRequest, getAppointmentRequest, requests, transactionBundle, _c, appointment, patient, response, locationId, location, locationName, email, emailClient, WEBSITE_URL, templateData, error_2, relatedPerson, message, ENVIRONMENT;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    input = props.input;
                    _a = props.params, secrets = _a.secrets, appointmentID = _a.appointmentID, cancellationReason = _a.cancellationReason, cancellationReasonAdditional = _a.cancellationReasonAdditional;
                    fhirAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets);
                    projectAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
                    oystehr = (0, utils_1.createOystehrClient)(oystehrToken, fhirAPI, projectAPI);
                    console.group('gettingEmailProps');
                    appointmentPatchOperations = [
                        {
                            op: 'replace',
                            path: '/status',
                            value: 'cancelled',
                        },
                    ];
                    console.log("getting encounter details for appointment with id ".concat(appointmentID));
                    return [4 /*yield*/, Promise.all([
                            (0, shared_1.getVideoEncounterForAppointment)(appointmentID, oystehr),
                            (0, utils_1.getAppointmentResourceById)(appointmentID, oystehr),
                        ])];
                case 1:
                    _b = _d.sent(), encounter = _b[0], existedAppointment = _b[1];
                    if (!existedAppointment) {
                        throw utils_1.APPOINTMENT_NOT_FOUND_ERROR;
                    }
                    console.log("successfully retrieved encounter details for id ".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id));
                    now = luxon_1.DateTime.now().setZone('UTC').toISO() || '';
                    encounterPatchOperations = [];
                    if (encounter && encounter.status !== 'cancelled') {
                        encounterPatchOperations.push({
                            op: 'replace',
                            path: '/status',
                            value: 'cancelled',
                        }, {
                            op: 'add',
                            path: "/statusHistory/-",
                            value: {
                                status: 'cancelled',
                                period: {
                                    start: now,
                                },
                            },
                        });
                        if (encounter.statusHistory && encounter.statusHistory.length > 0) {
                            previousStatusHistoryRecordIndex = encounter.statusHistory.findIndex(function (historyRecord) { return historyRecord.status === encounter.status; });
                            if (previousStatusHistoryRecordIndex !== -1 &&
                                !encounter.statusHistory[previousStatusHistoryRecordIndex].period.end) {
                                encounterPatchOperations.push({
                                    op: 'add',
                                    path: "/statusHistory/".concat(previousStatusHistoryRecordIndex, "/period/end"),
                                    value: now,
                                });
                            }
                        }
                    }
                    appointmentPatchRequest = (0, utils_1.getPatchBinary)({
                        resourceType: 'Appointment',
                        resourceId: appointmentID,
                        patchOperations: appointmentPatchOperations,
                    });
                    encounterPatchRequest = (0, utils_1.getPatchBinary)({
                        resourceType: 'Encounter',
                        resourceId: (encounter === null || encounter === void 0 ? void 0 : encounter.id) || 'Unknown',
                        patchOperations: encounterPatchOperations,
                    });
                    getAppointmentRequest = {
                        url: "/Appointment?_id=".concat(appointmentID, "&_include=Appointment:patient&_include=Appointment:location"),
                        method: 'GET',
                    };
                    console.log('making transaction request for getAppointmentRequest, appointmentPatchRequest, encounterPatchRequest');
                    requests = [getAppointmentRequest, appointmentPatchRequest];
                    if (encounterPatchOperations.length > 0) {
                        requests.push(encounterPatchRequest);
                    }
                    return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
                case 2:
                    transactionBundle = _d.sent();
                    console.log('getting appointment from transaction bundle');
                    _c = (0, shared_1.validateBundleAndExtractAppointment)(transactionBundle), appointment = _c.appointment, patient = _c.patient;
                    console.groupEnd();
                    console.debug('gettingEmailProps success');
                    console.log("canceling appointment with id ".concat(appointmentID));
                    return [4 /*yield*/, (0, utils_1.cancelAppointmentResource)(appointment, [
                            {
                                // todo reassess codes and reasons, just using custom codes atm
                                system: "".concat(utils_1.FHIR_ZAPEHR_URL, "/CodeSystem/appointment-cancellation-reason"),
                                code: cancellationReason.value,
                                display: cancellationReasonAdditional || cancellationReason.label,
                            },
                        ], oystehr)];
                case 3:
                    _d.sent();
                    response = {};
                    console.group('sendCancellationEmail');
                    locationId = (0, utils_1.getLocationIdFromAppointment)(appointment);
                    if (!locationId) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, utils_1.getLocationResource)(locationId, oystehr)];
                case 4:
                    location = _d.sent();
                    _d.label = 5;
                case 5:
                    locationName = location === null || location === void 0 ? void 0 : location.name;
                    _d.label = 6;
                case 6:
                    _d.trys.push([6, 10, , 11]);
                    email = (0, utils_1.getPatientContactEmail)(patient);
                    if (!email) return [3 /*break*/, 8];
                    emailClient = (0, shared_1.getEmailClient)(secrets);
                    WEBSITE_URL = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                    templateData = {
                        'book-again-url': "".concat(WEBSITE_URL, "/welcome"),
                        location: locationName,
                    };
                    return [4 /*yield*/, emailClient.sendVirtualCancelationEmail(email, templateData)];
                case 7:
                    _d.sent();
                    return [3 /*break*/, 9];
                case 8: throw Error('no email found');
                case 9: return [3 /*break*/, 11];
                case 10:
                    error_2 = _d.sent();
                    console.error('error sending cancellation email', error_2);
                    (0, aws_serverless_1.captureException)(error_2);
                    return [3 /*break*/, 11];
                case 11:
                    console.groupEnd();
                    console.log('Send cancel message request');
                    return [4 /*yield*/, (0, utils_1.getRelatedPersonForPatient)(patient.id || '', oystehr)];
                case 12:
                    relatedPerson = _d.sent();
                    if (!relatedPerson) return [3 /*break*/, 14];
                    message = "Sorry to see you go. Questions? Call ".concat((0, utils_1.getSupportPhoneFor)(locationName), " ");
                    ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                    return [4 /*yield*/, (0, shared_1.sendSms)(message, "RelatedPerson/".concat(relatedPerson.id), oystehr, ENVIRONMENT)];
                case 13:
                    _d.sent();
                    return [3 /*break*/, 15];
                case 14:
                    console.log("No RelatedPerson found for patient ".concat(patient.id, " not sending text message"));
                    _d.label = 15;
                case 15: return [4 /*yield*/, (0, shared_1.createAuditEvent)(shared_1.AuditableZambdaEndpoints.appointmentCancel, oystehr, input, patient.id || '', secrets)];
                case 16:
                    _d.sent();
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response),
                        }];
            }
        });
    });
}

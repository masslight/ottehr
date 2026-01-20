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
var validateRequestParameters_1 = require("../validateRequestParameters");
var oystehrToken;
var ZAMBDA_NAME = 'sub-cancellation-email';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, task, secrets, oystehr, taskStatusToUpdate, statusReasonToUpdate, appointmentID, fhirAppointment_1, fhirLocation_1, fhirPatient_1, allResources, missingResources, email, timezone, startTime, emailClient, WEBSITE_URL, readableTime, address, location_1, isVirtual, locationName, templateData, templateData, error_1, patchedTask, response, error_2, ENVIRONMENT;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 15, , 16]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                task = validatedParameters.task, secrets = validatedParameters.secrets;
                console.log('task ID', task.id);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _f.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _f.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                taskStatusToUpdate = void 0;
                statusReasonToUpdate = void 0;
                console.log('getting appointment Id from the task');
                appointmentID = ((_a = task.focus) === null || _a === void 0 ? void 0 : _a.type) === 'Appointment' ? (_c = (_b = task.focus) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Appointment/', '') : undefined;
                console.log('appointment ID parsed: ', appointmentID);
                console.log('searching for appointment, location and patient resources related to this task');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            {
                                name: '_id',
                                value: appointmentID || '',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'RelatedPerson:patient',
                            },
                        ],
                    })];
            case 4:
                allResources = (_f.sent()).unbundle();
                console.log("number of resources returned ".concat(allResources.length));
                allResources.forEach(function (resource) {
                    if (resource.resourceType === 'Appointment') {
                        fhirAppointment_1 = resource;
                    }
                    if (resource.resourceType === 'Location') {
                        fhirLocation_1 = resource;
                    }
                    if (resource.resourceType === 'Patient') {
                        fhirPatient_1 = resource;
                    }
                });
                missingResources = [];
                if (!fhirAppointment_1)
                    missingResources.push('appointment');
                if (!fhirLocation_1)
                    missingResources.push('location');
                if (!fhirPatient_1)
                    missingResources.push('patient');
                if (!fhirAppointment_1 || !fhirLocation_1 || !fhirPatient_1) {
                    throw new Error("missing the following vital resources: ".concat(missingResources.join(',')));
                }
                console.log('formatting information included in email');
                email = (0, utils_1.getPatientContactEmail)(fhirPatient_1);
                timezone = (_e = (_d = fhirLocation_1.extension) === null || _d === void 0 ? void 0 : _d.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _e === void 0 ? void 0 : _e.valueString;
                startTime = luxon_1.DateTime.fromISO((fhirAppointment_1 === null || fhirAppointment_1 === void 0 ? void 0 : fhirAppointment_1.start) || '').setZone(timezone);
                if (!email) return [3 /*break*/, 12];
                console.group('sendCancellationEmail');
                _f.label = 5;
            case 5:
                _f.trys.push([5, 10, , 11]);
                emailClient = (0, shared_1.getEmailClient)(secrets);
                WEBSITE_URL = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                readableTime = startTime.toFormat(utils_1.DATETIME_FULL_NO_YEAR);
                address = (0, utils_1.getAddressStringForScheduleResource)(fhirLocation_1);
                if (!address) {
                    throw new Error('Address is required to send reminder email');
                }
                location_1 = (0, utils_1.getNameFromScheduleResource)(fhirLocation_1);
                if (!location_1) {
                    throw new Error('Location is required to send reminder email');
                }
                isVirtual = (0, utils_1.isTelemedAppointment)(fhirAppointment_1);
                if (!isVirtual) return [3 /*break*/, 7];
                locationName = fhirLocation_1 === null || fhirLocation_1 === void 0 ? void 0 : fhirLocation_1.name;
                templateData = {
                    'book-again-url': "".concat(WEBSITE_URL, "/welcome"),
                    location: locationName,
                };
                return [4 /*yield*/, emailClient.sendVirtualCancelationEmail(email, templateData)];
            case 6:
                _f.sent();
                return [3 /*break*/, 9];
            case 7:
                templateData = {
                    time: readableTime,
                    location: location_1,
                    address: address,
                    'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(address || '')),
                    'book-again-url': "".concat(WEBSITE_URL, "/home"),
                };
                return [4 /*yield*/, emailClient.sendInPersonCancelationEmail(email, templateData)];
            case 8:
                _f.sent();
                _f.label = 9;
            case 9:
                taskStatusToUpdate = 'completed';
                statusReasonToUpdate = 'email sent successfully';
                console.groupEnd();
                return [3 /*break*/, 11];
            case 10:
                error_1 = _f.sent();
                taskStatusToUpdate = 'failed';
                statusReasonToUpdate = error_1.message ? "error received: ".concat(error_1.message) : 'unknown error';
                console.error('error sending email', error_1);
                console.groupEnd();
                (0, aws_serverless_1.captureException)(error_1);
                return [3 /*break*/, 11];
            case 11: return [3 /*break*/, 13];
            case 12:
                taskStatusToUpdate = 'failed';
                statusReasonToUpdate = 'could not find email for patient';
                console.log('No email found. Skipping sending email.');
                _f.label = 13;
            case 13:
                if (!taskStatusToUpdate) {
                    console.log('no task was attempted');
                    taskStatusToUpdate = 'failed';
                    statusReasonToUpdate = 'no task was attempted';
                }
                // update task status and status reason
                console.log('making patch request to update task status');
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Task',
                        id: task.id || '',
                        operations: [
                            {
                                op: 'replace',
                                path: '/status',
                                value: taskStatusToUpdate,
                            },
                            {
                                op: 'add',
                                path: '/statusReason',
                                value: {
                                    coding: [
                                        {
                                            system: 'status-reason',
                                            code: statusReasonToUpdate || 'no reason given',
                                        },
                                    ],
                                },
                            },
                        ],
                    })];
            case 14:
                patchedTask = _f.sent();
                console.log('successfully patched task');
                console.log(JSON.stringify(patchedTask));
                response = {
                    taskStatus: taskStatusToUpdate,
                    statusReason: statusReasonToUpdate,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 15:
                error_2 = _f.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('sub-cancellation-email', error_2, ENVIRONMENT)];
            case 16: return [2 /*return*/];
        }
    });
}); });

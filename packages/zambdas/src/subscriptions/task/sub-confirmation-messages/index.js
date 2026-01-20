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
var helpers_1 = require("../../helpers");
var validateRequestParameters_1 = require("../validateRequestParameters");
var oystehrToken;
var ZAMBDA_NAME = 'sub-confirmation-messages';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, task, secrets, oystehr, taskStatusToUpdate, statusReasonToUpdate, appointmentID, fhirAppointment_1, fhirSchedule_1, fhirPatient_1, fhirRelatedPerson_1, allResources, missingResources, timezone, visitType, startTime, readableTime, emailOutcome, smsOutcome, isTelemed, patientEmail, firstName, ownerName, emailClient, templateData, e_1, url, prep, message, messageRecipient, commId, e_2, emailClient, WEBSITE_URL, address, rescheduleUrl, templateData, e_3, appointmentType, WEBSITE_URL, firstName_1, prep, messageAll, message, messageRecipient, commId, e_4, err_1, patchedTask, response, error_1, ENVIRONMENT;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                _k.trys.push([0, 27, , 28]);
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
                oystehrToken = _k.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _k.label = 3;
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
                                value: 'Appointment:actor:HealthcareService',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:actor:Practitioner',
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
                allResources = (_k.sent()).unbundle();
                console.log("number of resources returned ".concat(allResources.length));
                allResources.forEach(function (resource) {
                    var _a;
                    if (resource.resourceType === 'Appointment') {
                        fhirAppointment_1 = resource;
                    }
                    if (resource.resourceType === 'Location') {
                        fhirSchedule_1 = resource;
                    }
                    if (resource.resourceType === 'HealthcareService') {
                        fhirSchedule_1 = resource;
                    }
                    if (resource.resourceType === 'Practitioner') {
                        fhirSchedule_1 = resource;
                    }
                    if (resource.resourceType === 'Patient') {
                        fhirPatient_1 = resource;
                    }
                    if (resource.resourceType === 'RelatedPerson') {
                        var relatedPerson = resource;
                        var isUserRelatedPerson = (_a = relatedPerson.relationship) === null || _a === void 0 ? void 0 : _a.find(function (relationship) { var _a; return (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.find(function (code) { return code.code === 'user-relatedperson'; }); });
                        if (isUserRelatedPerson) {
                            fhirRelatedPerson_1 = relatedPerson;
                        }
                    }
                });
                missingResources = [];
                if (!fhirAppointment_1)
                    missingResources.push('appointment');
                if (!fhirSchedule_1)
                    missingResources.push('location, healthcare service, or practitioner');
                if (!fhirPatient_1)
                    missingResources.push('patient');
                if (!fhirAppointment_1 || !fhirSchedule_1 || !fhirPatient_1) {
                    throw new Error("missing the following vital resources: ".concat(missingResources.join(';')));
                }
                timezone = (_e = (_d = fhirSchedule_1.extension) === null || _d === void 0 ? void 0 : _d.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _e === void 0 ? void 0 : _e.valueString;
                visitType = (_g = (_f = fhirAppointment_1.appointmentType) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : 'Unknown';
                console.log('sending confirmation messages for new appointment');
                startTime = (visitType === utils_1.VisitType.WalkIn ? luxon_1.DateTime.now() : luxon_1.DateTime.fromISO((_h = fhirAppointment_1.start) !== null && _h !== void 0 ? _h : '')).setZone(timezone);
                readableTime = startTime.toFormat(utils_1.DATETIME_FULL_NO_YEAR);
                emailOutcome = 'skipped';
                smsOutcome = 'skipped';
                if (!(fhirAppointment_1.id && startTime.isValid)) return [3 /*break*/, 24];
                isTelemed = (0, utils_1.isTelemedAppointment)(fhirAppointment_1);
                patientEmail = (0, utils_1.getPatientContactEmail)(fhirPatient_1);
                firstName = (0, utils_1.getPatientFirstName)(fhirPatient_1);
                ownerName = (0, utils_1.getNameFromScheduleResource)(fhirSchedule_1);
                _k.label = 5;
            case 5:
                _k.trys.push([5, 21, 22, 23]);
                if (!isTelemed) return [3 /*break*/, 13];
                if (!patientEmail) return [3 /*break*/, 9];
                _k.label = 6;
            case 6:
                _k.trys.push([6, 8, , 9]);
                emailClient = (0, shared_1.getEmailClient)(secrets);
                if (!ownerName) {
                    if (emailClient.getFeatureFlag()) {
                        throw new Error('Location is required to send reminder email');
                    }
                    else {
                        ownerName = 'Test Location'; // placeholder location for local dev when email sending is disabled
                    }
                }
                templateData = {
                    location: ownerName,
                    'cancel-visit-url': (0, shared_1.makeCancelVisitUrl)(fhirAppointment_1.id, secrets),
                    'paperwork-url': (0, shared_1.makePaperworkUrl)(fhirAppointment_1.id, secrets),
                    'join-visit-url': (0, shared_1.makeJoinVisitUrl)(fhirAppointment_1.id, secrets),
                };
                return [4 /*yield*/, emailClient.sendVirtualConfirmationEmail(patientEmail, templateData)];
            case 7:
                _k.sent();
                console.log('telemed confirmation email sent');
                emailOutcome = 'success';
                return [3 /*break*/, 9];
            case 8:
                e_1 = _k.sent();
                console.log('telemed confirmation email send error: ', JSON.stringify(e_1));
                emailOutcome = 'failed';
                (0, aws_serverless_1.captureException)(e_1);
                return [3 /*break*/, 9];
            case 9:
                _k.trys.push([9, 11, , 12]);
                if (!ownerName) {
                    throw new Error('Location with name is required to send confirmation message');
                }
                url = (0, shared_1.makeVisitLandingUrl)(fhirAppointment_1.id, secrets);
                prep = fhirSchedule_1.resourceType === 'Location' ? 'at' : 'with';
                message = "You're confirmed! Thanks for choosing ".concat(utils_1.BRANDING_CONFIG.projectName, "! Your check-in time for ").concat(firstName, " ").concat(prep, " ").concat(ownerName, " is ").concat(readableTime, ". Use this URL ").concat(url, " to: 1. Complete your pre-visit paperwork 2. Once you've completed the paperwork, you may join the session.");
                messageRecipient = "RelatedPerson/".concat(fhirRelatedPerson_1 === null || fhirRelatedPerson_1 === void 0 ? void 0 : fhirRelatedPerson_1.id);
                return [4 /*yield*/, oystehr.transactionalSMS.send({
                        message: message,
                        resource: messageRecipient,
                    })];
            case 10:
                commId = _k.sent();
                console.log('message send successful', commId);
                smsOutcome = 'success';
                return [3 /*break*/, 12];
            case 11:
                e_2 = _k.sent();
                console.log('message send error: ', JSON.stringify(e_2));
                smsOutcome = 'failed';
                (0, aws_serverless_1.captureException)(e_2);
                return [3 /*break*/, 12];
            case 12: return [3 /*break*/, 20];
            case 13:
                if (!patientEmail) return [3 /*break*/, 17];
                _k.label = 14;
            case 14:
                _k.trys.push([14, 16, , 17]);
                console.log('in person confirmation email sent');
                emailOutcome = 'success';
                emailClient = (0, shared_1.getEmailClient)(secrets);
                WEBSITE_URL = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                address = (0, utils_1.getAddressStringForScheduleResource)(fhirSchedule_1);
                if (!address) {
                    if (emailClient.getFeatureFlag()) {
                        throw new Error('Address is required to send reminder email');
                    }
                    else {
                        // cSpell:disable-next Any town
                        address = '123 Main St, Anytown, USA'; // placeholder address for local dev when email sending is disabled
                    }
                }
                if (!ownerName) {
                    if (emailClient.getFeatureFlag()) {
                        throw new Error('Location is required to send reminder email');
                    }
                    else {
                        ownerName = 'Test Location'; // placeholder location for local dev when email sending is disabled
                    }
                }
                rescheduleUrl = "".concat(WEBSITE_URL, "/visit/").concat(appointmentID, "/reschedule");
                templateData = {
                    time: readableTime,
                    location: ownerName,
                    address: address,
                    'address-url': "https://www.google.com/maps/search/?api=1&query=".concat(encodeURI(address || '')),
                    'modify-visit-url': rescheduleUrl,
                    'cancel-visit-url': "".concat(WEBSITE_URL, "/visit/").concat(appointmentID, "/cancel"),
                    'paperwork-url': "".concat(WEBSITE_URL, "/paperwork/").concat(appointmentID),
                };
                return [4 /*yield*/, emailClient.sendInPersonConfirmationEmail(patientEmail, templateData)];
            case 15:
                _k.sent();
                return [3 /*break*/, 17];
            case 16:
                e_3 = _k.sent();
                console.log('in person confirmation email send error: ', JSON.stringify(e_3));
                emailOutcome = 'failed';
                (0, aws_serverless_1.captureException)(e_3);
                return [3 /*break*/, 17];
            case 17:
                _k.trys.push([17, 19, , 20]);
                appointmentType = ((_j = fhirAppointment_1.appointmentType) === null || _j === void 0 ? void 0 : _j.text) || '';
                WEBSITE_URL = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                firstName_1 = (0, utils_1.getPatientFirstName)(fhirPatient_1);
                prep = fhirSchedule_1.resourceType === 'Location' ? 'at' : 'with';
                messageAll = "Thanks for choosing ".concat(utils_1.BRANDING_CONFIG.projectName, "! Your check-in time for ").concat(firstName_1, " ").concat(prep, " ").concat(ownerName, " is ").concat(readableTime, ". Please save time at check-in by completing your pre-visit paperwork");
                message = appointmentType === 'walkin' || appointmentType === 'posttelemed'
                    ? "".concat(messageAll, ": ").concat(WEBSITE_URL, "/paperwork/").concat(appointmentID)
                    : "You're confirmed! ".concat(messageAll, ", or modify/cancel your visit: ").concat(WEBSITE_URL, "/visit/").concat(appointmentID);
                messageRecipient = "RelatedPerson/".concat(fhirRelatedPerson_1 === null || fhirRelatedPerson_1 === void 0 ? void 0 : fhirRelatedPerson_1.id);
                return [4 /*yield*/, oystehr.transactionalSMS.send({
                        message: message,
                        resource: messageRecipient,
                    })];
            case 18:
                commId = _k.sent();
                console.log('message send successful', commId);
                smsOutcome = 'success';
                return [3 /*break*/, 20];
            case 19:
                e_4 = _k.sent();
                console.log('message send error: ', JSON.stringify(e_4));
                smsOutcome = 'failed';
                return [3 /*break*/, 20];
            case 20:
                if (emailOutcome === 'failed' || smsOutcome === 'failed') {
                    taskStatusToUpdate = 'failed';
                }
                else {
                    taskStatusToUpdate = 'completed';
                }
                return [3 /*break*/, 23];
            case 21:
                err_1 = _k.sent();
                console.log('failed to send messages', err_1, JSON.stringify(err_1));
                (0, aws_serverless_1.captureException)(err_1);
                taskStatusToUpdate = 'failed';
                return [3 /*break*/, 23];
            case 22:
                statusReasonToUpdate = "send email status: ".concat(emailOutcome, "; send sms status: ").concat(smsOutcome);
                return [7 /*endfinally*/];
            case 23: return [3 /*break*/, 25];
            case 24:
                console.log('invalid appointment ID or start time. skipping sending confirmation messages.');
                taskStatusToUpdate = 'failed';
                statusReasonToUpdate = 'Appointment Id or start time missing/invalid';
                _k.label = 25;
            case 25:
                // update task status and status reason
                console.log('making patch request to update task status');
                return [4 /*yield*/, (0, helpers_1.patchTaskStatus)({ task: task, taskStatusToUpdate: taskStatusToUpdate, statusReasonToUpdate: statusReasonToUpdate }, oystehr)];
            case 26:
                patchedTask = _k.sent();
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
            case 27:
                error_1 = _k.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('sub-confirmation-messages', error_1, ENVIRONMENT)];
            case 28: return [2 /*return*/];
        }
    });
}); });

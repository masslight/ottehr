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
var helpers_1 = require("../../../shared/helpers");
var helpers_2 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'communication-subscription';
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, communication, secrets, oystehr, ENVIRONMENT, communicationCodes, communicationStatusToUpdate, groupID, groupGetRequest, locationID, locationGetRequest, practitionerID, practitionerGetRequest, appointmentID, bundle, bundleResources, _i, _a, entry, innerBundle, innerEntries, _b, innerEntries_1, item, resource, submitter, fhirLocation, fhirGroup, submitterName, submitterEmail, PROJECT_API, headers, getUserByProfileResponse, retrievedUser, error_1, submitterDetails, slackMessage, error_2, practitionersEmails, toEmail, errorMessage, emailClient, error_3, response, error_4, ENVIRONMENT;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    return __generator(this, function (_v) {
        switch (_v.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                _v.label = 1;
            case 1:
                _v.trys.push([1, 21, , 22]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                communication = validatedParameters.communication, secrets = validatedParameters.secrets;
                console.log('communication ID', communication.id);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (['not-done', 'completed'].includes(communication.status)) {
                    console.log("task is marked ".concat(communication.status));
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: "communication has already been marked ".concat(communication.status),
                        }];
                }
                if (!!oystehrToken) return [3 /*break*/, 3];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 2:
                oystehrToken = _v.sent();
                return [3 /*break*/, 4];
            case 3:
                console.log('already have token');
                _v.label = 4;
            case 4:
                oystehr = (0, helpers_1.createOystehrClient)(oystehrToken, secrets);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                communicationCodes = communication.category;
                console.log('communicationCodes', JSON.stringify(communicationCodes));
                communicationStatusToUpdate = void 0;
                if (!(0, helpers_2.codingContainedInList)(utils_1.COMMUNICATION_ISSUE_REPORT_CODE, communicationCodes)) return [3 /*break*/, 19];
                console.log('alerting for issue report');
                groupID = (0, utils_1.getSecret)(utils_1.SecretsKeys.INTAKE_ISSUE_REPORT_EMAIL_GROUP_ID, secrets);
                groupGetRequest = {
                    method: 'GET',
                    url: "/Group?_id=".concat(groupID),
                };
                locationID = (_e = (_d = (_c = communication.about) === null || _c === void 0 ? void 0 : _c.find(function (ref) { return ref.type === 'Location'; })) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.replace('Location/', '');
                locationGetRequest = {
                    method: 'GET',
                    url: "/Location?_id=".concat(locationID),
                };
                practitionerID = (_g = (_f = communication.sender) === null || _f === void 0 ? void 0 : _f.reference) === null || _g === void 0 ? void 0 : _g.replace('Practitioner/', '');
                practitionerGetRequest = {
                    method: 'GET',
                    url: "/Practitioner?_id=".concat(practitionerID),
                };
                appointmentID = (_k = (_j = (_h = communication.about) === null || _h === void 0 ? void 0 : _h.find(function (ref) { return ref.type === 'Appointment'; })) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.replace('Appointment/', '');
                console.log('getting fhir resources for issue report alerting');
                console.log('groupID, locationID, practitionerID', groupID, locationID, practitionerID);
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: [groupGetRequest, locationGetRequest, practitionerGetRequest],
                    })];
            case 5:
                bundle = _v.sent();
                bundleResources = {};
                if (bundle.entry) {
                    for (_i = 0, _a = bundle.entry; _i < _a.length; _i++) {
                        entry = _a[_i];
                        if (((_m = (_l = entry.response) === null || _l === void 0 ? void 0 : _l.outcome) === null || _m === void 0 ? void 0 : _m.id) === 'ok' &&
                            entry.resource &&
                            entry.resource.resourceType === 'Bundle' &&
                            entry.resource.type === 'searchset') {
                            innerBundle = entry.resource;
                            innerEntries = innerBundle.entry;
                            if (innerEntries) {
                                for (_b = 0, innerEntries_1 = innerEntries; _b < innerEntries_1.length; _b++) {
                                    item = innerEntries_1[_b];
                                    resource = item.resource;
                                    if (resource) {
                                        if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Group') {
                                            bundleResources.group = resource;
                                        }
                                        if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Location') {
                                            bundleResources.location = resource;
                                        }
                                        if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Practitioner') {
                                            bundleResources.practitioner = resource;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                submitter = bundleResources.practitioner;
                fhirLocation = bundleResources.location;
                fhirGroup = bundleResources.group;
                submitterName = submitter && (0, utils_1.getFullestAvailableName)(submitter);
                submitterEmail = '';
                _v.label = 6;
            case 6:
                _v.trys.push([6, 9, , 10]);
                PROJECT_API = (0, utils_1.getSecret)('PROJECT_API', secrets);
                headers = {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    Authorization: "Bearer ".concat(oystehrToken),
                };
                return [4 /*yield*/, fetch("".concat(PROJECT_API, "/user/v2/list?profile=Practitioner/").concat(practitionerID), {
                        method: 'GET',
                        headers: headers,
                    })];
            case 7:
                getUserByProfileResponse = _v.sent();
                if (!getUserByProfileResponse.ok) {
                    console.error('Failed to get user from a given Practitioner ID profile');
                }
                return [4 /*yield*/, getUserByProfileResponse.json()];
            case 8:
                retrievedUser = _v.sent();
                if (submitterName == undefined) {
                    submitterName = "".concat((_p = (_o = retrievedUser === null || retrievedUser === void 0 ? void 0 : retrievedUser.data) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.name);
                }
                submitterEmail = "".concat((_r = (_q = retrievedUser === null || retrievedUser === void 0 ? void 0 : retrievedUser.data) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.email);
                return [3 /*break*/, 10];
            case 9:
                error_1 = _v.sent();
                console.error('Fetch call failed with error: ', error_1);
                (0, aws_serverless_1.captureException)(error_1);
                return [3 /*break*/, 10];
            case 10:
                submitterDetails = "Submitter name: ".concat(submitterName, ", Submitter email: ").concat(submitterEmail, ", Submitter id: ").concat(submitter === null || submitter === void 0 ? void 0 : submitter.id);
                console.log('sending slack message');
                slackMessage = "An issue report has been submitted from ".concat(fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.name, ". Check payload in communication resource ").concat(communication.id, " for more information");
                _v.label = 11;
            case 11:
                _v.trys.push([11, 13, , 14]);
                return [4 /*yield*/, (0, shared_1.sendSlackNotification)(slackMessage, ENVIRONMENT)];
            case 12:
                _v.sent();
                communicationStatusToUpdate = 'completed';
                return [3 /*break*/, 14];
            case 13:
                error_2 = _v.sent();
                (0, aws_serverless_1.captureException)(error_2);
                console.log('could not send slack notification');
                return [3 /*break*/, 14];
            case 14:
                console.log('getting emails');
                return [4 /*yield*/, (0, helpers_2.getEmailsFromGroup)(fhirGroup, oystehr)];
            case 15:
                practitionersEmails = _v.sent();
                console.log('practitionersEmails', practitionersEmails);
                toEmail = ['ottehr-support@ottehr.com'];
                if (practitionersEmails) {
                    toEmail.push.apply(toEmail, practitionersEmails);
                }
                errorMessage = "Details: ".concat((_s = communication.payload) === null || _s === void 0 ? void 0 : _s[0].contentString, " <br> Submitted By: ").concat(submitterDetails, " <br> Location: ").concat(fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.name, " - ").concat((_t = fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.address) === null || _t === void 0 ? void 0 : _t.city, ", ").concat((_u = fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.address) === null || _u === void 0 ? void 0 : _u.state, " <br> Appointment Id: ").concat(appointmentID, " <br> Communication Fhir Resource: ").concat(communication.id);
                console.log("Sending issue report email to ".concat(toEmail));
                _v.label = 16;
            case 16:
                _v.trys.push([16, 18, , 19]);
                emailClient = (0, shared_1.getEmailClient)(secrets);
                return [4 /*yield*/, emailClient.sendErrorEmail(toEmail, {
                        environment: ENVIRONMENT,
                        'error-message': errorMessage,
                        timestamp: luxon_1.DateTime.now().setZone('UTC').toFormat("EEEE, MMMM d, yyyy 'at' h:mm a ZZZZ"),
                    })];
            case 17:
                _v.sent();
                communicationStatusToUpdate = 'completed';
                return [3 /*break*/, 19];
            case 18:
                error_3 = _v.sent();
                (0, aws_serverless_1.captureException)(error_3);
                console.error("Error sending email to ".concat(toEmail, ": ").concat(JSON.stringify(error_3)));
                return [3 /*break*/, 19];
            case 19:
                if (!communicationStatusToUpdate) {
                    console.log('no communication was attempted');
                    communicationStatusToUpdate = 'not-done';
                }
                console.log('making patch request to update communication status');
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Communication',
                        id: communication.id || '',
                        operations: [
                            {
                                op: 'replace',
                                path: '/status',
                                value: communicationStatusToUpdate,
                            },
                        ],
                    })];
            case 20:
                _v.sent();
                response = {
                    communicationStatus: communicationStatusToUpdate,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 21:
                error_4 = _v.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-communication-subscription', error_4, ENVIRONMENT)];
            case 22: return [2 /*return*/];
        }
    });
}); });

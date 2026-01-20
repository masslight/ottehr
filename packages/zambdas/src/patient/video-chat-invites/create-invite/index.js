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
var jose_1 = require("jose");
var jsonpath_plus_1 = require("jsonpath-plus");
var utils_1 = require("utils");
var shared_1 = require("../../../ehr/schedules/shared");
var shared_2 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'telemed-create-invites';
exports.index = (0, shared_2.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var authorization, validatedParameters, appointmentId, firstName, lastName, phoneNumber, emailAddress, secrets, websiteUrl, telemedClientSecret, user, error_1, oystehr, _a, encounter, appointment, relatedPersons, patient, location_1, emailAddresses, patientRef, relatedPerson, relatedPersonRef, secret, alg, jwt, inviteUrl, chosenName, patientChosenName, locationName, emailClient, rawPhone, phone, message, ENVIRONMENT, result, error_2;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0:
                _m.trys.push([0, 16, , 17]);
                authorization = input.headers.Authorization;
                if (!authorization) {
                    console.log('User is not authenticated yet');
                    return [2 /*return*/, (0, shared_2.lambdaResponse)(401, { message: 'Unauthorized' })];
                }
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                }
                catch (error) {
                    console.log(error);
                    return [2 /*return*/, (0, shared_2.lambdaResponse)(400, { message: error.message })];
                }
                appointmentId = validatedParameters.appointmentId, firstName = validatedParameters.firstName, lastName = validatedParameters.lastName, phoneNumber = validatedParameters.phoneNumber, emailAddress = validatedParameters.emailAddress, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                websiteUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.WEBSITE_URL, secrets);
                telemedClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.AUTH0_SECRET, secrets);
                user = void 0;
                _m.label = 1;
            case 1:
                _m.trys.push([1, 3, , 4]);
                console.log('getting user');
                return [4 /*yield*/, (0, shared_2.getUser)(authorization.replace('Bearer ', ''), secrets)];
            case 2:
                user = _m.sent();
                console.log("user: ".concat(user.name));
                return [3 /*break*/, 4];
            case 3:
                error_1 = _m.sent();
                console.log('getUser error:', error_1);
                return [2 /*return*/, (0, shared_2.lambdaResponse)(401, { message: 'Unauthorized' })];
            case 4:
                if (!!oystehrToken) return [3 /*break*/, 6];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_2.getAuth0Token)(secrets)];
            case 5:
                oystehrToken = _m.sent(); // keeping token externally for reuse
                return [3 /*break*/, 7];
            case 6:
                console.log('already have a token, no need to update');
                _m.label = 7;
            case 7:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                return [4 /*yield*/, getAppointmentResources(oystehr, appointmentId)];
            case 8:
                _a = _m.sent(), encounter = _a.encounter, appointment = _a.appointment, relatedPersons = _a.relatedPersons, patient = _a.patient, location_1 = _a.location;
                emailAddresses = (0, jsonpath_plus_1.JSONPath)({
                    path: '$..telecom[?(@.system == "email")].value',
                    json: relatedPersons,
                });
                console.log('Email addresses invited so far:', emailAddresses);
                if (emailAddresses.includes(emailAddress)) {
                    console.log("Email address '".concat(emailAddress, "' is already invited."));
                    return [2 /*return*/, (0, shared_2.lambdaResponse)(400, { message: "Email address '".concat(emailAddress, "' is already invited.") })];
                }
                patientRef = (_c = (_b = appointment.participant.find(function (p) { var _a, _b; return ((_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.match(/^Patient/)) !== null; })) === null || _b === void 0 ? void 0 : _b.actor) === null || _c === void 0 ? void 0 : _c.reference;
                console.log('Patient reference from appointment:', patientRef);
                if (!patientRef) {
                    throw new Error('Could not find the patient reference in appointment resource.');
                }
                return [4 /*yield*/, createRelatedPerson(firstName, lastName, phoneNumber, emailAddress, patientRef, oystehr)];
            case 9:
                relatedPerson = _m.sent();
                console.log('Created RelatedPerson.id:', relatedPerson.id);
                relatedPersonRef = "RelatedPerson/".concat(relatedPerson.id);
                return [4 /*yield*/, addParticipantToEncounterIfNeeded(encounter, relatedPersonRef, oystehr)];
            case 10:
                _m.sent();
                secret = new TextEncoder().encode(telemedClientSecret);
                alg = 'HS256';
                return [4 /*yield*/, new jose_1.SignJWT()
                        .setProtectedHeader({ alg: alg })
                        .setIssuedAt()
                        .setIssuer(utils_1.PROJECT_WEBSITE)
                        .setSubject(emailAddress || phoneNumber)
                        .setAudience("".concat(websiteUrl, "/waiting-room/appointment/").concat(appointmentId))
                        .setExpirationTime('24h')
                        .sign(secret)];
            case 11:
                jwt = _m.sent();
                inviteUrl = "".concat(websiteUrl, "/invited-waiting-room?appointment_id=").concat(appointmentId, "&token=").concat(jwt);
                chosenName = (_f = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.name) === null || _d === void 0 ? void 0 : _d.find(function (name) { return name.use === 'nickname'; })) === null || _e === void 0 ? void 0 : _e.given) === null || _f === void 0 ? void 0 : _f[0];
                patientChosenName = chosenName || ((_h = (_g = patient === null || patient === void 0 ? void 0 : patient.name) === null || _g === void 0 ? void 0 : _g[0].given) === null || _h === void 0 ? void 0 : _h[0]) || 'Patient';
                locationName = location_1 ? (_j = (0, shared_1.getNameForOwner)(location_1)) !== null && _j !== void 0 ? _j : '' : '';
                if (!emailAddress) return [3 /*break*/, 13];
                emailClient = (0, shared_2.getEmailClient)(secrets);
                return [4 /*yield*/, emailClient.sendVideoChatInvitationEmail(emailAddress, {
                        'join-visit-url': inviteUrl,
                        'patient-name': patientChosenName,
                        location: locationName,
                    })];
            case 12:
                _m.sent();
                _m.label = 13;
            case 13:
                if (!relatedPerson) return [3 /*break*/, 15];
                rawPhone = (_l = (_k = relatedPerson.telecom) === null || _k === void 0 ? void 0 : _k.find(function (telecom) { return telecom.system === 'sms'; })) === null || _l === void 0 ? void 0 : _l.value;
                if (!rawPhone) return [3 /*break*/, 15];
                rawPhone = rawPhone.replace(/[()\s-]/g, '');
                phone = (0, utils_1.formatPhoneNumber)(rawPhone);
                message = "You have been invited to join a telemedicine visit with ".concat(patientChosenName, ". Please click ").concat(inviteUrl, " to join.");
                console.log("Sms data: recipient: ".concat(relatedPersonRef, "; verifiedPhoneNumber: ").concat(phone, ";"));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                return [4 /*yield*/, (0, shared_2.sendSms)(message, relatedPersonRef, oystehr, ENVIRONMENT)];
            case 14:
                _m.sent();
                _m.label = 15;
            case 15:
                result = {
                    inviteUrl: inviteUrl,
                };
                return [2 /*return*/, (0, shared_2.lambdaResponse)(200, result)];
            case 16:
                error_2 = _m.sent();
                console.log(error_2);
                return [2 /*return*/, (0, shared_2.topLevelCatch)('create-invite', error_2, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 17: return [2 /*return*/];
        }
    });
}); });
function createRelatedPerson(firstName, lastName, phoneNumber, emailAddress, fhirPatientRef, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var telecom, data, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    telecom = [];
                    if (emailAddress) {
                        telecom.push({
                            value: emailAddress,
                            system: 'email',
                        });
                    }
                    if (phoneNumber) {
                        telecom.push({
                            value: phoneNumber,
                            system: 'phone',
                        }, {
                            value: phoneNumber,
                            system: 'sms',
                        });
                    }
                    data = {
                        resourceType: 'RelatedPerson',
                        active: true,
                        name: [
                            {
                                given: [firstName],
                                family: lastName,
                            },
                        ],
                        patient: {
                            reference: fhirPatientRef,
                        },
                        relationship: [
                            {
                                coding: [
                                    {
                                        code: 'WIT',
                                        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                                    },
                                ],
                            },
                        ],
                        telecom: telecom,
                    };
                    return [4 /*yield*/, oystehr.fhir.create(data)];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
            }
        });
    });
}
function addParticipantToEncounterIfNeeded(encounter, fhirRelatedPersonRef, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var participants, patch, updatedEncounter, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 5]);
                    if (!(encounter.participant &&
                        encounter.participant.findIndex(function (p) { var _a; return ((_a = p.individual) === null || _a === void 0 ? void 0 : _a.reference) === fhirRelatedPersonRef; }) >= 0)) return [3 /*break*/, 1];
                    console.log("RelatedPerson '".concat(fhirRelatedPersonRef, "' is already added to the encounter."));
                    console.log('Nothing to update for the encounter.');
                    return [2 /*return*/, encounter];
                case 1:
                    participants = __spreadArray([], ((_a = encounter.participant) !== null && _a !== void 0 ? _a : []), true);
                    participants.push({
                        individual: {
                            reference: fhirRelatedPersonRef,
                        },
                    });
                    patch = {
                        resourceType: 'Encounter',
                        id: (_b = encounter.id) !== null && _b !== void 0 ? _b : '',
                        operations: [
                            {
                                op: encounter.participant ? 'replace' : 'add',
                                path: '/participant',
                                value: participants,
                            },
                        ],
                    };
                    console.log('Encounter patch op:', JSON.stringify(patch, null, 4));
                    return [4 /*yield*/, oystehr.fhir.patch(patch)];
                case 2:
                    updatedEncounter = _c.sent();
                    console.log("Updated Encounter/".concat(updatedEncounter.id));
                    return [2 /*return*/, updatedEncounter];
                case 3: return [3 /*break*/, 5];
                case 4:
                    err_1 = _c.sent();
                    console.error('Error while trying to update video encounter with user participant.');
                    throw err_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getAppointmentResources(oystehr, appointmentId) {
    return __awaiter(this, void 0, void 0, function () {
        var response, resources, encounter, appointment, relatedPersons, patient, location;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: 'appointment',
                                value: "Appointment/".concat(appointmentId),
                            },
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: '_include',
                                value: 'Encounter:participant',
                            },
                            {
                                name: '_include',
                                value: 'Encounter:subject',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:location',
                            },
                        ],
                    })];
                case 1:
                    response = _a.sent();
                    resources = response.unbundle();
                    encounter = resources.find(function (r) {
                        return r.resourceType === 'Encounter' &&
                            Boolean((0, utils_1.getVirtualServiceResourceExtension)(r, utils_1.TELEMED_VIDEO_ROOM_CODE));
                    });
                    if (!encounter)
                        throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Encounter');
                    appointment = resources.find(function (r) {
                        var _a;
                        return r.id !== undefined &&
                            r.resourceType === 'Appointment' &&
                            ((_a = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _a === void 0 ? void 0 : _a.find(function (a) { var _a; return (_a = a.reference) === null || _a === void 0 ? void 0 : _a.includes(r.id); }));
                    });
                    if (!appointment)
                        throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Appointment');
                    relatedPersons = resources.filter(function (r) { var _a, _b, _c, _d; return r.resourceType === 'RelatedPerson' && ((_d = (_c = (_b = (_a = r.relationship) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.code) === 'WIT'; });
                    patient = resources.find(function (r) { return r.resourceType === 'Patient'; });
                    location = resources.find(function (r) { return r.resourceType === 'Location'; });
                    return [2 /*return*/, {
                            appointment: appointment,
                            encounter: encounter,
                            relatedPersons: relatedPersons,
                            patient: patient,
                            location: location,
                        }];
            }
        });
    });
}

"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var shared_1 = require("../../../shared");
var harvest_1 = require("../../shared/harvest");
var ZAMBDA_NAME = 'get-visit-details';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, resources, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                console.debug('complexValidation success', JSON.stringify(effectInput));
                resources = performEffect(effectInput);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(resources),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input) {
    var appointment = input.appointment, patient = input.patient, encounter = input.encounter, flags = input.flags, consents = input.consents, qr = input.qr, location = input.location, schedule = input.schedule, scheduleOwner = input.scheduleOwner, guarantorResource = input.guarantorResource;
    var firstConsent = consents && consents.length > 0 ? consents[0] : undefined;
    var visitTimezone = utils_1.TIMEZONES[0];
    if (schedule) {
        visitTimezone = (0, utils_1.getTimezone)(schedule);
    }
    else if (location) {
        visitTimezone = (0, utils_1.getTimezone)(location);
    }
    var responsiblePartyName = null;
    var responsiblePartyEmail = null;
    if (guarantorResource) {
        responsiblePartyName = (0, utils_1.getFullestAvailableName)(guarantorResource) || null;
        responsiblePartyEmail = (0, utils_1.getEmailForIndividual)(guarantorResource) || null;
    }
    var consentIsAttested = (0, utils_1.getAttestedConsentFromEncounter)(encounter) ? true : false;
    var output = {
        appointment: appointment,
        patient: patient,
        encounter: encounter,
        flags: flags,
        visitTimezone: visitTimezone,
        visitLocationName: undefined,
        consentDetails: firstConsent ? makeConsentDetails(firstConsent, visitTimezone, qr) : null,
        qrId: qr.id,
        visitLocationId: location === null || location === void 0 ? void 0 : location.id,
        responsiblePartyName: responsiblePartyName,
        responsiblePartyEmail: responsiblePartyEmail,
        consentIsAttested: consentIsAttested,
    };
    if (schedule) {
        output.visitTimezone = (0, utils_1.getTimezone)(schedule);
    }
    else if (location) {
        output.visitTimezone = (0, utils_1.getTimezone)(location);
    }
    if (scheduleOwner) {
        output.visitLocationName = (0, utils_1.getNameFromScheduleResource)(scheduleOwner) || undefined;
    }
    return output;
};
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, searchResults, appointment, patient, encounter, location, flags, qr, schedule, scheduleOwner, _a, resourceType_1, id_1, _b, docRefsAndConsents, accountResources, guarantorResource;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                appointmentId = input.appointmentId;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            { name: '_id', value: appointmentId },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:slot',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Encounter:appointment',
                            },
                            { name: '_revinclude:iterate', value: 'Flag:encounter' },
                            { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
                            {
                                name: '_include:iterate',
                                value: 'Slot:schedule',
                            },
                        ],
                    })];
            case 1:
                searchResults = (_c.sent()).unbundle();
                appointment = searchResults.find(function (resource) { return resource.resourceType === 'Appointment'; });
                patient = searchResults.find(function (resource) { return resource.resourceType === 'Patient'; });
                encounter = searchResults.find(function (resource) { return resource.resourceType === 'Encounter' && !(0, utils_1.isFollowupEncounter)(resource); });
                location = searchResults.find(function (resource) { return resource.resourceType === 'Location'; });
                flags = searchResults.filter(function (resource) { return resource.resourceType === 'Flag'; });
                qr = (0, utils_1.selectIntakeQuestionnaireResponse)(searchResults);
                schedule = searchResults.find(function (resource) { return resource.resourceType === 'Schedule'; });
                if (!appointment) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Appointment');
                }
                if (!patient || !patient.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Patient');
                }
                if (!encounter || !encounter.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Encounter');
                }
                if (!qr || !qr.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('QuestionnaireResponse');
                }
                scheduleOwner = undefined;
                if ((schedule === null || schedule === void 0 ? void 0 : schedule.actor) && schedule.actor.length > 0 && schedule.actor[0].reference) {
                    _a = schedule.actor[0].reference.split('/'), resourceType_1 = _a[0], id_1 = _a[1];
                    if (resourceType_1 && id_1) {
                        scheduleOwner = searchResults.find(function (resource) { return resource.resourceType === resourceType_1 && resource.id === id_1; });
                    }
                }
                return [4 /*yield*/, Promise.all([
                        (0, utils_1.getConsentAndRelatedDocRefsForAppointment)({
                            appointmentId: appointmentId,
                            patientId: patient.id,
                        }, oystehr),
                        (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patient.id, oystehr),
                    ])];
            case 2:
                _b = _c.sent(), docRefsAndConsents = _b[0], accountResources = _b[1];
                guarantorResource = accountResources.guarantorResource;
                return [2 /*return*/, __assign({ appointment: appointment, patient: patient, encounter: encounter, flags: flags, qr: qr, location: location, schedule: schedule, scheduleOwner: scheduleOwner, guarantorResource: guarantorResource }, docRefsAndConsents)];
        }
    });
}); };
var makeConsentDetails = function (consent, timezone, questionnaireResponse) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var flattenedPaperwork = (0, utils_1.flattenQuestionnaireAnswers)(questionnaireResponse.item || []);
    var signature = (_c = (_b = (_a = flattenedPaperwork.find(function (item) { return item.linkId === 'signature'; })) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var fullName = (_f = (_e = (_d = flattenedPaperwork.find(function (question) { return question.linkId === 'full-name'; })) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString;
    var relationshipToPatient = (_j = (_h = (_g = flattenedPaperwork.find(function (question) { return question.linkId === 'consent-form-signer-relationship'; })) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
    var ipAddress = (_l = (_k = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.extension) === null || _k === void 0 ? void 0 : _k.find(function (e) { return e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'; })) === null || _l === void 0 ? void 0 : _l.valueString;
    // todo: check if consent has contained signer data  https://github.com/masslight/ottehr/issues/4376
    var dateISO = consent.dateTime;
    var date = undefined;
    if (dateISO) {
        date = luxon_1.DateTime.fromISO(dateISO).setZone(timezone).toFormat(utils_1.DISPLAY_DATE_FORMAT);
    }
    if (signature && fullName && relationshipToPatient && date) {
        return {
            signature: signature,
            fullName: fullName,
            relationshipToPatient: relationshipToPatient,
            date: date,
            ipAddress: ipAddress,
        };
    }
    return null;
};
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
    // at some point and it should always be available, so throwing it in the input interface anticipatorily
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('user token unexpectedly missing');
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var appointmentId = JSON.parse(input.body).appointmentId;
    if (!appointmentId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['appointmentId']);
    }
    if ((0, utils_1.isValidUUID)(appointmentId) === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('appointmentId');
    }
    return {
        secrets: secrets,
        userToken: userToken,
        appointmentId: appointmentId,
    };
};

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
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var auth_1 = require("../../../shared/auth");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('get-paperwork', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentID, dateOfBirth, secrets, authorization, oystehr, appointment, location_1, hsResources, practitioner, baseCategoryResources, encounters, encounter, fhirPatient, questionnaireResponseResource, missingResources, _a, sourceQuestionnaireUrl, sourceQuestionnaireVersion, urlForQFetch, versionForQFetch, _b, questionnaire, valueSets, allItems, accessLevel, user, partialAppointment, updateTimestamp, formatPatientSexForPaperwork, response, _c, app, patient, response, error_1, ENVIRONMENT;
    var _d, _e, _f, _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                _l.trys.push([0, 11, , 12]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentID = validatedParameters.appointmentID, dateOfBirth = validatedParameters.dateOfBirth, secrets = validatedParameters.secrets, authorization = validatedParameters.authorization;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _l.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _l.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                appointment = undefined;
                location_1 = undefined;
                hsResources = undefined;
                practitioner = void 0;
                // only prebooked appointments will have an appointment id (is this true??)
                console.log("getting appointment, encounter, location, and patient resources for appointment id ".concat(appointmentID));
                console.time('get-appointment-encounter-location-patient');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_include',
                                value: 'Encounter:appointment',
                            },
                            {
                                name: 'appointment',
                                value: "".concat(appointmentID),
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:actor:HealthcareService',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:actor:Practitioner',
                            },
                            {
                                name: '_include',
                                value: 'Encounter:patient',
                            },
                            {
                                name: '_revinclude',
                                value: 'QuestionnaireResponse:encounter',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Appointment:slot',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Slot:schedule',
                            },
                        ],
                    })];
            case 4:
                baseCategoryResources = (_l.sent())
                    .unbundle()
                    .filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; });
                // parse retrieved resources
                appointment = baseCategoryResources.find(function (resource) {
                    return resource.resourceType == 'Appointment';
                });
                encounters = baseCategoryResources.filter(function (resource) {
                    return resource.resourceType == 'Encounter';
                });
                encounter = encounters === null || encounters === void 0 ? void 0 : encounters[0];
                hsResources = (0, utils_1.extractHealthcareServiceAndSupportingLocations)(baseCategoryResources);
                fhirPatient = baseCategoryResources.find(function (resource) {
                    return resource.resourceType == 'Patient';
                });
                if (hsResources === undefined) {
                    location_1 = baseCategoryResources.find(function (resource) {
                        return resource.resourceType == 'Location';
                    });
                    practitioner = baseCategoryResources.find(function (resource) {
                        return resource.resourceType == 'Practitioner';
                    });
                }
                questionnaireResponseResource = baseCategoryResources.find(function (resource) {
                    return resource.resourceType == 'QuestionnaireResponse';
                });
                missingResources = [];
                if (!appointment) {
                    missingResources.push('Appointment');
                }
                if (!encounter) {
                    missingResources.push('Encounter');
                }
                if (!location_1 && !hsResources && !practitioner) {
                    missingResources.push('Location');
                }
                if (!fhirPatient) {
                    missingResources.push('Patient');
                }
                if (!questionnaireResponseResource) {
                    missingResources.push('QuestionnaireResponse');
                }
                if (missingResources.length) {
                    throw new Error("missing the following base category resources: ".concat(missingResources.join(', ')));
                }
                if (!encounter.id) {
                    throw new Error('Encounter ID is undefined');
                }
                if (!fhirPatient.id) {
                    throw new Error('FHIR Patient ID is undefined');
                }
                console.log('base category resources found');
                console.timeEnd('get-appointment-encounter-location-patient');
                _a = (_e = (_d = questionnaireResponseResource.questionnaire) === null || _d === void 0 ? void 0 : _d.split('|')) !== null && _e !== void 0 ? _e : [null, null], sourceQuestionnaireUrl = _a[0], sourceQuestionnaireVersion = _a[1];
                urlForQFetch = sourceQuestionnaireUrl;
                versionForQFetch = sourceQuestionnaireVersion;
                if (!urlForQFetch || !versionForQFetch) {
                    throw new Error("Questionnaire for QR is not well defined: ".concat(urlForQFetch, "|").concat(versionForQFetch));
                }
                console.log('currentQuestionnaireUrl1', urlForQFetch);
                console.time('get-booking-questionnaire');
                return [4 /*yield*/, (0, utils_1.getQuestionnaireAndValueSets)(urlForQFetch, versionForQFetch, 'ip-questionnaire-item-value-set', oystehr)];
            case 5:
                _b = _l.sent(), questionnaire = _b.questionnaire, valueSets = _b.valueSets;
                console.timeEnd('get-booking-questionnaire');
                if (!questionnaire.item) {
                    questionnaire.item = [];
                }
                allItems = (0, utils_1.mapQuestionnaireAndValueSetsToItemsList)(questionnaire.item, valueSets);
                console.log('checking user access to patient');
                console.time('check-user-access');
                accessLevel = void 0;
                if (!authorization) return [3 /*break*/, 8];
                console.log('getting user');
                return [4 /*yield*/, (0, auth_1.getUser)(authorization.replace('Bearer ', ''), secrets)];
            case 6:
                user = _l.sent();
                return [4 /*yield*/, validateUserAccess({
                        oystehr: oystehr,
                        user: user,
                        suppliedDOB: dateOfBirth,
                        appointmentPatient: fhirPatient,
                    })];
            case 7:
                // If it's a returning patient, check if the user has
                // access to the patient and the appointment.
                accessLevel = _l.sent();
                return [3 /*break*/, 10];
            case 8: return [4 /*yield*/, validateUserAccess({
                    oystehr: oystehr,
                    user: undefined,
                    suppliedDOB: dateOfBirth,
                    appointmentPatient: fhirPatient,
                })];
            case 9:
                accessLevel = _l.sent();
                _l.label = 10;
            case 10:
                console.timeEnd('check-user-access');
                // Get paperwork for authorized user
                console.log('checking user authorization');
                if (accessLevel === Access_Level.full) {
                    console.log('User is authorized to access paperwork');
                    console.log('building paperwork questions');
                    partialAppointment = getPaperworkSupportingInfoForUserWithAccess({
                        appointment: appointment,
                        patient: fhirPatient,
                        location: location_1,
                        hsResources: hsResources,
                        practitioner: practitioner,
                        encounter: encounter,
                    });
                    console.log('building get paperwork response');
                    updateTimestamp = (0, utils_1.getLastUpdateTimestampForResource)(questionnaireResponseResource);
                    formatPatientSexForPaperwork = function (value) {
                        var sex = Object.keys(utils_1.PersonSex).find(function (key) { return utils_1.PersonSex[key] === value; });
                        return sex;
                    };
                    response = __assign(__assign({}, partialAppointment), { updateTimestamp: updateTimestamp, patient: {
                            id: fhirPatient.id,
                            firstName: (_g = (_f = fhirPatient.name) === null || _f === void 0 ? void 0 : _f[0].given) === null || _g === void 0 ? void 0 : _g[0],
                            middleName: (_j = (_h = fhirPatient.name) === null || _h === void 0 ? void 0 : _h[0].given) === null || _j === void 0 ? void 0 : _j[1],
                            lastName: (_k = fhirPatient.name) === null || _k === void 0 ? void 0 : _k[0].family,
                            dateOfBirth: fhirPatient.birthDate,
                            sex: formatPatientSexForPaperwork(fhirPatient.gender || ''),
                        }, allItems: allItems, questionnaireResponse: questionnaireResponseResource });
                    // console.log('returning response: ', JSON.stringify(response));
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response),
                        }];
                }
                else {
                    console.log('User has anonymous access only to this paperwork');
                    _c = getPaperworkSupportingInfoForUserWithAccess({
                        appointment: appointment,
                        patient: fhirPatient,
                        location: location_1,
                        hsResources: hsResources,
                        practitioner: practitioner,
                        encounter: encounter,
                    }), app = _c.appointment, patient = _c.patient;
                    response = {
                        appointment: app,
                        patient: {
                            firstName: patient.firstName,
                        },
                        allItems: [],
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response),
                        }];
                }
                return [3 /*break*/, 12];
            case 11:
                error_1 = _l.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-paperwork', error_1, ENVIRONMENT)];
            case 12: return [2 /*return*/];
        }
    });
}); });
function getPaperworkSupportingInfoForUserWithAccess(input) {
    var _a, _b, _c, _d;
    var appointment = input.appointment, patient = input.patient, location = input.location, hsResources = input.hsResources, practitioner = input.practitioner, encounter = input.encounter;
    var serviceMode = (0, utils_1.checkEncounterIsVirtual)(encounter)
        ? utils_1.ServiceMode['virtual']
        : utils_1.ServiceMode['in-person'];
    return {
        appointment: {
            id: (_a = appointment === null || appointment === void 0 ? void 0 : appointment.id) !== null && _a !== void 0 ? _a : 'Unknown', // i hate this
            start: (appointment === null || appointment === void 0 ? void 0 : appointment.start) || 'Unknown',
            location: makeLocationSummary({ appointment: appointment, location: location, hsResources: hsResources, practitioner: practitioner }),
            visitType: (_b = appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === null || _b === void 0 ? void 0 : _b.text,
            status: appointment === null || appointment === void 0 ? void 0 : appointment.status,
            unconfirmedDateOfBirth: appointment ? (0, utils_1.getUnconfirmedDOBForAppointment)(appointment) : undefined,
            serviceMode: serviceMode,
        },
        patient: {
            id: patient.id,
            firstName: (_d = (_c = patient.name) === null || _c === void 0 ? void 0 : _c[0].given) === null || _d === void 0 ? void 0 : _d[0],
            dateOfBirth: patient.birthDate,
        },
    };
}
var Access_Level;
(function (Access_Level) {
    Access_Level[Access_Level["anonymous"] = 0] = "anonymous";
    Access_Level[Access_Level["full"] = 1] = "full";
})(Access_Level || (Access_Level = {}));
var validateUserAccess = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, user, suppliedDOB, appointmentPatient, dobMatch, hasAccess;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                oystehr = input.oystehr, user = input.user, suppliedDOB = input.suppliedDOB, appointmentPatient = input.appointmentPatient;
                dobMatch = suppliedDOB && suppliedDOB === appointmentPatient.birthDate;
                if (!user && !suppliedDOB) {
                    return [2 /*return*/, Access_Level.anonymous];
                }
                if (!(user && appointmentPatient.id)) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, auth_1.userHasAccessToPatient)(user, appointmentPatient.id, oystehr)];
            case 1:
                hasAccess = _a.sent();
                if (hasAccess) {
                    return [2 /*return*/, Access_Level.full];
                }
                else if (!dobMatch) {
                    throw utils_1.NO_READ_ACCESS_TO_PATIENT_ERROR;
                }
                _a.label = 2;
            case 2:
                if (dobMatch) {
                    return [2 /*return*/, Access_Level.full];
                }
                else {
                    throw utils_1.DOB_UNCONFIRMED_ERROR;
                }
                return [2 /*return*/];
        }
    });
}); };
// todo: consider whether all the location config stuff needs to be on here
var makeLocationSummary = function (input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var appointment = input.appointment, location = input.location, hsResources = input.hsResources, practitioner = input.practitioner;
    if (hsResources) {
        // do a thing
        var hs = hsResources.hs, locations = hsResources.locations, coverageArea = hsResources.coverageArea;
        var otherOffices = [];
        var serviceMode = (0, utils_1.serviceModeForHealthcareService)(hs);
        var scheduleExtension = undefined;
        var loc = void 0;
        // note there's not really any clear notion what to do here if the HS pools provider schedules
        // this is to be addressed in a future release
        if (serviceMode === utils_1.ServiceMode['in-person']) {
            // this is most likely a fictional use case...
            loc = locations === null || locations === void 0 ? void 0 : locations.find(function (tempLoc) {
                var _a;
                return (_a = appointment === null || appointment === void 0 ? void 0 : appointment.participant) === null || _a === void 0 ? void 0 : _a.some(function (maybeLoc) {
                    var _a;
                    var reference = (_a = maybeLoc.actor) === null || _a === void 0 ? void 0 : _a.reference;
                    if (reference) {
                        return reference === "".concat(tempLoc.resourceType, "/").concat(tempLoc.id);
                    }
                    return false;
                });
            });
            if (loc === undefined) {
                loc = (locations === null || locations === void 0 ? void 0 : locations.length) === 1 ? locations[0] : undefined;
            }
            if (loc) {
                scheduleExtension = (0, utils_1.getScheduleExtension)(loc);
            }
        }
        else {
            loc = (coverageArea === null || coverageArea === void 0 ? void 0 : coverageArea.length) === 1 ? coverageArea[0] : undefined;
        }
        return {
            id: loc === null || loc === void 0 ? void 0 : loc.id,
            slug: (_b = (_a = loc === null || loc === void 0 ? void 0 : loc.identifier) === null || _a === void 0 ? void 0 : _a.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value,
            name: (_c = loc === null || loc === void 0 ? void 0 : loc.name) !== null && _c !== void 0 ? _c : hs === null || hs === void 0 ? void 0 : hs.name,
            description: loc === null || loc === void 0 ? void 0 : loc.description,
            address: loc === null || loc === void 0 ? void 0 : loc.address,
            telecom: loc === null || loc === void 0 ? void 0 : loc.telecom,
            timezone: (_e = (_d = loc === null || loc === void 0 ? void 0 : loc.extension) === null || _d === void 0 ? void 0 : _d.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _e === void 0 ? void 0 : _e.valueString,
            otherOffices: otherOffices,
            scheduleOwnerType: utils_1.ScheduleType['group'],
            scheduleExtension: scheduleExtension,
        };
    }
    else if (practitioner) {
        // todo build out practitioner scheduling more
        return {
            id: practitioner === null || practitioner === void 0 ? void 0 : practitioner.id,
            slug: (_g = (_f = practitioner === null || practitioner === void 0 ? void 0 : practitioner.identifier) === null || _f === void 0 ? void 0 : _f.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _g === void 0 ? void 0 : _g.value,
            name: "".concat((_k = (_j = (_h = practitioner.name) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.given) === null || _k === void 0 ? void 0 : _k[0], " ").concat((_m = (_l = practitioner.name) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.family),
            description: undefined,
            address: undefined,
            telecom: [],
            timezone: (_p = (_o = practitioner === null || practitioner === void 0 ? void 0 : practitioner.extension) === null || _o === void 0 ? void 0 : _o.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _p === void 0 ? void 0 : _p.valueString,
            otherOffices: [],
            scheduleOwnerType: utils_1.ScheduleType['provider'],
        };
    }
    else {
        var closures = [];
        if (location) {
            var schedule = (0, utils_1.getScheduleExtension)(location);
            if (schedule && schedule.closures) {
                closures.push.apply(closures, schedule.closures);
            }
        }
        return {
            id: location === null || location === void 0 ? void 0 : location.id,
            slug: (_r = (_q = location === null || location === void 0 ? void 0 : location.identifier) === null || _q === void 0 ? void 0 : _q.find(function (identifierTemp) { return identifierTemp.system === utils_1.SLUG_SYSTEM; })) === null || _r === void 0 ? void 0 : _r.value,
            name: location === null || location === void 0 ? void 0 : location.name,
            description: location === null || location === void 0 ? void 0 : location.description,
            address: location === null || location === void 0 ? void 0 : location.address,
            telecom: location === null || location === void 0 ? void 0 : location.telecom,
            timezone: (_t = (_s = location === null || location === void 0 ? void 0 : location.extension) === null || _s === void 0 ? void 0 : _s.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _t === void 0 ? void 0 : _t.valueString,
            otherOffices: location ? (0, shared_1.getOtherOfficesForLocation)(location) : [],
            scheduleOwnerType: utils_1.ScheduleType['location'],
        };
    }
};

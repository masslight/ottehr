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
var shared_1 = require("../../shared");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('get-appointments', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, visitType_1, searchDate_1, locationID_1, providerIDs_1, groupIDs_1, supervisorApprovalEnabled, secrets, oystehr_1, requestedTimezoneRelatedResources_1, _a, appointmentResources, appointmentsToGroupMap_1, preBooked, inOffice, completed, cancelled, response_1, patientIds_1, practitionerIds_1, patientToRPMap, allAppointments_1, patientIdMap_1, apptRefToEncounterMap_1, encounterRefToQRMap_1, patientRefToQRMap_1, rpToCommMap_1, rpPhoneNumbers_1, phoneNumberToRpMap_1, rpIdToResourceMap_1, practitionerIdToResourceMap_1, healthcareServiceIdToResourceMap_1, docRefPromise, uniqueNumbers, allDocRefs, communications, encounterSignatures, communicationsPromise, participantsPromise, encounterIds, provenancePromises, _b, docRefBundle, communicationBundle, participantsBundle, encounterSignaturesBundle, practitioners, commSenders, comms, appointments, appointmentQueues, baseMapInput_1, response, error_1, ENVIRONMENT;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 4, , 5]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                visitType_1 = validatedParameters.visitType, searchDate_1 = validatedParameters.searchDate, locationID_1 = validatedParameters.locationID, providerIDs_1 = validatedParameters.providerIDs, groupIDs_1 = validatedParameters.groupIDs, supervisorApprovalEnabled = validatedParameters.supervisorApprovalEnabled, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _d.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.time('get_active_encounters + get_appointment_data');
                requestedTimezoneRelatedResources_1 = (function () {
                    var resources = [];
                    if (locationID_1) {
                        resources.push({ resourceId: locationID_1, resourceType: 'Location' });
                    }
                    if (providerIDs_1) {
                        resources.push.apply(resources, providerIDs_1.map(function (providerID) { return ({ resourceId: providerID, resourceType: 'Practitioner' }); }));
                    }
                    if (groupIDs_1) {
                        resources.push.apply(resources, groupIDs_1.map(function (groupID) { return ({ resourceId: groupID, resourceType: 'HealthcareService' }); }));
                    }
                    return resources;
                })();
                return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var searchOptions, resourceResults, appointmentsToGroupMap, flatAppointments;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, Promise.all(requestedTimezoneRelatedResources_1.map(function (resource) { return __awaiter(void 0, void 0, void 0, function () {
                                        var cacheKey, searchParams;
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0:
                                                    cacheKey = (0, helpers_1.makeResourceCacheKey)({
                                                        resourceId: resource.resourceId,
                                                        resourceType: resource.resourceType,
                                                    });
                                                    return [4 /*yield*/, (0, helpers_1.makeEncounterSearchParams)({
                                                            resourceId: resource.resourceId,
                                                            resourceType: resource.resourceType,
                                                            cacheKey: cacheKey,
                                                            oystehr: oystehr_1,
                                                        })];
                                                case 1:
                                                    searchParams = _a.sent();
                                                    return [2 /*return*/, {
                                                            resourceId: resource.resourceId,
                                                            resourceType: resource.resourceType,
                                                            searchParams: searchParams,
                                                            cacheKey: cacheKey,
                                                        }];
                                            }
                                        });
                                    }); }))];
                                case 1:
                                    searchOptions = _a.sent();
                                    return [4 /*yield*/, Promise.all(searchOptions.map(function (options) { return __awaiter(void 0, void 0, void 0, function () {
                                            var appointmentRequestInput, appointmentRequest, group, appointmentResponse, appointments;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, (0, helpers_1.getAppointmentQueryInput)({
                                                            oystehr: oystehr_1,
                                                            resourceId: options.resourceId,
                                                            resourceType: options.resourceType,
                                                            searchDate: searchDate_1,
                                                        })];
                                                    case 1:
                                                        appointmentRequestInput = _a.sent();
                                                        appointmentRequest = {
                                                            resourceType: appointmentRequestInput.resourceType,
                                                            params: appointmentRequestInput.params,
                                                        };
                                                        group = appointmentRequestInput.group;
                                                        return [4 /*yield*/, oystehr_1.fhir.search(appointmentRequest)];
                                                    case 2:
                                                        appointmentResponse = _a.sent();
                                                        appointments = appointmentResponse
                                                            .unbundle()
                                                            .filter(function (resource) { return !(0, utils_1.isNonPaperworkQuestionnaireResponse)(resource); });
                                                        return [2 /*return*/, { appointments: appointments, group: group }];
                                                }
                                            });
                                        }); }))];
                                case 2:
                                    resourceResults = _a.sent();
                                    appointmentsToGroupMap = new Map();
                                    flatAppointments = resourceResults.flatMap(function (result) {
                                        var appointments = result.appointments || [];
                                        var group = result.group;
                                        if (group) {
                                            appointments.forEach(function (appointment) {
                                                appointmentsToGroupMap.set("".concat(appointment.id), group);
                                            });
                                        }
                                        return appointments;
                                    });
                                    return [2 /*return*/, {
                                            appointmentResources: (0, helpers_1.mergeResources)(flatAppointments),
                                            appointmentsToGroupMap: appointmentsToGroupMap,
                                        }];
                            }
                        });
                    }); })()];
            case 2:
                _a = _d.sent(), appointmentResources = _a.appointmentResources, appointmentsToGroupMap_1 = _a.appointmentsToGroupMap;
                console.timeEnd('get_active_encounters + get_appointment_data');
                preBooked = [];
                inOffice = [];
                completed = [];
                cancelled = [];
                if ((appointmentResources === null || appointmentResources === void 0 ? void 0 : appointmentResources.length) == 0) {
                    response_1 = {
                        message: 'Successfully retrieved all appointments',
                        preBooked: preBooked,
                        inOffice: inOffice,
                        completed: completed,
                        cancelled: cancelled,
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response_1),
                        }];
                }
                console.time('parse_search_results');
                patientIds_1 = [];
                practitionerIds_1 = [];
                patientToRPMap = (0, shared_1.getRelatedPersonsFromResourceList)(appointmentResources);
                allAppointments_1 = [];
                patientIdMap_1 = {};
                apptRefToEncounterMap_1 = {};
                encounterRefToQRMap_1 = {};
                patientRefToQRMap_1 = {};
                rpToCommMap_1 = {};
                rpPhoneNumbers_1 = new Set();
                phoneNumberToRpMap_1 = {};
                rpIdToResourceMap_1 = {};
                practitionerIdToResourceMap_1 = {};
                healthcareServiceIdToResourceMap_1 = {};
                appointmentResources.forEach(function (resource) {
                    var _a, _b, _c, _d, _e, _f, _g, _h;
                    if (resource.resourceType === 'Appointment') {
                        allAppointments_1.push(resource);
                        var appointment = resource;
                        var patientId = (_c = (_b = (_a = appointment.participant
                            .find(function (appt) { var _a, _b; return (_b = (_a = appt.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Patient/', '');
                        if (patientId)
                            patientIds_1.push("Patient/".concat(patientId));
                    }
                    else if (resource.resourceType === 'Patient' && resource.id) {
                        patientIdMap_1[resource.id] = resource;
                    }
                    else if (resource.resourceType === 'Encounter' && !(0, utils_1.isFollowupEncounter)(resource)) {
                        var asEnc = resource;
                        var apptRef = (_d = asEnc.appointment) === null || _d === void 0 ? void 0 : _d[0].reference;
                        if (apptRef) {
                            apptRefToEncounterMap_1[apptRef] = asEnc;
                        }
                        ((_e = asEnc.participant) !== null && _e !== void 0 ? _e : []).forEach(function (p) {
                            var _a;
                            var ref = (_a = p.individual) === null || _a === void 0 ? void 0 : _a.reference;
                            if (ref === null || ref === void 0 ? void 0 : ref.startsWith('Practitioner/')) {
                                var id = ref.split('/')[1];
                                if (id)
                                    practitionerIds_1.push(id);
                            }
                        });
                    }
                    else if (resource.resourceType === 'QuestionnaireResponse') {
                        var encRef = (_f = resource.encounter) === null || _f === void 0 ? void 0 : _f.reference;
                        var patientRef = (_g = resource.subject) === null || _g === void 0 ? void 0 : _g.reference;
                        if (encRef) {
                            encounterRefToQRMap_1[encRef] = resource;
                        }
                        if (patientRef) {
                            if (patientRefToQRMap_1[patientRef]) {
                                var qrAuthoredDate = luxon_1.DateTime.fromISO(patientRefToQRMap_1[patientRef].authored || '');
                                var curQrAuthoredDate = luxon_1.DateTime.fromISO(resource.authored || '');
                                if (curQrAuthoredDate.diff(qrAuthoredDate).as('minutes') > 0) {
                                    patientRefToQRMap_1[patientRef] = resource;
                                }
                            }
                            else {
                                patientRefToQRMap_1[patientRef] = resource;
                            }
                        }
                    }
                    else if (resource.resourceType === 'RelatedPerson' && resource.id) {
                        rpIdToResourceMap_1["RelatedPerson/".concat(resource.id)] = resource;
                        var pn = (0, utils_1.getSMSNumberForIndividual)(resource);
                        if (pn) {
                            rpPhoneNumbers_1.add(pn);
                            var mapVal = (_h = phoneNumberToRpMap_1[pn]) !== null && _h !== void 0 ? _h : [];
                            mapVal.push("RelatedPerson/".concat(resource.id));
                            phoneNumberToRpMap_1[pn] = mapVal;
                        }
                    }
                    else if (resource.resourceType === 'Practitioner' && resource.id) {
                        practitionerIdToResourceMap_1["Practitioner/".concat(resource.id)] = resource;
                    }
                    else if (resource.resourceType === 'HealthcareService' && resource.id) {
                        healthcareServiceIdToResourceMap_1["HealthcareService/".concat(resource.id)] = resource;
                    }
                });
                console.timeEnd('parse_search_results');
                console.time('get_all_doc_refs + get_all_communications + practitioners + signatures');
                docRefPromise = patientIds_1.length > 0
                    ? oystehr_1 === null || oystehr_1 === void 0 ? void 0 : oystehr_1.fhir.search({
                        resourceType: 'DocumentReference',
                        params: [
                            { name: 'status', value: 'current' },
                            { name: 'type', value: "".concat(utils_1.INSURANCE_CARD_CODE, ",").concat(utils_1.PHOTO_ID_CARD_CODE) },
                            { name: 'related', value: patientIds_1.join(',') },
                        ],
                    })
                    : Promise.resolve(undefined);
                uniqueNumbers = Array.from(rpPhoneNumbers_1);
                allDocRefs = undefined;
                communications = undefined;
                encounterSignatures = undefined;
                communicationsPromise = uniqueNumbers.length > 0
                    ? oystehr_1.fhir.search({
                        resourceType: 'Communication',
                        params: [
                            { name: 'medium', value: "".concat(utils_1.ZAP_SMS_MEDIUM_CODE) },
                            { name: 'sender:RelatedPerson.telecom', value: uniqueNumbers.join(',') },
                            { name: '_include', value: 'Communication:sender' },
                        ],
                    })
                    : Promise.resolve(undefined);
                participantsPromise = practitionerIds_1.length > 0
                    ? oystehr_1.fhir.search({
                        resourceType: 'Practitioner',
                        params: [{ name: '_id', value: practitionerIds_1.join(',') }],
                    })
                    : Promise.resolve(undefined);
                encounterIds = Object.values(apptRefToEncounterMap_1)
                    .filter(Boolean)
                    .map(function (enc) { return enc.id; })
                    .filter(utils_1.isTruthy);
                provenancePromises = encounterIds.map(function (encId) {
                    return oystehr_1.fhir.search({
                        resourceType: 'Provenance',
                        params: [
                            { name: 'target', value: "Encounter/".concat(encId) },
                            { name: 'agent-role', value: 'verifier' },
                        ],
                    });
                });
                return [4 /*yield*/, Promise.all(__spreadArray([
                        docRefPromise,
                        communicationsPromise,
                        participantsPromise
                    ], provenancePromises, true))];
            case 3:
                _b = _d.sent(), docRefBundle = _b[0], communicationBundle = _b[1], participantsBundle = _b[2], encounterSignaturesBundle = _b.slice(3);
                allDocRefs = (_c = docRefBundle === null || docRefBundle === void 0 ? void 0 : docRefBundle.unbundle()) !== null && _c !== void 0 ? _c : [];
                communications = communicationBundle === null || communicationBundle === void 0 ? void 0 : communicationBundle.unbundle();
                practitioners = participantsBundle === null || participantsBundle === void 0 ? void 0 : participantsBundle.unbundle();
                practitioners === null || practitioners === void 0 ? void 0 : practitioners.forEach(function (pr) {
                    practitionerIdToResourceMap_1["Practitioner/".concat(pr.id)] = pr;
                });
                encounterSignatures = encounterSignaturesBundle.flatMap(function (bundle) { var _a; return (_a = bundle === null || bundle === void 0 ? void 0 : bundle.unbundle()) !== null && _a !== void 0 ? _a : []; });
                console.timeEnd('get_all_doc_refs + get_all_communications + practitioners + signatures');
                // because the related person tied to the user's account has been excluded from the graph of persons
                // connected to patient resources, while the Zap sms creates communications with sender reference based on
                // the user's profile-linked resource, it is necessary to do this cross-referencing to map from the sender resource
                // on sms Communication resources to the related person list associated with each patient
                // this cuts around 3 seconds off the execution time for this zambda, or more when there are no results
                if (communications && communications.length > 0) {
                    commSenders = communications.filter(function (resource) { return resource.resourceType === 'RelatedPerson'; });
                    commSenders.forEach(function (resource) {
                        var _a;
                        rpIdToResourceMap_1["RelatedPerson/".concat(resource.id)] = resource;
                        var pn = (0, utils_1.getSMSNumberForIndividual)(resource);
                        if (pn) {
                            rpPhoneNumbers_1.add(pn);
                            var mapVal = (_a = phoneNumberToRpMap_1[pn]) !== null && _a !== void 0 ? _a : [];
                            mapVal.push("RelatedPerson/".concat(resource.id));
                            phoneNumberToRpMap_1[pn] = mapVal;
                        }
                    });
                    comms = communications.filter(function (resource) { return resource.resourceType === 'Communication'; });
                    comms.forEach(function (comm) {
                        var _a;
                        var sender = comm.sender;
                        if (sender && sender.reference) {
                            var rpRef = sender.reference;
                            var senderResource = rpIdToResourceMap_1[rpRef];
                            if (senderResource && (0, utils_1.getSMSNumberForIndividual)(senderResource)) {
                                var smsNumber = (0, utils_1.getSMSNumberForIndividual)(senderResource);
                                var allRPsWithThisNumber = (_a = phoneNumberToRpMap_1[smsNumber !== null && smsNumber !== void 0 ? smsNumber : '']) !== null && _a !== void 0 ? _a : [];
                                allRPsWithThisNumber.forEach(function (rp) {
                                    var _a;
                                    var commArray = (_a = rpToCommMap_1[rp]) !== null && _a !== void 0 ? _a : [];
                                    commArray.push(comm);
                                    rpToCommMap_1[rp] = commArray;
                                });
                            }
                        }
                    });
                }
                console.time('structure_appointment_data');
                appointments = [];
                if ((visitType_1 === null || visitType_1 === void 0 ? void 0 : visitType_1.length) > 0) {
                    appointments = allAppointments_1 === null || allAppointments_1 === void 0 ? void 0 : allAppointments_1.filter(function (appointment) {
                        return visitType_1 === null || visitType_1 === void 0 ? void 0 : visitType_1.includes((0, utils_1.appointmentTypeForAppointment)(appointment));
                    });
                }
                else {
                    appointments = allAppointments_1;
                }
                if (appointments.length > 0) {
                    appointmentQueues = (0, shared_1.sortAppointments)(appointments, apptRefToEncounterMap_1);
                    baseMapInput_1 = {
                        encounterRefToQRMap: encounterRefToQRMap_1,
                        patientRefToQRMap: patientRefToQRMap_1,
                        patientToRPMap: patientToRPMap,
                        allDocRefs: allDocRefs,
                        apptRefToEncounterMap: apptRefToEncounterMap_1,
                        patientIdMap: patientIdMap_1,
                        rpToCommMap: rpToCommMap_1,
                        practitionerIdToResourceMap: practitionerIdToResourceMap_1,
                        healthcareServiceIdToResourceMap: healthcareServiceIdToResourceMap_1,
                        next: false,
                        group: undefined,
                        supervisorApprovalEnabled: supervisorApprovalEnabled,
                        encounterSignatures: encounterSignatures,
                    };
                    preBooked = appointmentQueues.prebooked
                        .map(function (appointment) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    })
                        .filter(utils_1.isTruthy);
                    inOffice = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], appointmentQueues.inOffice.waitingRoom.arrived.map(function (appointment, idx) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { next: idx === 0, group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    }), true), appointmentQueues.inOffice.waitingRoom.ready.map(function (appointment, idx) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { next: idx === 0, group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    }), true), appointmentQueues.inOffice.inExam.intake.map(function (appointment) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    }), true), appointmentQueues.inOffice.inExam['ready for provider'].map(function (appointment, idx) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { next: idx === 0, group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    }), true), appointmentQueues.inOffice.inExam.provider.map(function (appointment) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    }), true).filter(utils_1.isTruthy);
                    completed = appointmentQueues.checkedOut
                        .map(function (appointment) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    })
                        .filter(utils_1.isTruthy);
                    cancelled = appointmentQueues.canceled
                        .map(function (appointment) {
                        var _a;
                        return makeAppointmentInformation(oystehr_1, __assign(__assign({ appointment: appointment }, baseMapInput_1), { group: appointmentsToGroupMap_1.get((_a = appointment.id) !== null && _a !== void 0 ? _a : '') }));
                    })
                        .filter(utils_1.isTruthy);
                }
                response = {
                    message: 'Successfully retrieved all appointments',
                    preBooked: preBooked,
                    inOffice: inOffice,
                    completed: completed,
                    cancelled: cancelled,
                };
                console.timeEnd('structure_appointment_data');
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _d.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-get-appointments', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var makeAppointmentInformation = function (oystehr, input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    var appointment = input.appointment, patientIdMap = input.patientIdMap, apptRefToEncounterMap = input.apptRefToEncounterMap, encounterRefToQRMap = input.encounterRefToQRMap, allDocRefs = input.allDocRefs, rpToCommMap = input.rpToCommMap, practitionerIdToResourceMap = input.practitionerIdToResourceMap, next = input.next, patientToRPMap = input.patientToRPMap, group = input.group, supervisorApprovalEnabled = input.supervisorApprovalEnabled, encounterSignatures = input.encounterSignatures;
    var patientRef = (_b = (_a = appointment.participant.find(function (appt) { var _a, _b; return (_b = (_a = appt.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference;
    var patientId = patientRef === null || patientRef === void 0 ? void 0 : patientRef.replace('Patient/', '');
    var patient = patientId ? patientIdMap[patientId] : undefined;
    if (!patient) {
        // returning undefined cause on frontend there will be an error if patient is undefined anyway
        // it was a potential bug when there were different types in frontend and backend for the same appointment entity
        console.log("no patient found for appointment ".concat(appointment.id, " with patient id ").concat(patientId));
        return undefined;
    }
    var encounter = apptRefToEncounterMap["Appointment/".concat(appointment.id)];
    var questionnaireResponse = encounterRefToQRMap["Encounter/".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id)];
    var smsModel;
    if (patientRef) {
        var rps = [];
        try {
            if (!(patientRef in patientToRPMap)) {
                throw new Error("no related person found for patient ".concat(patientId));
            }
            rps = patientToRPMap[patientRef];
            var recipients = rps
                .map(function (rp) {
                return {
                    recipientResourceUri: rp.id ? "RelatedPerson/".concat(rp.id) : undefined,
                    smsNumber: (0, utils_1.getSMSNumberForIndividual)(rp),
                };
            })
                .filter(function (rec) { return rec.recipientResourceUri !== undefined && rec.smsNumber !== undefined; });
            if (recipients.length) {
                var allCommunications = recipients.flatMap(function (recipient) {
                    var _a;
                    return (_a = rpToCommMap[recipient.recipientResourceUri]) !== null && _a !== void 0 ? _a : [];
                });
                smsModel = {
                    hasUnreadMessages: (0, utils_1.getChatContainsUnreadMessages)(allCommunications),
                    recipients: recipients,
                };
            }
        }
        catch (e) {
            console.log('error building sms model: ', e);
            console.log('related persons value prior to error: ', rps);
            (0, aws_serverless_1.captureException)(e);
        }
    }
    else {
        console.log("no patient ref found for appointment ".concat(appointment.id));
    }
    var flattenedItems = (0, utils_1.flattenItems)((_c = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item) !== null && _c !== void 0 ? _c : []);
    var consentComplete = ((_e = (_d = flattenedItems.find(function (item) { return item.linkId === 'hipaa-acknowledgement'; })) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0].valueBoolean) === true &&
        ((_g = (_f = flattenedItems.find(function (item) { return item.linkId === 'consent-to-treat'; })) === null || _f === void 0 ? void 0 : _f.answer) === null || _g === void 0 ? void 0 : _g[0].valueBoolean) ===
            true &&
        flattenedItems.find(function (item) { return item.linkId === 'signature'; }) &&
        flattenedItems.find(function (item) { return item.linkId === 'full-name'; }) &&
        flattenedItems.find(function (item) { return item.linkId === 'consent-form-signer-relationship'; });
    var docRefComplete = function (type, frontTitle) {
        var docFound = allDocRefs.filter(function (document) {
            var _a, _b, _c;
            return ((_b = (_a = document.context) === null || _a === void 0 ? void 0 : _a.related) === null || _b === void 0 ? void 0 : _b.find(function (related) { return related.reference === "Patient/".concat(patient === null || patient === void 0 ? void 0 : patient.id); })) &&
                ((_c = document.type) === null || _c === void 0 ? void 0 : _c.text) === type;
        });
        return !!docFound.find(function (doc) { return doc.content.find(function (content) { return content.attachment.title === frontTitle; }); });
    };
    var idCard = docRefComplete('Photo ID cards', 'photo-id-front');
    var insuranceCard = docRefComplete('Insurance cards', 'insurance-card-front');
    var cancellationReason = (_j = (_h = appointment.cancelationReason) === null || _h === void 0 ? void 0 : _h.coding) === null || _j === void 0 ? void 0 : _j[0].code;
    var status = (0, utils_1.getInPersonVisitStatus)(appointment, encounter, supervisorApprovalEnabled);
    var unconfirmedDOB = (0, utils_1.getUnconfirmedDOBForAppointment)(appointment);
    var waitingMinutesString = (_m = (_l = (_k = appointment.meta) === null || _k === void 0 ? void 0 : _k.tag) === null || _l === void 0 ? void 0 : _l.find(function (tag) { return tag.system === 'waiting-minutes-estimate'; })) === null || _m === void 0 ? void 0 : _m.code;
    var waitingMinutes = waitingMinutesString ? parseInt(waitingMinutesString) : undefined;
    var ovrpInterest = (_q = (_p = (_o = flattenedItems.find(function (response) { return response.linkId === 'ovrp-interest'; })) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueString;
    var practitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
    var practitioner = practitionerIdToResourceMap["Practitioner/".concat(practitionerId)];
    var provider = '';
    if (practitioner && practitioner.name) {
        provider = oystehr.fhir.formatHumanName(practitioner.name[0]);
    }
    // if the QR has been updated at least once, this tag will not be present
    var paperworkHasBeenSubmitted = !!(questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.authored);
    var participants = (0, helpers_1.parseEncounterParticipants)(encounter, practitionerIdToResourceMap);
    var attenderProviderType = (0, helpers_1.parseAttenderProviderType)(encounter, practitionerIdToResourceMap);
    var signature = encounterSignatures.find(function (provenance) {
        return provenance.target.find(function (ref) { return ref.reference === "Encounter/".concat(encounter.id); });
    });
    var approvalDate = signature === null || signature === void 0 ? void 0 : signature.recorded;
    var timezoneResourceId = (0, helpers_1.getTimezoneResourceIdFromAppointment)(appointment);
    var appointmentTimezone = timezoneResourceId && helpers_1.timezoneMap.get(timezoneResourceId);
    var room = (_s = (_r = appointment.extension) === null || _r === void 0 ? void 0 : _r.find(function (ext) { return ext.url === utils_1.ROOM_EXTENSION_URL; })) === null || _s === void 0 ? void 0 : _s.valueString;
    return {
        id: appointment.id || 'Unknown',
        encounter: encounter,
        encounterId: encounter.id || 'Unknown',
        start: luxon_1.DateTime.fromISO(appointment.start).setZone(appointmentTimezone).toISO() || 'Unknown',
        patient: {
            id: patient.id || 'Unknown',
            firstName: (0, utils_1.getPatientFirstName)(patient),
            lastName: (0, utils_1.getPatientLastName)(patient),
            middleName: (0, utils_1.getMiddleName)(patient),
            // suffix: patient?.name?.[0].suffix?.[0],
            sex: patient.gender,
            dateOfBirth: (patient === null || patient === void 0 ? void 0 : patient.birthDate) || 'Unknown',
        },
        smsModel: smsModel,
        reasonForVisit: appointment.description || 'Unknown',
        comment: appointment.comment,
        unconfirmedDOB: unconfirmedDOB !== null && unconfirmedDOB !== void 0 ? unconfirmedDOB : '',
        appointmentType: (0, utils_1.appointmentTypeForAppointment)(appointment),
        appointmentStatus: appointment.status,
        status: status,
        cancellationReason: cancellationReason,
        provider: provider,
        attenderProviderType: attenderProviderType,
        approvalDate: approvalDate,
        group: group ? group.name : undefined,
        room: room,
        paperwork: {
            demographics: paperworkHasBeenSubmitted,
            photoID: idCard,
            insuranceCard: insuranceCard,
            consent: consentComplete ? true : false,
            ovrpInterest: Boolean(ovrpInterest && ovrpInterest.startsWith('Yes')),
        },
        participants: participants,
        next: next,
        visitStatusHistory: (0, utils_1.getVisitStatusHistory)(encounter),
        needsDOBConfirmation: !!unconfirmedDOB,
        waitingMinutes: waitingMinutes,
    };
};

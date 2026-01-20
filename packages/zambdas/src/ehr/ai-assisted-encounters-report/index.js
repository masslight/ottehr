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
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'ai-assisted-encounters-report';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, dateRange, locationIds, secrets, oystehr, allResources, offset, pageSize, baseSearchParams, searchBundle, pageCount, pageResources, pageAppointments, pageAppointmentsCount, encounters, appointments, patients, locations, practitioners, documentReferences, appointmentMap_1, patientMap_1, locationMap_1, practitionerMap_1, encounterDocumentMap_1, aiAssistedEncounters, encounterItems, response, error_1, ENVIRONMENT;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                dateRange = validatedParameters.dateRange, locationIds = validatedParameters.locationIds, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                // Get M2M token for FHIR access
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('Searching for appointments in date range:', dateRange);
                if (locationIds && locationIds.length > 0) {
                    console.log('Filtering by locations:', locationIds);
                }
                allResources = [];
                offset = 0;
                pageSize = 1000;
                baseSearchParams = [
                    {
                        name: 'date',
                        value: "ge".concat(dateRange.start),
                    },
                    {
                        name: 'date',
                        value: "le".concat(dateRange.end),
                    },
                    {
                        name: 'status',
                        value: 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist',
                    },
                    {
                        name: '_tag',
                        value: "".concat(utils_1.OTTEHR_MODULE.TM, ",").concat(utils_1.OTTEHR_MODULE.IP),
                    },
                    {
                        name: '_include',
                        value: 'Appointment:patient',
                    },
                    {
                        name: '_include',
                        value: 'Appointment:location',
                    },
                    {
                        name: '_revinclude',
                        value: 'Encounter:appointment',
                    },
                    {
                        name: '_revinclude:iterate',
                        value: 'DocumentReference:encounter',
                    },
                    {
                        name: '_include:iterate',
                        value: 'Encounter:participant:Practitioner',
                    },
                    {
                        name: '_sort',
                        value: 'date',
                    },
                    {
                        name: '_count',
                        value: pageSize.toString(),
                    },
                ];
                // Add location filter if provided
                if (locationIds && locationIds.length > 0) {
                    baseSearchParams.push({
                        name: 'location',
                        value: locationIds.map(function (id) { return "Location/".concat(id); }).join(','),
                    });
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                    })];
            case 2:
                searchBundle = _b.sent();
                pageCount = 1;
                console.log("Fetching page ".concat(pageCount, " of AI-assisted encounters..."));
                pageResources = searchBundle.unbundle();
                allResources = allResources.concat(pageResources);
                pageAppointments = pageResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                console.log("Page ".concat(pageCount, ": Found ").concat(pageResources.length, " total resources (").concat(pageAppointments.length, " appointments)"));
                _b.label = 3;
            case 3:
                if (!((_a = searchBundle.link) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 5];
                offset += pageSize;
                pageCount++;
                console.log("Fetching page ".concat(pageCount, " of AI-assisted encounters..."));
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                    })];
            case 4:
                searchBundle = _b.sent();
                pageResources = searchBundle.unbundle();
                allResources = allResources.concat(pageResources);
                pageAppointmentsCount = pageResources.filter(function (resource) { return resource.resourceType === 'Appointment'; }).length;
                console.log("Page ".concat(pageCount, ": Found ").concat(pageResources.length, " total resources (").concat(pageAppointmentsCount, " appointments)"));
                // Safety check to prevent infinite loops
                if (pageCount > 100) {
                    console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
                    return [3 /*break*/, 5];
                }
                return [3 /*break*/, 3];
            case 5:
                console.log("Found ".concat(allResources.length, " total resources across ").concat(pageCount, " pages"));
                encounters = allResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
                appointments = allResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                patients = allResources.filter(function (resource) { return resource.resourceType === 'Patient'; });
                locations = allResources.filter(function (resource) { return resource.resourceType === 'Location'; });
                practitioners = allResources.filter(function (resource) { return resource.resourceType === 'Practitioner'; });
                documentReferences = allResources.filter(function (resource) { return resource.resourceType === 'DocumentReference'; });
                console.log("Encounters: ".concat(encounters.length, ", Appointments: ").concat(appointments.length, ", Patients: ").concat(patients.length, ", Locations: ").concat(locations.length, ", Practitioners: ").concat(practitioners.length, ", DocumentReferences: ").concat(documentReferences.length));
                appointmentMap_1 = new Map();
                appointments.forEach(function (apt) {
                    if (apt.id) {
                        appointmentMap_1.set("Appointment/".concat(apt.id), apt);
                    }
                });
                patientMap_1 = new Map();
                patients.forEach(function (patient) {
                    if (patient.id) {
                        patientMap_1.set("Patient/".concat(patient.id), patient);
                    }
                });
                locationMap_1 = new Map();
                locations.forEach(function (location) {
                    if (location.id) {
                        locationMap_1.set("Location/".concat(location.id), location);
                    }
                });
                practitionerMap_1 = new Map();
                practitioners.forEach(function (practitioner) {
                    if (practitioner.id) {
                        practitionerMap_1.set(practitioner.id, practitioner);
                    }
                });
                encounterDocumentMap_1 = new Map();
                documentReferences.forEach(function (docRef) {
                    var _a, _b, _c, _d, _e;
                    var encounterRef = (_c = (_b = (_a = docRef.context) === null || _a === void 0 ? void 0 : _a.encounter) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.reference;
                    if (encounterRef) {
                        // Check if the document reference has the matching type
                        console.log("Checking DocumentReference ".concat(docRef.id, " for encounter ").concat(encounterRef));
                        var hasMatchingType = (_e = (_d = docRef.type) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e.some(function (coding) {
                            return utils_1.VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.system === coding.system &&
                                utils_1.VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.code === coding.code;
                        });
                        if (!hasMatchingType) {
                            return; // Skip this document reference if it doesn't match the type
                        }
                        var existing = encounterDocumentMap_1.get(encounterRef) || [];
                        existing.push(docRef);
                        encounterDocumentMap_1.set(encounterRef, existing);
                    }
                });
                console.log("Found ".concat(encounterDocumentMap_1.size, " encounters with matching document references"));
                aiAssistedEncounters = encounters.filter(function (encounter) {
                    var _a, _b;
                    if (!encounter.id) {
                        return false;
                    }
                    var encounterRef = "Encounter/".concat(encounter.id);
                    var hasDocuments = encounterDocumentMap_1.has(encounterRef);
                    if (!hasDocuments) {
                        return false;
                    }
                    // Find the corresponding appointment
                    var appointmentRef = (_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference;
                    var appointment = appointmentRef ? appointmentMap_1.get(appointmentRef) : undefined;
                    if (!appointment) {
                        console.log("No appointment found for encounter ".concat(encounter.id));
                        return false;
                    }
                    return true;
                });
                console.log("Found ".concat(aiAssistedEncounters.length, " AI-assisted encounters"));
                encounterItems = aiAssistedEncounters.map(function (encounter) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    var appointmentRef = (_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference;
                    var appointment = appointmentRef ? appointmentMap_1.get(appointmentRef) : undefined;
                    var patientRef = (_c = encounter.subject) === null || _c === void 0 ? void 0 : _c.reference;
                    var patient = patientRef ? patientMap_1.get(patientRef) : undefined;
                    // Get location name from Location resource
                    var locationRef = (_f = (_e = (_d = appointment === null || appointment === void 0 ? void 0 : appointment.participant) === null || _d === void 0 ? void 0 : _d.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); })) === null || _e === void 0 ? void 0 : _e.actor) === null || _f === void 0 ? void 0 : _f.reference;
                    var location = locationRef ? locationMap_1.get(locationRef) : undefined;
                    var locationName = (location === null || location === void 0 ? void 0 : location.name) || 'Unknown';
                    var locationId = locationRef ? locationRef.replace('Location/', '') : undefined;
                    // Get attending practitioner name
                    var attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                    var attendingPractitioner = attendingPractitionerId ? practitionerMap_1.get(attendingPractitionerId) : undefined;
                    var attendingProviderName = attendingPractitioner
                        ? (0, utils_1.getProviderNameWithProfession)(attendingPractitioner)
                        : 'Unknown';
                    // Determine visit type based on appointment meta tags
                    var visitType = (0, utils_1.isTelemedAppointment)(appointment)
                        ? 'Telemed'
                        : (0, utils_1.isInPersonAppointment)(appointment)
                            ? 'In-Person'
                            : 'Unknown';
                    var visitStatus = appointment ? (0, utils_1.getInPersonVisitStatus)(appointment, encounter, true) : 'unknown';
                    // Determine AI type based on DocumentReference.description
                    var encounterRef = "Encounter/".concat(encounter.id);
                    var encounterDocRefs = encounterRef ? encounterDocumentMap_1.get(encounterRef) || [] : [];
                    var hasAmbientScribe = encounterDocRefs.some(function (docRef) { return docRef.description === utils_1.DOCUMENT_REFERENCE_SUMMARY_FROM_AUDIO; });
                    var hasPatientChatbot = encounterDocRefs.some(function (docRef) { return docRef.description === utils_1.DOCUMENT_REFERENCE_SUMMARY_FROM_CHAT; });
                    var aiType = '';
                    if (hasAmbientScribe && hasPatientChatbot) {
                        aiType = 'patient HPI chatbot & ambient scribe';
                    }
                    else if (hasAmbientScribe) {
                        aiType = 'ambient scribe';
                    }
                    else if (hasPatientChatbot) {
                        aiType = 'patient HPI chatbot';
                    }
                    return {
                        appointmentId: (appointment === null || appointment === void 0 ? void 0 : appointment.id) || '',
                        patientId: (patient === null || patient === void 0 ? void 0 : patient.id) || '',
                        patientName: patient ? "".concat((0, utils_1.getPatientFirstName)(patient), " ").concat((0, utils_1.getPatientLastName)(patient)).trim() : 'Unknown',
                        dateOfBirth: (patient === null || patient === void 0 ? void 0 : patient.birthDate) || '',
                        visitStatus: visitStatus,
                        appointmentStart: (appointment === null || appointment === void 0 ? void 0 : appointment.start) || '',
                        appointmentEnd: (appointment === null || appointment === void 0 ? void 0 : appointment.end) || '',
                        location: locationName || 'Unknown',
                        locationId: locationId,
                        attendingProvider: attendingProviderName,
                        visitType: visitType,
                        reason: ((_h = (_g = encounter.reasonCode) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text) || ((_j = appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === null || _j === void 0 ? void 0 : _j.text) || '',
                        aiType: aiType,
                    };
                });
                response = {
                    message: "Found ".concat(encounterItems.length, " AI-assisted encounters"),
                    encounters: encounterItems,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 6:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });

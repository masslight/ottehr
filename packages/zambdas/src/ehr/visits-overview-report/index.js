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
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'visits-overview-report';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, dateRange, oystehr, allResources, offset, pageSize, baseSearchParams, searchBundle, pageCount, pageResources, pageAppointments, pageAppointmentsCount, appointments, locations_1, encounters, practitioners, encounterMap_1, activeAppointments, response_1, typeCounts_1, dailyVisitsMap_1, totalAppointments_1, locationVisitsMap_1, locationVisits, practitionerVisitsMap_1, practitionerMap_1, practitionerVisits, dailyVisits, appointmentTypes, response, error_1, ENVIRONMENT;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                dateRange = validatedParameters.dateRange;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                // Get M2M token for FHIR access
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Searching for appointments in date range:', dateRange);
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
                        name: '_tag',
                        value: "".concat(utils_1.OTTEHR_MODULE.TM, ",").concat(utils_1.OTTEHR_MODULE.IP),
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
                        name: '_include:iterate',
                        value: 'Encounter:participant:Practitioner',
                    },
                    {
                        name: '_count',
                        value: pageSize.toString(),
                    },
                ];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                    })];
            case 2:
                searchBundle = _b.sent();
                pageCount = 1;
                console.log("Fetching page ".concat(pageCount, " of appointments and locations..."));
                pageResources = searchBundle.unbundle();
                allResources = allResources.concat(pageResources);
                pageAppointments = pageResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                console.log("Page ".concat(pageCount, ": Found ").concat(pageResources.length, " total resources (").concat(pageAppointments.length, " appointments)"));
                _b.label = 3;
            case 3:
                if (!((_a = searchBundle.link) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 5];
                offset += pageSize;
                pageCount++;
                console.log("Fetching page ".concat(pageCount, " of appointments and locations..."));
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
                appointments = allResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                locations_1 = allResources.filter(function (resource) { return resource.resourceType === 'Location'; });
                encounters = allResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
                practitioners = allResources.filter(function (resource) { return resource.resourceType === 'Practitioner'; });
                console.log("Total resources found across ".concat(pageCount, " pages: ").concat(allResources.length, " (").concat(appointments.length, " appointments, ").concat(locations_1.length, " locations, ").concat(encounters.length, " encounters, ").concat(practitioners.length, " practitioners)"));
                encounterMap_1 = new Map();
                encounters.forEach(function (encounter) {
                    var _a, _b;
                    var appointmentRef = (_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference;
                    if (appointmentRef && encounter.id) {
                        encounterMap_1.set(appointmentRef, encounter);
                    }
                });
                activeAppointments = appointments.filter(function (appointment) {
                    if (!appointment.id)
                        return false;
                    var encounter = encounterMap_1.get("Appointment/".concat(appointment.id));
                    if (!encounter)
                        return false;
                    var visitStatus = (0, utils_1.getInPersonVisitStatus)(appointment, encounter);
                    return visitStatus !== 'cancelled' && visitStatus !== 'no show';
                });
                console.log("Filtered appointments: ".concat(appointments.length, " total, ").concat(activeAppointments.length, " active (excluded ").concat(appointments.length - activeAppointments.length, " cancelled/no show visits)"));
                if (activeAppointments.length === 0) {
                    response_1 = {
                        message: 'No active appointments found for the specified date range',
                        totalAppointments: 0,
                        appointmentTypes: [
                            { type: 'In-Person', count: 0, percentage: 0 },
                            { type: 'Telemed', count: 0, percentage: 0 },
                        ],
                        dailyVisits: [],
                        locationVisits: [],
                        practitionerVisits: [],
                        dateRange: dateRange,
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response_1),
                        }];
                }
                typeCounts_1 = {
                    'In-Person': 0,
                    Telemed: 0,
                };
                dailyVisitsMap_1 = new Map();
                activeAppointments.forEach(function (appointment) {
                    // Determine appointment type based on meta tags
                    var isTelemedicine = (0, utils_1.isTelemedAppointment)(appointment);
                    var isInPerson = (0, utils_1.isInPersonAppointment)(appointment);
                    // Extract date from appointment
                    var appointmentDate = 'unknown';
                    if (appointment.start) {
                        try {
                            // extract date and format as YYYY-MM-DD
                            var appointmentDateTime = new Date(appointment.start);
                            var year = appointmentDateTime.getFullYear();
                            var month = String(appointmentDateTime.getMonth() + 1).padStart(2, '0');
                            var day = String(appointmentDateTime.getDate()).padStart(2, '0');
                            appointmentDate = "".concat(year, "-").concat(month, "-").concat(day);
                        }
                        catch (error) {
                            console.warn('Failed to parse appointment date:', appointment.start, error);
                            (0, aws_serverless_1.captureException)(error);
                            appointmentDate = 'unknown';
                        }
                    }
                    // Initialize date entry if it doesn't exist
                    if (!dailyVisitsMap_1.has(appointmentDate)) {
                        dailyVisitsMap_1.set(appointmentDate, { inPerson: 0, telemed: 0 });
                    }
                    var dayData = dailyVisitsMap_1.get(appointmentDate);
                    if (isTelemedicine) {
                        typeCounts_1.Telemed++;
                        dayData.telemed++;
                    }
                    else if (isInPerson) {
                        typeCounts_1['In-Person']++;
                        dayData.inPerson++;
                    }
                    // Note: Skip appointments that don't have a clear type - they won't be counted
                });
                totalAppointments_1 = activeAppointments.length;
                locationVisitsMap_1 = new Map();
                activeAppointments.forEach(function (appointment) {
                    var _a, _b;
                    // Get location reference from appointment
                    var participantWithLocation = (_a = appointment.participant) === null || _a === void 0 ? void 0 : _a.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); });
                    // Check if appointment is telemedicine or in-person (using same logic as daily visits)
                    var isTelemedicine = (0, utils_1.isTelemedAppointment)(appointment);
                    var isInPerson = (0, utils_1.isInPersonAppointment)(appointment);
                    var locationKey = 'Unknown Location';
                    var locationId = 'unknown';
                    if ((_b = participantWithLocation === null || participantWithLocation === void 0 ? void 0 : participantWithLocation.actor) === null || _b === void 0 ? void 0 : _b.reference) {
                        locationId = participantWithLocation.actor.reference.replace('Location/', '');
                        // Find the location resource by ID
                        var location_1 = locations_1.find(function (loc) { return loc.id === locationId; });
                        locationKey = (location_1 === null || location_1 === void 0 ? void 0 : location_1.name) || 'Unknown Location';
                    }
                    var currentData = locationVisitsMap_1.get(locationKey) || { locationId: locationId, inPerson: 0, telemed: 0 };
                    if (isTelemedicine) {
                        currentData.telemed++;
                    }
                    else if (isInPerson) {
                        currentData.inPerson++;
                    }
                    // Note: Skip appointments that don't have a clear type - they won't be counted
                    locationVisitsMap_1.set(locationKey, currentData);
                });
                console.log('Location visits summary:', Array.from(locationVisitsMap_1.entries()).map(function (_a) {
                    var location = _a[0], data = _a[1];
                    return "".concat(location, ": ").concat(data.inPerson, " in-person, ").concat(data.telemed, " telemed, total: ").concat(data.inPerson + data.telemed);
                }));
                locationVisits = Array.from(locationVisitsMap_1.entries())
                    .sort(function (_a, _b) {
                    var nameA = _a[0];
                    var nameB = _b[0];
                    return nameA.localeCompare(nameB);
                })
                    .map(function (_a) {
                    var locationName = _a[0], data = _a[1];
                    return ({
                        locationName: locationName,
                        locationId: data.locationId,
                        inPerson: data.inPerson,
                        telemed: data.telemed,
                        total: data.inPerson + data.telemed,
                    });
                });
                practitionerVisitsMap_1 = new Map();
                practitionerMap_1 = new Map();
                practitioners.forEach(function (practitioner) {
                    if (practitioner.id) {
                        practitionerMap_1.set(practitioner.id, practitioner);
                    }
                });
                activeAppointments.forEach(function (appointment) {
                    var _a, _b;
                    if (!appointment.id)
                        return;
                    // Check if appointment is telemedicine or in-person (using same logic as daily visits)
                    var isTelemedicine = (0, utils_1.isTelemedAppointment)(appointment);
                    var isInPerson = (0, utils_1.isInPersonAppointment)(appointment);
                    // Skip appointments without clear type
                    if (!isTelemedicine && !isInPerson)
                        return;
                    // Find the encounter for this appointment
                    var encounter = encounterMap_1.get("Appointment/".concat(appointment.id));
                    if (!encounter)
                        return;
                    // Get attending provider and intake performer
                    var attendingProviderId = (0, utils_1.getAttendingPractitionerId)(encounter);
                    var admitterProviderId = (0, utils_1.getAdmitterPractitionerId)(encounter);
                    // For telemed encounters, practitioners may not have specific role types (Attender/Admitter)
                    // In this case, find any practitioner participant
                    var telemedPractitionerId;
                    if (isTelemedicine && !attendingProviderId && !admitterProviderId) {
                        var practitionerParticipant = (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.find(function (part) { var _a, _b; return (_b = (_a = part.individual) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.includes('Practitioner/'); });
                        if ((_b = practitionerParticipant === null || practitionerParticipant === void 0 ? void 0 : practitionerParticipant.individual) === null || _b === void 0 ? void 0 : _b.reference) {
                            telemedPractitionerId = practitionerParticipant.individual.reference.replace('Practitioner/', '');
                        }
                    }
                    // Process attending provider
                    if (attendingProviderId) {
                        var key = "".concat(attendingProviderId, "-Attending Provider");
                        var currentData = practitionerVisitsMap_1.get(key) || {
                            practitionerId: attendingProviderId,
                            role: 'Attending Provider',
                            inPerson: 0,
                            telemed: 0,
                        };
                        if (isTelemedicine) {
                            currentData.telemed++;
                        }
                        else if (isInPerson) {
                            currentData.inPerson++;
                        }
                        practitionerVisitsMap_1.set(key, currentData);
                    }
                    // Process intake performer
                    if (admitterProviderId && admitterProviderId !== attendingProviderId) {
                        var key = "".concat(admitterProviderId, "-Intake Performer");
                        var currentData = practitionerVisitsMap_1.get(key) || {
                            practitionerId: admitterProviderId,
                            role: 'Intake Performer',
                            inPerson: 0,
                            telemed: 0,
                        };
                        if (isTelemedicine) {
                            currentData.telemed++;
                        }
                        else if (isInPerson) {
                            currentData.inPerson++;
                        }
                        practitionerVisitsMap_1.set(key, currentData);
                    }
                    // Process telemed practitioner if no attending/admitter found
                    if (telemedPractitionerId) {
                        var key = "".concat(telemedPractitionerId, "-Attending Provider");
                        var currentData = practitionerVisitsMap_1.get(key) || {
                            practitionerId: telemedPractitionerId,
                            role: 'Attending Provider',
                            inPerson: 0,
                            telemed: 0,
                        };
                        currentData.telemed++;
                        practitionerVisitsMap_1.set(key, currentData);
                    }
                });
                practitionerVisits = Array.from(practitionerVisitsMap_1.entries())
                    .sort(function (_a, _b) {
                    var keyA = _a[0];
                    var keyB = _b[0];
                    return keyA.localeCompare(keyB);
                })
                    .map(function (_a) {
                    var _b, _c;
                    var _key = _a[0], data = _a[1];
                    var practitioner = practitionerMap_1.get(data.practitionerId);
                    var practitionerName = ((_b = practitioner === null || practitioner === void 0 ? void 0 : practitioner.name) === null || _b === void 0 ? void 0 : _b[0])
                        ? "".concat(((_c = practitioner.name[0].given) === null || _c === void 0 ? void 0 : _c.join(' ')) || '', " ").concat(practitioner.name[0].family || '').trim()
                        : 'Unknown Provider';
                    return {
                        practitionerId: data.practitionerId,
                        practitionerName: practitionerName,
                        role: data.role,
                        inPerson: data.inPerson,
                        telemed: data.telemed,
                        total: data.inPerson + data.telemed,
                    };
                });
                dailyVisits = Array.from(dailyVisitsMap_1.entries())
                    .filter(function (_a) {
                    var date = _a[0];
                    return date !== 'unknown';
                }) // Filter out appointments without valid dates
                    .sort(function (_a, _b) {
                    var dateA = _a[0];
                    var dateB = _b[0];
                    return dateA.localeCompare(dateB);
                }) // Sort by date
                    .map(function (_a) {
                    var date = _a[0], counts = _a[1];
                    return ({
                        date: date,
                        inPerson: counts.inPerson,
                        telemed: counts.telemed,
                        unknown: 0, // Always 0 since we're not tracking unknown appointments
                        total: counts.inPerson + counts.telemed,
                    });
                });
                appointmentTypes = Object.entries(typeCounts_1).map(function (_a) {
                    var type = _a[0], count = _a[1];
                    return ({
                        type: type,
                        count: count,
                        percentage: totalAppointments_1 > 0 ? Math.round((count / totalAppointments_1) * 100) : 0,
                    });
                });
                response = {
                    message: "Found ".concat(totalAppointments_1, " appointments: ").concat(typeCounts_1['In-Person'], " in-person, ").concat(typeCounts_1.Telemed, " telemed"),
                    totalAppointments: totalAppointments_1,
                    appointmentTypes: appointmentTypes,
                    dailyVisits: dailyVisits,
                    locationVisits: locationVisits,
                    practitionerVisits: practitionerVisits,
                    dateRange: dateRange,
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

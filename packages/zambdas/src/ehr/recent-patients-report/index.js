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
var ZAMBDA_NAME = 'recent-patients-report';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, dateRange_1, locationId, oystehr_1, allResources, offset, pageSize, baseSearchParams, searchBundle, pageCount, pageResources, pageAppointments, pageAppointmentsCount, appointments, patients, encounters, locations, patientMap_1, encounterMap_1, locationMap_1, activeAppointments, response_1, patientAppointmentsMap_1, allBatchRequests_1, BATCH_SIZE_1, requestBatches_1, i, allBatchResults, patientHistoryMap_1, patientIds_1, patientRecords, _i, _a, _b, patientId, patientAppointments, patient, sortedAppointments, mostRecentAppointment, patientName, firstName, lastName, phoneNumber, email, serviceCategory, serviceCategoryCoding, hasHistoricalAppointments, patientStatus, response, error_1, ENVIRONMENT;
    var _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                _j.trys.push([0, 7, , 8]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                dateRange_1 = validatedParameters.dateRange, locationId = validatedParameters.locationId;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                // Get M2M token for FHIR access
                m2mToken = _j.sent();
                oystehr_1 = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Searching for appointments in date range:', dateRange_1, 'location:', locationId);
                allResources = [];
                offset = 0;
                pageSize = 1000;
                baseSearchParams = [
                    {
                        name: 'date',
                        value: "ge".concat(dateRange_1.start),
                    },
                    {
                        name: 'date',
                        value: "le".concat(dateRange_1.end),
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
                        name: '_count',
                        value: pageSize.toString(),
                    },
                ];
                // Add location filter if provided
                if (locationId) {
                    baseSearchParams.push({
                        name: 'location',
                        value: "Location/".concat(locationId),
                    });
                }
                return [4 /*yield*/, oystehr_1.fhir.search({
                        resourceType: 'Appointment',
                        params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                    })];
            case 2:
                searchBundle = _j.sent();
                pageCount = 1;
                console.log("Fetching page ".concat(pageCount, " of appointments, patients, encounters, and locations..."));
                pageResources = searchBundle.unbundle();
                allResources = allResources.concat(pageResources);
                pageAppointments = pageResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                console.log("Page ".concat(pageCount, ": Found ").concat(pageResources.length, " total resources (").concat(pageAppointments.length, " appointments)"));
                _j.label = 3;
            case 3:
                if (!((_c = searchBundle.link) === null || _c === void 0 ? void 0 : _c.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 5];
                offset += pageSize;
                pageCount++;
                console.log("Fetching page ".concat(pageCount, " of appointments, patients, encounters, and locations..."));
                return [4 /*yield*/, oystehr_1.fhir.search({
                        resourceType: 'Appointment',
                        params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                    })];
            case 4:
                searchBundle = _j.sent();
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
                patients = allResources.filter(function (resource) { return resource.resourceType === 'Patient'; });
                encounters = allResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
                locations = allResources.filter(function (resource) { return resource.resourceType === 'Location'; });
                console.log("Total resources found across ".concat(pageCount, " pages: ").concat(allResources.length, " (").concat(appointments.length, " appointments, ").concat(patients.length, " patients, ").concat(encounters.length, " encounters, ").concat(locations.length, " locations)"));
                patientMap_1 = new Map();
                patients.forEach(function (patient) {
                    if (patient.id) {
                        patientMap_1.set(patient.id, patient);
                    }
                });
                encounterMap_1 = new Map();
                encounters.forEach(function (encounter) {
                    var _a, _b;
                    var appointmentRef = (_b = (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference;
                    if (appointmentRef && encounter.id) {
                        encounterMap_1.set(appointmentRef, encounter);
                    }
                });
                locationMap_1 = new Map();
                locations.forEach(function (location) {
                    if (location.id) {
                        locationMap_1.set(location.id, location);
                    }
                });
                activeAppointments = appointments.filter(function (appointment) {
                    if (!appointment.id)
                        return false;
                    var encounter = encounterMap_1.get("Appointment/".concat(appointment.id));
                    if (!encounter)
                        return true; // Keep appointments without encounters
                    var visitStatus = (0, utils_1.getInPersonVisitStatus)(appointment, encounter);
                    return visitStatus !== 'cancelled' && visitStatus !== 'no show';
                });
                console.log("Filtered appointments: ".concat(appointments.length, " total, ").concat(activeAppointments.length, " active (excluded ").concat(appointments.length - activeAppointments.length, " cancelled/no show visits)"));
                if (activeAppointments.length === 0) {
                    response_1 = {
                        message: 'No appointments found for the specified date range',
                        totalPatients: 0,
                        patients: [],
                        dateRange: dateRange_1,
                        locationId: locationId,
                    };
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response_1),
                        }];
                }
                patientAppointmentsMap_1 = new Map();
                activeAppointments.forEach(function (appointment) {
                    var _a, _b;
                    var patientRef = (_a = appointment.participant) === null || _a === void 0 ? void 0 : _a.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); });
                    if ((_b = patientRef === null || patientRef === void 0 ? void 0 : patientRef.actor) === null || _b === void 0 ? void 0 : _b.reference) {
                        var patientId = patientRef.actor.reference.replace('Patient/', '');
                        var existing = patientAppointmentsMap_1.get(patientId) || [];
                        existing.push(appointment);
                        patientAppointmentsMap_1.set(patientId, existing);
                    }
                });
                console.log("Found ".concat(patientAppointmentsMap_1.size, " unique patients with appointments"));
                // For each patient, check if they had appointments before the date range to determine if new or existing
                console.log('Checking patient history to determine new vs existing status...');
                allBatchRequests_1 = Array.from(patientAppointmentsMap_1.keys()).map(function (patientId) {
                    // Don't use URLSearchParams for FHIR date prefixes - it encodes the colons which breaks the search
                    var url = "/Appointment?patient=Patient/".concat(patientId, "&date=lt").concat(dateRange_1.start, "&_count=1");
                    return {
                        method: 'GET',
                        url: url,
                    };
                });
                // Log first request URL for debugging
                if (allBatchRequests_1.length > 0) {
                    console.log("Sample history check URL: ".concat(allBatchRequests_1[0].url));
                    console.log("Date range start for history check: ".concat(dateRange_1.start));
                }
                BATCH_SIZE_1 = 50;
                requestBatches_1 = [];
                for (i = 0; i < allBatchRequests_1.length; i += BATCH_SIZE_1) {
                    requestBatches_1.push(allBatchRequests_1.slice(i, i + BATCH_SIZE_1));
                }
                console.log("Executing ".concat(allBatchRequests_1.length, " patient history checks in ").concat(requestBatches_1.length, " batch(es) of up to ").concat(BATCH_SIZE_1));
                return [4 /*yield*/, Promise.all(requestBatches_1.map(function (batchRequests, batchIndex) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log("Executing batch ".concat(batchIndex + 1, "/").concat(requestBatches_1.length, " with ").concat(batchRequests.length, " requests"));
                                    return [4 /*yield*/, oystehr_1.fhir.batch({
                                            requests: batchRequests,
                                        })];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); }))];
            case 6:
                allBatchResults = _j.sent();
                patientHistoryMap_1 = new Map();
                patientIds_1 = Array.from(patientAppointmentsMap_1.keys());
                allBatchResults.forEach(function (batchResult, batchIndex) {
                    var _a, _b;
                    var batchStartIndex = batchIndex * BATCH_SIZE_1;
                    console.log("Processing batch ".concat(batchIndex + 1, " results, starting at patient index ").concat(batchStartIndex, ", batch has ").concat(((_a = batchResult.entry) === null || _a === void 0 ? void 0 : _a.length) || 0, " entries"));
                    (_b = batchResult.entry) === null || _b === void 0 ? void 0 : _b.forEach(function (entry, entryIndex) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        var patientId = patientIds_1[batchStartIndex + entryIndex];
                        var requestUrl = (_a = allBatchRequests_1[batchStartIndex + entryIndex]) === null || _a === void 0 ? void 0 : _a.url;
                        var hasHistoricalAppointments = false;
                        console.log("Entry ".concat(entryIndex, ": response status=").concat((_b = entry.response) === null || _b === void 0 ? void 0 : _b.status, ", outcome.id=").concat((_d = (_c = entry.response) === null || _c === void 0 ? void 0 : _c.outcome) === null || _d === void 0 ? void 0 : _d.id, ", resourceType=").concat((_e = entry.resource) === null || _e === void 0 ? void 0 : _e.resourceType, ", patientId=").concat(patientId));
                        if (((_g = (_f = entry.response) === null || _f === void 0 ? void 0 : _f.outcome) === null || _g === void 0 ? void 0 : _g.id) === 'ok' &&
                            entry.resource &&
                            entry.resource.resourceType === 'Bundle' &&
                            entry.resource.type === 'searchset') {
                            var innerBundle = entry.resource;
                            hasHistoricalAppointments = ((_j = (_h = innerBundle.entry) === null || _h === void 0 ? void 0 : _h.length) !== null && _j !== void 0 ? _j : 0) > 0;
                            console.log("Patient ".concat(patientId, " searched with URL: ").concat(requestUrl, ", found ").concat(((_k = innerBundle.entry) === null || _k === void 0 ? void 0 : _k.length) || 0, " historical appointment(s), bundle.total=").concat(innerBundle.total));
                        }
                        patientHistoryMap_1.set(patientId, hasHistoricalAppointments);
                    });
                });
                console.log("Patient history checks completed. ".concat(Array.from(patientHistoryMap_1.values()).filter(Boolean).length, " patients with history, ").concat(Array.from(patientHistoryMap_1.values()).filter(function (v) { return !v; }).length, " without history"));
                patientRecords = [];
                for (_i = 0, _a = patientAppointmentsMap_1.entries(); _i < _a.length; _i++) {
                    _b = _a[_i], patientId = _b[0], patientAppointments = _b[1];
                    patient = patientMap_1.get(patientId);
                    if (!patient) {
                        console.warn("Patient ".concat(patientId, " not found in patient map, skipping"));
                        continue;
                    }
                    sortedAppointments = patientAppointments.sort(function (a, b) {
                        var dateA = new Date(a.start || '');
                        var dateB = new Date(b.start || '');
                        return dateB.getTime() - dateA.getTime();
                    });
                    mostRecentAppointment = sortedAppointments[0];
                    if (!mostRecentAppointment.id || !mostRecentAppointment.start) {
                        continue;
                    }
                    patientName = (_d = patient.name) === null || _d === void 0 ? void 0 : _d[0];
                    firstName = ((_e = patientName === null || patientName === void 0 ? void 0 : patientName.given) === null || _e === void 0 ? void 0 : _e[0]) || 'Unknown';
                    lastName = (patientName === null || patientName === void 0 ? void 0 : patientName.family) || 'Unknown';
                    phoneNumber = (0, utils_1.getPhoneNumberForIndividual)(patient) || '';
                    email = (0, utils_1.getEmailForIndividual)(patient) || '';
                    serviceCategory = 'Unknown';
                    serviceCategoryCoding = (_h = (_g = (_f = mostRecentAppointment.serviceCategory) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.coding) === null || _h === void 0 ? void 0 : _h[0];
                    if (serviceCategoryCoding) {
                        serviceCategory = serviceCategoryCoding.display || serviceCategoryCoding.code || 'Unknown';
                    }
                    hasHistoricalAppointments = patientHistoryMap_1.get(patientId) || false;
                    patientStatus = hasHistoricalAppointments ? 'existing' : 'new';
                    patientRecords.push({
                        patientId: patientId,
                        firstName: firstName,
                        lastName: lastName,
                        phoneNumber: phoneNumber,
                        email: email,
                        mostRecentVisit: {
                            appointmentId: mostRecentAppointment.id,
                            date: mostRecentAppointment.start,
                            serviceCategory: serviceCategory,
                        },
                        patientStatus: patientStatus,
                    });
                }
                // Sort by last name, then first name
                patientRecords.sort(function (a, b) {
                    var lastNameCompare = a.lastName.localeCompare(b.lastName);
                    if (lastNameCompare !== 0)
                        return lastNameCompare;
                    return a.firstName.localeCompare(b.firstName);
                });
                response = {
                    message: "Found ".concat(patientRecords.length, " patients with appointments in the date range"),
                    totalPatients: patientRecords.length,
                    patients: patientRecords,
                    dateRange: dateRange_1,
                    locationId: locationId,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 7:
                error_1 = _j.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 8: return [2 /*return*/];
        }
    });
}); });

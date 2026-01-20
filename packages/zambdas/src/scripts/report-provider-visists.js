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
var sdk_1 = require("@oystehr/sdk");
var fs = require("fs");
var moduleIdentification_1 = require("utils/lib/fhir/moduleIdentification");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
// Helper to get timezone abbreviation (e.g., "PST", "EST")
function getTimezoneAbbreviation() {
    var date = new Date();
    var timeZoneName = date
        .toLocaleDateString('en', {
        day: '2-digit',
        timeZoneName: 'short',
    })
        .slice(4);
    return timeZoneName;
}
// Helper function to validate and parse date in yyyy-mm-dd format
function parseDate(dateString, paramName) {
    var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
        throw new Error("\u274C ".concat(paramName, " must be in yyyy-mm-dd format (e.g., 2025-11-01)"));
    }
    var date = new Date(dateString + 'T00:00:00.000Z');
    if (isNaN(date.getTime())) {
        throw new Error("\u274C Invalid ".concat(paramName, ": ").concat(dateString));
    }
    return date;
}
// Helper function to get UTC range for a date string
function getUTCDateRange(startDateString, endDateString) {
    var start = parseDate(startDateString, 'Start date');
    var end = parseDate(endDateString, 'End date');
    // Set start to beginning of day (00:00:00)
    start.setUTCHours(0, 0, 0, 0);
    // Set end to end of day (23:59:59.999)
    end.setUTCHours(23, 59, 59, 999);
    // Validate that start is before or equal to end
    if (start.getTime() > end.getTime()) {
        throw new Error("\u274C Start date (".concat(startDateString, ") must be before or equal to end date (").concat(endDateString, ")"));
    }
    return { start: start, end: end };
}
// Function to generate CSV report from visit details
function generateVisitReport(visitDetails, csvFilename) {
    try {
        // Prepare CSV data
        var csvData = visitDetails.map(function (visit) {
            var _a, _b, _c, _d, _e;
            // Format date as yyyy-MMM-dd
            var date = visit.appointment.start
                ? new Date(visit.appointment.start)
                    .toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                })
                    .replace(/,/g, '') // Remove commas from date format
                : 'Unknown';
            // Get classification from encounter
            var classification = ((_a = visit.encounter.class) === null || _a === void 0 ? void 0 : _a.display) || ((_b = visit.encounter.class) === null || _b === void 0 ? void 0 : _b.code) || 'Unknown';
            // Get status from encounter
            var status = visit.encounter.status || 'unknown';
            // Get provider name
            var provider = ((_d = (_c = visit.practitioner) === null || _c === void 0 ? void 0 : _c.name) === null || _d === void 0 ? void 0 : _d[0])
                ? "".concat(((_e = visit.practitioner.name[0].given) === null || _e === void 0 ? void 0 : _e.join(' ')) || '', " ").concat(visit.practitioner.name[0].family || '').trim()
                : 'No provider';
            // Get location name
            var location = visit.location.name || 'Unknown location';
            return {
                date: date,
                classification: classification,
                status: status,
                provider: provider,
                location: location,
            };
        });
        console.log("\n\uD83D\uDCCA Generating CSV report: ".concat(csvFilename));
        // CSV headers
        var headers = ['Date', 'Classification', 'Status', 'Provider', 'Location'];
        // Convert data to CSV format
        var csvRows = __spreadArray([
            headers.join(',')
        ], csvData.map(function (row) {
            return ["\"".concat(row.date, "\""), "\"".concat(row.classification, "\""), "\"".concat(row.status, "\""), "\"".concat(row.provider, "\""), "\"".concat(row.location, "\"")].join(',');
        }), true);
        // Write CSV file
        var csvContent = csvRows.join('\n');
        fs.writeFileSync(csvFilename, csvContent, 'utf8');
        console.log("\u2705 CSV report generated successfully: ".concat(csvFilename));
        console.log("\uD83D\uDCC4 Report contains ".concat(csvData.length, " visit records"));
        // Print summary statistics
        var statusCounts_1 = new Map();
        var classificationCounts_1 = new Map();
        csvData.forEach(function (row) {
            statusCounts_1.set(row.status, (statusCounts_1.get(row.status) || 0) + 1);
            classificationCounts_1.set(row.classification, (classificationCounts_1.get(row.classification) || 0) + 1);
        });
        console.log("\n\uD83D\uDCCB Report Summary:");
        console.log("\n   By Status:");
        for (var _i = 0, _a = Array.from(statusCounts_1.entries()).sort(); _i < _a.length; _i++) {
            var _b = _a[_i], status_1 = _b[0], count = _b[1];
            console.log("      ".concat(status_1.padEnd(15), " ").concat(count, " visits"));
        }
        console.log("\n   By Classification:");
        for (var _c = 0, _d = Array.from(classificationCounts_1.entries()).sort(); _c < _d.length; _c++) {
            var _e = _d[_c], classification = _e[0], count = _e[1];
            console.log("      ".concat(classification.padEnd(15), " ").concat(count, " visits"));
        }
    }
    catch (error) {
        console.error("\u274C Error generating CSV report:", error);
        throw error;
    }
}
function findVisitsBetweenDates(oystehr, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var allResources, offset, pageSize, baseSearchParams, searchBundle, pageCount, pageResources, pageAppointments, pageAppointmentsCount, appointments, locations, encounters, practitioners, locationMap_1, encounterMap_1, practitionerMap_1, visitDetails, matchedCount, unmatchedCount, cancelledCount, _loop_1, _i, appointments_1, appointment, error_1;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 5, , 6]);
                    allResources = [];
                    offset = 0;
                    pageSize = 1000;
                    baseSearchParams = [
                        {
                            name: 'date',
                            value: "ge".concat(startDate.toISOString()),
                        },
                        {
                            name: 'date',
                            value: "le".concat(endDate.toISOString()),
                        },
                        {
                            name: '_tag',
                            value: "".concat(moduleIdentification_1.OTTEHR_MODULE.TM, ",").concat(moduleIdentification_1.OTTEHR_MODULE.IP),
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
                case 1:
                    searchBundle = _f.sent();
                    pageCount = 1;
                    console.log("Fetching page ".concat(pageCount, " of appointments and locations..."));
                    pageResources = searchBundle.unbundle();
                    allResources = allResources.concat(pageResources);
                    pageAppointments = pageResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                    console.log("Page ".concat(pageCount, ": Found ").concat(pageResources.length, " total resources (").concat(pageAppointments.length, " appointments)"));
                    _f.label = 2;
                case 2:
                    if (!((_a = searchBundle.link) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 4];
                    offset += pageSize;
                    pageCount++;
                    console.log("Fetching page ".concat(pageCount, " of appointments and locations..."));
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                        })];
                case 3:
                    searchBundle = _f.sent();
                    pageResources = searchBundle.unbundle();
                    allResources = allResources.concat(pageResources);
                    pageAppointmentsCount = pageResources.filter(function (resource) { return resource.resourceType === 'Appointment'; }).length;
                    console.log("Page ".concat(pageCount, ": Found ").concat(pageResources.length, " total resources (").concat(pageAppointmentsCount, " appointments)"));
                    // Safety check to prevent infinite loops
                    if (pageCount > 100) {
                        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
                        return [3 /*break*/, 4];
                    }
                    return [3 /*break*/, 2];
                case 4:
                    appointments = allResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                    locations = allResources.filter(function (resource) { return resource.resourceType === 'Location'; });
                    encounters = allResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
                    practitioners = allResources.filter(function (resource) { return resource.resourceType === 'Practitioner'; });
                    console.log("Total resources found across ".concat(pageCount, " pages: ").concat(allResources.length, " (").concat(appointments.length, " appointments, ").concat(locations.length, " locations, ").concat(encounters.length, " encounters, ").concat(practitioners.length, " practitioners)"));
                    locationMap_1 = new Map();
                    locations.forEach(function (location) {
                        if (location.id) {
                            locationMap_1.set(location.id, location);
                        }
                    });
                    encounterMap_1 = new Map();
                    encounters.forEach(function (encounter) {
                        if (encounter.id) {
                            encounterMap_1.set(encounter.id, encounter);
                        }
                    });
                    practitionerMap_1 = new Map();
                    practitioners.forEach(function (practitioner) {
                        if (practitioner.id) {
                            practitionerMap_1.set(practitioner.id, practitioner);
                        }
                    });
                    console.log("\n\uD83D\uDD0D Matching appointments with related resources...");
                    visitDetails = [];
                    matchedCount = 0;
                    unmatchedCount = 0;
                    cancelledCount = 0;
                    _loop_1 = function (appointment) {
                        // Check if appointment is cancelled
                        if (appointment.status === 'cancelled') {
                            cancelledCount++;
                            console.log("\uD83D\uDEAB Skipping cancelled appointment: Appointment/".concat(appointment.id));
                            return "continue";
                        }
                        // Find location from appointment.participant
                        var location_1 = void 0;
                        var locationParticipant = (_b = appointment.participant) === null || _b === void 0 ? void 0 : _b.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); });
                        if ((_c = locationParticipant === null || locationParticipant === void 0 ? void 0 : locationParticipant.actor) === null || _c === void 0 ? void 0 : _c.reference) {
                            var locationId = locationParticipant.actor.reference.split('/')[1];
                            location_1 = locationMap_1.get(locationId);
                        }
                        // Find encounter that references this appointment
                        var encounter = void 0;
                        if (appointment.id) {
                            encounter = encounters.find(function (enc) { var _a; return (_a = enc.appointment) === null || _a === void 0 ? void 0 : _a.some(function (appt) { return appt.reference === "Appointment/".concat(appointment.id); }); });
                        }
                        // Find practitioner from encounter participants
                        var practitioner = void 0;
                        if (encounter) {
                            var practitionerParticipant = (_d = encounter.participant) === null || _d === void 0 ? void 0 : _d.find(function (p) { var _a, _b; return (_b = (_a = p.individual) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Practitioner/'); });
                            if ((_e = practitionerParticipant === null || practitionerParticipant === void 0 ? void 0 : practitionerParticipant.individual) === null || _e === void 0 ? void 0 : _e.reference) {
                                var practitionerId = practitionerParticipant.individual.reference.split('/')[1];
                                practitioner = practitionerMap_1.get(practitionerId);
                            }
                        }
                        // Only add if we have all required resources
                        if (location_1 && encounter) {
                            visitDetails.push({
                                appointment: appointment,
                                encounter: encounter,
                                location: location_1,
                                practitioner: practitioner,
                            });
                            matchedCount++;
                        }
                        else {
                            unmatchedCount++;
                            console.log("\u26A0\uFE0F  Incomplete match for Appointment/".concat(appointment.id, ": ") +
                                "location=".concat(!!location_1, ", encounter=").concat(!!encounter, ", practitioner=").concat(!!practitioner));
                        }
                    };
                    // For each appointment, find matching location, encounter, and practitioner
                    for (_i = 0, appointments_1 = appointments; _i < appointments_1.length; _i++) {
                        appointment = appointments_1[_i];
                        _loop_1(appointment);
                    }
                    console.log("\n\u2705 Matched ".concat(matchedCount, " complete visits"));
                    if (cancelledCount > 0) {
                        console.log("\uD83D\uDEAB Skipped ".concat(cancelledCount, " cancelled appointments"));
                    }
                    if (unmatchedCount > 0) {
                        console.log("\u26A0\uFE0F  ".concat(unmatchedCount, " appointments had incomplete data"));
                    }
                    return [2 /*return*/, visitDetails];
                case 5:
                    error_1 = _f.sent();
                    console.error("\u274C Error fetching encounters:", error_1);
                    throw error_1;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, startDateString, endDateString, csvFilenameArg, csvFilename, secrets, token, oystehr, _a, start, end, visitDetails;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    env = process.argv[2];
                    startDateString = process.argv[3];
                    endDateString = process.argv[4];
                    csvFilenameArg = process.argv[5];
                    csvFilename = csvFilenameArg ||
                        "".concat(process.env.HOME || '~', "/Downloads/").concat(env, "-visit-report-").concat(new Date().toISOString().split('T')[0], ".csv");
                    // Validate required arguments
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run script report-provider-visists <env> <start-date> <end-date> [csvFilename]');
                    }
                    if (!startDateString) {
                        throw new Error('❌ Start date is required. Usage: npm run script report-provider-visists <env> <start-date> <end-date> [csvFilename]');
                    }
                    if (!endDateString) {
                        throw new Error('❌ End date is required. Usage: npm run script report-provider-visists <env> <start-date> <end-date> [csvFilename]');
                    }
                    console.log("\n\uD83D\uDCC5 Processing encounters for date range: ".concat(startDateString, " to ").concat(endDateString, " (").concat(getTimezoneAbbreviation(), ")"));
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _b.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    _a = getUTCDateRange(startDateString, endDateString), start = _a.start, end = _a.end;
                    return [4 /*yield*/, findVisitsBetweenDates(oystehr, start, end)];
                case 2:
                    visitDetails = _b.sent();
                    console.log("\n\uD83D\uDCCA Visit Summary:");
                    console.log("   Date Range: ".concat(startDateString, " to ").concat(endDateString));
                    console.log("   Total complete visits: ".concat(visitDetails.length));
                    // // Print visit details
                    // if (visitDetails.length > 0) {
                    //   console.log(`\n📝 Visit Details:\n`);
                    //   console.log('='.repeat(180));
                    //   for (let i = 0; i < visitDetails.length; i++) {
                    //     const { appointment, encounter, location, practitioner } = visitDetails[i];
                    //     const appointmentDate = appointment.start
                    //       ? new Date(appointment.start).toLocaleString('en-US', {
                    //           year: 'numeric',
                    //           month: 'short',
                    //           day: 'numeric',
                    //         })
                    //       : 'Unknown date';
                    //     const locationName = location.name || 'Unknown location';
                    //     const practitionerName = practitioner?.name?.[0]
                    //       ? `${practitioner.name[0].given?.join(' ') || ''} ${practitioner.name[0].family || ''}`.trim()
                    //       : ' - ';
                    //     const encounterStatus = encounter.status || 'unknown';
                    //     const encounterClass = encounter.class?.display || encounter.class?.code || 'Unknown';
                    //     console.log(
                    //       `[${(i + 1).toString().padStart(4)}] ${appointmentDate.padEnd(20)} | ${encounterStatus.padEnd(12)} | ${encounterClass.padEnd(20)} | ${locationName.padEnd(30)} | ${practitionerName.padEnd(30)}`
                    //     );
                    //   }
                    //   console.log('='.repeat(180));
                    //   // Generate CSV report
                    // }
                    generateVisitReport(visitDetails, csvFilename);
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ Encounter report completed'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});

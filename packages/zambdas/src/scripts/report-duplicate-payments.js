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
var sdk_1 = require("@oystehr/sdk");
var fs = require("fs");
var os = require("os");
var path = require("path");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
// Helper function to convert local date to UTC range (from start date to end of today)
function getUTCRangeForLocalDateRangeToToday(localDateString) {
    // Create start of day in local timezone (00:00:00.000)
    var startOfDayLocal = new Date("".concat(localDateString, "T00:00:00.000"));
    // Create end of today in local timezone (23:59:59.999)
    var today = new Date();
    var todayDateString = today.toISOString().split('T')[0];
    var endOfDayLocal = new Date("".concat(todayDateString, "T23:59:59.999"));
    return {
        start: startOfDayLocal,
        end: endOfDayLocal,
    };
}
function getPaymentNoticesByDateRange(oystehr, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function () {
        var currentIndex, total, paymentNotices, encounterMap, appointmentMap, locationMap, startISO, endISO, searchParams, bundledResponse, entries, _i, entries_1, entry, resource, encounter, appointment, location_1, error_1, payments, _a, paymentNotices_1, paymentNotice, payment, encounterId, encounter, appointmentRef, appointmentId, appointment, _b, _c, participant, locationId, location_2;
        var _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    currentIndex = 0;
                    total = 1;
                    paymentNotices = [];
                    encounterMap = new Map();
                    appointmentMap = new Map();
                    locationMap = new Map();
                    startISO = startDate.toISOString();
                    endISO = endDate.toISOString();
                    console.log("Fetching PaymentNotices for date range: ".concat(startISO, " to ").concat(endISO));
                    _g.label = 1;
                case 1:
                    if (!(currentIndex < total)) return [3 /*break*/, 6];
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 4, , 5]);
                    searchParams = [
                        {
                            name: 'created',
                            value: "ge".concat(startISO),
                        },
                        {
                            name: 'created',
                            value: "le".concat(endISO),
                        },
                        {
                            name: '_offset',
                            value: currentIndex,
                        },
                        {
                            name: '_count',
                            value: 1000,
                        },
                        {
                            name: '_total',
                            value: 'accurate',
                        },
                        {
                            name: '_include',
                            value: 'PaymentNotice:request',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:location',
                        },
                    ];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'PaymentNotice',
                            params: searchParams,
                        })];
                case 3:
                    bundledResponse = _g.sent();
                    total = bundledResponse.total || 0;
                    entries = bundledResponse.entry || [];
                    for (_i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                        entry = entries_1[_i];
                        if (entry.resource) {
                            resource = entry.resource;
                            switch (resource.resourceType) {
                                case 'PaymentNotice': {
                                    paymentNotices.push(resource);
                                    break;
                                }
                                case 'Encounter': {
                                    encounter = resource;
                                    if (encounter.id) {
                                        encounterMap.set(encounter.id, encounter);
                                    }
                                    break;
                                }
                                case 'Appointment': {
                                    appointment = resource;
                                    if (appointment.id) {
                                        appointmentMap.set(appointment.id, appointment);
                                    }
                                    break;
                                }
                                case 'Location': {
                                    location_1 = resource;
                                    if (location_1.id) {
                                        locationMap.set(location_1.id, location_1);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    currentIndex += paymentNotices.length - currentIndex;
                    console.log("Fetched ".concat(paymentNotices.length, " PaymentNotices, ").concat(encounterMap.size, " Encounters, ").concat(appointmentMap.size, " Appointments, ").concat(locationMap.size, " Locations (").concat(paymentNotices.length, "/").concat(total, " total)"));
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _g.sent();
                    console.error("Error fetching PaymentNotices at offset ".concat(currentIndex, ":"), error_1);
                    return [3 /*break*/, 6];
                case 5: return [3 /*break*/, 1];
                case 6:
                    console.log("Found ".concat(paymentNotices.length, " PaymentNotices between ").concat(startISO, " and ").concat(endISO));
                    console.log("Found ".concat(encounterMap.size, " Encounters, ").concat(appointmentMap.size, " Appointments, ").concat(locationMap.size, " Locations"));
                    payments = [];
                    for (_a = 0, paymentNotices_1 = paymentNotices; _a < paymentNotices_1.length; _a++) {
                        paymentNotice = paymentNotices_1[_a];
                        payment = {
                            paymentNotice: paymentNotice,
                        };
                        // Link encounter if request references one
                        if (((_d = paymentNotice.request) === null || _d === void 0 ? void 0 : _d.reference) && paymentNotice.request.type === 'Encounter') {
                            encounterId = paymentNotice.request.reference.replace('Encounter/', '');
                            encounter = encounterMap.get(encounterId);
                            if (encounter) {
                                payment.encounter = encounter;
                                // Link appointment if encounter references one
                                if (encounter.appointment && encounter.appointment.length > 0) {
                                    appointmentRef = encounter.appointment[0].reference;
                                    if (appointmentRef) {
                                        appointmentId = appointmentRef.replace('Appointment/', '');
                                        appointment = appointmentMap.get(appointmentId);
                                        if (appointment) {
                                            payment.appointment = appointment;
                                            // Link location if appointment references one
                                            if (appointment.participant) {
                                                for (_b = 0, _c = appointment.participant; _b < _c.length; _b++) {
                                                    participant = _c[_b];
                                                    if ((_f = (_e = participant.actor) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.startsWith('Location/')) {
                                                        locationId = participant.actor.reference.replace('Location/', '');
                                                        location_2 = locationMap.get(locationId);
                                                        if (location_2) {
                                                            payment.location = location_2;
                                                            break; // Use first location found
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        payments.push(payment);
                    }
                    console.log("\u2705 Built ".concat(payments.length, " Payment objects with linked resources"));
                    return [2 /*return*/, payments];
            }
        });
    });
}
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
// Helper to format GMT date to local timezone as yyyy-MM-dd
function formatGMTToLocalDate(gmtDateString) {
    if (!gmtDateString)
        return 'N/A';
    try {
        // Parse the GMT date string and convert to local date
        var gmtDate = new Date(gmtDateString);
        if (isNaN(gmtDate.getTime()))
            return 'N/A';
        // Format as yyyy-MM-dd in local timezone
        var yyyy = gmtDate.getFullYear();
        var mm = String(gmtDate.getMonth() + 1).padStart(2, '0');
        var dd = String(gmtDate.getDate()).padStart(2, '0');
        return "".concat(yyyy, "-").concat(mm, "-").concat(dd);
    }
    catch (_a) {
        return 'N/A';
    }
}
// Helper function to parse string as number, defaulting to 0
function parseAsNumber(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    if (typeof value === 'number') {
        return isNaN(value) ? 0 : value;
    }
    if (typeof value === 'string') {
        var parsed_1 = parseFloat(value);
        return isNaN(parsed_1) ? 0 : parsed_1;
    }
    // For any other type, try to convert to string first, then parse
    var stringValue = String(value);
    var parsed = parseFloat(stringValue);
    return isNaN(parsed) ? 0 : parsed;
}
// Generate CSV report for duplicate payments
function generateDuplicatePaymentsCSV(duplicateGroups, oystehr, customFilename) {
    return __awaiter(this, void 0, void 0, function () {
        var filename, downloadsDir, headers, csvRows, patientNameCache, _i, duplicateGroups_1, _a, key, duplicatePayments, _b, amountStr, amount, patientName, patientId, patient, firstName, lastName, error_2, _c, duplicatePayments_1, payment, paymentDateTime, paymentMethodExtension, paymentMethod, currency, amountWithCurrency, csvContent;
        var _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    if (customFilename) {
                        filename = customFilename;
                    }
                    else {
                        downloadsDir = path.join(os.homedir(), 'Downloads');
                        filename = path.join(downloadsDir, "duplicate-payments.csv");
                    }
                    console.log("\n\uD83D\uDCCA Generating duplicate payments CSV report: ".concat(filename));
                    headers = ['Patient Name', 'Payment Timestamp', 'Amount', 'Payment Method'];
                    csvRows = [headers.join(',')];
                    patientNameCache = new Map();
                    _i = 0, duplicateGroups_1 = duplicateGroups;
                    _o.label = 1;
                case 1:
                    if (!(_i < duplicateGroups_1.length)) return [3 /*break*/, 7];
                    _a = duplicateGroups_1[_i], key = _a[0], duplicatePayments = _a[1];
                    _b = key.split('|'), amountStr = _b[1];
                    amount = parseFloat(amountStr);
                    patientName = 'Unknown';
                    patientId = '';
                    if (!((_e = (_d = duplicatePayments[0].encounter) === null || _d === void 0 ? void 0 : _d.subject) === null || _e === void 0 ? void 0 : _e.reference)) return [3 /*break*/, 5];
                    patientId = duplicatePayments[0].encounter.subject.reference.replace('Patient/', '');
                    if (!patientNameCache.has(patientId)) return [3 /*break*/, 2];
                    patientName = patientNameCache.get(patientId);
                    return [3 /*break*/, 5];
                case 2:
                    _o.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Patient',
                            id: patientId,
                        })];
                case 3:
                    patient = (_o.sent());
                    firstName = ((_h = (_g = (_f = patient.name) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.given) === null || _h === void 0 ? void 0 : _h[0]) || '';
                    lastName = ((_k = (_j = patient.name) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.family) || '';
                    patientName = "".concat(firstName, " ").concat(lastName).trim() || 'Unknown';
                    // Cache the name
                    patientNameCache.set(patientId, patientName);
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _o.sent();
                    patientName = "Patient ".concat(patientId);
                    console.warn("\u26A0\uFE0F Failed to fetch patient name for ".concat(patientId, ": ").concat(JSON.stringify(error_2)));
                    return [3 /*break*/, 5];
                case 5:
                    for (_c = 0, duplicatePayments_1 = duplicatePayments; _c < duplicatePayments_1.length; _c++) {
                        payment = duplicatePayments_1[_c];
                        paymentDateTime = payment.paymentNotice.created
                            ? new Date(payment.paymentNotice.created).toLocaleString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true,
                            })
                            : 'N/A';
                        paymentMethodExtension = (_l = payment.paymentNotice.extension) === null || _l === void 0 ? void 0 : _l.find(function (ext) { return ext.url === 'https://extensions.fhir.zapehr.com/payment-method'; });
                        paymentMethod = (paymentMethodExtension === null || paymentMethodExtension === void 0 ? void 0 : paymentMethodExtension.valueString) || 'N/A';
                        currency = ((_m = payment.paymentNotice.amount) === null || _m === void 0 ? void 0 : _m.currency) || 'USD';
                        amountWithCurrency = "$".concat(amount.toFixed(2), " ").concat(currency);
                        csvRows.push(["\"".concat(patientName, "\""), "\"".concat(paymentDateTime, "\""), "\"".concat(amountWithCurrency, "\""), "\"".concat(paymentMethod, "\"")].join(','));
                    }
                    _o.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7:
                    csvContent = csvRows.join('\n');
                    fs.writeFileSync(filename, csvContent, 'utf8');
                    console.log("\u2705 CSV report generated successfully: ".concat(filename));
                    console.log("\uD83D\uDCC4 Report contains ".concat(csvRows.length - 1, " duplicate payment records"));
                    console.log("\uD83D\uDC65 Unique patients: ".concat(patientNameCache.size));
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, daysAgo, csvFilename, targetDate, targetDateString, secrets, token, oystehr, _a, start, end, payments, timezoneAbbr, paymentGroups, _i, payments_1, payment, appointmentId, amount, key, duplicateGroups, _b, duplicateGroups_2, _c, key, duplicatePayments, _d, appointmentId, amountStr, amount, patientName, patientId, patient, firstName, lastName, error_3, i, payment, paymentDateTime, paymentMethodExtension, paymentMethod, currency;
        var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        return __generator(this, function (_t) {
            switch (_t.label) {
                case 0:
                    env = process.argv[2];
                    daysAgo = parseInt(process.argv[3] || '1', 10);
                    csvFilename = process.argv[4];
                    // Validate daysAgo is a positive number
                    if (isNaN(daysAgo) || daysAgo < 0) {
                        throw new Error('❌ Days ago must be a positive number. Usage: npm run script report-duplicate-payments <env> <days-ago>');
                    }
                    targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() - daysAgo);
                    targetDateString = targetDate.toISOString().split('T')[0];
                    console.log("\n\uD83D\uDCC5 Analyzing payments from ".concat(daysAgo, " day(s) ago (").concat(targetDateString, ")"));
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _t.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    _a = getUTCRangeForLocalDateRangeToToday(targetDateString), start = _a.start, end = _a.end;
                    return [4 /*yield*/, getPaymentNoticesByDateRange(oystehr, start, end)];
                case 2:
                    payments = _t.sent();
                    if (payments.length === 0) {
                        console.log('No payment notices found for the specified date.');
                        return [2 /*return*/];
                    }
                    timezoneAbbr = getTimezoneAbbreviation();
                    console.log("\n\uD83D\uDCCA Payment Notices for ".concat(targetDateString, " (").concat(timezoneAbbr, "):"));
                    console.log("Total payments: ".concat(payments.length));
                    // Check for duplicate payments (same appointment and same amount)
                    console.log("\n\uD83D\uDD0D Checking for duplicate payments...");
                    paymentGroups = new Map();
                    for (_i = 0, payments_1 = payments; _i < payments_1.length; _i++) {
                        payment = payments_1[_i];
                        appointmentId = (_e = payment.appointment) === null || _e === void 0 ? void 0 : _e.id;
                        amount = parseAsNumber((_f = payment.paymentNotice.amount) === null || _f === void 0 ? void 0 : _f.value);
                        // console.log(`Processing PaymentNotice ID: ${payment.paymentNotice.id}, Appointment ID: ${appointmentId}, Amount: ${amount}`);
                        if (appointmentId && amount > 0) {
                            key = "".concat(appointmentId, "|").concat(amount);
                            if (!paymentGroups.has(key)) {
                                paymentGroups.set(key, []);
                            }
                            paymentGroups.get(key).push(payment);
                        }
                    }
                    duplicateGroups = Array.from(paymentGroups.entries()).filter(function (_a) {
                        var _ = _a[0], payments = _a[1];
                        return payments.length > 1;
                    });
                    if (!(duplicateGroups.length > 0)) return [3 /*break*/, 13];
                    console.log("\n\u26A0\uFE0F  Found ".concat(duplicateGroups.length, " appointment(s) with duplicate payments:"));
                    console.log('='.repeat(140));
                    _b = 0, duplicateGroups_2 = duplicateGroups;
                    _t.label = 3;
                case 3:
                    if (!(_b < duplicateGroups_2.length)) return [3 /*break*/, 11];
                    _c = duplicateGroups_2[_b], key = _c[0], duplicatePayments = _c[1];
                    _d = key.split('|'), appointmentId = _d[0], amountStr = _d[1];
                    amount = parseFloat(amountStr);
                    console.log("\n\uD83D\uDD34 Duplicate Payment Alert - Appointment: ".concat(appointmentId));
                    console.log("   Amount: $".concat(amount.toFixed(2), " (").concat(duplicatePayments.length, " payments)"));
                    console.log("   Location: ".concat(((_g = duplicatePayments[0].location) === null || _g === void 0 ? void 0 : _g.name) || 'Unknown'));
                    console.log("   Appointment Date: ".concat(((_h = duplicatePayments[0].appointment) === null || _h === void 0 ? void 0 : _h.start) ? formatGMTToLocalDate(duplicatePayments[0].appointment.start) : 'N/A'));
                    patientName = 'Unknown';
                    patientId = 'N/A';
                    if (!((_k = (_j = duplicatePayments[0].encounter) === null || _j === void 0 ? void 0 : _j.subject) === null || _k === void 0 ? void 0 : _k.reference)) return [3 /*break*/, 8];
                    patientId = duplicatePayments[0].encounter.subject.reference.replace('Patient/', '');
                    _t.label = 4;
                case 4:
                    _t.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Patient',
                            id: patientId,
                        })];
                case 5:
                    patient = (_t.sent());
                    firstName = ((_o = (_m = (_l = patient.name) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.given) === null || _o === void 0 ? void 0 : _o[0]) || '';
                    lastName = ((_q = (_p = patient.name) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.family) || '';
                    patientName = "".concat(firstName, " ").concat(lastName).trim() || 'Unknown';
                    console.log("   Patient: ".concat(patientName, " (ID: ").concat(patientId, ")"));
                    return [3 /*break*/, 7];
                case 6:
                    error_3 = _t.sent();
                    console.log("   Patient: Unable to fetch (ID: ".concat(patientId, ") - ").concat(JSON.stringify(error_3)));
                    return [3 /*break*/, 7];
                case 7: return [3 /*break*/, 9];
                case 8:
                    console.log("   Patient: No patient reference found");
                    _t.label = 9;
                case 9:
                    console.log("\n   Individual Payments:");
                    console.log('   ' + '-'.repeat(130));
                    for (i = 0; i < duplicatePayments.length; i++) {
                        payment = duplicatePayments[i];
                        paymentDateTime = payment.paymentNotice.created
                            ? new Date(payment.paymentNotice.created).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                timeZoneName: 'short',
                            })
                            : 'N/A';
                        paymentMethodExtension = (_r = payment.paymentNotice.extension) === null || _r === void 0 ? void 0 : _r.find(function (ext) { return ext.url === 'https://extensions.fhir.zapehr.com/payment-method'; });
                        paymentMethod = (paymentMethodExtension === null || paymentMethodExtension === void 0 ? void 0 : paymentMethodExtension.valueString) || 'N/A';
                        currency = ((_s = payment.paymentNotice.amount) === null || _s === void 0 ? void 0 : _s.currency) || 'USD';
                        console.log("[".concat(i + 1, "] Patient: ").concat(patientName, " Time: ").concat(paymentDateTime, " Amount: $").concat(amountStr, " ").concat(currency, " Method: ").concat(paymentMethod));
                    }
                    console.log('   ' + '='.repeat(130));
                    _t.label = 10;
                case 10:
                    _b++;
                    return [3 /*break*/, 3];
                case 11:
                    console.log("\n\u26A0\uFE0F  Total duplicate payment groups found: ".concat(duplicateGroups.length));
                    console.log("\uD83D\uDCB0 Total duplicate amount: $".concat(duplicateGroups
                        .reduce(function (sum, _a) {
                        var key = _a[0], payments = _a[1];
                        var amount = parseFloat(key.split('|')[1]);
                        return sum + amount * (payments.length - 1); // Only count the extra payments
                    }, 0)
                        .toFixed(2)));
                    // Generate CSV report
                    return [4 /*yield*/, generateDuplicatePaymentsCSV(duplicateGroups, oystehr, csvFilename)];
                case 12:
                    // Generate CSV report
                    _t.sent();
                    return [3 /*break*/, 14];
                case 13:
                    console.log("\u2705 No duplicate payments found.");
                    _t.label = 14;
                case 14: return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('✅ This is all the transactions for the specified date'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});

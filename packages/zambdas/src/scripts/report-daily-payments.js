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
var os = require("os");
var path = require("path");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
// Helper function to convert local date to UTC range
function getUTCRangeForLocalDate(localDateString) {
    // Create start of day in local timezone (00:00:00.000)
    var startOfDayLocal = new Date("".concat(localDateString, "T00:00:00.000"));
    // Create end of day in local timezone (23:59:59.999)
    var endOfDayLocal = new Date("".concat(localDateString, "T23:59:59.999"));
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
// Add CSV report generation function
function generatePaymentCSVReport(payments, targetDate, env, customFilename) {
    try {
        // Determine filename
        var filename = void 0;
        if (customFilename) {
            filename = customFilename;
        }
        else {
            var downloadsDir = path.join(os.homedir(), 'Downloads');
            filename = path.join(downloadsDir, "".concat(env, "-daily-payments-report-").concat(targetDate, ".csv"));
        }
        console.log("\n\uD83D\uDCCA Generating CSV report: ".concat(filename));
        // CSV headers
        var headers = ['Date', 'Amount', 'Payment Method', 'Location', 'Appointment Date'];
        // Convert payments to CSV rows
        var csvRows = __spreadArray([
            headers.join(',')
        ], payments.map(function (payment) {
            var _a, _b, _c, _d, _e;
            var date = formatGMTToLocalDate(payment.paymentNotice.created || '');
            var amount = parseAsNumber((_a = payment.paymentNotice.amount) === null || _a === void 0 ? void 0 : _a.value).toFixed(2);
            var currency = ((_b = payment.paymentNotice.amount) === null || _b === void 0 ? void 0 : _b.currency) || '';
            var amountWithCurrency = currency ? "".concat(amount, " ").concat(currency) : amount;
            var paymentMethodExtension = (_c = payment.paymentNotice.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === 'https://extensions.fhir.zapehr.com/payment-method'; });
            var paymentMethod = (paymentMethodExtension === null || paymentMethodExtension === void 0 ? void 0 : paymentMethodExtension.valueString) || 'N/A';
            var locationName = ((_d = payment.location) === null || _d === void 0 ? void 0 : _d.name) || 'Unknown Location';
            var appointmentDate = ((_e = payment.appointment) === null || _e === void 0 ? void 0 : _e.start) ? formatGMTToLocalDate(payment.appointment.start) : 'N/A';
            return [
                "\"".concat(date, "\""),
                "\"".concat(amountWithCurrency, "\""),
                "\"".concat(paymentMethod, "\""),
                "\"".concat(locationName, "\""),
                "\"".concat(appointmentDate, "\""),
            ].join(',');
        }), true);
        // Write CSV file
        var csvContent = csvRows.join('\n');
        fs.writeFileSync(filename, csvContent, 'utf8');
        console.log("\u2705 CSV report generated successfully: ".concat(filename));
        console.log("\uD83D\uDCC4 Report contains ".concat(payments.length, " payment records"));
    }
    catch (error) {
        console.error("\u274C Error generating CSV report:", error);
        throw error;
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, targetDateString, csvFilename, secrets, token, oystehr, _a, start, end, payments, timezoneAbbr, paymentsByLocation, _i, payments_1, payment, locationName, paymentMethodExtension, paymentMethod, locationMap, sortedLocations, grandTotal, allCurrencies, overallMethodTotals, overallMethodCounts, _b, sortedLocations_1, locationName, locationMap, locationTotal, locationCurrencies, sortedMethods, _c, sortedMethods_1, paymentMethod, methodPayments, emoji, methodLower, methodTotal, methodCurrencies, _d, methodPayments_1, payment, createdDate, amount, currency, formattedAmount, paddedAmount, amountDisplay, encounterDate, methodTotalFormatted, methodCurrencyList, locationTotalFormatted, locationCurrencyList, locationTransactionCount, sortedOverallMethods, _e, sortedOverallMethods_1, method, total, count, totalFormatted, grandTotalFormatted, allCurrencyList;
        var _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    env = process.argv[2];
                    targetDateString = process.argv[3] ||
                        (function () {
                            // Default to yesterday's date
                            var yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            return yesterday.toISOString().split('T')[0];
                        })();
                    csvFilename = process.argv[4];
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _l.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    _a = getUTCRangeForLocalDate(targetDateString), start = _a.start, end = _a.end;
                    return [4 /*yield*/, getPaymentNoticesByDateRange(oystehr, start, end)];
                case 2:
                    payments = _l.sent();
                    if (payments.length === 0) {
                        console.log('No payment notices found for the specified date.');
                        return [2 /*return*/];
                    }
                    timezoneAbbr = getTimezoneAbbreviation();
                    console.log("\n\uD83D\uDCCA Payment Notices for ".concat(targetDateString, " (").concat(timezoneAbbr, "):"));
                    paymentsByLocation = new Map();
                    for (_i = 0, payments_1 = payments; _i < payments_1.length; _i++) {
                        payment = payments_1[_i];
                        locationName = ((_f = payment.location) === null || _f === void 0 ? void 0 : _f.name) || 'Unknown Location';
                        paymentMethodExtension = (_g = payment.paymentNotice.extension) === null || _g === void 0 ? void 0 : _g.find(function (ext) { return ext.url === 'https://extensions.fhir.zapehr.com/payment-method'; });
                        paymentMethod = (paymentMethodExtension === null || paymentMethodExtension === void 0 ? void 0 : paymentMethodExtension.valueString) || 'N/A';
                        // Get or create location map
                        if (!paymentsByLocation.has(locationName)) {
                            paymentsByLocation.set(locationName, new Map());
                        }
                        locationMap = paymentsByLocation.get(locationName);
                        // Get or create payment method array
                        if (!locationMap.has(paymentMethod)) {
                            locationMap.set(paymentMethod, []);
                        }
                        locationMap.get(paymentMethod).push(payment);
                    }
                    sortedLocations = Array.from(paymentsByLocation.keys()).sort();
                    grandTotal = 0;
                    allCurrencies = new Set();
                    overallMethodTotals = new Map();
                    overallMethodCounts = new Map();
                    // Process each location
                    for (_b = 0, sortedLocations_1 = sortedLocations; _b < sortedLocations_1.length; _b++) {
                        locationName = sortedLocations_1[_b];
                        locationMap = paymentsByLocation.get(locationName);
                        locationTotal = 0;
                        locationCurrencies = new Set();
                        console.log("\n".concat('='.repeat(100)));
                        console.log("\uD83D\uDCCD LOCATION: ".concat(locationName));
                        console.log("".concat('='.repeat(100)));
                        sortedMethods = Array.from(locationMap.keys()).sort();
                        for (_c = 0, sortedMethods_1 = sortedMethods; _c < sortedMethods_1.length; _c++) {
                            paymentMethod = sortedMethods_1[_c];
                            methodPayments = locationMap.get(paymentMethod);
                            emoji = '💳';
                            methodLower = paymentMethod.toLowerCase();
                            if (methodLower === 'cash') {
                                emoji = '💵';
                            }
                            else if (methodLower === 'card' || methodLower === 'credit-card' || methodLower === 'debit-card') {
                                emoji = '💳';
                            }
                            else if (methodLower === 'check') {
                                emoji = '🏦';
                            }
                            console.log("\n   ".concat(emoji, " ").concat(paymentMethod.toUpperCase(), ":"));
                            console.log('   Date\t\t   Amount\t   Payment Method\t   Appointment Date');
                            console.log('   ' + '-'.repeat(90));
                            methodTotal = 0;
                            methodCurrencies = new Set();
                            for (_d = 0, methodPayments_1 = methodPayments; _d < methodPayments_1.length; _d++) {
                                payment = methodPayments_1[_d];
                                createdDate = formatGMTToLocalDate(payment.paymentNotice.created || '');
                                amount = parseAsNumber((_h = payment.paymentNotice.amount) === null || _h === void 0 ? void 0 : _h.value);
                                currency = ((_j = payment.paymentNotice.amount) === null || _j === void 0 ? void 0 : _j.currency) || '';
                                formattedAmount = amount.toFixed(2);
                                paddedAmount = formattedAmount.padStart(7, ' ');
                                amountDisplay = currency ? "".concat(paddedAmount, " ").concat(currency) : paddedAmount;
                                encounterDate = ((_k = payment.appointment) === null || _k === void 0 ? void 0 : _k.start) ? formatGMTToLocalDate(payment.appointment.start) : 'N/A';
                                console.log("   ".concat(createdDate, "\t   ").concat(amountDisplay, "\t   ").concat(paymentMethod, "\t\t   ").concat(encounterDate));
                                // Add to totals
                                methodTotal += amount;
                                locationTotal += amount;
                                grandTotal += amount;
                                if (currency) {
                                    methodCurrencies.add(currency);
                                    locationCurrencies.add(currency);
                                    allCurrencies.add(currency);
                                }
                            }
                            // Update overall method totals
                            overallMethodTotals.set(paymentMethod, (overallMethodTotals.get(paymentMethod) || 0) + methodTotal);
                            overallMethodCounts.set(paymentMethod, (overallMethodCounts.get(paymentMethod) || 0) + methodPayments.length);
                            // Print subtotal for this payment method within this location
                            console.log('   ' + '-'.repeat(90));
                            methodTotalFormatted = methodTotal.toFixed(2).padStart(7, ' ');
                            methodCurrencyList = Array.from(methodCurrencies).join(', ') || 'N/A';
                            console.log("   ".concat(paymentMethod, " Subtotal: ").concat(methodTotalFormatted, " (").concat(methodCurrencyList, ") - ").concat(methodPayments.length, " transactions"));
                        }
                        // Print location total
                        console.log("\n   ".concat('='.repeat(90)));
                        locationTotalFormatted = locationTotal.toFixed(2).padStart(7, ' ');
                        locationCurrencyList = Array.from(locationCurrencies).join(', ') || 'N/A';
                        locationTransactionCount = Array.from(locationMap.values()).reduce(function (sum, arr) { return sum + arr.length; }, 0);
                        console.log("   \uD83D\uDCCD ".concat(locationName, " TOTAL: ").concat(locationTotalFormatted, " (").concat(locationCurrencyList, ") - ").concat(locationTransactionCount, " transactions"));
                    }
                    // Print overall summary
                    console.log("\n".concat('='.repeat(100)));
                    console.log("\uD83D\uDCCA OVERALL SUMMARY");
                    console.log("".concat('='.repeat(100)));
                    // Print summary by payment method
                    console.log('\n💰 Totals by Payment Method:');
                    sortedOverallMethods = Array.from(overallMethodTotals.keys()).sort();
                    for (_e = 0, sortedOverallMethods_1 = sortedOverallMethods; _e < sortedOverallMethods_1.length; _e++) {
                        method = sortedOverallMethods_1[_e];
                        total = overallMethodTotals.get(method);
                        count = overallMethodCounts.get(method);
                        totalFormatted = total.toFixed(2).padStart(10, ' ');
                        console.log("   ".concat(method.padEnd(20), " ").concat(totalFormatted, " (").concat(count, " transactions)"));
                    }
                    // Print grand total
                    console.log('\n' + '='.repeat(100));
                    grandTotalFormatted = grandTotal.toFixed(2).padStart(10, ' ');
                    allCurrencyList = Array.from(allCurrencies).join(', ') || 'N/A';
                    console.log("\uD83C\uDFC6 GRAND TOTAL: ".concat(grandTotalFormatted, " (").concat(allCurrencyList, ")"));
                    console.log("\uD83D\uDCCB TOTAL COUNT: ".concat(payments.length, " payment notices"));
                    console.log("\uD83D\uDCCD LOCATIONS: ".concat(sortedLocations.length));
                    console.log('='.repeat(100));
                    // Generate CSV report
                    generatePaymentCSVReport(payments, targetDateString, env, csvFilename);
                    return [2 /*return*/];
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

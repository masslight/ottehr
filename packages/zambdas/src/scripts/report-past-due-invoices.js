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
var stripe_1 = require("stripe");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function findOpenStripeInvoicesDueBeforeDate(stripe, beforeDate) {
    return __awaiter(this, void 0, void 0, function () {
        var beforeTimestamp, allInvoices, hasMore, startingAfter, invoicesResponse, _i, _a, invoice, customer, defaultPaymentMethod, paymentMethod, error_1, stripeInvoiceData, error_2;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _h.trys.push([0, 11, , 12]);
                    beforeTimestamp = Math.floor(beforeDate.getTime() / 1000);
                    console.log("\uD83D\uDD0D Searching for Stripe invoices due before: ".concat(beforeDate.toISOString()));
                    allInvoices = [];
                    hasMore = true;
                    startingAfter = void 0;
                    _h.label = 1;
                case 1:
                    if (!hasMore) return [3 /*break*/, 10];
                    return [4 /*yield*/, stripe.invoices.list({
                            limit: 100,
                            due_date: {
                                lt: beforeTimestamp, // Less than the provided date
                            },
                            status: 'open', // Only get open (unpaid) invoices
                            starting_after: startingAfter,
                            expand: ['data.customer'], // Expand customer data to get email and name
                        })];
                case 2:
                    invoicesResponse = _h.sent();
                    _i = 0, _a = invoicesResponse.data;
                    _h.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 9];
                    invoice = _a[_i];
                    customer = invoice.customer;
                    defaultPaymentMethod = undefined;
                    if (!(customer && typeof customer !== 'string' && ((_b = customer.invoice_settings) === null || _b === void 0 ? void 0 : _b.default_payment_method))) return [3 /*break*/, 7];
                    _h.label = 4;
                case 4:
                    _h.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, stripe.paymentMethods.retrieve(customer.invoice_settings.default_payment_method)];
                case 5:
                    paymentMethod = _h.sent();
                    defaultPaymentMethod = {
                        id: paymentMethod.id,
                        type: paymentMethod.type,
                        last4: (_c = paymentMethod.card) === null || _c === void 0 ? void 0 : _c.last4,
                        brand: (_d = paymentMethod.card) === null || _d === void 0 ? void 0 : _d.brand,
                        expMonth: (_e = paymentMethod.card) === null || _e === void 0 ? void 0 : _e.exp_month,
                        expYear: (_f = paymentMethod.card) === null || _f === void 0 ? void 0 : _f.exp_year,
                    };
                    return [3 /*break*/, 7];
                case 6:
                    error_1 = _h.sent();
                    console.log("\u26A0\uFE0F  Could not retrieve payment method for customer ".concat(customer.id, ":"), error_1);
                    return [3 /*break*/, 7];
                case 7:
                    stripeInvoiceData = {
                        invoiceId: invoice.id,
                        customerId: typeof customer === 'string' ? customer : customer.id,
                        oystehrPatientId: customer && typeof customer !== 'string' ? (_g = customer.metadata) === null || _g === void 0 ? void 0 : _g.oystehr_patient_id : undefined,
                        amount: invoice.amount_paid + invoice.amount_due,
                        amountDue: invoice.amount_due,
                        status: invoice.status || 'unknown',
                        createdDate: new Date(invoice.created * 1000),
                        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
                        invoiceLink: invoice.hosted_invoice_url || invoice.invoice_pdf || '',
                        customerEmail: customer && typeof customer !== 'string' ? customer.email || undefined : undefined,
                        customerName: customer && typeof customer !== 'string' ? customer.name || undefined : undefined,
                        metadata: invoice.metadata || {},
                        defaultPaymentMethod: defaultPaymentMethod,
                    };
                    allInvoices.push(stripeInvoiceData);
                    _h.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 3];
                case 9:
                    hasMore = invoicesResponse.has_more;
                    if (hasMore && invoicesResponse.data.length > 0) {
                        startingAfter = invoicesResponse.data[invoicesResponse.data.length - 1].id;
                    }
                    console.log("\uD83D\uDCC4 Fetched ".concat(invoicesResponse.data.length, " invoices (").concat(allInvoices.length, " total so far)"));
                    return [3 /*break*/, 1];
                case 10:
                    console.log("\u2705 Found ".concat(allInvoices.length, " invoices due before ").concat(beforeDate.toLocaleDateString()));
                    return [2 /*return*/, allInvoices];
                case 11:
                    error_2 = _h.sent();
                    console.error("\u274C Error finding Stripe invoices before ".concat(beforeDate.toISOString(), ":"), error_2);
                    throw error_2;
                case 12: return [2 /*return*/];
            }
        });
    });
}
function getPatientInfoWithLatestAppointment(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var patient, name_1, fullName, dateOfBirth, appointmentsResponse, appointments, latestAppointmentDate, latestAppointment, error_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Patient',
                            id: patientId,
                        })];
                case 1:
                    patient = _c.sent();
                    if (!patient) {
                        console.log("\u274C Patient not found: ".concat(patientId));
                        return [2 /*return*/, null];
                    }
                    name_1 = (_a = patient.name) === null || _a === void 0 ? void 0 : _a[0];
                    fullName = name_1 ? "".concat(((_b = name_1.given) === null || _b === void 0 ? void 0 : _b.join(' ')) || '', " ").concat(name_1.family || '').trim() : 'Unknown';
                    dateOfBirth = patient.birthDate || 'Unknown';
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                {
                                    name: 'patient',
                                    value: "Patient/".concat(patientId),
                                },
                                {
                                    name: '_sort',
                                    value: '-date', // Sort by date descending (latest first)
                                },
                                {
                                    name: '_count',
                                    value: 1, // Only get the most recent appointment
                                },
                            ],
                        })];
                case 2:
                    appointmentsResponse = _c.sent();
                    appointments = appointmentsResponse.unbundle();
                    latestAppointmentDate = null;
                    if (appointments.length > 0) {
                        latestAppointment = appointments[0];
                        if (latestAppointment.start) {
                            // Store the ISO date string for CSV formatting
                            latestAppointmentDate = latestAppointment.start;
                        }
                    }
                    return [2 /*return*/, {
                            fullName: fullName,
                            dateOfBirth: dateOfBirth,
                            latestAppointmentDate: latestAppointmentDate, // This will be the ISO string for CSV conversion
                        }];
                case 3:
                    error_3 = _c.sent();
                    console.error("\u274C Error fetching patient info for ".concat(patientId, ":"), error_3);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Updated function to generate CSV report - removed invoice link column
function generateCSVReport(reportData, filename) {
    try {
        console.log("\n\uD83D\uDCCA Generating CSV report: ".concat(filename));
        // CSV headers - removed Invoice Link
        var headers = [
            'First Name',
            'Last Name',
            'Date of Birth',
            'Amount Due',
            'Date Due',
            'Appointment Date',
            'Card on File',
            'Aging Bucket',
        ];
        // Convert data to CSV format
        var csvRows = __spreadArray([
            headers.join(',')
        ], reportData.map(function (row) {
            return [
                "\"".concat(row.firstName, "\""),
                "\"".concat(row.lastName, "\""),
                "\"".concat(row.dateOfBirth, "\""),
                "\"".concat(row.amountDue, "\""),
                "\"".concat(row.dateDue, "\""),
                "\"".concat(row.appointmentDate, "\""),
                "\"".concat(row.cardOnFile, "\""),
                "\"".concat(row.agingBucket, "\""),
            ].join(',');
        }), true);
        // Write CSV file
        var csvContent = csvRows.join('\n');
        fs.writeFileSync(filename, csvContent, 'utf8');
        console.log("\u2705 CSV report generated successfully: ".concat(filename));
        console.log("\uD83D\uDCC4 Report contains ".concat(reportData.length, " patient records"));
    }
    catch (error) {
        console.error("\u274C Error generating CSV report:", error);
        throw error;
    }
}
// Helper function to calculate days past due
function calculateDaysPastDue(dueDate) {
    var now = new Date();
    var diffMs = now.getTime() - dueDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
// Helper function to determine aging bucket
function getAgingBucket(daysPastDue) {
    if (daysPastDue <= 15)
        return '0-15 days';
    if (daysPastDue <= 30)
        return '16-30 days';
    if (daysPastDue <= 45)
        return '31-45 days';
    if (daysPastDue <= 60)
        return '46-60 days';
    return '60+ days';
}
// Helper function to generate default filename
function getDefaultFilename(env) {
    var today = new Date();
    var dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    var downloadsDir = path.join(os.homedir(), 'Downloads');
    return path.join(downloadsDir, "".concat(env, "-past-due-invoices-").concat(dateString, ".csv"));
}
// Updated main function with aging buckets
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, csvFilenameArg, csvFilename, secrets, stripe, token, oystehr, today, pastDueInvoices, buckets, _i, pastDueInvoices_1, invoice, daysPastDue, bucket, totalAmountDue, successCount, failCount, csvReportData, i, invoiceInfo, patientId, patientInfo, firstName, lastName, nameParts, cardOnFile, pm, daysPastDue, agingBucket, error_4, daysPastDue, agingBucket;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    env = process.argv[2];
                    csvFilenameArg = process.argv[3];
                    // Validate required arguments
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run script report-past-due-invoices <env> [csvFilename]');
                    }
                    csvFilename = csvFilenameArg || getDefaultFilename(env);
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    stripe = new stripe_1.default(secrets.STRIPE_SECRET_KEY, {
                        apiVersion: '2025-02-24.acacia',
                    });
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _d.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    today = new Date();
                    today.setHours(0, 0, 0, 0); // Start of today
                    return [4 /*yield*/, findOpenStripeInvoicesDueBeforeDate(stripe, today)];
                case 2:
                    pastDueInvoices = _d.sent();
                    if (pastDueInvoices.length === 0) {
                        console.log("\u274C No past due invoices found.");
                        return [2 /*return*/];
                    }
                    buckets = {
                        '0-15': [],
                        '16-30': [],
                        '31-45': [],
                        '46-60': [],
                        '60+': [],
                    };
                    for (_i = 0, pastDueInvoices_1 = pastDueInvoices; _i < pastDueInvoices_1.length; _i++) {
                        invoice = pastDueInvoices_1[_i];
                        if (!invoice.dueDate)
                            continue;
                        daysPastDue = calculateDaysPastDue(invoice.dueDate);
                        bucket = getAgingBucket(daysPastDue);
                        if (bucket === '0-15 days')
                            buckets['0-15'].push(invoice);
                        else if (bucket === '16-30 days')
                            buckets['16-30'].push(invoice);
                        else if (bucket === '31-45 days')
                            buckets['31-45'].push(invoice);
                        else if (bucket === '46-60 days')
                            buckets['46-60'].push(invoice);
                        else
                            buckets['60+'].push(invoice);
                    }
                    totalAmountDue = pastDueInvoices.reduce(function (sum, invoice) { return sum + invoice.amountDue; }, 0);
                    console.log("\n\uD83D\uDCB0 Past Due Invoice Summary:");
                    console.log("   Total invoices: ".concat(pastDueInvoices.length, " ($").concat((totalAmountDue / 100).toFixed(2), ")"));
                    console.log("\n\uD83D\uDCCA Aging Buckets:");
                    console.log("   0-15 days:   ".concat(buckets['0-15'].length.toString().padStart(4), " invoices ($").concat((buckets['0-15'].reduce(function (sum, inv) { return sum + inv.amountDue; }, 0) / 100).toFixed(2), ")"));
                    console.log("   16-30 days:  ".concat(buckets['16-30'].length.toString().padStart(4), " invoices ($").concat((buckets['16-30'].reduce(function (sum, inv) { return sum + inv.amountDue; }, 0) / 100).toFixed(2), ")"));
                    console.log("   31-45 days:  ".concat(buckets['31-45'].length.toString().padStart(4), " invoices ($").concat((buckets['31-45'].reduce(function (sum, inv) { return sum + inv.amountDue; }, 0) / 100).toFixed(2), ")"));
                    console.log("   46-60 days:  ".concat(buckets['46-60'].length.toString().padStart(4), " invoices ($").concat((buckets['46-60'].reduce(function (sum, inv) { return sum + inv.amountDue; }, 0) / 100).toFixed(2), ")"));
                    console.log("   60+ days:    ".concat(buckets['60+'].length.toString().padStart(4), " invoices ($").concat((buckets['60+'].reduce(function (sum, inv) { return sum + inv.amountDue; }, 0) / 100).toFixed(2), ")"));
                    console.log("\n\uD83D\uDCCB Processing ".concat(pastDueInvoices.length, " invoices..."));
                    successCount = 0;
                    failCount = 0;
                    csvReportData = [];
                    i = 0;
                    _d.label = 3;
                case 3:
                    if (!(i < pastDueInvoices.length)) return [3 /*break*/, 8];
                    invoiceInfo = pastDueInvoices[i];
                    if (!invoiceInfo.oystehrPatientId) {
                        failCount++;
                        return [3 /*break*/, 7];
                    }
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 7]);
                    patientId = invoiceInfo.oystehrPatientId;
                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, patientId)];
                case 5:
                    patientInfo = _d.sent();
                    firstName = 'Unknown';
                    lastName = 'Unknown';
                    if (patientInfo) {
                        nameParts = patientInfo.fullName.split(' ');
                        firstName = nameParts[0] || 'Unknown';
                        lastName = nameParts.slice(1).join(' ') || 'Unknown';
                    }
                    cardOnFile = ' - ';
                    if (invoiceInfo.defaultPaymentMethod) {
                        pm = invoiceInfo.defaultPaymentMethod;
                        cardOnFile = "".concat((_a = pm.brand) === null || _a === void 0 ? void 0 : _a.toUpperCase(), " ****").concat(pm.last4);
                    }
                    daysPastDue = invoiceInfo.dueDate ? calculateDaysPastDue(invoiceInfo.dueDate) : 0;
                    agingBucket = getAgingBucket(daysPastDue);
                    successCount++;
                    // Add data to CSV report - removed invoiceLink
                    csvReportData.push({
                        firstName: firstName,
                        lastName: lastName,
                        dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                        dateDue: ((_b = invoiceInfo.dueDate) === null || _b === void 0 ? void 0 : _b.toISOString().split('T')[0]) || 'Unknown',
                        appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                            ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                            : 'No appointments',
                        cardOnFile: cardOnFile,
                        agingBucket: agingBucket,
                    });
                    return [3 /*break*/, 7];
                case 6:
                    error_4 = _d.sent();
                    failCount++;
                    daysPastDue = invoiceInfo.dueDate ? calculateDaysPastDue(invoiceInfo.dueDate) : 0;
                    agingBucket = getAgingBucket(daysPastDue);
                    csvReportData.push({
                        firstName: "Error ".concat(typeof error_4 === 'object' && error_4 !== null && 'message' in error_4
                            ? error_4.message
                            : String(error_4)),
                        lastName: 'Error',
                        dateOfBirth: 'Error',
                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                        dateDue: ((_c = invoiceInfo.dueDate) === null || _c === void 0 ? void 0 : _c.toISOString().split('T')[0]) || 'Unknown',
                        appointmentDate: 'Error',
                        cardOnFile: 'Error',
                        agingBucket: agingBucket,
                    });
                    return [3 /*break*/, 7];
                case 7:
                    i++;
                    return [3 /*break*/, 3];
                case 8:
                    // Generate CSV report
                    generateCSVReport(csvReportData, csvFilename);
                    // Final Summary
                    console.log("\n\uD83D\uDCCA Final Summary:");
                    console.log("   \u2705 Successfully processed: ".concat(successCount, " patients"));
                    console.log("   \u274C Failed: ".concat(failCount, " patients"));
                    console.log("   \uD83D\uDCB0 Total amount due: $".concat((totalAmountDue / 100).toFixed(2)));
                    console.log("\uD83D\uDCC4 Total records in CSV: ".concat(csvReportData.length));
                    console.log("\uD83D\uDCC4 CSV report saved as: ".concat(csvFilename));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ Past due invoices report completed.'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});

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
var stripe_1 = require("stripe");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function findOpenStripeInvoicesDueOnOrBeforeDate(stripe, beforeDate) {
    return __awaiter(this, void 0, void 0, function () {
        var beforeTimestamp, allInvoices, hasMore, startingAfter, invoicesResponse, _i, _a, invoice, customer, defaultPaymentMethod, paymentMethod, error_1, stripeInvoiceData, error_2;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _h.trys.push([0, 11, , 12]);
                    beforeTimestamp = Math.floor(beforeDate.getTime() / 1000);
                    console.log("\uD83D\uDD0D Searching for Stripe invoices created on or before: ".concat(beforeDate.toISOString()));
                    allInvoices = [];
                    hasMore = true;
                    startingAfter = void 0;
                    _h.label = 1;
                case 1:
                    if (!hasMore) return [3 /*break*/, 10];
                    return [4 /*yield*/, stripe.invoices.list({
                            limit: 100,
                            due_date: {
                                lte: beforeTimestamp, // Less than the provided date
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
                    console.log("\u2705 Found ".concat(allInvoices.length, " invoices created before ").concat(beforeDate.toLocaleDateString()));
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
// Function to attempt payment on an invoice
function attemptInvoicePayment(stripe, invoiceId, testMode) {
    return __awaiter(this, void 0, void 0, function () {
        var paidInvoice, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (testMode) {
                        return [2 /*return*/, { success: false, status: 'not-attempted' }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, stripe.invoices.pay(invoiceId)];
                case 2:
                    paidInvoice = _a.sent();
                    // const paidInvoice = {'status': 'open'} as Stripe.Invoice; // Mocked for illustration
                    if (paidInvoice.status === 'paid') {
                        return [2 /*return*/, { success: true, status: 'charged' }];
                    }
                    else {
                        return [2 /*return*/, { success: false, status: 'attempted', error: "Invoice status: ".concat(paidInvoice.status) }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            status: 'attempted',
                            error: error_4.message || 'Unknown error',
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Updated function to generate CSV report with payment status column
function generateCSVReport(reportData, filename) {
    try {
        console.log("\n\uD83D\uDCCA Generating CSV report: ".concat(filename));
        // CSV headers with payment status
        var headers = [
            'First Name',
            'Last Name',
            'Date of Birth',
            'Amount Due',
            'Date Due',
            'Appointment Date',
            'Card on File',
            'Payment Status',
            'Status',
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
                "\"".concat(row.paymentStatus, "\""),
                "\"".concat(row.status, "\""),
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
// Updated main function with required test mode switch
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, testModeArg, dueDateArg, csvFilenameArg, testMode, testModeNormalized, dueDate, dueDateString, dateRegex, csvFilename, secrets, stripe, token, oystehr, invoices, csvReportData, today, successCount, failCount, dueCount, pastDueCount, totalAmountDue, chargedCount, attemptedCount, notAttemptedCount, totalAmountCharged, i, invoice, patientInfo, firstName, lastName, fullName, nameParts, invoiceDueDate, isDue, isPastDue, status_1, cardOnFile, hasCard, pm, paymentResult, appointmentDate, dueDateFormatted, amountDue, paymentStatusDisplay, error_5;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    env = process.argv[2];
                    testModeArg = process.argv[3];
                    dueDateArg = process.argv[4];
                    csvFilenameArg = process.argv[5];
                    // Validate required arguments
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run script charge-due-and-past-due-invoices <env> <test-mode: test-on|test-off> [dueDate] [csvFilename]');
                    }
                    if (!testModeArg) {
                        throw new Error('❌ Test mode is required. Usage: npm run script charge-due-and-past-due-invoices <env> <test-mode: on|off> [dueDate] [csvFilename]');
                    }
                    testMode = true;
                    testModeNormalized = testModeArg.toLowerCase();
                    if (testModeNormalized === 'test-off') {
                        testMode = false;
                    }
                    else if (testModeNormalized === 'test-on') {
                        testMode = true;
                    }
                    else {
                        throw new Error('❌ Test mode must be "test-on" or "test-off"');
                    }
                    if (dueDateArg) {
                        dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                        if (!dateRegex.test(dueDateArg)) {
                            throw new Error('❌ Due date must be in yyyy-mm-dd format (e.g., 2025-11-01)');
                        }
                        dueDate = new Date(dueDateArg);
                        if (isNaN(dueDate.getTime())) {
                            throw new Error('❌ Invalid date provided');
                        }
                        dueDateString = dueDateArg;
                    }
                    else {
                        // Use today's date
                        dueDate = new Date();
                        dueDate.setHours(23, 59, 59, 999); // End of today
                        dueDateString = dueDate.toISOString().split('T')[0]; // yyyy-mm-dd format
                    }
                    csvFilename = csvFilenameArg || "".concat(process.env.HOME || '~', "/Downloads/").concat(env, "-charged-invoices-report-").concat(dueDateString, ".csv");
                    console.log("\n\uD83D\uDCC5 Processing invoices due on or before: ".concat(dueDateString));
                    console.log("\uD83E\uDDEA Test Mode: ".concat(testMode ? 'ON (no charges will be made)' : 'OFF (invoices will be charged)'));
                    console.log("\uD83D\uDCC4 CSV report will be saved to: ".concat(csvFilename));
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
                    return [4 /*yield*/, findOpenStripeInvoicesDueOnOrBeforeDate(stripe, dueDate)];
                case 2:
                    invoices = _d.sent();
                    if (invoices.length === 0) {
                        console.log("\n\u274C No invoices found due on or before ".concat(dueDateString));
                        return [2 /*return*/];
                    }
                    console.log("\n\uD83D\uDCCA Found ".concat(invoices.length, " invoices due on or before ").concat(dueDateString, "\n"));
                    csvReportData = [];
                    today = new Date();
                    today.setHours(0, 0, 0, 0);
                    successCount = 0;
                    failCount = 0;
                    dueCount = 0;
                    pastDueCount = 0;
                    totalAmountDue = 0;
                    chargedCount = 0;
                    attemptedCount = 0;
                    notAttemptedCount = 0;
                    totalAmountCharged = 0;
                    i = 0;
                    _d.label = 3;
                case 3:
                    if (!(i < invoices.length)) return [3 /*break*/, 11];
                    invoice = invoices[i];
                    if (!invoice.oystehrPatientId) {
                        console.log("[".concat(i + 1, "/").concat(invoices.length, "] \u26A0\uFE0F  Invoice ").concat(invoice.invoiceId, " - No patient ID"));
                        failCount++;
                        notAttemptedCount++;
                        return [3 /*break*/, 10];
                    }
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 9, , 10]);
                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, invoice.oystehrPatientId)];
                case 5:
                    patientInfo = _d.sent();
                    firstName = 'Unknown';
                    lastName = 'Unknown';
                    fullName = 'Unknown';
                    if (patientInfo) {
                        fullName = patientInfo.fullName;
                        nameParts = patientInfo.fullName.split(' ');
                        firstName = nameParts[0] || 'Unknown';
                        lastName = nameParts.slice(1).join(' ') || 'Unknown';
                    }
                    invoiceDueDate = invoice.dueDate || new Date(0);
                    isDue = invoiceDueDate.getTime() === today.getTime();
                    isPastDue = invoiceDueDate.getTime() < today.getTime();
                    status_1 = isDue ? 'Due' : isPastDue ? 'Past Due' : 'Future';
                    if (isDue)
                        dueCount++;
                    if (isPastDue)
                        pastDueCount++;
                    cardOnFile = 'No card';
                    hasCard = false;
                    if (invoice.defaultPaymentMethod) {
                        pm = invoice.defaultPaymentMethod;
                        cardOnFile = "".concat((_a = pm.brand) === null || _a === void 0 ? void 0 : _a.toUpperCase(), " ****").concat(pm.last4);
                        hasCard = true;
                    }
                    paymentResult = { success: false, status: 'not-attempted' };
                    if (!hasCard) return [3 /*break*/, 7];
                    return [4 /*yield*/, attemptInvoicePayment(stripe, invoice.invoiceId, testMode)];
                case 6:
                    paymentResult = _d.sent();
                    if (paymentResult.status === 'charged') {
                        chargedCount++;
                        totalAmountCharged += invoice.amountDue;
                    }
                    else if (paymentResult.status === 'attempted') {
                        attemptedCount++;
                    }
                    return [3 /*break*/, 8];
                case 7:
                    notAttemptedCount++;
                    _d.label = 8;
                case 8:
                    appointmentDate = (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                        ? new Date(patientInfo.latestAppointmentDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                        })
                        : 'No appt';
                    dueDateFormatted = invoice.dueDate
                        ? invoice.dueDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                        })
                        : 'Unknown';
                    amountDue = invoice.amountDue / 100;
                    totalAmountDue += invoice.amountDue;
                    paymentStatusDisplay = paymentResult.status === 'charged'
                        ? '✅ Charged'
                        : paymentResult.status === 'attempted'
                            ? '❌ Failed'
                            : testMode
                                ? '🧪 Test'
                                : '⏸️  No Card';
                    // Print compact single line with payment status
                    console.log("[".concat(i + 1, "/").concat(invoices.length, "] ").concat(fullName.padEnd(25), " | Appt: ").concat(appointmentDate.padEnd(8), " | Due: ").concat(dueDateFormatted.padEnd(8), " | $").concat(amountDue.toFixed(2).padStart(8), " | ").concat(status_1.padEnd(8), " | ").concat(cardOnFile.padEnd(20), " | ").concat(paymentStatusDisplay));
                    successCount++;
                    // Add to CSV report
                    csvReportData.push({
                        firstName: firstName,
                        lastName: lastName,
                        dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                        amountDue: "$".concat(amountDue.toFixed(2)),
                        dateDue: ((_b = invoice.dueDate) === null || _b === void 0 ? void 0 : _b.toISOString().split('T')[0]) || 'Unknown',
                        appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                            ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                            : 'No appointments',
                        cardOnFile: cardOnFile,
                        paymentStatus: paymentResult.status,
                        status: status_1,
                    });
                    return [3 /*break*/, 10];
                case 9:
                    error_5 = _d.sent();
                    console.log("[".concat(i + 1, "/").concat(invoices.length, "] \u274C Failed to process invoice ").concat(invoice.invoiceId, ":"), error_5);
                    failCount++;
                    notAttemptedCount++;
                    // Add error entry to CSV
                    csvReportData.push({
                        firstName: 'Error',
                        lastName: 'Error',
                        dateOfBirth: 'Error',
                        amountDue: "$".concat((invoice.amountDue / 100).toFixed(2)),
                        dateDue: ((_c = invoice.dueDate) === null || _c === void 0 ? void 0 : _c.toISOString().split('T')[0]) || 'Unknown',
                        appointmentDate: 'Error',
                        cardOnFile: 'Error',
                        paymentStatus: 'not-attempted',
                        status: 'Processing Error',
                    });
                    return [3 /*break*/, 10];
                case 10:
                    i++;
                    return [3 /*break*/, 3];
                case 11:
                    // Generate CSV report
                    generateCSVReport(csvReportData, csvFilename);
                    // Final summary
                    console.log('\n' + '='.repeat(140));
                    console.log("\n\uD83D\uDCCA Final Summary:");
                    console.log("   Test Mode: ".concat(testMode ? 'ON' : 'OFF'));
                    console.log("   Total invoices processed: ".concat(invoices.length));
                    console.log("   \u2705 Successfully processed: ".concat(successCount));
                    console.log("   \u274C Failed: ".concat(failCount));
                    console.log("\n\uD83D\uDCB0 Invoice Status Breakdown:");
                    console.log("   Due Today:       ".concat(dueCount, " invoices"));
                    console.log("   Past Due:        ".concat(pastDueCount, " invoices"));
                    console.log("   Total Amount:    $".concat((totalAmountDue / 100).toFixed(2)));
                    console.log("\n\uD83D\uDCB3 Payment Results:");
                    console.log("   \u2705 Charged:         ".concat(chargedCount, " invoices ($").concat((totalAmountCharged / 100).toFixed(2), ")"));
                    console.log("   \u274C Attempted (Failed): ".concat(attemptedCount, " invoices"));
                    console.log("   \u23F8\uFE0F  Not Attempted:  ".concat(notAttemptedCount, " invoices"));
                    console.log("\n\uD83D\uDCC4 CSV report saved to: ".concat(csvFilename));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ Invoice report completed.'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});

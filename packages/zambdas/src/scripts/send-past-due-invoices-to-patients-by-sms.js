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
function sendSMSMessage(oystehr, patientId, message) {
    return __awaiter(this, void 0, void 0, function () {
        var relatedPerson, resource, response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, shared_1.getRelatedPersonForPatient)(patientId || '', oystehr)];
                case 1:
                    relatedPerson = _a.sent();
                    if (relatedPerson) {
                        resource = "RelatedPerson/".concat(relatedPerson.id);
                    }
                    else {
                        console.log("\u274C Failed to send SMS to ".concat(patientId, ": No RelatedPerson found"));
                        return [2 /*return*/];
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, oystehr.transactionalSMS.send({
                            resource: resource,
                            message: message,
                        })];
                case 3:
                    response = _a.sent();
                    console.log("\u2705 SMS details are in sent to ".concat(patientId, " (RelatedPerson/").concat(relatedPerson.id, "), response in "), response);
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error("\u274C Failed to send SMS to ".concat(patientId, ":"), error_1);
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
function sendPastDueInvoiceBySMS(oystehr, resourceId, balanceDue, // Changed to number (cents)
invoiceLink) {
    return __awaiter(this, void 0, void 0, function () {
        var balanceInDollars, shortInvoiceLink, invoiceMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    balanceInDollars = (balanceDue / 100).toFixed(2);
                    shortInvoiceLink = invoiceLink;
                    invoiceMessage = "Thank you for visiting UrgiKids. You have a past due balance of $".concat(balanceInDollars, ".\n\uD83D\uDCB3 We were unable to process your card on file.  Please, pay your invoice:\n\n").concat(shortInvoiceLink);
                    return [4 /*yield*/, sendSMSMessage(oystehr, resourceId, invoiceMessage)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendDelinquentPastDueInvoiceBySMS(oystehr, resourceId, invoiceLink) {
    return __awaiter(this, void 0, void 0, function () {
        var shortInvoiceLink, invoiceMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    shortInvoiceLink = invoiceLink;
                    invoiceMessage = "Friendly reminder: your UrgiKids balance is still outstanding. Please submit payment using the link below to keep your account in good standing:\n\n".concat(shortInvoiceLink);
                    return [4 /*yield*/, sendSMSMessage(oystehr, resourceId, invoiceMessage)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendCollectionsPastDueInvoiceBySMS(oystehr, resourceId, invoiceLink) {
    return __awaiter(this, void 0, void 0, function () {
        var shortInvoiceLink, invoiceMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    shortInvoiceLink = invoiceLink;
                    invoiceMessage = "Your UrgiKids balance is now over 60 days past due. Please submit payment using the link below to avoid the balance being sent to collections:\n\n".concat(shortInvoiceLink);
                    return [4 /*yield*/, sendSMSMessage(oystehr, resourceId, invoiceMessage)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function findOpenStripeInvoicesDueBeforeDate(stripe, beforeDate) {
    return __awaiter(this, void 0, void 0, function () {
        var beforeTimestamp, allInvoices, hasMore, startingAfter, invoicesResponse, _i, _a, invoice, customer, defaultPaymentMethod, paymentMethod, error_2, stripeInvoiceData, error_3;
        var _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _h.trys.push([0, 11, , 12]);
                    beforeTimestamp = Math.floor(beforeDate.getTime() / 1000);
                    console.log("\uD83D\uDD0D Searching for Stripe invoices created before: ".concat(beforeDate.toISOString()));
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
                    error_2 = _h.sent();
                    console.log("\u26A0\uFE0F  Could not retrieve payment method for customer ".concat(customer.id, ":"), error_2);
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
                    error_3 = _h.sent();
                    console.error("\u274C Error finding Stripe invoices before ".concat(beforeDate.toISOString(), ":"), error_3);
                    throw error_3;
                case 12: return [2 /*return*/];
            }
        });
    });
}
function getPatientInfoWithLatestAppointment(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var patient, name_1, fullName, dateOfBirth, appointmentsResponse, appointments, latestAppointmentDate, latestAppointment, displayDate, error_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    console.log("\uD83D\uDD0D Fetching patient info for: ".concat(patientId));
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
                    // Get latest appointment for this patient
                    console.log("\uD83D\uDD0D Fetching appointments for patient: ".concat(patientId));
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
                    displayDate = latestAppointmentDate
                        ? new Date(latestAppointmentDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                        })
                        : 'No appointments found';
                    console.log("\u2705 Found patient info for ".concat(patientId, ":"));
                    console.log("   Name: ".concat(fullName));
                    console.log("   DOB: ".concat(dateOfBirth));
                    console.log("   Latest appointment: ".concat(displayDate));
                    return [2 /*return*/, {
                            fullName: fullName,
                            dateOfBirth: dateOfBirth,
                            latestAppointmentDate: latestAppointmentDate, // This will be the ISO string for CSV conversion
                        }];
                case 3:
                    error_4 = _c.sent();
                    console.error("\u274C Error fetching patient info for ".concat(patientId, ":"), error_4);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Add this function to generate CSV report with collections column
function generateCSVReport(reportData, filename) {
    try {
        console.log("\n\uD83D\uDCCA Generating CSV report: ".concat(filename));
        // CSV headers with swapped invoice link and collections status
        var headers = [
            'First Name',
            'Last Name',
            'Date of Birth',
            'Amount Due',
            'Date Due',
            'Appointment Date',
            'Card on File',
            'Collections Status', // Moved before Invoice Link
            'Invoice Link', // Moved after Collections Status
        ];
        // Convert data to CSV format with swapped columns
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
                "\"".concat(row.collectionsStatus, "\""), // Moved before Invoice Link
                "\"".concat(row.invoiceLink, "\""),
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
// Updated main function with 4-tier collections logic
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, newestPastDueDaysArg, delinquentPastDueDaysArg, collectionsWarningDaysArg, writtenOffDaysArg, csvFilename, newestPastDueDays, delinquentPastDueDays, collectionsWarningDays, writtenOffDays, newestBeforeDate, delinquentBeforeDate, collectionsWarningBeforeDate, writtenOffBeforeDate, secrets, stripe, token, oystehr, allPastDueInvoices, smsInvoices, delinquentInvoices, collectionsWarningInvoices, writtenOffInvoices, totalAmountDue, smsAmountDue, delinquentAmountDue, collectionsWarningAmountDue, writtenOffAmountDue, csvReportData, smsPatientIds, smsSentCount, smsFailCount, _loop_1, i, delinquentPatientIds, delinquentSentCount, delinquentFailCount, _loop_2, i, collectionsWarningPatientIds, collectionsSentCount, collectionsFailCount, _loop_3, i, writtenOffPatientIds, _loop_4, i;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    env = process.argv[2];
                    newestPastDueDaysArg = process.argv[3];
                    delinquentPastDueDaysArg = process.argv[4];
                    collectionsWarningDaysArg = process.argv[5];
                    writtenOffDaysArg = process.argv[6];
                    csvFilename = process.argv[7];
                    // Validate required arguments
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>');
                    }
                    if (!newestPastDueDaysArg) {
                        throw new Error('❌ Newest past due days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>');
                    }
                    if (!delinquentPastDueDaysArg) {
                        throw new Error('❌ Delinquent past due days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>');
                    }
                    if (!collectionsWarningDaysArg) {
                        throw new Error('❌ Collections warning days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>');
                    }
                    if (!writtenOffDaysArg) {
                        throw new Error('❌ Written off days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>');
                    }
                    if (!csvFilename) {
                        throw new Error('❌ CSV filename is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>');
                    }
                    newestPastDueDays = parseInt(newestPastDueDaysArg);
                    if (isNaN(newestPastDueDays) || newestPastDueDays < 0) {
                        throw new Error('❌ Newest past due days must be a valid positive number (e.g., 7 for 7 days ago)');
                    }
                    delinquentPastDueDays = parseInt(delinquentPastDueDaysArg);
                    if (isNaN(delinquentPastDueDays) || delinquentPastDueDays < 0) {
                        throw new Error('❌ Delinquent past due days must be a valid positive number (e.g., 30 for 30 days ago)');
                    }
                    collectionsWarningDays = parseInt(collectionsWarningDaysArg);
                    if (isNaN(collectionsWarningDays) || collectionsWarningDays < 0) {
                        throw new Error('❌ Collections warning days must be a valid positive number (e.g., 60 for 60 days ago)');
                    }
                    writtenOffDays = parseInt(writtenOffDaysArg);
                    if (isNaN(writtenOffDays) || writtenOffDays < 0) {
                        throw new Error('❌ Written off days must be a valid positive number (e.g., 90 for 90 days ago)');
                    }
                    // Validate that days are in ascending order
                    if (delinquentPastDueDays <= newestPastDueDays) {
                        throw new Error('❌ Delinquent past due days must be larger than newest past due days');
                    }
                    if (collectionsWarningDays <= delinquentPastDueDays) {
                        throw new Error('❌ Collections warning days must be larger than delinquent past due days');
                    }
                    if (writtenOffDays <= collectionsWarningDays) {
                        throw new Error('❌ Written off days must be larger than collections warning days');
                    }
                    newestBeforeDate = new Date();
                    newestBeforeDate.setDate(newestBeforeDate.getDate() - newestPastDueDays);
                    delinquentBeforeDate = new Date();
                    delinquentBeforeDate.setDate(delinquentBeforeDate.getDate() - delinquentPastDueDays);
                    collectionsWarningBeforeDate = new Date();
                    collectionsWarningBeforeDate.setDate(collectionsWarningBeforeDate.getDate() - collectionsWarningDays);
                    writtenOffBeforeDate = new Date();
                    writtenOffBeforeDate.setDate(writtenOffBeforeDate.getDate() - writtenOffDays);
                    console.log("\uD83D\uDDD3\uFE0F Invoice age tiers:");
                    console.log("   1\uFE0F\u20E3  ".concat(newestPastDueDays, "-").concat(delinquentPastDueDays, " days past due \u2192 SMS reminder"));
                    console.log("   2\uFE0F\u20E3  ".concat(delinquentPastDueDays, "-").concat(collectionsWarningDays, " days past due \u2192 Delinquent SMS"));
                    console.log("   3\uFE0F\u20E3  ".concat(collectionsWarningDays, "-").concat(writtenOffDays, " days past due \u2192 Collections warning SMS"));
                    console.log("   4\uFE0F\u20E3  ".concat(writtenOffDays, "+ days past due \u2192 Written off (report only)"));
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    stripe = new stripe_1.default(secrets.STRIPE_SECRET_KEY, {
                        apiVersion: '2025-02-24.acacia',
                    });
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _q.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, findOpenStripeInvoicesDueBeforeDate(stripe, newestBeforeDate)];
                case 2:
                    allPastDueInvoices = _q.sent();
                    if (allPastDueInvoices.length === 0) {
                        console.log("\u274C No past due invoices found due before ".concat(newestPastDueDays, " days ago."));
                        return [2 /*return*/];
                    }
                    smsInvoices = allPastDueInvoices.filter(function (invoice) { return invoice.dueDate && invoice.dueDate >= delinquentBeforeDate; });
                    delinquentInvoices = allPastDueInvoices.filter(function (invoice) {
                        return invoice.dueDate && invoice.dueDate < delinquentBeforeDate && invoice.dueDate >= collectionsWarningBeforeDate;
                    });
                    collectionsWarningInvoices = allPastDueInvoices.filter(function (invoice) {
                        return invoice.dueDate && invoice.dueDate < collectionsWarningBeforeDate && invoice.dueDate >= writtenOffBeforeDate;
                    });
                    writtenOffInvoices = allPastDueInvoices.filter(function (invoice) { return invoice.dueDate && invoice.dueDate < writtenOffBeforeDate; });
                    totalAmountDue = allPastDueInvoices.reduce(function (sum, invoice) { return sum + invoice.amountDue; }, 0);
                    smsAmountDue = smsInvoices.reduce(function (sum, invoice) { return sum + invoice.amountDue; }, 0);
                    delinquentAmountDue = delinquentInvoices.reduce(function (sum, invoice) { return sum + invoice.amountDue; }, 0);
                    collectionsWarningAmountDue = collectionsWarningInvoices.reduce(function (sum, invoice) { return sum + invoice.amountDue; }, 0);
                    writtenOffAmountDue = writtenOffInvoices.reduce(function (sum, invoice) { return sum + invoice.amountDue; }, 0);
                    console.log("\n\uD83D\uDCB0 Past Due Invoice Summary:");
                    console.log("   Total invoices: ".concat(allPastDueInvoices.length, " ($").concat((totalAmountDue / 100).toFixed(2), ")"));
                    console.log("   1\uFE0F\u20E3  SMS reminders: ".concat(smsInvoices.length, " ($").concat((smsAmountDue / 100).toFixed(2), ")"));
                    console.log("   2\uFE0F\u20E3  Delinquent: ".concat(delinquentInvoices.length, " ($").concat((delinquentAmountDue / 100).toFixed(2), ")"));
                    console.log("   3\uFE0F\u20E3  Collections warning: ".concat(collectionsWarningInvoices.length, " ($").concat((collectionsWarningAmountDue / 100).toFixed(2), ")"));
                    console.log("   4\uFE0F\u20E3  Written off: ".concat(writtenOffInvoices.length, " ($").concat((writtenOffAmountDue / 100).toFixed(2), ")"));
                    csvReportData = [];
                    smsPatientIds = smsInvoices
                        .filter(function (invoice) { return invoice.oystehrPatientId; })
                        .map(function (invoice) { return invoice.oystehrPatientId; });
                    console.log("\n1\uFE0F\u20E3  Processing ".concat(smsPatientIds.length, " patients for SMS reminders..."));
                    smsSentCount = 0;
                    smsFailCount = 0;
                    _loop_1 = function (i) {
                        var patientId, invoiceInfo, daysPastDue, patientInfo, firstName, lastName, nameParts, cardOnFile, pm, error_5;
                        return __generator(this, function (_r) {
                            switch (_r.label) {
                                case 0:
                                    patientId = smsPatientIds[i];
                                    invoiceInfo = smsInvoices.find(function (inv) { return inv.oystehrPatientId === patientId; });
                                    if (!invoiceInfo) {
                                        console.log("\u26A0\uFE0F  No invoice found for patient ".concat(patientId));
                                        smsFailCount++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    _r.label = 1;
                                case 1:
                                    _r.trys.push([1, 7, , 8]);
                                    console.log("\n[".concat(i + 1, "/").concat(smsPatientIds.length, "] Processing SMS for patient: ").concat(patientId));
                                    daysPastDue = invoiceInfo.dueDate
                                        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                        : 'Unknown';
                                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, patientId)];
                                case 2:
                                    patientInfo = _r.sent();
                                    firstName = 'Unknown';
                                    lastName = 'Unknown';
                                    if (patientInfo) {
                                        console.log("\uD83D\uDC64 Patient: ".concat(patientInfo.fullName, " (DOB: ").concat(patientInfo.dateOfBirth, ")"));
                                        nameParts = patientInfo.fullName.split(' ');
                                        firstName = nameParts[0] || 'Unknown';
                                        lastName = nameParts.slice(1).join(' ') || 'Unknown';
                                    }
                                    console.log("\uD83D\uDCC4 Invoice - Amount: $".concat((invoiceInfo.amountDue / 100).toFixed(2), ", Due: ").concat((_a = invoiceInfo.dueDate) === null || _a === void 0 ? void 0 : _a.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                    }), " (").concat(daysPastDue, " days past due)"));
                                    cardOnFile = 'No card on file';
                                    if (invoiceInfo.defaultPaymentMethod) {
                                        pm = invoiceInfo.defaultPaymentMethod;
                                        cardOnFile = "".concat((_b = pm.brand) === null || _b === void 0 ? void 0 : _b.toUpperCase(), " ****").concat(pm.last4);
                                        console.log("\uD83D\uDCB3 Payment method on file: ".concat(cardOnFile, " (").concat(pm.expMonth, "/").concat(pm.expYear, ")"));
                                    }
                                    return [4 /*yield*/, sendPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.amountDue, invoiceInfo.invoiceLink)];
                                case 3:
                                    _r.sent();
                                    return [4 /*yield*/, stripe.invoices.sendInvoice(invoiceInfo.invoiceId)];
                                case 4:
                                    _r.sent();
                                    console.log("\uD83D\uDCE7 Re-sent invoice email via Stripe");
                                    smsSentCount++;
                                    csvReportData.push({
                                        firstName: firstName,
                                        lastName: lastName,
                                        dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_c = invoiceInfo.dueDate) === null || _c === void 0 ? void 0 : _c.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                                            ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                                            : 'No appointments',
                                        cardOnFile: cardOnFile,
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'SMS Sent',
                                    });
                                    if (!(i < smsPatientIds.length - 1)) return [3 /*break*/, 6];
                                    console.log('⏳ Waiting 2 seconds...');
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                case 5:
                                    _r.sent();
                                    _r.label = 6;
                                case 6: return [3 /*break*/, 8];
                                case 7:
                                    error_5 = _r.sent();
                                    console.error("\u274C Failed to process patient ".concat(patientId, ":"), error_5);
                                    smsFailCount++;
                                    csvReportData.push({
                                        firstName: 'Error',
                                        lastName: 'Error',
                                        dateOfBirth: 'Error',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_d = invoiceInfo.dueDate) === null || _d === void 0 ? void 0 : _d.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: 'Error',
                                        cardOnFile: 'Error',
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'SMS Failed',
                                    });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _q.label = 3;
                case 3:
                    if (!(i < smsPatientIds.length)) return [3 /*break*/, 6];
                    return [5 /*yield**/, _loop_1(i)];
                case 4:
                    _q.sent();
                    _q.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 3];
                case 6:
                    delinquentPatientIds = delinquentInvoices
                        .filter(function (invoice) { return invoice.oystehrPatientId; })
                        .map(function (invoice) { return invoice.oystehrPatientId; });
                    console.log("\n2\uFE0F\u20E3  Processing ".concat(delinquentPatientIds.length, " patients for delinquent SMS..."));
                    delinquentSentCount = 0;
                    delinquentFailCount = 0;
                    _loop_2 = function (i) {
                        var patientId, invoiceInfo, daysPastDue, patientInfo, firstName, lastName, nameParts, cardOnFile, pm, error_6;
                        return __generator(this, function (_s) {
                            switch (_s.label) {
                                case 0:
                                    patientId = delinquentPatientIds[i];
                                    invoiceInfo = delinquentInvoices.find(function (inv) { return inv.oystehrPatientId === patientId; });
                                    if (!invoiceInfo) {
                                        console.log("\u26A0\uFE0F  No invoice found for patient ".concat(patientId));
                                        delinquentFailCount++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    _s.label = 1;
                                case 1:
                                    _s.trys.push([1, 7, , 8]);
                                    console.log("\n[".concat(i + 1, "/").concat(delinquentPatientIds.length, "] Processing delinquent SMS for patient: ").concat(patientId));
                                    daysPastDue = invoiceInfo.dueDate
                                        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                        : 'Unknown';
                                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, patientId)];
                                case 2:
                                    patientInfo = _s.sent();
                                    firstName = 'Unknown';
                                    lastName = 'Unknown';
                                    if (patientInfo) {
                                        console.log("\uD83D\uDC64 Patient: ".concat(patientInfo.fullName, " (DOB: ").concat(patientInfo.dateOfBirth, ")"));
                                        nameParts = patientInfo.fullName.split(' ');
                                        firstName = nameParts[0] || 'Unknown';
                                        lastName = nameParts.slice(1).join(' ') || 'Unknown';
                                    }
                                    console.log("\uD83D\uDCC4 Delinquent invoice - Amount: $".concat((invoiceInfo.amountDue / 100).toFixed(2), ", Due: ").concat((_e = invoiceInfo.dueDate) === null || _e === void 0 ? void 0 : _e.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                    }), " (").concat(daysPastDue, " days past due)"));
                                    cardOnFile = 'No card on file';
                                    if (invoiceInfo.defaultPaymentMethod) {
                                        pm = invoiceInfo.defaultPaymentMethod;
                                        cardOnFile = "".concat((_f = pm.brand) === null || _f === void 0 ? void 0 : _f.toUpperCase(), " ****").concat(pm.last4);
                                    }
                                    return [4 /*yield*/, sendDelinquentPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.invoiceLink)];
                                case 3:
                                    _s.sent();
                                    return [4 /*yield*/, stripe.invoices.sendInvoice(invoiceInfo.invoiceId)];
                                case 4:
                                    _s.sent();
                                    console.log("\uD83D\uDCE7 Re-sent invoice email via Stripe");
                                    delinquentSentCount++;
                                    csvReportData.push({
                                        firstName: firstName,
                                        lastName: lastName,
                                        dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_g = invoiceInfo.dueDate) === null || _g === void 0 ? void 0 : _g.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                                            ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                                            : 'No appointments',
                                        cardOnFile: cardOnFile,
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'Delinquent SMS Sent',
                                    });
                                    if (!(i < delinquentPatientIds.length - 1)) return [3 /*break*/, 6];
                                    console.log('⏳ Waiting 2 seconds...');
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                case 5:
                                    _s.sent();
                                    _s.label = 6;
                                case 6: return [3 /*break*/, 8];
                                case 7:
                                    error_6 = _s.sent();
                                    console.error("\u274C Failed to process delinquent patient ".concat(patientId, ":"), error_6);
                                    delinquentFailCount++;
                                    csvReportData.push({
                                        firstName: 'Error',
                                        lastName: 'Error',
                                        dateOfBirth: 'Error',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_h = invoiceInfo.dueDate) === null || _h === void 0 ? void 0 : _h.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: 'Error',
                                        cardOnFile: 'Error',
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'Delinquent SMS Failed',
                                    });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _q.label = 7;
                case 7:
                    if (!(i < delinquentPatientIds.length)) return [3 /*break*/, 10];
                    return [5 /*yield**/, _loop_2(i)];
                case 8:
                    _q.sent();
                    _q.label = 9;
                case 9:
                    i++;
                    return [3 /*break*/, 7];
                case 10:
                    collectionsWarningPatientIds = collectionsWarningInvoices
                        .filter(function (invoice) { return invoice.oystehrPatientId; })
                        .map(function (invoice) { return invoice.oystehrPatientId; });
                    console.log("\n3\uFE0F\u20E3  Processing ".concat(collectionsWarningPatientIds.length, " patients for collections warning SMS..."));
                    collectionsSentCount = 0;
                    collectionsFailCount = 0;
                    _loop_3 = function (i) {
                        var patientId, invoiceInfo, daysPastDue, patientInfo, firstName, lastName, nameParts, cardOnFile, pm, error_7;
                        return __generator(this, function (_t) {
                            switch (_t.label) {
                                case 0:
                                    patientId = collectionsWarningPatientIds[i];
                                    invoiceInfo = collectionsWarningInvoices.find(function (inv) { return inv.oystehrPatientId === patientId; });
                                    if (!invoiceInfo) {
                                        console.log("\u26A0\uFE0F  No invoice found for patient ".concat(patientId));
                                        collectionsFailCount++;
                                        return [2 /*return*/, "continue"];
                                    }
                                    _t.label = 1;
                                case 1:
                                    _t.trys.push([1, 7, , 8]);
                                    console.log("\n[".concat(i + 1, "/").concat(collectionsWarningPatientIds.length, "] Processing collections warning SMS for patient: ").concat(patientId));
                                    daysPastDue = invoiceInfo.dueDate
                                        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
                                        : 'Unknown';
                                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, patientId)];
                                case 2:
                                    patientInfo = _t.sent();
                                    firstName = 'Unknown';
                                    lastName = 'Unknown';
                                    if (patientInfo) {
                                        console.log("\uD83D\uDC64 Patient: ".concat(patientInfo.fullName, " (DOB: ").concat(patientInfo.dateOfBirth, ")"));
                                        nameParts = patientInfo.fullName.split(' ');
                                        firstName = nameParts[0] || 'Unknown';
                                        lastName = nameParts.slice(1).join(' ') || 'Unknown';
                                    }
                                    console.log("\uD83D\uDCC4 Collections warning invoice - Amount: $".concat((invoiceInfo.amountDue / 100).toFixed(2), ", Due: ").concat((_j = invoiceInfo.dueDate) === null || _j === void 0 ? void 0 : _j.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                    }), " (").concat(daysPastDue, " days past due)"));
                                    cardOnFile = 'No card on file';
                                    if (invoiceInfo.defaultPaymentMethod) {
                                        pm = invoiceInfo.defaultPaymentMethod;
                                        cardOnFile = "".concat((_k = pm.brand) === null || _k === void 0 ? void 0 : _k.toUpperCase(), " ****").concat(pm.last4);
                                    }
                                    return [4 /*yield*/, sendCollectionsPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.invoiceLink)];
                                case 3:
                                    _t.sent();
                                    return [4 /*yield*/, stripe.invoices.sendInvoice(invoiceInfo.invoiceId)];
                                case 4:
                                    _t.sent();
                                    console.log("\uD83D\uDCE7 Re-sent invoice email via Stripe");
                                    collectionsSentCount++;
                                    csvReportData.push({
                                        firstName: firstName,
                                        lastName: lastName,
                                        dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_l = invoiceInfo.dueDate) === null || _l === void 0 ? void 0 : _l.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                                            ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                                            : 'No appointments',
                                        cardOnFile: cardOnFile,
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'Collections Warning SMS Sent',
                                    });
                                    if (!(i < collectionsWarningPatientIds.length - 1)) return [3 /*break*/, 6];
                                    console.log('⏳ Waiting 2 seconds...');
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                                case 5:
                                    _t.sent();
                                    _t.label = 6;
                                case 6: return [3 /*break*/, 8];
                                case 7:
                                    error_7 = _t.sent();
                                    console.error("\u274C Failed to process collections warning patient ".concat(patientId, ":"), error_7);
                                    collectionsFailCount++;
                                    csvReportData.push({
                                        firstName: 'Error',
                                        lastName: 'Error',
                                        dateOfBirth: 'Error',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_m = invoiceInfo.dueDate) === null || _m === void 0 ? void 0 : _m.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: 'Error',
                                        cardOnFile: 'Error',
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'Collections Warning SMS Failed',
                                    });
                                    return [3 /*break*/, 8];
                                case 8: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _q.label = 11;
                case 11:
                    if (!(i < collectionsWarningPatientIds.length)) return [3 /*break*/, 14];
                    return [5 /*yield**/, _loop_3(i)];
                case 12:
                    _q.sent();
                    _q.label = 13;
                case 13:
                    i++;
                    return [3 /*break*/, 11];
                case 14:
                    writtenOffPatientIds = writtenOffInvoices
                        .filter(function (invoice) { return invoice.oystehrPatientId; })
                        .map(function (invoice) { return invoice.oystehrPatientId; });
                    console.log("\n4\uFE0F\u20E3  Processing ".concat(writtenOffPatientIds.length, " written off invoices (report only)..."));
                    _loop_4 = function (i) {
                        var patientId, invoiceInfo, patientInfo, firstName, lastName, nameParts, cardOnFile, pm, error_8;
                        return __generator(this, function (_u) {
                            switch (_u.label) {
                                case 0:
                                    patientId = writtenOffPatientIds[i];
                                    invoiceInfo = writtenOffInvoices.find(function (inv) { return inv.oystehrPatientId === patientId; });
                                    if (!invoiceInfo) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    _u.label = 1;
                                case 1:
                                    _u.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, patientId)];
                                case 2:
                                    patientInfo = _u.sent();
                                    firstName = 'Unknown';
                                    lastName = 'Unknown';
                                    if (patientInfo) {
                                        nameParts = patientInfo.fullName.split(' ');
                                        firstName = nameParts[0] || 'Unknown';
                                        lastName = nameParts.slice(1).join(' ') || 'Unknown';
                                    }
                                    cardOnFile = 'No card on file';
                                    if (invoiceInfo.defaultPaymentMethod) {
                                        pm = invoiceInfo.defaultPaymentMethod;
                                        cardOnFile = "".concat((_o = pm.brand) === null || _o === void 0 ? void 0 : _o.toUpperCase(), " ****").concat(pm.last4);
                                    }
                                    csvReportData.push({
                                        firstName: firstName,
                                        lastName: lastName,
                                        dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                                        amountDue: "$".concat((invoiceInfo.amountDue / 100).toFixed(2)),
                                        dateDue: ((_p = invoiceInfo.dueDate) === null || _p === void 0 ? void 0 : _p.toISOString().split('T')[0]) || 'Unknown',
                                        appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                                            ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                                            : 'No appointments',
                                        cardOnFile: cardOnFile,
                                        invoiceLink: invoiceInfo.invoiceLink,
                                        collectionsStatus: 'Written Off',
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_8 = _u.sent();
                                    console.error("\u274C Failed to process written off patient ".concat(patientId, ":"), error_8);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _q.label = 15;
                case 15:
                    if (!(i < writtenOffPatientIds.length)) return [3 /*break*/, 18];
                    return [5 /*yield**/, _loop_4(i)];
                case 16:
                    _q.sent();
                    _q.label = 17;
                case 17:
                    i++;
                    return [3 /*break*/, 15];
                case 18:
                    // Generate CSV report
                    generateCSVReport(csvReportData, csvFilename);
                    // Final Summary
                    console.log("\n\uD83D\uDCCA Final Summary:");
                    console.log("1\uFE0F\u20E3  SMS Reminders:");
                    console.log("   \u2705 Sent: ".concat(smsSentCount));
                    console.log("   \u274C Failed: ".concat(smsFailCount));
                    console.log("   \uD83D\uDCB0 Amount: $".concat((smsAmountDue / 100).toFixed(2)));
                    console.log("2\uFE0F\u20E3  Delinquent SMS:");
                    console.log("   \u2705 Sent: ".concat(delinquentSentCount));
                    console.log("   \u274C Failed: ".concat(delinquentFailCount));
                    console.log("   \uD83D\uDCB0 Amount: $".concat((delinquentAmountDue / 100).toFixed(2)));
                    console.log("3\uFE0F\u20E3  Collections Warning SMS:");
                    console.log("   \u2705 Sent: ".concat(collectionsSentCount));
                    console.log("   \u274C Failed: ".concat(collectionsFailCount));
                    console.log("   \uD83D\uDCB0 Amount: $".concat((collectionsWarningAmountDue / 100).toFixed(2)));
                    console.log("4\uFE0F\u20E3  Written Off (Report Only):");
                    console.log("   \uD83D\uDCCB Count: ".concat(writtenOffPatientIds.length));
                    console.log("   \uD83D\uDCB0 Amount: $".concat((writtenOffAmountDue / 100).toFixed(2)));
                    console.log("\n\uD83D\uDCC4 Total records in CSV: ".concat(csvReportData.length));
                    console.log("\uD83D\uDCC4 CSV report saved as: ".concat(csvFilename));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ All invoices processed.'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});

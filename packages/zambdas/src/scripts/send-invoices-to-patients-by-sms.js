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
                    console.log("\u2705 SMS details are in ", response);
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
function sendInvoiceBySMS(oystehr, resourceId, serviceDate, balanceDue, // Changed to number (cents)
dueDate, invoiceLink) {
    return __awaiter(this, void 0, void 0, function () {
        var formattedDueDate, balanceInDollars, shortInvoiceLink, invoiceMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    formattedDueDate = dueDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                    });
                    balanceInDollars = (balanceDue / 100).toFixed(2);
                    shortInvoiceLink = invoiceLink;
                    invoiceMessage = "Thank you for visiting UrgiKids. You have a balance of $".concat(balanceInDollars, ".\n\n \uD83D\uDCB3 If we have your card on file, it will be billed on ").concat(formattedDueDate, ".\n\nTo use a different payment method, please pay the invoice before due date: \n\n").concat(shortInvoiceLink);
                    return [4 /*yield*/, sendSMSMessage(oystehr, resourceId, invoiceMessage)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function findStripeInvoiceByPatientId(stripe, oystehrPatientId) {
    return __awaiter(this, void 0, void 0, function () {
        var customers, customer, invoices, mostRecentInvoice, generationDate, dueDate, invoiceLink, totalAmountDue, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    console.log("\uD83D\uDD0D Searching for Stripe customer with oystehr_patient_id: ".concat(oystehrPatientId));
                    return [4 /*yield*/, stripe.customers.search({
                            limit: 100,
                            query: "metadata['oystehr_patient_id']:'".concat(oystehrPatientId, "'"),
                        })];
                case 1:
                    customers = _a.sent();
                    customer = customers.data[0];
                    if (!customer) {
                        console.log("\u274C No Stripe customer found with oystehr_patient_id: ".concat(oystehrPatientId));
                        return [2 /*return*/, null];
                    }
                    console.log("\u2705 Found Stripe customer: ".concat(customer.id));
                    return [4 /*yield*/, stripe.invoices.list({
                            customer: customer.id,
                            limit: 1, // Only get the most recent invoice
                            status: 'open', // Only get unpaid invoices
                        })];
                case 2:
                    invoices = _a.sent();
                    if (invoices.data.length === 0) {
                        console.log("\u274C No open invoices found for customer: ".concat(customer.id));
                        return [2 /*return*/, null];
                    }
                    mostRecentInvoice = invoices.data[0];
                    console.log("\u2705 Found most recent invoice: ".concat(mostRecentInvoice.id));
                    generationDate = new Date(mostRecentInvoice.created * 1000);
                    dueDate = mostRecentInvoice.due_date
                        ? new Date(mostRecentInvoice.due_date * 1000)
                        : new Date(mostRecentInvoice.created * 1000 + 30 * 24 * 60 * 60 * 1000);
                    invoiceLink = mostRecentInvoice.hosted_invoice_url || mostRecentInvoice.invoice_pdf || '';
                    totalAmountDue = mostRecentInvoice.amount_due;
                    return [2 /*return*/, {
                            generationDate: generationDate,
                            dueDate: dueDate,
                            invoiceLink: invoiceLink,
                            totalAmountDue: totalAmountDue,
                        }];
                case 3:
                    error_2 = _a.sent();
                    console.error("\u274C Error finding Stripe invoice for patient ".concat(oystehrPatientId, ":"), error_2);
                    throw error_2;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function readPatientIdsFromCSV(csvFilePath) {
    return __awaiter(this, void 0, void 0, function () {
        var csvContent, lines, startIndex, patientIds, preview;
        return __generator(this, function (_a) {
            try {
                console.log("\uD83D\uDCC4 Reading patient IDs from CSV file: ".concat(csvFilePath));
                csvContent = fs.readFileSync(csvFilePath, 'utf8');
                lines = csvContent.split('\n').filter(function (line) { return line.trim() !== ''; });
                startIndex = lines[0] && (lines[0].toLowerCase().includes('patient') || lines[0].toLowerCase().includes('id')) ? 1 : 0;
                patientIds = lines.slice(startIndex).map(function (line) { return line.trim(); });
                console.log("\u2705 Found ".concat(patientIds.length, " patient IDs in CSV file"));
                // Log first few IDs as preview
                if (patientIds.length > 0) {
                    preview = patientIds.slice(0, 3);
                    console.log("   Preview: ".concat(preview.join(', ')).concat(patientIds.length > 3 ? '...' : ''));
                }
                return [2 /*return*/, patientIds];
            }
            catch (error) {
                console.error("\u274C Error reading CSV file ".concat(csvFilePath, ":"), error);
                throw error;
            }
            return [2 /*return*/];
        });
    });
}
// Updated main function to process multiple patients from CSV
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, csvFilePath, secrets, stripe, token, oystehr, patientIds, successCount, failCount, i, patientId, invoiceInfo, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    env = process.argv[2];
                    csvFilePath = process.argv[3];
                    // Validate required arguments
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run script send-invoices-to-patients-by-sms <env> <csvFilePath>');
                    }
                    if (!csvFilePath) {
                        throw new Error('❌ CSV file path is required. Usage: npm run script send-invoices-to-patients-by-sms <env> <csvFilePath>');
                    }
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    stripe = new stripe_1.default(secrets.STRIPE_SECRET_KEY, {
                        apiVersion: '2025-02-24.acacia',
                    });
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _a.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, readPatientIdsFromCSV(csvFilePath)];
                case 2:
                    patientIds = _a.sent();
                    if (patientIds.length === 0) {
                        console.log('❌ No patient IDs found to process.');
                        return [2 /*return*/];
                    }
                    console.log("\n\uD83D\uDCF1 Processing ".concat(patientIds.length, " patients for invoice SMS..."));
                    successCount = 0;
                    failCount = 0;
                    i = 0;
                    _a.label = 3;
                case 3:
                    if (!(i < patientIds.length)) return [3 /*break*/, 11];
                    patientId = patientIds[i];
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 9, , 10]);
                    console.log("\n[".concat(i + 1, "/").concat(patientIds.length, "] Processing patient: ").concat(patientId));
                    return [4 /*yield*/, findStripeInvoiceByPatientId(stripe, patientId)];
                case 5:
                    invoiceInfo = _a.sent();
                    if (!invoiceInfo) {
                        console.log("\u26A0\uFE0F  No invoice found for patient ".concat(patientId));
                        failCount++;
                        return [3 /*break*/, 10];
                    }
                    console.log("\uD83D\uDCC4 Invoice found - Amount: $".concat((invoiceInfo.totalAmountDue / 100).toFixed(2), ", Due: ").concat(invoiceInfo.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })));
                    // Send SMS with the invoice information
                    return [4 /*yield*/, sendInvoiceBySMS(oystehr, patientId, invoiceInfo.generationDate, // TODO: Need to get the source of the visit date from FHIR or candid
                        invoiceInfo.totalAmountDue, invoiceInfo.dueDate, invoiceInfo.invoiceLink)];
                case 6:
                    // Send SMS with the invoice information
                    _a.sent();
                    successCount++;
                    if (!(i < patientIds.length - 1)) return [3 /*break*/, 8];
                    console.log('⏳ Waiting 2 seconds before next SMS...');
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_3 = _a.sent();
                    console.error("\u274C Failed to process patient ".concat(patientId, ":"), error_3);
                    failCount++;
                    return [3 /*break*/, 10];
                case 10:
                    i++;
                    return [3 /*break*/, 3];
                case 11:
                    // Summary
                    console.log("\n\uD83D\uDCCA Summary:");
                    console.log("\u2705 Successfully sent: ".concat(successCount, " SMS messages"));
                    console.log("\u274C Failed: ".concat(failCount, " patients"));
                    console.log("\uD83D\uDCF1 Total processed: ".concat(patientIds.length, " patients"));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('\n✅ All invoices sent to patients by SMS.'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});

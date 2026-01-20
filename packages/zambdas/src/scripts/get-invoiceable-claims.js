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
var candidhealth_1 = require("candidhealth");
var fs = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
function getPatientInfoWithLatestAppointment(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var patient, name_1, fullName, dateOfBirth, appointmentsResponse, appointments, latestAppointmentDate, latestAppointment, displayDate, error_1;
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
                    error_1 = _c.sent();
                    console.error("\u274C Error fetching patient info for ".concat(patientId, ":"), error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getInvoiceDetails(candid, claimId) {
    return __awaiter(this, void 0, void 0, function () {
        var invoiceResponse, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("\uD83D\uDD0D Fetching invoice details for claim: ".concat(claimId));
                    return [4 /*yield*/, candid.patientAr.v1.itemize(candidhealth_1.CandidApi.ClaimId(claimId))];
                case 1:
                    invoiceResponse = _a.sent();
                    // console.log(`\n📄 Invoice Details for Claim ${claimId}:`);
                    // console.log('==========================================');
                    // console.log('Full JSON Response:');
                    // console.log(JSON.stringify(invoiceResponse, null, 2));
                    // console.log('==========================================\n');
                    // Check if response is ok and body exists
                    if (invoiceResponse && invoiceResponse.ok && invoiceResponse.body) {
                        return [2 /*return*/, invoiceResponse.body];
                    }
                    else {
                        console.log("\u26A0\uFE0F Invalid response for claim ".concat(claimId, ":"), {
                            ok: invoiceResponse === null || invoiceResponse === void 0 ? void 0 : invoiceResponse.ok,
                            hasBody: !!(invoiceResponse === null || invoiceResponse === void 0 ? void 0 : invoiceResponse.body),
                        });
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error("\u274C Error fetching invoice details for claim ".concat(claimId, ":"), error_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getInvoiceableClaims(candid_1) {
    return __awaiter(this, arguments, void 0, function (candid, limit, pageToken) {
        var allRecords, currentPageToken, pageCount, totalFetched, inventoryResponse, _a, records, nextPageToken, invoiceableRecords, uniquePatients, statusCounts, error_3;
        if (limit === void 0) { limit = 100; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    console.log('🔍 Fetching patient inventory from Candid...');
                    allRecords = [];
                    currentPageToken = pageToken;
                    pageCount = 0;
                    totalFetched = 0;
                    _b.label = 1;
                case 1:
                    pageCount++;
                    console.log("\uD83D\uDCC4 Fetching page ".concat(pageCount).concat(currentPageToken ? " (token: ".concat(currentPageToken.substring(0, 20), "...)") : '', "..."));
                    return [4 /*yield*/, candid.patientAr.v1.listInventory({
                            limit: limit,
                            pageToken: currentPageToken ? candidhealth_1.CandidApi.PageToken(currentPageToken) : undefined,
                        })];
                case 2:
                    inventoryResponse = _b.sent();
                    // Handle the actual response structure: { ok: boolean, body: { records: [], nextPageToken?: string } }
                    if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
                        _a = inventoryResponse.body, records = _a.records, nextPageToken = _a.nextPageToken;
                        invoiceableRecords = records.filter(function (record) { return record.patientArStatus === 'invoiceable'; });
                        console.log("   \uD83D\uDCC4 Page ".concat(pageCount, ": Found ").concat(records.length, " total claims, ").concat(invoiceableRecords.length, " invoiceable"));
                        // Add filtered records to our collection
                        allRecords = allRecords.concat(invoiceableRecords);
                        totalFetched += invoiceableRecords.length;
                        // Update page token for next iteration
                        currentPageToken = nextPageToken;
                        // If a specific pageToken was provided, only fetch that one page
                        if (pageToken) {
                            return [3 /*break*/, 4];
                        }
                        // If no more pages, break the loop
                        if (!nextPageToken) {
                            console.log("   \uD83C\uDFC1 Reached end of pages");
                            return [3 /*break*/, 4];
                        }
                    }
                    else {
                        console.log('⚠️ Unexpected response format or failed request on page', pageCount);
                        console.log('Response details:', {
                            ok: inventoryResponse === null || inventoryResponse === void 0 ? void 0 : inventoryResponse.ok,
                            hasBody: (inventoryResponse === null || inventoryResponse === void 0 ? void 0 : inventoryResponse.ok) ? !!inventoryResponse.body : false,
                            responseType: typeof inventoryResponse,
                        });
                        return [3 /*break*/, 4];
                    }
                    _b.label = 3;
                case 3:
                    if (currentPageToken && !pageToken) return [3 /*break*/, 1];
                    _b.label = 4;
                case 4:
                    console.log('\n📊 Patient Inventory Response:');
                    console.log('===============================');
                    console.log("\uD83D\uDCC4 Total pages fetched: ".concat(pageCount));
                    console.log("\uD83D\uDCC4 Total invoiceable claims found: ".concat(totalFetched));
                    if (allRecords.length > 0) {
                        console.log("\uD83D\uDCC4 Response Status: \u2705 Success");
                        if (currentPageToken) {
                            console.log("\uD83D\uDCC4 Next Page Token: ".concat(currentPageToken));
                            console.log("\uD83D\uDCC4 More records available: Yes");
                        }
                        else {
                            console.log("\uD83D\uDCC4 More records available: No");
                        }
                        uniquePatients = new Set(allRecords.map(function (r) { return r.patientExternalId; }));
                        statusCounts = allRecords.reduce(function (acc, record) {
                            acc[record.patientArStatus] = (acc[record.patientArStatus] || 0) + 1;
                            return acc;
                        }, {});
                        // Summary
                        console.log("\n\uD83D\uDCCA Summary:");
                        console.log("   Total invoiceable claims: ".concat(allRecords.length));
                        console.log("   Unique patients: ".concat(uniquePatients.size));
                        console.log("   Status breakdown:");
                        Object.entries(statusCounts).forEach(function (_a) {
                            var status = _a[0], count = _a[1];
                            console.log("     ".concat(status, ": ").concat(count));
                        });
                        return [2 /*return*/, {
                                claims: allRecords.map(function (record) { return ({
                                    claimId: record.claimId,
                                    encounterId: record.encounterId,
                                    patientExternalId: record.patientExternalId,
                                    patientArStatus: record.patientArStatus,
                                    timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : String(record.timestamp),
                                }); }),
                                nextPageToken: currentPageToken,
                                totalClaims: allRecords.length,
                                uniquePatients: uniquePatients.size,
                                statusCounts: statusCounts,
                            }];
                    }
                    else {
                        console.log('📄 No invoiceable claims found');
                        return [2 /*return*/, {
                                claims: [],
                                nextPageToken: undefined,
                                totalClaims: 0,
                                uniquePatients: 0,
                                statusCounts: {},
                            }];
                    }
                    return [3 /*break*/, 6];
                case 5:
                    error_3 = _b.sent();
                    console.error('❌ Error fetching invoiceable claims:', error_3);
                    // Print more detailed error information
                    if (error_3 instanceof Error) {
                        console.error('Error message:', error_3.message);
                        console.error('Error stack:', error_3.stack);
                    }
                    throw error_3;
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Add CSV generation function
function generateCSVReport(reportData, filename) {
    try {
        console.log("\n\uD83D\uDCCA Generating CSV report: ".concat(filename));
        // CSV headers with invoice date as first column
        var headers = [
            'Invoice Date', // New first column
            'Claim ID',
            'Patient ID',
            'Full Name',
            'Date of Birth',
            'Appointment Date',
            'Patient Balance',
            'Service Date',
            'Procedure Code',
            'Charge Amount',
            'Insurance Payment',
            'Copay',
            'Deductible',
            'Insurance Adjustments',
        ];
        // Convert data to CSV format with invoice date as first column
        var csvRows = __spreadArray([
            headers.join(',')
        ], reportData.map(function (row) {
            return [
                "\"".concat(row.invoiceDate, "\""), // New first column
                "\"".concat(row.claimId, "\""),
                "\"".concat(row.patientId, "\""),
                "\"".concat(row.fullName, "\""),
                "\"".concat(row.dateOfBirth, "\""),
                "\"".concat(row.appointmentDate, "\""),
                "\"".concat(row.patientBalance, "\""),
                "\"".concat(row.serviceDate, "\""),
                "\"".concat(row.procedureCode, "\""),
                "\"".concat(row.chargeAmount, "\""),
                "\"".concat(row.insurancePayment, "\""),
                "\"".concat(row.copay, "\""),
                "\"".concat(row.deductible, "\""),
                "\"".concat(row.insuranceAdjustments, "\""),
            ].join(',');
        }), true);
        // Write CSV file
        var csvContent = csvRows.join('\n');
        fs.writeFileSync(filename, csvContent, 'utf8');
        console.log("\u2705 CSV report generated successfully: ".concat(filename));
        console.log("\uD83D\uDCC4 Report contains ".concat(reportData.length, " claim records"));
    }
    catch (error) {
        console.error("\u274C Error generating CSV report:", error);
        throw error;
    }
}
// Updated main function using the new function
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, csvFilename, secrets, token, oystehr, candid, invoiceableClaimsResponse, claims, csvReportData, i, claim, paddedIndex, patientInfo, invoiceDetails, firstServiceLine;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    env = process.argv[2];
                    csvFilename = process.argv[3] || 'invoiceable-claims-report.csv';
                    // Validate required arguments
                    if (!env) {
                        throw new Error('❌ Environment is required. Usage: npm run get-invoiceable-claims <env> [csvFilename]');
                    }
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
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
                    candid = (0, utils_1.createCandidApiClient)(secrets);
                    return [4 /*yield*/, getInvoiceableClaims(candid, 100)];
                case 2:
                    invoiceableClaimsResponse = _a.sent();
                    if (!invoiceableClaimsResponse) {
                        console.log('❌ Failed to retrieve invoiceable claims');
                        return [2 /*return*/];
                    }
                    claims = invoiceableClaimsResponse.claims;
                    // Print claim ID and external patient ID for each invoiceable claim
                    console.log("\n\uD83D\uDCCB Invoiceable Claims Details:");
                    console.log('================================');
                    claims.forEach(function (claim, index) {
                        var paddedIndex = String(index + 1).padStart(3, ' ');
                        console.log("[".concat(paddedIndex, "] Claim ID: ").concat(claim.claimId, " | Patient ID: ").concat(claim.patientExternalId));
                    });
                    // Fetch invoice details for each claim and build CSV data
                    console.log("\n\uD83D\uDCB0 Processing Invoice Details for ".concat(claims.length, " Claims:"));
                    console.log('=========================================================');
                    csvReportData = [];
                    i = 0;
                    _a.label = 3;
                case 3:
                    if (!(i < claims.length)) return [3 /*break*/, 7];
                    claim = claims[i];
                    paddedIndex = String(i + 1).padStart(3, ' ');
                    console.log("\n[".concat(paddedIndex, "] Processing Claim: ").concat(claim.claimId));
                    return [4 /*yield*/, getPatientInfoWithLatestAppointment(oystehr, claim.patientExternalId)];
                case 4:
                    patientInfo = _a.sent();
                    if (patientInfo) {
                        console.log("      \uD83D\uDC64 Patient ID: ".concat(claim.patientExternalId));
                        console.log("      \uD83D\uDC64 Full Name: ".concat(patientInfo.fullName));
                        console.log("      \uD83D\uDCC5 Date of Birth: ".concat(patientInfo.dateOfBirth));
                        console.log("      \uD83D\uDCC5 Latest Appointment: ".concat(patientInfo.latestAppointmentDate
                            ? new Date(patientInfo.latestAppointmentDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                            })
                            : 'No appointments'));
                    }
                    else {
                        console.log("      \uD83D\uDC64 Patient ID: ".concat(claim.patientExternalId));
                        console.log("      \u26A0\uFE0F Patient info not found in FHIR");
                    }
                    return [4 /*yield*/, getInvoiceDetails(candid, claim.claimId)];
                case 5:
                    invoiceDetails = _a.sent();
                    if (invoiceDetails) {
                        // Print patient balance in dollars
                        console.log("      \uD83D\uDCB0 Total Patient Balance: $".concat((invoiceDetails.patientBalanceCents / 100).toFixed(2)));
                        // Print service lines
                        console.log("      \uD83D\uDCCB Service Lines (".concat(invoiceDetails.serviceLineItemization.length, "):"));
                        invoiceDetails.serviceLineItemization.forEach(function (serviceLine, serviceIndex) {
                            var serviceNum = String(serviceIndex + 1).padStart(2, ' ');
                            console.log("         [".concat(serviceNum, "] Procedure Code: ").concat(serviceLine.procedureCode));
                            console.log("              \uD83D\uDCC5 Date of Service: ".concat(serviceLine.dateOfService));
                            console.log("              \uD83D\uDCB5 Charge Amount: $".concat((serviceLine.chargeAmountCents / 100).toFixed(2)));
                            console.log("              \uD83C\uDFE5 Insurance Payment: $".concat((serviceLine.insurancePayments.totalPaymentCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDCC9 Insurance Adjustments: $".concat((serviceLine.insuranceAdjustments.totalAdjustmentCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDC64 Patient Adjustments: $".concat((serviceLine.patientAdjustments.totalAdjustmentCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDCB3 Patient Payments: $".concat((serviceLine.patientPayments.totalPaymentCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDD38 Copay: $".concat((serviceLine.copayCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDD39 Coinsurance: $".concat((serviceLine.coinsuranceCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDD3A Deductible: $".concat((serviceLine.deductibleCents / 100).toFixed(2)));
                            console.log("              \uD83D\uDCB0 Patient Balance: $".concat((serviceLine.patientBalanceCents / 100).toFixed(2)));
                            // Add non-insurance payments and adjustments if they exist
                            if (serviceLine.nonInsurancePayments.totalPaymentCents > 0) {
                                console.log("              \uD83C\uDFDB\uFE0F Non-Insurance Payments: $".concat((serviceLine.nonInsurancePayments.totalPaymentCents / 100).toFixed(2)));
                            }
                            if (serviceLine.nonInsuranceAdjustments.totalAdjustmentCents > 0) {
                                console.log("              \uD83D\uDD27 Non-Insurance Adjustments: $".concat((serviceLine.nonInsuranceAdjustments.totalAdjustmentCents / 100).toFixed(2)));
                            }
                            console.log(''); // Add spacing between service lines
                        });
                        firstServiceLine = invoiceDetails.serviceLineItemization[0];
                        csvReportData.push({
                            invoiceDate: new Date().toISOString().split('T')[0], // Add invoice date
                            claimId: claim.claimId,
                            patientId: claim.patientExternalId,
                            fullName: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.fullName) || 'Unknown',
                            dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                            appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                                ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                                : 'No appointments',
                            patientBalance: "$".concat((invoiceDetails.patientBalanceCents / 100).toFixed(2)),
                            serviceDate: (firstServiceLine === null || firstServiceLine === void 0 ? void 0 : firstServiceLine.dateOfService) || 'N/A',
                            procedureCode: (firstServiceLine === null || firstServiceLine === void 0 ? void 0 : firstServiceLine.procedureCode) || 'N/A',
                            chargeAmount: firstServiceLine ? "$".concat((firstServiceLine.chargeAmountCents / 100).toFixed(2)) : 'N/A',
                            insurancePayment: firstServiceLine
                                ? "$".concat((firstServiceLine.insurancePayments.totalPaymentCents / 100).toFixed(2))
                                : 'N/A',
                            copay: firstServiceLine ? "$".concat((firstServiceLine.copayCents / 100).toFixed(2)) : 'N/A',
                            deductible: firstServiceLine ? "$".concat((firstServiceLine.deductibleCents / 100).toFixed(2)) : 'N/A',
                            insuranceAdjustments: firstServiceLine
                                ? "$".concat((firstServiceLine.insuranceAdjustments.totalAdjustmentCents / 100).toFixed(2))
                                : 'N/A',
                        });
                    }
                    else {
                        console.log("      \u274C Failed to retrieve invoice details");
                        // Still add to CSV with error data
                        csvReportData.push({
                            invoiceDate: new Date().toISOString().split('T')[0], // Add invoice date
                            claimId: claim.claimId,
                            patientId: claim.patientExternalId,
                            fullName: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.fullName) || 'Unknown',
                            dateOfBirth: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.dateOfBirth) || 'Unknown',
                            appointmentDate: (patientInfo === null || patientInfo === void 0 ? void 0 : patientInfo.latestAppointmentDate)
                                ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
                                : 'No appointments',
                            patientBalance: 'Error',
                            serviceDate: 'Error',
                            procedureCode: 'Error',
                            chargeAmount: 'Error',
                            insurancePayment: 'Error',
                            copay: 'Error',
                            deductible: 'Error',
                            insuranceAdjustments: 'Error',
                        });
                    }
                    _a.label = 6;
                case 6:
                    i++;
                    return [3 /*break*/, 3];
                case 7:
                    // Generate CSV report
                    generateCSVReport(csvReportData, csvFilename);
                    console.log("\n\u2705 Completed processing ".concat(claims.length, " claims"));
                    console.log("\uD83D\uDCC4 CSV report saved as: ".concat(csvFilename));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('❌ Unexpected error in main execution:', error);
    process.exit(1);
});

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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var invoiceable_patients_reports_types_1 = require("utils/lib/types/api/invoiceable-patients-reports.types");
var shared_1 = require("../../shared");
var harvest_1 = require("../shared/harvest");
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'invoiceable-patients-report';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, startFrom, oystehr, candid, invoiceableClaims, invoiceablePatientsReport, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 8]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                secrets = validatedParameters.secrets, startFrom = validatedParameters.startFrom;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                // Get M2M token for FHIR access
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                candid = (0, utils_1.createCandidApiClient)(secrets);
                return [4 /*yield*/, getInvoiceableClaims({
                        candid: candid,
                        limitPerPage: utils_1.DEFAULT_CANDID_CLAIMS_PAGE_SIZE,
                        maxPages: 2, // this is temporary solution to limit candid search so it's not taking a lot of time
                        onlyInvoiceable: true,
                        startFromDate: startFrom,
                    })];
            case 2:
                invoiceableClaims = _a.sent();
                if (!invoiceableClaims) return [3 /*break*/, 5];
                return [4 /*yield*/, getInvoiceablePatientsReport({
                        oystehr: oystehr,
                        candid: candid,
                        invoiceableClaims: invoiceableClaims,
                    })];
            case 3:
                invoiceablePatientsReport = _a.sent();
                if (!invoiceablePatientsReport) return [3 /*break*/, 5];
                return [4 /*yield*/, saveReportToZ3(oystehr, invoiceablePatientsReport, secrets)];
            case 4:
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify('Invoiceable patients report created and saved successfully'),
                    }];
            case 5: return [2 /*return*/, {
                    statusCode: 500,
                    body: JSON.stringify('Error'),
                }];
            case 6:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [4 /*yield*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 7:
                _a.sent();
                console.log('Error occurred:', error_1);
                return [2 /*return*/, {
                        statusCode: 500,
                        body: JSON.stringify({ error: 'Internal server error' }),
                    }];
            case 8: return [2 /*return*/];
        }
    });
}); });
function getInvoiceableClaims(input) {
    return __awaiter(this, void 0, void 0, function () {
        var candid, limitPerPage, onlyInvoiceable, startFromDate, maxPages, inventoryPages, claimsFetched, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    candid = input.candid, limitPerPage = input.limitPerPage, onlyInvoiceable = input.onlyInvoiceable, startFromDate = input.startFromDate, maxPages = input.maxPages;
                    console.log('🔍 Fetching patient inventory from Candid...');
                    return [4 /*yield*/, (0, utils_1.getCandidInventoryPagesRecursive)({
                            candid: candid,
                            claims: [],
                            limitPerPage: limitPerPage,
                            pageCount: 0,
                            onlyInvoiceable: onlyInvoiceable,
                            maxPages: maxPages,
                            since: startFromDate,
                        })];
                case 1:
                    inventoryPages = _a.sent();
                    console.log('\n📊 Patient Inventory Response:');
                    console.log('===============================');
                    console.log("\uD83D\uDCC4 Total pages fetched: ".concat(inventoryPages === null || inventoryPages === void 0 ? void 0 : inventoryPages.pageCount));
                    console.log("\uD83D\uDCC4 Total claims found: ".concat(inventoryPages === null || inventoryPages === void 0 ? void 0 : inventoryPages.claims.length));
                    console.log('===============================');
                    claimsFetched = inventoryPages === null || inventoryPages === void 0 ? void 0 : inventoryPages.claims;
                    if ((claimsFetched === null || claimsFetched === void 0 ? void 0 : claimsFetched.length) && claimsFetched.length > 0) {
                        return [2 /*return*/, claimsFetched.map(function (record) { return ({
                                claimId: record.claimId,
                                encounterId: record.encounterId,
                                patientExternalId: record.patientExternalId,
                                patientArStatus: record.patientArStatus,
                                timestamp: record.timestamp.toISOString(),
                            }); })];
                    }
                    else {
                        console.log('📄 No invoiceable patients found');
                        return [2 /*return*/, undefined];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error fetching invoiceable claims: ', error_2);
                    throw new Error('Failed to fetch invoiceable claims: ' + error_2);
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getInvoiceablePatientsReport(input) {
    return __awaiter(this, void 0, void 0, function () {
        var invoiceableClaims_1, oystehr_1, candid, allFhirResources, _a, allFhirResourcesResponse_1, itemizationMap_1, patientToIdMap_1, appointmentToIdMap_1, accountsToPatientIdMap_1, encounterToCandidIdMap_1, resultReports_1, resultReportsErrors_1, error_3;
        var _this = this;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    invoiceableClaims_1 = input.invoiceableClaims, oystehr_1 = input.oystehr, candid = input.candid;
                    console.log('🔍 Fetching FHIR resources for invoiceable patients...');
                    allFhirResources = function () { return __awaiter(_this, void 0, void 0, function () {
                        var promises, response;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    promises = [];
                                    promises.push((0, utils_1.getResourcesFromBatchInlineRequests)(oystehr_1, invoiceableClaims_1.map(function (claim) { return "Patient?_id=".concat(claim.patientExternalId, "&_revinclude=Account:patient"); })));
                                    promises.push((0, utils_1.getResourcesFromBatchInlineRequests)(oystehr_1, invoiceableClaims_1.map(function (claim) {
                                        return "Encounter?identifier=".concat(shared_1.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, "|").concat(claim.encounterId, "&_include=Encounter:appointment");
                                    })));
                                    return [4 /*yield*/, Promise.all(promises)];
                                case 1:
                                    response = _a.sent();
                                    return [2 /*return*/, response.flat()];
                            }
                        });
                    }); };
                    console.log('Creating promises for candid claims resources');
                    console.log('Waiting for all promises');
                    return [4 /*yield*/, Promise.all([
                            allFhirResources(),
                            (0, helpers_1.getCandidItemizationMap)(candid, invoiceableClaims_1),
                        ])];
                case 1:
                    _a = _c.sent(), allFhirResourcesResponse_1 = _a[0], itemizationMap_1 = _a[1];
                    console.log('Data received');
                    patientToIdMap_1 = {};
                    appointmentToIdMap_1 = {};
                    accountsToPatientIdMap_1 = {};
                    encounterToCandidIdMap_1 = {};
                    allFhirResourcesResponse_1.forEach(function (resource) {
                        var _a;
                        if (!resource.id)
                            return;
                        if (resource.resourceType === 'Patient') {
                            patientToIdMap_1[resource.id] = resource;
                        }
                        if (resource.resourceType === 'Account') {
                            var account = resource;
                            if (!(0, harvest_1.accountMatchesType)(account, utils_1.PATIENT_BILLING_ACCOUNT_TYPE))
                                return;
                            var patientId = (_a = (0, utils_1.getPatientReferenceFromAccount)(account)) === null || _a === void 0 ? void 0 : _a.split('/')[1];
                            if (patientId) {
                                accountsToPatientIdMap_1[patientId] = account;
                            }
                        }
                        if (resource.resourceType === 'Appointment') {
                            appointmentToIdMap_1[resource.id] = resource;
                        }
                        if (resource.resourceType === 'Encounter') {
                            var candidEncounterId = (0, shared_1.getCandidEncounterIdFromEncounter)(resource);
                            if (candidEncounterId)
                                encounterToCandidIdMap_1[candidEncounterId] = resource;
                        }
                    });
                    resultReports_1 = [];
                    resultReportsErrors_1 = [];
                    invoiceableClaims_1.forEach(function (claim) {
                        var report = (0, helpers_1.mapResourcesToInvoiceablePatient)({
                            patientToIdMap: patientToIdMap_1,
                            encounterToCandidIdMap: encounterToCandidIdMap_1,
                            accountsToPatientIdMap: accountsToPatientIdMap_1,
                            appointmentToIdMap: appointmentToIdMap_1,
                            itemizationMap: itemizationMap_1,
                            claim: claim,
                            allFhirResources: allFhirResourcesResponse_1,
                        });
                        if (report && 'error' in report)
                            resultReportsErrors_1.push(report);
                        else if (report)
                            resultReports_1.push(report);
                    });
                    return [2 /*return*/, {
                            date: (_b = luxon_1.DateTime.now().toFormat('MM/dd/yyyy HH:mm:ss')) !== null && _b !== void 0 ? _b : '--',
                            claimsFound: invoiceableClaims_1.length,
                            patientsReports: resultReports_1,
                            failedReports: resultReportsErrors_1,
                        }];
                case 2:
                    error_3 = _c.sent();
                    console.error('Error fetching invoiceable patients: ', error_3);
                    throw new Error('Failed to fetch invoiceable patients: ' + error_3);
                case 3: return [2 /*return*/];
            }
        });
    });
}
function saveReportToZ3(oystehr, data, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var fullBucketName, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    fullBucketName = "".concat((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_ID, secrets), "-").concat(invoiceable_patients_reports_types_1.INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME);
                    console.log('Uploading report to Z3 bucket: ', fullBucketName);
                    return [4 /*yield*/, oystehr.z3.uploadFile({
                            bucketName: fullBucketName,
                            'objectPath+': invoiceable_patients_reports_types_1.INVOICEABLE_PATIENTS_REPORTS_FILE_NAME,
                            file: new Blob([JSON.stringify(data)], { type: 'application/json' }),
                        })];
                case 1:
                    _a.sent();
                    console.log('Report uploaded to Z3');
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    console.error('Unable to save report to Z3: ', error_4);
                    throw new Error('Unable to save report to Z3: ' + error_4);
                case 3: return [2 /*return*/];
            }
        });
    });
}

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
var shared_1 = require("../../ehr/radiology/shared");
var shared_2 = require("../../shared");
var oystehrToken;
var ZAMBDA_NAME = 'daily-radiology-report';
/**
 * This zambda checks for any radiology studies that have been stuck in preliminary status to long and throws if it finds any
 * It provides observability into radiology studies that need attention
 */
exports.index = (0, shared_2.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, oneMonthAgo, now, serviceRequests_1, diagnosticReports_1, encounters_1, patients_1, batchSizeDays, numberOfBatches, i, batchStart, batchEnd, searchParams, searchResponse, batchResources, batchServiceRequests, batchDiagnosticReports, batchEncounters, batchPatients, message, studiesAwaitingFinalReportMoreThan24Hours, outputStrings_1, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                secrets = input.secrets;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 8, , 9]);
                if (!!oystehrToken) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, shared_2.getAuth0Token)(secrets)];
            case 2:
                oystehrToken = _a.sent();
                _a.label = 3;
            case 3:
                oystehr = (0, shared_2.createOystehrClient)(oystehrToken, secrets);
                oneMonthAgo = luxon_1.DateTime.now().toUTC().minus({ days: 30 }).startOf('day');
                now = luxon_1.DateTime.now().toUTC();
                console.log("Fetching radiology studies for date range: ".concat(oneMonthAgo.toISO(), " to ").concat(now.toISO()));
                serviceRequests_1 = [];
                diagnosticReports_1 = [];
                encounters_1 = [];
                patients_1 = [];
                batchSizeDays = 3;
                numberOfBatches = 10;
                i = 0;
                _a.label = 4;
            case 4:
                if (!(i < numberOfBatches)) return [3 /*break*/, 7];
                batchStart = oneMonthAgo.plus({ days: i * batchSizeDays });
                batchEnd = oneMonthAgo.plus({ days: (i + 1) * batchSizeDays });
                console.log("Fetching batch ".concat(i + 1, "/").concat(numberOfBatches, ": ").concat(batchStart.toISO(), " to ").concat(batchEnd.toISO()));
                searchParams = [
                    { name: '_tag', value: "".concat(shared_1.ORDER_TYPE_CODE_SYSTEM, "|radiology") },
                    { name: 'status:not', value: 'revoked' },
                    { name: 'authored', value: "ge".concat(batchStart.toISO()) },
                    { name: 'authored', value: "le".concat(batchEnd.toISO()) },
                    { name: '_count', value: '1000' },
                    { name: '_revinclude', value: 'DiagnosticReport:based-on' },
                    { name: '_include', value: 'ServiceRequest:encounter' },
                    { name: '_include', value: 'ServiceRequest:subject' },
                ];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: searchParams,
                    })];
            case 5:
                searchResponse = _a.sent();
                batchResources = searchResponse.unbundle();
                batchServiceRequests = batchResources.filter(function (r) { return r.resourceType === 'ServiceRequest'; });
                batchDiagnosticReports = batchResources.filter(function (r) { return r.resourceType === 'DiagnosticReport'; });
                batchEncounters = batchResources.filter(function (r) { return r.resourceType === 'Encounter'; });
                batchPatients = batchResources.filter(function (r) { return r.resourceType === 'Patient'; });
                console.log("Batch ".concat(i + 1, " found ").concat(batchServiceRequests.length, " radiology studies"));
                // Add to aggregated lists, avoiding duplicates by ID
                batchServiceRequests.forEach(function (sr) {
                    if (!serviceRequests_1.find(function (existing) { return existing.id === sr.id; })) {
                        serviceRequests_1.push(sr);
                    }
                });
                batchDiagnosticReports.forEach(function (dr) {
                    if (!diagnosticReports_1.find(function (existing) { return existing.id === dr.id; })) {
                        diagnosticReports_1.push(dr);
                    }
                });
                batchEncounters.forEach(function (enc) {
                    if (!encounters_1.find(function (existing) { return existing.id === enc.id; })) {
                        encounters_1.push(enc);
                    }
                });
                batchPatients.forEach(function (pat) {
                    if (!patients_1.find(function (existing) { return existing.id === pat.id; })) {
                        patients_1.push(pat);
                    }
                });
                _a.label = 6;
            case 6:
                i++;
                return [3 /*break*/, 4];
            case 7:
                console.log("Found ".concat(serviceRequests_1.length, " radiology studies"));
                if (serviceRequests_1.length === 0) {
                    message = "No radiology studies found since ".concat(oneMonthAgo.toFormat('yyyy-MM-dd'));
                    console.log(message);
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify({}),
                        }];
                }
                studiesAwaitingFinalReportMoreThan24Hours = serviceRequests_1
                    .map(function (serviceRequest) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                    if (!serviceRequest.id) {
                        throw new Error('ServiceRequest is missing id');
                    }
                    var encounterId = (_b = (_a = serviceRequest.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1];
                    var encounter = encounters_1.find(function (e) { return e.id === encounterId; });
                    var appointmentId = ((_e = (_d = (_c = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.split('/')[1]) || '';
                    var patientId = (_g = (_f = serviceRequest.subject) === null || _f === void 0 ? void 0 : _f.reference) === null || _g === void 0 ? void 0 : _g.split('/')[1];
                    var patient = patients_1.find(function (p) { return p.id === patientId; });
                    var patientName = ((_h = patient === null || patient === void 0 ? void 0 : patient.name) === null || _h === void 0 ? void 0 : _h[0])
                        ? "".concat(patient.name[0].family, ", ").concat(((_j = patient.name[0].given) === null || _j === void 0 ? void 0 : _j[0]) || '')
                        : undefined;
                    // Determine status based on service request and diagnostic reports
                    var relatedDiagnosticReports = diagnosticReports_1.filter(function (report) { var _a; return (_a = report.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (basedOn) { return basedOn.reference === "ServiceRequest/".concat(serviceRequest.id); }); });
                    var preliminaryReport = relatedDiagnosticReports.find(function (r) { return r.status === 'preliminary'; });
                    var maybePreliminaryReportTime = (_l = (_k = preliminaryReport === null || preliminaryReport === void 0 ? void 0 : preliminaryReport.extension) === null || _k === void 0 ? void 0 : _k.find(function (ext) { return ext.url === shared_1.DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL; })) === null || _l === void 0 ? void 0 : _l.valueDateTime;
                    if (!preliminaryReport) {
                        return;
                    }
                    if (!maybePreliminaryReportTime) {
                        throw new Error("Preliminary report for ServiceRequest/".concat(serviceRequest.id, " is missing preliminary review time extension"));
                    }
                    var preliminaryReportTime = luxon_1.DateTime.fromISO(maybePreliminaryReportTime).toUTC();
                    var now = luxon_1.DateTime.now().toUTC();
                    var timeSincePreliminary = now.diff(preliminaryReportTime, 'hours').hours;
                    var finalReport = relatedDiagnosticReports.find(function (r) { return r.status === 'final' || r.status === 'amended' || r.status === 'corrected'; });
                    if (preliminaryReport && !finalReport && timeSincePreliminary > 24) {
                        return {
                            serviceRequestId: serviceRequest.id,
                            patientName: patientName,
                            appointmentId: appointmentId,
                        };
                    }
                    return undefined;
                })
                    .filter(function (maybeStudyReportItem) { return maybeStudyReportItem !== undefined; });
                if (studiesAwaitingFinalReportMoreThan24Hours.length > 0) {
                    outputStrings_1 = '';
                    outputStrings_1 += 'Studies awaiting final report for more than 24 hours:';
                    studiesAwaitingFinalReportMoreThan24Hours.forEach(function (study) {
                        outputStrings_1 += "\nServiceRequest/".concat(study.serviceRequestId, ", Patient: ").concat(study.patientName || 'Unknown', ", Appointment ID: ").concat(study.appointmentId);
                    });
                    console.log(outputStrings_1);
                    throw new Error(outputStrings_1);
                }
                else {
                    console.log('No studies are awaiting final report for more than 24 hours.');
                }
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({}),
                    }];
            case 8:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_2.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });

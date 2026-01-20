"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.makeRelatedForLabsPDFDocRef = void 0;
exports.getLabFileName = getLabFileName;
exports.createExternalLabResultPDFBasedOnDr = createExternalLabResultPDFBasedOnDr;
exports.createExternalLabResultPDF = createExternalLabResultPDF;
exports.createInHouseLabResultPDF = createInHouseLabResultPDF;
exports.makeLabPdfDocumentReference = makeLabPdfDocumentReference;
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var in_house_labs_1 = require("../../ehr/shared/in-house-labs");
var labs_1 = require("../../ehr/shared/labs");
var helpers_1 = require("../../ehr/submit-lab-order/helpers");
var presigned_file_urls_1 = require("../presigned-file-urls");
var z3Utils_1 = require("../z3Utils");
var lab_pdf_utils_1 = require("./lab-pdf-utils");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
var getResultDataConfigForDrResources = function (specificResourceConfig, type) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    console.log('configuring diagnostic report result data to create pdf');
    var now = luxon_1.DateTime.now();
    var specificResources = specificResourceConfig.specificResources;
    console.log('configuring data for drawing pdf');
    var testName = specificResources.testName, diagnosticReport = specificResources.diagnosticReport, patient = specificResources.patient, externalLabResults = specificResources.externalLabResults, reviewed = specificResources.reviewed, reviewingProvider = specificResources.reviewingProvider, reviewDate = specificResources.reviewDate, resultsReceivedDate = specificResources.resultsReceivedDate, resultInterpretations = specificResources.resultInterpretations, attachments = specificResources.attachments, collectionDate = specificResources.collectionDate;
    var baseData = __assign(__assign({ locationName: undefined, locationStreetAddress: undefined, locationCity: undefined, locationState: undefined, locationZip: undefined, locationPhone: undefined, locationFax: undefined }, getProviderNameAndNpiFromDr(diagnosticReport)), { patientFirstName: ((_b = (_a = patient.name) === null || _a === void 0 ? void 0 : _a[0].given) === null || _b === void 0 ? void 0 : _b[0]) || '', patientMiddleName: (_d = (_c = patient.name) === null || _c === void 0 ? void 0 : _c[0].given) === null || _d === void 0 ? void 0 : _d[1], patientLastName: ((_e = patient.name) === null || _e === void 0 ? void 0 : _e[0].family) || '', patientSex: patient.gender || '', patientDOB: patient.birthDate ? luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy') : '', patientId: patient.id || '', patientPhone: (0, utils_1.formatPhoneNumberDisplay)(((_g = (_f = patient.telecom) === null || _f === void 0 ? void 0 : _f.find(function (telecomTemp) { return telecomTemp.system === 'phone'; })) === null || _g === void 0 ? void 0 : _g.value) || ''), todayDate: now.setZone().toFormat(helpers_1.LABS_DATE_STRING_FORMAT), dateIncludedInFileName: diagnosticReport.effectiveDateTime || '', orderPriority: '', testName: testName || '', orderAssessments: [], resultStatus: diagnosticReport.status.toUpperCase(), isPscOrder: false, accountNumber: getAccountNumberFromDr(diagnosticReport) || '', resultSpecimenInfo: getResultSpecimenFromDr(diagnosticReport), patientVisitNote: (_j = (_h = diagnosticReport.extension) === null || _h === void 0 ? void 0 : _h.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_PATIENT_VISIT_NOTE_EXT_URL; })) === null || _j === void 0 ? void 0 : _j.valueString, clinicalInfo: (_l = (_k = diagnosticReport.extension) === null || _k === void 0 ? void 0 : _k.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_CLINICAL_INFO_EXT_URL; })) === null || _l === void 0 ? void 0 : _l.valueString, fastingStatus: (_o = (_m = diagnosticReport.extension) === null || _m === void 0 ? void 0 : _m.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_FASTING_STATUS_EXT_URL; })) === null || _o === void 0 ? void 0 : _o.valueString });
    var unsolicitedResultData = {
        accessionNumber: ((_q = (_p = diagnosticReport.identifier) === null || _p === void 0 ? void 0 : _p.find(function (item) { var _a, _b; return ((_b = (_a = item.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) === 'FILL'; })) === null || _q === void 0 ? void 0 : _q.value) || '',
        alternatePlacerId: (0, utils_1.getAdditionalPlacerId)(diagnosticReport),
        reviewed: reviewed,
        reviewingProvider: reviewingProvider,
        reviewDate: reviewDate,
        resultInterpretations: resultInterpretations,
        attachments: attachments,
        externalLabResults: externalLabResults,
        testItemCode: (0, utils_1.getTestItemCodeFromDr)(diagnosticReport) || '',
        resultsReceivedDate: resultsReceivedDate,
        collectionDate: collectionDate,
    };
    if (type === utils_1.LabType.reflex) {
        console.log('reflex result pdf to be made');
        var orderNumber = (0, utils_1.getOrderNumberFromDr)(diagnosticReport) || '';
        var reflexResultData = __assign(__assign({}, unsolicitedResultData), { orderNumber: orderNumber });
        var data = __assign(__assign({}, baseData), reflexResultData);
        var config = { type: type, data: data };
        return config;
    }
    else if (type === utils_1.LabType.unsolicited) {
        console.log('unsolicited result pdf to be made');
        var data = __assign(__assign({}, baseData), unsolicitedResultData);
        var config = { type: type, data: data };
        return config;
    }
    throw Error("an unexpected type was passed: ".concat(type));
};
var getResultDataConfig = function (commonResourceConfig, specificResourceConfig) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    console.log('configuring data to create pdf');
    var config;
    var now = luxon_1.DateTime.now();
    var location = commonResourceConfig.location, timezone = commonResourceConfig.timezone, serviceRequest = commonResourceConfig.serviceRequest, patient = commonResourceConfig.patient, diagnosticReport = commonResourceConfig.diagnosticReport, providerName = commonResourceConfig.providerName, providerNPI = commonResourceConfig.providerNPI, testName = commonResourceConfig.testName;
    var type = specificResourceConfig.type, specificResources = specificResourceConfig.specificResources;
    var baseData = {
        locationName: location === null || location === void 0 ? void 0 : location.name,
        locationStreetAddress: (_b = (_a = location === null || location === void 0 ? void 0 : location.address) === null || _a === void 0 ? void 0 : _a.line) === null || _b === void 0 ? void 0 : _b.join(','),
        locationCity: (_c = location === null || location === void 0 ? void 0 : location.address) === null || _c === void 0 ? void 0 : _c.city,
        locationState: (_d = location === null || location === void 0 ? void 0 : location.address) === null || _d === void 0 ? void 0 : _d.state,
        locationZip: (_e = location === null || location === void 0 ? void 0 : location.address) === null || _e === void 0 ? void 0 : _e.postalCode,
        locationPhone: (0, utils_1.formatPhoneNumberDisplay)(((_g = (_f = location === null || location === void 0 ? void 0 : location.telecom) === null || _f === void 0 ? void 0 : _f.find(function (t) { return t.system === 'phone'; })) === null || _g === void 0 ? void 0 : _g.value) || '') || undefined,
        locationFax: (_j = (_h = location === null || location === void 0 ? void 0 : location.telecom) === null || _h === void 0 ? void 0 : _h.find(function (t) { return t.system === 'fax'; })) === null || _j === void 0 ? void 0 : _j.value,
        providerName: providerName || '',
        providerNPI: (providerNPI || ''),
        patientFirstName: ((_l = (_k = patient.name) === null || _k === void 0 ? void 0 : _k[0].given) === null || _l === void 0 ? void 0 : _l[0]) || '',
        patientMiddleName: (_o = (_m = patient.name) === null || _m === void 0 ? void 0 : _m[0].given) === null || _o === void 0 ? void 0 : _o[1],
        patientLastName: ((_p = patient.name) === null || _p === void 0 ? void 0 : _p[0].family) || '',
        patientSex: patient.gender || '',
        patientDOB: patient.birthDate ? luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy') : '',
        patientId: patient.id || '',
        patientPhone: (0, utils_1.formatPhoneNumberDisplay)(((_r = (_q = patient.telecom) === null || _q === void 0 ? void 0 : _q.find(function (telecomTemp) { return telecomTemp.system === 'phone'; })) === null || _r === void 0 ? void 0 : _r.value) || ''),
        todayDate: now.setZone().toFormat(helpers_1.LABS_DATE_STRING_FORMAT),
        dateIncludedInFileName: serviceRequest.authoredOn || '',
        orderPriority: serviceRequest.priority || '',
        testName: testName || '',
        orderAssessments: ((_s = serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.reasonCode) === null || _s === void 0 ? void 0 : _s.map(function (code) {
            var _a;
            return ({
                code: ((_a = code.coding) === null || _a === void 0 ? void 0 : _a[0].code) || '',
                name: code.text || '',
            });
        })) || [],
        resultStatus: diagnosticReport.status.toUpperCase(),
        isPscOrder: (0, utils_1.isPSCOrder)(serviceRequest),
        accountNumber: getAccountNumberFromDr(diagnosticReport) || '',
        resultSpecimenInfo: getResultSpecimenFromDr(diagnosticReport),
        patientVisitNote: (_u = (_t = diagnosticReport.extension) === null || _t === void 0 ? void 0 : _t.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_PATIENT_VISIT_NOTE_EXT_URL; })) === null || _u === void 0 ? void 0 : _u.valueString,
        clinicalInfo: (_w = (_v = diagnosticReport.extension) === null || _v === void 0 ? void 0 : _v.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_CLINICAL_INFO_EXT_URL; })) === null || _w === void 0 ? void 0 : _w.valueString,
        fastingStatus: (_y = (_x = diagnosticReport.extension) === null || _x === void 0 ? void 0 : _x.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_FASTING_STATUS_EXT_URL; })) === null || _y === void 0 ? void 0 : _y.valueString,
    };
    if (type === utils_1.LabType.inHouse) {
        var inHouseLabResults = specificResources.inHouseLabResults;
        var orderCreateDate = serviceRequest.authoredOn
            ? luxon_1.DateTime.fromISO(serviceRequest.authoredOn).setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT)
            : '';
        var inHouseData = {
            inHouseLabResults: inHouseLabResults,
            timezone: timezone,
            serviceRequestID: serviceRequest.id || '',
            orderCreateDate: orderCreateDate,
        };
        var data = __assign(__assign({}, baseData), inHouseData);
        config = { type: utils_1.LabType.inHouse, data: data };
    }
    if (type === utils_1.LabType.external) {
        var externalLabResults = specificResources.externalLabResults, collectionDate = specificResources.collectionDate, orderSubmitDate = specificResources.orderSubmitDate, reviewed = specificResources.reviewed, reviewingProvider = specificResources.reviewingProvider, reviewDate = specificResources.reviewDate, resultsReceivedDate = specificResources.resultsReceivedDate, resultInterpretations = specificResources.resultInterpretations, attachments = specificResources.attachments;
        var orderNumber = (0, utils_1.getOrderNumber)(serviceRequest);
        if (!orderNumber) {
            throw Error("requisition number could not be parsed from the service request ".concat(serviceRequest.id));
        }
        var externalLabData = {
            orderNumber: orderNumber,
            alternatePlacerId: (0, utils_1.getAdditionalPlacerId)(diagnosticReport),
            accessionNumber: ((_0 = (_z = diagnosticReport.identifier) === null || _z === void 0 ? void 0 : _z.find(function (item) { var _a, _b; return ((_b = (_a = item.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) === 'FILL'; })) === null || _0 === void 0 ? void 0 : _0.value) || '',
            collectionDate: collectionDate,
            orderSubmitDate: orderSubmitDate,
            reviewed: reviewed,
            reviewingProvider: reviewingProvider,
            reviewDate: reviewDate,
            resultInterpretations: resultInterpretations,
            attachments: attachments,
            externalLabResults: externalLabResults,
            testItemCode: (0, utils_1.getTestItemCodeFromDr)(diagnosticReport) || '',
            resultsReceivedDate: resultsReceivedDate,
        };
        var data = __assign(__assign({}, baseData), externalLabData);
        config = { type: utils_1.LabType.external, data: data };
    }
    if (!config)
        throw new Error("no config could be formed for this lab result, type: ".concat(type, ", serviceRequest Id: ").concat(serviceRequest.id, " "));
    return config;
};
function getLabFileName(labName) {
    return labName.replace(/ /g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}
var getTaskCompletedByAndWhen = function (oystehr, task) { return __awaiter(void 0, void 0, void 0, function () {
    var provenanceId, provenanceRequestTemp, taskProvenanceTemp, taskPractitionersTemp, taskProvenance, taskPractitioner, reviewDate;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log('getting provenance for task', task.id);
                console.log('task relevant history', task.relevantHistory);
                provenanceId = (_b = (_a = task.relevantHistory) === null || _a === void 0 ? void 0 : _a[0].reference) === null || _b === void 0 ? void 0 : _b.replace('Provenance/', '');
                console.log('provenance id', provenanceId);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Provenance',
                        params: [
                            {
                                name: '_id',
                                value: provenanceId || '',
                            },
                            {
                                name: '_include',
                                value: 'Provenance:agent',
                            },
                        ],
                    })];
            case 1:
                provenanceRequestTemp = (_c = (_d.sent())) === null || _c === void 0 ? void 0 : _c.unbundle();
                taskProvenanceTemp = provenanceRequestTemp === null || provenanceRequestTemp === void 0 ? void 0 : provenanceRequestTemp.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Provenance'; });
                taskPractitionersTemp = provenanceRequestTemp === null || provenanceRequestTemp === void 0 ? void 0 : provenanceRequestTemp.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Practitioner'; });
                if (taskProvenanceTemp.length !== 1)
                    throw new Error('provenance is not found');
                if (taskPractitionersTemp.length !== 1)
                    throw new Error('practitioner is not found');
                taskProvenance = taskProvenanceTemp[0];
                taskPractitioner = taskPractitionersTemp[0];
                reviewDate = luxon_1.DateTime.fromISO(taskProvenance.recorded);
                return [2 /*return*/, {
                        reviewingProvider: taskPractitioner,
                        reviewDate: reviewDate,
                    }];
        }
    });
}); };
function createExternalLabResultPDFBasedOnDr(oystehr, type, diagnosticReportID, reviewed, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, patient, diagnosticReport, observations, schedule, _b, reviewingProvider, reviewDate, externalLabResults, resultsReceivedDate, resultInterpretationDisplays, obsAttachments, timezone, collectionTimeFromDr, collectionDate, externalSpecificResources, dataConfig, pdfDetail;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, (0, labs_1.getExternalLabOrderResourcesViaDiagnosticReport)(oystehr, diagnosticReportID)];
                case 1:
                    _a = _e.sent(), patient = _a.patient, diagnosticReport = _a.diagnosticReport, observations = _a.observations, schedule = _a.schedule;
                    if (!patient.id)
                        throw new Error('patient.id is undefined');
                    return [4 /*yield*/, getResultsDetailsForPDF(oystehr, diagnosticReport, observations)];
                case 2:
                    _b = _e.sent(), reviewingProvider = _b.reviewingProvider, reviewDate = _b.reviewDate, externalLabResults = _b.externalLabResults, resultsReceivedDate = _b.resultsReceivedDate, resultInterpretationDisplays = _b.resultInterpretationDisplays, obsAttachments = _b.obsAttachments;
                    if (schedule) {
                        timezone = (0, utils_1.getTimezone)(schedule);
                    }
                    collectionTimeFromDr = (_c = getResultSpecimenFromDr(diagnosticReport)) === null || _c === void 0 ? void 0 : _c.collectedDateTime;
                    collectionDate = collectionTimeFromDr
                        ? luxon_1.DateTime.fromISO(collectionTimeFromDr).setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT)
                        : '';
                    externalSpecificResources = {
                        type: type,
                        specificResources: {
                            testName: (_d = diagnosticReport.code.coding) === null || _d === void 0 ? void 0 : _d[0].display,
                            patient: patient,
                            diagnosticReport: diagnosticReport,
                            externalLabResults: externalLabResults,
                            reviewed: reviewed,
                            reviewingProvider: reviewingProvider,
                            reviewDate: reviewDate === null || reviewDate === void 0 ? void 0 : reviewDate.toFormat(helpers_1.LABS_DATE_STRING_FORMAT),
                            resultsReceivedDate: resultsReceivedDate,
                            resultInterpretations: resultInterpretationDisplays,
                            attachments: obsAttachments,
                            collectionDate: collectionDate,
                        },
                    };
                    dataConfig = getResultDataConfigForDrResources(externalSpecificResources, type);
                    return [4 /*yield*/, createLabsResultsFormPDF(dataConfig, patient.id, secrets, token)];
                case 3:
                    pdfDetail = _e.sent();
                    return [4 /*yield*/, makeLabPdfDocumentReference({
                            oystehr: oystehr,
                            type: type,
                            pdfInfo: pdfDetail,
                            patientID: patient.id,
                            encounterID: undefined,
                            related: (0, exports.makeRelatedForLabsPDFDocRef)({ diagnosticReportId: diagnosticReportID }),
                            diagnosticReportID: diagnosticReportID,
                            reviewed: reviewed,
                            listResources: [],
                        })];
                case 4:
                    _e.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createExternalLabResultPDF(oystehr, serviceRequestID, diagnosticReport, reviewed, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, serviceRequest, patient, provider, pstTask, encounter, schedule, 
        // labOrganization,
        observations, specimens, locationID, location, timezone, orderSubmitDate, _b, reviewingProvider, reviewDate, externalLabResults, resultsReceivedDate, resultInterpretationDisplays, obsAttachments, sortedSpecimens, specimenCollectionDate, i, date, collectionDate, externalSpecificResources, commonResources, dataConfig, pdfDetail;
        var _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0: return [4 /*yield*/, (0, labs_1.getExternalLabOrderResourcesViaServiceRequest)(oystehr, serviceRequestID)];
                case 1:
                    _a = _j.sent(), serviceRequest = _a.serviceRequest, patient = _a.patient, provider = _a.practitioner, pstTask = _a.preSubmissionTask, encounter = _a.encounter, schedule = _a.schedule, observations = _a.observations, specimens = _a.specimens;
                    locationID = (_d = (_c = serviceRequest.locationReference) === null || _c === void 0 ? void 0 : _c[0].reference) === null || _d === void 0 ? void 0 : _d.replace('Location/', '');
                    if (!locationID) return [3 /*break*/, 3];
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Location',
                            id: locationID,
                        })];
                case 2:
                    location = _j.sent();
                    _j.label = 3;
                case 3:
                    if (schedule) {
                        timezone = (0, utils_1.getTimezone)(schedule);
                    }
                    if (!encounter.id)
                        throw new Error('encounter id is undefined');
                    if (!patient.id)
                        throw new Error('patient.id is undefined');
                    if (!diagnosticReport.id)
                        throw new Error('diagnosticReport id is undefined');
                    return [4 /*yield*/, getTaskCompletedByAndWhen(oystehr, pstTask)];
                case 4:
                    orderSubmitDate = (_j.sent()).reviewDate;
                    return [4 /*yield*/, getResultsDetailsForPDF(oystehr, diagnosticReport, observations, timezone)];
                case 5:
                    _b = _j.sent(), reviewingProvider = _b.reviewingProvider, reviewDate = _b.reviewDate, externalLabResults = _b.externalLabResults, resultsReceivedDate = _b.resultsReceivedDate, resultInterpretationDisplays = _b.resultInterpretationDisplays, obsAttachments = _b.obsAttachments;
                    sortedSpecimens = specimens === null || specimens === void 0 ? void 0 : specimens.sort(function (a, b) { var _a, _b; return (0, utils_1.compareDates)((_a = a.collection) === null || _a === void 0 ? void 0 : _a.collectedDateTime, (_b = b.collection) === null || _b === void 0 ? void 0 : _b.collectedDateTime); });
                    for (i = sortedSpecimens.length - 1; i >= 0; i--) {
                        date = (_f = (_e = sortedSpecimens[i]) === null || _e === void 0 ? void 0 : _e.collection) === null || _f === void 0 ? void 0 : _f.collectedDateTime;
                        if (date) {
                            specimenCollectionDate = date;
                            break;
                        }
                    }
                    collectionDate = specimenCollectionDate
                        ? luxon_1.DateTime.fromISO(specimenCollectionDate).setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT)
                        : '';
                    externalSpecificResources = {
                        type: utils_1.LabType.external,
                        specificResources: {
                            externalLabResults: externalLabResults,
                            collectionDate: collectionDate,
                            orderSubmitDate: orderSubmitDate.setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT),
                            reviewed: reviewed,
                            reviewingProvider: reviewingProvider,
                            reviewDate: reviewDate === null || reviewDate === void 0 ? void 0 : reviewDate.setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT),
                            resultsReceivedDate: resultsReceivedDate,
                            resultInterpretations: resultInterpretationDisplays,
                            attachments: obsAttachments,
                        },
                    };
                    commonResources = {
                        location: location,
                        timezone: timezone,
                        serviceRequest: serviceRequest,
                        patient: patient,
                        diagnosticReport: diagnosticReport,
                        providerName: (0, utils_1.getFullestAvailableName)(provider),
                        providerNPI: (_g = (0, utils_1.getPractitionerNPIIdentifier)(provider)) === null || _g === void 0 ? void 0 : _g.value,
                        testName: (_h = diagnosticReport.code.coding) === null || _h === void 0 ? void 0 : _h[0].display,
                    };
                    dataConfig = getResultDataConfig(commonResources, externalSpecificResources);
                    return [4 /*yield*/, createLabsResultsFormPDF(dataConfig, patient.id, secrets, token)];
                case 6:
                    pdfDetail = _j.sent();
                    return [4 /*yield*/, makeLabPdfDocumentReference({
                            oystehr: oystehr,
                            type: 'results',
                            pdfInfo: pdfDetail,
                            patientID: patient.id,
                            encounterID: encounter.id,
                            related: (0, exports.makeRelatedForLabsPDFDocRef)({ diagnosticReportId: diagnosticReport.id }),
                            diagnosticReportID: diagnosticReport.id,
                            reviewed: reviewed,
                            listResources: [],
                        })];
                case 7:
                    _j.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createInHouseLabResultPDF(oystehr, serviceRequest, encounter, patient, location, schedule, attendingPractitioner, attendingPractitionerName, inputRequestTask, observations, diagnosticReport, secrets, token, activityDefinition, relatedServiceRequests, specimen) {
    return __awaiter(this, void 0, void 0, function () {
        var timezone, inHouseLabResults, additionalResultsForRelatedSrs, allResults, allResultsSorted, inHouseSpecificResources, commonResources, dataConfig, pdfDetail;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('starting create in-house lab result pdf');
                    if (!encounter.id)
                        throw new Error('encounter id is undefined');
                    if (!patient.id)
                        throw new Error('patient.id is undefined');
                    timezone = undefined;
                    if (schedule) {
                        timezone = (0, utils_1.getTimezone)(schedule);
                    }
                    return [4 /*yield*/, getFormattedInHouseLabResults(oystehr, activityDefinition, observations, specimen, inputRequestTask, timezone)];
                case 1:
                    inHouseLabResults = _b.sent();
                    additionalResultsForRelatedSrs = [];
                    if (!relatedServiceRequests) return [3 /*break*/, 3];
                    console.log('configuring additional results for related tests');
                    return [4 /*yield*/, getAdditionalResultsForRelated(oystehr, relatedServiceRequests, activityDefinition, timezone)];
                case 2:
                    additionalResultsForRelatedSrs = _b.sent();
                    _b.label = 3;
                case 3:
                    allResults = __spreadArray([inHouseLabResults], additionalResultsForRelatedSrs, true);
                    allResultsSorted = allResults.sort(function (a, b) {
                        return (0, utils_1.compareDates)(a.finalResultDateTime.toISO() || '', b.finalResultDateTime.toISO() || '');
                    });
                    inHouseSpecificResources = {
                        type: utils_1.LabType.inHouse,
                        specificResources: { inHouseLabResults: allResultsSorted },
                    };
                    commonResources = {
                        location: location,
                        timezone: timezone,
                        serviceRequest: serviceRequest,
                        patient: patient,
                        diagnosticReport: diagnosticReport,
                        providerName: attendingPractitionerName,
                        providerNPI: (_a = (0, utils_1.getPractitionerNPIIdentifier)(attendingPractitioner)) === null || _a === void 0 ? void 0 : _a.value,
                        testName: activityDefinition.title,
                    };
                    dataConfig = getResultDataConfig(commonResources, inHouseSpecificResources);
                    return [4 /*yield*/, createLabsResultsFormPDF(dataConfig, patient.id, secrets, token)];
                case 4:
                    pdfDetail = _b.sent();
                    return [4 /*yield*/, makeLabPdfDocumentReference({
                            oystehr: oystehr,
                            type: 'results',
                            pdfInfo: pdfDetail,
                            patientID: patient.id,
                            encounterID: encounter.id,
                            related: (0, exports.makeRelatedForLabsPDFDocRef)({ diagnosticReportId: diagnosticReport.id || '' }),
                            diagnosticReportID: diagnosticReport.id,
                            reviewed: false,
                            listResources: [], // this needs to be passed so the helper returns docRefs
                        })];
                case 5:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getResultsDetailsForPDF(oystehr, diagnosticReport, observations, timezone) {
    return __awaiter(this, void 0, void 0, function () {
        var taskSearchForFinalOrCorrected, completedFinalOrCorrected, sortedCompletedFinalOrCorrected, latestReviewTask, reviewDate, reviewingProvider, resultsReceivedDate, resultInterpretationDisplays, externalLabResults, obsAttachments, filteredAndSortedObservations;
        var _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Task',
                        params: [
                            {
                                name: 'based-on',
                                value: "DiagnosticReport/".concat(diagnosticReport.id),
                            },
                            {
                                name: 'status',
                                value: 'completed,ready,in-progress',
                            },
                            {
                                name: 'code',
                                value: "".concat(utils_1.LAB_ORDER_TASK.code.reviewFinalResult, ",").concat(utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult),
                            },
                        ],
                    })];
                case 1:
                    taskSearchForFinalOrCorrected = (_b = (_c.sent())) === null || _b === void 0 ? void 0 : _b.unbundle();
                    completedFinalOrCorrected = taskSearchForFinalOrCorrected.reduce(function (acc, task) {
                        if (task.status === 'completed')
                            acc.push(task);
                        return acc;
                    }, []);
                    sortedCompletedFinalOrCorrected = completedFinalOrCorrected === null || completedFinalOrCorrected === void 0 ? void 0 : completedFinalOrCorrected.sort(function (a, b) {
                        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
                    });
                    latestReviewTask = sortedCompletedFinalOrCorrected[0];
                    console.log(">>> in labs-results-form-pdf, this is the latestReviewTask", latestReviewTask === null || latestReviewTask === void 0 ? void 0 : latestReviewTask.id);
                    reviewDate = undefined, reviewingProvider = undefined;
                    if (!latestReviewTask) return [3 /*break*/, 3];
                    if (!(latestReviewTask.status === 'completed')) return [3 /*break*/, 3];
                    return [4 /*yield*/, getTaskCompletedByAndWhen(oystehr, latestReviewTask)];
                case 2:
                    (_a = _c.sent(), reviewingProvider = _a.reviewingProvider, reviewDate = _a.reviewDate);
                    _c.label = 3;
                case 3:
                    resultsReceivedDate = diagnosticReport.effectiveDateTime
                        ? luxon_1.DateTime.fromISO(diagnosticReport.effectiveDateTime).setZone(timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT)
                        : '';
                    resultInterpretationDisplays = [];
                    externalLabResults = [];
                    obsAttachments = {
                        pdfAttachments: [],
                        pngAttachments: [],
                        jpgAttachments: [],
                    };
                    filteredAndSortedObservations = filterAndSortObservations(observations, diagnosticReport);
                    filteredAndSortedObservations.forEach(function (observation) {
                        var _a = parseObservationForPDF(observation, oystehr), labResult = _a.labResult, interpretationDisplay = _a.interpretationDisplay, base64PdfAttachment = _a.base64PdfAttachment, base64PngAttachment = _a.base64PngAttachment, base64JpgAttachment = _a.base64JpgAttachment;
                        externalLabResults.push(labResult);
                        if (interpretationDisplay)
                            resultInterpretationDisplays.push(interpretationDisplay);
                        if (base64PdfAttachment)
                            obsAttachments.pdfAttachments.push(base64PdfAttachment);
                        if (base64PngAttachment)
                            obsAttachments.pngAttachments.push(base64PngAttachment);
                        if (base64JpgAttachment)
                            obsAttachments.jpgAttachments.push(base64JpgAttachment);
                    });
                    return [2 /*return*/, {
                            reviewingProvider: reviewingProvider,
                            reviewDate: reviewDate,
                            resultsReceivedDate: resultsReceivedDate,
                            externalLabResults: externalLabResults,
                            resultInterpretationDisplays: resultInterpretationDisplays,
                            obsAttachments: obsAttachments,
                        }];
            }
        });
    });
}
var isObrNoteObs = function (obs) {
    var _a;
    return !!((_a = obs.code.coding) === null || _a === void 0 ? void 0 : _a.some(function (c) { return c.system === utils_1.OYSTEHR_OBR_NOTE_CODING_SYSTEM; }));
};
// function to ensure the order of the observations from dr.result is preserved
function filterAndSortObservations(observations, diagnosticReport) {
    var _a;
    var obrNotes = [];
    var otherObs = [];
    (_a = diagnosticReport.result) === null || _a === void 0 ? void 0 : _a.forEach(function (obsRef) {
        var _a, _b;
        var isObs = (_a = obsRef.reference) === null || _a === void 0 ? void 0 : _a.startsWith('Observation/');
        if (isObs) {
            var obsId_1 = (_b = obsRef.reference) === null || _b === void 0 ? void 0 : _b.replace('Observation/', '');
            var fhirObs = observations.find(function (obs) { return obs.id === obsId_1; });
            if (fhirObs) {
                var isObrNote = isObrNoteObs(fhirObs);
                if (isObrNote) {
                    obrNotes.push(fhirObs);
                }
                else {
                    otherObs.push(fhirObs);
                }
            }
        }
    });
    var sortedObservations = __spreadArray(__spreadArray([], obrNotes, true), otherObs, true);
    return sortedObservations;
}
function createLabsResultsFormPdfBytes(dataConfig) {
    return __awaiter(this, void 0, void 0, function () {
        var type, data, pdfBytes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    type = dataConfig.type, data = dataConfig.data;
                    if (!(type === utils_1.LabType.unsolicited || type === utils_1.LabType.reflex || type === utils_1.LabType.external)) return [3 /*break*/, 2];
                    console.log('Getting pdf bytes for general external lab results');
                    return [4 /*yield*/, setUpAndDrawAllExternalLabResultTypesFormPdfBytes(dataConfig)];
                case 1:
                    pdfBytes = _a.sent();
                    return [3 /*break*/, 4];
                case 2:
                    if (!(type === utils_1.LabType.inHouse)) return [3 /*break*/, 4];
                    console.log('Getting pdf bytes for in house lab results');
                    return [4 /*yield*/, createInHouseLabsResultsFormPdfBytes(data)];
                case 3:
                    pdfBytes = _a.sent();
                    _a.label = 4;
                case 4:
                    if (!pdfBytes)
                        throw new Error('pdfBytes could not be drawn');
                    return [2 /*return*/, pdfBytes];
            }
        });
    });
}
/**
 * Draws Patient Info, Location Info, Big Result Header
 * @param pdfClient
 * @param textStyles
 * @param icons
 * @param data
 * @returns
 */
function drawCommonLabsElements(pdfClient, textStyles, icons, data) {
    return __awaiter(this, void 0, void 0, function () {
        var faxIcon, callIcon, locationCityStateZip, margin, iconStyleTemp;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            console.log('Drawing common elements');
            faxIcon = icons.faxIcon, callIcon = icons.callIcon;
            console.log("Drawing patient name. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            if (data.patientMiddleName) {
                pdfClient.drawText("".concat(data.patientLastName, ", ").concat(data.patientFirstName, ", ").concat(data.patientMiddleName), textStyles.textBold);
            }
            else {
                pdfClient.drawText("".concat(data.patientLastName, ", ").concat(data.patientFirstName), textStyles.textBold);
            }
            console.log("Drawing location name. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            pdfClient.drawText("".concat(utils_1.BRANDING_CONFIG.projectName ? utils_1.BRANDING_CONFIG.projectName + ' ' : '').concat(data.locationName || ''), textStyles.textBoldRight);
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            locationCityStateZip = "".concat(((_a = data.locationCity) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || '').concat(data.locationCity ? ', ' : '').concat(((_b = data.locationState) === null || _b === void 0 ? void 0 : _b.toUpperCase()) || '').concat(data.locationState ? ' ' : '').concat(((_c = data.locationZip) === null || _c === void 0 ? void 0 : _c.toUpperCase()) || '');
            console.log("Drawing patient dob and sex. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            pdfClient.drawText("".concat(data.patientDOB, ", ").concat((0, pdf_utils_1.calculateAge)(data.patientDOB), " Y, ").concat(data.patientSex), textStyles.text);
            console.log("Drawing location city, state, zip. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            pdfClient.drawText(locationCityStateZip, textStyles.textRight);
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            console.log("Drawing patient id. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            pdfClient.drawText("ID: ".concat(data.patientId), textStyles.text);
            margin = pdfClient.getRightBound() -
                pdfClient.getLeftBound() -
                pdf_consts_1.ICON_STYLE.width -
                pdfClient.getTextDimensions(" ".concat(data.locationPhone), textStyles.text).width -
                5;
            if (data.locationFax) {
                margin -= pdf_consts_1.ICON_STYLE.width + pdfClient.getTextDimensions(" ".concat(data.locationFax), textStyles.text).width + 10;
            }
            iconStyleTemp = __assign(__assign({}, pdf_consts_1.ICON_STYLE), { margin: { left: margin } });
            if (data.locationPhone) {
                console.log("Drawing phone. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                pdfClient.drawImage(callIcon, iconStyleTemp, textStyles.text);
                pdfClient.drawTextSequential(" ".concat(data.locationPhone), textStyles.text);
            }
            if (data.locationFax) {
                if (data.locationPhone) {
                    margin = 10;
                }
                else {
                    margin =
                        pdfClient.getRightBound() -
                            pdfClient.getLeftBound() -
                            pdf_consts_1.ICON_STYLE.width -
                            pdfClient.getTextDimensions(" ".concat(data.locationFax), textStyles.text).width -
                            5;
                }
                iconStyleTemp = __assign(__assign({}, iconStyleTemp), { margin: { left: margin } });
                console.log("Drawing fax. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                pdfClient.drawImage(faxIcon, iconStyleTemp, textStyles.text);
                pdfClient.drawTextSequential(" ".concat(data.locationFax), textStyles.text);
            }
            console.log("Drawing patient phone. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            pdfClient.drawText(data.patientPhone, textStyles.text);
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            console.log("Drawing result header. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
            pdfClient.drawText('RESULT STATUS:', textStyles.subHeaderRight);
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            pdfClient.drawText("".concat(data.resultStatus, " RESULT"), textStyles.headerRight);
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
            return [2 /*return*/, pdfClient];
        });
    });
}
/**
 * Draws "General Comments and Information" and related info
 * @param pdfClient
 * @param textStyles
 * @param data
 * @returns
 */
function drawCommonExternalLabElements(pdfClient, textStyles, data) {
    return __awaiter(this, void 0, void 0, function () {
        var sectionHasContent;
        return __generator(this, function (_a) {
            console.log('Drawing common external lab elements');
            pdfClient.drawText("GENERAL COMMENTS AND INFORMATION", textStyles.textBold);
            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            sectionHasContent = false;
            if (data.clinicalInfo) {
                console.log('Drawing Clinical info');
                sectionHasContent = true;
                pdfClient.drawText('Clinical Info:', textStyles.textBold);
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                // adding a little bit of a left indent for clinical info which could be multiple lines
                pdfClient.drawTextSequential(data.clinicalInfo, textStyles.text, {
                    leftBound: 50,
                    rightBound: pdfClient.getRightBound(),
                });
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            }
            if (data.fastingStatus) {
                console.log('Drawing fasting status');
                sectionHasContent = true;
                pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Fasting Status: ', data.fastingStatus);
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            }
            if (data.resultSpecimenInfo) {
                console.log('Drawing result specimen info', JSON.stringify(data.resultSpecimenInfo));
                if (data.resultSpecimenInfo.quantityString || data.resultSpecimenInfo.bodySite)
                    sectionHasContent = true;
                if (data.resultSpecimenInfo.quantityString) {
                    console.log('Drawing specimen quantity/volume info');
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Specimen Volume:', "".concat(data.resultSpecimenInfo.quantityString).concat(data.resultSpecimenInfo.unit ? " ".concat(data.resultSpecimenInfo.unit) : ''));
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                }
                if (data.resultSpecimenInfo.bodySite) {
                    console.log('Drawing specimen bodysite info');
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Specimen Source:', data.resultSpecimenInfo.bodySite);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                }
            }
            if ((data.fastingStatus || data.resultSpecimenInfo) && sectionHasContent) {
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            }
            if (data.patientVisitNote) {
                console.log('Drawing patient visit note');
                sectionHasContent = true;
                pdfClient.drawText('General Notes:', textStyles.textBold);
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                // adding a little bit of a left indent for clinical info which could be multiple lines
                pdfClient.drawTextSequential(data.patientVisitNote, textStyles.text, {
                    leftBound: lab_pdf_utils_1.LABS_PDF_LEFT_INDENTATION_XPOS,
                    rightBound: pdfClient.getRightBound(),
                });
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            }
            if (!sectionHasContent) {
                pdfClient.drawText('None', textStyles.text);
                pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
            }
            pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
            return [2 /*return*/, pdfClient];
        });
    });
}
function setUpAndDrawAllExternalLabResultTypesFormPdfBytes(dataConfig) {
    return __awaiter(this, void 0, void 0, function () {
        var data, type, clientInfo, _a, callIcon, faxIcon, textStyles, initialPageStyles, pdfClient, drawRowHelper, drawLabsHeader, pageStylesWithHeadline;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Setting up common external lab elements');
                    data = dataConfig.data, type = dataConfig.type;
                    // make typescript happy and make sure the data isn't for inHouse
                    if (type === utils_1.LabType.inHouse) {
                        console.error('Tried to make general external labs results but received in house lab data');
                        return [2 /*return*/, undefined];
                    }
                    return [4 /*yield*/, (0, lab_pdf_utils_1.getPdfClientForLabsPDFs)()];
                case 1:
                    clientInfo = _b.sent();
                    return [4 /*yield*/, (0, lab_pdf_utils_1.getPdfClientForLabsPDFs)()];
                case 2:
                    _a = _b.sent(), callIcon = _a.callIcon, faxIcon = _a.faxIcon, textStyles = _a.textStyles, initialPageStyles = _a.initialPageStyles;
                    pdfClient = clientInfo.pdfClient;
                    drawRowHelper = function (data) {
                        var wideColumn = (pdfClient.getRightBound() - pdfClient.getLeftBound() - 20) / 2;
                        var columnConstants = {
                            column1: { startXPos: pdfClient.getLeftBound(), width: wideColumn },
                            column2: { startXPos: pdfClient.getLeftBound() + wideColumn + 20, width: wideColumn },
                        };
                        pdfClient.drawVariableWidthColumns([
                            {
                                startXPos: columnConstants.column1.startXPos,
                                width: columnConstants.column1.width,
                                content: data.col1,
                                textStyle: textStyles.pageHeaderGrey,
                            },
                            {
                                startXPos: columnConstants.column2.startXPos,
                                width: columnConstants.column2.width,
                                content: data.col2,
                                textStyle: textStyles.pageHeaderGrey,
                            },
                        ], pdfClient.getY(), pdfClient.getCurrentPageIndex());
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE - 4);
                    };
                    drawLabsHeader = function () {
                        console.log("Drawing external labs header on page ".concat(pdfClient.getCurrentPageIndex() + 1, ". currYPos is ").concat(pdfClient.getY()));
                        var getReqNumOrAltFillerId = function () {
                            if (data.alternatePlacerId)
                                return data.alternatePlacerId;
                            else if (type !== utils_1.LabType.unsolicited)
                                return data.orderNumber;
                            else
                                return 'N/A';
                        };
                        drawRowHelper({
                            col1: "Patient Name: ".concat(data.patientLastName, ", ").concat(data.patientFirstName).concat(data.patientMiddleName ? ", ".concat(data.patientMiddleName) : ''),
                            col2: "Req #: ".concat(getReqNumOrAltFillerId()),
                        });
                        drawRowHelper({
                            col1: "DOB: ".concat(data.patientDOB),
                            col2: "Accession #: ".concat(data.accessionNumber),
                        });
                        drawRowHelper({
                            col1: "Age: ".concat((0, pdf_utils_1.calculateAge)(data.patientDOB), " Y"), // TODO LABS: what if this is an infant, is Y appropriate. I think the labs label has a better helper for this
                            col2: "Client ID: ".concat(data.accountNumber),
                        });
                        drawRowHelper({
                            col1: "Sex: ".concat(data.patientSex),
                            col2: "Collected Date & Time: ".concat(data.collectionDate ? data.collectionDate : ''),
                        });
                        drawRowHelper({
                            col1: "Patient ID: ".concat(data.patientId),
                            col2: "Result Status: ".concat(data.resultStatus),
                        });
                        drawRowHelper({
                            col1: "Ordering Phys.: ".concat(data.providerName),
                            col2: "Reported Date & Time: ".concat(data.resultsReceivedDate),
                        });
                        drawRowHelper({
                            col1: "NPI: ".concat(data.providerNPI),
                            col2: '',
                        });
                        pdfClient.drawSeparatedLine(__assign(__assign({}, pdf_utils_1.SEPARATED_LINE_STYLE), { thickness: 2, color: lab_pdf_utils_1.LAB_PDF_STYLES.color.purple }));
                    };
                    // We can't set this headline in initial styles, so we draw it and add
                    // it as a header for all subsequent pages to set automatically
                    drawLabsHeader();
                    pageStylesWithHeadline = __assign(__assign({}, initialPageStyles.initialPage), { setHeadline: drawLabsHeader });
                    pdfClient.setPageStyles(pageStylesWithHeadline);
                    return [4 /*yield*/, drawCommonLabsElements(pdfClient, textStyles, { callIcon: callIcon, faxIcon: faxIcon }, data)];
                case 3:
                    // Now we can actually start putting content down
                    pdfClient = _b.sent();
                    return [4 /*yield*/, drawCommonExternalLabElements(pdfClient, textStyles, data)];
                case 4:
                    pdfClient = _b.sent();
                    if (!(type === utils_1.LabType.external)) return [3 /*break*/, 6];
                    console.log('Getting pdf bytes for external lab results');
                    return [4 /*yield*/, createExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data)];
                case 5: return [2 /*return*/, _b.sent()];
                case 6:
                    if (!(type === utils_1.LabType.unsolicited || type === utils_1.LabType.reflex)) return [3 /*break*/, 8];
                    console.log('Getting pdf bytes for unsolicited or reflex external lab results');
                    return [4 /*yield*/, createDiagnosticReportExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data)];
                case 7: return [2 /*return*/, _b.sent()];
                case 8:
                    // this is an issue
                    console.error('Received unknown external lab data type. Unable to setUpAndDraw remaining content');
                    return [2 /*return*/, undefined];
            }
        });
    });
}
function createDiagnosticReportExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, _a, labResult, name_1, _b, pdfAttachments, pngAttachments, jpgAttachments, _c, pdfAttachments_1, attachmentString, _d, pngAttachments_1, pngAttachmentString, _e, jpgAttachments_1, jpgAttachmentString;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    // we may map physician info in the future
                    // console.log(
                    //   `Drawing requesting physician. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
                    // );
                    // pdfClient = drawFieldLine(pdfClient, textStyles, 'Requesting Physician:', data.providerName);
                    // pdfClient.newLine(STANDARD_NEW_LINE);
                    drawTestNameHeader(data.testName, data.testItemCode, pdfClient, textStyles);
                    console.log("Drawing results. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                    for (_i = 0, _a = data.externalLabResults; _i < _a.length; _i++) {
                        labResult = _a[_i];
                        writeResultDetailLinesInPdf(pdfClient, labResult, textStyles);
                    }
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    // Reviewed by
                    if (data.reviewed) {
                        console.log("Drawing reviewed by. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                        pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        name_1 = data.reviewingProvider ? (0, utils_1.getFullestAvailableName)(data.reviewingProvider) : '';
                        pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, "Reviewed: ".concat(data.reviewDate, " by"), name_1 || '');
                    }
                    _b = data.attachments, pdfAttachments = _b.pdfAttachments, pngAttachments = _b.pngAttachments, jpgAttachments = _b.jpgAttachments;
                    if (!(pdfAttachments.length > 0)) return [3 /*break*/, 4];
                    _c = 0, pdfAttachments_1 = pdfAttachments;
                    _f.label = 1;
                case 1:
                    if (!(_c < pdfAttachments_1.length)) return [3 /*break*/, 4];
                    attachmentString = pdfAttachments_1[_c];
                    return [4 /*yield*/, pdfClient.embedPdfFromBase64(attachmentString)];
                case 2:
                    _f.sent();
                    _f.label = 3;
                case 3:
                    _c++;
                    return [3 /*break*/, 1];
                case 4:
                    if (!(pngAttachments.length > 0)) return [3 /*break*/, 8];
                    _d = 0, pngAttachments_1 = pngAttachments;
                    _f.label = 5;
                case 5:
                    if (!(_d < pngAttachments_1.length)) return [3 /*break*/, 8];
                    pngAttachmentString = pngAttachments_1[_d];
                    return [4 /*yield*/, pdfClient.embedImageFromBase64(pngAttachmentString, 'PNG')];
                case 6:
                    _f.sent();
                    _f.label = 7;
                case 7:
                    _d++;
                    return [3 /*break*/, 5];
                case 8:
                    if (!(jpgAttachments.length > 0)) return [3 /*break*/, 12];
                    _e = 0, jpgAttachments_1 = jpgAttachments;
                    _f.label = 9;
                case 9:
                    if (!(_e < jpgAttachments_1.length)) return [3 /*break*/, 12];
                    jpgAttachmentString = jpgAttachments_1[_e];
                    return [4 /*yield*/, pdfClient.embedImageFromBase64(jpgAttachmentString, 'JPG')];
                case 10:
                    _f.sent();
                    _f.label = 11;
                case 11:
                    _e++;
                    return [3 /*break*/, 9];
                case 12:
                    pdfClient.numberPages(textStyles.pageNumber);
                    return [4 /*yield*/, pdfClient.save()];
                case 13: return [2 /*return*/, _f.sent()];
            }
        });
    });
}
function createExternalLabsResultsFormPdfBytes(pdfClient, textStyles, data) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, _a, labResult, name_2, _b, pdfAttachments, pngAttachments, jpgAttachments, _c, pdfAttachments_2, attachmentString, _d, pngAttachments_2, pngAttachmentString, _e, jpgAttachments_2, jpgAttachmentString;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    console.log("Drawing diagnoses. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Dx:', data.orderAssessments.map(function (assessment) { return "".concat(assessment.code, " (").concat(assessment.name, ")"); }).join('; '));
                    drawTestNameHeader(data.testName, data.testItemCode, pdfClient, textStyles);
                    console.log("Drawing results. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                    for (_i = 0, _a = data.externalLabResults; _i < _a.length; _i++) {
                        labResult = _a[_i];
                        writeResultDetailLinesInPdf(pdfClient, labResult, textStyles);
                    }
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                    // Reviewed by
                    if (data.reviewed) {
                        console.log("Drawing reviewed by. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
                        pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        name_2 = data.reviewingProvider ? (0, utils_1.getFullestAvailableName)(data.reviewingProvider) : '';
                        pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, "Reviewed: ".concat(data.reviewDate, " by"), name_2 || '');
                    }
                    _b = data.attachments, pdfAttachments = _b.pdfAttachments, pngAttachments = _b.pngAttachments, jpgAttachments = _b.jpgAttachments;
                    if (!(pdfAttachments.length > 0)) return [3 /*break*/, 4];
                    _c = 0, pdfAttachments_2 = pdfAttachments;
                    _f.label = 1;
                case 1:
                    if (!(_c < pdfAttachments_2.length)) return [3 /*break*/, 4];
                    attachmentString = pdfAttachments_2[_c];
                    return [4 /*yield*/, pdfClient.embedPdfFromBase64(attachmentString)];
                case 2:
                    _f.sent();
                    _f.label = 3;
                case 3:
                    _c++;
                    return [3 /*break*/, 1];
                case 4:
                    if (!(pngAttachments.length > 0)) return [3 /*break*/, 8];
                    _d = 0, pngAttachments_2 = pngAttachments;
                    _f.label = 5;
                case 5:
                    if (!(_d < pngAttachments_2.length)) return [3 /*break*/, 8];
                    pngAttachmentString = pngAttachments_2[_d];
                    return [4 /*yield*/, pdfClient.embedImageFromBase64(pngAttachmentString, 'PNG')];
                case 6:
                    _f.sent();
                    _f.label = 7;
                case 7:
                    _d++;
                    return [3 /*break*/, 5];
                case 8:
                    if (!(jpgAttachments.length > 0)) return [3 /*break*/, 12];
                    _e = 0, jpgAttachments_2 = jpgAttachments;
                    _f.label = 9;
                case 9:
                    if (!(_e < jpgAttachments_2.length)) return [3 /*break*/, 12];
                    jpgAttachmentString = jpgAttachments_2[_e];
                    return [4 /*yield*/, pdfClient.embedImageFromBase64(jpgAttachmentString, 'JPG')];
                case 10:
                    _f.sent();
                    _f.label = 11;
                case 11:
                    _e++;
                    return [3 /*break*/, 9];
                case 12:
                    pdfClient.numberPages(textStyles.pageNumber);
                    return [4 /*yield*/, pdfClient.save()];
                case 13: return [2 /*return*/, _f.sent()];
            }
        });
    });
}
function createInHouseLabsResultsFormPdfBytes(data) {
    return __awaiter(this, void 0, void 0, function () {
        var clientInfo, _a, callIcon, faxIcon, textStyles, pdfClient, _i, _b, labResult, resultHasUnits, _c, _d, resultDetail, resultRange, valueStringToWrite;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, (0, lab_pdf_utils_1.getPdfClientForLabsPDFs)()];
                case 1:
                    clientInfo = _e.sent();
                    return [4 /*yield*/, (0, lab_pdf_utils_1.getPdfClientForLabsPDFs)()];
                case 2:
                    _a = _e.sent(), callIcon = _a.callIcon, faxIcon = _a.faxIcon, textStyles = _a.textStyles;
                    pdfClient = clientInfo.pdfClient;
                    return [4 /*yield*/, drawCommonLabsElements(pdfClient, textStyles, { callIcon: callIcon, faxIcon: faxIcon }, data)];
                case 3:
                    pdfClient = _e.sent();
                    // Order details
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Order Number:', data.serviceRequestID);
                    pdfClient.newLine(pdf_consts_1.STANDARD_FONT_SIZE + 4);
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Ordering Physician:', data.providerName);
                    pdfClient.newLine(pdf_consts_1.STANDARD_FONT_SIZE + 4);
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Order Date:', data.orderCreateDate);
                    pdfClient.newLine(pdf_consts_1.STANDARD_FONT_SIZE + 4);
                    pdfClient.drawText('IQC Valid', textStyles.textBold);
                    pdfClient.newLine(pdf_consts_1.STANDARD_FONT_SIZE + 4);
                    pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                    pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Dx:', data.orderAssessments.length
                        ? data.orderAssessments.map(function (assessment) { return "".concat(assessment.code, " (").concat(assessment.name, ")"); }).join('; ')
                        : 'Not specified');
                    pdfClient.newLine(30);
                    for (_i = 0, _b = data.inHouseLabResults; _i < _b.length; _i++) {
                        labResult = _b[_i];
                        pdfClient.drawText(labResult.testName.toUpperCase(), textStyles.header);
                        pdfClient = (0, lab_pdf_utils_1.drawFieldLine)(pdfClient, textStyles, 'Specimen source:', labResult.specimenSource);
                        pdfClient.newLine(pdf_consts_1.STANDARD_FONT_SIZE);
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                        resultHasUnits = labResult.results.some(function (result) { return result.units; });
                        pdfClient = (0, lab_pdf_utils_1.drawFourColumnText)(pdfClient, textStyles, { name: 'NAME', startXPos: 0 }, { name: 'VALUE', startXPos: 230 }, { name: resultHasUnits ? 'UNITS' : '', startXPos: 350 }, { name: 'REFERENCE RANGE', startXPos: 410 });
                        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                        pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                        for (_c = 0, _d = labResult.results; _c < _d.length; _c++) {
                            resultDetail = _d[_c];
                            resultRange = undefined;
                            if (resultDetail.rangeString) {
                                resultRange = resultDetail.rangeString.join(', ');
                            }
                            else if (resultDetail.rangeQuantity) {
                                resultRange = (0, utils_1.quantityRangeFormat)(resultDetail.rangeQuantity);
                            }
                            else {
                                resultRange = '';
                            }
                            valueStringToWrite = resultDetail.value === utils_1.IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode ? 'Inconclusive' : resultDetail.value;
                            pdfClient = (0, lab_pdf_utils_1.drawFourColumnText)(pdfClient, textStyles, { name: resultDetail.name, startXPos: 0 }, { name: valueStringToWrite || '', startXPos: 230 }, { name: resultDetail.units || '', startXPos: 350 }, { name: resultRange, startXPos: 410 }, getInHouseResultRowDisplayColor(resultDetail));
                            pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                            pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
                        }
                        pdfClient = (0, lab_pdf_utils_1.drawFieldLineRight)(pdfClient, textStyles, 'Collection Date:', labResult.collectionDate);
                        pdfClient.newLine(pdf_consts_1.STANDARD_FONT_SIZE + 3);
                        pdfClient = (0, lab_pdf_utils_1.drawFieldLineRight)(pdfClient, textStyles, 'Results Date:', labResult.finalResultDateTime.setZone(data.timezone).toFormat(helpers_1.LABS_DATE_STRING_FORMAT));
                        pdfClient.newLine(24);
                    }
                    pdfClient.numberPages(textStyles.pageNumber);
                    return [4 /*yield*/, pdfClient.save()];
                case 4: return [2 /*return*/, _e.sent()];
            }
        });
    });
}
// function getResultValueToDisplay(resultInterpretations: string[]): string {
//   const resultInterpretationsLen = resultInterpretations?.length;
//   if (resultInterpretationsLen === 0) {
//     return '';
//   }
//   if (resultInterpretationsLen === 1) {
//     return resultInterpretations[0].toUpperCase();
//   } else {
//     return 'See below for details';
//   }
// }
function getResultRowDisplayColor(resultInterpretations) {
    if (resultInterpretations.every(function (interpretation) { return interpretation.toUpperCase() === 'NORMAL'; })) {
        // return colors.black;
        return lab_pdf_utils_1.LAB_PDF_STYLES.color.black;
    }
    else {
        return lab_pdf_utils_1.LAB_PDF_STYLES.color.red;
    }
}
function getInHouseResultRowDisplayColor(labResult) {
    console.log('>>>in getInHouseResultRowDisplayColor, this is the result', labResult);
    var interpretationCoding = labResult.interpretationCoding;
    if ((interpretationCoding === null || interpretationCoding === void 0 ? void 0 : interpretationCoding.code) === utils_1.OBSERVATION_CODES.ABNORMAL) {
        return lab_pdf_utils_1.LAB_PDF_STYLES.color.red;
    }
    return lab_pdf_utils_1.LAB_PDF_STYLES.color.black;
}
function uploadPDF(pdfBytes, token, baseFileUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var presignedUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(token, baseFileUrl, 'upload')];
                case 1:
                    presignedUrl = _a.sent();
                    return [4 /*yield*/, (0, z3Utils_1.uploadObjectToZ3)(pdfBytes, presignedUrl)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createLabsResultsFormPDF(dataConfig, patientID, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, bucketName, fileName, type, data, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Creating labs order form pdf bytes');
                    return [4 /*yield*/, createLabsResultsFormPdfBytes(dataConfig).catch(function (error) {
                            throw new Error('failed creating labs order form pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    console.debug("Created external labs order form pdf bytes");
                    bucketName = utils_1.BUCKET_NAMES.LABS;
                    fileName = undefined;
                    type = dataConfig.type, data = dataConfig.data;
                    if (type === utils_1.LabType.external || type === utils_1.LabType.unsolicited || type === utils_1.LabType.reflex) {
                        fileName = generateLabResultFileName(type, dataConfig.data.testName, dataConfig.data.dateIncludedInFileName, data.resultStatus, !!data.reviewed);
                    }
                    else if (type === 'in-house') {
                        fileName = "".concat(utils_1.IN_HOUSE_LAB_RESULT_PDF_BASE_NAME, "-").concat(getLabFileName(dataConfig.data.testName), "-").concat(luxon_1.DateTime.fromISO(dataConfig.data.dateIncludedInFileName).toFormat('yyyy-MM-dd'), "-").concat(dataConfig.data.resultStatus, ".pdf");
                    }
                    else {
                        throw new Error("lab type is unexpected ".concat(type));
                    }
                    console.log('Creating base file url');
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, fileName: fileName, bucketName: bucketName, patientID: patientID });
                    console.log('Uploading file to bucket');
                    return [4 /*yield*/, uploadPDF(pdfBytes, token, baseFileUrl).catch(function (error) {
                            throw new Error('failed uploading pdf to z3: ' + error.message);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
function generateLabResultFileName(type, testName, dateIncludedInFileName, resultStatus, reviewed) {
    var typeForUrl = (function () {
        switch (type) {
            case 'unsolicited':
                return 'Unsolicited-';
            case 'reflex':
                return 'Reflex-';
            default:
                return '';
        }
    })();
    var formattedTestName = testName ? "-".concat(getLabFileName(testName)) : '';
    var formattedDate = dateIncludedInFileName
        ? "-".concat(luxon_1.DateTime.fromISO(dateIncludedInFileName).toFormat('yyyy-MM-dd'))
        : '';
    var reviewStatus = (function () {
        if (resultStatus === 'preliminary')
            return '';
        // cSpell:disable-next unreviewed
        return reviewed ? '-reviewed' : '-unreviewed';
    })();
    return "".concat(typeForUrl).concat(utils_1.EXTERNAL_LAB_RESULT_PDF_BASE_NAME).concat(formattedTestName).concat(formattedDate, "-").concat(resultStatus).concat(reviewStatus, ".pdf");
}
function makeLabPdfDocumentReference(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var typeIsLabDrTypeTagCode, docType, searchParams, docRefContext, docRefs;
        var _c;
        var oystehr = _b.oystehr, type = _b.type, pdfInfo = _b.pdfInfo, patientID = _b.patientID, encounterID = _b.encounterID, related = _b.related, listResources = _b.listResources, diagnosticReportID = _b.diagnosticReportID, reviewed = _b.reviewed;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    typeIsLabDrTypeTagCode = (0, labs_1.isLabDrTypeTagCode)(type);
                    if (!typeIsLabDrTypeTagCode && !encounterID) {
                        throw Error('encounterID is required for solicited results and order document references');
                    }
                    if (type === 'results' || typeIsLabDrTypeTagCode) {
                        docType = {
                            coding: [utils_1.LAB_RESULT_DOC_REF_CODING_CODE],
                            text: 'Lab result document',
                        };
                    }
                    else if (type === 'order') {
                        docType = {
                            coding: [utils_1.LAB_ORDER_DOC_REF_CODING_CODE],
                            text: 'Lab order document',
                        };
                    }
                    else {
                        throw new Error('Invalid type of lab document');
                    }
                    searchParams = diagnosticReportID ? [{ name: 'related', value: "DiagnosticReport/".concat(diagnosticReportID) }] : [];
                    docRefContext = {
                        related: related,
                    };
                    if (encounterID) {
                        docRefContext.encounter = [{ reference: "Encounter/".concat(encounterID) }];
                    }
                    return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                            files: [
                                {
                                    url: pdfInfo.uploadURL,
                                    title: pdfInfo.title,
                                },
                            ],
                            type: docType,
                            references: {
                                subject: {
                                    reference: "Patient/".concat(patientID),
                                },
                                context: docRefContext,
                            },
                            docStatus: !reviewed ? 'preliminary' : 'final',
                            dateCreated: (_c = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _c !== void 0 ? _c : '',
                            oystehr: oystehr,
                            generateUUID: crypto_1.randomUUID,
                            searchParams: searchParams,
                            listResources: listResources,
                        })];
                case 1:
                    docRefs = (_d.sent()).docRefs;
                    return [2 /*return*/, docRefs[0]];
            }
        });
    });
}
var makeRelatedForLabsPDFDocRef = function (input) {
    if ('serviceRequestIds' in input) {
        return input.serviceRequestIds.map(function (id) { return ({
            reference: "ServiceRequest/".concat(id),
        }); });
    }
    else {
        return [
            {
                reference: "DiagnosticReport/".concat(input.diagnosticReportId),
            },
        ];
    }
};
exports.makeRelatedForLabsPDFDocRef = makeRelatedForLabsPDFDocRef;
var getFormattedInHouseLabResults = function (oystehr, activityDefinition, observations, specimen, task, timezone) { return __awaiter(void 0, void 0, void 0, function () {
    var specimenSource, finalResultDateTime, collectionDate, results, components, componentsAll, interpretationByComponentIdMap, resultConfig;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                if (!((_a = specimen === null || specimen === void 0 ? void 0 : specimen.collection) === null || _a === void 0 ? void 0 : _a.collectedDateTime)) {
                    throw new Error('in-house lab collection date is not defined');
                }
                specimenSource = ((_d = (_c = (_b = specimen === null || specimen === void 0 ? void 0 : specimen.collection) === null || _b === void 0 ? void 0 : _b.bodySite) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.map(function (coding) { return coding.display; }).join(', ')) || '';
                return [4 /*yield*/, getTaskCompletedByAndWhen(oystehr, task)];
            case 1:
                finalResultDateTime = (_f.sent()).reviewDate;
                collectionDate = luxon_1.DateTime.fromISO((_e = specimen === null || specimen === void 0 ? void 0 : specimen.collection) === null || _e === void 0 ? void 0 : _e.collectedDateTime)
                    .setZone(timezone)
                    .toFormat(helpers_1.LABS_DATE_STRING_FORMAT);
                results = [];
                components = (0, utils_1.convertActivityDefinitionToTestItem)(activityDefinition, observations).components;
                componentsAll = __spreadArray(__spreadArray([], components.radioComponents, true), components.groupedComponents, true);
                interpretationByComponentIdMap = new Map(observations
                    .map(function (ob) {
                    var _a, _b, _c, _d;
                    var componentId = (_c = (_b = (_a = ob.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.IN_HOUSE_OBS_DEF_ID_SYSTEM && ext.valueString; })) === null || _b === void 0 ? void 0 : _b.valueString) === null || _c === void 0 ? void 0 : _c.replace(/^#/, '');
                    console.log('this is the componentId for the map', componentId);
                    if (!componentId)
                        return undefined;
                    var interpretationCoding = (_d = ob.interpretation) === null || _d === void 0 ? void 0 : _d.flatMap(function (interp) { var _a; return (_a = interp.coding) !== null && _a !== void 0 ? _a : []; }).find(function (coding) { return coding.system === utils_1.OBSERVATION_INTERPRETATION_SYSTEM; });
                    return [componentId, interpretationCoding];
                })
                    .filter(function (entry) { return entry !== undefined; }));
                componentsAll.forEach(function (item) {
                    var _a, _b, _c, _d;
                    var interpretationFromObs = interpretationByComponentIdMap.get(item.observationDefinitionId);
                    console.log('this is the interpretationFromObs for componentName', item.componentName, interpretationFromObs);
                    if (item.dataType === 'CodeableConcept') {
                        results.push({
                            name: item.componentName,
                            type: item.dataType,
                            value: ((_a = item.result) === null || _a === void 0 ? void 0 : _a.entry) !== undefined ? (_b = item.result) === null || _b === void 0 ? void 0 : _b.entry : '',
                            units: item.unit,
                            rangeString: item.valueSet
                                .filter(function (value) { return !item.abnormalValues.map(function (val) { return val.code; }).includes(value.code); })
                                .map(function (value) { return value.display; }),
                            interpretationCoding: interpretationFromObs,
                        });
                    }
                    else if (item.dataType === 'Quantity') {
                        results.push({
                            name: item.componentName,
                            type: item.dataType,
                            value: (_c = item.result) === null || _c === void 0 ? void 0 : _c.entry,
                            units: item.unit,
                            rangeQuantity: item,
                            interpretationCoding: interpretationFromObs,
                        });
                    }
                    else if (item.dataType === 'string') {
                        results.push({
                            name: item.componentName,
                            type: item.dataType,
                            value: (_d = item.result) === null || _d === void 0 ? void 0 : _d.entry,
                            interpretationCoding: interpretationFromObs,
                        });
                    }
                });
                resultConfig = {
                    collectionDate: collectionDate,
                    finalResultDateTime: finalResultDateTime,
                    specimenSource: specimenSource,
                    results: results,
                    testName: activityDefinition.title || '',
                };
                return [2 /*return*/, resultConfig];
        }
    });
}); };
var getAdditionalResultsForRelated = function (oystehr, relatedSRs, activityDefinition, timezone) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, additionalActivityDefinitions, srResourceMap, configs, _loop_1, _i, _b, _c, srId, resources;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, in_house_labs_1.fetchResultResourcesForRelatedServiceRequest)(oystehr, relatedSRs)];
            case 1:
                _a = _d.sent(), additionalActivityDefinitions = _a.additionalActivityDefinitions, srResourceMap = _a.srResourceMap;
                configs = [];
                _loop_1 = function (srId, resources) {
                    var observations, tasks, specimens, relatedAdUrlCanonicalUrl, inputRequestTask, specimen, relatedAd, config;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                observations = resources.observations, tasks = resources.tasks, specimens = resources.specimens, relatedAdUrlCanonicalUrl = resources.relatedAdUrlCanonicalUrl;
                                inputRequestTask = tasks.find(function (task) { var _a, _b; return (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) { return c.code === utils_1.IN_HOUSE_LAB_TASK.code.inputResultsTask; }); });
                                specimen = specimens[0];
                                if (!inputRequestTask || !specimen) {
                                    throw new Error("issue getting inputRequestTask or specimen for repeat service request: ".concat(srId));
                                }
                                relatedAd = activityDefinition;
                                if (relatedAdUrlCanonicalUrl) {
                                    if (relatedAdUrlCanonicalUrl !== "".concat(activityDefinition.url, "|").concat(activityDefinition.version)) {
                                        additionalActivityDefinitions.forEach(function (AD) {
                                            var canonicalUrl = "".concat(AD.url, "|").concat(AD.version);
                                            if (relatedAdUrlCanonicalUrl === canonicalUrl) {
                                                relatedAd = AD;
                                            }
                                        });
                                    }
                                }
                                return [4 /*yield*/, getFormattedInHouseLabResults(oystehr, relatedAd, observations, specimen, inputRequestTask, timezone)];
                            case 1:
                                config = _e.sent();
                                configs.push(config);
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _b = Object.entries(srResourceMap);
                _d.label = 2;
            case 2:
                if (!(_i < _b.length)) return [3 /*break*/, 5];
                _c = _b[_i], srId = _c[0], resources = _c[1];
                return [5 /*yield**/, _loop_1(srId, resources)];
            case 3:
                _d.sent();
                _d.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [2 /*return*/, configs];
        }
    });
}); };
var parseObservationForPDF = function (observation, oystehr) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var base64PdfAttachment = checkObsForAttachment(observation, utils_1.OYSTEHR_OBS_CONTENT_TYPES.pdf);
    var base64PngAttachment = checkObsForAttachment(observation, utils_1.OYSTEHR_OBS_CONTENT_TYPES.image, ['PNG']);
    var base64JpgAttachment = checkObsForAttachment(observation, utils_1.OYSTEHR_OBS_CONTENT_TYPES.image, ['JPG', 'JPEG']);
    if (base64PdfAttachment || base64PngAttachment || base64JpgAttachment) {
        var initialText = base64PdfAttachment ? 'A pdf' : 'An image';
        var attachmentResult = {
            resultCodeAndDisplay: '',
            loincCodeAndDisplay: '',
            snomedDisplay: '',
            resultValue: '',
            attachmentText: "".concat(initialText, " attachment is included at the end of this document"),
            observationStatus: observation.status,
            additionalLabCode: getAdditionalLabCode(observation),
        };
        return {
            labResult: attachmentResult,
            interpretationDisplay: undefined,
            base64PdfAttachment: base64PdfAttachment,
            base64PngAttachment: base64PngAttachment,
            base64JpgAttachment: base64JpgAttachment,
        };
    }
    var interpretationDisplay = (_b = (_a = observation.interpretation) === null || _a === void 0 ? void 0 : _a[0].coding) === null || _b === void 0 ? void 0 : _b[0].display;
    var value = undefined;
    if (observation.valueQuantity) {
        var valueWithPrecision = (_d = (_c = observation.valueQuantity.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === utils_1.LAB_OBS_VALUE_WITH_PRECISION_EXT; })) === null || _d === void 0 ? void 0 : _d.valueString;
        if (valueWithPrecision !== undefined) {
            value = "".concat(valueWithPrecision, " ").concat(((_e = observation.valueQuantity) === null || _e === void 0 ? void 0 : _e.code) || '');
        }
        else {
            value = "".concat(((_f = observation.valueQuantity) === null || _f === void 0 ? void 0 : _f.value) !== undefined ? observation.valueQuantity.value : '', " ").concat(((_g = observation.valueQuantity) === null || _g === void 0 ? void 0 : _g.code) || '');
        }
    }
    else if (observation.valueString) {
        value = observation.valueString;
    }
    else if (observation.valueCodeableConcept) {
        // when it's a codeable concept, oystehr writes OBX-5 in coding.code, and then if there was also a note, we stick it in display as well as in observation.note
        // so as a result, you end up with duplicated info. so we'll split it out based on whether or not there's a note
        if ((_h = observation.note) === null || _h === void 0 ? void 0 : _h.length) {
            value = ((_k = (_j = observation.valueCodeableConcept.coding) === null || _j === void 0 ? void 0 : _j.find(function (coding) { return coding.code; })) === null || _k === void 0 ? void 0 : _k.code) || '';
        }
        else {
            value = ((_l = observation.valueCodeableConcept.coding) === null || _l === void 0 ? void 0 : _l.map(function (coding) { return coding.display; }).join(', ')) || '';
        }
    }
    var referenceRangeText = observation.referenceRange
        ? observation.referenceRange
            .reduce(function (acc, refRange) {
            if (refRange.text) {
                acc.push(refRange.text);
            }
            return acc;
        }, [])
            .join('. ')
        : undefined;
    var resultCodeCodings;
    var resultLoincCodings;
    var resultSnomedDisplays;
    (_m = observation.code.coding) === null || _m === void 0 ? void 0 : _m.forEach(function (coding) {
        if (coding.system === "http://loinc.org") {
            if (resultLoincCodings !== undefined) {
                console.info("Found multiple loinc codings in Observation/".concat(observation.id, " code"));
                resultLoincCodings.push(coding);
                return;
            }
            resultLoincCodings = [coding];
        }
        else if (coding.system === utils_1.LABCORP_SNOMED_CODE_SYSTEM && coding.display) {
            // labcorp doesn't want to see the actual code, just the display
            if (resultSnomedDisplays !== undefined) {
                console.info("Found multiple snomed codings in Observation/".concat(observation.id, " code"));
                resultSnomedDisplays.push(coding.display);
                return;
            }
            resultSnomedDisplays = [coding.display];
        }
        else if (![utils_1.OYSTEHR_OBR_NOTE_CODING_SYSTEM, utils_1.OYSTEHR_LABS_ADDITIONAL_LAB_CODE_SYSTEM].includes(coding.system || '')) {
            if (resultCodeCodings !== undefined) {
                console.info("Found multiple code codings in Observation/".concat(observation.id, " code"));
                resultCodeCodings.push(coding);
                return;
            }
            resultCodeCodings = [coding];
        }
    });
    var formatResultCodeAndDisplay = function (coding) {
        if (!coding.code)
            return '';
        return "".concat(coding.code).concat(coding.display ? " (".concat(coding.display, ")") : '');
    };
    var resultCodesAndDisplays = resultCodeCodings === null || resultCodeCodings === void 0 ? void 0 : resultCodeCodings.map(function (coding) { return formatResultCodeAndDisplay(coding); }).join(', ');
    var loincCodesAndDisplays = resultLoincCodings === null || resultLoincCodings === void 0 ? void 0 : resultLoincCodings.map(function (coding) { return formatResultCodeAndDisplay(coding); }).join(', ');
    var snomedDisplays = resultSnomedDisplays === null || resultSnomedDisplays === void 0 ? void 0 : resultSnomedDisplays.join(', ');
    var labResult = {
        resultCodeAndDisplay: resultCodesAndDisplays || '',
        loincCodeAndDisplay: loincCodesAndDisplays || '',
        snomedDisplay: snomedDisplays || '',
        resultInterpretation: (_p = (_o = observation.interpretation) === null || _o === void 0 ? void 0 : _o[0].coding) === null || _p === void 0 ? void 0 : _p[0].code,
        resultInterpretationDisplay: interpretationDisplay,
        resultValue: value || '',
        referenceRangeText: referenceRangeText,
        resultNotes: (_q = observation.note) === null || _q === void 0 ? void 0 : _q.map(function (note) { return note.text; }),
        performingLabName: getPerformingLabNameFromObs(observation),
        performingLabAddress: getPerformingLabAddressFromObs(observation, oystehr),
        performingLabPhone: getPerformingLabPhoneFromObs(observation),
        performingLabDirectorFullName: getPerformingLabDirectorNameFromObs(observation, oystehr),
        observationStatus: observation.status,
        additionalLabCode: getAdditionalLabCode(observation),
    };
    return { labResult: labResult, interpretationDisplay: interpretationDisplay };
};
var getPerformingLabNameFromObs = function (obs) {
    var _a, _b, _c;
    var siteExt = (_a = obs.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.parentExtUrl; });
    if (siteExt) {
        var name_3 = (_c = (_b = siteExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.name; })) === null || _c === void 0 ? void 0 : _c.valueString;
        return name_3;
    }
    return;
};
var getPerformingLabAddressFromObs = function (obs, oystehr) {
    var _a, _b, _c;
    var siteExt = (_a = obs.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.parentExtUrl; });
    if (siteExt) {
        var address = (_c = (_b = siteExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.address; })) === null || _c === void 0 ? void 0 : _c.valueAddress;
        if (address)
            return (0, utils_1.formatZipcodeForDisplay)(oystehr.fhir.formatAddress(address));
    }
    return;
};
var getPerformingLabPhoneFromObs = function (obs) {
    var _a, _b, _c, _d;
    var siteExt = (_a = obs.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.parentExtUrl; });
    if (siteExt) {
        var phone = (_d = (_c = (_b = siteExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.phone; })) === null || _c === void 0 ? void 0 : _c.valueContactPoint) === null || _d === void 0 ? void 0 : _d.value;
        return (0, utils_1.formatPhoneNumberDisplay)(phone || '');
    }
    return;
};
var getPerformingLabDirectorNameFromObs = function (obs, oystehr) {
    var _a, _b, _c;
    var labDirectorExt = (_a = obs.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.PERFORMING_PHYSICIAN_EXTENSION_URLS.parentExtUrl; });
    if (labDirectorExt) {
        var humanName = (_c = (_b = labDirectorExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.PERFORMING_SITE_INFO_EXTENSION_URLS.name; })) === null || _c === void 0 ? void 0 : _c.valueHumanName;
        if (humanName)
            return oystehr.fhir.formatHumanName(humanName);
    }
    return;
};
var checkObsForAttachment = function (obs, obsContentType, imgType) {
    var _a, _b, _c;
    var attachmentExt = (_b = (_a = obs.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.OYSTEHR_EXTERNAL_LABS_ATTACHMENT_EXT_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.valueAttachment;
    var contentTypeCaps = (_c = attachmentExt === null || attachmentExt === void 0 ? void 0 : attachmentExt.contentType) === null || _c === void 0 ? void 0 : _c.toUpperCase();
    // logic on the oystehr side is that the file type and and file extension are mapped to the contentType field
    // PDFs should be AP/PDF (where AP designates file type and PDF the file extension)
    // similarly an image could be IM/PNG (where IM indicates an image file and png is the extension)
    if (attachmentExt && contentTypeCaps && contentTypeCaps.startsWith(obsContentType)) {
        if (!imgType) {
            return attachmentExt.data;
        }
        else {
            for (var _i = 0, imgType_1 = imgType; _i < imgType_1.length; _i++) {
                var type = imgType_1[_i];
                if (contentTypeCaps.endsWith(type)) {
                    return attachmentExt.data;
                }
            }
        }
    }
    return;
};
var writeResultDetailLinesInPdf = function (pdfClient, labResult, textStyles) {
    var _a, _b;
    pdfClient.newLine(14);
    pdfClient.drawSeparatedLine(pdf_utils_1.SEPARATED_LINE_STYLE);
    pdfClient.newLine(5);
    pdfClient.drawTextSequential("Result status: ", textStyles.textBold);
    pdfClient.drawTextSequential(labResult.observationStatus, textStyles.text);
    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    if (labResult.attachmentText) {
        pdfClient.drawText(labResult.attachmentText, textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (labResult.resultCodeAndDisplay) {
        console.log('writing code', labResult.resultCodeAndDisplay);
        pdfClient.drawText("Code: ".concat(labResult.resultCodeAndDisplay), textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (labResult.loincCodeAndDisplay) {
        console.log('writing loinc code', labResult.loincCodeAndDisplay);
        pdfClient.drawText("LOINC Code: ".concat(labResult.loincCodeAndDisplay), textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    // Add the snomed label for labcorp if present
    if (labResult.snomedDisplay) {
        console.log('writing snomed code', labResult.loincCodeAndDisplay);
        pdfClient.drawText("SNOMED: ".concat(labResult.snomedDisplay), textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    // Add the LabCorp additional lab code if present
    if (labResult.additionalLabCode) {
        pdfClient.drawText("Lab: ".concat(labResult.additionalLabCode), textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (labResult.resultInterpretation && labResult.resultInterpretationDisplay) {
        var fontStyleTemp = __assign(__assign({}, textStyles.text), { color: getResultRowDisplayColor([labResult.resultInterpretationDisplay]) });
        pdfClient.drawText("Flag: ".concat(labResult.resultInterpretation, " (").concat(labResult.resultInterpretationDisplay, ")"), fontStyleTemp);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (labResult.resultValue) {
        pdfClient.drawText("Result: ".concat(labResult.resultValue), textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    if (labResult.referenceRangeText) {
        pdfClient.drawText("Reference interval: ".concat(labResult.referenceRangeText), textStyles.text);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    }
    // add any notes included for the observation
    if ((_a = labResult.resultNotes) === null || _a === void 0 ? void 0 : _a.length) {
        console.log("Drawing observation notes. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
        pdfClient.drawText('Notes:', textStyles.textBold);
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
        (_b = labResult.resultNotes) === null || _b === void 0 ? void 0 : _b.forEach(function (note) {
            var noteLines = note.split('\n');
            noteLines.forEach(function (noteLine) {
                if (noteLine === '')
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                else {
                    // adding a little bit of a left indent for notes
                    pdfClient.drawTextSequential(noteLine, textStyles.textNote, {
                        leftBound: lab_pdf_utils_1.LABS_PDF_LEFT_INDENTATION_XPOS,
                        rightBound: pdfClient.getRightBound(),
                    });
                    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
                }
            });
        });
    }
    var performingLabString;
    if (labResult.performingLabName && labResult.performingLabAddress) {
        performingLabString = "".concat(labResult.performingLabName, " ").concat(labResult.performingLabAddress);
    }
    else if (labResult.performingLabName) {
        performingLabString = labResult.performingLabName;
    }
    else if (labResult.performingLabAddress) {
        performingLabString = labResult.performingLabAddress;
    }
    var labDirector;
    if (labResult.performingLabDirectorFullName && labResult.performingLabPhone) {
        labDirector = "".concat(labResult.performingLabDirectorFullName, ", ").concat(labResult.performingLabPhone);
    }
    else if (labResult.performingLabDirectorFullName) {
        labDirector = labResult.performingLabDirectorFullName;
    }
    else if (labResult.performingLabPhone) {
        labDirector = labResult.performingLabPhone;
    }
    console.log("Drawing performing lab details. xPos is ".concat(pdfClient.getX(), ". yPos is ").concat(pdfClient.getY(), ". current page idx is ").concat(pdfClient.getCurrentPageIndex(), " of ").concat(pdfClient.getTotalPages()));
    if (performingLabString) {
        pdfClient.newLine(6);
        pdfClient.drawText("PERFORMING SITE: ".concat(performingLabString), __assign(__assign({}, textStyles.text), { fontSize: 10 }));
    }
    if (labDirector) {
        pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
        pdfClient.drawText("LAB DIRECTOR: ".concat(labDirector), __assign(__assign({}, textStyles.text), { fontSize: 10 }));
    }
    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
};
// Not deleting this for the moment in case LabCorp forces us to use it for multiple tests on one pdf
// const writeExternalLabResultColumns = (
//   pdfClient: PdfClient,
//   textStyles: LabsPDFTextStyleConfig,
//   data: UnsolicitedExternalLabResultsData | ReflexExternalLabResultsData
// ): PdfClient => {
//   console.log(
//     `Drawing column section. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
//   );
//   const columnConstants = {
//     nameCol: { startXPos: pdfClient.getLeftBound(), width: 260, textStyle: textStyles.text },
//     valueCol: { startXPos: pdfClient.getLeftBound() + 270, width: 150, textStyle: textStyles.text },
//     testCode: {
//       startXPos: pdfClient.getLeftBound() + 420,
//       width: pdfClient.getRightBound() - (pdfClient.getLeftBound() + 420),
//       textStyle: textStyles.text,
//     },
//   };
//   pdfClient.drawVariableWidthColumns(
//     [
//       { content: 'NAME', ...columnConstants.nameCol },
//       { content: 'VALUE', ...columnConstants.valueCol },
//       { content: 'LAB', ...columnConstants.testCode },
//     ],
//     pdfClient.getY(),
//     pdfClient.getCurrentPageIndex()
//   );
//   pdfClient.newLine(STANDARD_NEW_LINE);
//   pdfClient.drawSeparatedLine(SEPARATED_LINE_STYLE);
//   pdfClient.newLine(STANDARD_NEW_LINE);
//   console.log(
//     `Drawing four column text content. xPos is ${pdfClient.getX()}. yPos is ${pdfClient.getY()}. current page idx is ${pdfClient.getCurrentPageIndex()} of ${pdfClient.getTotalPages()}`
//   );
//   const styleBasedOnInterpretation: TextStyle = {
//     ...textStyles.text,
//     color: getResultRowDisplayColor(data.resultInterpretations),
//   };
//   pdfClient.drawVariableWidthColumns(
//     [
//       {
//         content: data.testName.toUpperCase(),
//         ...{ ...columnConstants.nameCol, textStyle: styleBasedOnInterpretation },
//       },
//       {
//         content: getResultValueToDisplay(data.resultInterpretations),
//         ...{ ...columnConstants.valueCol, textStyle: styleBasedOnInterpretation },
//       },
//       { content: data.testItemCode, ...{ ...columnConstants.testCode, textStyle: styleBasedOnInterpretation } },
//     ],
//     pdfClient.getY(),
//     pdfClient.getCurrentPageIndex()
//   );
//   pdfClient.newLine(STANDARD_NEW_LINE);
//   return pdfClient;
// };
var getAccountNumberFromDr = function (diagnosticReport) {
    var _a, _b;
    var accountNumber = (_b = (_a = diagnosticReport.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === utils_1.OYSTEHR_LABS_TRANSMISSION_ACCOUNT_NUMBER_IDENTIFIER_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
    console.log("Account number from DiagnosticReport/".concat(diagnosticReport.id, " is '").concat(accountNumber, "'"));
    return accountNumber;
};
var getResultSpecimenFromDr = function (diagnosticReport) {
    var _a, _b, _c, _d;
    console.log('Extracting results specimen from DR');
    if (!diagnosticReport.specimen || !diagnosticReport.specimen.length) {
        console.log('No specimen found on DiagnosticReport');
        return undefined;
    }
    // We'll assume for now that all of these specimens will be contained because that is what Oystehr is doing
    var specimenRef = (_a = diagnosticReport.specimen.find(function (sp) { return sp.reference !== undefined; })) === null || _a === void 0 ? void 0 : _a.reference;
    // this could happen if no specimen info is sent in the hl7
    if (!specimenRef)
        return undefined;
    var specimen = (_b = diagnosticReport.contained) === null || _b === void 0 ? void 0 : _b.find(function (res) { return res.id === specimenRef.replace('#', '') && res.resourceType === 'Specimen'; });
    if (!specimen) {
        console.warn("DiagnosticReport/".concat(diagnosticReport.id, " has a specimen reference ").concat(specimenRef, " but not matching contained resource"));
        return undefined;
    }
    if (!specimen.collection) {
        console.warn('No specimen collection info found');
        return undefined;
    }
    var collectionInfo = {};
    var quantity = specimen.collection.quantity;
    if (quantity && quantity.system === utils_1.OYSTEHR_LABS_RESULT_SPECIMEN_COLLECTION_VOLUME_SYSTEM) {
        collectionInfo.quantityString = quantity.code;
        collectionInfo.unit = quantity.unit;
    }
    if (specimen.collection.bodySite) {
        collectionInfo.bodySite = (_d = (_c = specimen.collection.bodySite.coding) === null || _c === void 0 ? void 0 : _c.find(function (coding) { return coding.system === utils_1.OYSTEHR_LABS_RESULT_SPECIMEN_SOURCE_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.display;
    }
    collectionInfo.collectedDateTime = specimen.collection.collectedDateTime;
    return Object.keys(collectionInfo).length ? collectionInfo : undefined;
};
function getProviderNameAndNpiFromDr(diagnosticReport) {
    var _a, _b, _c, _d, _e, _f, _g;
    console.log('Getting provider info from DR');
    var providerDetails = {
        providerName: '',
        providerNPI: '',
    };
    var providerRef = (_c = (_b = (_a = diagnosticReport.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.OYSTEHR_LABS_RESULT_ORDERING_PROVIDER_EXT_URL && ext.valueReference; })) === null || _b === void 0 ? void 0 : _b.valueReference) === null || _c === void 0 ? void 0 : _c.reference;
    if (!providerRef) {
        console.log('No provider ref found in extension');
        return providerDetails;
    }
    var containedProvider = (_d = diagnosticReport.contained) === null || _d === void 0 ? void 0 : _d.find(function (res) { return res.id === providerRef.replace('#', ''); });
    if (!containedProvider) {
        console.warn("A provider ref existed in the extension of DiagnosticReport/".concat(diagnosticReport.id, " but no contained resource matched"));
        return providerDetails;
    }
    providerDetails.providerName = (_e = (0, utils_1.getFullestAvailableName)(containedProvider)) !== null && _e !== void 0 ? _e : '';
    providerDetails.providerNPI = (_g = (_f = (0, utils_1.getPractitionerNPIIdentifier)(containedProvider)) === null || _f === void 0 ? void 0 : _f.value) !== null && _g !== void 0 ? _g : '';
    return providerDetails;
}
function getAdditionalLabCode(observation) {
    var _a, _b;
    return (_b = (_a = observation.code.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.OYSTEHR_LABS_ADDITIONAL_LAB_CODE_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.code;
}
function drawTestNameHeader(testName, testCode, pdfClient, textStyles) {
    pdfClient.newLine(30);
    pdfClient.drawTextSequential('Test: ', textStyles.textGreyBold);
    pdfClient.drawTextSequential("".concat(testName.toUpperCase(), " (").concat(testCode, ")"), textStyles.header);
    pdfClient.newLine(pdf_consts_1.STANDARD_NEW_LINE);
    return pdfClient;
}

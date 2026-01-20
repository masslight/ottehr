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
exports.filterFinalTasks = exports.filterResourcesBasedOnDiagnosticReports = exports.filterResourcesBasedOnServiceRequest = exports.filterResourcesBasedOnTargetResource = exports.mapResourcesFromBundleEntry = exports.isTaskCorrected = exports.isTaskPrelim = exports.isTaskFinal = exports.isTaskPST = exports.parseTaskPST = exports.parseResultDetails = exports.parseLResultsDetails = exports.parseReviewerNameFromProvenance = exports.isProvenanceReviewActivity = exports.parseReviewProvenanceForTask = exports.parseTaskReviewedInfo = exports.parseTaskReceivedOrCorrectedInfo = exports.parseTaskReceivedAndReviewedAndCorrectedHistory = exports.parseProvenancesForHistory = exports.parseAccountNumber = exports.parseLabOrdersHistory = exports.parseLabOrderLastResultReceivedDate = exports.parseLabOrderAddedDate = exports.parseAccessionNumbers = exports.parsePractitionerIdFromTask = exports.parsePractitionerIdFromServiceRequest = exports.parseVisitDate = exports.parsePaginationFromResponse = exports.parsePerformedDate = exports.parsePerformed = exports.parseIsPSC = exports.parseLabInfo = exports.parsePractitionerName = exports.parseReviewerNameFromTask = exports.parsePractitionerNameFromServiceRequest = exports.parseDiagnoses = exports.parseLabOrderStatusWithSpecificTask = exports.parseLabOrderStatus = exports.fetchQuestionnaireForServiceRequests = exports.fetchFinalAndPrelimAndCorrectedTasks = exports.fetchPractitionersForServiceRequests = exports.checkForDiagnosticReportDrivenResults = exports.extractLabResources = exports.createLabServiceRequestSearchParams = exports.getLabResources = exports.parseResults = exports.parseTasks = exports.parseOrderData = exports.mapResourcesToDrLabDTO = exports.mapResourcesToLabOrderDTOs = void 0;
exports.labOrderCommunicationType = exports.getAllServiceRequestsForPatient = exports.parsePatientLabItems = exports.parseSamples = exports.parseQuestionnaireResponseItems = exports.parseResultByTask = exports.parseDx = exports.filterCancelledResultsTasks = exports.filterCorrectedTasks = exports.filterPrelimTasks = void 0;
exports.executeByCondition = executeByCondition;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var labs_1 = require("../shared/labs");
var mapResourcesToLabOrderDTOs = function (searchBy, serviceRequests, tasks, results, practitioners, encounters, locations, appointments, provenances, organizations, questionnaires, labDocuments, specimens, appointmentScheduleMap, communications, ENVIRONMENT) {
    console.log('mapResourcesToLabOrderDTOs');
    var result = [];
    for (var _i = 0, serviceRequests_1 = serviceRequests; _i < serviceRequests_1.length; _i++) {
        var serviceRequest = serviceRequests_1[_i];
        try {
            var parsedResults = (0, exports.parseResults)(serviceRequest, results);
            var parsedTasks = (0, exports.parseTasks)({ tasks: tasks, serviceRequest: serviceRequest, results: results, cache: { parsedResults: parsedResults } });
            // parseResults and parseTasks are called multiple times in inner functions, so we can cache the results to optimize performance
            var cache = {
                parsedResults: parsedResults,
                parsedTasks: parsedTasks,
            };
            result.push((0, exports.parseOrderData)({
                searchBy: searchBy,
                tasks: tasks,
                serviceRequest: serviceRequest,
                results: results,
                appointments: appointments,
                encounters: encounters,
                locations: locations,
                practitioners: practitioners,
                provenances: provenances,
                organizations: organizations,
                questionnaires: questionnaires,
                labDocuments: labDocuments,
                specimens: specimens,
                appointmentScheduleMap: appointmentScheduleMap,
                communications: communications,
                cache: cache,
            }));
        }
        catch (error) {
            console.error("Error parsing service request ".concat(serviceRequest.id, ":"), error);
            void (0, shared_1.sendErrors)(error, ENVIRONMENT);
        }
    }
    return result;
};
exports.mapResourcesToLabOrderDTOs = mapResourcesToLabOrderDTOs;
var mapResourcesToDrLabDTO = function (resourcesByDr, token) { return __awaiter(void 0, void 0, void 0, function () {
    var reflexLabDTOs, resourcesForDiagnosticReport, _i, resourcesForDiagnosticReport_1, resources, diagnosticReportLabDetailDTO, orderNumber, encounterId, appointmentId, baseDTO, type, reflexLabDetailDTO;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                reflexLabDTOs = [];
                console.log('these are resourcesByDr in mapResourcesToDrLabDTO', JSON.stringify(resourcesByDr));
                resourcesForDiagnosticReport = Object.values(resourcesByDr);
                _i = 0, resourcesForDiagnosticReport_1 = resourcesForDiagnosticReport;
                _f.label = 1;
            case 1:
                if (!(_i < resourcesForDiagnosticReport_1.length)) return [3 /*break*/, 4];
                resources = resourcesForDiagnosticReport_1[_i];
                return [4 /*yield*/, (0, labs_1.formatResourcesIntoDiagnosticReportLabDTO)(resources, token)];
            case 2:
                diagnosticReportLabDetailDTO = _f.sent();
                orderNumber = (0, utils_1.getOrderNumberFromDr)(resources.diagnosticReport) || '';
                encounterId = ((_b = (_a = resources.diagnosticReport.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '')) || '';
                appointmentId = ((_e = (_d = (_c = resources.encounter) === null || _c === void 0 ? void 0 : _c.appointment) === null || _d === void 0 ? void 0 : _d[0].reference) === null || _e === void 0 ? void 0 : _e.replace('Appointment/', '')) || '';
                if (diagnosticReportLabDetailDTO) {
                    baseDTO = __assign(__assign({}, diagnosticReportLabDetailDTO), { orderNumber: orderNumber, encounterId: encounterId, appointmentId: appointmentId });
                    type = (0, labs_1.diagnosticReportSpecificResultType)(resources.diagnosticReport);
                    if (type === utils_1.LabType.reflex) {
                        reflexLabDetailDTO = __assign(__assign({}, baseDTO), { drCentricResultType: 'reflex' });
                        reflexLabDTOs.push(reflexLabDetailDTO);
                    }
                }
                _f.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/, reflexLabDTOs];
        }
    });
}); };
exports.mapResourcesToDrLabDTO = mapResourcesToDrLabDTO;
var parseOrderData = function (_a) {
    var _b, _c, _d;
    var searchBy = _a.searchBy, serviceRequest = _a.serviceRequest, tasks = _a.tasks, results = _a.results, appointments = _a.appointments, encounters = _a.encounters, locations = _a.locations, practitioners = _a.practitioners, provenances = _a.provenances, organizations = _a.organizations, questionnaires = _a.questionnaires, labDocuments = _a.labDocuments, specimens = _a.specimens, appointmentScheduleMap = _a.appointmentScheduleMap, communications = _a.communications, cache = _a.cache;
    console.log('parsing external lab order data');
    if (!serviceRequest.id) {
        throw new Error('ServiceRequest ID is required');
    }
    console.log(serviceRequest.id);
    var appointmentId = (0, labs_1.parseAppointmentIdForServiceRequest)(serviceRequest, encounters) || '';
    var appointment = appointments.find(function (a) { return a.id === appointmentId; });
    var _e = (0, exports.parseLabInfo)(serviceRequest), testItem = _e.testItem, fillerLab = _e.fillerLab;
    var orderStatus = (0, exports.parseLabOrderStatus)(serviceRequest, tasks, results, cache);
    console.log('external lab orderStatus parsed', orderStatus);
    console.log('formatting external lab listPageDTO');
    var requisitionNumber = (0, utils_1.getOrderNumber)(serviceRequest);
    var abnPdfUrl = requisitionNumber && (labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.abnPDFsByRequisitionNumber)
        ? (_b = labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.abnPDFsByRequisitionNumber[requisitionNumber]) === null || _b === void 0 ? void 0 : _b.presignedURL
        : undefined;
    var orderPdfUrl = requisitionNumber && (labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.orderPDFsByRequisitionNumber)
        ? (_c = labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.orderPDFsByRequisitionNumber[requisitionNumber]) === null || _c === void 0 ? void 0 : _c.presignedURL
        : undefined;
    var _f = parseLabCommunicationsForServiceRequest(communications, serviceRequest), orderLevelNoteByUser = _f.orderLevelNoteByUser, clinicalInfoNoteByUser = _f.clinicalInfoNoteByUser;
    var listPageDTO = {
        appointmentId: appointmentId,
        testItem: testItem,
        fillerLab: fillerLab,
        serviceRequestId: serviceRequest.id,
        accessionNumbers: (0, exports.parseAccessionNumbers)(serviceRequest, results),
        lastResultReceivedDate: (0, exports.parseLabOrderLastResultReceivedDate)(serviceRequest, results, tasks, cache),
        orderAddedDate: (0, exports.parseLabOrderAddedDate)(serviceRequest, tasks, results, cache),
        orderSubmittedDate: parseLabOrderSubmittedDate(provenances),
        orderStatus: orderStatus,
        visitDate: (0, exports.parseVisitDate)(appointment),
        isPSC: (0, exports.parseIsPSC)(serviceRequest),
        diagnosesDTO: (0, exports.parseDiagnoses)(serviceRequest),
        orderingPhysician: (0, exports.parsePractitionerNameFromServiceRequest)(serviceRequest, practitioners),
        diagnoses: (0, exports.parseDx)(serviceRequest),
        encounterTimezone: (0, labs_1.parseTimezoneForAppointmentSchedule)(appointment, appointmentScheduleMap),
        orderNumber: requisitionNumber,
        abnPdfUrl: abnPdfUrl,
        orderPdfUrl: orderPdfUrl,
        location: parseLocation(serviceRequest, locations),
        orderLevelNoteByUser: orderLevelNoteByUser,
        clinicalInfoNoteByUser: clinicalInfoNoteByUser,
    };
    if (searchBy.searchBy.field === 'serviceRequestId') {
        console.log('formatting external lab detailedPageDTO for service request', serviceRequest.id);
        var detailedPageDTO = __assign(__assign({}, listPageDTO), { history: (0, exports.parseLabOrdersHistory)(serviceRequest, orderStatus, tasks, results, practitioners, provenances, specimens, cache), accountNumber: (0, exports.parseAccountNumber)(serviceRequest, organizations, locations), resultsDetails: (0, exports.parseLResultsDetails)(serviceRequest, results, tasks, practitioners, provenances, labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.labGeneratedResults, labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.resultPDFs, cache), questionnaire: questionnaires, samples: (0, exports.parseSamples)(serviceRequest, specimens), labelPdfUrl: (_d = labDocuments === null || labDocuments === void 0 ? void 0 : labDocuments.labelPDF) === null || _d === void 0 ? void 0 : _d.presignedURL });
        return detailedPageDTO;
    }
    return listPageDTO;
};
exports.parseOrderData = parseOrderData;
/**
 * Parses the tasks for a service request
 * Returns the PST, RFRT ordered, RPRT reflex, and RPRT tasks sorted by authoredOn date, and some useful data
 * The most recent tasks are first
 * Preliminary Tasks are filtered out if there are corresponding final results
 */
var parseTasks = function (_a) {
    var tasks = _a.tasks, serviceRequest = _a.serviceRequest, results = _a.results, cache = _a.cache;
    if (!serviceRequest.id) {
        return {
            taskPST: null,
            orderedFinalTasks: [],
            reflexFinalTasks: [],
            orderedPrelimTasks: [],
            reflexPrelimTasks: [],
            orderedCorrectedTasks: [],
            reflexCorrectedTasks: [],
            orderedCancelledResultsTasks: [],
            reflexCancelledResultsTasks: [],
        };
    }
    console.log('parsing tasks for service request', serviceRequest.id);
    var PST = (0, exports.parseTaskPST)(tasks, serviceRequest.id);
    // parseResults returns filtered prelim results if there are final results with the same code
    // so we can just use the results from parseResults as base for filtering tasks
    var _b = (cache === null || cache === void 0 ? void 0 : cache.parsedResults) || (0, exports.parseResults)(serviceRequest, results), orderedFinalAndCorrectedResults = _b.orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults = _b.reflexFinalAndCorrectedResults, orderedPrelimResults = _b.orderedPrelimResults, reflexPrelimResults = _b.reflexPrelimResults, orderedCancelledResults = _b.orderedCancelledResults, reflexCancelledResults = _b.reflexCancelledResults;
    var orderedPrelimTasks = (0, exports.filterPrelimTasks)(tasks, orderedPrelimResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    var reflexPrelimTasks = (0, exports.filterPrelimTasks)(tasks, reflexPrelimResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    // theres a slim possibility that a result is both cancelled and belonging in one of these other arrays,
    // meaning possibly that we've already received final results for an ordered test and then the lab cancelled it?? (seems super edge case but still)
    var allOrderedResults = __spreadArray(__spreadArray([], orderedFinalAndCorrectedResults, true), orderedCancelledResults, true);
    var allReflexResults = __spreadArray(__spreadArray([], reflexFinalAndCorrectedResults, true), reflexCancelledResults, true);
    var orderedFinalTasks = (0, exports.filterFinalTasks)(tasks, allOrderedResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    var reflexFinalTasks = (0, exports.filterFinalTasks)(tasks, allReflexResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    var orderedCorrectedTasks = (0, exports.filterCorrectedTasks)(tasks, allOrderedResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    var reflexCorrectedTasks = (0, exports.filterCorrectedTasks)(tasks, allReflexResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    var orderedCancelledResultsTasks = (0, exports.filterCancelledResultsTasks)(tasks, orderedCancelledResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    var reflexCancelledResultsTasks = (0, exports.filterCancelledResultsTasks)(tasks, reflexCancelledResults).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    console.log('successfully parsed tasks');
    return {
        taskPST: PST,
        orderedPrelimTasks: orderedPrelimTasks,
        orderedFinalTasks: orderedFinalTasks,
        reflexPrelimTasks: reflexPrelimTasks,
        reflexFinalTasks: reflexFinalTasks,
        orderedCorrectedTasks: orderedCorrectedTasks,
        reflexCorrectedTasks: reflexCorrectedTasks,
        orderedCancelledResultsTasks: orderedCancelledResultsTasks,
        reflexCancelledResultsTasks: reflexCancelledResultsTasks,
    };
};
exports.parseTasks = parseTasks;
/**
 * Returns results sorted by date, the most recent results are first
 * If Preliminary results are present, and there are Final results with the same code, the corresponding Preliminary results are filtered out
 */
var parseResults = function (serviceRequest, results) {
    var _a, _b;
    console.log('parsing results for serviceRequest', serviceRequest.id);
    if (!serviceRequest.id) {
        throw new Error('ServiceRequest ID is required');
    }
    var serviceRequestCodes = (_b = (_a = serviceRequest.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.map(function (coding) { return coding.code; });
    if (!(serviceRequestCodes === null || serviceRequestCodes === void 0 ? void 0 : serviceRequestCodes.length)) {
        throw new Error('ServiceRequest code is required');
    }
    var relatedResults = (0, exports.filterResourcesBasedOnServiceRequest)(results, serviceRequest.id);
    var orderedFinalAndCorrectedResults = new Map();
    var reflexFinalAndCorrectedResults = new Map();
    var orderedPrelimResults = new Map();
    var reflexPrelimResults = new Map();
    var orderedCancelledResults = [];
    var reflexCancelledResults = [];
    var finalResultStatuses = ['final', 'corrected'];
    for (var i = 0; i < relatedResults.length; i++) {
        var result = relatedResults[i];
        if (!result.id) {
            console.log("Error: result ".concat(result, " has no id"));
            continue;
        }
        var isReflex = (0, labs_1.diagnosticReportIsReflex)(result);
        if (!isReflex) {
            if (result.status === 'preliminary') {
                orderedPrelimResults.set(result.id, result);
            }
            else if (finalResultStatuses.includes(result.status)) {
                orderedFinalAndCorrectedResults.set(result.id, result);
            }
            else if (result.status === 'cancelled') {
                orderedCancelledResults.push(result);
            }
            else {
                console.log("Error: unknown status \"".concat(result.status, "\" for ordered result ").concat(result.id));
            }
        }
        else {
            if (result.status === 'preliminary') {
                reflexPrelimResults.set(result.id, result);
            }
            else if (finalResultStatuses.includes(result.status)) {
                reflexFinalAndCorrectedResults.set(result.id, result);
            }
            else if (result.status === 'cancelled') {
                reflexCancelledResults.push(result);
            }
            else {
                console.log("Error: unknown status \"".concat(result.status, "\" for reflex result ").concat(result.id));
            }
        }
    }
    var orderedFinalCodes = extractCodesFromResults(orderedFinalAndCorrectedResults);
    var reflexFinalCodes = extractCodesFromResults(reflexFinalAndCorrectedResults);
    deletePrelimResultsIfFinalExists(orderedPrelimResults, orderedFinalCodes);
    deletePrelimResultsIfFinalExists(reflexPrelimResults, reflexFinalCodes);
    return {
        orderedFinalAndCorrectedResults: Array.from(orderedFinalAndCorrectedResults.values()),
        reflexFinalAndCorrectedResults: Array.from(reflexFinalAndCorrectedResults.values()),
        orderedPrelimResults: Array.from(orderedPrelimResults.values()),
        reflexPrelimResults: Array.from(reflexPrelimResults.values()),
        orderedCancelledResults: orderedCancelledResults,
        reflexCancelledResults: reflexCancelledResults,
    };
};
exports.parseResults = parseResults;
var getLabResources = function (oystehr, params, m2mToken, searchBy) { return __awaiter(void 0, void 0, void 0, function () {
    var labServiceRequestSearchParams, labOrdersResponsePromise, patientLabItemsPromise, _a, labOrdersResponse, patientLabItems, labResources, _b, serviceRequests, tasksBasedOnSrs, encounters, diagnosticReports, observations, provenances, organizations, questionnaireResponses, specimens, practitioners, documentReferences, appointments, appointmentScheduleMap, communications, preSubmissionTasks, srLocationIds, srLocationsBundlePromise, isDetailPageRequest, _c, serviceRequestPractitioners, finalAndPrelimAndCorrectedTasks, diagnosticReportDrivenResultResources, questionnaires, srLocationsBundle, allPractitioners, labDocuments, filteredDocRefs, locations, pagination;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                labServiceRequestSearchParams = (0, exports.createLabServiceRequestSearchParams)(params);
                console.log('labServiceRequestSearchParams', JSON.stringify(labServiceRequestSearchParams));
                labOrdersResponsePromise = oystehr.fhir.search({
                    resourceType: 'ServiceRequest',
                    params: labServiceRequestSearchParams,
                });
                patientLabItemsPromise = (function () { return __awaiter(void 0, void 0, void 0, function () {
                    var allServiceRequestsForPatient, error_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (!(searchBy.searchBy.field === 'patientId')) return [3 /*break*/, 5];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 3, , 5]);
                                return [4 /*yield*/, (0, exports.getAllServiceRequestsForPatient)(oystehr, searchBy.searchBy.value)];
                            case 2:
                                allServiceRequestsForPatient = _a.sent();
                                return [2 /*return*/, (0, exports.parsePatientLabItems)(allServiceRequestsForPatient)];
                            case 3:
                                error_1 = _a.sent();
                                console.error('Error fetching all service requests for patient:', error_1);
                                return [4 /*yield*/, (0, shared_1.sendErrors)(error_1, params.secrets.ENVIRONMENT)];
                            case 4:
                                _a.sent();
                                return [2 /*return*/, []];
                            case 5: return [2 /*return*/, []];
                        }
                    });
                }); })();
                return [4 /*yield*/, Promise.all([labOrdersResponsePromise, patientLabItemsPromise])];
            case 1:
                _a = _e.sent(), labOrdersResponse = _a[0], patientLabItems = _a[1];
                labResources = ((_d = labOrdersResponse.entry) === null || _d === void 0 ? void 0 : _d.map(function (entry) { return entry.resource; }).filter(function (res) { return Boolean(res); })) || [];
                _b = (0, exports.extractLabResources)(labResources), serviceRequests = _b.serviceRequests, tasksBasedOnSrs = _b.tasks, encounters = _b.encounters, diagnosticReports = _b.diagnosticReports, observations = _b.observations, provenances = _b.provenances, organizations = _b.organizations, questionnaireResponses = _b.questionnaireResponses, specimens = _b.specimens, practitioners = _b.practitioners, documentReferences = _b.documentReferences, appointments = _b.appointments, appointmentScheduleMap = _b.appointmentScheduleMap, communications = _b.communications;
                preSubmissionTasks = tasksBasedOnSrs.filter(function (task) { return (0, exports.isTaskPST)(task); });
                srLocationIds = serviceRequests.flatMap(function (sr) {
                    var _a, _b;
                    return (_b = (_a = sr.locationReference) === null || _a === void 0 ? void 0 : _a.map(function (locRef) { var _a; return (_a = locRef.reference) === null || _a === void 0 ? void 0 : _a.replace('Location/', ''); }).filter(function (val) { return val !== undefined; })) !== null && _b !== void 0 ? _b : [];
                });
                console.log("These are the serviceRequests location ids in getLabResources", JSON.stringify(srLocationIds));
                srLocationsBundlePromise = srLocationIds.length
                    ? oystehr.fhir.search({
                        resourceType: 'Location',
                        params: [{ name: '_id', value: srLocationIds.join(',') }],
                    })
                    : Promise.resolve({
                        unbundle: function () { return []; },
                    });
                isDetailPageRequest = searchBy.searchBy.field === 'serviceRequestId';
                console.log('isDetailPageRequest', isDetailPageRequest);
                return [4 /*yield*/, Promise.all([
                        (0, exports.fetchPractitionersForServiceRequests)(oystehr, serviceRequests, params.secrets.ENVIRONMENT),
                        (0, exports.fetchFinalAndPrelimAndCorrectedTasks)(oystehr, diagnosticReports),
                        (0, exports.checkForDiagnosticReportDrivenResults)({
                            oystehr: oystehr,
                            searchBy: { search: 'list', serviceRequests: serviceRequests },
                            environment: params.secrets.ENVIRONMENT,
                        }),
                        executeByCondition(isDetailPageRequest, function () {
                            return (0, exports.fetchQuestionnaireForServiceRequests)(m2mToken, serviceRequests, questionnaireResponses);
                        }),
                        srLocationsBundlePromise,
                    ])];
            case 2:
                _c = _e.sent(), serviceRequestPractitioners = _c[0], finalAndPrelimAndCorrectedTasks = _c[1], diagnosticReportDrivenResultResources = _c[2], questionnaires = _c[3], srLocationsBundle = _c[4];
                allPractitioners = __spreadArray(__spreadArray([], practitioners, true), serviceRequestPractitioners, true);
                if (!isDetailPageRequest) return [3 /*break*/, 4];
                return [4 /*yield*/, (0, labs_1.configAllExternalLabDocuments)(documentReferences, serviceRequests, m2mToken)];
            case 3:
                labDocuments = _e.sent();
                return [3 /*break*/, 6];
            case 4:
                filteredDocRefs = documentReferences.filter(function (docRef) {
                    return (0, utils_1.docRefIsAbnAndCurrent)(docRef) || (0, utils_1.docRefIsOrderPDFAndCurrent)(docRef);
                });
                if (!filteredDocRefs.length) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, labs_1.configAllExternalLabDocuments)(documentReferences, serviceRequests, m2mToken)];
            case 5:
                labDocuments = _e.sent();
                _e.label = 6;
            case 6:
                locations = srLocationIds.length ? srLocationsBundle.unbundle() : [];
                console.log('These are the returned locations', JSON.stringify(locations));
                pagination = (0, exports.parsePaginationFromResponse)(labOrdersResponse);
                return [2 /*return*/, {
                        serviceRequests: serviceRequests,
                        tasks: __spreadArray(__spreadArray([], preSubmissionTasks, true), finalAndPrelimAndCorrectedTasks, true),
                        diagnosticReports: diagnosticReports,
                        diagnosticReportDrivenResultResources: diagnosticReportDrivenResultResources,
                        practitioners: allPractitioners,
                        encounters: encounters,
                        locations: locations,
                        observations: observations,
                        appointments: appointments,
                        provenances: provenances,
                        organizations: organizations,
                        questionnaires: questionnaires,
                        labDocuments: labDocuments,
                        specimens: specimens,
                        pagination: pagination,
                        patientLabItems: patientLabItems,
                        appointmentScheduleMap: appointmentScheduleMap,
                        communications: communications,
                    }];
        }
    });
}); };
exports.getLabResources = getLabResources;
var createLabServiceRequestSearchParams = function (params) {
    var searchBy = params.searchBy, visitDate = params.visitDate, _a = params.itemsPerPage, itemsPerPage = _a === void 0 ? utils_1.DEFAULT_LABS_ITEMS_PER_PAGE : _a, _b = params.pageIndex, pageIndex = _b === void 0 ? 0 : _b, orderableItemCode = params.orderableItemCode;
    var searchParams = [
        {
            name: '_total',
            value: 'accurate',
        },
        {
            name: '_offset',
            value: "".concat(pageIndex * itemsPerPage),
        },
        {
            name: '_count',
            value: "".concat(itemsPerPage),
        },
        {
            name: '_sort',
            value: '-_lastUpdated',
        },
        {
            name: 'code',
            // empty value will search any code value for given system
            value: "".concat(utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM, "|").concat(orderableItemCode || ''),
        },
        {
            name: 'code:missing',
            value: 'false',
        },
        {
            name: '_include',
            value: 'ServiceRequest:encounter',
        },
        {
            name: '_revinclude',
            value: 'Task:based-on',
        },
        {
            name: '_revinclude',
            value: 'DiagnosticReport:based-on',
        },
        // include Observations
        {
            name: '_include:iterate',
            value: 'DiagnosticReport:result',
        },
        // include Provenance
        {
            name: '_revinclude',
            value: 'Provenance:target',
        },
        {
            name: '_include:iterate',
            value: 'Encounter:appointment',
        },
        // Include slot to get reliable timezone info
        {
            name: '_include:iterate',
            value: 'Appointment:slot',
        },
        {
            name: '_include:iterate',
            value: 'Slot:schedule',
        },
        // "revoked" SRs are essentially deleted
        {
            name: 'status:not',
            value: 'revoked',
        },
    ];
    // chart data case
    if (searchBy.field === 'encounterId') {
        searchParams.push({
            name: 'encounter',
            value: "Encounter/".concat(searchBy.value),
        });
        // to get the abn
        searchParams.push({
            name: '_revinclude:iterate',
            value: 'DocumentReference:related',
        });
        // order level note
        searchParams.push({
            name: '_revinclude',
            value: 'Communication:based-on',
        });
    }
    // tracking board case
    if (searchBy.field === 'encounterIds') {
        searchParams.push({
            name: 'encounter',
            value: searchBy.value.map(function (id) { return "Encounter/".concat(id); }).join(','),
        });
    }
    // patient page case
    if (searchBy.field === 'patientId') {
        searchParams.push({
            name: 'subject',
            value: "Patient/".concat(searchBy.value),
        });
    }
    // detailed page case
    if (searchBy.field === 'serviceRequestId') {
        searchParams.push({
            name: '_id',
            value: searchBy.value,
        });
        // for retrieving accountNumber (from Organization); used on Detailed Page
        searchParams.push({
            name: '_include',
            value: 'ServiceRequest:performer',
        });
        searchParams.push({
            name: '_revinclude',
            value: 'QuestionnaireResponse:based-on',
        });
        searchParams.push({
            name: '_include',
            value: 'ServiceRequest:specimen',
        });
        searchParams.push({
            name: '_include:iterate',
            value: 'Specimen:collector',
        });
        searchParams.push({
            name: '_revinclude:iterate',
            value: 'DocumentReference:related',
        });
        // clinical info notes
        searchParams.push({
            name: '_revinclude',
            value: 'Communication:based-on',
        });
    }
    if (visitDate) {
        searchParams.push({
            name: 'encounter.appointment.date',
            value: visitDate,
        });
    }
    return searchParams;
};
exports.createLabServiceRequestSearchParams = createLabServiceRequestSearchParams;
var extractLabResources = function (resources) {
    var _a, _b;
    console.log('extracting lab resources');
    console.log("".concat(resources.length, " resources total"));
    var serviceRequests = [];
    var tasks = [];
    var diagnosticReports = [];
    var encounters = [];
    var observations = [];
    var provenances = [];
    var organizations = [];
    var questionnaireResponses = [];
    var specimens = [];
    var practitioners = [];
    var documentReferences = [];
    var appointments = [];
    var slots = [];
    var scheduleMap = {};
    var appointmentScheduleMap = {};
    var orderLevelNotesByUser = [];
    var clinicalInfoNotesByUser = [];
    for (var _i = 0, resources_1 = resources; _i < resources_1.length; _i++) {
        var resource = resources_1[_i];
        if (resource.resourceType === 'ServiceRequest') {
            var serviceRequest = resource;
            var withActivityDefinition = (_a = serviceRequest.contained) === null || _a === void 0 ? void 0 : _a.some(function (contained) { return contained.resourceType === 'ActivityDefinition'; });
            if (withActivityDefinition) {
                serviceRequests.push(serviceRequest);
            }
        }
        else if (resource.resourceType === 'Task' && resource.status !== 'cancelled') {
            tasks.push(resource);
        }
        else if (resource.resourceType === 'DiagnosticReport') {
            diagnosticReports.push(resource);
        }
        else if (resource.resourceType === 'Encounter') {
            encounters.push(resource);
        }
        else if (resource.resourceType === 'Observation') {
            observations.push(resource);
        }
        else if (resource.resourceType === 'Provenance') {
            provenances.push(resource);
        }
        else if (resource.resourceType === 'Organization') {
            organizations.push(resource);
        }
        else if (resource.resourceType === 'QuestionnaireResponse') {
            questionnaireResponses.push(resource);
        }
        else if (resource.resourceType === 'Specimen') {
            specimens.push(resource);
        }
        else if (resource.resourceType === 'Practitioner') {
            practitioners.push(resource);
        }
        else if (resource.resourceType === 'DocumentReference' && resource.status === 'current') {
            documentReferences.push(resource);
        }
        else if (resource.resourceType === 'Appointment') {
            appointments.push(resource);
        }
        else if (resource.resourceType === 'Slot') {
            slots.push(resource);
        }
        else if (resource.resourceType === 'Schedule') {
            var scheduleId = resource.id;
            if (scheduleId && !scheduleMap[scheduleId]) {
                scheduleMap[scheduleId] = resource;
            }
        }
        else if (resource.resourceType === 'Communication') {
            var labCommType = (0, exports.labOrderCommunicationType)(resource);
            if (labCommType === 'order-level-note')
                orderLevelNotesByUser.push(resource);
            if (labCommType === 'clinical-info-note')
                clinicalInfoNotesByUser.push(resource);
        }
    }
    var _loop_1 = function (appointment) {
        var slot = slots.find(function (slot) {
            var _a;
            var slotRef = "Slot/".concat(slot.id);
            return (_a = appointment.slot) === null || _a === void 0 ? void 0 : _a.some(function (s) { return s.reference === slotRef; });
        });
        var scheduleId = (_b = slot === null || slot === void 0 ? void 0 : slot.schedule.reference) === null || _b === void 0 ? void 0 : _b.replace('Schedule/', '');
        if (scheduleId) {
            var schedule = scheduleMap[scheduleId];
            if (schedule && appointment.id && !appointmentScheduleMap[appointment.id]) {
                appointmentScheduleMap[appointment.id] = schedule;
            }
        }
    };
    for (var _c = 0, appointments_1 = appointments; _c < appointments_1.length; _c++) {
        var appointment = appointments_1[_c];
        _loop_1(appointment);
    }
    var communications;
    if (orderLevelNotesByUser.length > 0 || clinicalInfoNotesByUser.length > 0) {
        communications = {
            orderLevelNotesByUser: orderLevelNotesByUser,
            clinicalInfoNotesByUser: clinicalInfoNotesByUser,
        };
    }
    return {
        serviceRequests: serviceRequests,
        tasks: tasks,
        diagnosticReports: diagnosticReports,
        encounters: encounters,
        observations: observations,
        provenances: provenances,
        organizations: organizations,
        questionnaireResponses: questionnaireResponses,
        specimens: specimens,
        practitioners: practitioners,
        documentReferences: documentReferences,
        appointments: appointments,
        appointmentScheduleMap: appointmentScheduleMap,
        communications: communications,
    };
};
exports.extractLabResources = extractLabResources;
var checkForDiagnosticReportDrivenResults = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, searchBy, environment, params, serviceRequests, orderNumbersWithSystem, resourceSearch, drGroupedResources, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                oystehr = input.oystehr, searchBy = input.searchBy, environment = input.environment;
                params = [
                    {
                        name: '_tag',
                        value: "".concat(utils_1.LAB_DR_TYPE_TAG.system, "|").concat(utils_1.LAB_DR_TYPE_TAG.code.reflex),
                    }, // only grab those tagged with reflex
                    { name: '_revinclude', value: 'Task:based-on' }, // review task
                    { name: '_revinclude:iterate', value: 'DocumentReference:related' }, // result pdf
                    { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
                    { name: '_include', value: 'DiagnosticReport:encounter' },
                ];
                if (searchBy.search === 'list') {
                    serviceRequests = searchBy.serviceRequests;
                    if (!serviceRequests.length)
                        return [2 /*return*/];
                    orderNumbersWithSystem = serviceRequests
                        .map(function (sr) {
                        var orderNumber = (0, utils_1.getOrderNumber)(sr);
                        if (orderNumber) {
                            return "".concat(utils_1.OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, "|").concat(orderNumber);
                        }
                        else {
                            return;
                        }
                    })
                        .filter(function (value) { return value !== undefined; });
                    if (orderNumbersWithSystem.length === 0)
                        return [2 /*return*/]; // this really should not happen, all SRs should have an orderNumber
                    params.push({
                        name: 'identifier',
                        value: orderNumbersWithSystem.join(','),
                    });
                }
                else if (searchBy.search === 'detail') {
                    params.push({
                        name: '_id',
                        value: searchBy.drId,
                    });
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 5]);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DiagnosticReport',
                        params: params,
                    })];
            case 2:
                resourceSearch = (_a.sent()).unbundle();
                if (resourceSearch.length) {
                    console.log('These were the DR driven resource ids we got back: ', resourceSearch.map(function (resource) { return "".concat(resource.resourceType, "/").concat(resource.id); }));
                    drGroupedResources = (0, labs_1.groupResourcesByDr)(resourceSearch);
                    console.log('got grouped dr resources');
                    return [2 /*return*/, drGroupedResources];
                }
                else {
                    return [2 /*return*/];
                }
                return [3 /*break*/, 5];
            case 3:
                error_2 = _a.sent();
                console.error("Failed to fetch DiagnosticReports with identifier search: ".concat(JSON.stringify(searchBy)), JSON.stringify(error_2, null, 2));
                return [4 /*yield*/, (0, shared_1.sendErrors)(error_2, environment)];
            case 4:
                _a.sent();
                throw (0, utils_1.EXTERNAL_LAB_ERROR)('Reflex result search failed');
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.checkForDiagnosticReportDrivenResults = checkForDiagnosticReportDrivenResults;
var fetchPractitionersForServiceRequests = function (oystehr, serviceRequests, environment) { return __awaiter(void 0, void 0, void 0, function () {
    var practitionerRefs, practitionerRequest, practitionerResponse, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!serviceRequests.length) {
                    return [2 /*return*/, []];
                }
                practitionerRefs = serviceRequests
                    .map(function (sr) { var _a; return (_a = sr.requester) === null || _a === void 0 ? void 0 : _a.reference; })
                    .filter(Boolean)
                    .filter(function (ref, index, self) { return self.indexOf(ref) === index; });
                practitionerRequest = (practitionerRefs === null || practitionerRefs === void 0 ? void 0 : practitionerRefs.map(function (ref) {
                    return ({
                        method: 'GET',
                        url: ref,
                    });
                })) || [];
                if (practitionerRequest.length === 0) {
                    console.error('No practitioners found for service requests');
                    return [2 /*return*/, []];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 5]);
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: practitionerRequest,
                    })];
            case 2:
                practitionerResponse = _a.sent();
                return [2 /*return*/, (0, exports.mapResourcesFromBundleEntry)(practitionerResponse.entry).filter(function (resource) { return (resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Practitioner'; })];
            case 3:
                error_3 = _a.sent();
                console.error("Failed to fetch Practitioners", JSON.stringify(error_3, null, 2));
                return [4 /*yield*/, (0, shared_1.sendErrors)(error_3, environment)];
            case 4:
                _a.sent();
                return [2 /*return*/, []];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.fetchPractitionersForServiceRequests = fetchPractitionersForServiceRequests;
// todo labs team
// SRs are now being linked to tasks in addition to DRs so that the tasks module has direct access to the service request
// either the tasks module has to do different work to fetch the SR (i think this could probably be done easily since the DR is related to the SR)
// if that logic remains than this function may not be needed but there is some filtering happening here i don't fully understand
// for now im going to restore the pre-existing logic by doing some filtering on the tasks returned from the SR query
var fetchFinalAndPrelimAndCorrectedTasks = function (oystehr, results) { return __awaiter(void 0, void 0, void 0, function () {
    var resultsIds, tasksResponse, getDrIdFromTask, resultIdToHasReviewCorrectedResultMap, taskIdToResultIdMap, tasksToReturn, drIdToLatestRFRTMap;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resultsIds = results.reduce(function (acc, result) { return ((result === null || result === void 0 ? void 0 : result.id) ? __spreadArray(__spreadArray([], acc, true), ["DiagnosticReport/".concat(result.id)], false) : acc); }, []);
                if (!resultsIds.length) {
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Task',
                        params: [
                            {
                                name: 'based-on',
                                value: resultsIds.join(','),
                            },
                        ],
                    })];
            case 1:
                tasksResponse = (_a.sent()).unbundle();
                getDrIdFromTask = function (task) {
                    var _a, _b, _c;
                    return (_c = (_b = (_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.find(function (ref) { var _a, _b; return (_b = (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport/')) !== null && _b !== void 0 ? _b : false; })) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
                };
                resultIdToHasReviewCorrectedResultMap = new Map();
                taskIdToResultIdMap = new Map();
                tasksResponse.forEach(function (task) {
                    var _a, _b;
                    var drId = getDrIdFromTask(task);
                    if (drId && task.id) {
                        var drHasCorrectedResult = !!resultIdToHasReviewCorrectedResultMap.get(drId);
                        resultIdToHasReviewCorrectedResultMap.set(drId, ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult; })) ||
                            drHasCorrectedResult);
                        taskIdToResultIdMap.set(task.id, drId);
                    }
                });
                tasksToReturn = [];
                drIdToLatestRFRTMap = new Map();
                tasksResponse.forEach(function (task) {
                    var _a, _b;
                    // easy case, we take all non-cancelled. identical to previous behavior
                    // Note: this will only show the latest correction for a given result (so if there were multiple corrections sent,
                    // you'd only see the latest one until it was reviewed)
                    if (task.status !== 'cancelled') {
                        tasksToReturn.push(task);
                        return;
                    }
                    // if there is a corrected result, we may need to take a cancelled RFRT, but only the latest one for that result.
                    // this happens in cases where a RCRT comes in and cancels the RFRT before a review has occurred
                    if (task.id) {
                        var drIdForTask = taskIdToResultIdMap.get(task.id);
                        if (drIdForTask &&
                            resultIdToHasReviewCorrectedResultMap.get(drIdForTask) &&
                            ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.LAB_ORDER_TASK.code.reviewFinalResult; }))) {
                            // compare it to the latest cancelled RFRT and take the later one
                            var latestRFRT = drIdToLatestRFRTMap.get(drIdForTask);
                            if (!latestRFRT) {
                                drIdToLatestRFRTMap.set(drIdForTask, task);
                                return;
                            }
                            if ((0, utils_1.compareDates)(latestRFRT.authoredOn, task.authoredOn) > 0) {
                                drIdToLatestRFRTMap.set(drIdForTask, task);
                            }
                        }
                    }
                });
                tasksToReturn.push.apply(tasksToReturn, drIdToLatestRFRTMap.values());
                console.log(">>> These are the tasks returned from fetchFinalAndPrelimAndCorrectedTasks", JSON.stringify(tasksToReturn));
                return [2 /*return*/, tasksToReturn];
        }
    });
}); };
exports.fetchFinalAndPrelimAndCorrectedTasks = fetchFinalAndPrelimAndCorrectedTasks;
var fetchQuestionnaireForServiceRequests = function (m2mToken, serviceRequests, questionnaireResponses) { return __awaiter(void 0, void 0, void 0, function () {
    var results, _loop_2, _i, serviceRequests_2, serviceRequest;
    var _a;
    return __generator(this, function (_b) {
        results = [];
        _loop_2 = function (serviceRequest) {
            for (var _c = 0, questionnaireResponses_1 = questionnaireResponses; _c < questionnaireResponses_1.length; _c++) {
                var questionnaireResponse = questionnaireResponses_1[_c];
                if (((_a = questionnaireResponse.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (b) { return b.reference === "ServiceRequest/".concat(serviceRequest.id); })) &&
                    !results.some(function (q) { return q.serviceRequestId === serviceRequest.id; }) &&
                    questionnaireResponse.questionnaire &&
                    serviceRequest.id) {
                    results.push({
                        questionnaireUrl: questionnaireResponse.questionnaire,
                        serviceRequestId: serviceRequest.id,
                        questionnaireResponse: questionnaireResponse,
                    });
                }
            }
        };
        for (_i = 0, serviceRequests_2 = serviceRequests; _i < serviceRequests_2.length; _i++) {
            serviceRequest = serviceRequests_2[_i];
            _loop_2(serviceRequest);
        }
        return [2 /*return*/, Promise.all(results.map(function (result) { return __awaiter(void 0, void 0, void 0, function () {
                var questionnaireRequest, questionnaireResponse, serviceRequestId, questionnaire;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, fetch(result.questionnaireUrl, {
                                headers: {
                                    Authorization: "Bearer ".concat(m2mToken),
                                },
                            })];
                        case 1:
                            questionnaireRequest = _a.sent();
                            questionnaireResponse = result.questionnaireResponse, serviceRequestId = result.serviceRequestId;
                            return [4 /*yield*/, questionnaireRequest.json()];
                        case 2:
                            questionnaire = (_a.sent());
                            return [2 /*return*/, {
                                    questionnaire: questionnaire,
                                    questionnaireResponse: questionnaireResponse,
                                    questionnaireResponseItems: (0, exports.parseQuestionnaireResponseItems)(questionnaireResponse, questionnaire),
                                    serviceRequestId: serviceRequestId,
                                }];
                    }
                });
            }); }))];
    });
}); };
exports.fetchQuestionnaireForServiceRequests = fetchQuestionnaireForServiceRequests;
function executeByCondition(condition, fetchFunction, emptyResultType) {
    if (emptyResultType === void 0) { emptyResultType = []; }
    return condition ? fetchFunction() : Promise.resolve(emptyResultType);
}
var parseLabOrderStatus = function (serviceRequest, tasks, results, cache) {
    if (!serviceRequest.id) {
        console.error('ServiceRequest id is required to parse lab order status');
        return utils_1.ExternalLabsStatus.unknown;
    }
    if ((0, labs_1.srHasRejectedAbnExt)(serviceRequest))
        return utils_1.ExternalLabsStatus['rejected abn'];
    var _a = (cache === null || cache === void 0 ? void 0 : cache.parsedResults) || (0, exports.parseResults)(serviceRequest, results), orderedFinalAndCorrectedResults = _a.orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults = _a.reflexFinalAndCorrectedResults, orderedPrelimResults = _a.orderedPrelimResults, reflexPrelimResults = _a.reflexPrelimResults;
    var _b = (cache === null || cache === void 0 ? void 0 : cache.parsedTasks) ||
        (0, exports.parseTasks)({
            tasks: tasks,
            serviceRequest: serviceRequest,
            results: results,
        }), taskPST = _b.taskPST, orderedFinalTasks = _b.orderedFinalTasks, reflexFinalTasks = _b.reflexFinalTasks, orderedCorrectedTasks = _b.orderedCorrectedTasks, reflexCorrectedTasks = _b.reflexCorrectedTasks, orderedCancelledResultsTasks = _b.orderedCancelledResultsTasks, reflexCancelledResultsTasks = _b.reflexCancelledResultsTasks;
    if (orderedCancelledResultsTasks.length > 0 || reflexCancelledResultsTasks.length > 0) {
        return utils_1.ExternalLabsStatus['cancelled by lab'];
    }
    var finalAndCorrectedTasks = __spreadArray(__spreadArray(__spreadArray(__spreadArray([], orderedFinalTasks, true), reflexFinalTasks, true), orderedCorrectedTasks, true), reflexCorrectedTasks, true);
    var finalResults = __spreadArray(__spreadArray([], orderedFinalAndCorrectedResults, true), reflexFinalAndCorrectedResults, true);
    var prelimResults = __spreadArray(__spreadArray([], orderedPrelimResults, true), reflexPrelimResults, true);
    var hasCompletedPSTTask = (taskPST === null || taskPST === void 0 ? void 0 : taskPST.status) === 'completed';
    var isActiveServiceRequest = serviceRequest.status === 'active';
    var hasAllConditions = function (conditions) {
        return Object.values(conditions).every(function (condition) { return condition === true; });
    };
    // 'pending': If the SR.status == draft and a pre-submission task exists
    var pendingStatusConditions = {
        serviceRequestStatusIsDraft: serviceRequest.status === 'draft',
        pstTaskStatusIsReady: (taskPST === null || taskPST === void 0 ? void 0 : taskPST.status) === 'ready' || (taskPST === null || taskPST === void 0 ? void 0 : taskPST.status) === 'in-progress',
    };
    if (hasAllConditions(pendingStatusConditions)) {
        return utils_1.ExternalLabsStatus.pending;
    }
    if (hasCompletedPSTTask && serviceRequest.status === 'draft') {
        return utils_1.ExternalLabsStatus.ready;
    }
    // 'sent': If Task(PST).status == completed, SR.status == active, and there is no DR for the ordered test code
    var sentStatusConditions = {
        hasCompletedPSTTask: hasCompletedPSTTask,
        isActiveServiceRequest: isActiveServiceRequest,
        noFinalResults: orderedFinalAndCorrectedResults.length === 0,
        noPrelimResults: prelimResults.length === 0,
    };
    if (hasAllConditions(sentStatusConditions)) {
        var manualOrder = (0, utils_1.externalLabOrderIsManual)(serviceRequest);
        if (manualOrder) {
            return utils_1.ExternalLabsStatus['sent manually'];
        }
        else {
            return utils_1.ExternalLabsStatus.sent;
        }
    }
    var hasPrelimResults = prelimResults.length > 0;
    // 'prelim': DR.status == 'preliminary', Task(PST).status == completed, SR.status == active
    var prelimStatusConditions = {
        hasPrelimResults: hasPrelimResults,
        hasCompletedPSTTask: hasCompletedPSTTask,
        isActiveServiceRequest: isActiveServiceRequest,
    };
    if (hasAllConditions(prelimStatusConditions)) {
        return utils_1.ExternalLabsStatus.prelim;
    }
    // 'corrected': DR.status == 'corrected', Task(RCT).status == 'ready'
    var hasReadyRCRTWithCorrectedResult = finalAndCorrectedTasks.some(function (task) {
        var _a, _b;
        if (!(((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult; })) &&
            (task.status === 'ready' || task.status === 'in-progress')))
            return false;
        var relatedFinalResults = (0, exports.parseResultByTask)(task, finalResults);
        return relatedFinalResults.some(function (result) { return result.status === 'corrected'; });
    });
    var correctedResultConditions = {
        hasReadyRCRTWithCorrectedResult: hasReadyRCRTWithCorrectedResult,
    };
    if (hasAllConditions(correctedResultConditions)) {
        return utils_1.ExternalLabsStatus.corrected;
    }
    // received: Task(RFRT).status = 'ready' and DR the Task is basedOn have DR.status = ‘final’
    var hasReadyTaskWithFinalResult = finalAndCorrectedTasks.some(function (task) {
        if (task.status !== 'ready' && task.status !== 'in-progress') {
            return false;
        }
        var relatedFinalResults = (0, exports.parseResultByTask)(task, finalResults);
        return relatedFinalResults.length > 0;
    });
    var receivedStatusConditions = {
        hasReadyTaskWithFinalResult: hasReadyTaskWithFinalResult,
    };
    if (hasAllConditions(receivedStatusConditions)) {
        return utils_1.ExternalLabsStatus.received;
    }
    //  reviewed: Task(RFRT).status = 'completed' and DR the Task is basedOn have DR.status = ‘final’
    var hasCompletedTaskWithFinalResult = finalAndCorrectedTasks.some(function (task) {
        if (task.status !== 'completed') {
            return false;
        }
        var relatedFinalResults = (0, exports.parseResultByTask)(task, finalResults);
        return relatedFinalResults.length > 0;
    });
    var reviewedStatusConditions = {
        hasCompletedTaskWithFinalResult: hasCompletedTaskWithFinalResult,
    };
    if (hasAllConditions(reviewedStatusConditions)) {
        return utils_1.ExternalLabsStatus.reviewed;
    }
    console.log("Alert: unknown status for ServiceRequest/".concat(serviceRequest.id, ". Here are the conditions for determining the status, all conditions must be true for picking the corresponding status:"), JSON.stringify({
        pendingStatusConditions: pendingStatusConditions,
        sentStatusConditions: sentStatusConditions,
        prelimStatusConditions: prelimStatusConditions,
        correctedResultConditions: correctedResultConditions,
        receivedStatusConditions: receivedStatusConditions,
        reviewedStatusConditions: reviewedStatusConditions,
    }, null, 2));
    console.log('sr status: ', serviceRequest.status);
    return utils_1.ExternalLabsStatus.unknown;
};
exports.parseLabOrderStatus = parseLabOrderStatus;
// can we use this in place of parseLabOrderStatus? i dont understand why that one is so much more complicated
var parseLabOrderStatusWithSpecificTask = function (result, task, serviceRequest, // will be undefined for unsolicited results only
PSTTask) {
    var _a, _b, _c, _d;
    if ((serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.status) === 'revoked') {
        if ((0, labs_1.srHasRejectedAbnExt)(serviceRequest))
            return utils_1.ExternalLabsStatus['rejected abn'];
    }
    if (result.status === 'cancelled' &&
        ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) { return c.code === utils_1.LAB_ORDER_TASK.code.reviewCancelledResult; })))
        return utils_1.ExternalLabsStatus['cancelled by lab'];
    var taskIsMatchUnsolicitedResult = (_d = (_c = task.code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.some(function (c) { return c.system === utils_1.LAB_ORDER_TASK.system && c.code === utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult; });
    if (result.status === 'final') {
        if (task.status === 'completed') {
            if (taskIsMatchUnsolicitedResult) {
                return utils_1.ExternalLabsStatus.received;
            }
            else {
                return utils_1.ExternalLabsStatus.reviewed;
            }
        }
        else if (task.status === 'ready' || task.status === 'in-progress') {
            return utils_1.ExternalLabsStatus.received;
        }
    }
    if (result.status === 'corrected' && (task.status === 'ready' || task.status === 'in-progress'))
        return utils_1.ExternalLabsStatus.corrected;
    if ((result.status === 'final' || result.status == 'corrected') && task.status === 'completed')
        return utils_1.ExternalLabsStatus.reviewed;
    if (result.status === 'preliminary')
        return utils_1.ExternalLabsStatus.prelim;
    if ((serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.status) === 'draft' && ((PSTTask === null || PSTTask === void 0 ? void 0 : PSTTask.status) === 'ready' || (PSTTask === null || PSTTask === void 0 ? void 0 : PSTTask.status) === 'in-progress'))
        return utils_1.ExternalLabsStatus.pending;
    if ((serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.status) === 'active' && (PSTTask === null || PSTTask === void 0 ? void 0 : PSTTask.status) === 'completed')
        return utils_1.ExternalLabsStatus.sent;
    return utils_1.ExternalLabsStatus.unknown;
};
exports.parseLabOrderStatusWithSpecificTask = parseLabOrderStatusWithSpecificTask;
var parseDiagnoses = function (serviceRequest) {
    if (!serviceRequest.reasonCode || serviceRequest.reasonCode.length === 0) {
        return [];
    }
    return serviceRequest.reasonCode.map(function (reasonCode) {
        var _a;
        var coding = (_a = reasonCode.coding) === null || _a === void 0 ? void 0 : _a[0];
        return {
            code: (coding === null || coding === void 0 ? void 0 : coding.code) || '',
            display: (coding === null || coding === void 0 ? void 0 : coding.display) || reasonCode.text || '',
            system: (coding === null || coding === void 0 ? void 0 : coding.system) || '',
            isPrimary: false, // todo: how to determine if it's primary?
        };
    });
};
exports.parseDiagnoses = parseDiagnoses;
var parsePractitionerNameFromServiceRequest = function (serviceRequest, practitioners) {
    var practitionerIdFromServiceRequest = (0, exports.parsePractitionerIdFromServiceRequest)(serviceRequest);
    return (0, exports.parsePractitionerName)(practitionerIdFromServiceRequest, practitioners);
};
exports.parsePractitionerNameFromServiceRequest = parsePractitionerNameFromServiceRequest;
var parseReviewerNameFromTask = function (task, practitioners) {
    var _a, _b;
    var performerId = ((_b = (_a = task.owner) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop()) || '';
    return (0, exports.parsePractitionerName)(performerId, practitioners);
};
exports.parseReviewerNameFromTask = parseReviewerNameFromTask;
var parsePractitionerName = function (practitionerId, practitioners) {
    var NOT_FOUND = '';
    if (!practitionerId) {
        return NOT_FOUND;
    }
    var practitioner = practitioners.find(function (p) { return p.id === practitionerId; });
    if (!practitioner) {
        return NOT_FOUND;
    }
    var providerName = (0, utils_1.getFullestAvailableName)(practitioner);
    if (!providerName) {
        return NOT_FOUND;
    }
    return providerName;
};
exports.parsePractitionerName = parsePractitionerName;
var parseLabInfo = function (serviceRequest) {
    var _a;
    var activityDefinition = (_a = serviceRequest.contained) === null || _a === void 0 ? void 0 : _a.find(function (resource) { return resource.resourceType === 'ActivityDefinition'; });
    if (!activityDefinition) {
        return {
            testItem: 'Unknown Test',
            fillerLab: 'Unknown Lab',
        };
    }
    return {
        testItem: activityDefinition.title || 'Unknown Test',
        fillerLab: activityDefinition.publisher || 'Unknown Lab',
    };
};
exports.parseLabInfo = parseLabInfo;
var parseIsPSC = function (serviceRequest) {
    var _a;
    return !!((_a = serviceRequest.orderDetail) === null || _a === void 0 ? void 0 : _a.some(function (detail) { var _a; return (_a = detail.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding.system === utils_1.PSC_HOLD_CONFIG.system && coding.code === utils_1.PSC_HOLD_CONFIG.code; }); }));
};
exports.parseIsPSC = parseIsPSC;
var parsePerformed = function (specimen, practitioners) {
    var _a, _b, _c;
    console.log('parsing performed by for specimen', specimen.id);
    var NOT_FOUND = '';
    var collectedById = (_c = (_b = (_a = specimen.collection) === null || _a === void 0 ? void 0 : _a.collector) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Practitioner/', '');
    if (collectedById) {
        return (0, exports.parsePractitionerName)(collectedById, practitioners);
    }
    return NOT_FOUND;
};
exports.parsePerformed = parsePerformed;
var parsePerformedDate = function (specimen) {
    var _a;
    console.log('parsing performed date for specimen', specimen.id);
    return ((_a = specimen.collection) === null || _a === void 0 ? void 0 : _a.collectedDateTime) || '-';
};
exports.parsePerformedDate = parsePerformedDate;
var extractCodesFromResults = function (resultsMap) {
    var codes = new Set();
    resultsMap.forEach(function (result) {
        var _a, _b;
        (_b = (_a = result.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.forEach(function (coding) {
            if (coding.code)
                codes.add(coding.code);
        });
    });
    return codes;
};
var deletePrelimResultsIfFinalExists = function (prelimMap, finalCodes) {
    prelimMap.forEach(function (prelim, id) {
        var _a, _b;
        var hasFinal = (_b = (_a = prelim.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code && finalCodes.has(coding.code); });
        if (hasFinal) {
            prelimMap.delete(id);
        }
    });
};
var parsePaginationFromResponse = function (data) {
    if (!data || typeof data.total !== 'number' || !Array.isArray(data.link)) {
        return utils_1.EMPTY_PAGINATION;
    }
    var selfLink = data.link.find(function (link) { return link && link.relation === 'self'; });
    if (!selfLink || !selfLink.url) {
        return utils_1.EMPTY_PAGINATION;
    }
    var totalItems = data.total;
    var selfUrl = new URL(selfLink.url);
    var itemsPerPageStr = selfUrl.searchParams.get('_count');
    if (!itemsPerPageStr) {
        return utils_1.EMPTY_PAGINATION;
    }
    var itemsPerPage = parseInt(itemsPerPageStr, 10);
    if (!(0, utils_1.isPositiveNumberOrZero)(itemsPerPage)) {
        return utils_1.EMPTY_PAGINATION;
    }
    var selfOffsetStr = selfUrl.searchParams.get('_offset');
    var selfOffset = selfOffsetStr ? parseInt(selfOffsetStr, 10) : 0;
    var currentPageIndex = !isNaN(selfOffset) ? Math.floor(selfOffset / itemsPerPage) : 0;
    var totalPages = Math.ceil(totalItems / itemsPerPage);
    return {
        currentPageIndex: currentPageIndex,
        totalItems: totalItems,
        totalPages: totalPages,
    };
};
exports.parsePaginationFromResponse = parsePaginationFromResponse;
var parseVisitDate = function (appointment) {
    return (appointment === null || appointment === void 0 ? void 0 : appointment.created) || '';
};
exports.parseVisitDate = parseVisitDate;
var parsePractitionerIdFromServiceRequest = function (serviceRequest) {
    var _a, _b;
    var NOT_FOUND = '';
    return ((_b = (_a = serviceRequest.requester) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop()) || NOT_FOUND;
};
exports.parsePractitionerIdFromServiceRequest = parsePractitionerIdFromServiceRequest;
var parsePractitionerIdFromTask = function (task) {
    var _a, _b;
    var NOT_FOUND = '';
    return ((_b = (_a = task.owner) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop()) || NOT_FOUND;
};
exports.parsePractitionerIdFromTask = parsePractitionerIdFromTask;
var parseAccessionNumbers = function (serviceRequest, results, cache) {
    var _a = (cache === null || cache === void 0 ? void 0 : cache.parsedResults) || (0, exports.parseResults)(serviceRequest, results), orderedFinalAndCorrectedResults = _a.orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults = _a.reflexFinalAndCorrectedResults, orderedPrelimResults = _a.orderedPrelimResults, reflexPrelimResults = _a.reflexPrelimResults, orderedCancelledResults = _a.orderedCancelledResults, reflexCancelledResults = _a.reflexCancelledResults;
    var accessionNumbers = __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], orderedFinalAndCorrectedResults, true), reflexFinalAndCorrectedResults, true), orderedPrelimResults, true), reflexPrelimResults, true), orderedCancelledResults, true), reflexCancelledResults, true).map(function (result) { return (0, labs_1.parseAccessionNumberFromDr)(result); })
        .filter(Boolean)
        .filter(function (value, index, self) { return self.indexOf(value) === index; }); // Remove duplicates
    return accessionNumbers;
};
exports.parseAccessionNumbers = parseAccessionNumbers;
var parseLabOrderAddedDate = function (serviceRequest, tasks, results, cache) {
    var taskPST = ((cache === null || cache === void 0 ? void 0 : cache.parsedTasks) ||
        (0, exports.parseTasks)({
            tasks: tasks,
            serviceRequest: serviceRequest,
            results: results,
        })).taskPST;
    return (taskPST === null || taskPST === void 0 ? void 0 : taskPST.authoredOn) || '';
};
exports.parseLabOrderAddedDate = parseLabOrderAddedDate;
var parseLabOrderSubmittedDate = function (provenances) {
    var submittedProvenance = provenances.find(function (prov) {
        var _a, _b;
        return (_b = (_a = prov.activity) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (c) {
            return c.system === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.submit.system &&
                c.code === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.submit.code;
        });
    });
    console.log('submittedProvenance', submittedProvenance);
    return submittedProvenance === null || submittedProvenance === void 0 ? void 0 : submittedProvenance.recorded;
};
var parseLabOrderLastResultReceivedDate = function (serviceRequest, results, tasks, cache) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var _j = (cache === null || cache === void 0 ? void 0 : cache.parsedTasks) ||
        (0, exports.parseTasks)({
            tasks: tasks,
            serviceRequest: serviceRequest,
            results: results,
        }), orderedPrelimTasks = _j.orderedPrelimTasks, reflexPrelimTasks = _j.reflexPrelimTasks, orderedFinalTasks = _j.orderedFinalTasks, reflexFinalTasks = _j.reflexFinalTasks, orderedCorrectedTasks = _j.orderedCorrectedTasks, reflexCorrectedTasks = _j.reflexCorrectedTasks, orderedCancelledResultsTasks = _j.orderedCancelledResultsTasks, reflexCancelledResultsTasks = _j.reflexCancelledResultsTasks;
    var lastResultReceivedDate = [
        (_a = orderedPrelimTasks[0]) === null || _a === void 0 ? void 0 : _a.authoredOn,
        (_b = reflexPrelimTasks[0]) === null || _b === void 0 ? void 0 : _b.authoredOn,
        (_c = orderedFinalTasks[0]) === null || _c === void 0 ? void 0 : _c.authoredOn,
        (_d = reflexFinalTasks[0]) === null || _d === void 0 ? void 0 : _d.authoredOn,
        (_e = orderedCorrectedTasks[0]) === null || _e === void 0 ? void 0 : _e.authoredOn,
        (_f = reflexCorrectedTasks[0]) === null || _f === void 0 ? void 0 : _f.authoredOn,
        (_g = orderedCancelledResultsTasks[0]) === null || _g === void 0 ? void 0 : _g.authoredOn,
        (_h = reflexCancelledResultsTasks[0]) === null || _h === void 0 ? void 0 : _h.authoredOn,
    ]
        .filter(Boolean)
        .sort(function (a, b) { return (0, utils_1.compareDates)(a, b); })[0] || '';
    return lastResultReceivedDate;
};
exports.parseLabOrderLastResultReceivedDate = parseLabOrderLastResultReceivedDate;
var parseLabOrdersHistory = function (serviceRequest, orderStatus, tasks, results, practitioners, provenances, specimens, cache) {
    console.log('building order history for external lab service request', serviceRequest.id);
    var _a = (cache === null || cache === void 0 ? void 0 : cache.parsedTasks) ||
        (0, exports.parseTasks)({
            tasks: tasks,
            serviceRequest: serviceRequest,
            results: results,
        }), orderedFinalTasks = _a.orderedFinalTasks, reflexFinalTasks = _a.reflexFinalTasks, orderedCorrectedTasks = _a.orderedCorrectedTasks, reflexCorrectedTasks = _a.reflexCorrectedTasks, orderedCancelledResultsTasks = _a.orderedCancelledResultsTasks, reflexCancelledResultsTasks = _a.reflexCancelledResultsTasks;
    var createdBy = (0, exports.parsePractitionerNameFromServiceRequest)(serviceRequest, practitioners);
    var createdDate = (0, exports.parseLabOrderAddedDate)(serviceRequest, tasks, results, cache);
    var history = [
        {
            action: 'created',
            performer: createdBy,
            date: createdDate,
        },
    ];
    if (orderStatus === utils_1.ExternalLabsStatus.pending)
        return history;
    // todo labs we should only iterate over all these provenances once
    history.push.apply(history, (0, exports.parseProvenancesForHistory)('ready', utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask, practitioners, provenances));
    history.push.apply(history, (0, exports.parseProvenancesForHistory)('ordered', utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.submit, practitioners, provenances));
    history.push.apply(history, (0, exports.parseProvenancesForHistory)('rejected abn', utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.abnRejected, practitioners, provenances));
    var isPSC = (0, exports.parseIsPSC)(serviceRequest);
    var pushPerformedHistory = function (specimen) {
        history.push({
            action: 'performed',
            performer: (0, exports.parsePerformed)(specimen, practitioners),
            date: (0, exports.parsePerformedDate)(specimen),
        });
    };
    // only push performed to order history if this is not a psc order or there is a specimen to parse data from
    // not having a specimen for a non psc order is probably an edge case but was causing issues for AutoLab
    if (!isPSC || specimens[0]) {
        pushPerformedHistory(specimens[0]);
    }
    // todo: design is required https://github.com/masslight/ottehr/issues/2177
    // handle if there are multiple specimens (the first one is handled above)
    // specimens.slice(1).forEach((specimen) => {
    //   pushPerformedHistory(specimen);
    // });
    var taggedReflexTasks = __spreadArray(__spreadArray([], reflexFinalTasks, true), reflexCorrectedTasks, true).map(function (task) { return (__assign(__assign({}, task), { testType: 'reflex' })); });
    var taggedOrderedTasks = __spreadArray(__spreadArray([], orderedFinalTasks, true), orderedCorrectedTasks, true).map(function (task) { return (__assign(__assign({}, task), { testType: 'ordered' })); });
    var finalTasks = __spreadArray(__spreadArray([], taggedReflexTasks, true), taggedOrderedTasks, true).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    });
    finalTasks.forEach(function (task) {
        history.push.apply(history, (0, exports.parseTaskReceivedAndReviewedAndCorrectedHistory)(task, practitioners, provenances));
    });
    __spreadArray(__spreadArray([], orderedCancelledResultsTasks, true), reflexCancelledResultsTasks, true).forEach(function (task) {
        history.push({
            action: 'cancelled by lab',
            performer: '',
            date: task.authoredOn || '',
        });
    });
    history.push.apply(history, (0, exports.parseProvenancesForHistory)('deleted', utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.deleteOrder, practitioners, provenances));
    return history.sort(function (a, b) { return (0, utils_1.compareDates)(b.date, a.date); });
};
exports.parseLabOrdersHistory = parseLabOrdersHistory;
var parseAccountNumber = function (serviceRequest, organizations, locations) {
    var _a;
    var NOT_FOUND = '';
    if (!serviceRequest.performer || !serviceRequest.performer.length) {
        console.warn("Could not determine account number because ServiceRequest/".concat(serviceRequest.id, " has no performer"));
        return NOT_FOUND;
    }
    if (!serviceRequest.locationReference ||
        serviceRequest.locationReference.length !== 1 ||
        !serviceRequest.locationReference[0].reference) {
        console.warn("Could not determine account number because ServiceRequest/".concat(serviceRequest.id, " has no locationReference, or too many"));
        return NOT_FOUND;
    }
    var srPerformer;
    var _loop_3 = function (performer) {
        if (performer.reference && performer.reference.includes('Organization/')) {
            var organizationId_1 = performer.reference.split('Organization/')[1];
            var matchingOrg = organizations.find(function (org) { return org.id === organizationId_1; });
            if (matchingOrg) {
                srPerformer = matchingOrg;
                return "break";
            }
        }
    };
    for (var _i = 0, _b = serviceRequest.performer; _i < _b.length; _i++) {
        var performer = _b[_i];
        var state_1 = _loop_3(performer);
        if (state_1 === "break")
            break;
    }
    if (!srPerformer) {
        console.warn("No matching performer found for ServiceRequest/".concat(serviceRequest.id));
        return NOT_FOUND;
    }
    var srLocationRef = serviceRequest.locationReference[0].reference;
    var orderingLocation = locations.find(function (location) { return "Location/".concat(location.id) === srLocationRef; });
    if (!orderingLocation) {
        console.warn("No location found matching SR locationReference Location/".concat(srLocationRef));
        return NOT_FOUND;
    }
    return (_a = (0, utils_1.getAccountNumberFromLocationAndOrganization)(orderingLocation, srPerformer)) !== null && _a !== void 0 ? _a : NOT_FOUND;
};
exports.parseAccountNumber = parseAccountNumber;
// todo labs team - we could probably refactor to iterate over provenances only once
var parseProvenancesForHistory = function (historyAction, activityCoding, practitioners, provenances) {
    var relatedProvenance = provenances.find(function (provenance) {
        var _a, _b;
        return (_b = (_a = provenance.activity) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (code) { return code.code === activityCoding.code && code.system === activityCoding.system; });
    });
    if (!relatedProvenance)
        return [];
    var taskCompletedBy = (0, exports.parseReviewerNameFromProvenance)(relatedProvenance, practitioners);
    var date = relatedProvenance.recorded;
    var historyRow = {
        action: historyAction,
        performer: taskCompletedBy,
        date: date,
    };
    return [historyRow];
};
exports.parseProvenancesForHistory = parseProvenancesForHistory;
var parseTaskReceivedAndReviewedAndCorrectedHistory = function (task, practitioners, provenances) {
    var _a, _b;
    var result = [];
    var receivedDate = (0, exports.parseTaskReceivedOrCorrectedInfo)(task);
    if (receivedDate) {
        result.push(__assign(__assign({}, receivedDate), { testType: task.testType }));
    }
    var status = "".concat(task.status === 'completed'
        ? 'reviewed'
        : ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult; }))
            ? 'corrected'
            : 'received');
    if (status !== 'reviewed') {
        return result;
    }
    var reviewedDate = (0, exports.parseTaskReviewedInfo)(task, practitioners, provenances);
    if (reviewedDate) {
        result.push(__assign(__assign({}, reviewedDate), { testType: task.testType }));
    }
    return result;
};
exports.parseTaskReceivedAndReviewedAndCorrectedHistory = parseTaskReceivedAndReviewedAndCorrectedHistory;
var parseTaskReceivedOrCorrectedInfo = function (task) {
    var _a, _b;
    return {
        action: ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult; }))
            ? 'corrected'
            : 'received',
        performer: '',
        date: task.authoredOn || '',
    };
};
exports.parseTaskReceivedOrCorrectedInfo = parseTaskReceivedOrCorrectedInfo;
var parseTaskReviewedInfo = function (task, practitioners, provenances) {
    var reviewProvenance = (0, exports.parseReviewProvenanceForTask)(task, provenances);
    if (!reviewProvenance) {
        return null;
    }
    return {
        action: 'reviewed',
        performer: (0, exports.parseReviewerNameFromProvenance)(reviewProvenance, practitioners), // also may be received with parseReviewerNameFromTask(task, practitioners);
        date: reviewProvenance.recorded || '',
    };
};
exports.parseTaskReviewedInfo = parseTaskReviewedInfo;
var parseReviewProvenanceForTask = function (task, provenances) {
    return provenances.find(function (provenance) {
        var _a;
        var isRelatedToTask = (_a = task === null || task === void 0 ? void 0 : task.relevantHistory) === null || _a === void 0 ? void 0 : _a.some(function (history) {
            var _a;
            return (_a = history.reference) === null || _a === void 0 ? void 0 : _a.includes("Provenance/".concat(provenance.id));
        });
        var isReviewActivity = (0, exports.isProvenanceReviewActivity)(provenance);
        return isRelatedToTask && isReviewActivity;
    });
};
exports.parseReviewProvenanceForTask = parseReviewProvenanceForTask;
var isProvenanceReviewActivity = function (provenance) {
    var _a, _b;
    return (((_b = (_a = provenance.activity) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === utils_1.PROVENANCE_ACTIVITY_CODES.review && coding.system === utils_1.PROVENANCE_ACTIVITY_TYPE_SYSTEM; })) || false);
};
exports.isProvenanceReviewActivity = isProvenanceReviewActivity;
var parseReviewerNameFromProvenance = function (provenance, practitioners) {
    var _a;
    if (!provenance.agent || provenance.agent.length === 0) {
        return '';
    }
    var agentReference = (_a = provenance.agent[0].who) === null || _a === void 0 ? void 0 : _a.reference;
    if (!agentReference || !agentReference.startsWith('Practitioner/')) {
        return '';
    }
    var practitionerId = agentReference.replace('Practitioner/', '');
    return (0, exports.parsePractitionerName)(practitionerId, practitioners);
};
exports.parseReviewerNameFromProvenance = parseReviewerNameFromProvenance;
/**
 * Parses and returns the results details sorted by received date.
 * The business logic depends on parseResults and parseTasks to filter the results and tasks.
 */
var parseLResultsDetails = function (serviceRequest, results, tasks, practitioners, provenances, labGeneratedResults, resultPDFs, cache) {
    console.log('parsing external lab order results for service request', serviceRequest.id);
    if (!serviceRequest.id) {
        return [];
    }
    var _a = (cache === null || cache === void 0 ? void 0 : cache.parsedResults) || (0, exports.parseResults)(serviceRequest, results), orderedFinalAndCorrectedResults = _a.orderedFinalAndCorrectedResults, reflexFinalAndCorrectedResults = _a.reflexFinalAndCorrectedResults, orderedPrelimResults = _a.orderedPrelimResults, reflexPrelimResults = _a.reflexPrelimResults, orderedCancelledResults = _a.orderedCancelledResults, reflexCancelledResults = _a.reflexCancelledResults;
    // todo labs i dont think we need the reflex arrays anymore
    var _b = (cache === null || cache === void 0 ? void 0 : cache.parsedTasks) ||
        (0, exports.parseTasks)({
            tasks: tasks,
            serviceRequest: serviceRequest,
            results: results,
        }), orderedFinalTasks = _b.orderedFinalTasks, reflexFinalTasks = _b.reflexFinalTasks, orderedPrelimTasks = _b.orderedPrelimTasks, reflexPrelimTasks = _b.reflexPrelimTasks, orderedCorrectedTasks = _b.orderedCorrectedTasks, reflexCorrectedTasks = _b.reflexCorrectedTasks, orderedCancelledResultsTasks = _b.orderedCancelledResultsTasks, reflexCancelledResultsTasks = _b.reflexCancelledResultsTasks;
    var resultsDetails = [];
    [
        {
            results: orderedFinalAndCorrectedResults,
            tasks: __spreadArray(__spreadArray([], orderedFinalTasks, true), orderedCorrectedTasks, true),
            testType: 'ordered',
            resultType: 'final',
        },
        {
            results: reflexFinalAndCorrectedResults,
            tasks: __spreadArray(__spreadArray([], reflexFinalTasks, true), reflexCorrectedTasks, true),
            testType: 'reflex',
            resultType: 'final',
        },
        {
            results: orderedPrelimResults,
            tasks: orderedPrelimTasks,
            testType: 'ordered',
            resultType: 'preliminary',
        },
        {
            results: reflexPrelimResults,
            tasks: reflexPrelimTasks,
            testType: 'reflex',
            resultType: 'preliminary',
        },
        {
            results: orderedCancelledResults,
            tasks: orderedCancelledResultsTasks,
            testType: 'ordered',
            resultType: 'cancelled',
        },
        {
            results: reflexCancelledResults,
            tasks: reflexCancelledResultsTasks,
            testType: 'ordered',
            resultType: 'cancelled',
        },
    ].forEach(function (_a) {
        var results = _a.results, tasks = _a.tasks, testType = _a.testType, resultType = _a.resultType;
        results.forEach(function (result) {
            var _a, _b;
            var details = (0, exports.parseResultDetails)(result, tasks, serviceRequest);
            var task = (0, exports.filterResourcesBasedOnDiagnosticReports)(tasks, [result]).sort(function (a, b) {
                return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
            })[0];
            var reviewedDate = ((_a = (0, exports.parseTaskReviewedInfo)(task, practitioners, provenances)) === null || _a === void 0 ? void 0 : _a.date) || null;
            var labGeneratedResultUrls = labGeneratedResults === null || labGeneratedResults === void 0 ? void 0 : labGeneratedResults.filter(function (labDoc) { return result.id && labDoc.diagnosticReportIds.includes(result.id); }).map(function (doc) { return doc === null || doc === void 0 ? void 0 : doc.presignedURL; });
            var resultPdfUrl = ((_b = resultPDFs === null || resultPDFs === void 0 ? void 0 : resultPDFs.find(function (pdf) { return result.id && pdf.diagnosticReportIds.includes(result.id); })) === null || _b === void 0 ? void 0 : _b.presignedURL) || null;
            if (details) {
                resultsDetails.push(__assign(__assign({}, details), { testType: testType, resultType: resultType, reviewedDate: reviewedDate, resultPdfUrl: resultPdfUrl, labGeneratedResultUrls: labGeneratedResultUrls }));
            }
        });
    });
    return resultsDetails.sort(function (a, b) { return (0, utils_1.compareDates)(a.receivedDate, b.receivedDate); });
};
exports.parseLResultsDetails = parseLResultsDetails;
var parseResultDetails = function (result, tasks, serviceRequest) {
    var _a, _b, _c, _d;
    // possible to have multiple a RFRT with status completed and RCRT with status ready or completed. We really only want the latest task
    var task = (0, exports.filterResourcesBasedOnDiagnosticReports)(tasks, [result]).sort(function (a, b) {
        return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn);
    })[0];
    if (!(task === null || task === void 0 ? void 0 : task.id) || !(result === null || result === void 0 ? void 0 : result.id) || !serviceRequest.id) {
        console.log("Task not found for result: ".concat(result.id, ", if Task exists check if it has valid status and code."));
        return null;
    }
    var PSTTask = (0, exports.parseTaskPST)(tasks, serviceRequest.id);
    var details = {
        testItem: ((_a = result.code) === null || _a === void 0 ? void 0 : _a.text) || ((_d = (_c = (_b = result.code) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.display) || 'Unknown Test',
        labStatus: (0, exports.parseLabOrderStatusWithSpecificTask)(result, task, serviceRequest, PSTTask),
        diagnosticReportId: result.id,
        taskId: task.id,
        receivedDate: task.authoredOn || '',
        alternatePlacerId: (0, utils_1.getAdditionalPlacerId)(result),
    };
    return details;
};
exports.parseResultDetails = parseResultDetails;
var parseTaskPST = function (tasks, serviceRequestId) {
    var relatedTasks = (0, exports.filterResourcesBasedOnServiceRequest)(tasks, serviceRequestId);
    for (var _i = 0, relatedTasks_1 = relatedTasks; _i < relatedTasks_1.length; _i++) {
        var task = relatedTasks_1[_i];
        if ((0, exports.isTaskPST)(task)) {
            return task;
        }
    }
    return null;
};
exports.parseTaskPST = parseTaskPST;
var isTaskPST = function (task) {
    var _a, _b;
    return (((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === utils_1.LAB_ORDER_TASK.system && coding.code === utils_1.LAB_ORDER_TASK.code.preSubmission; })) || false);
};
exports.isTaskPST = isTaskPST;
var isTaskFinal = function (task) {
    var _a, _b;
    return (((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === utils_1.LAB_ORDER_TASK.system && coding.code === utils_1.LAB_ORDER_TASK.code.reviewFinalResult; })) || false);
};
exports.isTaskFinal = isTaskFinal;
var isTaskPrelim = function (task) {
    var _a, _b;
    return (((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === utils_1.LAB_ORDER_TASK.system && coding.code === utils_1.LAB_ORDER_TASK.code.reviewPreliminaryResult; })) || false);
};
exports.isTaskPrelim = isTaskPrelim;
var isTaskCorrected = function (task) {
    var _a, _b;
    return (((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === utils_1.LAB_ORDER_TASK.system && coding.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult; })) || false);
};
exports.isTaskCorrected = isTaskCorrected;
var isTaskCancelledResult = function (task) {
    var _a, _b;
    return (((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === utils_1.LAB_ORDER_TASK.system && coding.code === utils_1.LAB_ORDER_TASK.code.reviewCancelledResult; })) || false);
};
var mapResourcesFromBundleEntry = function (bundleEntry) {
    return (bundleEntry || [])
        .filter(function (entry) { var _a, _b; return (_b = (_a = entry.response) === null || _a === void 0 ? void 0 : _a.status) === null || _b === void 0 ? void 0 : _b.startsWith('2'); }) // todo: should we filter out failed responses like this?
        .map(function (entry) { return entry.resource; })
        .filter(Boolean);
};
exports.mapResourcesFromBundleEntry = mapResourcesFromBundleEntry;
var filterResourcesBasedOnTargetResource = function (_a) {
    var resources = _a.resources, targetResourceId = _a.targetResourceId, targetResourceType = _a.targetResourceType;
    return resources.filter(function (resource) { var _a; return (_a = resource.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (basedOn) { return basedOn.reference === "".concat(targetResourceType, "/").concat(targetResourceId); }); });
};
exports.filterResourcesBasedOnTargetResource = filterResourcesBasedOnTargetResource;
var filterResourcesBasedOnServiceRequest = function (resources, serviceRequestId) {
    return (0, exports.filterResourcesBasedOnTargetResource)({
        resources: resources,
        targetResourceId: serviceRequestId,
        targetResourceType: 'ServiceRequest',
    });
};
exports.filterResourcesBasedOnServiceRequest = filterResourcesBasedOnServiceRequest;
var filterResourcesBasedOnDiagnosticReports = function (resources, results) {
    var resultsIds = results
        .map(function (result) { return result.id; })
        .filter(function (id) { return typeof id === 'string' && id.length > 0; });
    if (!resultsIds.length) {
        return [];
    }
    var result = [];
    for (var _i = 0, resultsIds_1 = resultsIds; _i < resultsIds_1.length; _i++) {
        var resultId = resultsIds_1[_i];
        var relatedResources = (0, exports.filterResourcesBasedOnTargetResource)({
            resources: resources,
            targetResourceId: resultId,
            targetResourceType: 'DiagnosticReport',
        });
        result.push.apply(result, relatedResources);
    }
    return result;
};
exports.filterResourcesBasedOnDiagnosticReports = filterResourcesBasedOnDiagnosticReports;
var filterFinalTasks = function (tasks, results) {
    var relatedTasks = (0, exports.filterResourcesBasedOnDiagnosticReports)(tasks, results);
    return relatedTasks.filter(exports.isTaskFinal);
};
exports.filterFinalTasks = filterFinalTasks;
var filterPrelimTasks = function (tasks, results) {
    var relatedTasks = (0, exports.filterResourcesBasedOnDiagnosticReports)(tasks, results);
    return relatedTasks.filter(exports.isTaskPrelim);
};
exports.filterPrelimTasks = filterPrelimTasks;
var filterCorrectedTasks = function (tasks, results) {
    var relatedTasks = (0, exports.filterResourcesBasedOnDiagnosticReports)(tasks, results);
    return relatedTasks.filter(exports.isTaskCorrected);
};
exports.filterCorrectedTasks = filterCorrectedTasks;
var filterCancelledResultsTasks = function (tasks, results) {
    var relatedTasks = (0, exports.filterResourcesBasedOnDiagnosticReports)(tasks, results);
    return relatedTasks.filter(isTaskCancelledResult);
};
exports.filterCancelledResultsTasks = filterCancelledResultsTasks;
var parseDx = function (serviceRequest) {
    var _a;
    return (((_a = serviceRequest.reasonCode) === null || _a === void 0 ? void 0 : _a.map(function (reasonCode) {
        var _a;
        return ((_a = reasonCode.coding) === null || _a === void 0 ? void 0 : _a.map(function (coding) { return "".concat(coding.code, " ").concat(coding.display).trim(); }).filter(Boolean).join('; ')) ||
            (reasonCode === null || reasonCode === void 0 ? void 0 : reasonCode.text) ||
            '';
    }).filter(Boolean).join('; ')) || '');
};
exports.parseDx = parseDx;
// RPRT (Review Preliminary Result Task), RFRT (Review Final Results Tasks), and RCRT (Review Corrected Result Task) are based on DiagnosticReport
var parseResultByTask = function (task, results) {
    var _a;
    var taskBasedOn = ((_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.map(function (basedOn) { return basedOn.reference; }).filter(Boolean)) || [];
    return results.filter(function (result) {
        var resultId = result.id;
        return taskBasedOn.includes("DiagnosticReport/".concat(resultId));
    });
};
exports.parseResultByTask = parseResultByTask;
var parseQuestionnaireResponseItems = function (questionnaireResponse, questionnaire) {
    var _a;
    var questionnaireResponseItems = (_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.map(function (item) {
        var _a, _b;
        var question = (_a = questionnaire.item) === null || _a === void 0 ? void 0 : _a.find(function (q) { return q.linkId === item.linkId; });
        if (!question) {
            throw new Error("question ".concat(item.linkId, " is not found"));
        }
        return {
            linkId: item.linkId,
            type: question.type,
            response: (_b = item.answer) === null || _b === void 0 ? void 0 : _b.map(function (answer) {
                if (question.type === 'text') {
                    return answer.valueString;
                }
                else if (question.type === 'boolean') {
                    return answer.valueBoolean;
                }
                else if (question.type === 'date') {
                    return answer.valueDate;
                }
                else if (question.type === 'decimal') {
                    return answer.valueDecimal;
                }
                else if (question.type === 'integer') {
                    return answer.valueInteger;
                }
                else if (question.type === 'choice') {
                    return answer.valueString;
                }
                else {
                    throw new Error("Unknown question type: ".concat(question.type));
                }
            }),
        };
    });
    return questionnaireResponseItems || [];
};
exports.parseQuestionnaireResponseItems = parseQuestionnaireResponseItems;
var parseSamples = function (serviceRequest, specimens) {
    var _a, _b, _c, _d, _e, _f, _g;
    console.log('parsing samples for service request & specimen', serviceRequest.id, specimens === null || specimens === void 0 ? void 0 : specimens.length);
    var NOT_FOUND = 'Not specified';
    if (!serviceRequest.contained || !serviceRequest.contained.length) {
        console.log('Error: No contained resources found in serviceRequest');
        return [];
    }
    var activityDefinition = serviceRequest.contained.find(function (resource) { return resource.resourceType === 'ActivityDefinition'; });
    if (!activityDefinition || !activityDefinition.specimenRequirement) {
        console.log('Error: No specimenRequirement found in activityDefinition');
        return [];
    }
    var specimenDefinitionRefs = activityDefinition.specimenRequirement.map(function (req) { return req.reference; });
    var result = [];
    var _loop_4 = function (i) {
        var ref = specimenDefinitionRefs[i];
        if (!ref) {
            console.log('Error: No reference found in specimenDefinitionRefs');
            return "continue";
        }
        var specDefId = ref.startsWith('#') ? ref.substring(1) : ref;
        var specimenDefinition = serviceRequest.contained.find(function (resource) { return resource.resourceType === 'SpecimenDefinition' && resource.id === specDefId; });
        if (!specimenDefinition) {
            console.log("Error: SpecimenDefinition with id ".concat(specDefId, " not found in contained resources"));
            return "continue";
        }
        if (!('typeTested' in specimenDefinition)) {
            console.log("Error: SpecimenDefinition ".concat(specDefId, " has no typeTested."));
            return "continue";
        }
        if (!Array.isArray(specimenDefinition.typeTested) || specimenDefinition.typeTested.length === 0) {
            console.log("Error: SpecimenDefinition ".concat(specDefId, " is not array or empty."));
            return "continue";
        }
        // by the dev design typeTestedInfo should have preferred preference
        var typeTestedInfo = specimenDefinition.typeTested.find(function (item) { return item.preference === 'preferred'; });
        if (!typeTestedInfo) {
            console.log("Error: SpecimenDefinition ".concat(specDefId, " has no typeTested with preference = 'preferred'"));
        }
        var container = (_a = typeTestedInfo === null || typeTestedInfo === void 0 ? void 0 : typeTestedInfo.container) === null || _a === void 0 ? void 0 : _a.description;
        var minimumVolume = (_b = typeTestedInfo === null || typeTestedInfo === void 0 ? void 0 : typeTestedInfo.container) === null || _b === void 0 ? void 0 : _b.minimumVolumeString;
        // by dev design for storage requirements handling[0].instruction should be used
        var storageRequirements = (_d = (_c = typeTestedInfo === null || typeTestedInfo === void 0 ? void 0 : typeTestedInfo.handling) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.instruction;
        var volumeInfo = (_e = specimenDefinition.collection) === null || _e === void 0 ? void 0 : _e.find(function (item) {
            var _a;
            return (_a = item.coding) === null || _a === void 0 ? void 0 : _a.some(function (code) {
                return code.system === utils_1.SPECIMEN_CODING_CONFIG.collection.system &&
                    code.code === utils_1.SPECIMEN_CODING_CONFIG.collection.code.specimenVolume;
            });
        });
        var volume = volumeInfo === null || volumeInfo === void 0 ? void 0 : volumeInfo.text;
        var instructionsInfo = (_f = specimenDefinition.collection) === null || _f === void 0 ? void 0 : _f.find(function (item) {
            var _a;
            return (_a = item.coding) === null || _a === void 0 ? void 0 : _a.some(function (code) {
                return code.system === utils_1.SPECIMEN_CODING_CONFIG.collection.system &&
                    code.code === utils_1.SPECIMEN_CODING_CONFIG.collection.code.collectionInstructions;
            });
        });
        var collectionInstructions = instructionsInfo === null || instructionsInfo === void 0 ? void 0 : instructionsInfo.text;
        var relatedSpecimens = specimens.filter(function (spec) {
            var _a, _b, _c;
            var isMatchServiceRequest = (_a = spec.request) === null || _a === void 0 ? void 0 : _a.some(function (req) { return req.reference === "ServiceRequest/".concat(serviceRequest.id); });
            if (!isMatchServiceRequest) {
                return false;
            }
            var relatedSdId = (_c = (_b = spec.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.RELATED_SPECIMEN_DEFINITION_SYSTEM; })) === null || _c === void 0 ? void 0 : _c.valueString;
            if (!relatedSdId) {
                return false;
            }
            return relatedSdId === specimenDefinition.id;
        });
        if (relatedSpecimens.length > 1) {
            console.log("Error: More than one specimen found for ServiceRequest/".concat(serviceRequest.id, " and SpecimenDefinition/").concat(specDefId));
            return "continue";
        }
        var specimen = relatedSpecimens[0];
        if (!(specimen === null || specimen === void 0 ? void 0 : specimen.id)) {
            console.log("Error: No matching specimen found for ServiceRequest/".concat(serviceRequest.id, " and SpecimenDefinition/").concat(specDefId));
            return "continue";
        }
        var collectionDate = (_g = specimen.collection) === null || _g === void 0 ? void 0 : _g.collectedDateTime;
        var logAboutMissingData = function (info) { return console.log("Warning: ".concat(info, " is undefined")); };
        result.push({
            specimen: {
                id: specimen.id,
                collectionDate: collectionDate,
            },
            definition: {
                container: container || (logAboutMissingData('container'), NOT_FOUND),
                volume: volume || (logAboutMissingData('volume'), NOT_FOUND),
                minimumVolume: minimumVolume || (logAboutMissingData('minimumVolume'), NOT_FOUND),
                storageRequirements: storageRequirements || (logAboutMissingData('storageRequirements'), NOT_FOUND),
                collectionInstructions: collectionInstructions || (logAboutMissingData('collectionInstructions'), NOT_FOUND),
            },
        });
    };
    for (var i = 0; i < specimenDefinitionRefs.length; i++) {
        _loop_4(i);
    }
    return result;
};
exports.parseSamples = parseSamples;
var parsePatientLabItems = function (serviceRequests) {
    var labItemsMap = new Map();
    serviceRequests.forEach(function (serviceRequest) {
        var _a, _b;
        var activityDefinition = (_a = serviceRequest.contained) === null || _a === void 0 ? void 0 : _a.find(function (resource) { return resource.resourceType === 'ActivityDefinition'; });
        if ((_b = activityDefinition === null || activityDefinition === void 0 ? void 0 : activityDefinition.code) === null || _b === void 0 ? void 0 : _b.coding) {
            activityDefinition.code.coding.forEach(function (coding) {
                if (coding.code && coding.display && coding.system === utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM) {
                    labItemsMap.set(coding.code, {
                        code: coding.code,
                        display: coding.display,
                    });
                }
            });
        }
    });
    return Array.from(labItemsMap.values()).sort(function (a, b) { return a.display.localeCompare(b.display); });
};
exports.parsePatientLabItems = parsePatientLabItems;
var getAllServiceRequestsForPatient = function (oystehr, patientId) { return __awaiter(void 0, void 0, void 0, function () {
    var baseSearchParams, offset, serviceRequestsMap, bundle, processPageResults, allServiceRequests;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('Fetching ALL service requests for patient:', patientId);
                baseSearchParams = [
                    {
                        name: 'subject',
                        value: "Patient/".concat(patientId),
                    },
                    {
                        name: 'code',
                        value: "".concat(utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM, "|"),
                    },
                    {
                        name: 'code:missing',
                        value: 'false',
                    },
                    {
                        name: '_count',
                        value: '100',
                    },
                    {
                        name: '_sort',
                        value: '-_lastUpdated',
                    },
                ];
                offset = 0;
                serviceRequestsMap = new Map();
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: __spreadArray(__spreadArray([], baseSearchParams, true), [{ name: '_offset', value: offset.toString() }], false),
                    })];
            case 1:
                bundle = _b.sent();
                processPageResults = function (pageBundle) {
                    var _a;
                    (_a = pageBundle.entry) === null || _a === void 0 ? void 0 : _a.map(function (entry) { return entry.resource; }).filter(function (sr) {
                        var _a;
                        return (_a = sr.contained) === null || _a === void 0 ? void 0 : _a.some(function (contained) { return contained.resourceType === 'ActivityDefinition'; });
                    }).forEach(function (sr) {
                        if (sr.id) {
                            serviceRequestsMap.set(sr.id, sr);
                        }
                    });
                };
                processPageResults(bundle);
                _b.label = 2;
            case 2:
                if (!((_a = bundle.link) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 4];
                offset += 100;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: __spreadArray(__spreadArray([], baseSearchParams.filter(function (param) { return param.name !== '_offset'; }), true), [
                            { name: '_offset', value: offset.toString() },
                        ], false),
                    })];
            case 3:
                bundle = _b.sent();
                processPageResults(bundle);
                return [3 /*break*/, 2];
            case 4:
                allServiceRequests = Array.from(serviceRequestsMap.values());
                console.log("Found ".concat(allServiceRequests.length, " unique service requests for patient"));
                return [2 /*return*/, allServiceRequests];
        }
    });
}); };
exports.getAllServiceRequestsForPatient = getAllServiceRequestsForPatient;
var parseLocation = function (serviceRequest, locations) {
    console.log("Parsing location for ServiceRequest/".concat(serviceRequest.id));
    console.log("These are the possible Locations", locations.map(function (location) { return location.id; }));
    if (!serviceRequest.locationReference || !serviceRequest.locationReference.length || !locations.length)
        return undefined;
    // assuming it's the first location
    var locationRef = serviceRequest.locationReference[0].reference;
    if (!locationRef || !locationRef.startsWith('Location/')) {
        console.log("Missing or misconfigured Location ref from ServiceRequest/".concat(serviceRequest.id));
        return undefined;
    }
    var location = locations.find(function (loc) { return "Location/".concat(loc.id) === locationRef; });
    console.log("parsed location from ServiceRequest/".concat(serviceRequest.id, ": ").concat(location === null || location === void 0 ? void 0 : location.id));
    return location;
};
var labOrderCommunicationType = function (communication) {
    var _a;
    var commType = undefined;
    (_a = communication.category) === null || _a === void 0 ? void 0 : _a.forEach(function (cat) {
        var _a;
        return (_a = cat.coding) === null || _a === void 0 ? void 0 : _a.forEach(function (code) {
            if (code.system === utils_1.LABS_COMMUNICATION_CATEGORY_SYSTEM) {
                if (code.code === utils_1.LAB_ORDER_LEVEL_NOTE_CATEGORY.code) {
                    commType = 'order-level-note';
                }
                if (code.code === utils_1.LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY.code) {
                    commType = 'clinical-info-note';
                }
            }
        });
    });
    return commType;
};
exports.labOrderCommunicationType = labOrderCommunicationType;
var parseLabCommunicationsForServiceRequest = function (communications, serviceRequest) {
    var notes = { orderLevelNoteByUser: undefined, clinicalInfoNoteByUser: undefined };
    if (!communications)
        return notes;
    var orderLevelNotesByUser = communications.orderLevelNotesByUser, clinicalInfoNotesByUser = communications.clinicalInfoNotesByUser;
    var srReference = "ServiceRequest/".concat(serviceRequest.id);
    notes.orderLevelNoteByUser = getContentStringFromCommForSr(orderLevelNotesByUser, utils_1.LAB_ORDER_LEVEL_NOTE_CATEGORY.code, srReference);
    notes.clinicalInfoNoteByUser = getContentStringFromCommForSr(clinicalInfoNotesByUser, utils_1.LAB_ORDER_CLINICAL_INFO_COMM_CATEGORY.code, srReference);
    return notes;
};
var getContentStringFromCommForSr = function (communications, communicationCode, serviceRequestRef) {
    console.log('parsing', communicationCode, 'from', communications);
    var filteredCommunications = communications === null || communications === void 0 ? void 0 : communications.filter(function (comm) {
        var _a, _b;
        return ((_a = comm.category) === null || _a === void 0 ? void 0 : _a.find(function (cat) {
            var _a;
            return (_a = cat.coding) === null || _a === void 0 ? void 0 : _a.find(function (code) { return code.system === utils_1.LABS_COMMUNICATION_CATEGORY_SYSTEM && code.code === communicationCode; });
        })) && ((_b = comm.basedOn) === null || _b === void 0 ? void 0 : _b.some(function (ref) { return ref.reference === serviceRequestRef; }));
    });
    if (filteredCommunications.length === 0)
        return;
    var contentStrings = filteredCommunications
        .flatMap(function (comm) { var _a; return ((_a = comm.payload) !== null && _a !== void 0 ? _a : []).map(function (p) { return p.contentString; }); })
        .filter(Boolean);
    if (contentStrings.length === 0)
        return;
    return contentStrings.join('; ');
};

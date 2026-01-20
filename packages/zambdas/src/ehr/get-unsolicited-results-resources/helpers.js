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
exports.handleUnsolicitedResultPatientListRequest = exports.handleUnsolicitedResultDetailRequest = exports.handleGetPossibleRelatedRequestsToUnsolicitedResult = exports.handleUnsolicitedRequestMatch = exports.handleGetTasks = exports.handleIconResourceRequest = exports.getUnsolicitedResultResourcesResourcesByDR = void 0;
var utils_1 = require("utils");
var helpers_1 = require("../get-lab-orders/helpers");
var labs_1 = require("../shared/labs");
var getUnsolicitedResultResourcesResourcesByDR = function (oystehr, additionalQueryParams) { return __awaiter(void 0, void 0, void 0, function () {
    var additionalParams, resourceSearch;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                additionalParams = additionalQueryParams ? additionalQueryParams : [];
                console.log('executing resource search request for unsolicited results by diagnostic report');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DiagnosticReport',
                        params: __spreadArray([
                            {
                                name: '_tag',
                                value: 'unsolicited',
                            }
                        ], additionalParams, true),
                    })];
            case 1:
                resourceSearch = (_a.sent()).unbundle();
                return [2 /*return*/, resourceSearch];
        }
    });
}); };
exports.getUnsolicitedResultResourcesResourcesByDR = getUnsolicitedResultResourcesResourcesByDR;
var handleIconResourceRequest = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var resources;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.getUnsolicitedResultResourcesResourcesByDR)(oystehr, [
                    { name: '_has:Task:based-on:status', value: 'ready,in-progress' },
                    { name: '_revinclude', value: 'Task:based-on' },
                ])];
            case 1:
                resources = _a.sent();
                return [2 /*return*/, {
                        tasksAreReady: resources.length > 0,
                    }];
        }
    });
}); };
exports.handleIconResourceRequest = handleIconResourceRequest;
var handleGetTasks = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var resources, groupedResources, rows;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.getUnsolicitedResultResourcesResourcesByDR)(oystehr, [
                    { name: '_has:Task:based-on:status', value: 'ready,in-progress' },
                    { name: '_revinclude', value: 'Task:based-on' },
                    { name: '_include', value: 'DiagnosticReport:subject' }, // patient
                    { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
                ])];
            case 1:
                resources = _a.sent();
                console.log('grouping the resources returned by diagnostic report', resources.length);
                groupedResources = (0, labs_1.groupResourcesByDr)(resources);
                console.log('formatting the resources for response');
                rows = formatResourcesForTaskTableResponse(groupedResources);
                console.log('returning formatted rows', rows.length);
                return [2 /*return*/, { unsolicitedResultsTasks: rows }];
        }
    });
}); };
exports.handleGetTasks = handleGetTasks;
var handleUnsolicitedRequestMatch = function (oystehr, diagnosticReportId) { return __awaiter(void 0, void 0, void 0, function () {
    var resources, groupedResources, resourcesForDr, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.getUnsolicitedResultResourcesResourcesByDR)(oystehr, [
                    { name: '_has:Task:based-on:status', value: 'ready,in-progress' },
                    { name: '_revinclude', value: 'Task:based-on' },
                    { name: '_id', value: diagnosticReportId },
                    { name: '_include', value: 'DiagnosticReport:subject' }, // patient
                    { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
                ])];
            case 1:
                resources = _a.sent();
                console.log('grouping the resources returned by diagnostic report', resources.length);
                groupedResources = (0, labs_1.groupResourcesByDr)(resources);
                resourcesForDr = groupedResources[diagnosticReportId];
                if (!resourcesForDr) {
                    throw Error("Error parsing resources for diagnostic report: ".concat(diagnosticReportId));
                }
                console.log('formatting the resources for unsolicited result task detail page');
                response = formatResourcesForURMatchTaskResponse(resourcesForDr);
                return [2 /*return*/, response];
        }
    });
}); };
exports.handleUnsolicitedRequestMatch = handleUnsolicitedRequestMatch;
var handleGetPossibleRelatedRequestsToUnsolicitedResult = function (oystehr, diagnosticReportId, patientId) { return __awaiter(void 0, void 0, void 0, function () {
    var diagnosticReport, possibleRelatedSRsWithVisitDate, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.get({
                    resourceType: 'DiagnosticReport',
                    id: diagnosticReportId,
                })];
            case 1:
                diagnosticReport = _b.sent();
                if (!diagnosticReport)
                    throw Error("could not find diagnostic report with id ".concat(diagnosticReportId));
                if (!patientId) return [3 /*break*/, 3];
                return [4 /*yield*/, getEncountersPossiblyRelatedToUnsolicitedResult(patientId, diagnosticReport, oystehr)];
            case 2:
                _a = _b.sent();
                return [3 /*break*/, 4];
            case 3:
                _a = null;
                _b.label = 4;
            case 4:
                possibleRelatedSRsWithVisitDate = _a;
                console.log('response for unsolicited results related requests successfully formatted');
                return [2 /*return*/, { possibleRelatedSRsWithVisitDate: possibleRelatedSRsWithVisitDate }];
        }
    });
}); };
exports.handleGetPossibleRelatedRequestsToUnsolicitedResult = handleGetPossibleRelatedRequestsToUnsolicitedResult;
var handleUnsolicitedResultDetailRequest = function (oystehr, diagnosticReportId, token) { return __awaiter(void 0, void 0, void 0, function () {
    var resources, groupedResources, resourcesForDr, diagnosticReportLabDetailDTO, unsolicitedLabDTO;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, exports.getUnsolicitedResultResourcesResourcesByDR)(oystehr, [
                    { name: '_revinclude', value: 'Task:based-on' }, // review task
                    { name: '_id', value: diagnosticReportId },
                    { name: '_include', value: 'DiagnosticReport:subject' }, // patient
                    { name: '_revinclude:iterate', value: 'DocumentReference:related' }, // result pdf
                    { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
                ])];
            case 1:
                resources = _b.sent();
                console.log('grouping the resources returned by diagnostic report', resources.length);
                groupedResources = (0, labs_1.groupResourcesByDr)(resources);
                resourcesForDr = groupedResources[diagnosticReportId];
                if (!resourcesForDr)
                    throw Error("Could not get resourcesForDr for diagnosticReport: ".concat(diagnosticReportId));
                return [4 /*yield*/, (0, labs_1.formatResourcesIntoDiagnosticReportLabDTO)(resourcesForDr, token)];
            case 2:
                diagnosticReportLabDetailDTO = _b.sent();
                if (!diagnosticReportLabDetailDTO) {
                    throw Error("no diagnosticReportLabDetailDTO for unsolicited result ".concat(diagnosticReportId));
                }
                unsolicitedLabDTO = formatResourcesIntoUnsolicitedLabDTO(diagnosticReportLabDetailDTO, ((_a = resourcesForDr.patient) === null || _a === void 0 ? void 0 : _a.id) || '');
                return [2 /*return*/, { unsolicitedLabDTO: unsolicitedLabDTO }];
        }
    });
}); };
exports.handleUnsolicitedResultDetailRequest = handleUnsolicitedResultDetailRequest;
var handleUnsolicitedResultPatientListRequest = function (oystehr, patientId) { return __awaiter(void 0, void 0, void 0, function () {
    var resources, groupedResources, unsolicitedLabListDTOs, sortedLabs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.getUnsolicitedResultResourcesResourcesByDR)(oystehr, [
                    { name: 'subject', value: "Patient/".concat(patientId) },
                    { name: '_revinclude', value: 'Task:based-on' }, // review task
                    { name: '_include', value: 'DiagnosticReport:performer' }, // lab org
                ])];
            case 1:
                resources = _a.sent();
                console.log('grouping the resources returned by diagnostic report', resources.length);
                groupedResources = (0, labs_1.groupResourcesByDr)(resources);
                unsolicitedLabListDTOs = formateResourcesIntoUnsolicitedLabListPageDTO(groupedResources);
                sortedLabs = unsolicitedLabListDTOs.sort(function (a, b) {
                    return (0, utils_1.compareDates)(a.lastResultReceivedDate, b.lastResultReceivedDate);
                });
                return [2 /*return*/, { unsolicitedLabListDTOs: sortedLabs }];
        }
    });
}); };
exports.handleUnsolicitedResultPatientListRequest = handleUnsolicitedResultPatientListRequest;
var formatResourcesForTaskTableResponse = function (resources) {
    var rows = Object.values(resources).flatMap(function (relatedResources) {
        var taskDetails = [];
        relatedResources.readyTasks.forEach(function (task) {
            var _a, _b, _c;
            var taskCode = (_c = (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (c) { return c.system === utils_1.LAB_ORDER_TASK.system; })) === null || _c === void 0 ? void 0 : _c.code;
            if (taskCode && taskIsLabRelated(taskCode)) {
                var diagnosticReport = relatedResources.diagnosticReport, patient = relatedResources.patient, labOrg = relatedResources.labOrg;
                var taskRowDescription = getURDescriptionText(taskCode, diagnosticReport, patient, labOrg);
                var _d = getURActionTextAndUrl(taskCode, diagnosticReport), actionText = _d.actionText, actionUrl = _d.actionUrl;
                var row = {
                    diagnosticReportId: diagnosticReport.id || 'unknown',
                    actionText: actionText,
                    actionUrl: actionUrl,
                    taskRowDescription: taskRowDescription,
                    resultsReceivedDateTime: diagnosticReport.effectiveDateTime || 'unknown',
                };
                taskDetails.push(row);
            }
        });
        return taskDetails;
    });
    return rows;
};
var getURDescriptionText = function (code, diagnosticReport, patient, labOrg) {
    var testDescription = (0, utils_1.getTestNameOrCodeFromDr)(diagnosticReport);
    var labName = (labOrg === null || labOrg === void 0 ? void 0 : labOrg.name) || 'Source lab not specified';
    // only matched results will have patient linked
    var patientName = patient ? (0, utils_1.getFullestAvailableName)(patient, true) : undefined;
    switch (code) {
        case utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult: {
            return 'Match unsolicited test results';
        }
        case utils_1.LAB_ORDER_TASK.code.reviewCancelledResult:
        case utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult:
        case utils_1.LAB_ORDER_TASK.code.reviewFinalResult:
        case utils_1.LAB_ORDER_TASK.code.reviewPreliminaryResult: {
            if (!patientName) {
                throw Error("Cannot parse patient name for this matched unsolicited result ".concat(diagnosticReport.id));
            }
            return "Review unsolicited test results for \"".concat(testDescription, " / ").concat(labName, "\" for ").concat(patientName);
        }
        default: {
            throw Error("Task code passed to getURDescriptionText does not match expected input: ".concat(code));
        }
    }
};
var getURActionTextAndUrl = function (code, diagnosticReport) {
    switch (code) {
        case utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult: {
            return { actionText: 'Match', actionUrl: "/unsolicited-results/".concat(diagnosticReport.id, "/match") };
        }
        case utils_1.LAB_ORDER_TASK.code.reviewCancelledResult:
        case utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult:
        case utils_1.LAB_ORDER_TASK.code.reviewFinalResult:
        case utils_1.LAB_ORDER_TASK.code.reviewPreliminaryResult: {
            return { actionText: 'Go to Lab Results', actionUrl: "/unsolicited-results/".concat(diagnosticReport.id, "/review") };
        }
        default: {
            throw Error("Task code passed to getURActionText does not match expected input: ".concat(code));
        }
    }
};
var taskIsLabRelated = function (code) {
    var relevantLabCodes = [
        utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult,
        utils_1.LAB_ORDER_TASK.code.reviewCancelledResult,
        utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult,
        utils_1.LAB_ORDER_TASK.code.reviewFinalResult,
        utils_1.LAB_ORDER_TASK.code.reviewPreliminaryResult,
    ];
    return relevantLabCodes.includes(code);
};
var formatResourcesForURMatchTaskResponse = function (resources) {
    var diagnosticReport = resources.diagnosticReport, readyTasks = resources.readyTasks, labOrg = resources.labOrg;
    var _a = getUnsolicitedResourcesFromDr(diagnosticReport), unsolicitedPatient = _a.unsolicitedPatient, unsolicitedProvider = _a.unsolicitedProvider;
    var task = readyTasks.find(function (task) {
        var _a, _b;
        return (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (c) { return c.system === utils_1.LAB_ORDER_TASK.system && c.code === utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult; });
    });
    if (!(task === null || task === void 0 ? void 0 : task.id))
        throw Error("Could not parse match unsolicited result task id");
    var patientName = unsolicitedPatient ? (0, utils_1.getFullestAvailableName)(unsolicitedPatient, true) : undefined;
    var patientDOB = unsolicitedPatient === null || unsolicitedPatient === void 0 ? void 0 : unsolicitedPatient.birthDate;
    var providerName = unsolicitedProvider ? (0, utils_1.getFullestAvailableName)(unsolicitedProvider, true) : undefined;
    var test = (0, utils_1.getTestNameOrCodeFromDr)(diagnosticReport);
    var labName = labOrg === null || labOrg === void 0 ? void 0 : labOrg.name;
    var resultsReceived = diagnosticReport.effectiveDateTime;
    var unsolicitedLabInfo = {
        patientName: patientName,
        patientDOB: patientDOB,
        provider: providerName,
        test: test,
        labName: labName,
        resultsReceived: resultsReceived,
    };
    return { unsolicitedLabInfo: unsolicitedLabInfo, taskId: task.id };
};
var getUnsolicitedResourcesFromDr = function (dr) {
    var _a, _b;
    var unsolicitedPatient;
    var unsolicitedProvider;
    var containedPatient = (_a = dr.contained) === null || _a === void 0 ? void 0 : _a.find(function (resource) { return resource.resourceType === 'Patient' && resource.id === utils_1.DR_UNSOLICITED_PATIENT_REF; });
    if (containedPatient) {
        unsolicitedPatient = containedPatient;
    }
    var containedProvider = (_b = dr.contained) === null || _b === void 0 ? void 0 : _b.find(function (resource) { return resource.resourceType === 'Practitioner' && resource.id === utils_1.DR_CONTAINED_PRACTITIONER_REF; });
    if (containedProvider) {
        unsolicitedProvider = containedProvider;
    }
    return { unsolicitedPatient: unsolicitedPatient, unsolicitedProvider: unsolicitedProvider };
};
// get all encounters with an active service request with the same test code
var getEncountersPossiblyRelatedToUnsolicitedResult = function (patientId, dr, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var testItemCode, resourceSearch, serviceRequests, encounterIdToAppointmentIdMap, appointmentIdToVisitDateMap, uniqueEncounterIds, serviceRequestIdToVisitDateMap, serviceRequestsWithVisitDates;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                testItemCode = (0, utils_1.getTestItemCodeFromDr)(dr);
                console.log('testItemCode parsed from unsolicited result dr:', testItemCode);
                if (!testItemCode)
                    return [2 /*return*/, null];
                console.log('searching for encounters, service requests and appointments with patientId', patientId);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: [
                            {
                                name: 'subject',
                                value: "Patient/".concat(patientId),
                            },
                            {
                                name: 'code',
                                value: testItemCode,
                            },
                            {
                                name: 'status',
                                value: 'active',
                            },
                            {
                                name: '_include',
                                value: 'ServiceRequest:encounter',
                            },
                            {
                                name: '_include:iterate',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
            case 1:
                resourceSearch = (_a.sent()).unbundle();
                serviceRequests = [];
                encounterIdToAppointmentIdMap = {};
                appointmentIdToVisitDateMap = {};
                console.log('resources return, formatting response');
                resourceSearch.forEach(function (resource) {
                    var _a, _b;
                    if (resource.resourceType === 'ServiceRequest')
                        serviceRequests.push(resource);
                    if (resource.resourceType === 'Encounter') {
                        var encounterId = resource.id;
                        var appointmentId = (_b = (_a = resource.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) === null || _b === void 0 ? void 0 : _b.replace('Appointment/', '');
                        if (encounterId && appointmentId) {
                            encounterIdToAppointmentIdMap[encounterId] = appointmentId;
                        }
                    }
                    if (resource.resourceType === 'Appointment') {
                        var appointmentId = resource.id;
                        var visitDate = resource.start;
                        if (appointmentId && visitDate)
                            appointmentIdToVisitDateMap[appointmentId] = visitDate;
                    }
                });
                uniqueEncounterIds = new Set();
                serviceRequests.forEach(function (sr) {
                    var _a, _b;
                    var encounterId = (_b = (_a = sr.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '');
                    if (encounterId) {
                        if (!uniqueEncounterIds.has(encounterId)) {
                            uniqueEncounterIds.add(encounterId);
                        }
                        else {
                            uniqueEncounterIds.delete(encounterId);
                        }
                    }
                });
                console.log('grouping visits dates with service request ids');
                serviceRequestIdToVisitDateMap = {};
                serviceRequests.forEach(function (sr) {
                    var _a, _b;
                    var srId = sr.id;
                    if (srId) {
                        var encounterId = (_b = (_a = sr.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '');
                        if (encounterId) {
                            if (uniqueEncounterIds.has(encounterId)) {
                                var relatedAppointmentId = encounterIdToAppointmentIdMap[encounterId];
                                if (relatedAppointmentId) {
                                    var visitDate = appointmentIdToVisitDateMap[relatedAppointmentId];
                                    if (visitDate) {
                                        serviceRequestIdToVisitDateMap[srId] = visitDate;
                                    }
                                }
                            }
                        }
                    }
                });
                console.log('formatting into array');
                serviceRequestsWithVisitDates = Object.entries(serviceRequestIdToVisitDateMap).map(function (_a) {
                    var srId = _a[0], visitDate = _a[1];
                    return { serviceRequestId: srId, visitDate: visitDate };
                });
                console.log("".concat(serviceRequestsWithVisitDates.length, " service requests with dates to be returned"));
                if (serviceRequestsWithVisitDates.length)
                    return [2 /*return*/, serviceRequestsWithVisitDates];
                return [2 /*return*/, null];
        }
    });
}); };
var formatResourcesIntoUnsolicitedLabDTO = function (diagnosticReportLabDTO, patientId) {
    return __assign(__assign({}, diagnosticReportLabDTO), { isUnsolicited: true, patientId: patientId });
};
var formateResourcesIntoUnsolicitedLabListPageDTO = function (resourcesByDr) {
    console.log('passed in: ', JSON.stringify(resourcesByDr));
    var listDTOs = [];
    Object.values(resourcesByDr).forEach(function (resources) {
        var diagnosticReport = resources.diagnosticReport, labOrg = resources.labOrg, completedTasks = resources.completedTasks, readyTasks = resources.readyTasks;
        // todo this logic is used in two places, we should consolidate into helper
        var matchTask = __spreadArray(__spreadArray([], readyTasks, true), completedTasks, true).find(function (task) {
            var _a, _b;
            return (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) { return c.system === utils_1.LAB_ORDER_TASK.system && c.code === utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult; });
        });
        var reviewTask = __spreadArray(__spreadArray([], readyTasks, true), completedTasks, true).find(function (task) {
            var _a, _b;
            return (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) {
                return c.system === utils_1.LAB_ORDER_TASK.system &&
                    (c.code === utils_1.LAB_ORDER_TASK.code.reviewFinalResult ||
                        c.code === utils_1.LAB_ORDER_TASK.code.reviewPreliminaryResult ||
                        c.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult ||
                        c.code === utils_1.LAB_ORDER_TASK.code.reviewCancelledResult);
            });
        });
        // console.log('check matchTask', JSON.stringify(matchTask));
        // console.log('check reviewTask', JSON.stringify(reviewTask));
        var task = reviewTask || matchTask;
        if (!task) {
            console.log("No tasks found for diagnostic report: ".concat(diagnosticReport.id));
            return;
        }
        else {
            console.log('task id being passed to formateResourcesIntoUnsolicitedLabListPageDTO:', task.id);
        }
        var dto = {
            isUnsolicited: true,
            diagnosticReportId: diagnosticReport.id || '',
            testItem: (0, utils_1.getTestNameOrCodeFromDr)(diagnosticReport),
            fillerLab: (labOrg === null || labOrg === void 0 ? void 0 : labOrg.name) || '',
            orderStatus: (0, helpers_1.parseLabOrderStatusWithSpecificTask)(diagnosticReport, task, undefined, null),
            lastResultReceivedDate: diagnosticReport.effectiveDateTime || '',
            accessionNumbers: [(0, labs_1.parseAccessionNumberFromDr)(diagnosticReport)],
        };
        console.log('dto to pass', JSON.stringify(dto));
        listDTOs.push(dto);
    });
    console.log('list len to return', listDTOs.length);
    return listDTOs;
};

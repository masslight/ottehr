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
exports.parseAppointmentId = exports.parsePaginationFromResponse = exports.EMPTY_PAGINATION = exports.getRadiologyOrders = exports.index = exports.DEFAULT_RADIOLOGY_ITEMS_PER_PAGE = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var shared_2 = require("../shared");
var validation_1 = require("./validation");
exports.DEFAULT_RADIOLOGY_ITEMS_PER_PAGE = 10;
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'radiology-order-list';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (unsafeInput) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, validatedInput, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                secrets = (0, validation_1.validateSecrets)(unsafeInput.secrets);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, (0, validation_1.validateInput)(unsafeInput)];
            case 2:
                validatedInput = _a.sent();
                return [4 /*yield*/, performEffect(validatedInput, oystehr)];
            case 3:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, unsafeInput.secrets))];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (validatedInput, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterIds, patientId, serviceRequestId, _b, itemsPerPage, _c, pageIndex, searchParams;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = validatedInput.body, encounterIds = _a.encounterIds, patientId = _a.patientId, serviceRequestId = _a.serviceRequestId, _b = _a.itemsPerPage, itemsPerPage = _b === void 0 ? exports.DEFAULT_RADIOLOGY_ITEMS_PER_PAGE : _b, _c = _a.pageIndex, pageIndex = _c === void 0 ? 0 : _c;
                searchParams = {
                    patientId: patientId,
                    encounterIds: encounterIds,
                    serviceRequestId: serviceRequestId,
                    itemsPerPage: itemsPerPage,
                    pageIndex: pageIndex,
                };
                return [4 /*yield*/, (0, exports.getRadiologyOrders)(oystehr, searchParams)];
            case 1: return [2 /*return*/, _d.sent()];
        }
    });
}); };
var getRadiologyOrders = function (oystehr_1, _a) { return __awaiter(void 0, [oystehr_1, _a], void 0, function (oystehr, _b) {
    var searchParams, searchResponse, resources, _c, serviceRequests, tasks, diagnosticReports, practitioners, encounters, orders;
    var encounterIds = _b.encounterIds, patientId = _b.patientId, serviceRequestId = _b.serviceRequestId, _d = _b.itemsPerPage, itemsPerPage = _d === void 0 ? 100 : _d, _e = _b.pageIndex, pageIndex = _e === void 0 ? 0 : _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                searchParams = [
                    { name: '_total', value: 'accurate' },
                    { name: '_offset', value: "".concat(pageIndex * itemsPerPage) },
                    { name: '_count', value: "".concat(itemsPerPage) },
                    { name: '_sort', value: '-_lastUpdated' },
                    { name: '_revinclude', value: 'Task:based-on' },
                    { name: '_revinclude', value: 'DiagnosticReport:based-on' },
                    { name: '_include', value: 'ServiceRequest:requester' },
                    { name: '_include', value: 'ServiceRequest:encounter' },
                    { name: '_tag', value: "".concat(shared_2.ORDER_TYPE_CODE_SYSTEM, "|radiology") },
                    { name: 'status:not', value: 'revoked' },
                ];
                if (patientId) {
                    searchParams.push({ name: 'subject', value: "Patient/".concat(patientId) });
                }
                else if (serviceRequestId) {
                    searchParams.push({ name: '_id', value: serviceRequestId });
                }
                else if (encounterIds === null || encounterIds === void 0 ? void 0 : encounterIds.length) {
                    searchParams.push({
                        name: 'encounter',
                        value: encounterIds.map(function (id) { return "Encounter/".concat(id); }).join(','),
                    });
                }
                else {
                    throw new Error('Either encounterId or patientId must be provided, should not happen if validation step worked');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: searchParams,
                    })];
            case 1:
                searchResponse = _f.sent();
                console.log('searchResponse', JSON.stringify(searchResponse, null, 2));
                resources = (searchResponse.entry || [])
                    .map(function (entry) { return entry.resource; })
                    .filter(function (res) { return Boolean(res); });
                _c = extractResources(resources), serviceRequests = _c.serviceRequests, tasks = _c.tasks, diagnosticReports = _c.diagnosticReports, practitioners = _c.practitioners, encounters = _c.encounters;
                if (!serviceRequests.length) {
                    return [2 /*return*/, {
                            orders: [],
                            pagination: exports.EMPTY_PAGINATION,
                        }];
                }
                orders = serviceRequests.map(function (serviceRequest) {
                    return parseResultsToOrder(serviceRequest, tasks, diagnosticReports, practitioners, encounters);
                });
                return [2 /*return*/, {
                        orders: orders,
                        pagination: (0, exports.parsePaginationFromResponse)(searchResponse),
                    }];
        }
    });
}); };
exports.getRadiologyOrders = getRadiologyOrders;
var parseResultsToOrder = function (serviceRequest, tasks, diagnosticReports, practitioners, encounters) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
    if (serviceRequest.id == null) {
        throw new Error('ServiceRequest ID is unexpectedly null');
    }
    var cptCode = (_c = (_b = (_a = serviceRequest.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code;
    if (!cptCode) {
        throw new Error('cptCode is unexpectedly null');
    }
    var diagnosisCode = (_g = (_f = (_e = (_d = serviceRequest.reasonCode) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.code;
    if (!diagnosisCode) {
        throw new Error('diagnosisCode is unexpectedly null');
    }
    var diagnosisDisplay = (_l = (_k = (_j = (_h = serviceRequest.reasonCode) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.coding) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.display;
    if (!diagnosisDisplay) {
        throw new Error('diagnosisDisplay is unexpectedly null');
    }
    var cptCodeDisplay = (_p = (_o = (_m = serviceRequest.code) === null || _m === void 0 ? void 0 : _m.coding) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.display;
    if (!cptCodeDisplay) {
        throw new Error('cptCodeDisplay is unexpectedly null');
    }
    var orderAddedDateTime = serviceRequest.authoredOn;
    if (!orderAddedDateTime) {
        throw new Error('Order added date time is unexpectedly null');
    }
    var myRequestingProvider = practitioners.find(function (practitioner) { var _a, _b; return practitioner.id === ((_b = (_a = serviceRequest.requester) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1]); });
    if (!myRequestingProvider) {
        throw new Error('Service Request has no requesting provider');
    }
    var providerFirstName = (_s = (_r = (_q = myRequestingProvider === null || myRequestingProvider === void 0 ? void 0 : myRequestingProvider.name) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.given) === null || _s === void 0 ? void 0 : _s[0];
    var providerLastName = (_u = (_t = myRequestingProvider === null || myRequestingProvider === void 0 ? void 0 : myRequestingProvider.name) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.family;
    if (!providerFirstName || !providerLastName) {
        throw new Error('Provider name is unexpectedly null');
    }
    var providerName = "".concat(providerLastName, ", ").concat(providerFirstName);
    // TODO can we do provider requesting provider qualifications to render "MD"?
    var status;
    var finalReviewTask = tasks.find(function (task) {
        var _a, _b, _c, _d;
        var basedOnSr = (_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (basedOn) { return basedOn.reference === "ServiceRequest/".concat(serviceRequest.id); });
        var isRadiologyTask = ((_b = task.groupIdentifier) === null || _b === void 0 ? void 0 : _b.value) === utils_1.RADIOLOGY_TASK.category;
        var isFinalReview = (_d = (_c = task.code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.some(function (c) { return c.system === utils_1.RADIOLOGY_TASK.system && c.code === utils_1.RADIOLOGY_TASK.code.reviewFinalResultTask; });
        return basedOnSr && isRadiologyTask && isFinalReview;
    });
    console.log('finalReviewTask found: ', finalReviewTask === null || finalReviewTask === void 0 ? void 0 : finalReviewTask.id);
    var formattedFinalReviewTask;
    // Get all diagnostic reports related to this service request
    var relatedDiagnosticReports = diagnosticReports.filter(function (report) { var _a; return (_a = report.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (basedOn) { return basedOn.reference === "ServiceRequest/".concat(serviceRequest.id); }); });
    // Find the best diagnostic report using our priority logic
    var preliminaryDiagnosticReport = relatedDiagnosticReports.find(function (report) { return report.status === 'preliminary'; });
    var bestDiagnosticReport = takeTheBestDiagnosticReport(relatedDiagnosticReports);
    var result = (_w = (_v = bestDiagnosticReport === null || bestDiagnosticReport === void 0 ? void 0 : bestDiagnosticReport.presentedForm) === null || _v === void 0 ? void 0 : _v.find(function (attachment) { return attachment.contentType === 'text/html'; })) === null || _w === void 0 ? void 0 : _w.data;
    if (serviceRequest.status === 'active') {
        status = utils_1.RadiologyOrderStatus.pending;
    }
    else if (serviceRequest.status === 'completed' && !bestDiagnosticReport) {
        status = utils_1.RadiologyOrderStatus.performed;
    }
    else if ((bestDiagnosticReport === null || bestDiagnosticReport === void 0 ? void 0 : bestDiagnosticReport.status) === 'preliminary') {
        status = utils_1.RadiologyOrderStatus.preliminary;
    }
    else if ((bestDiagnosticReport === null || bestDiagnosticReport === void 0 ? void 0 : bestDiagnosticReport.status) === 'final') {
        if ((finalReviewTask === null || finalReviewTask === void 0 ? void 0 : finalReviewTask.status) === 'completed') {
            status = utils_1.RadiologyOrderStatus.reviewed;
        }
        else {
            status = utils_1.RadiologyOrderStatus.final;
            if (finalReviewTask) {
                var orderDate = (_y = (_x = serviceRequest.extension) === null || _x === void 0 ? void 0 : _x.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL; })) === null || _y === void 0 ? void 0 : _y.valueDateTime;
                formattedFinalReviewTask = {
                    id: (finalReviewTask === null || finalReviewTask === void 0 ? void 0 : finalReviewTask.id) || '',
                    category: utils_1.RADIOLOGY_TASK.category,
                    createdDate: (_z = finalReviewTask === null || finalReviewTask === void 0 ? void 0 : finalReviewTask.authoredOn) !== null && _z !== void 0 ? _z : '',
                    title: 'Review Radiology Final Results',
                    subtitle: "Ordered by ".concat(providerFirstName, " ").concat(providerLastName, " on ").concat((0, utils_1.formatDate)(orderDate !== null && orderDate !== void 0 ? orderDate : '', 'MM/dd/yyyy h:mm a')),
                    status: (finalReviewTask === null || finalReviewTask === void 0 ? void 0 : finalReviewTask.status) || 'unknown',
                    assignee: (finalReviewTask === null || finalReviewTask === void 0 ? void 0 : finalReviewTask.owner)
                        ? {
                            id: (_3 = (_2 = (_1 = (_0 = finalReviewTask.owner) === null || _0 === void 0 ? void 0 : _0.reference) === null || _1 === void 0 ? void 0 : _1.split('/')) === null || _2 === void 0 ? void 0 : _2[1]) !== null && _3 !== void 0 ? _3 : '',
                            name: (_5 = (_4 = finalReviewTask.owner) === null || _4 === void 0 ? void 0 : _4.display) !== null && _5 !== void 0 ? _5 : '',
                            date: (_7 = (_6 = (0, utils_1.getExtension)(finalReviewTask.owner, utils_1.TASK_ASSIGNED_DATE_TIME_EXTENSION_URL)) === null || _6 === void 0 ? void 0 : _6.valueDateTime) !== null && _7 !== void 0 ? _7 : '',
                        }
                        : undefined,
                    completable: true,
                };
            }
        }
    }
    else {
        throw new Error('Order is in an invalid state, could not determine status.');
    }
    var appointmentId = (0, exports.parseAppointmentId)(serviceRequest, encounters);
    var history = buildHistory(serviceRequest, bestDiagnosticReport, preliminaryDiagnosticReport, providerName);
    var clinicalHistory = extractClinicalHistory(serviceRequest);
    return {
        serviceRequestId: serviceRequest.id,
        appointmentId: appointmentId,
        studyType: "".concat(cptCode, " \u2014 ").concat(cptCodeDisplay),
        visitDateTime: '', // TODO
        orderAddedDateTime: orderAddedDateTime,
        providerName: providerName,
        diagnosis: "".concat(diagnosisCode, " \u2014 ").concat(diagnosisDisplay),
        status: status,
        isStat: serviceRequest.priority === 'stat',
        result: result,
        clinicalHistory: clinicalHistory,
        history: history,
        task: formattedFinalReviewTask,
    };
};
var takeTheBestDiagnosticReport = function (diagnosticReports) {
    if (!diagnosticReports.length) {
        return undefined;
    }
    // Filter reports by status priority
    var amendedCorrectedAppended = diagnosticReports.filter(function (report) { return report.status === 'amended' || report.status === 'corrected' || report.status === 'appended'; });
    var finalReports = diagnosticReports.filter(function (report) { return report.status === 'final'; });
    var preliminaryReports = diagnosticReports.filter(function (report) { return report.status === 'preliminary'; });
    // Helper function to get the most recent report by issued datetime
    var getMostRecent = function (reports) {
        if (!reports.length)
            return undefined;
        return reports.reduce(function (mostRecent, current) {
            if (!current.issued)
                return mostRecent;
            if (!mostRecent.issued)
                return current;
            return new Date(current.issued) > new Date(mostRecent.issued) ? current : mostRecent;
        });
    };
    // Apply priority logic
    if (amendedCorrectedAppended.length > 0) {
        return getMostRecent(amendedCorrectedAppended);
    }
    else if (finalReports.length > 0) {
        return getMostRecent(finalReports);
    }
    else if (preliminaryReports.length > 0) {
        return getMostRecent(preliminaryReports);
    }
    // If no reports match the expected statuses, return the first one
    return diagnosticReports[0];
};
var buildHistory = function (serviceRequest, bestDiagnosticReport, preliminaryDiagnosticReport, orderingProviderName) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var history = [];
    var requestedTimeExtensionValue = (_b = (_a = serviceRequest.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL; })) === null || _b === void 0 ? void 0 : _b.valueDateTime;
    if (requestedTimeExtensionValue) {
        history.push({
            status: utils_1.RadiologyOrderStatus.pending,
            performer: orderingProviderName,
            date: requestedTimeExtensionValue,
        });
    }
    var performedHistoryExtensionValue = (_d = (_c = serviceRequest.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL; })) === null || _d === void 0 ? void 0 : _d.valueDateTime;
    if (performedHistoryExtensionValue) {
        history.push({
            status: utils_1.RadiologyOrderStatus.performed,
            performer: 'See AdvaPACS',
            date: performedHistoryExtensionValue,
        });
    }
    var diagnosticReportPreliminaryReadTimeExtensionValueFromBest = (_f = (_e = bestDiagnosticReport === null || bestDiagnosticReport === void 0 ? void 0 : bestDiagnosticReport.extension) === null || _e === void 0 ? void 0 : _e.find(function (ext) { return ext.url === shared_2.DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL; })) === null || _f === void 0 ? void 0 : _f.valueDateTime;
    var diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary = (_h = (_g = preliminaryDiagnosticReport === null || preliminaryDiagnosticReport === void 0 ? void 0 : preliminaryDiagnosticReport.extension) === null || _g === void 0 ? void 0 : _g.find(function (ext) { return ext.url === shared_2.DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL; })) === null || _h === void 0 ? void 0 : _h.valueDateTime;
    if (diagnosticReportPreliminaryReadTimeExtensionValueFromBest) {
        history.push({
            status: utils_1.RadiologyOrderStatus.preliminary,
            performer: 'See AdvaPACS',
            date: diagnosticReportPreliminaryReadTimeExtensionValueFromBest,
        });
    }
    else if (diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary) {
        history.push({
            status: utils_1.RadiologyOrderStatus.preliminary,
            performer: 'See AdvaPACS',
            date: diagnosticReportPreliminaryReadTimeExtensionValueFromPreliminary,
        });
    }
    if (bestDiagnosticReport === null || bestDiagnosticReport === void 0 ? void 0 : bestDiagnosticReport.issued) {
        history.push({
            status: utils_1.RadiologyOrderStatus.final,
            performer: 'See AdvaPACS',
            date: bestDiagnosticReport.issued,
        });
    }
    return history;
};
var extractClinicalHistory = function (serviceRequest) {
    var _a, _b, _c, _d;
    // Find the clinical history extension within the service request
    var clinicalHistoryExtension = (_b = (_a = serviceRequest.extension) === null || _a === void 0 ? void 0 : _a.filter(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PRE_RELEASE_URL; })) === null || _b === void 0 ? void 0 : _b.find(function (orderDetailExt) {
        var _a, _b, _c, _d, _e;
        var parameterExt = (_a = orderDetailExt.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL; });
        var codeExt = (_b = parameterExt === null || parameterExt === void 0 ? void 0 : parameterExt.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_CODE_URL; });
        return ((_e = (_d = (_c = codeExt === null || codeExt === void 0 ? void 0 : codeExt.valueCodeableConcept) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code) === 'clinical-history';
    });
    // Extract the clinical history value
    var parameterExt = (_c = clinicalHistoryExtension === null || clinicalHistoryExtension === void 0 ? void 0 : clinicalHistoryExtension.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_URL; });
    var valueStringExt = (_d = parameterExt === null || parameterExt === void 0 ? void 0 : parameterExt.extension) === null || _d === void 0 ? void 0 : _d.find(function (ext) { return ext.url === shared_2.SERVICE_REQUEST_ORDER_DETAIL_PARAMETER_PRE_RELEASE_VALUE_STRING_URL; });
    return valueStringExt === null || valueStringExt === void 0 ? void 0 : valueStringExt.valueString;
};
var extractResources = function (resources) {
    var serviceRequests = [];
    var tasks = [];
    var results = [];
    var practitioners = [];
    var encounters = [];
    for (var _i = 0, resources_1 = resources; _i < resources_1.length; _i++) {
        var resource = resources_1[_i];
        if (resource.resourceType === 'ServiceRequest') {
            serviceRequests.push(resource);
        }
        else if (resource.resourceType === 'Task') {
            tasks.push(resource);
        }
        else if (resource.resourceType === 'DiagnosticReport') {
            results.push(resource);
        }
        else if (resource.resourceType === 'Practitioner') {
            practitioners.push(resource);
        }
        else if (resource.resourceType === 'Encounter') {
            encounters.push(resource);
        }
    }
    return {
        serviceRequests: serviceRequests,
        tasks: tasks,
        diagnosticReports: results,
        practitioners: practitioners,
        encounters: encounters,
    };
};
exports.EMPTY_PAGINATION = {
    currentPageIndex: 0,
    totalItems: 0,
    totalPages: 0,
};
var parsePaginationFromResponse = function (data) {
    if (!data || typeof data.total !== 'number' || !Array.isArray(data.link)) {
        return exports.EMPTY_PAGINATION;
    }
    var selfLink = data.link.find(function (link) { return link && link.relation === 'self'; });
    if (!selfLink || !selfLink.url) {
        return exports.EMPTY_PAGINATION;
    }
    var totalItems = data.total;
    var selfUrl = new URL(selfLink.url);
    var itemsPerPageStr = selfUrl.searchParams.get('_count');
    if (!itemsPerPageStr) {
        return exports.EMPTY_PAGINATION;
    }
    var itemsPerPage = parseInt(itemsPerPageStr, 10);
    if (!(0, utils_1.isPositiveNumberOrZero)(itemsPerPage)) {
        return exports.EMPTY_PAGINATION;
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
var parseAppointmentId = function (serviceRequest, encounters) {
    var _a, _b, _c;
    var encounterId = parseEncounterId(serviceRequest);
    var NOT_FOUND = '';
    if (!encounterId) {
        return NOT_FOUND;
    }
    var relatedEncounter = encounters.find(function (encounter) { return encounter.id === encounterId; });
    if ((_a = relatedEncounter === null || relatedEncounter === void 0 ? void 0 : relatedEncounter.appointment) === null || _a === void 0 ? void 0 : _a.length) {
        return ((_c = (_b = relatedEncounter.appointment[0]) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/').pop()) || NOT_FOUND;
    }
    return NOT_FOUND;
};
exports.parseAppointmentId = parseAppointmentId;
var parseEncounterId = function (serviceRequest) {
    var _a, _b;
    var NOT_FOUND = '';
    return ((_b = (_a = serviceRequest.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop()) || NOT_FOUND;
};

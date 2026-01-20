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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapResourcesFromBundleEntry = exports.parsePaginationFromResponse = exports.mapProvenanceStatusToTestStatus = exports.parseSpecimenCollectedBy = exports.parseSpecimenSource = exports.parseDiagnoses = exports.parseAttendingPractitioner = exports.parseResultsReceivedDate = exports.parseOrderAddedDate = exports.parseVisitDate = exports.parseEncounterId = exports.parseAppointmentId = exports.findActivityDefinitionForServiceRequest = exports.fetchPractitionersForServiceRequests = exports.extractInHouseResources = exports.createInHouseServiceRequestSearchParams = exports.getInHouseResources = exports.parseTasks = exports.parseOrderData = exports.mapResourcesToInHouseOrderDTOs = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var in_house_labs_1 = require("../shared/in-house-labs");
var labs_1 = require("../shared/labs");
var mapResourcesToInHouseOrderDTOs = function (searchBy, serviceRequests, tasks, practitioners, encounters, appointments, provenances, activityDefinitions, specimens, observations, diagnosticReports, resultsPDFs, ENVIRONMENT, appointmentScheduleMap, currentPractitioner) {
    var result = [];
    var _loop_1 = function (serviceRequest) {
        try {
            var relatedDiagnosticReports = diagnosticReports.filter(function (dr) { var _a; return (_a = dr.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (ref) { return ref.reference === "ServiceRequest/".concat(serviceRequest.id); }); });
            // todo labs team should we be validating the number of items in the array is 1?
            // we should probably fix this in the future, if we ever have a case where a diagnostic report gets linked to more than one service request we will have an issue
            var relatedDiagnosticReport = relatedDiagnosticReports[0];
            var drId_1 = relatedDiagnosticReport === null || relatedDiagnosticReport === void 0 ? void 0 : relatedDiagnosticReport.id;
            var resultsPDF = drId_1 ? resultsPDFs.find(function (pdf) { return pdf.diagnosticReportIds.includes(drId_1); }) : undefined;
            result.push((0, exports.parseOrderData)({
                searchBy: searchBy,
                serviceRequest: serviceRequest,
                tasks: tasks,
                practitioners: practitioners,
                encounters: encounters,
                appointments: appointments,
                provenances: provenances,
                activityDefinitions: activityDefinitions,
                specimens: specimens,
                observations: observations,
                relatedDiagnosticReport: relatedDiagnosticReport,
                appointmentScheduleMap: appointmentScheduleMap,
                resultsPDF: resultsPDF,
                currentPractitionerName: currentPractitioner ? (0, utils_1.getFullestAvailableName)(currentPractitioner) || '' : '',
                currentPractitionerId: (currentPractitioner === null || currentPractitioner === void 0 ? void 0 : currentPractitioner.id) || '',
            }));
        }
        catch (error) {
            console.error("Error parsing order data for service request ".concat(serviceRequest.id, ":"), error, JSON.stringify(error));
            void (0, shared_1.sendErrors)(error, ENVIRONMENT);
        }
    };
    for (var _i = 0, serviceRequests_1 = serviceRequests; _i < serviceRequests_1.length; _i++) {
        var serviceRequest = serviceRequests_1[_i];
        _loop_1(serviceRequest);
    }
    return result;
};
exports.mapResourcesToInHouseOrderDTOs = mapResourcesToInHouseOrderDTOs;
var parseOrderData = function (_a) {
    var _b, _c;
    var searchBy = _a.searchBy, serviceRequest = _a.serviceRequest, tasks = _a.tasks, practitioners = _a.practitioners, encounters = _a.encounters, appointments = _a.appointments, provenances = _a.provenances, activityDefinitions = _a.activityDefinitions, specimens = _a.specimens, observations = _a.observations, relatedDiagnosticReport = _a.relatedDiagnosticReport, appointmentScheduleMap = _a.appointmentScheduleMap, resultsPDF = _a.resultsPDF, currentPractitionerName = _a.currentPractitionerName, currentPractitionerId = _a.currentPractitionerId;
    console.log('parsing in-house order data');
    if (!serviceRequest.id) {
        throw new Error('ServiceRequest ID is required');
    }
    var appointmentId = (0, exports.parseAppointmentId)(serviceRequest, encounters);
    var appointment = appointments.find(function (a) { return a.id === appointmentId; });
    var encounter = encounters.find(function (e) { return e.id === (0, exports.parseEncounterId)(serviceRequest); });
    var activityDefinition = (0, exports.findActivityDefinitionForServiceRequest)(serviceRequest, activityDefinitions);
    if (!activityDefinition) {
        console.error("ActivityDefinition not found for ServiceRequest ".concat(serviceRequest.id));
        throw new Error("ActivityDefinition not found for ServiceRequest ".concat(serviceRequest.id));
    }
    var testItem = (0, utils_1.convertActivityDefinitionToTestItem)(activityDefinition, observations, serviceRequest, relatedDiagnosticReport);
    var orderStatus = (0, in_house_labs_1.determineOrderStatus)(serviceRequest, tasks);
    console.log('orderStatus:', orderStatus);
    var attendingPractitioner = (0, exports.parseAttendingPractitioner)(encounter, practitioners);
    var diagnosisDTO = (0, exports.parseDiagnoses)(serviceRequest);
    console.log('formatting listPageDTO');
    var listPageDTO = {
        appointmentId: appointmentId,
        testItemName: testItem.name,
        status: orderStatus,
        visitDate: (0, exports.parseVisitDate)(appointment),
        orderingPhysicianFullName: attendingPractitioner ? (0, utils_1.getFullestAvailableName)(attendingPractitioner) || '' : '',
        resultReceivedDate: (0, exports.parseResultsReceivedDate)(serviceRequest, tasks),
        diagnosesDTO: diagnosisDTO,
        timezone: (0, labs_1.parseTimezoneForAppointmentSchedule)(appointment, appointmentScheduleMap),
        orderAddedDate: (0, exports.parseOrderAddedDate)(serviceRequest, tasks),
        serviceRequestId: serviceRequest.id,
    };
    if (searchBy.searchBy.field === 'serviceRequestId') {
        console.log('searchBy field === serviceRequestId - indicates request was triggered on detail page');
        var relatedSpecimen = specimens.find(function (specimen) { var _a; return (_a = specimen.request) === null || _a === void 0 ? void 0 : _a.some(function (req) { return req.reference === "ServiceRequest/".concat(serviceRequest.id); }); });
        var orderHistory = (0, in_house_labs_1.buildOrderHistory)(provenances, serviceRequest, relatedSpecimen); // Pass specimen if available
        var relatedSpecimens = specimens.filter(function (s) { var _a; return (_a = s.request) === null || _a === void 0 ? void 0 : _a.some(function (req) { return req.reference === "ServiceRequest/".concat(serviceRequest.id); }); });
        var detailedPageDTO = __assign(__assign({}, listPageDTO), { labDetails: testItem, orderingPhysicianId: (attendingPractitioner === null || attendingPractitioner === void 0 ? void 0 : attendingPractitioner.id) || '', currentUserFullName: currentPractitionerName || '', currentUserId: currentPractitionerId || '', resultsPDFUrl: resultsPDF === null || resultsPDF === void 0 ? void 0 : resultsPDF.presignedURL, orderHistory: orderHistory, specimen: relatedSpecimens[0] ? (0, in_house_labs_1.getSpecimenDetails)(relatedSpecimens[0]) : undefined, notes: ((_c = (_b = serviceRequest.note) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text) || '' });
        return detailedPageDTO;
    }
    return listPageDTO;
};
exports.parseOrderData = parseOrderData;
var parseTasks = function (tasks, serviceRequest) {
    if (!serviceRequest.id) {
        return {
            allTasks: [],
            latestTask: null,
        };
    }
    var relatedTasks = tasks
        .filter(function (task) { return (0, in_house_labs_1.taskIsBasedOnServiceRequest)(task, serviceRequest); })
        .sort(function (a, b) { return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn); });
    return {
        allTasks: relatedTasks,
        latestTask: relatedTasks[0] || null,
    };
};
exports.parseTasks = parseTasks;
var getInHouseResources = function (oystehr, params, searchBy, m2mToken, userToken) { return __awaiter(void 0, void 0, void 0, function () {
    var searchParams, inHouseOrdersResponse, resources, pagination, _a, serviceRequests, tasks, encounters, locations, provenances, specimens, observations, diagnosticReports, activityDefinitions, appointments, appointmentScheduleMap, isDetailPageRequest, currentPractitioner, resultsPDFs, relatedSrs, _b, additionalDiagnosticReports, additionalObservations, additionalProvenances, additionalTasks, additionalSpecimens, additionalActivityDefinitions, oystehrCurrentUser, myPractitionerId, resultsDocumentReferences, documents, practitioners;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                searchParams = (0, exports.createInHouseServiceRequestSearchParams)(params);
                console.log('createInHouseServiceRequestSearchParams', searchParams);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: searchParams,
                    })];
            case 1:
                inHouseOrdersResponse = _c.sent();
                resources = inHouseOrdersResponse.unbundle().filter(function (res) { return Boolean(res); }) || [];
                pagination = (0, exports.parsePaginationFromResponse)(inHouseOrdersResponse);
                _a = (0, exports.extractInHouseResources)(resources), serviceRequests = _a.serviceRequests, tasks = _a.tasks, encounters = _a.encounters, locations = _a.locations, provenances = _a.provenances, specimens = _a.specimens, observations = _a.observations, diagnosticReports = _a.diagnosticReports, activityDefinitions = _a.activityDefinitions, appointments = _a.appointments, appointmentScheduleMap = _a.appointmentScheduleMap;
                isDetailPageRequest = searchBy.searchBy.field === 'serviceRequestId';
                resultsPDFs = [];
                if (!(isDetailPageRequest && userToken)) return [3 /*break*/, 9];
                if (!(serviceRequests.length > 1)) return [3 /*break*/, 3];
                relatedSrs = (0, in_house_labs_1.getRelatedServiceRequests)(serviceRequests, searchBy.searchBy.value);
                return [4 /*yield*/, (0, in_house_labs_1.fetchResultResourcesForRelatedServiceRequest)(oystehr, relatedSrs)];
            case 2:
                _b = _c.sent(), additionalDiagnosticReports = _b.additionalDiagnosticReports, additionalObservations = _b.additionalObservations, additionalProvenances = _b.additionalProvenances, additionalTasks = _b.additionalTasks, additionalSpecimens = _b.additionalSpecimens, additionalActivityDefinitions = _b.additionalActivityDefinitions;
                diagnosticReports.push.apply(diagnosticReports, additionalDiagnosticReports);
                observations.push.apply(observations, additionalObservations);
                provenances.push.apply(provenances, additionalProvenances);
                tasks.push.apply(tasks, additionalTasks);
                specimens.push.apply(specimens, additionalSpecimens);
                activityDefinitions.push.apply(activityDefinitions, additionalActivityDefinitions);
                _c.label = 3;
            case 3:
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(userToken, params.secrets);
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 4:
                myPractitionerId = _c.sent();
                if (!myPractitionerId) return [3 /*break*/, 6];
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: myPractitionerId,
                    })];
            case 5:
                currentPractitioner = _c.sent();
                _c.label = 6;
            case 6:
                if (!(diagnosticReports.length > 0)) return [3 /*break*/, 9];
                return [4 /*yield*/, (0, utils_1.fetchDocumentReferencesForDiagnosticReports)(oystehr, diagnosticReports)];
            case 7:
                resultsDocumentReferences = _c.sent();
                return [4 /*yield*/, (0, labs_1.fetchLabDocumentPresignedUrls)(resultsDocumentReferences, m2mToken)];
            case 8:
                documents = _c.sent();
                if (documents)
                    resultsPDFs = documents.resultPDFs;
                _c.label = 9;
            case 9: return [4 /*yield*/, (0, exports.fetchPractitionersForServiceRequests)(oystehr, serviceRequests, encounters, params.secrets.ENVIRONMENT)];
            case 10:
                practitioners = _c.sent();
                return [2 /*return*/, {
                        serviceRequests: serviceRequests,
                        tasks: tasks,
                        practitioners: practitioners,
                        encounters: encounters,
                        locations: locations,
                        appointments: appointments,
                        provenances: provenances,
                        activityDefinitions: activityDefinitions,
                        specimens: specimens,
                        observations: observations,
                        pagination: pagination,
                        diagnosticReports: diagnosticReports,
                        resultsPDFs: resultsPDFs,
                        currentPractitioner: currentPractitioner,
                        appointmentScheduleMap: appointmentScheduleMap,
                    }];
        }
    });
}); };
exports.getInHouseResources = getInHouseResources;
var createInHouseServiceRequestSearchParams = function (params) {
    var searchBy = params.searchBy, visitDate = params.visitDate, _a = params.itemsPerPage, itemsPerPage = _a === void 0 ? utils_1.DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE : _a, _b = params.pageIndex, pageIndex = _b === void 0 ? 0 : _b;
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
            name: 'code:missing',
            value: 'false',
        },
        {
            name: 'code',
            // empty value will search any code value for given system
            value: "".concat(utils_1.IN_HOUSE_TEST_CODE_SYSTEM, "|").concat(params.orderableItemCode || ''),
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
            value: 'Provenance:target',
        },
        {
            name: '_include:iterate',
            value: 'Encounter:location',
        },
        {
            name: '_include',
            value: 'ServiceRequest:instantiates-canonical',
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
        // filter out any soft deleted orders
        {
            name: 'status:not',
            value: 'revoked',
        },
    ];
    // Search by specific criteria
    if (searchBy.field === 'encounterId') {
        searchParams.push({
            name: 'encounter',
            value: "Encounter/".concat(searchBy.value),
        });
    }
    if (searchBy.field === 'encounterIds') {
        searchParams.push({
            name: 'encounter',
            value: searchBy.value.map(function (id) { return "Encounter/".concat(id); }).join(','),
        });
    }
    if (searchBy.field === 'patientId') {
        searchParams.push({
            name: 'subject',
            value: "Patient/".concat(searchBy.value),
        });
    }
    if (searchBy.field === 'serviceRequestId') {
        searchParams.push({
            name: '_id',
            value: searchBy.value,
        });
        // Include specimens for detailed view
        searchParams.push({
            name: '_include',
            value: 'ServiceRequest:specimen',
        });
        // Include observations for lab details
        searchParams.push({
            name: '_revinclude',
            value: 'Observation:based-on',
        });
        // Include the DR for grabbing pdf url
        searchParams.push({
            name: '_revinclude',
            value: 'DiagnosticReport:based-on',
        });
        // Include any related repeat test SRs
        searchParams.push({
            name: '_include:iterate',
            value: 'ServiceRequest:based-on',
        });
        searchParams.push({
            name: '_revinclude:iterate',
            value: 'ServiceRequest:based-on',
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
exports.createInHouseServiceRequestSearchParams = createInHouseServiceRequestSearchParams;
var extractInHouseResources = function (resources) {
    var _a;
    var serviceRequests = [];
    var tasks = [];
    var encounters = [];
    var locations = [];
    var provenances = [];
    var specimens = [];
    var observations = [];
    var diagnosticReports = [];
    var activityDefinitions = [];
    var appointments = [];
    var slots = [];
    var scheduleMap = {};
    var appointmentScheduleMap = {};
    for (var _i = 0, resources_1 = resources; _i < resources_1.length; _i++) {
        var resource = resources_1[_i];
        if (resource.resourceType === 'ServiceRequest') {
            serviceRequests.push(resource);
        }
        else if (resource.resourceType === 'Task' && resource.status !== 'cancelled') {
            tasks.push(resource);
        }
        else if (resource.resourceType === 'Encounter') {
            encounters.push(resource);
        }
        else if (resource.resourceType === 'Location') {
            locations.push(resource);
        }
        else if (resource.resourceType === 'Provenance') {
            provenances.push(resource);
        }
        else if (resource.resourceType === 'Specimen') {
            specimens.push(resource);
        }
        else if (resource.resourceType === 'Observation') {
            observations.push(resource);
        }
        else if (resource.resourceType === 'DiagnosticReport') {
            diagnosticReports.push(resource);
        }
        else if (resource.resourceType === 'ActivityDefinition') {
            activityDefinitions.push(resource);
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
    }
    var _loop_2 = function (appointment) {
        var slot = slots.find(function (slot) {
            var _a;
            var slotRef = "Slot/".concat(slot.id);
            return (_a = appointment.slot) === null || _a === void 0 ? void 0 : _a.some(function (s) { return s.reference === slotRef; });
        });
        var scheduleId = (_a = slot === null || slot === void 0 ? void 0 : slot.schedule.reference) === null || _a === void 0 ? void 0 : _a.replace('Schedule/', '');
        if (scheduleId) {
            var schedule = scheduleMap[scheduleId];
            if (schedule && appointment.id && !appointmentScheduleMap[appointment.id]) {
                appointmentScheduleMap[appointment.id] = schedule;
            }
        }
    };
    for (var _b = 0, appointments_1 = appointments; _b < appointments_1.length; _b++) {
        var appointment = appointments_1[_b];
        _loop_2(appointment);
    }
    return {
        serviceRequests: serviceRequests,
        tasks: tasks,
        encounters: encounters,
        locations: locations,
        provenances: provenances,
        specimens: specimens,
        observations: observations,
        diagnosticReports: diagnosticReports,
        activityDefinitions: activityDefinitions,
        appointments: appointments,
        appointmentScheduleMap: appointmentScheduleMap,
    };
};
exports.extractInHouseResources = extractInHouseResources;
var fetchPractitionersForServiceRequests = function (oystehr, serviceRequests, encounters, environment) { return __awaiter(void 0, void 0, void 0, function () {
    var practitionerIds, practitionerRequests, practitionerResponse, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                practitionerIds = new Set();
                serviceRequests.forEach(function (sr) {
                    var _a, _b;
                    var practitionerId = (_b = (_a = sr.requester) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Practitioner/', '');
                    if (practitionerId)
                        practitionerIds.add(practitionerId);
                });
                encounters.forEach(function (encounter) {
                    var attendingPractitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                    if (attendingPractitionerId)
                        practitionerIds.add(attendingPractitionerId);
                });
                if (practitionerIds.size === 0) {
                    return [2 /*return*/, []];
                }
                practitionerRequests = Array.from(practitionerIds).map(function (id) { return ({
                    method: 'GET',
                    url: "Practitioner/".concat(id),
                }); });
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 5]);
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: practitionerRequests,
                    })];
            case 2:
                practitionerResponse = _a.sent();
                return [2 /*return*/, (0, exports.mapResourcesFromBundleEntry)(practitionerResponse.entry).filter(function (resource) { return (resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Practitioner'; })];
            case 3:
                error_1 = _a.sent();
                return [4 /*yield*/, (0, shared_1.sendErrors)(error_1, environment)];
            case 4:
                _a.sent();
                console.error('Failed to fetch Practitioners', JSON.stringify(error_1, null, 2));
                return [2 /*return*/, []];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.fetchPractitionersForServiceRequests = fetchPractitionersForServiceRequests;
var findActivityDefinitionForServiceRequest = function (serviceRequest, activityDefinitions) {
    var _a = (0, in_house_labs_1.getUrlAndVersionForADFromServiceRequest)(serviceRequest), url = _a.url, version = _a.version;
    return activityDefinitions.find(function (ad) {
        var versionMatch = ad.version === version;
        var urlMatch = ad.url === url;
        return versionMatch && urlMatch;
    });
};
exports.findActivityDefinitionForServiceRequest = findActivityDefinitionForServiceRequest;
var parseAppointmentId = function (serviceRequest, encounters) {
    var _a, _b, _c;
    var encounterId = (0, exports.parseEncounterId)(serviceRequest);
    if (!encounterId)
        return '';
    var encounter = encounters.find(function (e) { return e.id === encounterId; });
    return ((_c = (_b = (_a = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/').pop()) || '';
};
exports.parseAppointmentId = parseAppointmentId;
var parseEncounterId = function (serviceRequest) {
    var _a, _b;
    return ((_b = (_a = serviceRequest.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop()) || '';
};
exports.parseEncounterId = parseEncounterId;
var parseVisitDate = function (appointment) {
    return (appointment === null || appointment === void 0 ? void 0 : appointment.start) || '';
};
exports.parseVisitDate = parseVisitDate;
var parseOrderAddedDate = function (serviceRequest, tasks) {
    // Use the first task's authoredOn date, or service request's authoredOn
    var relatedTasks = tasks.filter(function (task) { return (0, in_house_labs_1.taskIsBasedOnServiceRequest)(task, serviceRequest); });
    var earliestTask = relatedTasks.sort(function (a, b) { return (0, utils_1.compareDates)(b.authoredOn, a.authoredOn); } // reverse to get earliest
    )[0];
    return (earliestTask === null || earliestTask === void 0 ? void 0 : earliestTask.authoredOn) || serviceRequest.authoredOn || '';
};
exports.parseOrderAddedDate = parseOrderAddedDate;
var parseResultsReceivedDate = function (serviceRequest, tasks) {
    var relatedTasks = tasks.filter(function (task) { return (0, in_house_labs_1.taskIsBasedOnServiceRequest)(task, serviceRequest); });
    var latestTask = relatedTasks.sort(function (a, b) { return (0, utils_1.compareDates)(a.authoredOn, b.authoredOn); })[0];
    return (latestTask === null || latestTask === void 0 ? void 0 : latestTask.authoredOn) || null;
};
exports.parseResultsReceivedDate = parseResultsReceivedDate;
var parseAttendingPractitioner = function (encounter, practitioners) {
    if (!encounter)
        return undefined;
    var practitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
    if (!practitionerId)
        return undefined;
    return practitioners.find(function (p) { return p.id === practitionerId; });
};
exports.parseAttendingPractitioner = parseAttendingPractitioner;
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
            isPrimary: false,
        };
    });
};
exports.parseDiagnoses = parseDiagnoses;
var parseSpecimenSource = function (specimen) {
    var _a, _b, _c, _d;
    return (((_d = (_c = (_b = (_a = specimen.collection) === null || _a === void 0 ? void 0 : _a.bodySite) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.find(function (c) { return c.system === 'https://hl7.org/fhir/R4B/valueset-body-site'; })) === null || _d === void 0 ? void 0 : _d.display) || 'Unknown');
};
exports.parseSpecimenSource = parseSpecimenSource;
var parseSpecimenCollectedBy = function (_specimen) {
    // todo: This would need to be implemented
    return 'Staff';
};
exports.parseSpecimenCollectedBy = parseSpecimenCollectedBy;
var mapProvenanceStatusToTestStatus = function (provenanceStatus) {
    // This mapping would depend on how provenance statuses map to TestStatus
    // This is a placeholder implementation
    switch (provenanceStatus) {
        case 'ordered':
            return 'ORDERED';
        case 'collected':
            return 'COLLECTED';
        case 'final':
            return 'FINAL';
        default:
            return 'ORDERED';
    }
};
exports.mapProvenanceStatusToTestStatus = mapProvenanceStatusToTestStatus;
// Utility functions
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
var mapResourcesFromBundleEntry = function (bundleEntry) {
    return (bundleEntry || [])
        .filter(function (entry) { var _a, _b; return (_b = (_a = entry.response) === null || _a === void 0 ? void 0 : _a.status) === null || _b === void 0 ? void 0 : _b.startsWith('2'); })
        .map(function (entry) { return entry.resource; })
        .filter(Boolean);
};
exports.mapResourcesFromBundleEntry = mapResourcesFromBundleEntry;

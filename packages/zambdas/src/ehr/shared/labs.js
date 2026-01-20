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
exports.accountIsPatientBill = exports.parseAccessionNumberFromDr = exports.formatResourcesIntoDiagnosticReportLabDTO = exports.groupResourcesByDr = exports.populateQuestionnaireResponseItems = exports.srHasRejectedAbnExt = exports.diagnosticReportSpecificResultType = exports.getAllDrTags = exports.isLabDrTypeTagCode = exports.diagnosticReportIsReflex = exports.parseTimezoneForAppointmentSchedule = exports.parseAppointmentIdForServiceRequest = exports.fetchLabDocumentPresignedUrls = exports.configAllExternalLabDocuments = exports.configLabRequestsForGetChartData = exports.nonNonNormalTagsContained = exports.makeEncounterLabResults = exports.getPrimaryInsurance = exports.sortCoveragesByPriority = void 0;
exports.getExternalLabOrderResourcesViaDiagnosticReport = getExternalLabOrderResourcesViaDiagnosticReport;
exports.getExternalLabOrderResourcesViaServiceRequest = getExternalLabOrderResourcesViaServiceRequest;
var aws_serverless_1 = require("@sentry/aws-serverless");
var utils_1 = require("utils");
var helpers_1 = require("../get-lab-orders/helpers");
var makeSearchParamsBasedOnDiagnosticReport = function (diagnosticReportID) {
    return [
        {
            name: '_id',
            value: diagnosticReportID,
        },
        {
            name: '_include',
            value: 'DiagnosticReport:subject', // patient
        },
        {
            name: '_include',
            value: 'DiagnosticReport:performer', // lab org
        },
        {
            name: '_include:iterate',
            value: 'DiagnosticReport:result', // observations
        },
        {
            name: '_include:iterate',
            value: 'Encounter:appointment',
        },
        {
            name: '_include:iterate',
            value: 'Appointment:slot',
        },
        {
            name: '_include:iterate',
            value: 'Slot:schedule',
        },
    ];
};
function getExternalLabOrderResourcesViaDiagnosticReport(oystehr, diagnosticReportID) {
    return __awaiter(this, void 0, void 0, function () {
        var searchParams, resourceSearch, patients, organizations, diagnosticReports, observations, schedules, patient, labOrganization, diagnosticReport, schedule;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    searchParams = makeSearchParamsBasedOnDiagnosticReport(diagnosticReportID);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'DiagnosticReport',
                            params: searchParams,
                        })];
                case 1:
                    resourceSearch = (_a = (_b.sent())) === null || _a === void 0 ? void 0 : _a.unbundle();
                    patients = [];
                    organizations = [];
                    diagnosticReports = [];
                    observations = [];
                    schedules = [];
                    resourceSearch.forEach(function (resource) {
                        if (resource.resourceType === 'Patient')
                            patients.push(resource);
                        if (resource.resourceType === 'Organization')
                            organizations.push(resource);
                        if (resource.resourceType === 'Observation')
                            observations.push(resource);
                        if (resource.resourceType === 'DiagnosticReport') {
                            var isCorrectCategory = diagnosticReportIncludesCategory(resource, utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system, utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code);
                            if (isCorrectCategory)
                                diagnosticReports.push(resource);
                        }
                        if (resource.resourceType === 'Schedule')
                            schedules.push(resource);
                    });
                    if ((patients === null || patients === void 0 ? void 0 : patients.length) !== 1)
                        throw new Error('patient is not found');
                    if ((organizations === null || organizations === void 0 ? void 0 : organizations.length) !== 1)
                        throw new Error('performing lab Org not found');
                    if ((diagnosticReports === null || diagnosticReports === void 0 ? void 0 : diagnosticReports.length) !== 1)
                        throw new Error('diagnosticReport is not found');
                    if (schedules.length > 1)
                        throw new Error('found multiple schedules for DR appointment');
                    patient = patients[0];
                    labOrganization = organizations[0];
                    diagnosticReport = diagnosticReports[0];
                    schedule = schedules.length ? schedules[0] : undefined;
                    return [2 /*return*/, {
                            patient: patient,
                            labOrganization: labOrganization,
                            diagnosticReport: diagnosticReport,
                            observations: observations,
                            schedule: schedule,
                        }];
            }
        });
    });
}
var makeSearchParamsBasedOnServiceRequest = function (serviceRequestID) {
    return [
        {
            name: '_id',
            value: serviceRequestID,
        },
        {
            name: '_revinclude',
            value: 'Task:based-on',
        },
        {
            name: '_include',
            value: 'ServiceRequest:subject',
        },
        {
            name: '_revinclude',
            value: 'QuestionnaireResponse:based-on',
        },
        {
            name: '_include',
            value: 'ServiceRequest:requester',
        },
        {
            name: '_include',
            value: 'ServiceRequest:performer',
        },
        {
            name: '_include',
            value: 'ServiceRequest:encounter',
        },
        {
            name: '_revinclude',
            value: 'DiagnosticReport:based-on',
        },
        {
            name: '_include:iterate',
            value: 'Encounter:appointment',
        },
        {
            name: '_include:iterate',
            value: 'Appointment:slot',
        },
        {
            name: '_include:iterate',
            value: 'Slot:schedule',
        },
        {
            name: '_include:iterate',
            value: 'DiagnosticReport:result',
        },
        {
            name: '_include',
            value: 'ServiceRequest:specimen',
        },
        {
            name: '_revinclude:iterate',
            value: 'Account:patient',
        },
    ];
};
function getExternalLabOrderResourcesViaServiceRequest(oystehr, serviceRequestID) {
    return __awaiter(this, void 0, void 0, function () {
        var searchParams, resourceSearch, serviceRequests, patients, practitioners, preSubmissionTasks, organizations, encounters, diagnosticReports, observations, specimens, questionnaireResponses, schedules, accounts, serviceRequest, patient, practitioner, preSubmissionTask, labOrganization, encounter, questionnaireResponse, schedule, account, getLocation;
        var _a;
        var _this = this;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    searchParams = makeSearchParamsBasedOnServiceRequest(serviceRequestID);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'ServiceRequest',
                            params: searchParams,
                        })];
                case 1:
                    resourceSearch = (_b = (_c.sent())) === null || _b === void 0 ? void 0 : _b.unbundle();
                    serviceRequests = [];
                    patients = [];
                    practitioners = [];
                    preSubmissionTasks = [];
                    organizations = [];
                    encounters = [];
                    diagnosticReports = [];
                    observations = [];
                    specimens = [];
                    questionnaireResponses = [];
                    schedules = [];
                    accounts = [];
                    resourceSearch.forEach(function (resource) {
                        var _a, _b, _c;
                        if (resource.resourceType === 'ServiceRequest')
                            serviceRequests.push(resource);
                        if (resource.resourceType === 'Patient')
                            patients.push(resource);
                        if (resource.resourceType === 'Practitioner')
                            practitioners.push(resource);
                        if (resource.resourceType === 'Organization')
                            organizations.push(resource);
                        if (resource.resourceType === 'Encounter')
                            encounters.push(resource);
                        if (resource.resourceType === 'Observation')
                            observations.push(resource);
                        if (resource.resourceType === 'Specimen')
                            specimens.push(resource);
                        if (resource.resourceType === 'QuestionnaireResponse')
                            questionnaireResponses.push(resource);
                        if (resource.resourceType === 'Schedule')
                            schedules.push(resource);
                        if (resource.resourceType === 'Task') {
                            if (((_a = (0, utils_1.getCoding)(resource.code, utils_1.LAB_ORDER_TASK.system)) === null || _a === void 0 ? void 0 : _a.code) === utils_1.LAB_ORDER_TASK.code.preSubmission) {
                                preSubmissionTasks.push(resource);
                            }
                        }
                        if (resource.resourceType === 'DiagnosticReport') {
                            var isCorrectCategory = diagnosticReportIncludesCategory(resource, utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system, utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code);
                            if (isCorrectCategory)
                                diagnosticReports.push(resource);
                        }
                        if (resource.resourceType === 'Account') {
                            // check active accounts
                            if (resource.status === 'active' &&
                                ((_c = (_b = resource.type) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.some(function (coding) {
                                    var _a, _b;
                                    return coding.code === ((_a = utils_1.PATIENT_BILLING_ACCOUNT_TYPE === null || utils_1.PATIENT_BILLING_ACCOUNT_TYPE === void 0 ? void 0 : utils_1.PATIENT_BILLING_ACCOUNT_TYPE.coding) === null || _a === void 0 ? void 0 : _a[0].code) &&
                                        coding.system === ((_b = utils_1.PATIENT_BILLING_ACCOUNT_TYPE === null || utils_1.PATIENT_BILLING_ACCOUNT_TYPE === void 0 ? void 0 : utils_1.PATIENT_BILLING_ACCOUNT_TYPE.coding) === null || _b === void 0 ? void 0 : _b[0].system);
                                }))) {
                                accounts.push(resource);
                            }
                        }
                    });
                    if ((serviceRequests === null || serviceRequests === void 0 ? void 0 : serviceRequests.length) !== 1)
                        throw new Error('service request is not found');
                    if ((patients === null || patients === void 0 ? void 0 : patients.length) !== 1)
                        throw new Error('patient is not found');
                    if ((practitioners === null || practitioners === void 0 ? void 0 : practitioners.length) !== 1)
                        throw new Error('practitioner is not found');
                    if ((preSubmissionTasks === null || preSubmissionTasks === void 0 ? void 0 : preSubmissionTasks.length) !== 1)
                        throw new Error('preSubmissionTasks is not found');
                    if ((organizations === null || organizations === void 0 ? void 0 : organizations.length) !== 1)
                        throw new Error('performing lab Org not found');
                    if ((encounters === null || encounters === void 0 ? void 0 : encounters.length) !== 1)
                        throw new Error('encounter is not found');
                    if (accounts.length !== 1)
                        throw new Error("found ".concat(accounts.length, " active accounts. Expected 1."));
                    serviceRequest = serviceRequests[0];
                    patient = patients[0];
                    practitioner = practitioners[0];
                    preSubmissionTask = preSubmissionTasks[0];
                    labOrganization = organizations[0];
                    encounter = encounters[0];
                    questionnaireResponse = questionnaireResponses === null || questionnaireResponses === void 0 ? void 0 : questionnaireResponses[0];
                    schedule = schedules === null || schedules === void 0 ? void 0 : schedules[0];
                    account = accounts[0];
                    getLocation = function () { return __awaiter(_this, void 0, void 0, function () {
                        var orderingLocationId, orderingLocation;
                        var _a, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    if (((_a = serviceRequest.locationReference) === null || _a === void 0 ? void 0 : _a.length) !== 1) {
                                        console.error("ServiceRequest/".concat(serviceRequestID, " must have a single ordering Location reference. Multiple found"));
                                        return [2 /*return*/];
                                    }
                                    orderingLocationId = (_b = serviceRequest.locationReference[0].reference) === null || _b === void 0 ? void 0 : _b.replace('Location/', '');
                                    if (!orderingLocationId) {
                                        console.error("ServiceRequest/".concat(serviceRequestID, " must have an ordering locationReference. None found"));
                                        return [2 /*return*/];
                                    }
                                    return [4 /*yield*/, oystehr.fhir.search({
                                            resourceType: 'Location',
                                            params: [{ name: '_id', value: orderingLocationId }],
                                        })];
                                case 1:
                                    orderingLocation = (_c.sent()).unbundle();
                                    if (orderingLocation.length !== 1) {
                                        console.error("Location/".concat(orderingLocationId, " for ServiceRequest/").concat(serviceRequestID, " not found"));
                                        return [2 /*return*/];
                                    }
                                    return [2 /*return*/, orderingLocation[0]];
                            }
                        });
                    }); };
                    _a = {
                        serviceRequest: serviceRequest,
                        patient: patient,
                        practitioner: practitioner,
                        preSubmissionTask: preSubmissionTask,
                        labOrganization: labOrganization,
                        encounter: encounter,
                        diagnosticReports: diagnosticReports,
                        observations: observations,
                        specimens: specimens,
                        questionnaireResponse: questionnaireResponse,
                        schedule: schedule
                    };
                    return [4 /*yield*/, getLocation()];
                case 2: return [2 /*return*/, (_a.location = _c.sent(),
                        _a.account = account,
                        _a)];
            }
        });
    });
}
var sortCoveragesByPriority = function (account, coverages) {
    var _a;
    if (coverages.length === 0)
        return;
    var coverageMap = {};
    coverages.forEach(function (c) { return (coverageMap["Coverage/".concat(c.id)] = c); });
    var accountCoverages = (_a = account.coverage) === null || _a === void 0 ? void 0 : _a.filter(function (c) {
        var coverageRef = c.coverage.reference;
        return coverageRef && coverageMap[coverageRef];
    });
    if (accountCoverages === null || accountCoverages === void 0 ? void 0 : accountCoverages.length) {
        accountCoverages.sort(function (a, b) {
            var _a, _b;
            var priorityA = (_a = a.priority) !== null && _a !== void 0 ? _a : -Infinity;
            var priorityB = (_b = b.priority) !== null && _b !== void 0 ? _b : -Infinity;
            return priorityA - priorityB;
        });
        var coveragesSortedByPriority_1 = [];
        accountCoverages.forEach(function (accountCoverage) {
            var coverageRef = accountCoverage.coverage.reference;
            if (coverageRef) {
                var coverage = coverageMap[coverageRef];
                if (coverage)
                    coveragesSortedByPriority_1.push(coverage);
            }
        });
        if (coveragesSortedByPriority_1.length)
            return coveragesSortedByPriority_1;
    }
    return;
};
exports.sortCoveragesByPriority = sortCoveragesByPriority;
var getPrimaryInsurance = function (account, coverages) {
    if (coverages.length === 0)
        return;
    var sortedCoverages = (0, exports.sortCoveragesByPriority)(account, coverages);
    if (sortedCoverages === null || sortedCoverages === void 0 ? void 0 : sortedCoverages.length) {
        var primaryInsuranceCoverage = sortedCoverages[0];
        return primaryInsuranceCoverage;
    }
    else {
        console.log('no coverages were included on account.coverage, grabbing primary ins from list of patient coverages');
        coverages.sort(function (a, b) {
            var _a, _b;
            var orderA = (_a = a.order) !== null && _a !== void 0 ? _a : -Infinity;
            var orderB = (_b = b.order) !== null && _b !== void 0 ? _b : -Infinity;
            return orderA - orderB;
        });
        return coverages[0];
    }
};
exports.getPrimaryInsurance = getPrimaryInsurance;
var makeEncounterLabResults = function (resources, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var documentReferences, activeExternalLabServiceRequests, activeInHouseLabServiceRequests, reflexTestsPending, serviceRequestMap, diagnosticReportMap, externalLabOrderResults, inHouseLabOrderResults, reflexOrderResults, _i, documentReferences_1, docRef, diagnosticReportRef, relatedDR, serviceRequestRef, relatedSRDetail, sr, isReflex, orderNumber, activityDef, testName, labName, formattedName, reflexTestName, externalResultConfigs, sr, testName, inHouseResultConfigs, externalResultsPending, inHouseResultsPending, externalLabResultConfig, inHouseLabResultConfig;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0:
                documentReferences = [];
                activeExternalLabServiceRequests = [];
                activeInHouseLabServiceRequests = [];
                reflexTestsPending = [];
                serviceRequestMap = {};
                diagnosticReportMap = {};
                resources.forEach(function (resource) {
                    var _a, _b, _c, _d, _e, _f, _g;
                    if (resource.resourceType === 'DocumentReference') {
                        var isLabsDocRef = (0, utils_1.docRefIsOttehrGeneratedResultAndCurrent)(resource);
                        if (isLabsDocRef)
                            documentReferences.push(resource);
                    }
                    if (resource.resourceType === 'ServiceRequest') {
                        var isExternalLabServiceRequest = !!((_b = (_a = resource.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (c) { return c.system === utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM; }));
                        var isInHouseLabServiceRequest = !!((_d = (_c = resource.code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.find(function (c) { return c.system === utils_1.IN_HOUSE_TEST_CODE_SYSTEM; }));
                        if (isExternalLabServiceRequest || isInHouseLabServiceRequest) {
                            serviceRequestMap["ServiceRequest/".concat(resource.id)] = {
                                resource: resource,
                                type: isExternalLabServiceRequest ? utils_1.LabType.external : utils_1.LabType.inHouse,
                            };
                            if (resource.status === 'active') {
                                if (isExternalLabServiceRequest) {
                                    var isManual = (0, utils_1.externalLabOrderIsManual)(resource);
                                    // theres no guarantee that will we get electronic results back for manual labs so we can't validate
                                    if (!isManual)
                                        activeExternalLabServiceRequests.push(resource);
                                }
                                if (isInHouseLabServiceRequest)
                                    activeInHouseLabServiceRequests.push(resource);
                            }
                            var reflexTestTriggered = (_f = (_e = resource.meta) === null || _e === void 0 ? void 0 : _e.tag) === null || _f === void 0 ? void 0 : _f.find(function (t) { return t.system === utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM; });
                            if (reflexTestTriggered) {
                                var testIsPending = reflexTestTriggered.code === utils_1.SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending;
                                if (testIsPending) {
                                    var testName = (_g = reflexTestTriggered.display) !== null && _g !== void 0 ? _g : 'reflex test';
                                    reflexTestsPending.push(testName);
                                }
                            }
                        }
                    }
                    if (resource.resourceType === 'DiagnosticReport') {
                        var isExternalLabsDR = diagnosticReportIncludesCategory(resource, utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.system, utils_1.OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY.code);
                        var isInHouseLabsDR = diagnosticReportIncludesCategory(resource, utils_1.IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG.system, utils_1.IN_HOUSE_DIAGNOSTIC_REPORT_CATEGORY_CONFIG.code);
                        if (isExternalLabsDR || isInHouseLabsDR) {
                            diagnosticReportMap["DiagnosticReport/".concat(resource.id)] = resource;
                        }
                    }
                });
                externalLabOrderResults = [];
                inHouseLabOrderResults = [];
                reflexOrderResults = [];
                _i = 0, documentReferences_1 = documentReferences;
                _m.label = 1;
            case 1:
                if (!(_i < documentReferences_1.length)) return [3 /*break*/, 10];
                docRef = documentReferences_1[_i];
                diagnosticReportRef = (_c = (_b = (_a = docRef.context) === null || _a === void 0 ? void 0 : _a.related) === null || _b === void 0 ? void 0 : _b.find(function (related) { var _a; return (_a = related.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport'); })) === null || _c === void 0 ? void 0 : _c.reference;
                if (!diagnosticReportRef) return [3 /*break*/, 8];
                relatedDR = diagnosticReportMap[diagnosticReportRef];
                serviceRequestRef = (_e = (_d = relatedDR === null || relatedDR === void 0 ? void 0 : relatedDR.basedOn) === null || _d === void 0 ? void 0 : _d.find(function (based) { var _a; return (_a = based.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest'); })) === null || _e === void 0 ? void 0 : _e.reference;
                if (!serviceRequestRef) return [3 /*break*/, 6];
                relatedSRDetail = serviceRequestMap[serviceRequestRef];
                if (!relatedSRDetail)
                    return [3 /*break*/, 9];
                if (!(relatedSRDetail.type === utils_1.LabType.external)) return [3 /*break*/, 3];
                sr = relatedSRDetail.resource;
                isReflex = (0, exports.diagnosticReportIsReflex)(relatedDR);
                orderNumber = (0, utils_1.getOrderNumber)(sr);
                activityDef = (_f = sr.contained) === null || _f === void 0 ? void 0 : _f.find(function (resource) { return resource.resourceType === 'ActivityDefinition'; });
                testName = (_j = (_h = (_g = activityDef === null || activityDef === void 0 ? void 0 : activityDef.code) === null || _g === void 0 ? void 0 : _g.coding) === null || _h === void 0 ? void 0 : _h.find(function (c) { return c.system === utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM; })) === null || _j === void 0 ? void 0 : _j.display;
                labName = activityDef === null || activityDef === void 0 ? void 0 : activityDef.publisher;
                formattedName = (0, utils_1.nameLabTest)(testName, labName, false);
                if (isReflex) {
                    reflexTestName = ((_k = relatedDR === null || relatedDR === void 0 ? void 0 : relatedDR.code.coding) === null || _k === void 0 ? void 0 : _k[0].display) || 'Name missing';
                    formattedName = (0, utils_1.nameLabTest)(reflexTestName, labName, true);
                }
                return [4 /*yield*/, getLabOrderResultPDFConfig(docRef, formattedName, m2mToken, {
                        type: utils_1.LabType.external,
                        nonNormalResultContained: (0, exports.nonNonNormalTagsContained)(relatedDR),
                        orderNumber: orderNumber,
                    })];
            case 2:
                externalResultConfigs = (_m.sent()).externalResultConfigs;
                if (isReflex) {
                    reflexOrderResults.push.apply(reflexOrderResults, externalResultConfigs);
                }
                else {
                    externalLabOrderResults.push.apply(externalLabOrderResults, externalResultConfigs);
                }
                return [3 /*break*/, 5];
            case 3:
                if (!(relatedSRDetail.type === utils_1.LabType.inHouse)) return [3 /*break*/, 5];
                sr = relatedSRDetail.resource;
                testName = (_l = sr.code) === null || _l === void 0 ? void 0 : _l.text;
                return [4 /*yield*/, getLabOrderResultPDFConfig(docRef, testName || 'missing test details', m2mToken, { type: utils_1.LabType.inHouse, nonNormalResultContained: (0, exports.nonNonNormalTagsContained)(relatedDR) })];
            case 4:
                inHouseResultConfigs = (_m.sent()).inHouseResultConfigs;
                inHouseLabOrderResults.push.apply(inHouseLabOrderResults, inHouseResultConfigs);
                _m.label = 5;
            case 5: return [3 /*break*/, 7];
            case 6:
                // todo what to do here for unsolicited results
                // maybe we don't need to handle these for mvp
                console.log('no serviceRequestRef for', docRef.id);
                _m.label = 7;
            case 7: return [3 /*break*/, 9];
            case 8:
                // something has gone awry during the document reference creation if there is no diagnostic report linked
                // so this shouldn't happen but if it does we will still surface the report
                console.log('no diagnosticReportRef for', docRef.id);
                _m.label = 9;
            case 9:
                _i++;
                return [3 /*break*/, 1];
            case 10:
                // map reflex tests to their original ordered test
                reflexOrderResults.forEach(function (reflexRes) {
                    var ogOrderResIdx = externalLabOrderResults.findIndex(function (res) { return (res === null || res === void 0 ? void 0 : res.orderNumber) && res.orderNumber === reflexRes.orderNumber; });
                    if (ogOrderResIdx !== -1) {
                        var ogOrderRes = externalLabOrderResults[ogOrderResIdx];
                        if (!ogOrderRes.reflexResults) {
                            ogOrderRes.reflexResults = [reflexRes];
                        }
                        else {
                            ogOrderRes.reflexResults.push(reflexRes);
                        }
                    }
                });
                externalResultsPending = activeExternalLabServiceRequests.length > 0;
                inHouseResultsPending = activeInHouseLabServiceRequests.length > 0;
                externalLabResultConfig = {
                    resultsPending: externalResultsPending,
                    labOrderResults: externalLabOrderResults,
                };
                inHouseLabResultConfig = {
                    resultsPending: inHouseResultsPending,
                    reflexTestsPending: reflexTestsPending.length > 0 ? reflexTestsPending : undefined,
                    labOrderResults: inHouseLabOrderResults,
                };
                return [2 /*return*/, { externalLabResultConfig: externalLabResultConfig, inHouseLabResultConfig: inHouseLabResultConfig }];
        }
    });
}); };
exports.makeEncounterLabResults = makeEncounterLabResults;
// these tags would be set by oystehr when the DR is created for external labs
var nonNonNormalTagsContained = function (dr) {
    var _a, _b, _c, _d, _e, _f;
    var drIsTaggedAbnormal = (_b = (_a = dr.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.some(function (tag) { return tag.system === utils_1.ABNORMAL_RESULT_DR_TAG.system && tag.code === utils_1.ABNORMAL_RESULT_DR_TAG.code; });
    var drIsTaggedInconclusive = (_d = (_c = dr.meta) === null || _c === void 0 ? void 0 : _c.tag) === null || _d === void 0 ? void 0 : _d.some(function (tag) { return tag.system === utils_1.INCONCLUSIVE_RESULT_DR_TAG.system && tag.code === utils_1.INCONCLUSIVE_RESULT_DR_TAG.code; });
    var drIsTaggedNeutral = (_f = (_e = dr.meta) === null || _e === void 0 ? void 0 : _e.tag) === null || _f === void 0 ? void 0 : _f.some(function (tag) { return tag.system === utils_1.NEUTRAL_RESULT_DR_TAG.system && tag.code === utils_1.NEUTRAL_RESULT_DR_TAG.code; });
    var nonNormalResultContained = [];
    if (drIsTaggedAbnormal)
        nonNormalResultContained.push(utils_1.NonNormalResult.Abnormal);
    if (drIsTaggedInconclusive)
        nonNormalResultContained.push(utils_1.NonNormalResult.Inconclusive);
    if (drIsTaggedNeutral)
        nonNormalResultContained.push(utils_1.NonNormalResult.Neutral);
    if (nonNormalResultContained.length === 0)
        nonNormalResultContained = undefined;
    return nonNormalResultContained;
};
exports.nonNonNormalTagsContained = nonNonNormalTagsContained;
var getLabOrderResultPDFConfig = function (docRef, formattedName, m2mToken, resultDetails) { return __awaiter(void 0, void 0, void 0, function () {
    var externalResults, inHouseResults, _i, _a, content, z3Url, url, labResult, labResult;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                externalResults = [];
                inHouseResults = [];
                _i = 0, _a = docRef.content;
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                content = _a[_i];
                z3Url = content.attachment.url;
                if (!z3Url) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, utils_1.getPresignedURL)(z3Url, m2mToken)];
            case 2:
                url = _b.sent();
                if (!url) {
                    console.warn("Skipped lab result because presigned URL could not be fetched for ".concat(z3Url));
                    return [3 /*break*/, 3];
                }
                if (resultDetails.type === utils_1.LabType.external) {
                    labResult = {
                        name: formattedName,
                        url: url,
                        nonNormalResultContained: resultDetails.nonNormalResultContained,
                        orderNumber: resultDetails === null || resultDetails === void 0 ? void 0 : resultDetails.orderNumber,
                    };
                    externalResults.push(labResult);
                }
                else if (resultDetails.type === utils_1.LabType.inHouse) {
                    labResult = {
                        name: formattedName,
                        url: url,
                        nonNormalResultContained: resultDetails.nonNormalResultContained,
                        simpleResultValue: resultDetails === null || resultDetails === void 0 ? void 0 : resultDetails.simpleResultValue,
                    };
                    inHouseResults.push(labResult);
                }
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/, { externalResultConfigs: externalResults, inHouseResultConfigs: inHouseResults }];
        }
    });
}); };
var configLabRequestsForGetChartData = function (encounterId) {
    // DocumentReference.related will contain a reference to the related diagnostic report which is needed to know more about the test
    // namely, if the test is reflex and also lets us grab the related service request which has info on the test & lab name, needed for results display
    var docRefSearch = {
        method: 'GET',
        url: "/DocumentReference?status=current&type=".concat(utils_1.LAB_RESULT_DOC_REF_CODING_CODE.code, "&encounter=").concat(encounterId, "&_include:iterate=DocumentReference:related&_include:iterate=DiagnosticReport:based-on"),
    };
    // Grabbing active lab service requests separately since they might not have results
    // but we validate against actually signing the progress note if there are any pending
    var activeLabServiceRequestSearch = {
        method: 'GET',
        url: "/ServiceRequest?encounter=Encounter/".concat(encounterId, "&status=active&code=").concat(utils_1.OYSTEHR_LAB_OI_CODE_SYSTEM, "|,").concat(utils_1.IN_HOUSE_TEST_CODE_SYSTEM, "|"),
    };
    return [docRefSearch, activeLabServiceRequestSearch];
};
exports.configLabRequestsForGetChartData = configLabRequestsForGetChartData;
var diagnosticReportIncludesCategory = function (diagnosticReport, system, code) {
    var _a;
    return !!((_a = diagnosticReport.category) === null || _a === void 0 ? void 0 : _a.find(function (cat) { var _a; return (_a = cat === null || cat === void 0 ? void 0 : cat.coding) === null || _a === void 0 ? void 0 : _a.find(function (c) { return c.system === system && c.code === code; }); }));
};
var getDocRefRelatedIds = function (docRef, relatedResourceType) {
    var _a, _b;
    var references = (_b = (_a = docRef.context) === null || _a === void 0 ? void 0 : _a.related) === null || _b === void 0 ? void 0 : _b.filter(function (rel) { var _a; return (_a = rel.reference) === null || _a === void 0 ? void 0 : _a.startsWith("".concat(relatedResourceType, "/")); });
    var ids = references === null || references === void 0 ? void 0 : references.map(function (rel) { var _a; return (_a = rel.reference) === null || _a === void 0 ? void 0 : _a.replace("".concat(relatedResourceType, "/"), ''); }).filter(function (id) { return id !== undefined; });
    return ids;
};
/**
 * Gets presigned urls for document references and massages data into a consumable labDocument shape and organizes those labDocuments into the ExternalLabDocuments object
 * @param documentReferences - all document references for a lab or labs
 * @param serviceRequests - either one service request (if running from the detail page) or multiple (if running from the list view)
 * @param m2mToken
 * @returns ExternalLabDocuments
 */
var configAllExternalLabDocuments = function (documentReferences, serviceRequests, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var documentsWithPresignedUrls, docsConfig, groupedOrderPdfs, groupedAbnPdfs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.fetchLabDocumentPresignedUrls)(documentReferences, m2mToken)];
            case 1:
                documentsWithPresignedUrls = _a.sent();
                if (!documentsWithPresignedUrls)
                    return [2 /*return*/];
                docsConfig = {
                    labelPDF: documentsWithPresignedUrls === null || documentsWithPresignedUrls === void 0 ? void 0 : documentsWithPresignedUrls.labelPDF,
                    orderPDFsByRequisitionNumber: undefined,
                    abnPDFsByRequisitionNumber: undefined,
                    labGeneratedResults: undefined,
                    resultPDFs: undefined,
                };
                if (documentsWithPresignedUrls.orderPDFs.length > 0) {
                    groupedOrderPdfs = groupLabDocsByRequisition(documentsWithPresignedUrls.orderPDFs, serviceRequests);
                    docsConfig.orderPDFsByRequisitionNumber = groupedOrderPdfs;
                }
                if (documentsWithPresignedUrls.abnPDFs.length > 0) {
                    groupedAbnPdfs = groupLabDocsByRequisition(documentsWithPresignedUrls.abnPDFs, serviceRequests);
                    docsConfig.abnPDFsByRequisitionNumber = groupedAbnPdfs;
                }
                // result doc refs are only fetched up for the detail page so we do not need to group by requisition number
                if (documentsWithPresignedUrls.labGeneratedResults.length > 0) {
                    docsConfig.labGeneratedResults = documentsWithPresignedUrls.labGeneratedResults;
                }
                // result doc refs are only fetched up for the detail page so we do not need to group by requisition number
                if (documentsWithPresignedUrls.resultPDFs.length > 0) {
                    docsConfig.resultPDFs = documentsWithPresignedUrls.resultPDFs;
                }
                return [2 /*return*/, docsConfig];
        }
    });
}); };
exports.configAllExternalLabDocuments = configAllExternalLabDocuments;
var groupLabDocsByRequisition = function (labDocuments, serviceRequests) {
    if (!labDocuments)
        return;
    var grouped = {};
    serviceRequests.forEach(function (serviceRequest) {
        var serviceRequestId = serviceRequest.id;
        if (serviceRequestId) {
            var requisitionNumber = (0, utils_1.getOrderNumber)(serviceRequest);
            var labDoc = labDocuments.find(function (labDoc) { return labDoc.serviceRequestIds.includes(serviceRequestId); });
            if (requisitionNumber && labDoc) {
                grouped[requisitionNumber] = labDoc;
            }
        }
    });
    return grouped;
};
var docRefType = function (docRef) {
    if ((0, utils_1.docRefIsLabGeneratedResult)(docRef)) {
        return utils_1.LabDocumentType.labGeneratedResult;
    }
    else if ((0, utils_1.docRefIsOrderPDFAndCurrent)(docRef)) {
        return utils_1.LabDocumentType.orderPdf;
    }
    else if ((0, utils_1.docRefIsLabelPDFAndCurrent)(docRef)) {
        return utils_1.LabDocumentType.label;
    }
    else if ((0, utils_1.docRefIsAbnAndCurrent)(docRef)) {
        return utils_1.LabDocumentType.abn;
    }
    else if ((0, utils_1.docRefIsOttehrGeneratedResultAndCurrent)(docRef)) {
        return utils_1.LabDocumentType.ottehrGeneratedResult;
    }
    return;
};
/**
 * Transforms data relating to any given lab document (usually some pdf) into a consumable shape to be used through the front and backend of the app
 * @param docRef DocumentReference being configured into the lab document shape
 * @param presignedURL url to access the document that will be stored in the lab document
 * @returns LabDocument | null
 */
var configLabDocument = function (docRef, presignedURL) {
    if (!docRef.id)
        return null;
    var baseInfo = { docRefId: docRef.id, presignedURL: presignedURL };
    var serviceRequestIds = getDocRefRelatedIds(docRef, 'ServiceRequest'); // one order pdf doc ref to many service requests
    var diagnosticReportIds = getDocRefRelatedIds(docRef, 'DiagnosticReport'); // lab generated results are one doc ref to many diagnostic reports
    var type = docRefType(docRef);
    var config = (function () {
        var _a, _b, _c;
        switch (type) {
            case utils_1.LabDocumentType.abn:
            case utils_1.LabDocumentType.orderPdf:
                if (!serviceRequestIds)
                    return null;
                return __assign({ type: type, serviceRequestIds: serviceRequestIds }, baseInfo);
            case utils_1.LabDocumentType.ottehrGeneratedResult:
                if (!diagnosticReportIds)
                    return null;
                return __assign({ type: type, diagnosticReportIds: diagnosticReportIds }, baseInfo);
            case utils_1.LabDocumentType.labGeneratedResult: {
                var relatedResultDiagnosticReportIds = (_c = (_b = (_a = docRef.context) === null || _a === void 0 ? void 0 : _a.related) === null || _b === void 0 ? void 0 : _b.filter(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport/'); }).map(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.replace('DiagnosticReport/', ''); }).filter(function (ref) { return !!ref; })) !== null && _c !== void 0 ? _c : [];
                return __assign({ type: type, diagnosticReportIds: relatedResultDiagnosticReportIds }, baseInfo);
            }
            case utils_1.LabDocumentType.label: {
                return { type: type, documentReference: docRef, presignedURL: presignedURL };
            }
            default:
                return null;
        }
    })();
    return config;
};
var fetchLabDocumentPresignedUrls = function (documentReferences, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var pdfPromises, _loop_1, _i, documentReferences_2, docRef, pdfs, _a, resultPDFs, labelPDF, orderPDFs, abnPDFs, labGeneratedResults;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!documentReferences.length) {
                    return [2 /*return*/];
                }
                pdfPromises = [];
                _loop_1 = function (docRef) {
                    for (var _d = 0, _e = docRef.content; _d < _e.length; _d++) {
                        var content = _e[_d];
                        var z3Url = (_b = content.attachment) === null || _b === void 0 ? void 0 : _b.url;
                        if (z3Url) {
                            pdfPromises.push((0, utils_1.getPresignedURL)(z3Url, m2mToken)
                                .then(function (presignedURL) { return configLabDocument(docRef, presignedURL); })
                                .catch(function (error) {
                                (0, aws_serverless_1.captureException)(error);
                                console.error("Failed to get presigned URL for document ".concat(docRef.id, ":"), error);
                                return null;
                            }));
                        }
                    }
                };
                for (_i = 0, documentReferences_2 = documentReferences; _i < documentReferences_2.length; _i++) {
                    docRef = documentReferences_2[_i];
                    _loop_1(docRef);
                }
                return [4 /*yield*/, Promise.allSettled(pdfPromises)];
            case 1:
                pdfs = _c.sent();
                _a = pdfs
                    .filter(function (result) { return result.status === 'fulfilled' && result.value !== null; })
                    .reduce(function (acc, result) {
                    if ('type' in result.value) {
                        switch (result.value.type) {
                            case utils_1.LabDocumentType.abn:
                                acc.abnPDFs.push(result.value);
                                break;
                            case utils_1.LabDocumentType.labGeneratedResult:
                                acc.labGeneratedResults.push(result.value);
                                break;
                            case utils_1.LabDocumentType.orderPdf:
                                acc.orderPDFs.push(result.value);
                                break;
                            case utils_1.LabDocumentType.ottehrGeneratedResult:
                                acc.resultPDFs.push(result.value);
                                break;
                            case utils_1.LabDocumentType.label:
                                acc.labelPDF = result.value;
                                break;
                            default:
                                break;
                        }
                    }
                    return acc;
                }, { resultPDFs: [], labelPDF: undefined, orderPDFs: [], abnPDFs: [], labGeneratedResults: [] }), resultPDFs = _a.resultPDFs, labelPDF = _a.labelPDF, orderPDFs = _a.orderPDFs, abnPDFs = _a.abnPDFs, labGeneratedResults = _a.labGeneratedResults;
                return [2 /*return*/, { resultPDFs: resultPDFs, labelPDF: labelPDF, orderPDFs: orderPDFs, abnPDFs: abnPDFs, labGeneratedResults: labGeneratedResults }];
        }
    });
}); };
exports.fetchLabDocumentPresignedUrls = fetchLabDocumentPresignedUrls;
var parseAppointmentIdForServiceRequest = function (serviceRequest, encounters) {
    var _a, _b, _c, _d, _e;
    console.log('getting appointment id for service request', serviceRequest.id);
    var encounterId = (_b = (_a = serviceRequest.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop();
    var NOT_FOUND = undefined;
    if (!encounterId) {
        return NOT_FOUND;
    }
    var relatedEncounter = encounters.find(function (encounter) { return encounter.id === encounterId; });
    if ((_c = relatedEncounter === null || relatedEncounter === void 0 ? void 0 : relatedEncounter.appointment) === null || _c === void 0 ? void 0 : _c.length) {
        return ((_e = (_d = relatedEncounter.appointment[0]) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.split('/').pop()) || NOT_FOUND;
    }
    return NOT_FOUND;
};
exports.parseAppointmentIdForServiceRequest = parseAppointmentIdForServiceRequest;
var parseTimezoneForAppointmentSchedule = function (appointment, appointmentScheduleMap) {
    if (!appointment || !appointment.id)
        return;
    var schedule = appointmentScheduleMap[appointment.id];
    var timezone;
    if (schedule) {
        timezone = (0, utils_1.getTimezone)(schedule);
    }
    return timezone;
};
exports.parseTimezoneForAppointmentSchedule = parseTimezoneForAppointmentSchedule;
// todo labs we should be able to get rid of this
var diagnosticReportIsReflex = function (dr) {
    var _a, _b;
    return !!((_b = (_a = dr === null || dr === void 0 ? void 0 : dr.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (t) { return t.system === utils_1.LAB_DR_TYPE_TAG.system && t.display === utils_1.LAB_DR_TYPE_TAG.display.reflex; }));
};
exports.diagnosticReportIsReflex = diagnosticReportIsReflex;
var isLabDrTypeTagCode = function (code) {
    return Object.values(utils_1.LAB_DR_TYPE_TAG.code).includes(code);
};
exports.isLabDrTypeTagCode = isLabDrTypeTagCode;
var getAllDrTags = function (dr) {
    var _a, _b;
    var codes = (_b = (_a = dr === null || dr === void 0 ? void 0 : dr.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.filter(function (t) { return t.system === utils_1.LAB_DR_TYPE_TAG.system; }).map(function (t) { return t.code; });
    var labDrCodes = codes === null || codes === void 0 ? void 0 : codes.filter(function (code) { return (0, exports.isLabDrTypeTagCode)(code); });
    return labDrCodes;
};
exports.getAllDrTags = getAllDrTags;
/**
 * Returns diagnostic report result-type tag if any exists and validates the code is one of the known LabDrTypeTagCode values.
 *
 * @param dr - The diagnostic report to extract the tag code from.
 * @returns The validated tag ('unsolicited', 'reflex') or undefined.
 */
var diagnosticReportSpecificResultType = function (dr) {
    var labDrCodes = (0, exports.getAllDrTags)(dr);
    console.log('labDrCodes:', labDrCodes);
    if (!labDrCodes || labDrCodes.length === 0)
        return;
    if (labDrCodes.length === 1) {
        return labDrCodes[0];
    }
    else {
        throw new Error("an unexpected number of result-type tag have been assigned: ".concat(labDrCodes, " on DR: ").concat(dr.id));
    }
};
exports.diagnosticReportSpecificResultType = diagnosticReportSpecificResultType;
var srHasRejectedAbnExt = function (sr) {
    var _a;
    return !!((_a = sr.extension) === null || _a === void 0 ? void 0 : _a.some(function (ext) { return ext.url === utils_1.SR_REVOKED_REASON_EXT.url && ext.valueCode === utils_1.SR_REVOKED_REASON_EXT.valueCode; }));
};
exports.srHasRejectedAbnExt = srHasRejectedAbnExt;
var populateQuestionnaireResponseItems = function (questionnaireResponse, data, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var questionnaireUrl, questionnaireRequest, questionnaire, questionsAndAnswersForFormDisplay, questionnaireResponseItems;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                questionnaireUrl = questionnaireResponse.questionnaire;
                if (!questionnaireUrl) {
                    throw new Error('questionnaire is not found');
                }
                console.log(questionnaireUrl);
                return [4 /*yield*/, fetch(questionnaireUrl, {
                        headers: {
                            Authorization: "Bearer ".concat(m2mToken),
                        },
                    })];
            case 1:
                questionnaireRequest = _a.sent();
                return [4 /*yield*/, questionnaireRequest.json()];
            case 2:
                questionnaire = _a.sent();
                if (!questionnaire.item) {
                    throw new Error('questionnaire item is not found');
                }
                questionsAndAnswersForFormDisplay = [];
                questionnaireResponseItems = Object.keys(data).map(function (questionResponse) {
                    var _a, _b;
                    var question = (_a = questionnaire.item) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.linkId === questionResponse; });
                    if (!question) {
                        throw new Error('question is not found');
                    }
                    var answer = undefined;
                    var answerForDisplay = data[questionResponse] !== undefined ? data[questionResponse] : 'UNKNOWN';
                    var multiSelect = (_b = question.extension) === null || _b === void 0 ? void 0 : _b.find(function (currentExtension) {
                        return currentExtension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/data-type' &&
                            currentExtension.valueString === 'multi-select list';
                    });
                    if (question.type === 'text' || (question.type === 'choice' && !multiSelect)) {
                        answer = [
                            {
                                valueString: data[questionResponse],
                            },
                        ];
                    }
                    if (multiSelect) {
                        answer = data[questionResponse].map(function (item) { return ({ valueString: item }); });
                        answerForDisplay = data[questionResponse].join(', ');
                    }
                    if (question.type === 'boolean') {
                        answer = [
                            {
                                valueBoolean: data[questionResponse],
                            },
                        ];
                        answerForDisplay = answerForDisplay === true ? 'Yes' : answerForDisplay === false ? 'No' : answerForDisplay;
                    }
                    if (question.type === 'date') {
                        answer = [
                            {
                                valueDate: data[questionResponse],
                            },
                        ];
                    }
                    if (question.type === 'decimal') {
                        answer = [
                            {
                                valueDecimal: data[questionResponse],
                            },
                        ];
                    }
                    if (question.type === 'integer') {
                        answer = [
                            {
                                valueInteger: data[questionResponse],
                            },
                        ];
                    }
                    if (answer == undefined) {
                        throw new Error('answer is undefined');
                    }
                    if (answerForDisplay !== undefined && answerForDisplay !== '')
                        questionsAndAnswersForFormDisplay.push({
                            question: question.text || 'UNKNOWN',
                            answer: answerForDisplay,
                        });
                    return {
                        linkId: questionResponse,
                        answer: answer,
                    };
                });
                return [2 /*return*/, { questionnaireResponseItems: questionnaireResponseItems, questionsAndAnswersForFormDisplay: questionsAndAnswersForFormDisplay }];
        }
    });
}); };
exports.populateQuestionnaireResponseItems = populateQuestionnaireResponseItems;
var groupResourcesByDr = function (resources) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var drMap = new Map();
    var readyTasksMap = {};
    var completedTasksMap = {};
    var patientsMap = {};
    var labOrgMap = {};
    var encountersMap = {};
    var currentResultPDFDocRefs = [];
    resources.forEach(function (resource) {
        var _a;
        if (resource.resourceType === 'DiagnosticReport' && resource.id) {
            drMap.set(resource.id, { diagnosticReport: resource, readyTasks: [], completedTasks: [] });
        }
        if (resource.resourceType === 'Organization') {
            var isLabOrg = !!((_a = resource.identifier) === null || _a === void 0 ? void 0 : _a.some(function (id) { return id.system === utils_1.OYSTEHR_LAB_GUID_SYSTEM; }));
            if (isLabOrg && resource.id)
                labOrgMap[resource.id] = resource;
        }
        if (resource.resourceType === 'Task') {
            if (resource.id) {
                if (resource.status === 'ready' || resource.status === 'in-progress') {
                    readyTasksMap[resource.id] = resource;
                }
                else if (resource.status === 'completed') {
                    completedTasksMap[resource.id] = resource;
                }
            }
        }
        if (resource.resourceType === 'DocumentReference') {
            var isResultPdfDocRefAndCurrent = (0, utils_1.docRefIsOttehrGeneratedResultAndCurrent)(resource);
            if (isResultPdfDocRefAndCurrent) {
                currentResultPDFDocRefs.push(resource);
            }
        }
        if (resource.resourceType === 'Patient' && resource.id) {
            patientsMap[resource.id] = resource;
        }
        if (resource.resourceType === 'Encounter' && resource.id) {
            encountersMap[resource.id] = resource;
        }
    });
    for (var _i = 0, drMap_1 = drMap; _i < drMap_1.length; _i++) {
        var _k = drMap_1[_i], drId = _k[0], drResources = _k[1];
        var dr = drResources.diagnosticReport;
        var isPatientSubject = (_b = (_a = dr.subject) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/');
        if (isPatientSubject) {
            var patientId = (_d = (_c = dr.subject) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.replace('Patient/', '');
            if (patientId) {
                var patient = patientsMap[patientId];
                drResources.patient = patient;
            }
        }
        var orgPerformerId = (_g = (_f = (_e = dr.performer) === null || _e === void 0 ? void 0 : _e.find(function (p) { var _a; return (_a = p.reference) === null || _a === void 0 ? void 0 : _a.startsWith('Organization/'); })) === null || _f === void 0 ? void 0 : _f.reference) === null || _g === void 0 ? void 0 : _g.replace('Organization/', '');
        if (orgPerformerId) {
            var org = labOrgMap[orgPerformerId];
            drResources.labOrg = org;
        }
        var encounterId = (_j = (_h = dr.encounter) === null || _h === void 0 ? void 0 : _h.reference) === null || _j === void 0 ? void 0 : _j.replace('Encounter/', '');
        if (encounterId) {
            var encounter = encountersMap[encounterId];
            drResources.encounter = encounter;
        }
        drMap.set(drId, drResources);
    }
    Object.values(readyTasksMap).forEach(function (task) {
        var _a, _b, _c;
        var relatedDrId = (_c = (_b = (_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.find(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport'); })) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('DiagnosticReport/', '');
        if (relatedDrId) {
            var existingResourcesByDr = drMap.get(relatedDrId);
            if (existingResourcesByDr) {
                existingResourcesByDr.readyTasks.push(task);
                drMap.set(relatedDrId, existingResourcesByDr);
            }
        }
    });
    Object.values(completedTasksMap).forEach(function (task) {
        var _a, _b, _c;
        var relatedDrId = (_c = (_b = (_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.find(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport'); })) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('DiagnosticReport/', '');
        if (relatedDrId) {
            var existingResourcesByDr = drMap.get(relatedDrId);
            if (existingResourcesByDr) {
                existingResourcesByDr.completedTasks.push(task);
                drMap.set(relatedDrId, existingResourcesByDr);
            }
        }
    });
    currentResultPDFDocRefs.forEach(function (docRef) {
        var _a, _b;
        console.log('matching DR to docRef id:', docRef.id);
        var isLabGeneratedResultDoc = (0, utils_1.docRefIsLabGeneratedResult)(docRef);
        (_b = (_a = docRef.context) === null || _a === void 0 ? void 0 : _a.related) === null || _b === void 0 ? void 0 : _b.forEach(function (relatedDrRef) {
            var _a;
            var relatedDrId = ((_a = relatedDrRef.reference) === null || _a === void 0 ? void 0 : _a.startsWith('DiagnosticReport/'))
                ? relatedDrRef.reference.replace('DiagnosticReport/', '')
                : undefined;
            if (relatedDrId && drMap.has(relatedDrId)) {
                var existingResourcesByDr = drMap.get(relatedDrId); // safe to use ! here because of the .has check above
                if (isLabGeneratedResultDoc) {
                    console.log('we found a labGeneratedResult doc. relatedDrId is', relatedDrId);
                    existingResourcesByDr.labGeneratedResultPdfDocumentReference = docRef;
                }
                else {
                    existingResourcesByDr.resultPdfDocumentReference = docRef;
                }
                drMap.set(relatedDrId, existingResourcesByDr);
            }
        });
    });
    var output = Object.fromEntries(drMap);
    console.log('returning from groupResourcesByDr', JSON.stringify(output));
    return output;
};
exports.groupResourcesByDr = groupResourcesByDr;
var formatResourcesIntoDiagnosticReportLabDTO = function (resources, token) { return __awaiter(void 0, void 0, void 0, function () {
    var diagnosticReport, readyTasks, completedTasks, labOrg, resultPdfDocumentReference, labGeneratedResultPdfDocumentReference, matchTask, reviewTask, task, detail, dto;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                diagnosticReport = resources.diagnosticReport, readyTasks = resources.readyTasks, completedTasks = resources.completedTasks, labOrg = resources.labOrg, resultPdfDocumentReference = resources.resultPdfDocumentReference, labGeneratedResultPdfDocumentReference = resources.labGeneratedResultPdfDocumentReference;
                matchTask = __spreadArray(__spreadArray([], readyTasks, true), completedTasks, true).find(function (task) {
                    var _a, _b;
                    return (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) { return c.system === utils_1.LAB_ORDER_TASK.system && c.code === utils_1.LAB_ORDER_TASK.code.matchUnsolicitedResult; });
                });
                reviewTask = __spreadArray(__spreadArray([], readyTasks, true), completedTasks, true).find(function (task) {
                    var _a, _b;
                    return (_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (c) {
                        return c.system === utils_1.LAB_ORDER_TASK.system &&
                            (c.code === utils_1.LAB_ORDER_TASK.code.reviewFinalResult ||
                                c.code === utils_1.LAB_ORDER_TASK.code.reviewPreliminaryResult ||
                                c.code === utils_1.LAB_ORDER_TASK.code.reviewCorrectedResult ||
                                c.code === utils_1.LAB_ORDER_TASK.code.reviewCancelledResult);
                    });
                });
                task = reviewTask || matchTask;
                if (!task) {
                    console.log("No tasks found for diagnostic report: ".concat(diagnosticReport.id));
                    return [2 /*return*/];
                }
                else {
                    console.log('task id being passed to parseLabOrderStatusWithSpecificTask:', task.id);
                }
                // const history: LabOrderHistoryRow[] = [parseTaskReceivedAndReviewedAndCorrectedHistory(task, )]
                console.log('forming result detail for', diagnosticReport.id);
                return [4 /*yield*/, getResultDetailsBasedOnDr(diagnosticReport, task, resultPdfDocumentReference, labGeneratedResultPdfDocumentReference, token)];
            case 1:
                detail = _a.sent();
                console.log('formatting dto');
                dto = {
                    testItem: (0, utils_1.getTestNameOrCodeFromDr)(diagnosticReport),
                    fillerLab: (labOrg === null || labOrg === void 0 ? void 0 : labOrg.name) || '',
                    orderStatus: (0, helpers_1.parseLabOrderStatusWithSpecificTask)(diagnosticReport, task, undefined, null),
                    isPSC: false,
                    lastResultReceivedDate: diagnosticReport.effectiveDateTime || '',
                    accessionNumbers: [(0, exports.parseAccessionNumberFromDr)(diagnosticReport)],
                    history: [], // todo post mvp
                    resultsDetails: [detail],
                    questionnaire: [], // will always be empty but is easier for the front end to consume an empty array
                    samples: [], // will always be empty but is easier for the front end to consume an empty array
                };
                return [2 /*return*/, dto];
        }
    });
}); };
exports.formatResourcesIntoDiagnosticReportLabDTO = formatResourcesIntoDiagnosticReportLabDTO;
var getResultDetailsBasedOnDr = function (diagnosticReport, task, resultPdfDocRef, labGeneratedResultPdfDocRef, token) { return __awaiter(void 0, void 0, void 0, function () {
    var resultType, docRefs, _a, resultPdfUrl, labGeneratedResultUrls, testType, resultDetail;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('doc refs included', resultPdfDocRef === null || resultPdfDocRef === void 0 ? void 0 : resultPdfDocRef.id, labGeneratedResultPdfDocRef === null || labGeneratedResultPdfDocRef === void 0 ? void 0 : labGeneratedResultPdfDocRef.id);
                resultType = (function () {
                    switch (diagnosticReport.status) {
                        case 'final':
                            return 'final';
                        case 'preliminary':
                            return 'preliminary';
                        case 'cancelled':
                            return 'cancelled';
                        case 'corrected':
                            return 'corrected';
                        default:
                            throw Error("Error parsing result type for diagnostic report: ".concat(diagnosticReport.id));
                    }
                })();
                docRefs = [];
                if (resultPdfDocRef)
                    docRefs.push(resultPdfDocRef);
                if (labGeneratedResultPdfDocRef)
                    docRefs.push(labGeneratedResultPdfDocRef);
                return [4 /*yield*/, getResultPDFUrlsBasedOnDrs(docRefs, token)];
            case 1:
                _a = _b.sent(), resultPdfUrl = _a.resultPdfUrl, labGeneratedResultUrls = _a.labGeneratedResultUrls;
                testType = (0, exports.diagnosticReportSpecificResultType)(diagnosticReport);
                console.log('testType', testType);
                if (!testType)
                    throw new Error("no result-type tag on the DiagnosticReport ".concat(diagnosticReport.id));
                resultDetail = {
                    testItem: (0, utils_1.getTestNameOrCodeFromDr)(diagnosticReport),
                    testType: testType,
                    resultType: resultType,
                    labStatus: (0, helpers_1.parseLabOrderStatusWithSpecificTask)(diagnosticReport, task, undefined, null),
                    receivedDate: diagnosticReport.effectiveDateTime || '',
                    reviewedDate: '', // todo future, this only gets passed for prelim
                    resultPdfUrl: resultPdfUrl,
                    diagnosticReportId: diagnosticReport.id || '',
                    taskId: task.id || '',
                    alternatePlacerId: (0, utils_1.getAdditionalPlacerId)(diagnosticReport),
                    labGeneratedResultUrls: labGeneratedResultUrls,
                };
                return [2 /*return*/, resultDetail];
        }
    });
}); };
var getResultPDFUrlsBasedOnDrs = function (docRefs, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var documents, resultPDFs, resultPdfUrl, labGeneratedResults, labGeneratedResultUrls;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, exports.fetchLabDocumentPresignedUrls)(docRefs, m2mToken)];
            case 1:
                documents = _a.sent();
                resultPDFs = documents === null || documents === void 0 ? void 0 : documents.resultPDFs;
                resultPdfUrl = '';
                if ((resultPDFs === null || resultPDFs === void 0 ? void 0 : resultPDFs.length) !== 1) {
                    console.log('Unexpected number of resultPDFs returned: ', resultPDFs === null || resultPDFs === void 0 ? void 0 : resultPDFs.length);
                }
                else {
                    resultPdfUrl = resultPDFs[0].presignedURL;
                }
                labGeneratedResults = documents === null || documents === void 0 ? void 0 : documents.labGeneratedResults;
                if (labGeneratedResults && (labGeneratedResults === null || labGeneratedResults === void 0 ? void 0 : labGeneratedResults.length) > 0) {
                    labGeneratedResultUrls = labGeneratedResults.map(function (result) { return result.presignedURL; });
                }
                return [2 /*return*/, { resultPdfUrl: resultPdfUrl, labGeneratedResultUrls: labGeneratedResultUrls }];
        }
    });
}); };
var parseAccessionNumberFromDr = function (result) {
    var NOT_FOUND = '';
    if (result.identifier) {
        var accessionIdentifier = result.identifier.find(function (identifier) { var _a, _b; return ((_b = (_a = identifier.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === 'FILL'; })) && identifier.use === 'usual'; });
        if (accessionIdentifier === null || accessionIdentifier === void 0 ? void 0 : accessionIdentifier.value) {
            return accessionIdentifier.value;
        }
    }
    return NOT_FOUND;
};
exports.parseAccessionNumberFromDr = parseAccessionNumberFromDr;
// todo labs team - this logic will change when we implement workers comp, but for now
// we will just ignore those types of accounts to restore functionality
var accountIsPatientBill = function (account) {
    var _a, _b, _c, _d;
    var patientBillSystem = (_a = utils_1.PATIENT_BILLING_ACCOUNT_TYPE === null || utils_1.PATIENT_BILLING_ACCOUNT_TYPE === void 0 ? void 0 : utils_1.PATIENT_BILLING_ACCOUNT_TYPE.coding) === null || _a === void 0 ? void 0 : _a[0].system;
    var patientBillCode = (_b = utils_1.PATIENT_BILLING_ACCOUNT_TYPE === null || utils_1.PATIENT_BILLING_ACCOUNT_TYPE === void 0 ? void 0 : utils_1.PATIENT_BILLING_ACCOUNT_TYPE.coding) === null || _b === void 0 ? void 0 : _b[0].code;
    var isPatientBill = (_d = (_c = account.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.some(function (coding) { return coding.system === patientBillSystem && coding.code === patientBillCode; });
    return !!isPatientBill;
};
exports.accountIsPatientBill = accountIsPatientBill;

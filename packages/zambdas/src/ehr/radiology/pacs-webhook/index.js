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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var tasks_1 = require("../../../shared/tasks");
var shared_2 = require("../shared");
var validation_1 = require("./validation");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'radiology-pacs-webhook';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (unsafeInput) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, oystehr, validatedInput, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                console.log('Received input body: ', JSON.stringify(unsafeInput.body, null, 2));
                secrets = (0, validation_1.validateSecrets)(unsafeInput.secrets);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, (0, validation_1.validateInput)(unsafeInput)];
            case 2:
                validatedInput = _a.sent();
                return [4 /*yield*/, accessCheck(unsafeInput.headers, secrets)];
            case 3:
                _a.sent();
                return [4 /*yield*/, performEffect(validatedInput, oystehr, secrets)];
            case 4:
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({}),
                    }];
            case 5:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, unsafeInput.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
var accessCheck = function (headers, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (headers == null || !headers.Authorization) {
            throw new Error('Unauthorized');
        }
        if (headers.Authorization.split('Bearer ')[1] !== (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_WEBHOOK_SECRET, secrets)) {
            throw new Error('Forbidden');
        }
        return [2 /*return*/];
    });
}); };
var performEffect = function (validatedInput, oystehr, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var resource;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resource = validatedInput.resource;
                if (resource.id == null) {
                    throw new Error('Resource ID is required');
                }
                if (!(resource.resourceType === 'ServiceRequest')) return [3 /*break*/, 2];
                return [4 /*yield*/, handleServiceRequest(resource, oystehr)];
            case 1:
                _a.sent();
                return [3 /*break*/, 7];
            case 2:
                if (!(resource.resourceType === 'DiagnosticReport')) return [3 /*break*/, 4];
                return [4 /*yield*/, handleDiagnosticReport(resource, oystehr, secrets)];
            case 3:
                _a.sent();
                return [3 /*break*/, 7];
            case 4:
                if (!(resource.resourceType === 'ImagingStudy')) return [3 /*break*/, 6];
                return [4 /*yield*/, handleImagingStudy(resource, oystehr, secrets)];
            case 5:
                _a.sent();
                return [3 /*break*/, 7];
            case 6: throw new Error('Unexpected resource type in performEffect');
            case 7: return [2 /*return*/];
        }
    });
}); };
var handleServiceRequest = function (advaPacsServiceRequest, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var accessionNumber, srResults, srToUpdate, operations, patchResponse;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log('processing ServiceRequest');
                accessionNumber = (_b = (_a = advaPacsServiceRequest.identifier) === null || _a === void 0 ? void 0 : _a.find(function (i) {
                    var _a, _b, _c, _d;
                    return (((_b = (_a = i.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].system) === shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM &&
                        ((_d = (_c = i.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code) === shared_2.HL7_IDENTIFIER_TYPE_CODE_SYSTEM_ACCESSION_NUMBER &&
                        i.system === shared_2.ACCESSION_NUMBER_CODE_SYSTEM);
                })) === null || _b === void 0 ? void 0 : _b.value;
                if (accessionNumber == null) {
                    throw new Error('Accession number is required');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: [
                            {
                                name: '_tag',
                                value: "".concat(shared_2.ORDER_TYPE_CODE_SYSTEM, "|radiology"),
                            },
                            {
                                name: 'identifier',
                                // TODO can we include also the type.coding.system & code to be super exact here?
                                value: "".concat(shared_2.ACCESSION_NUMBER_CODE_SYSTEM, "|").concat(accessionNumber),
                            },
                        ],
                    })];
            case 1:
                srResults = (_d.sent()).unbundle();
                if (srResults.length === 0) {
                    console.log('No matching ServiceRequest found in Oystehr. Doing nothing for accession number: ', accessionNumber);
                    return [2 /*return*/];
                    // throw new Error('No ServiceRequest found with the given accession number');
                }
                if (srResults.length > 1) {
                    throw new Error('Multiple ServiceRequests found with the given accession number');
                }
                srToUpdate = srResults[0];
                console.log('Updating our ServiceRequest with ID: ', srToUpdate.id);
                if (srToUpdate.id == null) {
                    throw new Error('ServiceRequest ID is required');
                }
                operations = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: advaPacsServiceRequest.status,
                    },
                ];
                // The idea is that the first time we get a ServiceRequest in the completed state, that should be the time that the order was performed.
                if (advaPacsServiceRequest.status === 'completed') {
                    if (srToUpdate.status !== 'completed' &&
                        ((_c = srToUpdate.extension) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.url === shared_2.SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL; })) == null) {
                        operations.push({
                            op: 'add',
                            path: '/extension/-',
                            value: {
                                url: shared_2.SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
                                valueDateTime: luxon_1.DateTime.now().toISO(),
                            },
                        });
                    }
                }
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'ServiceRequest',
                        id: srToUpdate.id,
                        operations: operations,
                    })];
            case 2:
                patchResponse = _d.sent();
                console.log('Patch succeeded: ', JSON.stringify(patchResponse, null, 2));
                return [2 /*return*/];
        }
    });
}); };
var handleDiagnosticReport = function (advaPacsDiagnosticReport, oystehr, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var drSearchResults, _a, diagnosticReports, serviceRequests, patients, encounters, practitioners, drToUpdate, additionalResources;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log('processing DiagnosticReport');
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'DiagnosticReport',
                        params: [
                            {
                                name: 'identifier',
                                // TODO can we include also the type.coding.system & code to be super exact here?
                                value: "".concat(shared_2.ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM, "|").concat(advaPacsDiagnosticReport.id),
                            },
                            {
                                name: '_include',
                                value: 'DiagnosticReport:based-on', // service request
                            },
                            {
                                name: '_include',
                                value: 'DiagnosticReport:subject', // patient
                            },
                            {
                                name: '_include:iterate',
                                value: 'ServiceRequest:encounter',
                            },
                            {
                                name: '_include:iterate',
                                value: 'ServiceRequest:requester',
                            },
                        ],
                    })];
            case 1:
                drSearchResults = (_b.sent()).unbundle();
                _a = drSearchResults.reduce(function (acc, resource) {
                    if (resource.resourceType === 'DiagnosticReport')
                        acc.diagnosticReports.push(resource);
                    if (resource.resourceType === 'ServiceRequest')
                        acc.serviceRequests.push(resource);
                    if (resource.resourceType === 'Patient')
                        acc.patients.push(resource);
                    if (resource.resourceType === 'Encounter')
                        acc.encounters.push(resource);
                    if (resource.resourceType === 'Practitioner')
                        acc.practitioners.push(resource);
                    return acc;
                }, { diagnosticReports: [], serviceRequests: [], patients: [], encounters: [], practitioners: [] }), diagnosticReports = _a.diagnosticReports, serviceRequests = _a.serviceRequests, patients = _a.patients, encounters = _a.encounters, practitioners = _a.practitioners;
                if (!(diagnosticReports.length > 1)) return [3 /*break*/, 2];
                throw new Error('Multiple DiagnosticReports found with the given ID');
            case 2:
                if (!(diagnosticReports.length === 1)) return [3 /*break*/, 4];
                drToUpdate = diagnosticReports[0];
                if (drToUpdate.id == null) {
                    throw new Error('DiagnosticReport ID is required');
                }
                additionalResources = validateAdditionalResources(drToUpdate, serviceRequests, patients, encounters, practitioners);
                return [4 /*yield*/, handleUpdateDiagnosticReport(advaPacsDiagnosticReport, drToUpdate, additionalResources, oystehr)];
            case 3:
                _b.sent();
                return [3 /*break*/, 6];
            case 4:
                if (!(drSearchResults.length === 0)) return [3 /*break*/, 6];
                return [4 /*yield*/, handleCreateDiagnosticReport(advaPacsDiagnosticReport, oystehr, secrets)];
            case 5:
                _b.sent();
                _b.label = 6;
            case 6: return [2 /*return*/];
        }
    });
}); };
var handleCreateDiagnosticReport = function (advaPacsDiagnosticReport, oystehr, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var pacsServiceRequestRelativeReference, pacsServiceRequest, pacsServiceRequestAccessionNumber, ourServiceRequest;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                console.log('Processing DiagnosticReport create');
                pacsServiceRequestRelativeReference = (_b = (_a = advaPacsDiagnosticReport.basedOn) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference;
                if (pacsServiceRequestRelativeReference == null) {
                    throw new Error('The DiagnosticReport was not associated with any ServiceRequest');
                }
                return [4 /*yield*/, getAdvaPacsServiceRequestByID(pacsServiceRequestRelativeReference, secrets)];
            case 1:
                pacsServiceRequest = _e.sent();
                console.log('Found PACS ServiceRequest: ', pacsServiceRequest);
                pacsServiceRequestAccessionNumber = (_d = (_c = pacsServiceRequest.identifier) === null || _c === void 0 ? void 0 : _c.find(function (i) { return i.system === shared_2.ACCESSION_NUMBER_CODE_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.value;
                if (pacsServiceRequestAccessionNumber == null) {
                    throw new Error('The ServiceRequest was not associated with any accession number');
                }
                return [4 /*yield*/, getOurServiceRequestByAccessionNumber(pacsServiceRequestAccessionNumber, oystehr)];
            case 2:
                ourServiceRequest = _e.sent();
                console.log('Found our ServiceRequest: ', pacsServiceRequest);
                return [4 /*yield*/, createOurDiagnosticReport(ourServiceRequest, advaPacsDiagnosticReport, oystehr)];
            case 3:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); };
var handleUpdateDiagnosticReport = function (advaPacsDiagnosticReport, ourDiagnosticReport, additionalResources, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var requests, diagnosticReportPathOps, reviewTaskPostRequest;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('processing DiagnosticReport update');
                console.log('Updating our DiagnosticReport with ID: ', ourDiagnosticReport.id);
                requests = [];
                diagnosticReportPathOps = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: advaPacsDiagnosticReport.status,
                    },
                    {
                        op: 'add',
                        path: '/presentedForm',
                        value: advaPacsDiagnosticReport.presentedForm,
                    },
                ];
                if (advaPacsDiagnosticReport.issued && ourDiagnosticReport.issued == null) {
                    diagnosticReportPathOps.push({
                        op: 'add',
                        path: '/issued',
                        value: advaPacsDiagnosticReport.issued,
                    });
                }
                else if (advaPacsDiagnosticReport.issued && ourDiagnosticReport.issued) {
                    diagnosticReportPathOps.push({
                        op: 'replace',
                        path: '/issued',
                        value: advaPacsDiagnosticReport.issued,
                    });
                }
                else if (ourDiagnosticReport.status !== advaPacsDiagnosticReport.status &&
                    advaPacsDiagnosticReport.status === 'final') {
                    diagnosticReportPathOps.push({
                        op: 'add',
                        path: '/issued',
                        value: luxon_1.DateTime.now().toISO(),
                    });
                }
                if (ourDiagnosticReport.status !== advaPacsDiagnosticReport.status && advaPacsDiagnosticReport.status === 'final') {
                    reviewTaskPostRequest = configReviewResultTask(ourDiagnosticReport, additionalResources);
                    console.log('task config to be made', JSON.stringify(reviewTaskPostRequest.resource));
                    requests.push(reviewTaskPostRequest);
                }
                console.log('Updating our DiagnosticReport with operations: ', JSON.stringify(diagnosticReportPathOps, null, 2));
                requests.push({
                    method: 'PATCH',
                    url: "DiagnosticReport/".concat(ourDiagnosticReport.id),
                    operations: diagnosticReportPathOps,
                });
                console.log("making transaction request for handleUpdateDiagnosticReport");
                return [4 /*yield*/, oystehr.fhir.transaction({ requests: requests })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var configReviewResultTask = function (diagnosticReport, additionalResources) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    console.log('configuring review radiology final results task for', diagnosticReport.id);
    var encounter = additionalResources.encounter, serviceRequest = additionalResources.serviceRequest, patient = additionalResources.patient, requestingProvider = additionalResources.requestingProvider;
    var serviceRequestRef = (_b = (_a = diagnosticReport.basedOn) === null || _a === void 0 ? void 0 : _a.find(function (ref) { var _a; return (_a = ref.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _b === void 0 ? void 0 : _b.reference;
    var appointmentId = (_d = (_c = encounter.appointment) === null || _c === void 0 ? void 0 : _c[0].reference) === null || _d === void 0 ? void 0 : _d.replace('Appointment/', '');
    var locationId = (_g = (_f = (_e = encounter.location) === null || _e === void 0 ? void 0 : _e.find(function (loc) { var _a; return (_a = loc.location.reference) === null || _a === void 0 ? void 0 : _a.startsWith('Location/'); })) === null || _f === void 0 ? void 0 : _f.location.reference) === null || _g === void 0 ? void 0 : _g.replace('Location/', '');
    var providerFirstName = (_k = (_j = (_h = requestingProvider === null || requestingProvider === void 0 ? void 0 : requestingProvider.name) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.given) === null || _k === void 0 ? void 0 : _k[0];
    var providerLastName = (_m = (_l = requestingProvider === null || requestingProvider === void 0 ? void 0 : requestingProvider.name) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.family;
    var newTask = (0, tasks_1.createTask)({
        category: utils_1.RADIOLOGY_TASK.category,
        code: {
            system: utils_1.RADIOLOGY_TASK.system,
            code: utils_1.RADIOLOGY_TASK.code.reviewFinalResultTask,
        },
        encounterId: encounter.id,
        basedOn: __spreadArray(["DiagnosticReport/".concat(diagnosticReport.id)], (serviceRequestRef ? [serviceRequestRef] : []), true),
        location: locationId ? { id: locationId } : undefined,
        input: [
            {
                type: utils_1.RADIOLOGY_TASK.input.appointmentId,
                valueString: appointmentId,
            },
            {
                type: utils_1.RADIOLOGY_TASK.input.orderDate,
                valueString: serviceRequest.authoredOn,
            },
            {
                type: utils_1.RADIOLOGY_TASK.input.patientName,
                valueString: (0, utils_1.getFullestAvailableName)(patient),
            },
            {
                type: utils_1.RADIOLOGY_TASK.input.providerName,
                valueString: "".concat(providerFirstName, " ").concat(providerLastName),
            },
        ],
    });
    var taskPostRequest = {
        method: 'POST',
        url: 'Task/',
        resource: newTask,
    };
    return taskPostRequest;
};
var validateAdditionalResources = function (diagnosticReport, serviceRequests, patients, encounters, practitioners) {
    if (serviceRequests.length !== 1) {
        throw new Error("Unexpected number of serviceRequests found for diagnostic report: ".concat(diagnosticReport.id, ". SR Len: ").concat(serviceRequests.length));
    }
    if (patients.length !== 1) {
        throw new Error("Unexpected number of patients found for diagnostic report: ".concat(diagnosticReport.id, ". Patients Len: ").concat(patients.length));
    }
    if (encounters.length !== 1) {
        throw new Error("Unexpected number of encounters found for diagnostic report: ".concat(diagnosticReport.id, ". Encounters Len: ").concat(encounters.length));
    }
    if (practitioners.length !== 1) {
        throw new Error("Unexpected number of practitioners found for diagnostic report: ".concat(diagnosticReport.id, ". Practitioners Len: ").concat(practitioners.length));
    }
    return {
        patient: patients[0],
        serviceRequest: serviceRequests[0],
        encounter: encounters[0],
        requestingProvider: practitioners[0],
    };
};
var handleImagingStudy = function (advaPacsImagingStudy, oystehr, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var accessionNumber;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log('Processing ImagingStudy');
                accessionNumber = (_b = (_a = advaPacsImagingStudy.identifier) === null || _a === void 0 ? void 0 : _a.find(function (identifier) { return identifier.system === shared_2.ACCESSION_NUMBER_CODE_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
                if (accessionNumber == null) {
                    throw new Error('The ImagingStudy did not have an accession number');
                }
                return [4 /*yield*/, updateServiceRequestToCompletedInAdvaPacs(accessionNumber, secrets)];
            case 1:
                _c.sent();
                console.log('PACS SR PUT succeeded in updating SR to completed');
                return [2 /*return*/];
        }
    });
}); };
var getAdvaPacsServiceRequestByID = function (serviceRequestRelativeReference, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var advapacsClientId, advapacsClientSecret, advapacsAuthString, advapacsResponse, _a, _b, _c, _d, _e, maybeSR, error_2;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 5, , 6]);
                advapacsClientId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
                advapacsClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
                advapacsAuthString = "ID=".concat(advapacsClientId, ",Secret=").concat(advapacsClientSecret);
                return [4 /*yield*/, fetch("".concat(shared_2.ADVAPACS_FHIR_BASE_URL, "/").concat(serviceRequestRelativeReference), {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/fhir+json',
                            Authorization: advapacsAuthString,
                        },
                    })];
            case 1:
                advapacsResponse = _f.sent();
                if (!!advapacsResponse.ok) return [3 /*break*/, 3];
                _a = Error.bind;
                _c = (_b = "advapacs transaction errored out with statusCode ".concat(advapacsResponse.status, ", status text ").concat(advapacsResponse.statusText, ", and body ")).concat;
                _e = (_d = JSON).stringify;
                return [4 /*yield*/, advapacsResponse.json()];
            case 2: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_e.apply(_d, [_f.sent(), null, 2])])]))();
            case 3: return [4 /*yield*/, advapacsResponse.json()];
            case 4:
                maybeSR = _f.sent();
                if (maybeSR.resourceType !== 'ServiceRequest') {
                    throw new Error("Expected ServiceRequest but got ".concat(maybeSR.resourceType));
                }
                return [2 /*return*/, maybeSR];
            case 5:
                error_2 = _f.sent();
                console.log('getAdvaPacsServiceRequestByID error: ', error_2);
                throw error_2;
            case 6: return [2 /*return*/];
        }
    });
}); };
var getOurServiceRequestByAccessionNumber = function (accessionNumber, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var srResults;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'ServiceRequest',
                    params: [
                        {
                            name: '_tag',
                            value: "".concat(shared_2.ORDER_TYPE_CODE_SYSTEM, "|radiology"),
                        },
                        {
                            name: 'identifier',
                            // TODO can we include also the type.coding.system & code to be super exact here?
                            value: "".concat(shared_2.ACCESSION_NUMBER_CODE_SYSTEM, "|").concat(accessionNumber),
                        },
                    ],
                })];
            case 1:
                srResults = (_a.sent()).unbundle();
                if (srResults.length === 0) {
                    throw new Error('No ServiceRequest found with the given accession number');
                }
                if (srResults.length > 1) {
                    throw new Error('Multiple ServiceRequests found with the given accession number');
                }
                return [2 /*return*/, srResults[0]];
        }
    });
}); };
var createOurDiagnosticReport = function (serviceRequest, pacsDiagnosticReport, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var diagnosticReportToCreate, createResult;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                diagnosticReportToCreate = {
                    resourceType: 'DiagnosticReport',
                    status: pacsDiagnosticReport.status,
                    subject: serviceRequest.subject,
                    basedOn: [
                        {
                            reference: "ServiceRequest/".concat(serviceRequest.id),
                        },
                    ],
                    identifier: [
                        {
                            system: shared_2.ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM,
                            value: pacsDiagnosticReport.id,
                        },
                    ],
                    code: (_a = pacsDiagnosticReport.code) !== null && _a !== void 0 ? _a : {
                        // Advapacs does not send a code even though it is required in the FHIR spec
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: '18748-4',
                                display: 'Radiology Report',
                            },
                        ],
                    },
                    presentedForm: pacsDiagnosticReport.presentedForm,
                };
                if (pacsDiagnosticReport.status === 'preliminary') {
                    diagnosticReportToCreate.extension = [
                        {
                            url: shared_2.DIAGNOSTIC_REPORT_PRELIMINARY_REVIEW_ON_EXTENSION_URL,
                            valueDateTime: luxon_1.DateTime.now().toISO(),
                        },
                    ];
                }
                return [4 /*yield*/, oystehr.fhir.create(diagnosticReportToCreate)];
            case 1:
                createResult = _b.sent();
                console.log('Created our DiagnosticReport: ', JSON.stringify(createResult, null, 2));
                return [2 /*return*/];
        }
    });
}); };
var updateServiceRequestToCompletedInAdvaPacs = function (accessionNumber, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var advapacsClientId, advapacsClientSecret, advapacsAuthString, findServiceRequestResponse, _a, _b, _c, _d, _e, maybeAdvaPACSSr, advapacsSR, advapacsResponse, _f, _g, _h, _j, _k, error_3;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                _l.trys.push([0, 8, , 9]);
                advapacsClientId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_ID, secrets);
                advapacsClientSecret = (0, utils_1.getSecret)(utils_1.SecretsKeys.ADVAPACS_CLIENT_SECRET, secrets);
                advapacsAuthString = "ID=".concat(advapacsClientId, ",Secret=").concat(advapacsClientSecret);
                if (!accessionNumber) {
                    throw new Error('No accession number found in oystehr service request, cannot update AdvaPACS.');
                }
                return [4 /*yield*/, fetch("".concat(shared_2.ADVAPACS_FHIR_BASE_URL, "/ServiceRequest?identifier=").concat(shared_2.ACCESSION_NUMBER_CODE_SYSTEM, "%7C").concat(accessionNumber), {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/fhir+json',
                            Authorization: advapacsAuthString,
                        },
                    })];
            case 1:
                findServiceRequestResponse = _l.sent();
                if (!!findServiceRequestResponse.ok) return [3 /*break*/, 3];
                _a = Error.bind;
                _c = (_b = "advapacs search errored out with statusCode ".concat(findServiceRequestResponse.status, ", status text ").concat(findServiceRequestResponse.statusText, ", and body ")).concat;
                _e = (_d = JSON).stringify;
                return [4 /*yield*/, findServiceRequestResponse.json()];
            case 2: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_e.apply(_d, [_l.sent(), null, 2])])]))();
            case 3: return [4 /*yield*/, findServiceRequestResponse.json()];
            case 4:
                maybeAdvaPACSSr = _l.sent();
                if (maybeAdvaPACSSr.resourceType !== 'Bundle') {
                    throw new Error("Expected response to be Bundle but got ".concat(maybeAdvaPACSSr.resourceType));
                }
                if (maybeAdvaPACSSr.entry.length === 0) {
                    throw new Error("No service request found in AdvaPACS for accession number ".concat(accessionNumber));
                }
                if (maybeAdvaPACSSr.entry.length > 1) {
                    throw new Error("Found multiple service requests in AdvaPACS for accession number ".concat(accessionNumber, ", cannot update."));
                }
                advapacsSR = maybeAdvaPACSSr.entry[0].resource;
                if (advapacsSR.status === 'completed') {
                    console.log('ServiceRequest is already completed in AdvaPACS, no need to update');
                    return [2 /*return*/];
                }
                return [4 /*yield*/, fetch("".concat(shared_2.ADVAPACS_FHIR_BASE_URL, "/ServiceRequest/").concat(advapacsSR.id), {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/fhir+json',
                            Authorization: advapacsAuthString,
                        },
                        body: JSON.stringify(__assign(__assign({}, advapacsSR), { status: 'completed' })),
                    })];
            case 5:
                advapacsResponse = _l.sent();
                if (!!advapacsResponse.ok) return [3 /*break*/, 7];
                _f = Error.bind;
                _h = (_g = "advapacs transaction errored out with statusCode ".concat(advapacsResponse.status, ", status text ").concat(advapacsResponse.statusText, ", and body ")).concat;
                _k = (_j = JSON).stringify;
                return [4 /*yield*/, advapacsResponse.json()];
            case 6: throw new (_f.apply(Error, [void 0, _h.apply(_g, [_k.apply(_j, [_l.sent(), null, 2])])]))();
            case 7: return [3 /*break*/, 9];
            case 8:
                error_3 = _l.sent();
                console.error('Error updating service request to complete in AdvaPacs:', error_3);
                throw new Error('Failed to update service request to complete in AdvaPacs');
            case 9: return [2 /*return*/];
        }
    });
}); };

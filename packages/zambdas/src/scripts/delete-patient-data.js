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
exports.deletePatientData = void 0;
var sdk_1 = require("@oystehr/sdk");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var getAllFhirSearchPages_1 = require("utils/lib/fhir/getAllFhirSearchPages");
var CHUNK_SIZE = 50;
// in this script, deleting RelatedPersons is expected
var NEVER_DELETE_TYPES = utils_1.NEVER_DELETE.filter(function (type) { return type !== 'Person'; });
var deletePatientData = function (oystehr, patientId, cutOffDate) { return __awaiter(void 0, void 0, void 0, function () {
    var allResources, deleteRequests, patientDeleteCount, i, requestGroup, e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPatientAndResourcesById(oystehr, patientId, cutOffDate)];
            case 1:
                allResources = _a.sent();
                if (allResources.length === 0) {
                    return [2 /*return*/, { patients: 0, otherResources: 0 }];
                }
                deleteRequests = generateDeleteRequests(allResources);
                patientDeleteCount = 0;
                i = 0;
                _a.label = 2;
            case 2:
                if (!(i < deleteRequests.length)) return [3 /*break*/, 10];
                requestGroup = deleteRequests[i];
                _a.label = 3;
            case 3:
                _a.trys.push([3, 6, 7, 8]);
                console.log('Deleting resources chunk', i + 1, 'of', deleteRequests.length);
                return [4 /*yield*/, oystehr.fhir.batch({ requests: requestGroup })];
            case 4:
                _a.sent();
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
            case 5:
                _a.sent();
                return [3 /*break*/, 8];
            case 6:
                e_1 = _a.sent();
                console.log("Error deleting resources: ".concat(e_1), JSON.stringify(e_1));
                console.log('patient id', patientId);
                return [3 /*break*/, 8];
            case 7:
                console.log('Deleting resources chunk', i + 1, 'of', deleteRequests.length, 'complete');
                return [7 /*endfinally*/];
            case 8:
                patientDeleteCount += requestGroup.filter(function (request) { return request.url.startsWith('/Patient'); }).length;
                _a.label = 9;
            case 9:
                i++;
                return [3 /*break*/, 2];
            case 10: return [2 /*return*/, {
                    patients: patientDeleteCount,
                    otherResources: deleteRequests.map(function (group) { return group.length; }).reduce(function (acc, curr) { return acc + curr; }) - patientDeleteCount,
                }];
        }
    });
}); };
exports.deletePatientData = deletePatientData;
var generateDeleteRequests = function (allResources) {
    var deleteRequests = allResources
        .map(function (resource) {
        if (!resource.id || NEVER_DELETE_TYPES.includes(resource.resourceType)) {
            console.log('excluding', "".concat(resource.resourceType, "/").concat(resource.id));
            return;
        }
        return { method: 'DELETE', url: "/".concat(resource.resourceType, "/").concat(resource.id) };
    })
        .filter(function (request) { return request !== undefined; });
    var patientDeleteRequest = deleteRequests.filter(function (request) { return request.url.startsWith('/Patient'); });
    var nonObservationDeleteRequests = (0, utils_1.chunkThings)(deleteRequests.filter(function (request) { return !request.url.startsWith('/Observation') && !request.url.startsWith('/Patient'); }), CHUNK_SIZE);
    var observationDeleteRequests = (0, utils_1.chunkThings)(deleteRequests.filter(function (request) { return request.url.startsWith('/Observation'); }), CHUNK_SIZE);
    // delete patient last in case of timeouts
    return __spreadArray(__spreadArray(__spreadArray([], observationDeleteRequests, true), nonObservationDeleteRequests, true), [patientDeleteRequest], false);
};
var getPatientAndResourcesById = function (oystehr, patientId, cutOffDate) { return __awaiter(void 0, void 0, void 0, function () {
    var fhirSearchParams, allResources, error_1, error_2, appointments, startTimes, hasRecentAppointments;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                fhirSearchParams = {
                    resourceType: 'Patient',
                    params: [
                        {
                            name: '_id',
                            value: patientId,
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Appointment:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Encounter:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Communication:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ClinicalImpression:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'AuditEvent:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ServiceRequest:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DiagnosticReport:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Specimen:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Account:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Consent:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Coverage:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'MedicationRequest:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Procedure:patient',
                        },
                        {
                            name: '_revinclude',
                            value: 'List:subject',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Person:relatedperson',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'QuestionnaireResponse:encounter',
                        },
                        // if lots of batch deletes fail, it's probably because of observations. comment this out if so.
                        {
                            name: '_revinclude:iterate',
                            value: 'Observation:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ServiceRequest:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ClinicalImpression:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Task:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'MedicationAdministration:context',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'MedicationStatement:part-of',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Task:based-on',
                        },
                        {
                            name: '_revinclude',
                            value: 'Task:focus',
                        },
                        {
                            name: '_include',
                            value: 'ServiceRequest:specimen',
                        },
                    ],
                };
                allResources = [];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 8]);
                return [4 /*yield*/, (0, getAllFhirSearchPages_1.getAllFhirSearchPages)(fhirSearchParams, oystehr, 10)];
            case 2:
                allResources = _a.sent();
                return [3 /*break*/, 8];
            case 3:
                error_1 = _a.sent();
                console.log("Error fetching resources: ".concat(error_1), JSON.stringify(error_1));
                if (!(error_1 instanceof sdk_1.default.OystehrSdkError && error_1.code === 4130)) return [3 /*break*/, 7];
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4 /*yield*/, (0, getAllFhirSearchPages_1.getAllFhirSearchPages)(fhirSearchParams, oystehr, 5)];
            case 5:
                allResources = _a.sent();
                return [3 /*break*/, 7];
            case 6:
                error_2 = _a.sent();
                console.log("Error fetching resources: ".concat(error_2), JSON.stringify(error_2));
                return [2 /*return*/, []];
            case 7: return [2 /*return*/, []];
            case 8:
                // if there are no appointments or encounters, delete this patient
                if (!allResources.some(function (resource) { return resource.resourceType === 'Appointment' || resource.resourceType === 'Encounter'; })) {
                    return [2 /*return*/, allResources];
                }
                appointments = allResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
                startTimes = appointments
                    .map(function (appointment) { var _a; return appointment.start || ((_a = appointment.meta) === null || _a === void 0 ? void 0 : _a.lastUpdated); })
                    .filter(function (time) { return time !== undefined; });
                hasRecentAppointments = startTimes.some(function (startTime) {
                    var appointmentStart = luxon_1.DateTime.fromISO(startTime);
                    return appointmentStart >= cutOffDate;
                });
                if (hasRecentAppointments) {
                    console.log('Patient has recent appointments, skipping');
                    return [2 /*return*/, []];
                }
                return [2 /*return*/, allResources];
        }
    });
}); };

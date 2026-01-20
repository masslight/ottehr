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
exports.getUrlAndVersionForADFromServiceRequest = exports.fetchActiveInHouseLabActivityDefinitions = exports.fetchResultResourcesForRelatedServiceRequest = exports.getRelatedServiceRequests = exports.provenanceIsTargetOfServiceRequest = exports.taskIsBasedOnServiceRequest = exports.getSpecimenDetails = void 0;
exports.determineOrderStatus = determineOrderStatus;
exports.buildOrderHistory = buildOrderHistory;
var utils_1 = require("utils");
function determineOrderStatus(serviceRequest, tasks) {
    var _a, _b;
    if (!serviceRequest)
        return 'ORDERED';
    var collectSampleTask = tasks.find(function (task) {
        var _a, _b;
        return (0, exports.taskIsBasedOnServiceRequest)(task, serviceRequest) &&
            ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) {
                return coding.system === utils_1.IN_HOUSE_LAB_TASK.system && coding.code === utils_1.IN_HOUSE_LAB_TASK.code.collectSampleTask;
            }));
    });
    console.log('collectSampleTask', collectSampleTask === null || collectSampleTask === void 0 ? void 0 : collectSampleTask.id, collectSampleTask === null || collectSampleTask === void 0 ? void 0 : collectSampleTask.status);
    var interpretResultsTask = tasks.find(function (task) {
        var _a, _b;
        return (0, exports.taskIsBasedOnServiceRequest)(task, serviceRequest) &&
            ((_b = (_a = task.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) {
                return coding.system === utils_1.IN_HOUSE_LAB_TASK.system && coding.code === utils_1.IN_HOUSE_LAB_TASK.code.inputResultsTask;
            } // todo: is it valid?
            ));
    });
    console.log('interpretResultsTask', interpretResultsTask === null || interpretResultsTask === void 0 ? void 0 : interpretResultsTask.id, interpretResultsTask === null || interpretResultsTask === void 0 ? void 0 : interpretResultsTask.status);
    // Status Derivation:
    // Ordered: SR.status = draft & Task(CST).status = ready
    if (serviceRequest.status === 'draft' && ['ready', 'in-progress'].includes((_a = collectSampleTask === null || collectSampleTask === void 0 ? void 0 : collectSampleTask.status) !== null && _a !== void 0 ? _a : '')) {
        return 'ORDERED';
    }
    // Collected: SR.status = active & Task(CST).status = completed & Task(IRT).status = ready
    if (serviceRequest.status === 'active' &&
        (collectSampleTask === null || collectSampleTask === void 0 ? void 0 : collectSampleTask.status) === 'completed' &&
        ['ready', 'in-progress'].includes((_b = interpretResultsTask === null || interpretResultsTask === void 0 ? void 0 : interpretResultsTask.status) !== null && _b !== void 0 ? _b : '')) {
        return 'COLLECTED';
    }
    // Final: SR.status = completed && DR.status = 'final'
    if (serviceRequest.status === 'completed'
    // todo commenting this out for now as its not needed but that may change when we allow edits
    // (documentReference?.status === 'final' || documentReference?.status === 'amended')
    ) {
        return 'FINAL';
    }
    return 'UNKNOWN'; // todo: maybe add separate type for unknown status?
}
function buildOrderHistory(provenances, serviceRequest, specimen) {
    var _a, _b, _c;
    var history = [];
    console.log('building order history for sr', serviceRequest.id);
    // Add entries from provenances
    provenances.forEach(function (provenance) {
        var _a, _b, _c, _d, _e, _f;
        var relatedToSR = (0, exports.provenanceIsTargetOfServiceRequest)(provenance, serviceRequest);
        if (relatedToSR) {
            var activityCode = (_c = (_b = (_a = provenance.activity) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code;
            // Map activity codes to statuses
            var status_1;
            if (activityCode === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code) {
                status_1 = 'ORDERED';
            }
            else if (activityCode === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.inputResults.code) {
                status_1 = 'FINAL';
            }
            if (status_1 && provenance.recorded) {
                var agentName = ((_f = (_e = (_d = provenance.agent) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.who) === null || _f === void 0 ? void 0 : _f.display) || '';
                history.push({
                    status: status_1,
                    providerName: agentName,
                    date: provenance.recorded,
                });
            }
        }
    });
    if (specimen) {
        var collectedByDisplay = ((_b = (_a = specimen.collection) === null || _a === void 0 ? void 0 : _a.collector) === null || _b === void 0 ? void 0 : _b.display) || '';
        var collectedByDate = (_c = specimen.collection) === null || _c === void 0 ? void 0 : _c.collectedDateTime;
        if (collectedByDate) {
            history.push({
                status: 'COLLECTED',
                providerName: collectedByDisplay,
                date: collectedByDate,
            });
        }
    }
    history.sort(function (a, b) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    return history;
}
var getSpecimenDetails = function (specimen) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var specimenCollection = specimen.collection;
    if (specimenCollection) {
        var standardizedSource = (_c = (_b = (_a = specimenCollection.bodySite) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (c) { return c.system === utils_1.SPECIMEN_COLLECTION_SOURCE_SYSTEM; })) === null || _c === void 0 ? void 0 : _c.display;
        var customSource = (_f = (_e = (_d = specimenCollection.bodySite) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e.find(function (c) { return c.system === utils_1.SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM; })) === null || _f === void 0 ? void 0 : _f.display;
        var sources = [];
        if (standardizedSource)
            sources.push(standardizedSource);
        if (customSource)
            sources.push(customSource);
        // todo not sure if we want to split like this, think it might cause issues with timezones
        var collectedDateTimeIso = (_g = specimen.collection) === null || _g === void 0 ? void 0 : _g.collectedDateTime;
        var collectedDate = collectedDateTimeIso === null || collectedDateTimeIso === void 0 ? void 0 : collectedDateTimeIso.split('T')[0];
        var collectedTime = collectedDateTimeIso === null || collectedDateTimeIso === void 0 ? void 0 : collectedDateTimeIso.split('T')[1].split('.')[0];
        var specimenDetails = {
            source: sources.join(', '),
            collectedBy: ((_j = (_h = specimen.collection) === null || _h === void 0 ? void 0 : _h.collector) === null || _j === void 0 ? void 0 : _j.display) || '',
            collectionDate: collectedDate || '',
            collectionTime: collectedTime || '',
        };
        return specimenDetails;
    }
    throw new Error("missing specimen details for specimen ".concat(specimen.id));
};
exports.getSpecimenDetails = getSpecimenDetails;
var taskIsBasedOnServiceRequest = function (task, serviceRequest) {
    var _a;
    return !!((_a = task.basedOn) === null || _a === void 0 ? void 0 : _a.some(function (basedOn) { return basedOn.reference === "ServiceRequest/".concat(serviceRequest.id); }));
};
exports.taskIsBasedOnServiceRequest = taskIsBasedOnServiceRequest;
var provenanceIsTargetOfServiceRequest = function (provenance, serviceRequest) {
    var _a;
    return !!((_a = provenance.target) === null || _a === void 0 ? void 0 : _a.some(function (target) { return target.reference === "ServiceRequest/".concat(serviceRequest.id); }));
};
exports.provenanceIsTargetOfServiceRequest = provenanceIsTargetOfServiceRequest;
/**
 *
 * @param serviceRequests an array of service requests
 * @param serviceRequestSearchId the id of the service request driving the search (will not be included in the return)
 * @returns all service requests contained in basedOn for the serviceRequestSearchId or all service requests that contain serviceRequestSearchId in their basedOn
 */
var getRelatedServiceRequests = function (serviceRequests, serviceRequestSearchId) {
    var _a;
    var serviceRequestSearched;
    var additionalServiceRequests = serviceRequests.reduce(function (acc, sr) {
        if (sr.id) {
            if (sr.id !== serviceRequestSearchId) {
                acc.push(sr);
            }
            else {
                serviceRequestSearched = sr;
            }
        }
        return acc;
    }, []);
    var relatedServiceRequests = [];
    if (additionalServiceRequests.length > 0 && serviceRequestSearched) {
        // was the service request passed as the search param the initial test or ran as repeat?
        var initialServiceRequestId_1 = (serviceRequestSearched === null || serviceRequestSearched === void 0 ? void 0 : serviceRequestSearched.basedOn)
            ? (_a = serviceRequestSearched.basedOn[0].reference) === null || _a === void 0 ? void 0 : _a.replace('ServiceRequest/', '')
            : serviceRequestSearched === null || serviceRequestSearched === void 0 ? void 0 : serviceRequestSearched.id;
        console.log('initialServiceRequestId,', initialServiceRequestId_1);
        additionalServiceRequests.forEach(function (sr) {
            var _a, _b;
            // confirm its indeed related
            var basedOn = (_b = (_a = sr.basedOn) === null || _a === void 0 ? void 0 : _a[0].reference) === null || _b === void 0 ? void 0 : _b.replace('ServiceRequest/', '');
            if (sr.id === initialServiceRequestId_1 || (basedOn && basedOn === initialServiceRequestId_1)) {
                relatedServiceRequests.push(sr);
            }
        });
    }
    return relatedServiceRequests;
};
exports.getRelatedServiceRequests = getRelatedServiceRequests;
// these additional tests are either related via repeat testing or reflex testing
var fetchResultResourcesForRelatedServiceRequest = function (oystehr, serviceRequests) { return __awaiter(void 0, void 0, void 0, function () {
    var srResourceMap, resources, additionalDiagnosticReports, additionalObservations, additionalProvenances, additionalTasks, additionalSpecimens, additionalActivityDefinitions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('making requests for additional service requests representing related tests');
                srResourceMap = makeSrResourceMap(serviceRequests);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: [
                            {
                                name: '_id',
                                value: serviceRequests.map(function (sr) { return sr.id; }).join(','),
                            },
                            {
                                name: '_revinclude',
                                value: 'DiagnosticReport:based-on',
                            },
                            {
                                name: '_revinclude',
                                value: 'Observation:based-on',
                            },
                            {
                                name: '_revinclude',
                                value: 'Provenance:target',
                            },
                            {
                                name: '_revinclude',
                                value: 'Task:based-on',
                            },
                            {
                                name: '_include',
                                value: 'ServiceRequest:specimen',
                            },
                            {
                                name: '_include',
                                value: 'ServiceRequest:instantiates-canonical',
                            },
                        ],
                    })];
            case 1:
                resources = (_a.sent()).unbundle();
                additionalDiagnosticReports = [];
                additionalObservations = [];
                additionalProvenances = [];
                additionalTasks = [];
                additionalSpecimens = [];
                additionalActivityDefinitions = [];
                resources.forEach(function (r) {
                    if (r.resourceType === 'DiagnosticReport') {
                        additionalDiagnosticReports.push(r);
                        srResourceMap = addToSrResourceMap(r, 'diagnosticReports', srResourceMap);
                    }
                    if (r.resourceType === 'Observation') {
                        additionalObservations.push(r);
                        srResourceMap = addToSrResourceMap(r, 'observations', srResourceMap);
                    }
                    if (r.resourceType === 'Provenance') {
                        additionalProvenances.push(r);
                        srResourceMap = addToSrResourceMap(r, 'provenances', srResourceMap);
                    }
                    if (r.resourceType === 'Task') {
                        additionalTasks.push(r);
                        srResourceMap = addToSrResourceMap(r, 'tasks', srResourceMap);
                    }
                    if (r.resourceType === 'Specimen') {
                        additionalSpecimens.push(r);
                        srResourceMap = addToSrResourceMap(r, 'specimens', srResourceMap);
                    }
                    if (r.resourceType === 'ActivityDefinition') {
                        additionalActivityDefinitions.push(r);
                    }
                });
                console.log('srResourceMap', JSON.stringify(srResourceMap));
                return [2 /*return*/, {
                        additionalDiagnosticReports: additionalDiagnosticReports,
                        additionalObservations: additionalObservations,
                        additionalProvenances: additionalProvenances,
                        additionalTasks: additionalTasks,
                        additionalSpecimens: additionalSpecimens,
                        additionalActivityDefinitions: additionalActivityDefinitions,
                        srResourceMap: srResourceMap,
                    }];
        }
    });
}); };
exports.fetchResultResourcesForRelatedServiceRequest = fetchResultResourcesForRelatedServiceRequest;
var makeSrResourceMap = function (serviceRequests) {
    var config = serviceRequests.reduce(function (acc, sr) {
        var _a;
        var relatedAdUrlCanonicalUrl = (_a = sr.instantiatesCanonical) === null || _a === void 0 ? void 0 : _a[0];
        if (sr.id) {
            acc[sr.id] = {
                diagnosticReports: [],
                observations: [],
                provenances: [],
                tasks: [],
                specimens: [],
                relatedAdUrlCanonicalUrl: relatedAdUrlCanonicalUrl,
            };
        }
        return acc;
    }, {});
    return config;
};
var getSrIdFromResource = function (resource) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    switch (resource.resourceType) {
        case 'DiagnosticReport':
        case 'Observation':
        case 'Task':
            return (_c = (_b = (_a = resource.basedOn) === null || _a === void 0 ? void 0 : _a.find(function (based) { var _a; return (_a = based.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('ServiceRequest/', '');
        case 'Provenance':
            return (_f = (_e = (_d = resource.target) === null || _d === void 0 ? void 0 : _d.find(function (tar) { var _a; return (_a = tar.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.replace('ServiceRequest/', '');
        case 'Specimen':
            return (_j = (_h = (_g = resource.request) === null || _g === void 0 ? void 0 : _g.find(function (tar) { var _a; return (_a = tar.reference) === null || _a === void 0 ? void 0 : _a.startsWith('ServiceRequest/'); })) === null || _h === void 0 ? void 0 : _h.reference) === null || _j === void 0 ? void 0 : _j.replace('ServiceRequest/', '');
        default:
            return undefined;
    }
};
var addToSrResourceMap = function (resource, addTo, srResourceMap) {
    var _a, _b;
    var srId = getSrIdFromResource(resource);
    if (!srId || !srResourceMap[srId])
        return srResourceMap;
    return __assign(__assign({}, srResourceMap), (_a = {}, _a[srId] = __assign(__assign({}, srResourceMap[srId]), (_b = {}, _b[addTo] = __spreadArray(__spreadArray([], srResourceMap[srId][addTo], true), [resource], false), _b)), _a));
};
var fetchActiveInHouseLabActivityDefinitions = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, oystehr.fhir
                .search({
                resourceType: 'ActivityDefinition',
                params: [
                    { name: '_tag', value: utils_1.IN_HOUSE_TAG_DEFINITION.code },
                    { name: 'status', value: 'active' },
                ],
            })
                .then(function (response) { return response.unbundle(); })];
    });
}); };
exports.fetchActiveInHouseLabActivityDefinitions = fetchActiveInHouseLabActivityDefinitions;
var getUrlAndVersionForADFromServiceRequest = function (serviceRequest) {
    var _a, _b;
    var adUrl = (_a = serviceRequest.instantiatesCanonical) === null || _a === void 0 ? void 0 : _a[0].split('|')[0];
    var version = (_b = serviceRequest.instantiatesCanonical) === null || _b === void 0 ? void 0 : _b[0].split('|')[1];
    if (!adUrl || !version)
        throw new Error("error parsing instantiatesCanonical url for SR ".concat(serviceRequest.id, ", either the url or the version could not be parsed: ").concat(adUrl, " ").concat(version));
    console.log('AD url and version parsed:', adUrl, version);
    return { url: adUrl, version: version };
};
exports.getUrlAndVersionForADFromServiceRequest = getUrlAndVersionForADFromServiceRequest;

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
exports.getNursingOrderResources = exports.mapResourcesNursingOrderDTOs = void 0;
var utils_1 = require("utils");
var labs_1 = require("../shared/labs");
var mapResourcesNursingOrderDTOs = function (serviceRequests, tasks, practitioners, provenances, encounters, searchBy) {
    var filteredServiceRequests = (searchBy === null || searchBy === void 0 ? void 0 : searchBy.field) === 'serviceRequestId'
        ? serviceRequests.filter(function (serviceRequest) { return serviceRequest.id === searchBy.value; })
        : serviceRequests;
    return filteredServiceRequests.map(function (serviceRequest) {
        return parseOrderData({
            searchBy: searchBy,
            serviceRequest: serviceRequest,
            tasks: tasks,
            practitioners: practitioners,
            provenances: provenances,
            encounters: encounters,
        });
    });
};
exports.mapResourcesNursingOrderDTOs = mapResourcesNursingOrderDTOs;
var parseOrderData = function (_a) {
    var _b, _c, _d;
    var searchBy = _a.searchBy, serviceRequest = _a.serviceRequest, tasks = _a.tasks, provenances = _a.provenances, practitioners = _a.practitioners, encounters = _a.encounters;
    if (!serviceRequest.id) {
        throw new Error('ServiceRequest ID is required');
    }
    var relatedTask = tasks.find(function (t) { var _a, _b; return ((_b = (_a = t.basedOn) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === "ServiceRequest/".concat(serviceRequest.id); });
    var status = getStatusFromTask(relatedTask);
    var note = (_c = (_b = serviceRequest === null || serviceRequest === void 0 ? void 0 : serviceRequest.note) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.text;
    var createOrderProvenance = provenances.find(function (provenance) {
        var _a, _b;
        return (_b = (_a = provenance.activity) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) {
            return coding.code === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code &&
                coding.display === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.display &&
                coding.system === utils_1.PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.system;
        });
    });
    if (!createOrderProvenance) {
        throw new Error('Provenance with create order activity not found');
    }
    var orderingPhysician = parsePractitionerNameFromProvenance(createOrderProvenance, practitioners);
    var appointmentId = (0, labs_1.parseAppointmentIdForServiceRequest)(serviceRequest, encounters) || '';
    var listDTO = {
        serviceRequestId: serviceRequest.id,
        appointmentId: appointmentId,
        note: note !== null && note !== void 0 ? note : '',
        status: status,
        orderAddedDate: (_d = serviceRequest.authoredOn) !== null && _d !== void 0 ? _d : '',
        orderingPhysician: orderingPhysician,
    };
    if ((searchBy === null || searchBy === void 0 ? void 0 : searchBy.field) === 'serviceRequestId') {
        var detailedDTO = __assign(__assign({}, listDTO), { history: parseNursingOrdersHistory(searchBy.value, practitioners, provenances) });
        return detailedDTO;
    }
    return listDTO;
};
var getNursingOrderResources = function (oystehr, params) { return __awaiter(void 0, void 0, void 0, function () {
    var nursingServiceRequestSearchParams, nursingOrdersResponse, nursingOrdersResources, _a, serviceRequests, tasks, provenances, practitioners, encounters;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                nursingServiceRequestSearchParams = createNursingServiceRequestSearchParams(params);
                console.log('nursingServiceRequestSearchParams', nursingServiceRequestSearchParams);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'ServiceRequest',
                        params: nursingServiceRequestSearchParams,
                    })];
            case 1:
                nursingOrdersResponse = _c.sent();
                nursingOrdersResources = ((_b = nursingOrdersResponse.entry) === null || _b === void 0 ? void 0 : _b.map(function (entry) { return entry.resource; }).filter(function (res) { return Boolean(res); })) || [];
                _a = extractNursingOrdersResources(nursingOrdersResources), serviceRequests = _a.serviceRequests, tasks = _a.tasks, provenances = _a.provenances, practitioners = _a.practitioners, encounters = _a.encounters;
                return [2 /*return*/, {
                        serviceRequests: serviceRequests,
                        tasks: tasks,
                        practitioners: practitioners,
                        provenances: provenances,
                        encounters: encounters,
                    }];
        }
    });
}); };
exports.getNursingOrderResources = getNursingOrderResources;
var createNursingServiceRequestSearchParams = function (params) {
    var searchBy = params.searchBy;
    var searchParams = [
        {
            name: '_tag',
            value: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/order-type-tag|nursing order"), // todo make these consts
        },
        {
            name: '_include',
            value: 'ServiceRequest:requester',
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
            value: 'Provenance:agent',
        },
        {
            name: '_include',
            value: 'ServiceRequest:encounter',
        },
    ];
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
    if (searchBy.field === 'serviceRequestId') {
        searchParams.push({
            name: '_id',
            value: searchBy.value,
        });
    }
    return searchParams;
};
var extractNursingOrdersResources = function (resources) {
    console.log('extracting nursing orders resources');
    console.log("".concat(resources.length, " resources total"));
    var serviceRequests = [];
    var tasks = [];
    var provenances = [];
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
        else if (resource.resourceType === 'Provenance') {
            provenances.push(resource);
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
        provenances: provenances,
        practitioners: practitioners,
        encounters: encounters,
    };
};
var parsePractitionerNameFromProvenance = function (provenance, practitioners) {
    var practitionerIdFromServiceRequest = parsePractitionerIdFromProvenance(provenance);
    return parsePractitionerName(practitionerIdFromServiceRequest, practitioners);
};
var parsePractitionerName = function (practitionerId, practitioners) {
    var _a;
    var NOT_FOUND = '-';
    if (!practitionerId) {
        return NOT_FOUND;
    }
    var practitioner = practitioners.find(function (p) { return p.id === practitionerId; });
    if (!practitioner) {
        return NOT_FOUND;
    }
    var name = (_a = practitioner.name) === null || _a === void 0 ? void 0 : _a[0];
    if (!name) {
        return NOT_FOUND;
    }
    return [name.prefix, name.given, name.family].flat().filter(Boolean).join(' ') || NOT_FOUND;
};
var parsePractitionerIdFromProvenance = function (provenance) {
    var _a, _b;
    var NOT_FOUND = '';
    return ((_b = (_a = provenance.agent) === null || _a === void 0 ? void 0 : _a[0].who.reference) === null || _b === void 0 ? void 0 : _b.split('/').pop()) || NOT_FOUND;
};
var getStatusFromTask = function (task) {
    if (!task)
        return utils_1.NursingOrdersStatus.unknown;
    if (task.status === 'requested')
        return utils_1.NursingOrdersStatus.pending;
    if (task.status === 'completed')
        return utils_1.NursingOrdersStatus.completed;
    if (task.status === 'cancelled')
        return utils_1.NursingOrdersStatus.cancelled;
    return utils_1.NursingOrdersStatus.unknown;
};
var parseNursingOrdersHistory = function (serviceRequestId, practitioners, provenances) {
    var orderProvenances = provenances.filter(function (provenance) {
        return provenance.target.some(function (item) { return item.reference === "ServiceRequest/".concat(serviceRequestId); });
    });
    console.log('provenances', JSON.stringify(orderProvenances, null, 2));
    var historyRows = orderProvenances.map(function (provenance) {
        var _a, _b;
        return ({
            status: mapProvenanceActivityToOrderStatus(((_b = (_a = provenance.activity) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) || ''),
            performer: parsePractitionerNameFromProvenance(provenance, practitioners),
            date: provenance.recorded || '',
        });
    });
    return historyRows.sort(function (a, b) { return (0, utils_1.compareDates)(b.date, a.date); });
};
var mapProvenanceActivityToOrderStatus = function (activity) {
    switch (activity) {
        case 'CREATE ORDER':
            return utils_1.NursingOrdersStatus.pending;
        case 'COMPLETE ORDER':
            return utils_1.NursingOrdersStatus.completed;
        case 'CANCEL ORDER':
            return utils_1.NursingOrdersStatus.cancelled;
        default:
            return utils_1.NursingOrdersStatus.unknown;
    }
};

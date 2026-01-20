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
exports.validateBundleAndExtractSavedChartData = void 0;
exports.getEncounterAndRelatedResources = getEncounterAndRelatedResources;
exports.filterServiceRequestsFromFhir = filterServiceRequestsFromFhir;
var shared_1 = require("../../shared");
var chart_data_1 = require("../../shared/chart-data");
var validateBundleAndExtractSavedChartData = function (bundle, patientId, encounterId, additionResourcesForResponse) {
    var chartDataResponse = {
        patientId: patientId,
        surgicalHistory: [],
        medications: [],
        conditions: [],
        allergies: [],
        examObservations: [],
        cptCodes: [],
        instructions: [],
        diagnosis: [],
        episodeOfCare: [],
        schoolWorkNotes: [],
        observations: [],
        prescribedMedications: [],
        notes: [],
        vitalsObservations: [],
        birthHistory: [],
    };
    var resources = (0, shared_1.parseCreatedResourcesBundle)(bundle);
    resources = resources.concat(additionResourcesForResponse);
    var chartDataResources = [];
    resources.forEach(function (resource) {
        var updatedChartData = (0, chart_data_1.mapResourceToChartDataResponse)(chartDataResponse, resource, encounterId);
        chartDataResponse = updatedChartData.chartDataResponse;
        if (updatedChartData.resourceMapped)
            chartDataResources.push(resource);
    });
    chartDataResponse = (0, chart_data_1.handleCustomDTOExtractions)(chartDataResponse, resources);
    return {
        chartData: chartDataResponse,
        chartResources: chartDataResources,
    };
};
exports.validateBundleAndExtractSavedChartData = validateBundleAndExtractSavedChartData;
function getEncounterAndRelatedResources(oystehr, encounterId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!encounterId) {
                        throw new Error('Encounter ID is required');
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Encounter',
                            params: [
                                {
                                    name: '_id',
                                    value: encounterId,
                                },
                                {
                                    name: '_include',
                                    value: 'Encounter:subject',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'ServiceRequest:encounter',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'DocumentReference:encounter',
                                },
                                {
                                    name: '_include',
                                    value: 'Encounter:appointment',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'List:patient',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Condition:encounter',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Observation:encounter',
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'ClinicalImpression:encounter',
                                },
                            ],
                        })];
                case 1: return [2 /*return*/, (_a.sent()).unbundle()];
            }
        });
    });
}
function filterServiceRequestsFromFhir(allResources, metaTag, performer) {
    return allResources.filter(function (resource) {
        if (!(resource.resourceType === 'ServiceRequest'))
            return false;
        var serviceRequest = resource;
        var resultBoolean = true;
        if (metaTag)
            resultBoolean = resultBoolean && Boolean((0, chart_data_1.chartDataResourceHasMetaTagByCode)(resource, metaTag));
        if (performer)
            resultBoolean = resultBoolean && findCodingInCode(serviceRequest.performerType, performer);
        return resultBoolean;
    });
}
function findCodingInCode(code, coding) {
    var _a;
    return Boolean((_a = code === null || code === void 0 ? void 0 : code.coding) === null || _a === void 0 ? void 0 : _a.find(function (element) {
        return element.code === coding.code && element.system === coding.system;
    }));
}

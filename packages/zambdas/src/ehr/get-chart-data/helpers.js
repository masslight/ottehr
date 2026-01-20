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
exports.defaultChartDataFieldsSearchParams = exports.configProceduresRequestsForGetChartData = void 0;
exports.createFindResourceRequest = createFindResourceRequest;
exports.createFindResourceRequestByPatientField = createFindResourceRequestByPatientField;
exports.createFindResourceRequestByEncounterField = createFindResourceRequestByEncounterField;
exports.createFindResourceRequestById = createFindResourceRequestById;
exports.convertSearchResultsToResponse = convertSearchResultsToResponse;
var utils_1 = require("utils");
var chart_data_1 = require("../../shared/chart-data");
var labs_1 = require("../shared/labs");
function createFindResourceRequest(patient, encounter, resourceType, searchParams, defaultSearchBy) {
    var _a;
    var searchBy = (_a = searchParams === null || searchParams === void 0 ? void 0 : searchParams._search_by) !== null && _a !== void 0 ? _a : defaultSearchBy;
    if (searchBy === 'encounter' && resourceType !== 'EpisodeOfCare') {
        if (!encounter) {
            throw new Error('Encounter is required for encounter-based search');
        }
        if (resourceType === 'MedicationStatement') {
            return createFindResourceRequestByEncounterField(encounter.id, resourceType, 'context', searchParams);
        }
        else {
            return createFindResourceRequestByEncounterField(encounter.id, resourceType, 'encounter', searchParams);
        }
    }
    else {
        if (!patient) {
            throw new Error('Patient is required for patient-based search');
        }
        if (resourceType === 'AllergyIntolerance' || resourceType === 'EpisodeOfCare') {
            return createFindResourceRequestByPatientField(patient.id, resourceType, 'patient', searchParams);
        }
        else {
            return createFindResourceRequestByPatientField(patient.id, resourceType, 'subject', searchParams);
        }
    }
}
function createFindResourceRequestByPatientField(patientId, resourceType, field, searchParams) {
    var url = "/".concat(resourceType, "?").concat(field, "=Patient/").concat(patientId);
    url = (0, utils_1.addSearchParams)(url, searchParams);
    return {
        method: 'GET',
        url: url,
    };
}
function createFindResourceRequestByEncounterField(encounterId, resourceType, field, searchParams) {
    var url = "/".concat(resourceType, "?").concat(field, "=Encounter/").concat(encounterId);
    url = (0, utils_1.addSearchParams)(url, searchParams);
    return {
        method: 'GET',
        url: url,
    };
}
function createFindResourceRequestById(resourceId, resourceType, searchParams) {
    var url = "/".concat(resourceType, "?_id=").concat(resourceId);
    url = (0, utils_1.addSearchParams)(url, searchParams);
    return {
        method: 'GET',
        url: url,
    };
}
function parseBundleResources(bundle) {
    var _a, _b;
    if (bundle.resourceType !== 'Bundle' || bundle.entry === undefined) {
        console.error('Search response appears malformed: ', JSON.stringify(bundle));
        throw new Error('Could not parse search response for chart data');
    }
    var resultResources = [];
    for (var _i = 0, _c = bundle.entry; _i < _c.length; _i++) {
        var entry = _c[_i];
        if (((_b = (_a = entry.response) === null || _a === void 0 ? void 0 : _a.outcome) === null || _b === void 0 ? void 0 : _b.id) === 'ok' &&
            entry.resource &&
            entry.resource.resourceType === 'Bundle' &&
            entry.resource.type === 'searchset') {
            var innerBundle = entry.resource;
            var innerEntries = innerBundle.entry;
            if (innerEntries) {
                for (var _d = 0, innerEntries_1 = innerEntries; _d < innerEntries_1.length; _d++) {
                    var item = innerEntries_1[_d];
                    var resource = item.resource;
                    if (resource)
                        resultResources.push(resource);
                }
            }
        }
    }
    return resultResources;
}
function convertSearchResultsToResponse(bundle, m2mToken, patientId, encounterId, fields, patientResource) {
    return __awaiter(this, void 0, void 0, function () {
        var getChartDataResponse, resources, chartDataResources, _a, externalLabResultConfig, inHouseLabResultConfig, qr_1, pharmacies, getAnswer, qrName_1, qrAddress_1, qrPhone_1, encounter, ext;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    getChartDataResponse = __assign({ patientId: patientId }, (fields
                        ? __assign(__assign({}, Object.fromEntries(fields.map(function (field) { return [field, []]; }))), { practitioners: [] }) : {
                        conditions: [],
                        medications: [],
                        allergies: [],
                        surgicalHistory: [],
                        examObservations: [],
                        cptCodes: [],
                        instructions: [],
                        diagnosis: [],
                        schoolWorkNotes: [],
                        observations: [],
                        practitioners: [],
                        aiPotentialDiagnosis: [],
                        aiChat: {
                            documents: [],
                            providers: [],
                        },
                    }));
                    resources = parseBundleResources(bundle);
                    chartDataResources = [];
                    resources.forEach(function (resource) {
                        var _a;
                        // handle additional get-chart-data related fields
                        if (resource.resourceType === 'Practitioner') {
                            (_a = getChartDataResponse.practitioners) === null || _a === void 0 ? void 0 : _a.push(resource);
                        }
                        // handle common get/save endpoint resources
                        var updatedChartData = (0, chart_data_1.mapResourceToChartDataResponse)(getChartDataResponse, resource, encounterId);
                        getChartDataResponse = updatedChartData.chartDataResponse;
                        if (updatedChartData.resourceMapped)
                            chartDataResources.push(resource);
                    });
                    getChartDataResponse = (0, chart_data_1.handleCustomDTOExtractions)(getChartDataResponse, resources);
                    if (!(getChartDataResponse.externalLabResults || getChartDataResponse.inHouseLabResults)) return [3 /*break*/, 2];
                    console.log('constructing lab result configs');
                    return [4 /*yield*/, (0, labs_1.makeEncounterLabResults)(resources, m2mToken)];
                case 1:
                    _a = _e.sent(), externalLabResultConfig = _a.externalLabResultConfig, inHouseLabResultConfig = _a.inHouseLabResultConfig;
                    if (getChartDataResponse.externalLabResults)
                        getChartDataResponse.externalLabResults = externalLabResultConfig;
                    if (getChartDataResponse.inHouseLabResults)
                        getChartDataResponse.inHouseLabResults = inHouseLabResultConfig;
                    _e.label = 2;
                case 2:
                    if (fields === null || fields === void 0 ? void 0 : fields.includes('preferredPharmacies')) {
                        qr_1 = resources.find(function (r) { return r.resourceType === 'QuestionnaireResponse'; });
                        pharmacies = ((_b = patientResource === null || patientResource === void 0 ? void 0 : patientResource.contained) !== null && _b !== void 0 ? _b : [])
                            .filter(function (r) { return r.resourceType === 'Organization'; })
                            .map(function (org) {
                            var _a, _b, _c, _d;
                            return ({
                                name: org.name || '',
                                address: ((_b = (_a = org.address) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) || '',
                                phone: (_d = (_c = org.telecom) === null || _c === void 0 ? void 0 : _c.find(function (t) { return t.system === 'phone'; })) === null || _d === void 0 ? void 0 : _d.value,
                            });
                        });
                        if (qr_1) {
                            getAnswer = function (linkId) { var _a, _b, _c, _d; return (_d = (_c = (_b = (_a = qr_1.item) === null || _a === void 0 ? void 0 : _a.find(function (i) { return i.linkId === linkId; })) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString; };
                            qrName_1 = getAnswer('pharmacy-name');
                            qrAddress_1 = getAnswer('pharmacy-address');
                            qrPhone_1 = getAnswer('pharmacy-phone');
                            pharmacies.forEach(function (ph) {
                                var _a, _b;
                                if ((qrName_1 && ((_a = ph.name) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === qrName_1.toLowerCase()) ||
                                    (qrAddress_1 && ((_b = ph.address) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(qrAddress_1.toLowerCase()))) ||
                                    (qrPhone_1 && ph.phone === qrPhone_1)) {
                                    ph.primary = true;
                                }
                            });
                        }
                        getChartDataResponse.preferredPharmacies = pharmacies;
                    }
                    encounter = resources.find(function (r) { return r.resourceType === 'Encounter'; });
                    if (encounter && (fields === null || fields === void 0 ? void 0 : fields.includes('reasonForVisit'))) {
                        ext = (_c = encounter.extension) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.url === "reason-for-visit"; });
                        getChartDataResponse.reasonForVisit = {
                            text: (_d = ext === null || ext === void 0 ? void 0 : ext.valueString) !== null && _d !== void 0 ? _d : '',
                        };
                    }
                    return [2 /*return*/, {
                            chartData: getChartDataResponse,
                            chartResources: chartDataResources,
                        }];
            }
        });
    });
}
var configProceduresRequestsForGetChartData = function (encounterId) {
    return {
        method: 'GET',
        url: "/ServiceRequest?encounter=Encounter/".concat(encounterId, "&status=completed"),
    };
};
exports.configProceduresRequestsForGetChartData = configProceduresRequestsForGetChartData;
exports.defaultChartDataFieldsSearchParams = {
    medications: { _tag: 'current-medication' },
    inhouseMedications: { _tag: 'in-house-medication' },
    schoolWorkNotes: { _tag: utils_1.SCHOOL_WORK_NOTE },
    aiPotentialDiagnosis: { _tag: 'ai-potential-diagnosis' },
};

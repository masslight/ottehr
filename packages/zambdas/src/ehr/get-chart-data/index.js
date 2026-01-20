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
exports.index = void 0;
exports.getChartData = getChartData;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var labs_1 = require("../shared/labs");
var helpers_2 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'get-chart-data';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterId, secrets, requestedFields, oystehr, output, error_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), encounterId = _a.encounterId, secrets = _a.secrets, requestedFields = _a.requestedFields;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, getChartData(oystehr, m2mToken, encounterId, requestedFields)];
            case 2:
                output = (_b.sent()).response;
                return [2 /*return*/, {
                        body: JSON.stringify(output),
                        statusCode: 200,
                    }];
            case 3:
                error_1 = _b.sent();
                console.log(error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
function getChartData(oystehr, m2mToken, encounterId, requestedFields) {
    return __awaiter(this, void 0, void 0, function () {
        function addRequestIfNeeded(_a) {
            var field = _a.field, resourceType = _a.resourceType, defaultSearchBy = _a.defaultSearchBy;
            var fieldOptions = requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields[field];
            var defaultSearchParams = helpers_2.defaultChartDataFieldsSearchParams[field];
            if (!requestedFields || fieldOptions) {
                chartDataRequests.push((0, helpers_2.createFindResourceRequest)(patient, encounter, resourceType, __assign(__assign({}, defaultSearchParams), fieldOptions), defaultSearchBy));
            }
        }
        var patientEncounter, encounter, patient, chartDataRequests, labRequests, pharmacies, result, error_2, chartDataResult, practitionerIDs, practitioners;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    console.time('check');
                    console.timeLog('check', 'before fetching patient encounter');
                    // 0. get encounter
                    console.log("Getting encounter ".concat(encounterId));
                    return [4 /*yield*/, (0, shared_1.getPatientEncounter)(encounterId, oystehr)];
                case 1:
                    patientEncounter = _d.sent();
                    encounter = patientEncounter.encounter;
                    if (encounter === undefined)
                        throw new Error("Encounter with ID ".concat(encounterId, " must exist... "));
                    console.log("Got encounter with id ".concat(encounter.id));
                    console.timeLog('check', 'after fetching patient encounter');
                    patient = patientEncounter.patient;
                    if (patient === undefined)
                        throw new Error("Encounter  ".concat(encounter.id, " must be associated with a patient... "));
                    console.log("Got patient with id ".concat(patient.id));
                    chartDataRequests = [];
                    chartDataRequests.push((0, helpers_2.createFindResourceRequestById)(encounter.id, 'Encounter'));
                    // allergies are always by-patient and does not have history, so no need to search by encounter
                    addRequestIfNeeded({ field: 'allergies', resourceType: 'AllergyIntolerance', defaultSearchBy: 'patient' });
                    // search by patient by default
                    addRequestIfNeeded({ field: 'conditions', resourceType: 'Condition', defaultSearchBy: 'patient' });
                    // search by patient by default
                    addRequestIfNeeded({ field: 'medications', resourceType: 'MedicationStatement', defaultSearchBy: 'patient' });
                    // search by patient by default
                    addRequestIfNeeded({
                        field: 'inhouseMedications',
                        resourceType: 'MedicationStatement',
                        defaultSearchBy: 'patient',
                    });
                    // search by patient by default
                    addRequestIfNeeded({ field: 'surgicalHistory', resourceType: 'Procedure', defaultSearchBy: 'patient' });
                    // TODO: I commented out this code during the chart-data store refactoring,
                    // because cptCodes were being requested with just an empty object,
                    // without specifying _searchBy and with default search by encounter,
                    // and this variant seems to match what is returned in cptCodes by default without requiredParameters.
                    // If this code is no longer needed, it can be removed.
                    // ---------------------------------------------------------
                    // edge case for Procedures just for getting cpt codes..
                    // todo: delete this and just use procedures with special tag in frontend (todo: need to pass tag here through search params most likely)
                    // if (requestedFields?.cptCodes) {
                    /**
                     * TODO: Research if we can modify addRequestIfNeeded to include the requested field
                     *  in the default query when fields are not defined, instead of adding this condition.
                     *
                     * Without requestedFields addRequestIfNeeded generates URL like /Procedure?encounter=Encounter/:id,
                     * while the code above addRequestIfNeeded({
                     *   field: 'procedures',
                     *   resourceType: 'Procedure',
                     *   defaultSearchBy: 'patient'
                     * }) without requestedFields produces URL like /Procedure?subject=Patient/:id.
                     * Current solution: To avoid duplicates, run this request only with requestedFields.
                     */
                    // Comment: theoretically can be solved by using defaultSearchParams added to addRequestIfNeeded logic
                    //   addRequestIfNeeded({ field: 'cptCodes', resourceType: 'Procedure', defaultSearchBy: 'encounter' });
                    // }
                    // search by encounter by default
                    addRequestIfNeeded({ field: 'observations', resourceType: 'Observation', defaultSearchBy: 'encounter' });
                    // instructions are just per-encounter, so no need to search by patient
                    addRequestIfNeeded({ field: 'instructions', resourceType: 'Communication', defaultSearchBy: 'encounter' });
                    // for now school work notes are just per-encounter, so no need to search by patient
                    addRequestIfNeeded({ field: 'schoolWorkNotes', resourceType: 'DocumentReference', defaultSearchBy: 'encounter' });
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.disposition) {
                        // disposition is just per-encounter, so no need to search by patient
                        addRequestIfNeeded({ field: 'disposition', resourceType: 'ServiceRequest', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.prescribedMedications) {
                        // for now prescribed meds are just per-encounter, so no need to search by patient
                        addRequestIfNeeded({
                            field: 'prescribedMedications',
                            resourceType: 'MedicationRequest',
                            defaultSearchBy: 'encounter',
                        });
                    }
                    // notes included only by straight request
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.notes) {
                        addRequestIfNeeded({ field: 'notes', resourceType: 'Communication', defaultSearchBy: 'patient' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.chiefComplaint) {
                        addRequestIfNeeded({ field: 'chiefComplaint', resourceType: 'Condition', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.historyOfPresentIllness) {
                        addRequestIfNeeded({ field: 'historyOfPresentIllness', resourceType: 'Condition', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.mechanismOfInjury) {
                        addRequestIfNeeded({ field: 'mechanismOfInjury', resourceType: 'Condition', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.ros) {
                        addRequestIfNeeded({ field: 'ros', resourceType: 'Condition', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.surgicalHistoryNote) {
                        addRequestIfNeeded({ field: 'surgicalHistoryNote', resourceType: 'Procedure', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.medicalDecision) {
                        addRequestIfNeeded({ field: 'medicalDecision', resourceType: 'ClinicalImpression', defaultSearchBy: 'encounter' });
                    }
                    // vitalsObservations included only by straight request
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.vitalsObservations) {
                        // search by encounter by default
                        addRequestIfNeeded({ field: 'vitalsObservations', resourceType: 'Observation', defaultSearchBy: 'encounter' });
                    }
                    // birthHistory included only by straight request
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.birthHistory) {
                        chartDataRequests.push((0, helpers_2.createFindResourceRequestByPatientField)(patient.id, 'Observation', 'subject', requestedFields.birthHistory));
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.episodeOfCare) {
                        chartDataRequests.push((0, helpers_2.createFindResourceRequestByPatientField)(patient.id, 'EpisodeOfCare', 'patient', requestedFields.episodeOfCare));
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.aiPotentialDiagnosis) {
                        addRequestIfNeeded({ field: 'aiPotentialDiagnosis', resourceType: 'Condition', defaultSearchBy: 'encounter' });
                    }
                    if (requestedFields == null) {
                        // AI chat
                        chartDataRequests.push((0, helpers_2.createFindResourceRequest)(patient, encounter, 'DocumentReference', 
                        // {
                        //   type: {
                        //     type: 'string',
                        //     value: '#aiInterviewQuestionnaire',
                        //   },
                        // },
                        {}, 'encounter'));
                    }
                    // Practitioners
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.practitioners) {
                        (_a = encounter === null || encounter === void 0 ? void 0 : encounter.participant) === null || _a === void 0 ? void 0 : _a.forEach(function (participant) {
                            var _a, _b, _c;
                            var _d = (_c = (_b = (_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')) !== null && _c !== void 0 ? _c : [], participantType = _d[0], participantId = _d[1];
                            if (participantType === 'Practitioner' && participantId != null) {
                                chartDataRequests.push((0, helpers_2.createFindResourceRequestById)(participantId, 'Practitioner'));
                            }
                        });
                    }
                    if (((requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.externalLabResults) || (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.inHouseLabResults)) && encounter.id) {
                        labRequests = (0, labs_1.configLabRequestsForGetChartData)(encounter.id);
                        chartDataRequests.push.apply(chartDataRequests, labRequests);
                    }
                    // old code (but we don't have 'procedures' in requestedFields fields currently):
                    // if ((!requestedFields || requestedFields.procedures) && encounter.id) {
                    if (!requestedFields && encounter.id) {
                        chartDataRequests.push((0, helpers_2.configProceduresRequestsForGetChartData)(encounter.id));
                    }
                    if (requestedFields === null || requestedFields === void 0 ? void 0 : requestedFields.preferredPharmacies) {
                        pharmacies = (_c = (_b = patient.contained) === null || _b === void 0 ? void 0 : _b.filter(function (r) { return r.resourceType === 'Organization'; })) !== null && _c !== void 0 ? _c : [];
                        if (pharmacies.length > 0 && encounter.id) {
                            chartDataRequests.push((0, helpers_2.createFindResourceRequest)(patient, encounter, 'QuestionnaireResponse', { _search_by: 'encounter' }));
                        }
                    }
                    console.timeLog('check', 'before resources fetch');
                    console.log('Starting a transaction to retrieve chart data...');
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, oystehr.fhir.batch({
                            requests: chartDataRequests,
                        })];
                case 3:
                    result = _d.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _d.sent();
                    console.log('Error fetching chart data...', error_2, JSON.stringify(error_2));
                    throw new Error("Unable to retrieve chart data for patient with ID ".concat(patient.id));
                case 5:
                    console.log('Retrieved chart data...');
                    // console.debug('result JSON\n\n==============\n\n', JSON.stringify(result));
                    console.timeLog('check', 'after fetch, before converting chart data to response');
                    return [4 /*yield*/, (0, helpers_2.convertSearchResultsToResponse)(result, m2mToken, patient.id, encounterId, requestedFields ? Object.keys(requestedFields) : undefined, patient)];
                case 6:
                    chartDataResult = _d.sent();
                    console.timeLog('check', 'after converting to response');
                    if (!chartDataResult.chartData.aiChat) return [3 /*break*/, 8];
                    practitionerIDs = chartDataResult.chartData.aiChat.documents
                        .filter(function (document) { return document.resourceType === 'DocumentReference'; })
                        .map(function (document) {
                        var _a, _b, _c, _d;
                        return (_d = (_c = (_b = (_a = document.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === "".concat(utils_1.PUBLIC_EXTENSION_BASE_URL, "/provider"); })) === null || _b === void 0 ? void 0 : _b.valueReference) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')[1];
                    })
                        .filter(function (practitionerID) { return practitionerID != null; });
                    if (!(practitionerIDs.length > 0)) return [3 /*break*/, 8];
                    console.log('Getting Practitioners');
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Practitioner',
                            params: [
                                {
                                    name: '_id',
                                    value: practitionerIDs.join(','),
                                },
                            ],
                        })];
                case 7:
                    practitioners = (_d.sent()).unbundle();
                    chartDataResult.chartData.aiChat.providers = practitioners;
                    _d.label = 8;
                case 8:
                    console.timeEnd('check');
                    return [2 /*return*/, {
                            response: chartDataResult.chartData,
                            chartResources: chartDataResult.chartResources,
                        }];
            }
        });
    });
}

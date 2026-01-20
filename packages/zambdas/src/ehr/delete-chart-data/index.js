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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var chart_data_1 = require("../../shared/chart-data");
var helpers_1 = require("../../shared/helpers");
var z3Utils_1 = require("../../shared/z3Utils");
var helpers_2 = require("../get-chart-data/helpers");
var helpers_3 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('delete-chart-data', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterId, chiefComplaint, historyOfPresentIllness, mechanismOfInjury, ros, conditions, medications_1, allergies, surgicalHistoryNote, surgicalHistory, observations, episodeOfCare, secrets, examObservations, medicalDecision, cptCodes, emCode, instructions, disposition, diagnosis, schoolWorkNotes, addendumNote, notes, vitalsObservations, procedures, oystehr_1, allResources_1, encounter_1, patient_1, deleteOrUpdateRequests_1, updateEncounterOperations_1, specialRulesDeletions, _loop_1, _i, schoolWorkNotes_1, schoolWorkNote, error_1;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 8, , 9]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), encounterId = _a.encounterId, chiefComplaint = _a.chiefComplaint, historyOfPresentIllness = _a.historyOfPresentIllness, mechanismOfInjury = _a.mechanismOfInjury, ros = _a.ros, conditions = _a.conditions, medications_1 = _a.medications, allergies = _a.allergies, surgicalHistoryNote = _a.surgicalHistoryNote, surgicalHistory = _a.surgicalHistory, observations = _a.observations, episodeOfCare = _a.episodeOfCare, secrets = _a.secrets, examObservations = _a.examObservations, medicalDecision = _a.medicalDecision, cptCodes = _a.cptCodes, emCode = _a.emCode, instructions = _a.instructions, disposition = _a.disposition, diagnosis = _a.diagnosis, schoolWorkNotes = _a.schoolWorkNotes, addendumNote = _a.addendumNote, notes = _a.notes, vitalsObservations = _a.vitalsObservations, procedures = _a.procedures;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _d.sent();
                oystehr_1 = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                // 0. get encounter
                console.log("Getting encounter ".concat(encounterId));
                return [4 /*yield*/, (0, helpers_3.getEncounterAndRelatedResources)(oystehr_1, encounterId)];
            case 2:
                allResources_1 = _d.sent();
                encounter_1 = allResources_1.filter(function (resource) { return resource.resourceType === 'Encounter'; })[0];
                if (encounter_1 === undefined)
                    throw new Error("Encounter with ID ".concat(encounterId, " must exist... "));
                console.log("Got encounter with id ".concat(encounter_1.id));
                patient_1 = allResources_1.filter(function (resource) { return resource.resourceType === 'Patient'; })[0];
                if (patient_1 === undefined)
                    throw new Error("Encounter  ".concat(encounter_1.id, " must be associated with a patient... "));
                console.log("Got patient with id ".concat(patient_1.id));
                deleteOrUpdateRequests_1 = [];
                updateEncounterOperations_1 = [];
                // 2. delete  Medical Condition associated with chief complaint
                if (chiefComplaint) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Condition', chiefComplaint.resourceId));
                }
                if (historyOfPresentIllness) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Condition', historyOfPresentIllness.resourceId));
                }
                if (mechanismOfInjury) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Condition', mechanismOfInjury.resourceId));
                }
                if (ros) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Condition', ros.resourceId));
                }
                // 3. delete Medical Conditions
                conditions === null || conditions === void 0 ? void 0 : conditions.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Condition', element.resourceId));
                });
                // 5. delete Allergies
                allergies === null || allergies === void 0 ? void 0 : allergies.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('AllergyIntolerance', element.resourceId));
                });
                if (surgicalHistoryNote) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Procedure', surgicalHistoryNote.resourceId));
                }
                // 6. delete Procedures
                surgicalHistory === null || surgicalHistory === void 0 ? void 0 : surgicalHistory.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Procedure', element.resourceId));
                });
                // 7. delete Observations
                observations === null || observations === void 0 ? void 0 : observations.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Observation', element.resourceId));
                });
                // 8. delete ExamObservations
                examObservations === null || examObservations === void 0 ? void 0 : examObservations.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Observation', element.resourceId));
                });
                // 9. delete ClinicalImpression
                if (medicalDecision) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('ClinicalImpression', medicalDecision.resourceId));
                }
                // 10. delete cpt-codes Procedures
                cptCodes === null || cptCodes === void 0 ? void 0 : cptCodes.forEach(function (cptCode) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Procedure', cptCode.resourceId));
                });
                if (emCode) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Procedure', emCode.resourceId));
                }
                // 11. delete Communications
                instructions === null || instructions === void 0 ? void 0 : instructions.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Communication', element.resourceId));
                });
                // 12. delete disposition ServiceRequests and encounter properties
                if (disposition) {
                    updateEncounterOperations_1.push((0, chart_data_1.updateEncounterDischargeDisposition)(encounter_1, undefined));
                    // deletes all ServiceRequest attached to encounter
                    allResources_1.forEach(function (resource) {
                        if (resource.resourceType === 'ServiceRequest' &&
                            ((0, chart_data_1.chartDataResourceHasMetaTagByCode)(resource, 'disposition-follow-up') ||
                                (0, chart_data_1.chartDataResourceHasMetaTagByCode)(resource, 'sub-follow-up'))) {
                            deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('ServiceRequest', resource.id));
                        }
                    });
                }
                // 13. delete diagnosis Conditions and Encounter properties
                diagnosis === null || diagnosis === void 0 ? void 0 : diagnosis.forEach(function (element) {
                    updateEncounterOperations_1.push.apply(updateEncounterOperations_1, (0, chart_data_1.deleteEncounterDiagnosis)(encounter_1, element.resourceId));
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Condition', element.resourceId));
                });
                if (addendumNote) {
                    updateEncounterOperations_1.push.apply(updateEncounterOperations_1, (0, chart_data_1.deleteEncounterAddendumNote)(encounter_1));
                }
                // 14. delete school-work excuse note DocumentReference resource
                schoolWorkNotes === null || schoolWorkNotes === void 0 ? void 0 : schoolWorkNotes.forEach(function (element) {
                    var documentReference = allResources_1.find(function (resource) { return resource.id === element.id; });
                    if (documentReference) {
                        deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('DocumentReference', documentReference.id));
                    }
                });
                // 15. delete notes
                notes === null || notes === void 0 ? void 0 : notes.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Communication', element.resourceId));
                });
                // 16. delete vitalsObservations
                vitalsObservations === null || vitalsObservations === void 0 ? void 0 : vitalsObservations.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('Observation', element.resourceId));
                });
                // 18. mark procedures as entered-in-error (cancel)
                procedures === null || procedures === void 0 ? void 0 : procedures.forEach(function (procedure) {
                    // Find the ServiceRequest for this procedure
                    var procedureServiceRequest = allResources_1.find(function (resource) { return resource.resourceType === 'ServiceRequest' && resource.id === procedure.resourceId; });
                    if (procedureServiceRequest) {
                        var currentStatus = procedureServiceRequest.status;
                        console.log("Cancelling procedure ".concat(procedure.resourceId, ", saving previous status '").concat(currentStatus, "'"));
                        // Use helper to create cancellation tag operations and status update
                        var patchOperations = __spreadArray(__spreadArray([], (0, utils_1.createCancellationTagOperations)(currentStatus, procedureServiceRequest.meta), true), [
                            { op: 'replace', path: '/status', value: 'entered-in-error' },
                        ], false);
                        // Mark as entered-in-error instead of deleting
                        deleteOrUpdateRequests_1.push((0, utils_1.getPatchBinary)({
                            resourceId: procedure.resourceId,
                            resourceType: 'ServiceRequest',
                            patchOperations: patchOperations,
                        }));
                    }
                });
                // 17. regenerate diagnosis code recommendations if chief complaint or medical decision were deleted
                if (chiefComplaint || historyOfPresentIllness || medicalDecision) {
                    deleteOrUpdateRequests_1.push((0, shared_1.saveResourceRequest)((0, chart_data_1.makeEncounterTaskResource)(encounterId, { system: utils_1.OttehrTaskSystem, code: 'recommend-diagnosis-codes' })));
                }
                episodeOfCare === null || episodeOfCare === void 0 ? void 0 : episodeOfCare.forEach(function (element) {
                    deleteOrUpdateRequests_1.push((0, helpers_3.deleteResourceRequest)('EpisodeOfCare', element.resourceId));
                });
                if (updateEncounterOperations_1.length > 0) {
                    deleteOrUpdateRequests_1.push((0, utils_1.getPatchBinary)({
                        resourceId: encounterId,
                        resourceType: 'Encounter',
                        patchOperations: updateEncounterOperations_1,
                    }));
                }
                specialRulesDeletions = new Promise(function (resolve, reject) {
                    // if no resources for special deletion rules were provided - resolve immediately
                    if (!(medications_1 === null || medications_1 === void 0 ? void 0 : medications_1.length)) {
                        resolve(true);
                        return;
                    }
                    var getRequests = [];
                    var specialDeleteOrUpdateRequests = [];
                    var request = (0, helpers_2.createFindResourceRequestByPatientField)(patient_1.id, 'MedicationStatement', 'subject');
                    request.url += '&_id=';
                    // 4. delete Current Medications
                    medications_1 === null || medications_1 === void 0 ? void 0 : medications_1.forEach(function (element, i) {
                        request.url += "".concat(element.resourceId).concat(i === medications_1.length - 1 ? '' : ',');
                    });
                    getRequests.push(request);
                    oystehr_1.fhir
                        .transaction({
                        requests: getRequests,
                    })
                        .then(function (results) {
                        var resources = (0, shared_1.parseCreatedResourcesBundle)((0, shared_1.parseCreatedResourcesBundle)(results)[0]);
                        resources.forEach(function (res) {
                            var _a;
                            if (res.resourceType === 'MedicationStatement') {
                                // for medications from current encounter - remove entirely
                                if (((_a = res.context) === null || _a === void 0 ? void 0 : _a.reference) === "Encounter/".concat(encounter_1.id)) {
                                    specialDeleteOrUpdateRequests.push((0, helpers_3.deleteResourceRequest)('MedicationStatement', res.id));
                                }
                                else {
                                    // otherwise only remove from current medications - mark as not active
                                    specialDeleteOrUpdateRequests.push((0, utils_1.getPatchBinary)({
                                        resourceId: res.id,
                                        resourceType: 'MedicationStatement',
                                        patchOperations: [{ op: 'replace', path: '/status', value: 'completed' }],
                                    }));
                                }
                            }
                        });
                        oystehr_1.fhir.transaction({ requests: specialDeleteOrUpdateRequests }).then(resolve).catch(reject);
                    })
                        .catch(reject);
                });
                console.log('Starting a transaction update of chart data...');
                return [4 /*yield*/, Promise.all([
                        oystehr_1.fhir.transaction({
                            requests: deleteOrUpdateRequests_1,
                        }),
                        specialRulesDeletions,
                    ])];
            case 3:
                _d.sent();
                console.log('Updated chart data as a transaction');
                if (!schoolWorkNotes) return [3 /*break*/, 7];
                _loop_1 = function (schoolWorkNote) {
                    var documentReference, fileUrl;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                documentReference = allResources_1.find(function (resource) { return resource.id === schoolWorkNote.id; });
                                fileUrl = (_c = (_b = documentReference === null || documentReference === void 0 ? void 0 : documentReference.content) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.attachment.url;
                                if (!fileUrl) return [3 /*break*/, 2];
                                return [4 /*yield*/, (0, z3Utils_1.deleteZ3Object)(fileUrl, m2mToken)];
                            case 1:
                                _e.sent();
                                _e.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                };
                _i = 0, schoolWorkNotes_1 = schoolWorkNotes;
                _d.label = 4;
            case 4:
                if (!(_i < schoolWorkNotes_1.length)) return [3 /*break*/, 7];
                schoolWorkNote = schoolWorkNotes_1[_i];
                return [5 /*yield**/, _loop_1(schoolWorkNote)];
            case 5:
                _d.sent();
                _d.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 4];
            case 7: return [2 /*return*/, {
                    body: JSON.stringify({
                        patientId: patient_1.id,
                    }),
                    statusCode: 200,
                }];
            case 8:
                error_1 = _d.sent();
                console.log(error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('delete-chart-data', error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 9: return [2 /*return*/];
        }
    });
}); });

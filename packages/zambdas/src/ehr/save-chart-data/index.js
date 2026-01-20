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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var pdf_utils_1 = require("../../shared/pdf/pdf-utils");
var school_work_note_pdf_1 = require("../../shared/pdf/school-work-note-pdf");
var helpers_1 = require("../../subscriptions/appointment/appointment-chart-data-prefilling/helpers");
var helpers_2 = require("../delete-chart-data/helpers");
var helpers_3 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'save-chart-data';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, encounterId_1, chiefComplaint, historyOfPresentIllness, mechanismOfInjury, ros, conditions, medications, allergies, surgicalHistoryNote, surgicalHistory, episodeOfCare, observations, secrets, examObservations, medicalDecision, cptCodes, emCode, instructions, disposition_1, diagnosis, newSchoolWorkNote, schoolWorkNotes, patientInfoConfirmed, addendumNote, addToVisitNote, notes, vitalsObservations, birthHistory, userToken, procedures, reasonForVisit, oystehr, _b, allResources_1, currentPractitioner_1, encounter, patient_1, listResources, appointment, saveOrUpdateRequests_1, updateEncounterOperations, additionalResourcesForResponse, isInPerson_1, hpiText, mdmText, subFollowUpCode_1, subFollowUpMetaTag_1, existingSubFollowUps, _i, diagnosis_1, element, conditionResource, condition, _c, pdfInfo, _d, _e, documentReferences_1, transactionBundle, output, error_1;
    var _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                _h.trys.push([0, 14, , 15]);
                console.log("Input: ".concat(JSON.stringify(input)));
                console.log('Validating input');
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), encounterId_1 = _a.encounterId, chiefComplaint = _a.chiefComplaint, historyOfPresentIllness = _a.historyOfPresentIllness, mechanismOfInjury = _a.mechanismOfInjury, ros = _a.ros, conditions = _a.conditions, medications = _a.medications, allergies = _a.allergies, surgicalHistoryNote = _a.surgicalHistoryNote, surgicalHistory = _a.surgicalHistory, episodeOfCare = _a.episodeOfCare, observations = _a.observations, secrets = _a.secrets, examObservations = _a.examObservations, medicalDecision = _a.medicalDecision, cptCodes = _a.cptCodes, emCode = _a.emCode, instructions = _a.instructions, disposition_1 = _a.disposition, diagnosis = _a.diagnosis, newSchoolWorkNote = _a.newSchoolWorkNote, schoolWorkNotes = _a.schoolWorkNotes, patientInfoConfirmed = _a.patientInfoConfirmed, addendumNote = _a.addendumNote, addToVisitNote = _a.addToVisitNote, notes = _a.notes, vitalsObservations = _a.vitalsObservations, birthHistory = _a.birthHistory, userToken = _a.userToken, procedures = _a.procedures, reasonForVisit = _a.reasonForVisit;
                console.time('time');
                console.timeLog('time', 'before creating fhir client and token resources');
                console.log('Getting token');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _h.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.timeLog('time', 'before fetching resources');
                // get encounter and resources
                console.log("Getting encounter ".concat(encounterId_1));
                return [4 /*yield*/, Promise.all([
                        (0, helpers_3.getEncounterAndRelatedResources)(oystehr, encounterId_1),
                        getUserPractitioner(oystehr, userToken, secrets),
                    ])];
            case 2:
                _b = _h.sent(), allResources_1 = _b[0], currentPractitioner_1 = _b[1];
                encounter = allResources_1.filter(function (resource) { return resource.resourceType === 'Encounter'; })[0];
                if (encounter === undefined)
                    throw new Error("Encounter with ID ".concat(encounterId_1, " must exist... "));
                patient_1 = allResources_1.filter(function (resource) { return resource.resourceType === 'Patient'; })[0];
                listResources = allResources_1.filter(function (res) { return res.resourceType === 'List'; });
                appointment = allResources_1.find(function (res) { return res.resourceType === 'Appointment'; });
                console.log("Got encounter with id ".concat(encounter.id));
                // validate that patient from encounter exists
                if ((patient_1 === null || patient_1 === void 0 ? void 0 : patient_1.id) === undefined)
                    throw new Error("Encounter ".concat(encounter.id, " must be associated with a patient... "));
                console.log("Got patient with id ".concat(patient_1.id));
                console.timeLog('time', 'after fetching resources');
                saveOrUpdateRequests_1 = [];
                updateEncounterOperations = [];
                additionalResourcesForResponse = [];
                if (chiefComplaint) {
                    // convert chief complaint Medical Conditions to Conditions preserve FHIR resource ID, add to encounter
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeConditionResource)(encounterId_1, patient_1.id, chiefComplaint, 'chief-complaint')));
                }
                if (historyOfPresentIllness) {
                    // convert history of present illness Medical Conditions to Conditions preserve FHIR resource ID, add to encounter
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeConditionResource)(encounterId_1, patient_1.id, historyOfPresentIllness, 'history-of-present-illness')));
                }
                if (mechanismOfInjury) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeConditionResource)(encounterId_1, patient_1.id, mechanismOfInjury, 'mechanism-of-injury')));
                }
                if (ros) {
                    // convert ROS to Conditions preserve FHIR resource ID, add to encounter
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeConditionResource)(encounterId_1, patient_1.id, ros, 'ros')));
                }
                // convert Medical Conditions [] to Conditions [] and preserve FHIR resource IDs
                conditions === null || conditions === void 0 ? void 0 : conditions.forEach(function (condition) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeConditionResource)(encounterId_1, patient_1.id, condition, 'medical-condition')));
                });
                // convert Medications [] to MedicationStatement+Medication [] and preserve FHIR resource IDs
                medications === null || medications === void 0 ? void 0 : medications.forEach(function (medication) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeMedicationResource)(encounterId_1, patient_1.id, currentPractitioner_1.id, medication, 'current-medication')));
                });
                // convert Allergy [] to AllergyIntolerance [] and preserve FHIR resource IDs
                allergies === null || allergies === void 0 ? void 0 : allergies.forEach(function (allergy) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeAllergyResource)(encounterId_1, patient_1.id, allergy, 'known-allergy')));
                });
                episodeOfCare === null || episodeOfCare === void 0 ? void 0 : episodeOfCare.forEach(function (hosp) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeHospitalizationResource)(patient_1.id, hosp, 'hospitalization')));
                });
                surgicalHistory === null || surgicalHistory === void 0 ? void 0 : surgicalHistory.forEach(function (procedure) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeProcedureResource)(encounterId_1, patient_1.id, procedure, 'surgical-history')));
                });
                if (surgicalHistoryNote) {
                    // convert Procedure to Procedure (FHIR) and preserve FHIR resource IDs
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeProcedureResource)(encounterId_1, patient_1.id, surgicalHistoryNote, 'surgical-history-note')));
                }
                // convert Observation[] to Observation (FHIR) [] and preserve FHIR resource IDs
                observations === null || observations === void 0 ? void 0 : observations.forEach(function (element) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeObservationResource)(encounterId_1, patient_1.id, currentPractitioner_1.id, undefined, element, utils_1.ADDITIONAL_QUESTIONS_META_SYSTEM, patient_1.birthDate, patient_1.gender)));
                });
                vitalsObservations === null || vitalsObservations === void 0 ? void 0 : vitalsObservations.forEach(function (element) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeObservationResource)(encounterId_1, patient_1.id, currentPractitioner_1.id, undefined, element, utils_1.PATIENT_VITALS_META_SYSTEM, patient_1.birthDate, patient_1.gender)));
                });
                isInPerson_1 = (0, utils_1.isInPersonAppointment)(appointment);
                // convert ExamObservation[] to Observation(FHIR)[] and preserve FHIR resource IDs
                examObservations === null || examObservations === void 0 ? void 0 : examObservations.forEach(function (element) {
                    var allExamFields = (0, helpers_1.getAllExamFieldsMetadata)(isInPerson_1);
                    var examObservationComments = (0, helpers_1.createExamObservationComments)(isInPerson_1);
                    var observation = allExamFields.find(function (observation) { return observation.field === element.field; });
                    var comment = examObservationComments.find(function (comment) { return comment.field === element.field; });
                    if (!observation && !comment) {
                        throw new Error("Exam observation with field ".concat(element.field, " not found"));
                    }
                    var _a = (observation || comment), code = _a.code, bodySite = _a.bodySite, label = _a.label;
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeExamObservationResource)(encounterId_1, patient_1.id, element, code ? { code: code, bodySite: bodySite } : undefined, label)));
                });
                // 9. convert Medical Decision to ClinicalImpression (FHIR) and preserve FHIR resource IDs
                if (medicalDecision) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeClinicalImpressionResource)(encounterId_1, patient_1.id, medicalDecision, 'medical-decision')));
                }
                hpiText = chiefComplaint === null || chiefComplaint === void 0 ? void 0 : chiefComplaint.text;
                mdmText = medicalDecision === null || medicalDecision === void 0 ? void 0 : medicalDecision.text;
                // If either HPI or MDM is being updated and has meaningful content, generate AI suggestions
                if (hpiText || mdmText) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeEncounterTaskResource)(encounterId_1, { system: utils_1.OttehrTaskSystem, code: 'recommend-diagnosis-codes' })));
                }
                // 10 convert CPT code to Procedure (FHIR) and preserve FHIR resource IDs
                cptCodes === null || cptCodes === void 0 ? void 0 : cptCodes.forEach(function (element) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeProcedureResource)(encounterId_1, patient_1.id, element, 'cpt-code')));
                });
                if (emCode) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeProcedureResource)(encounterId_1, patient_1.id, emCode, 'em-code')));
                }
                // 11 convert provider instructions to Communication (FHIR) and preserve FHIR resource IDs
                instructions === null || instructions === void 0 ? void 0 : instructions.forEach(function (element) {
                    saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeCommunicationResource)(encounterId_1, patient_1.id, element, 'patient-instruction')));
                });
                // 12 convert disposition to Encounter.hospitalization (FHIR) update
                // and ServiceRequest (FHIR) resource creation
                if (disposition_1) {
                    saveOrUpdateRequests_1.push((0, shared_1.createDispositionServiceRequest)({
                        disposition: disposition_1,
                        encounterId: encounterId_1,
                        followUpId: (_f = (0, helpers_3.filterServiceRequestsFromFhir)(allResources_1, 'disposition-follow-up')[0]) === null || _f === void 0 ? void 0 : _f.id,
                        patientId: patient_1.id,
                    }));
                    updateEncounterOperations.push((0, shared_1.updateEncounterDischargeDisposition)(encounter, disposition_1));
                    subFollowUpCode_1 = (0, utils_1.createCodeableConcept)([
                        {
                            code: '185389009',
                            display: 'Follow-up visit (procedure)',
                            system: 'http://snomed.info/sct',
                        },
                    ], 'Follow-up visit (procedure)');
                    subFollowUpMetaTag_1 = 'sub-follow-up';
                    (_g = disposition_1.followUp) === null || _g === void 0 ? void 0 : _g.forEach(function (followUp) {
                        var _a, _b;
                        var followUpPerformer = shared_1.followUpToPerformerMap[followUp.type];
                        var lurieCtOrderDetail = (0, utils_1.createCodeableConcept)([
                            {
                                code: '77477000',
                                display: 'Computed tomography (procedure)',
                                system: 'http://snomed.info/sct',
                            },
                        ], 'Computed tomography (procedure)');
                        var existedSubFollowUpId = (_b = (0, helpers_3.filterServiceRequestsFromFhir)(allResources_1, subFollowUpMetaTag_1, (_a = followUpPerformer === null || followUpPerformer === void 0 ? void 0 : followUpPerformer.coding) === null || _a === void 0 ? void 0 : _a[0])[0]) === null || _b === void 0 ? void 0 : _b.id;
                        saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)((0, shared_1.makeServiceRequestResource)({
                            resourceId: existedSubFollowUpId,
                            encounterId: encounterId_1,
                            patientId: patient_1.id,
                            metaName: subFollowUpMetaTag_1,
                            code: subFollowUpCode_1,
                            orderDetail: followUp.type === 'lurie-ct' ? [lurieCtOrderDetail] : undefined,
                            performerType: followUpPerformer,
                            note: followUp.type === 'other' ? followUp.note : undefined,
                        })));
                    });
                    existingSubFollowUps = (0, helpers_3.filterServiceRequestsFromFhir)(allResources_1, subFollowUpMetaTag_1);
                    existingSubFollowUps.forEach(function (subFollowUp) {
                        var _a;
                        var subFollowUpType = Object.keys(shared_1.followUpToPerformerMap).find(function (key) {
                            var _a, _b, _c, _d;
                            return ((_b = (_a = shared_1.followUpToPerformerMap[key]) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) ===
                                ((_d = (_c = subFollowUp.performerType) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code);
                        });
                        if (subFollowUpType && !((_a = disposition_1.followUp) === null || _a === void 0 ? void 0 : _a.some(function (f) { return f.type === subFollowUpType; }))) {
                            saveOrUpdateRequests_1.push((0, helpers_2.deleteResourceRequest)('ServiceRequest', subFollowUp.id));
                        }
                    });
                }
                if (!diagnosis) return [3 /*break*/, 9];
                if (!encounter.diagnosis) {
                    updateEncounterOperations.push((0, utils_1.addEmptyArrOperation)('/diagnosis'));
                }
                _i = 0, diagnosis_1 = diagnosis;
                _h.label = 3;
            case 3:
                if (!(_i < diagnosis_1.length)) return [3 /*break*/, 9];
                element = diagnosis_1[_i];
                conditionResource = (0, shared_1.makeDiagnosisConditionResource)(encounterId_1, patient_1.id, element, 'diagnosis');
                if (!element.resourceId) return [3 /*break*/, 5];
                return [4 /*yield*/, oystehr.fhir.update(conditionResource)];
            case 4:
                _c = _h.sent();
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, oystehr.fhir.create(conditionResource)];
            case 6:
                _c = _h.sent();
                _h.label = 7;
            case 7:
                condition = _c;
                additionalResourcesForResponse.push(condition);
                updateEncounterOperations.push.apply(updateEncounterOperations, (0, shared_1.updateEncounterDiagnosis)(encounter, condition.id, element));
                _h.label = 8;
            case 8:
                _i++;
                return [3 /*break*/, 3];
            case 9:
                // convert BooleanValue to Condition (FHIR) resource and mention them in Encounter.extension
                if (patientInfoConfirmed) {
                    updateEncounterOperations.push.apply(updateEncounterOperations, (0, shared_1.updateEncounterPatientInfoConfirmed)(encounter, patientInfoConfirmed));
                }
                // convert BooleanValue to Condition (FHIR) resource and mention them in Encounter.extension
                if (addToVisitNote) {
                    updateEncounterOperations.push.apply(updateEncounterOperations, (0, shared_1.updateEncounterAddToVisitNote)(encounter, addToVisitNote));
                }
                // convert FreeTextNote to Condition (FHIR) resource and mention them in Encounter.extension
                if (addendumNote) {
                    updateEncounterOperations.push.apply(updateEncounterOperations, (0, shared_1.updateEncounterAddendumNote)(encounter, addendumNote));
                }
                // convert FreeTextNote to Encounter.extension
                if (reasonForVisit) {
                    updateEncounterOperations.push.apply(updateEncounterOperations, (0, shared_1.updateEncounterReasonForVisit)(encounter, reasonForVisit));
                }
                if (!newSchoolWorkNote) return [3 /*break*/, 12];
                if ((appointment === null || appointment === void 0 ? void 0 : appointment.id) === undefined)
                    throw new Error("No appointment found for encounterId: ".concat(encounterId_1));
                return [4 /*yield*/, (0, school_work_note_pdf_1.createSchoolWorkNotePDF)(newSchoolWorkNote, patient_1, secrets, m2mToken)];
            case 10:
                pdfInfo = _h.sent();
                _e = (_d = additionalResourcesForResponse).push;
                return [4 /*yield*/, (0, shared_1.makeSchoolWorkDR)(oystehr, pdfInfo, patient_1.id, appointment === null || appointment === void 0 ? void 0 : appointment.id, encounterId_1, newSchoolWorkNote.type, utils_1.SCHOOL_WORK_NOTE, listResources)];
            case 11:
                _e.apply(_d, [_h.sent()]);
                _h.label = 12;
            case 12:
                // updating schoolWork note DocumentReference status 'published' | 'unpublished'
                if (schoolWorkNotes) {
                    documentReferences_1 = allResources_1.filter(function (resource) { return resource.resourceType === 'DocumentReference'; });
                    schoolWorkNotes.forEach(function (element) {
                        var schoolWorkDR = documentReferences_1.find(function (dr) { return dr.id === element.id; });
                        if (schoolWorkDR) {
                            schoolWorkDR.docStatus = element.published
                                ? pdf_utils_1.PdfDocumentReferencePublishedStatuses.published
                                : pdf_utils_1.PdfDocumentReferencePublishedStatuses.unpublished;
                            saveOrUpdateRequests_1.push((0, shared_1.saveOrUpdateResourceRequest)(schoolWorkDR));
                        }
                    });
                }
                if (updateEncounterOperations.length > 0) {
                    saveOrUpdateRequests_1.push((0, utils_1.getPatchBinary)({
                        resourceId: encounterId_1,
                        resourceType: 'Encounter',
                        patchOperations: updateEncounterOperations,
                    }));
                }
                // convert notes to Communication (FHIR) resources
                notes === null || notes === void 0 ? void 0 : notes.forEach(function (element) {
                    var note = (0, shared_1.makeNoteResource)(encounterId_1, patient_1.id, element);
                    var request = (0, shared_1.saveOrUpdateResourceRequest)(note);
                    saveOrUpdateRequests_1.push(request);
                });
                // convert birth history to Observation (FHIR) resources
                birthHistory === null || birthHistory === void 0 ? void 0 : birthHistory.forEach(function (element) {
                    var birthHistoryElement = (0, shared_1.makeBirthHistoryObservationResource)(encounterId_1, patient_1.id, element, 'birth-history');
                    var request = (0, shared_1.saveOrUpdateResourceRequest)(birthHistoryElement);
                    saveOrUpdateRequests_1.push(request);
                });
                if (procedures) {
                    procedures === null || procedures === void 0 ? void 0 : procedures.forEach(function (procedure) {
                        saveOrUpdateRequests_1.push((0, shared_1.createProcedureServiceRequest)(procedure, encounterId_1, patient_1.id));
                    });
                    additionalResourcesForResponse.push(encounter);
                }
                console.log('Starting a transaction update of chart data...');
                console.timeLog('time', 'before saving resources');
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: saveOrUpdateRequests_1,
                    })];
            case 13:
                transactionBundle = _h.sent();
                console.timeLog('time', 'after saving resources');
                console.log('Updated chart data as a transaction');
                console.timeLog('time', 'before sorting resources');
                output = (0, helpers_3.validateBundleAndExtractSavedChartData)(transactionBundle, patient_1.id, encounterId_1, additionalResourcesForResponse);
                console.timeLog('time', 'after sorting resources');
                // ----- !!!DON'T DELETE!!! this is in #2129 scope -----
                // console.timeLog('time', 'before creating auditEvent');
                // const auditEvent = createAuditEvent(chartDataBeforeUpdate.chartResources, output.chartResources);
                // await oystehr.fhir.create(auditEvent);
                // console.timeLog('time', 'after creating auditEvent');
                console.timeEnd('time');
                return [2 /*return*/, {
                        body: JSON.stringify(output),
                        statusCode: 200,
                    }];
            case 14:
                error_1 = _h.sent();
                console.log(JSON.stringify(error_1, null, 2));
                return [2 /*return*/, {
                        body: JSON.stringify({ message: 'Error saving encounter data...' }),
                        statusCode: 500,
                    }];
            case 15: return [2 /*return*/];
        }
    });
}); });
// ----- !!!DON'T DELETE!!! this is in #2129 scope -----
// function createAuditEvent(chartResourcesBeforeUpdate: Resource[], chartResourcesAfterUpdate: Resource[]): AuditEvent {
//   // todo finish up this function to create proper AuditEvent and maybe discuss AE format with guys later
//   const resourcesEntities: AuditEventEntity[] = [];
//
//   // todo add previous resources and new one into entries
//   chartResourcesBeforeUpdate.forEach((res) => {
//     const resReference = createReference(res);
//     if (resReference.reference && res.meta?.versionId) {
//       createAuditEventEntity(createReference(res), 'entityName', res.meta.versionId);
//     }
//   });
//   return {
//     resourceType: 'AuditEvent',
//     type: {
//       code: '110101',
//       system: 'http://dicom.nema.org/resources/ontology/DCM',
//       display: 'Audit Log Used\t',
//     },
//     agent: [
//       {
//         who: {
//           reference: 'Practitioner/96587574-637b-4346-91d9-27abc655365f',
//         },
//         requestor: true,
//       },
//     ],
//     recorded: DateTime.now().toISO() ?? '',
//     source: {
//       observer: {
//         reference: 'Organization/165bb2f4-a972-4d29-b092-dac9d0bc43cf',
//       },
//     },
//     entity: resourcesEntities,
//   };
// }
//
// function createAuditEventEntity(
//   resourceReference: Reference,
//   name: string,
//   previousVersionId: string,
//   newVersionId?: string
// ): AuditEventEntity {
//   const entity = {
//     what: resourceReference,
//     name,
//     detail: [
//       {
//         type: 'previousVersionId',
//         valueString: previousVersionId,
//       },
//       // do we wanna keep this request json?? because idk how to create such thing in save-chart-data
//       {
//         type: 'requestJson',
//         valueString: '{"name": [{"given": ["Jonathan"], "family": "Doe"}]}',
//       },
//     ],
//   };
//   if (newVersionId) {
//     entity.detail.push({
//       type: 'newVersionId',
//       valueString: newVersionId,
//     });
//   }
//   return entity;
// }
function getUserPractitioner(oystehr, userToken, secrets) {
    return __awaiter(this, void 0, void 0, function () {
        var getUserResponse, userProfile, userProfileString, practitionerId, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, (0, utils_1.userMe)(userToken, secrets)];
                case 1:
                    getUserResponse = _a.sent();
                    userProfile = getUserResponse.profile;
                    console.log("User Profile: ".concat(JSON.stringify(userProfile)));
                    userProfileString = userProfile.split('/');
                    practitionerId = userProfileString[1];
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Practitioner',
                            id: practitionerId,
                        })];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_2 = _a.sent();
                    console.error("Failed to get Practitioner: ".concat(JSON.stringify(error_2)));
                    throw new Error("Failed to get Practitioner: ".concat(JSON.stringify(error_2)));
                case 4: return [2 /*return*/];
            }
        });
    });
}

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
exports.createProcedureServiceRequest = exports.followUpToPerformerMap = exports.createDispositionServiceRequest = exports.chartDataResourceHasMetaTagBySystem = exports.chartDataResourceHasMetaTagByCode = void 0;
exports.makeConditionResource = makeConditionResource;
exports.makeConditionDTO = makeConditionDTO;
exports.makeAllergyResource = makeAllergyResource;
exports.makeAllergyDTO = makeAllergyDTO;
exports.makeMedicationResource = makeMedicationResource;
exports.makeMedicationDTO = makeMedicationDTO;
exports.makePrescribedMedicationDTO = makePrescribedMedicationDTO;
exports.makeProcedureResource = makeProcedureResource;
exports.makeObservationResource = makeObservationResource;
exports.makeFreeTextNoteDTO = makeFreeTextNoteDTO;
exports.makeCPTCodeDTO = makeCPTCodeDTO;
exports.makeHospitalizationResource = makeHospitalizationResource;
exports.makeHospitalizationDTO = makeHospitalizationDTO;
exports.makeExamObservationResource = makeExamObservationResource;
exports.makeExamObservationDTO = makeExamObservationDTO;
exports.makeClinicalImpressionResource = makeClinicalImpressionResource;
exports.makeClinicalImpressionDTO = makeClinicalImpressionDTO;
exports.makeCommunicationResource = makeCommunicationResource;
exports.makeCommunicationDTO = makeCommunicationDTO;
exports.makeNoteResource = makeNoteResource;
exports.makeNoteDTO = makeNoteDTO;
exports.updateEncounterDischargeDisposition = updateEncounterDischargeDisposition;
exports.makeServiceRequestResource = makeServiceRequestResource;
exports.makeDispositionDTO = makeDispositionDTO;
exports.makeDispositionDTOFromFhirResources = makeDispositionDTOFromFhirResources;
exports.updateEncounterDiagnosis = updateEncounterDiagnosis;
exports.updateEncounterPatientInfoConfirmed = updateEncounterPatientInfoConfirmed;
exports.updateEncounterAddToVisitNote = updateEncounterAddToVisitNote;
exports.updateEncounterAddendumNote = updateEncounterAddendumNote;
exports.updateEncounterReasonForVisit = updateEncounterReasonForVisit;
exports.deleteEncounterDiagnosis = deleteEncounterDiagnosis;
exports.deleteEncounterAddendumNote = deleteEncounterAddendumNote;
exports.makeDiagnosisConditionResource = makeDiagnosisConditionResource;
exports.makeDiagnosisDTO = makeDiagnosisDTO;
exports.makeBirthHistoryObservationResource = makeBirthHistoryObservationResource;
exports.makeBirthHistoryDTO = makeBirthHistoryDTO;
exports.makeSchoolWorkDR = makeSchoolWorkDR;
exports.makeSchoolWorkNoteDTO = makeSchoolWorkNoteDTO;
exports.makeObservationDTO = makeObservationDTO;
exports.saveOrUpdateResource = saveOrUpdateResource;
exports.mapResourceToChartDataResponse = mapResourceToChartDataResponse;
exports.handleCustomDTOExtractions = handleCustomDTOExtractions;
exports.makeProceduresDTOFromFhirResources = makeProceduresDTOFromFhirResources;
exports.makeEncounterTaskResource = makeEncounterTaskResource;
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var helpers_1 = require("../appointment/helpers");
var helpers_2 = require("../helpers");
var pdf_utils_1 = require("../pdf/pdf-utils");
var resources_helpers_1 = require("../resources.helpers");
var hasValue = function (data) {
    if (data == null)
        return false;
    if (Array.isArray(data)) {
        return data.length > 0;
    }
    if (typeof data === 'object') {
        return Object.keys(data).length > 0;
    }
    return true;
};
var logDuplicationWarning = function (data, message) {
    if (hasValue(data)) {
        console.log(message);
    }
};
var getMetaWFieldName = function (fieldName) {
    return (0, helpers_2.fillMeta)(fieldName, fieldName);
};
function makeConditionResource(encounterId, patientId, data, fieldName) {
    var dto = data;
    return {
        id: data.resourceId,
        resourceType: 'Condition',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        code: dto.code
            ? {
                coding: [
                    {
                        system: 'http://hl7.org/fhir/sid/icd-10',
                        version: '2019',
                        code: dto.code,
                        display: dto.display,
                    },
                ],
            }
            : undefined,
        note: data.text
            ? [{ text: data.text || '' }]
            : data.note
                ? [{ text: data.note || '' }]
                : [],
        clinicalStatus: typeof data.current === 'boolean'
            ? {
                coding: [
                    {
                        code: data.current ? 'active' : 'inactive',
                        system: utils_1.FHIR_EXTENSION.Condition.conditionClinical.url,
                    },
                ],
            }
            : undefined,
        meta: getMetaWFieldName(fieldName),
    };
}
function makeConditionDTO(condition) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    return {
        resourceId: condition.id,
        code: (_c = (_b = (_a = condition.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code,
        display: (_f = (_e = (_d = condition.code) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.display,
        note: (_h = (_g = condition.note) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text,
        current: ((_l = (_k = (_j = condition.clinicalStatus) === null || _j === void 0 ? void 0 : _j.coding) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.code) === 'active',
        lastUpdated: ((_m = condition.meta) === null || _m === void 0 ? void 0 : _m.lastUpdated) || undefined,
    };
}
function makeAllergyResource(encounterId, patientId, data, fieldName) {
    // commenting type for now since zap and erx doesn't support it yet
    // const allergyType = data.type !== 'food' && data.type !== 'medication' ? undefined : data.type;
    return {
        id: data.resourceId,
        resourceType: 'AllergyIntolerance',
        patient: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        type: 'allergy',
        // category: allergyType ? [allergyType] : undefined,
        meta: getMetaWFieldName(fieldName),
        note: data.note ? [{ text: data.note }] : undefined,
        clinicalStatus: typeof data.current === 'boolean'
            ? {
                coding: [
                    {
                        code: data.current ? 'active' : 'inactive',
                        system: utils_1.FHIR_EXTENSION.AllergyIntolerance.allergyIntoleranceClinical.url,
                    },
                ],
            }
            : undefined,
        code: data.id
            ? {
                coding: [
                    {
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-allergen-id',
                        code: data.id,
                        display: data.name,
                    },
                ],
            }
            : {
                coding: [
                    {
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/other-allergy',
                        display: data.name,
                    },
                ],
            },
    };
}
function makeAllergyDTO(allergy) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    // const allergyDTOType =
    //   (allergy.category?.[0] &&
    //     (allergy.category[0] !== 'food' && allergy.category[0] !== 'medication' ? 'other' : allergy.category[0])) ??
    //   'other';
    return {
        resourceId: allergy.id,
        // type: allergyDTOType,
        name: (_b = (_a = allergy.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].display,
        id: (_d = (_c = allergy.code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code,
        note: (_f = (_e = allergy.note) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text,
        current: ((_j = (_h = (_g = allergy.clinicalStatus) === null || _g === void 0 ? void 0 : _g.coding) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.code) === 'active',
        lastUpdated: ((_k = allergy.meta) === null || _k === void 0 ? void 0 : _k.lastUpdated) || undefined,
    };
}
function makeMedicationResource(encounterId, patientId, practitionerId, data, fieldName) {
    return {
        id: data.resourceId,
        identifier: [{ value: data.id }],
        resourceType: 'MedicationStatement',
        subject: { reference: "Patient/".concat(patientId) },
        context: { reference: "Encounter/".concat(encounterId) },
        status: data.status,
        dosage: [{ text: data.intakeInfo.dose, asNeededBoolean: data.type === 'as-needed' }],
        effectiveDateTime: data.intakeInfo.date,
        informationSource: { reference: "Practitioner/".concat(practitionerId) },
        meta: getMetaWFieldName(fieldName),
        medicationCodeableConcept: {
            coding: [
                {
                    system: utils_1.MEDICATION_DISPENSABLE_DRUG_ID,
                    code: data.id,
                    display: data.name,
                },
            ],
        },
    };
}
function makeMedicationDTO(medication) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return {
        resourceId: medication.id,
        id: ((_b = (_a = medication.medicationCodeableConcept) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) || '',
        name: ((_d = (_c = medication.medicationCodeableConcept) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].display) || '',
        type: ((_f = (_e = medication.meta) === null || _e === void 0 ? void 0 : _e.tag) === null || _f === void 0 ? void 0 : _f[0].code) === 'prescribed-medication'
            ? 'prescribed-medication'
            : ((_g = medication.dosage) === null || _g === void 0 ? void 0 : _g[0].asNeededBoolean)
                ? 'as-needed'
                : 'scheduled',
        intakeInfo: {
            dose: getMedicationDosage(medication, ((_j = (_h = medication.meta) === null || _h === void 0 ? void 0 : _h.tag) === null || _j === void 0 ? void 0 : _j[0].code) || ''),
            date: medication.effectiveDateTime,
        },
        status: ['active', 'completed'].includes(medication.status)
            ? medication.status
            : 'completed',
        practitioner: medication.informationSource,
    };
}
function makePrescribedMedicationDTO(medRequest) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    return {
        resourceId: medRequest.id,
        name: (_c = (_b = (_a = medRequest.medicationCodeableConcept) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === utils_1.MEDICATION_DISPENSABLE_DRUG_ID; })) === null || _c === void 0 ? void 0 : _c.display,
        instructions: (_e = (_d = medRequest.dosageInstruction) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.patientInstruction,
        added: (_f = medRequest.meta) === null || _f === void 0 ? void 0 : _f.lastUpdated,
        provider: (_j = (_h = (_g = medRequest.requester) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.split('/')) === null || _j === void 0 ? void 0 : _j[1],
        status: medRequest.status,
        prescriptionId: (_l = (_k = medRequest.identifier) === null || _k === void 0 ? void 0 : _k.find(function (identifier) { return identifier.system === 'https://identifiers.fhir.oystehr.com/erx-prescription-id'; })) === null || _l === void 0 ? void 0 : _l.value,
        encounterId: (_p = (_o = (_m = medRequest.encounter) === null || _m === void 0 ? void 0 : _m.reference) === null || _o === void 0 ? void 0 : _o.split('/')) === null || _p === void 0 ? void 0 : _p[1],
    };
}
function makeProcedureResource(encounterId, patientId, data, fieldName) {
    var nameOrText = data.display || data.text || '';
    var result = {
        id: data.resourceId,
        resourceType: 'Procedure',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        status: 'completed',
        note: nameOrText ? [{ text: nameOrText }] : undefined,
        meta: getMetaWFieldName(fieldName),
    };
    var text = data.text;
    if (text !== undefined) {
        result.note = [{ text: text }];
    }
    else if ('code' in data && 'display' in data) {
        result.code = {
            coding: [{ code: data.code, display: data.display }],
        };
    }
    return result;
}
// todo: make this input a single interface type
function makeObservationResource(encounterId, patientId, practitionerId, documentReferenceCreateUrl, data, metaSystem, patientDOB, patientSex) {
    var base = __assign(__assign({ id: data.resourceId, resourceType: 'Observation', subject: { reference: "Patient/".concat(patientId) }, performer: practitionerId && practitionerId.length > 0 ? [{ reference: "Practitioner/".concat(practitionerId) }] : undefined, encounter: { reference: "Encounter/".concat(encounterId) }, effectiveDateTime: luxon_1.DateTime.utc().toISO(), status: 'final', code: { text: data.field || 'unknown' } }, (documentReferenceCreateUrl
        ? {
            derivedFrom: [
                {
                    reference: documentReferenceCreateUrl,
                },
            ],
        }
        : {})), { meta: (0, helpers_2.fillMeta)(data.field, metaSystem) });
    var fieldName = data.field;
    console.log("makeObservationResource() fieldName=[".concat(fieldName, "] data=[").concat(JSON.stringify(data), "]"));
    if ((0, utils_1.isVitalObservation)(data)) {
        var interpretation = void 0;
        if (patientDOB) {
            interpretation = (0, utils_1.getVitalObservationFhirInterpretations)({
                patientDOB: patientDOB,
                vitalsObservation: data,
                patientSex: patientSex,
            });
        }
        return (0, utils_1.fillVitalObservationAttributes)(__assign(__assign({}, base), { interpretation: interpretation }), data, patientDOB);
    }
    if (isObservationBooleanFieldDTO(data)) {
        return __assign(__assign({}, base), { valueBoolean: data.value });
    }
    if (isObservationTextFieldDTO(data)) {
        if ('note' in data && data.note) {
            return __assign(__assign({}, base), { valueString: data.value, note: [{ text: data.note }] });
        }
        else {
            return __assign(__assign({}, base), { valueString: data.value });
        }
    }
    if (isObservationDateRangeFieldDTO(data)) {
        delete base.effectiveDateTime;
        var _a = data.value, start = _a[0], end = _a[1];
        return __assign(__assign({}, base), { effectivePeriod: {
                start: start,
                end: end,
            } });
    }
    throw new Error('Invalid ObservationDTO type');
}
function isObservationBooleanFieldDTO(data) {
    return typeof data.value === 'boolean';
}
function isObservationTextFieldDTO(data) {
    return typeof data.value === 'string';
}
function isObservationDateRangeFieldDTO(data) {
    if (!Array.isArray(data.value) || data.value.length !== 2) {
        return false;
    }
    if (typeof data.value[0] !== 'string' || typeof data.value[1] !== 'string') {
        return false;
    }
    var startDate = luxon_1.DateTime.fromISO(data.value[0]);
    var endDate = luxon_1.DateTime.fromISO(data.value[1]);
    if (!startDate.isValid || !endDate.isValid) {
        return false;
    }
    if (startDate > endDate) {
        console.log('startDate should be less than endDate');
        return false;
    }
    return true;
}
function makeFreeTextNoteDTO(resource) {
    var _a, _b;
    return {
        resourceId: resource.id,
        text: ((_b = (_a = resource.note) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) || '',
    };
}
function makeCPTCodeDTO(resource) {
    var _a, _b;
    var coding = (_b = (_a = resource.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0];
    if ((coding === null || coding === void 0 ? void 0 : coding.code) && (coding === null || coding === void 0 ? void 0 : coding.display)) {
        return {
            resourceId: resource.id,
            code: coding === null || coding === void 0 ? void 0 : coding.code,
            display: coding === null || coding === void 0 ? void 0 : coding.display,
        };
    }
    return undefined;
}
function makeHospitalizationResource(patientId, data, fieldName) {
    var result = {
        id: data.resourceId,
        resourceType: 'EpisodeOfCare',
        status: 'finished',
        patient: { reference: "Patient/".concat(patientId) },
        type: [(0, utils_1.createCodeableConcept)(undefined, data.display)],
        meta: getMetaWFieldName(fieldName),
    };
    return result;
}
function makeHospitalizationDTO(resource) {
    var _a, _b, _c, _d, _e;
    var code = (_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code;
    var display = (_e = (_d = resource.type) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text;
    var resourceId = resource.id;
    if (resourceId && code && display) {
        return { resourceId: resourceId, code: code, display: display };
    }
    return undefined;
}
function makeExamObservationResource(encounterId, patientId, data, snomedCodes, label) {
    return {
        resourceType: 'Observation',
        id: data.resourceId,
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        status: 'final',
        valueBoolean: typeof data.value === 'boolean' ? Boolean(data.value) : undefined,
        note: data.note ? [{ text: data.note }] : undefined,
        bodySite: snomedCodes === null || snomedCodes === void 0 ? void 0 : snomedCodes.bodySite,
        code: (snomedCodes === null || snomedCodes === void 0 ? void 0 : snomedCodes.code) || { text: label || 'unknown' },
        meta: (0, helpers_2.fillMeta)(data.field, utils_1.EXAM_OBSERVATION_META_SYSTEM),
    };
}
function makeExamObservationDTO(observation) {
    var _a, _b, _c, _d, _e;
    return {
        resourceId: observation.id,
        field: ((_c = (_b = (_a = observation.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code) || 'unknown',
        note: (_e = (_d = observation.note) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text,
        value: observation.valueBoolean,
    };
}
function makeClinicalImpressionResource(encounterId, patientId, data, fieldName) {
    return {
        resourceType: 'ClinicalImpression',
        id: data.resourceId,
        status: 'completed',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        summary: data.text,
        meta: getMetaWFieldName(fieldName),
    };
}
function makeClinicalImpressionDTO(resource) {
    return {
        resourceId: resource.id,
        text: resource.summary,
    };
}
function makeCommunicationResource(encounterId, patientId, data, fieldName) {
    return {
        resourceType: 'Communication',
        id: data.resourceId,
        status: 'completed',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        payload: [
            {
                contentString: data.text,
            },
        ],
        meta: getMetaWFieldName(fieldName),
    };
}
function makeCommunicationDTO(resource) {
    var _a;
    return {
        resourceId: resource.id,
        text: (_a = resource.payload) === null || _a === void 0 ? void 0 : _a[0].contentString,
    };
}
function makeNoteResource(encounterId, patientId, data) {
    var resource = {
        id: data.resourceId,
        resourceType: 'Communication',
        encounter: { reference: "Encounter/".concat(encounterId) },
        status: 'completed',
        meta: (0, helpers_2.fillMeta)(utils_1.IN_PERSON_NOTE_ID, data.type),
        subject: { reference: "Patient/".concat(patientId) },
        sender: {
            reference: "Practitioner/".concat(data.authorId),
            display: data.authorName,
        },
        payload: [
            {
                contentString: data.text,
            },
        ],
    };
    return resource;
}
function makeNoteDTO(resource) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    var noteType = (((_e = (_d = (_c = (_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code; })) === null || _c === void 0 ? void 0 : _c.system) === null || _d === void 0 ? void 0 : _d.split('/')) === null || _e === void 0 ? void 0 : _e.at(-1)) || 'unknown');
    return {
        type: noteType || 'unknown',
        resourceId: resource.id,
        text: (_h = (_g = (_f = resource.payload) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.contentString) !== null && _h !== void 0 ? _h : '',
        lastUpdated: (_k = (_j = resource.meta) === null || _j === void 0 ? void 0 : _j.lastUpdated) !== null && _k !== void 0 ? _k : '',
        authorId: (_o = (_m = (_l = resource.sender) === null || _l === void 0 ? void 0 : _l.reference) === null || _m === void 0 ? void 0 : _m.split('/')[1]) !== null && _o !== void 0 ? _o : '',
        authorName: (_q = (_p = resource.sender) === null || _p === void 0 ? void 0 : _p.display) !== null && _q !== void 0 ? _q : '',
        patientId: (_t = (_s = (_r = resource.subject) === null || _r === void 0 ? void 0 : _r.reference) === null || _s === void 0 ? void 0 : _s.split('/')[1]) !== null && _t !== void 0 ? _t : '',
        encounterId: (_w = (_v = (_u = resource.encounter) === null || _u === void 0 ? void 0 : _u.reference) === null || _v === void 0 ? void 0 : _v.split('/')[1]) !== null && _w !== void 0 ? _w : '',
    };
}
function updateEncounterDischargeDisposition(encounter, data) {
    if (!data)
        return (0, utils_1.removeOperation)('/hospitalization');
    return (0, utils_1.addOrReplaceOperation)(encounter.hospitalization, '/hospitalization', {
        dischargeDisposition: {
            coding: [
                {
                    code: data.type,
                    system: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/discharge-disposition"),
                },
            ],
            text: data.note,
        },
    });
}
function makeServiceRequestResource(_a) {
    var resourceId = _a.resourceId, encounterId = _a.encounterId, patientId = _a.patientId, metaName = _a.metaName, code = _a.code, followUpIn = _a.followUpIn, orderDetail = _a.orderDetail, performerType = _a.performerType, note = _a.note, nothingToEatOrDrink = _a.nothingToEatOrDrink;
    return {
        id: resourceId,
        resourceType: 'ServiceRequest',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        intent: 'plan',
        status: 'active',
        orderDetail: orderDetail !== null && orderDetail !== void 0 ? orderDetail : undefined,
        performerType: performerType !== null && performerType !== void 0 ? performerType : undefined,
        occurrenceTiming: typeof followUpIn === 'number'
            ? {
                repeat: {
                    offset: followUpIn,
                },
            }
            : undefined,
        note: note
            ? [
                {
                    text: note,
                },
            ]
            : undefined,
        code: code,
        meta: (0, helpers_2.fillMeta)(metaName, metaName),
        extension: nothingToEatOrDrink === true
            ? [{ url: utils_1.NOTHING_TO_EAT_OR_DRINK_ID, valueBoolean: nothingToEatOrDrink }]
            : undefined,
    };
}
var filterCodeableConcepts = function (details, system) {
    var _a;
    var isValidDetail = function (detail) { var _a, _b, _c; return ((_b = (_a = detail.coding) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.system) === system && typeof ((_c = detail.coding[0]) === null || _c === void 0 ? void 0 : _c.code) === 'string'; };
    return (_a = details === null || details === void 0 ? void 0 : details.filter(isValidDetail).map(function (detail) { return detail.coding[0].code; })) !== null && _a !== void 0 ? _a : [];
};
function makeDispositionDTO(dispositionCode, dispositionText, followUp, subFollowUp) {
    var _a;
    var _b, _c, _d;
    var labServices = filterCodeableConcepts(followUp.orderDetail, 'lab-service');
    var virusTests = filterCodeableConcepts(followUp.orderDetail, 'virus-test');
    var reasonForTransfer = filterCodeableConcepts(followUp.orderDetail, 'reason-for-transfer')[0];
    var followUpArr = subFollowUp === null || subFollowUp === void 0 ? void 0 : subFollowUp.map(function (element) {
        var _a, _b, _c;
        var performerCode = (_b = (_a = element.performerType) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code;
        var followUpType = Object.keys(exports.followUpToPerformerMap).find(function (keyName) { var _a, _b; return performerCode === ((_b = (_a = exports.followUpToPerformerMap[keyName]) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code); });
        return {
            type: followUpType,
            note: (_c = element.note) === null || _c === void 0 ? void 0 : _c[0].text,
        };
    });
    var followUpTime = (_c = (_b = followUp.occurrenceTiming) === null || _b === void 0 ? void 0 : _b.repeat) === null || _c === void 0 ? void 0 : _c.offset;
    console.log('followUp', JSON.stringify(followUp));
    console.log('followUpTime', followUpTime);
    return _a = {
            type: dispositionCode,
            note: dispositionText,
            labService: labServices,
            virusTest: virusTests,
            reason: reasonForTransfer,
            followUp: followUpArr !== null && followUpArr !== void 0 ? followUpArr : undefined,
            followUpIn: typeof followUpTime === 'number' ? Math.floor(followUpTime / 1440) : undefined
        },
        _a[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD] = (_d = followUp.extension) === null || _d === void 0 ? void 0 : _d.some(function (ext) { return ext.url === utils_1.NOTHING_TO_EAT_OR_DRINK_ID && ext.valueBoolean === true; }),
        _a;
}
function makeDispositionDTOFromFhirResources(encounter, serviceRequests) {
    var _a, _b, _c;
    // checking and creating dispositionDTO
    if (encounter) {
        var dischargeDisposition = (_a = encounter.hospitalization) === null || _a === void 0 ? void 0 : _a.dischargeDisposition;
        var dispositionCode = (_c = (_b = dischargeDisposition === null || dischargeDisposition === void 0 ? void 0 : dischargeDisposition.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/discharge-disposition"); })) === null || _c === void 0 ? void 0 : _c.code;
        var dispositionText = dischargeDisposition === null || dischargeDisposition === void 0 ? void 0 : dischargeDisposition.text;
        if (dispositionCode && dispositionText !== undefined) {
            var dispositionFollowUp = serviceRequests === null || serviceRequests === void 0 ? void 0 : serviceRequests.find(function (serviceRequest) {
                return (0, exports.chartDataResourceHasMetaTagByCode)(serviceRequest, 'disposition-follow-up');
            });
            var subFollowUps = serviceRequests === null || serviceRequests === void 0 ? void 0 : serviceRequests.filter(function (serviceRequest) {
                return (0, exports.chartDataResourceHasMetaTagByCode)(serviceRequest, 'sub-follow-up');
            });
            if (dispositionFollowUp) {
                return makeDispositionDTO(dispositionCode, dispositionText, dispositionFollowUp, subFollowUps);
            }
        }
    }
    return undefined;
}
function updateEncounterDiagnosis(encounter, conditionId, data) {
    var _a;
    var conditionReference = "Condition/".concat(conditionId);
    var foundDiagnosis = false;
    var resultOperations = [];
    (_a = encounter.diagnosis) === null || _a === void 0 ? void 0 : _a.forEach(function (element, index) {
        if (element.condition.reference === conditionReference) {
            if (data.isPrimary)
                resultOperations.push((0, utils_1.addOperation)("/diagnosis/".concat(index, "/rank"), 1));
            else if (!data.isPrimary && element.rank !== undefined)
                resultOperations.push((0, utils_1.removeOperation)("/diagnosis/".concat(index, "/rank")));
            foundDiagnosis = true;
        }
    });
    if (!foundDiagnosis) {
        resultOperations.push((0, utils_1.addOperation)('/diagnosis/-', {
            condition: { reference: conditionReference },
            rank: data.isPrimary ? 1 : undefined,
        }));
    }
    return resultOperations;
}
function updateEncounterPatientInfoConfirmed(encounter, data) {
    var _a, _b;
    var resultOperations = [];
    var patientInfoConfirmed = (_a = encounter.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === 'patient-info-confirmed'; });
    if (patientInfoConfirmed) {
        (_b = encounter.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (ext, index) {
            if (ext.url === 'patient-info-confirmed') {
                resultOperations.push((0, utils_1.addOrReplaceOperation)(ext.valueBoolean, "/extension/".concat(index, "/valueBoolean"), data.value));
            }
        });
    }
    else {
        if (!encounter.extension)
            resultOperations.push((0, utils_1.addEmptyArrOperation)('/extension'));
        resultOperations.push((0, utils_1.addOperation)('/extension/-', { url: 'patient-info-confirmed', valueBoolean: data.value }));
    }
    return resultOperations;
}
function updateEncounterAddToVisitNote(encounter, data) {
    var _a, _b;
    var resultOperations = [];
    var addToVisitNote = (_a = encounter.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === 'add-to-visit-note'; });
    if (addToVisitNote) {
        (_b = encounter.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (ext, index) {
            if (ext.url === 'add-to-visit-note') {
                resultOperations.push((0, utils_1.addOrReplaceOperation)(ext.valueBoolean, "/extension/".concat(index, "/valueBoolean"), data.value));
            }
        });
    }
    else {
        if (!encounter.extension)
            resultOperations.push((0, utils_1.addEmptyArrOperation)('/extension'));
        resultOperations.push((0, utils_1.addOperation)('/extension/-', { url: 'add-to-visit-note', valueBoolean: data.value }));
    }
    return resultOperations;
}
function updateEncounterAddendumNote(encounter, data) {
    var _a, _b;
    var addendumNote = (_a = encounter.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === 'addendum-note'; });
    var resultOperations = [];
    if (addendumNote) {
        (_b = encounter.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (ext, index) {
            if (ext.url === 'addendum-note') {
                resultOperations.push((0, utils_1.addOrReplaceOperation)(ext.valueString, "/extension/".concat(index, "/valueString"), data.text));
            }
        });
    }
    else {
        if (!encounter.extension)
            resultOperations.push((0, utils_1.addEmptyArrOperation)('/extension'));
        resultOperations.push((0, utils_1.addOperation)('/extension/-', { url: 'addendum-note', valueString: data.text }));
    }
    return resultOperations;
}
function updateEncounterReasonForVisit(encounter, data) {
    var _a, _b;
    var reasonForVisit = (_a = encounter.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === 'reason-for-visit'; });
    var resultOperations = [];
    if (reasonForVisit) {
        (_b = encounter.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (ext, index) {
            if (ext.url === 'reason-for-visit') {
                resultOperations.push((0, utils_1.addOrReplaceOperation)(ext.valueString, "/extension/".concat(index, "/valueString"), data.text));
            }
        });
    }
    else {
        if (!encounter.extension)
            resultOperations.push((0, utils_1.addEmptyArrOperation)('/extension'));
        resultOperations.push((0, utils_1.addOperation)('/extension/-', { url: 'reason-for-visit', valueString: data.text }));
    }
    return resultOperations;
}
function deleteEncounterDiagnosis(encounter, conditionId) {
    var resultOperations = [];
    if (encounter.diagnosis) {
        encounter.diagnosis.find(function (diagnosis, index) {
            if (diagnosis.condition.reference === "Condition/".concat(conditionId))
                resultOperations.push((0, utils_1.removeOperation)("/diagnosis/".concat(index)));
        });
    }
    return resultOperations;
}
function deleteEncounterAddendumNote(encounter) {
    var _a;
    var resultOperations = [];
    (_a = encounter.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext, index) {
        if (ext.url === 'addendum-note')
            resultOperations.push((0, utils_1.removeOperation)("/extension/".concat(index)));
    });
    return resultOperations;
}
function makeDiagnosisConditionResource(encounterId, patientId, data, fieldName, source) {
    var _a;
    var meta = getMetaWFieldName(fieldName);
    if (fieldName === 'ai-potential-diagnosis') {
        (_a = meta.tag) === null || _a === void 0 ? void 0 : _a.push({
            code: source,
            system: "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(fieldName, "-source"),
        });
    }
    var conditionConfig = {
        id: data.resourceId,
        resourceType: 'Condition',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        code: {
            coding: [
                {
                    system: 'http://hl7.org/fhir/sid/icd-10',
                    code: data.code,
                    display: data.display,
                },
            ],
        },
        meta: meta,
    };
    if (data.addedViaLabOrder) {
        conditionConfig.extension = [
            {
                url: utils_1.ADDED_VIA_LAB_ORDER_SYSTEM,
                valueBoolean: true,
            },
        ];
    }
    return conditionConfig;
}
function makeDiagnosisDTO(resource, isPrimary) {
    var _a, _b, _c, _d, _e, _f;
    var addedViaLabOrder = !!((_b = (_a = resource.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.ADDED_VIA_LAB_ORDER_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.valueBoolean);
    return {
        resourceId: resource.id,
        code: ((_d = (_c = resource.code) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code) || '',
        display: ((_f = (_e = resource.code) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f[0].display) || '',
        isPrimary: isPrimary,
        addedViaLabOrder: addedViaLabOrder,
    };
}
var mapBirthHistoryFieldToCoding = {
    age: {
        system: 'http://loinc.org',
        code: '76516-4',
        display: 'Gestational age--at birth',
    },
    weight: {
        system: 'http://loinc.org',
        code: '8339-4',
        display: 'Birth weight Measured',
    },
    length: {
        system: 'http://loinc.org',
        code: '89269-5',
        display: 'Body height Measured --at birth',
    },
    'preg-compl': {
        system: 'http://loinc.org',
        code: '65869-0',
        display: 'Pregnancy complication',
    },
    'del-compl': {
        system: 'http://loinc.org',
        code: '73781-7',
        display: 'Maternal morbidity',
    },
};
var mapBirthHistoryFieldToValueQuantity = {
    age: function (value) { return ({
        value: value,
        system: 'http://unitsofmeasure.org',
        code: 'wk',
    }); },
    weight: function (value) { return ({
        value: value,
        system: 'http://unitsofmeasure.org',
        code: 'kg',
    }); },
    length: function (value) { return ({
        value: value,
        system: 'http://unitsofmeasure.org',
        code: 'cm',
    }); },
    'preg-compl': undefined,
    'del-compl': undefined,
};
function makeBirthHistoryObservationResource(encounterId, patientId, data, fieldName) {
    var _a;
    var coding = mapBirthHistoryFieldToCoding[data.field];
    var valueQuantity = (_a = mapBirthHistoryFieldToValueQuantity[data.field]) === null || _a === void 0 ? void 0 : _a.call(mapBirthHistoryFieldToValueQuantity, data.value);
    return {
        id: data.resourceId,
        resourceType: 'Observation',
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        status: 'final',
        code: {
            coding: [coding],
        },
        note: data.note ? [{ text: data.note }] : undefined,
        valueBoolean: data.flag,
        valueQuantity: valueQuantity,
        meta: getMetaWFieldName(fieldName),
    };
}
function makeBirthHistoryDTO(resource) {
    var _a, _b, _c;
    return {
        resourceId: resource.id,
        field: Object.keys(mapBirthHistoryFieldToCoding).find(function (field) { var _a, _b; return ((_b = (_a = resource.code.coding) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.code) === mapBirthHistoryFieldToCoding[field].code; }),
        note: (_b = (_a = resource.note) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text,
        flag: resource.valueBoolean,
        value: (_c = resource.valueQuantity) === null || _c === void 0 ? void 0 : _c.value,
    };
}
function makeSchoolWorkDR(oystehr, pdfInfo, patientId, appointmentId, encounterId, type, fieldName, listResources) {
    return __awaiter(this, void 0, void 0, function () {
        var docRefs;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                        files: [
                            {
                                url: pdfInfo.uploadURL,
                                title: pdfInfo.title,
                            },
                        ],
                        docStatus: pdf_utils_1.PdfDocumentReferencePublishedStatuses.unpublished,
                        type: {
                            coding: [
                                {
                                    system: 'http://loinc.org',
                                    code: utils_1.SCHOOL_WORK_NOTE_CODE,
                                    display: 'School/Work note',
                                },
                            ],
                            text: 'School/Work note',
                        },
                        references: {
                            subject: {
                                reference: "Patient/".concat(patientId),
                            },
                            context: {
                                related: [
                                    {
                                        reference: "Appointment/".concat(appointmentId),
                                    },
                                ],
                                encounter: [{ reference: "Encounter/".concat(encounterId) }],
                            },
                        },
                        dateCreated: (_a = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _a !== void 0 ? _a : '',
                        oystehr: oystehr,
                        generateUUID: crypto_1.randomUUID,
                        meta: {
                            tag: __spreadArray([{ code: type, system: utils_1.SCHOOL_WORK_NOTE_TYPE_META_SYSTEM }], (getMetaWFieldName(fieldName).tag || []), true),
                        },
                        searchParams: [
                            { name: 'encounter', value: "Encounter/".concat(encounterId) },
                            { name: 'subject', value: "Patient/".concat(patientId) },
                        ],
                        listResources: listResources,
                    })];
                case 1:
                    docRefs = (_b.sent()).docRefs;
                    return [2 /*return*/, docRefs[0]];
            }
        });
    });
}
function makeSchoolWorkNoteDTO(resource) {
    var _a, _b, _c, _d;
    var documentBaseUrl = (_a = resource.content) === null || _a === void 0 ? void 0 : _a[0].attachment.url;
    if (!documentBaseUrl)
        throw new Error("Attached DocumentReference don't have attached base file URL");
    var type = (_d = (_c = (_b = resource.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { return tag.system === utils_1.SCHOOL_WORK_NOTE_TYPE_META_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.code;
    return {
        id: resource.id,
        name: documentBaseUrl.split('/').reverse()[0],
        url: documentBaseUrl,
        published: (0, pdf_utils_1.isDocumentPublished)(resource),
        date: resource.date,
        type: type !== null && type !== void 0 ? type : 'work',
    };
}
function makeObservationDTO(observation) {
    var _a, _b, _c, _d, _e, _f, _g;
    var field = ((_b = (_a = observation.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b[0].code) || '';
    if (typeof observation.valueBoolean === 'boolean') {
        return {
            resourceId: observation.id,
            field: field,
            value: observation.valueBoolean,
        };
    }
    else if (typeof observation.valueString === 'string') {
        return {
            resourceId: observation.id,
            field: field,
            value: observation.valueString,
            note: (_d = (_c = observation.note) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.text,
            derivedFrom: (_e = observation.derivedFrom) === null || _e === void 0 ? void 0 : _e[0].reference,
        };
    }
    else if (((_f = observation.effectivePeriod) === null || _f === void 0 ? void 0 : _f.start) && ((_g = observation.effectivePeriod) === null || _g === void 0 ? void 0 : _g.end)) {
        return {
            resourceId: observation.id,
            field: field,
            value: [observation.effectivePeriod.start, observation.effectivePeriod.end],
        };
    }
    console.error("Invalid Observation field type: \"".concat(field, "\" ").concat(JSON.stringify(observation)));
    return null;
}
function saveOrUpdateResource(resource, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (resource.id === undefined)
                return [2 /*return*/, oystehr.fhir.create(resource)];
            return [2 /*return*/, oystehr.fhir.update(resource)];
        });
    });
}
var chartDataResourceHasMetaTagByCode = function (resource, metaTagCode) { var _a, _b; return (metaTagCode ? Boolean((_b = (_a = resource === null || resource === void 0 ? void 0 : resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.code === metaTagCode; })) : true); };
exports.chartDataResourceHasMetaTagByCode = chartDataResourceHasMetaTagByCode;
var resourceReferencesEncounter = function (resource, encounterId) {
    var _a, _b;
    var encounterRef = (_b = (_a = resource.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Encounter/', '');
    return encounterRef === encounterId;
};
var chartDataResourceHasMetaTagBySystem = function (resource, metaTagSystem) { var _a, _b; return metaTagSystem ? Boolean((_b = (_a = resource === null || resource === void 0 ? void 0 : resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === metaTagSystem; })) : true; };
exports.chartDataResourceHasMetaTagBySystem = chartDataResourceHasMetaTagBySystem;
var mapResourceToChartDataFields = function (data, resource, encounterId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var resourceMapped = false;
    if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Condition' && (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'medical-condition')) {
        (_a = data.conditions) === null || _a === void 0 ? void 0 : _a.push(makeConditionDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Condition' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'chief-complaint') &&
        resourceReferencesEncounter(resource, encounterId)) {
        logDuplicationWarning(data.chiefComplaint, 'chart-data duplication warning: "chiefComplaint" already exists');
        data.chiefComplaint = makeFreeTextNoteDTO(resource);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Condition' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'history-of-present-illness') &&
        resourceReferencesEncounter(resource, encounterId)) {
        logDuplicationWarning(data.historyOfPresentIllness, 'chart-data duplication warning: "historyOfPresentIllness" already exists');
        data.historyOfPresentIllness = makeFreeTextNoteDTO(resource);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Condition' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'mechanism-of-injury') &&
        resourceReferencesEncounter(resource, encounterId)) {
        logDuplicationWarning(data.mechanismOfInjury, 'chart-data duplication warning: "mechanismOfInjury" already exists');
        data.mechanismOfInjury = makeFreeTextNoteDTO(resource);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Condition' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'ros') &&
        resourceReferencesEncounter(resource, encounterId)) {
        logDuplicationWarning(data.ros, 'chart-data duplication warning: "ros" already exists');
        data.ros = makeFreeTextNoteDTO(resource);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'AllergyIntolerance' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'known-allergy')) {
        (_b = data.allergies) === null || _b === void 0 ? void 0 : _b.push(makeAllergyDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'MedicationStatement' &&
        ((0, exports.chartDataResourceHasMetaTagByCode)(resource, 'current-medication') ||
            (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'prescribed-medication'))) {
        (_c = data.medications) === null || _c === void 0 ? void 0 : _c.push(makeMedicationDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'MedicationStatement' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'in-house-medication') &&
        // Chart data doesn't return cancelled orders. There is a separate endpoint that returns them (get-medication-orders)
        resource.status !== 'entered-in-error') {
        (_d = data.inhouseMedications) === null || _d === void 0 ? void 0 : _d.push(makeMedicationDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'MedicationRequest' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, utils_1.ERX_MEDICATION_META_TAG_CODE)) {
        (_e = data.prescribedMedications) === null || _e === void 0 ? void 0 : _e.push(makePrescribedMedicationDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Procedure' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'surgical-history')) {
        var cptDto = makeCPTCodeDTO(resource);
        if (cptDto)
            (_f = data.surgicalHistory) === null || _f === void 0 ? void 0 : _f.push(cptDto);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Procedure' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'surgical-history-note')) {
        logDuplicationWarning(data.surgicalHistoryNote, 'chart-data duplication warning: "surgicalHistoryNote" already exists');
        data.surgicalHistoryNote = makeFreeTextNoteDTO(resource);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Observation' &&
        (0, exports.chartDataResourceHasMetaTagBySystem)(resource, "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.ADDITIONAL_QUESTIONS_META_SYSTEM))) {
        var resourceDto = makeObservationDTO(resource);
        // TODO check edge cases if resource is null
        if (resourceDto)
            (_g = data.observations) === null || _g === void 0 ? void 0 : _g.push(resourceDto);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Observation' &&
        (0, exports.chartDataResourceHasMetaTagBySystem)(resource, "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.EXAM_OBSERVATION_META_SYSTEM))) {
        (_h = data.examObservations) === null || _h === void 0 ? void 0 : _h.push(makeExamObservationDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Observation' &&
        (0, exports.chartDataResourceHasMetaTagBySystem)(resource, "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.PATIENT_VITALS_META_SYSTEM))) {
        var dto = (0, utils_1.makeVitalsObservationDTO)(resource);
        if (dto)
            (_j = data.vitalsObservations) === null || _j === void 0 ? void 0 : _j.push(dto);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Observation' &&
        (0, exports.chartDataResourceHasMetaTagBySystem)(resource, "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/birth-history"))) {
        (_k = data.birthHistory) === null || _k === void 0 ? void 0 : _k.push(makeBirthHistoryDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Procedure' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'cpt-code') &&
        resourceReferencesEncounter(resource, encounterId)) {
        var cptDto = makeCPTCodeDTO(resource);
        if (cptDto)
            (_l = data.cptCodes) === null || _l === void 0 ? void 0 : _l.push(cptDto);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Procedure' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'em-code') &&
        resourceReferencesEncounter(resource, encounterId)) {
        var cptDto = makeCPTCodeDTO(resource);
        if (cptDto) {
            logDuplicationWarning(data.emCode, 'chart-data duplication warning: "emCode" already exists');
            data.emCode = cptDto;
        }
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'ClinicalImpression' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'medical-decision')) {
        logDuplicationWarning(data.medicalDecision, 'chart-data duplication warning: "medicalDecision" already exists');
        data.medicalDecision = makeClinicalImpressionDTO(resource);
        resourceMapped = true;
    }
    else if (resource.resourceType === 'Communication' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'patient-instruction')) {
        (_m = data.instructions) === null || _m === void 0 ? void 0 : _m.push(makeCommunicationDTO(resource));
        resourceMapped = true;
    }
    else if (resource.resourceType === 'Communication' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, utils_1.IN_PERSON_NOTE_ID)) {
        (_o = data.notes) === null || _o === void 0 ? void 0 : _o.push(makeNoteDTO(resource));
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'EpisodeOfCare' &&
        (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'hospitalization')) {
        var hospitalizationDTO = makeHospitalizationDTO(resource);
        if (hospitalizationDTO)
            (_p = data.episodeOfCare) === null || _p === void 0 ? void 0 : _p.push(hospitalizationDTO);
        resourceMapped = true;
    }
    else if ((resource === null || resource === void 0 ? void 0 : resource.resourceType) === 'Observation' &&
        (0, exports.chartDataResourceHasMetaTagBySystem)(resource, "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.AI_OBSERVATION_META_SYSTEM))) {
        var resourceDto = makeObservationDTO(resource);
        if (resourceDto)
            (_q = data.observations) === null || _q === void 0 ? void 0 : _q.push(resourceDto);
        resourceMapped = true;
    }
    else if (resource.resourceType === 'DocumentReference' &&
        ((_s = (_r = resource.type) === null || _r === void 0 ? void 0 : _r.coding) === null || _s === void 0 ? void 0 : _s[0].code) === utils_1.VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.code) {
        (_t = data.aiChat) === null || _t === void 0 ? void 0 : _t.documents.push(resource);
        resourceMapped = true;
    }
    return {
        chartDataFields: data,
        resourceMapped: resourceMapped,
    };
};
function mapResourceToChartDataResponse(chartDataResponse, resource, encounterId) {
    var _a, _b;
    var resourceMapped = false;
    var updatedResponseData = mapResourceToChartDataFields(chartDataResponse, resource, encounterId);
    chartDataResponse = updatedResponseData.chartDataFields;
    resourceMapped = updatedResponseData.resourceMapped;
    if (resource.resourceType === 'DocumentReference' && (0, exports.chartDataResourceHasMetaTagByCode)(resource, utils_1.SCHOOL_WORK_NOTE)) {
        var dto_1 = makeSchoolWorkNoteDTO(resource);
        var alreadyExists = (_a = chartDataResponse.schoolWorkNotes) === null || _a === void 0 ? void 0 : _a.some(function (note) { return note.id === dto_1.id; });
        if (!alreadyExists) {
            (_b = chartDataResponse.schoolWorkNotes) === null || _b === void 0 ? void 0 : _b.push(dto_1);
        }
        resourceMapped = true;
    }
    return {
        chartDataResponse: chartDataResponse,
        resourceMapped: resourceMapped,
    };
}
function handleCustomDTOExtractions(data, resources) {
    var _a, _b, _c, _d;
    var encounterResource = resources.find(function (res) { return res.resourceType === 'Encounter'; });
    if (!encounterResource)
        return data;
    // 1. Getting DispositionDTO
    var serviceRequests = resources.filter(function (res) { return res.resourceType === 'ServiceRequest'; });
    data.disposition = makeDispositionDTOFromFhirResources(encounterResource, serviceRequests);
    // 2. Getting DiagnosisDTO
    (_a = encounterResource.diagnosis) === null || _a === void 0 ? void 0 : _a.forEach(function (encounterDiagnosis) {
        var _a, _b;
        var conditionId = (0, helpers_1.removePrefix)('Condition/', encounterDiagnosis.condition.reference || '');
        var isPrimary = ((_a = encounterDiagnosis.rank) !== null && _a !== void 0 ? _a : 0) === 1;
        if (conditionId) {
            var conditionResource = resources.find(function (element) { return element.id === conditionId; });
            if (conditionResource)
                (_b = data.diagnosis) === null || _b === void 0 ? void 0 : _b.push(makeDiagnosisDTO(conditionResource, isPrimary));
        }
    });
    // 3. Getting PatientInfoConfirmed
    var patientInfoConfirmed = (_b = encounterResource.extension) === null || _b === void 0 ? void 0 : _b.find(function (extension) { return extension.url === 'patient-info-confirmed'; });
    if (patientInfoConfirmed) {
        data.patientInfoConfirmed = { value: patientInfoConfirmed.valueBoolean };
    }
    else {
        data.patientInfoConfirmed = { value: false };
    }
    // 4. Getting AddToVisitNote
    var addToVisitNote = (_c = encounterResource.extension) === null || _c === void 0 ? void 0 : _c.find(function (extension) { return extension.url === 'add-to-visit-note'; });
    if (addToVisitNote) {
        data.addToVisitNote = { value: addToVisitNote.valueBoolean };
    }
    // 5. Getting AddendumNote
    var addendumNote = (_d = encounterResource.extension) === null || _d === void 0 ? void 0 : _d.find(function (extension) { return extension.url === 'addendum-note'; });
    if (addendumNote) {
        data.addendumNote = { text: addendumNote.valueString };
    }
    // 6. AI potential diagnoses
    resources
        .filter(function (resource) {
        var _a, _b;
        return resource.resourceType === 'Condition' &&
            ((_b = (_a = resource.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b[0].code) === 'ai-potential-diagnosis' &&
            encounterResource.id !== undefined &&
            resourceReferencesEncounter(resource, encounterResource.id);
    })
        .forEach(function (condition) {
        var _a;
        (_a = data.aiPotentialDiagnosis) === null || _a === void 0 ? void 0 : _a.push(makeDiagnosisDTO(condition, false));
    });
    // 7. Procedures
    data.procedures = makeProceduresDTOFromFhirResources(encounterResource, resources);
    return data;
}
var createDispositionServiceRequest = function (_a) {
    var _b;
    var _c, _d, _e, _f, _g;
    var disposition = _a.disposition, encounterId = _a.encounterId, followUpId = _a.followUpId, patientId = _a.patientId;
    var orderDetail = undefined;
    var dispositionFollowUpCode = (0, utils_1.createCodeableConcept)([
        {
            system: 'http://snomed.info/sct',
            code: '185389009',
            display: 'Follow-up visit (procedure)',
        },
    ], 'Follow-up visit (procedure)');
    if (disposition.type === 'ip-lab') {
        dispositionFollowUpCode = (0, utils_1.createCodeableConcept)([
            {
                system: 'http://snomed.info/sct',
                code: '15220000',
                display: 'Laboratory test (procedure)',
            },
        ], 'Laboratory test (procedure)');
        orderDetail = [];
        (_d = (_c = disposition === null || disposition === void 0 ? void 0 : disposition.labService) === null || _c === void 0 ? void 0 : _c.forEach) === null || _d === void 0 ? void 0 : _d.call(_c, function (service) {
            var _a;
            (_a = orderDetail === null || orderDetail === void 0 ? void 0 : orderDetail.push) === null || _a === void 0 ? void 0 : _a.call(orderDetail, (0, utils_1.createCodeableConcept)([
                {
                    code: service,
                    system: 'lab-service', // TODO phony Coding system
                },
            ]));
        });
        (_f = (_e = disposition === null || disposition === void 0 ? void 0 : disposition.virusTest) === null || _e === void 0 ? void 0 : _e.forEach) === null || _f === void 0 ? void 0 : _f.call(_e, function (test) {
            var _a;
            (_a = orderDetail === null || orderDetail === void 0 ? void 0 : orderDetail.push) === null || _a === void 0 ? void 0 : _a.call(orderDetail, (0, utils_1.createCodeableConcept)([
                {
                    code: test,
                    system: 'virus-test', // TODO phony Coding system
                },
            ]));
        });
    }
    if (disposition.type === 'another' && disposition.reason) {
        orderDetail = [];
        (_g = orderDetail === null || orderDetail === void 0 ? void 0 : orderDetail.push) === null || _g === void 0 ? void 0 : _g.call(orderDetail, (0, utils_1.createCodeableConcept)([
            {
                code: disposition.reason,
                system: 'reason-for-transfer', // TODO phony Coding system
            },
        ]));
    }
    var followUpDaysInMinutes = typeof disposition.followUpIn === 'number' ? disposition.followUpIn * 1440 : undefined;
    return (0, resources_helpers_1.saveOrUpdateResourceRequest)(makeServiceRequestResource((_b = {
            resourceId: followUpId,
            encounterId: encounterId,
            patientId: patientId,
            metaName: 'disposition-follow-up',
            code: dispositionFollowUpCode,
            followUpIn: followUpDaysInMinutes,
            orderDetail: orderDetail
        },
        _b[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD] = disposition[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD],
        _b)));
};
exports.createDispositionServiceRequest = createDispositionServiceRequest;
exports.followUpToPerformerMap = {
    dentistry: (0, utils_1.createCodeableConcept)([
        {
            code: '106289002',
            display: 'Dentist',
            system: 'http://snomed.info/sct',
        },
    ]),
    ent: (0, utils_1.createCodeableConcept)([
        {
            code: '309372007',
            display: 'Ear, nose and throat surgeon',
            system: 'http://snomed.info/sct',
        },
    ]),
    ophthalmology: (0, utils_1.createCodeableConcept)([
        {
            code: '422234006',
            display: 'Ophthalmologist (occupation)',
            system: 'http://snomed.info/sct',
        },
    ]),
    orthopedics: (0, utils_1.createCodeableConcept)([
        {
            code: '59169001',
            display: 'Orthopedic technician',
            system: 'http://snomed.info/sct',
        },
    ]),
    'lurie-ct': (0, utils_1.createCodeableConcept)(undefined, 'lurie-ct'),
    other: (0, utils_1.createCodeableConcept)(undefined, 'other'),
};
function makeProceduresDTOFromFhirResources(encounter, resources) {
    var _a;
    var proceduresServiceRequests = resources.filter(function (res) {
        return res.resourceType === 'ServiceRequest' &&
            (0, exports.chartDataResourceHasMetaTagByCode)(res, 'procedure') &&
            // Filter out deleted procedures for backward compatibility
            res.status !== 'entered-in-error' &&
            res.status !== 'revoked';
    });
    if (proceduresServiceRequests.length === 0) {
        return undefined;
    }
    var cptCodeProcedures = resources.filter(function (resource) { return resource.resourceType === 'Procedure' && (0, exports.chartDataResourceHasMetaTagByCode)(resource, 'cpt-code'); });
    var diagnosisConditions = ((_a = encounter.diagnosis) !== null && _a !== void 0 ? _a : []).flatMap(function (encounterDiagnosis) {
        var conditionId = (0, helpers_1.removePrefix)('Condition/', encounterDiagnosis.condition.reference || '');
        var condition = resources.find(function (resource) { return resource.id === conditionId; });
        if (condition) {
            return [condition];
        }
        return [];
    });
    return proceduresServiceRequests.map(function (serviceRequests) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        return {
            resourceId: serviceRequests.id,
            procedureType: getCode(serviceRequests.category, utils_1.PROCEDURE_TYPE_SYSTEM),
            cptCodes: cptCodeProcedures
                .filter(function (procedure) { var _a; return (_a = serviceRequests.supportingInfo) === null || _a === void 0 ? void 0 : _a.find(function (ref) { return ref.reference === "Procedure/".concat(procedure.id); }); })
                .flatMap(function (procedure) {
                var cptDto = makeCPTCodeDTO(procedure);
                if (cptDto != null) {
                    return [cptDto];
                }
                return [];
            }),
            diagnoses: diagnosisConditions
                .filter(function (condition) { var _a; return (_a = serviceRequests.reasonReference) === null || _a === void 0 ? void 0 : _a.find(function (ref) { return ref.reference === "Condition/".concat(condition.id); }); })
                .map(function (condition) {
                return makeDiagnosisDTO(condition, false);
            }),
            procedureDateTime: serviceRequests.occurrenceDateTime,
            documentedDateTime: serviceRequests.authoredOn,
            performerType: getCode(serviceRequests.performerType, utils_1.PERFORMER_TYPE_SYSTEM),
            medicationUsed: (_a = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.medicationUsed.url)) === null || _a === void 0 ? void 0 : _a.valueString,
            bodySite: getCode(serviceRequests.bodySite, utils_1.BODY_SITE_SYSTEM),
            bodySide: (_b = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.bodySide.url)) === null || _b === void 0 ? void 0 : _b.valueString,
            technique: (_c = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.technique.url)) === null || _c === void 0 ? void 0 : _c.valueString,
            suppliesUsed: (_d = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.suppliesUsed.url)) === null || _d === void 0 ? void 0 : _d.valueString,
            procedureDetails: (_e = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.procedureDetails.url)) === null || _e === void 0 ? void 0 : _e.valueString,
            specimenSent: (_f = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.specimenSent.url)) === null || _f === void 0 ? void 0 : _f.valueBoolean,
            complications: (_g = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.complications.url)) === null || _g === void 0 ? void 0 : _g.valueString,
            patientResponse: (_h = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.patientResponse.url)) === null || _h === void 0 ? void 0 : _h.valueString,
            postInstructions: (_j = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.postInstructions.url)) === null || _j === void 0 ? void 0 : _j.valueString,
            timeSpent: (_k = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.timeSpent.url)) === null || _k === void 0 ? void 0 : _k.valueString,
            documentedBy: (_l = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.documentedBy.url)) === null || _l === void 0 ? void 0 : _l.valueString,
            consentObtained: (_m = getExtension(serviceRequests, utils_1.FHIR_EXTENSION.ServiceRequest.consentObtained.url)) === null || _m === void 0 ? void 0 : _m.valueBoolean,
        };
    });
}
var createProcedureServiceRequest = function (procedure, encounterId, patientId) {
    var _a, _b, _c, _d;
    var extensions = [
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.medicationUsed.url,
            valueString: procedure.medicationUsed,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.bodySide.url,
            valueString: procedure.bodySide,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.technique.url,
            valueString: procedure.technique,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.suppliesUsed.url,
            valueString: procedure.suppliesUsed,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.procedureDetails.url,
            valueString: procedure.procedureDetails,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.specimenSent.url,
            valueBoolean: procedure.specimenSent,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.complications.url,
            valueString: procedure.complications,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.patientResponse.url,
            valueString: procedure.patientResponse,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.postInstructions.url,
            valueString: procedure.postInstructions,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.timeSpent.url,
            valueString: procedure.timeSpent,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.documentedBy.url,
            valueString: procedure.documentedBy,
        },
        {
            url: utils_1.FHIR_EXTENSION.ServiceRequest.consentObtained.url,
            valueBoolean: procedure.consentObtained,
        },
    ].filter(function (extension) { return extension.valueString != null || extension.valueBoolean != null; });
    var diagnosesReferences = (_a = procedure.diagnoses) === null || _a === void 0 ? void 0 : _a.map(function (diagnosis) {
        return {
            reference: 'Condition/' + diagnosis.resourceId,
        };
    });
    var cptCodesReferences = (_b = procedure.cptCodes) === null || _b === void 0 ? void 0 : _b.map(function (cptCode) {
        return {
            reference: 'Procedure/' + cptCode.resourceId,
        };
    });
    return (0, resources_helpers_1.saveOrUpdateResourceRequest)({
        resourceType: 'ServiceRequest',
        id: procedure.resourceId,
        subject: { reference: "Patient/".concat(patientId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        status: 'completed',
        intent: 'original-order',
        category: procedure.procedureType != null
            ? [
                {
                    coding: [
                        {
                            system: utils_1.PROCEDURE_TYPE_SYSTEM,
                            code: procedure.procedureType,
                        },
                    ],
                },
            ]
            : undefined,
        occurrenceDateTime: procedure.procedureDateTime,
        authoredOn: procedure.documentedDateTime,
        performerType: procedure.performerType != null
            ? {
                coding: [
                    {
                        system: utils_1.PERFORMER_TYPE_SYSTEM,
                        code: procedure.performerType,
                    },
                ],
            }
            : undefined,
        bodySite: procedure.bodySite != null
            ? [
                {
                    coding: [
                        {
                            system: utils_1.BODY_SITE_SYSTEM,
                            code: procedure.bodySite,
                        },
                    ],
                },
            ]
            : undefined,
        meta: (0, helpers_2.fillMeta)('procedure', 'procedure'),
        reasonReference: ((_c = diagnosesReferences === null || diagnosesReferences === void 0 ? void 0 : diagnosesReferences.length) !== null && _c !== void 0 ? _c : 0) > 0 ? diagnosesReferences : undefined,
        supportingInfo: ((_d = cptCodesReferences === null || cptCodesReferences === void 0 ? void 0 : cptCodesReferences.length) !== null && _d !== void 0 ? _d : 0) > 0 ? cptCodesReferences : undefined,
        extension: extensions.length > 0 ? extensions : undefined,
    });
};
exports.createProcedureServiceRequest = createProcedureServiceRequest;
function getCode(codeableConcept, system) {
    var _a, _b;
    var array = Array.isArray(codeableConcept) ? codeableConcept : [codeableConcept];
    for (var _i = 0, array_1 = array; _i < array_1.length; _i++) {
        var codeableConcept_1 = array_1[_i];
        var code = (_b = (_a = codeableConcept_1 === null || codeableConcept_1 === void 0 ? void 0 : codeableConcept_1.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === system; })) === null || _b === void 0 ? void 0 : _b.code;
        if (code != null) {
            return code;
        }
    }
    return undefined;
}
function getExtension(resource, url) {
    var _a;
    return (_a = resource.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url === url; });
}
function getMedicationDosage(medication, medicationType) {
    var _a, _b, _c;
    if (medicationType === 'in-house-medication') {
        var doseQuantity = (_b = (_a = medication.dosage) === null || _a === void 0 ? void 0 : _a[0].doseAndRate) === null || _b === void 0 ? void 0 : _b[0].doseQuantity;
        if (!(doseQuantity === null || doseQuantity === void 0 ? void 0 : doseQuantity.value) || !(doseQuantity === null || doseQuantity === void 0 ? void 0 : doseQuantity.unit)) {
            return undefined;
        }
        return "".concat(doseQuantity.value, " ").concat(doseQuantity.unit);
    }
    return (_c = medication.dosage) === null || _c === void 0 ? void 0 : _c[0].text;
}
function makeEncounterTaskResource(encounterId, coding) {
    return {
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: { reference: "Encounter/".concat(encounterId) },
        encounter: { reference: "Encounter/".concat(encounterId) },
        code: {
            coding: [coding],
        },
    };
}

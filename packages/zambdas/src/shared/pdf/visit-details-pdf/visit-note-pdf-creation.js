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
exports.composeAndCreateVisitNotePdf = composeAndCreateVisitNotePdf;
exports.getPatientLastFirstName = getPatientLastFirstName;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var mappers_1 = require("../helpers/mappers");
var visit_note_pdf_1 = require("../visit-note-pdf");
function composeAndCreateVisitNotePdf(allChartData, appointmentPackage, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var isInPerson, data;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    isInPerson = (0, utils_1.isInPersonAppointment)(appointmentPackage.appointment);
                    console.log('Start composing data for pdf');
                    data = composeDataForPdf(allChartData, appointmentPackage, isInPerson);
                    console.log('Start creating pdf');
                    return [4 /*yield*/, (0, visit_note_pdf_1.createVisitNotePDF)(data, appointmentPackage.patient, secrets, token, isInPerson, appointmentPackage.encounter)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function composeDataForPdf(allChartData, appointmentPackage, isInPersonAppointment) {
    var _a;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31;
    var chartData = allChartData.chartData, additionalChartData = allChartData.additionalChartData, medicationOrders = allChartData.medicationOrders, immunizationOrders = allChartData.immunizationOrders, externalLabsData = allChartData.externalLabsData, inHouseOrdersData = allChartData.inHouseOrdersData;
    var patient = appointmentPackage.patient, encounter = appointmentPackage.encounter, mainEncounter = appointmentPackage.mainEncounter, appointment = appointmentPackage.appointment, location = appointmentPackage.location, questionnaireResponse = appointmentPackage.questionnaireResponse, practitioners = appointmentPackage.practitioners, timezone = appointmentPackage.timezone;
    if (!patient)
        throw new Error('No patient found for this encounter');
    // if (!practitioner) throw new Error('No practitioner found for this encounter'); // TODO: fix that
    // --- Patient information ---
    var patientName = getPatientLastFirstName(patient);
    var patientDOB = getPatientDob(patient);
    var personAccompanying = getPersonAccompanying(questionnaireResponse);
    var patientPhone = (_c = (_b = (0, utils_1.getQuestionnaireResponseByLinkId)('guardian-number', questionnaireResponse)) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0].valueString;
    // --- Visit details ---
    var _32 = getStatusRelatedDates(mainEncounter !== null && mainEncounter !== void 0 ? mainEncounter : encounter, appointment, timezone), dateOfService = _32.dateOfService, signedOnDate = _32.signedOnDate;
    var reasonForVisit = appointment === null || appointment === void 0 ? void 0 : appointment.description;
    var providerName;
    var intakePersonName = undefined;
    if (isInPersonAppointment) {
        var admitterId_1 = (0, utils_1.getAdmitterPractitionerId)(encounter);
        var admitterPractitioner = (_d = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.practitioners) === null || _d === void 0 ? void 0 : _d.find(function (practitioner) { return practitioner.id === admitterId_1; });
        intakePersonName = admitterPractitioner && (0, utils_1.getProviderNameWithProfession)(admitterPractitioner);
        var attenderId_1 = (0, utils_1.getAttendingPractitionerId)(encounter);
        var attenderPractitioner = (_e = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.practitioners) === null || _e === void 0 ? void 0 : _e.find(function (practitioner) { return practitioner.id === attenderId_1; });
        providerName = (_f = (attenderPractitioner && (0, utils_1.getProviderNameWithProfession)(attenderPractitioner))) !== null && _f !== void 0 ? _f : '';
    }
    else {
        providerName = (practitioners === null || practitioners === void 0 ? void 0 : practitioners[0]) ? (0, utils_1.getProviderNameWithProfession)(practitioners[0]) : '';
    }
    var visitID = appointment.id;
    var visitState = (_g = location === null || location === void 0 ? void 0 : location.address) === null || _g === void 0 ? void 0 : _g.state;
    var address = (_j = (_h = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address', questionnaireResponse)) === null || _h === void 0 ? void 0 : _h.answer) === null || _j === void 0 ? void 0 : _j[0].valueString;
    var insuranceCompany = (_k = appointmentPackage.insurancePlan) === null || _k === void 0 ? void 0 : _k.name;
    var subscriberID = (_m = (_l = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-member-id', questionnaireResponse)) === null || _l === void 0 ? void 0 : _l.answer) === null || _m === void 0 ? void 0 : _m[0].valueString;
    // --- Chief complaint ---
    var chiefComplaint = (_o = chartData.chiefComplaint) === null || _o === void 0 ? void 0 : _o.text;
    var spentTime = ((_p = chartData.addToVisitNote) === null || _p === void 0 ? void 0 : _p.value) ? (0, utils_1.getSpentTime)(encounter.statusHistory) : undefined;
    // --- Mechanism of injury ---
    var mechanismOfInjury = (_q = chartData.mechanismOfInjury) === null || _q === void 0 ? void 0 : _q.text;
    // --- Review of system ---
    var reviewOfSystems = (_r = chartData.ros) === null || _r === void 0 ? void 0 : _r.text;
    // --- Medications ---
    var medications = chartData.medications ? mapResourceByNameField(chartData.medications) : [];
    var medicationsNotes = (_t = (_s = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _s === void 0 ? void 0 : _s.filter(function (note) { return note.type === utils_1.NOTE_TYPE.INTAKE_MEDICATION; })) === null || _t === void 0 ? void 0 : _t.map(function (note) { return note.text; });
    // --- Allergies ---
    var allergies = chartData.allergies
        ? mapResourceByNameField((_u = chartData === null || chartData === void 0 ? void 0 : chartData.allergies) === null || _u === void 0 ? void 0 : _u.filter(function (allergy) { return allergy.current === true; }))
        : [];
    var allergiesNotes = (_w = (_v = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _v === void 0 ? void 0 : _v.filter(function (note) { return note.type === utils_1.NOTE_TYPE.ALLERGY; })) === null || _w === void 0 ? void 0 : _w.map(function (note) { return note.text; });
    // --- Medical conditions ---
    var medicalConditions = mapMedicalConditions(chartData);
    var medicalConditionsNotes = (_y = (_x = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _x === void 0 ? void 0 : _x.filter(function (note) { return note.type === utils_1.NOTE_TYPE.MEDICAL_CONDITION; })) === null || _y === void 0 ? void 0 : _y.map(function (note) { return note.text; });
    // --- Surgical history ---
    var surgicalHistory = chartData.surgicalHistory ? mapResourceByNameField(chartData.surgicalHistory) : []; // surgical history
    var surgicalHistoryNotes = isInPersonAppointment
        ? (_0 = (_z = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _z === void 0 ? void 0 : _z.filter(function (note) { return note.type === utils_1.NOTE_TYPE.SURGICAL_HISTORY; })) === null || _0 === void 0 ? void 0 : _0.map(function (note) { return note.text; })
        : ((_1 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.surgicalHistoryNote) === null || _1 === void 0 ? void 0 : _1.text)
            ? [(_2 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.surgicalHistoryNote) === null || _2 === void 0 ? void 0 : _2.text]
            : undefined;
    // --- In-House Medications ---
    var inHouseMedications = medicationOrders === null || medicationOrders === void 0 ? void 0 : medicationOrders.filter(function (order) { return !(0, utils_1.isDeletedMedicationOrder)(order); }).map(function (order) { return (0, utils_1.createMedicationString)(order); });
    var inHouseMedicationsNotes = (_4 = (_3 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _3 === void 0 ? void 0 : _3.filter(function (note) { return note.type === utils_1.NOTE_TYPE.MEDICATION; })) === null || _4 === void 0 ? void 0 : _4.map(function (note) { return note.text; });
    // --- Immunization orders ---
    var immunizationOrdersToRender = (immunizationOrders !== null && immunizationOrders !== void 0 ? immunizationOrders : [])
        .filter(function (order) { return ['administered', 'administered-partly'].includes(order.status); })
        .map(immunizationOrderToString);
    // --- In-House Labs ---
    var inHouseLabResults = (_6 = (_5 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.inHouseLabResults) === null || _5 === void 0 ? void 0 : _5.labOrderResults) !== null && _6 !== void 0 ? _6 : [];
    var inHouseLabOrders = ((_7 = inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.serviceRequests) === null || _7 === void 0 ? void 0 : _7.length)
        ? (0, mappers_1.mapResourcesToInHouseLabOrders)((0, utils_1.filterNotDeletedServiceRequests)(inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.serviceRequests), inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.activityDefinitions, inHouseOrdersData === null || inHouseOrdersData === void 0 ? void 0 : inHouseOrdersData.observations)
        : [];
    // --- External Labs ---
    var externalLabResults = (_9 = (_8 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.externalLabResults) === null || _8 === void 0 ? void 0 : _8.labOrderResults) !== null && _9 !== void 0 ? _9 : [];
    var externalLabOrders = ((_10 = externalLabsData === null || externalLabsData === void 0 ? void 0 : externalLabsData.serviceRequests) === null || _10 === void 0 ? void 0 : _10.length)
        ? (0, mappers_1.mapResourcesToExternalLabOrders)(externalLabsData === null || externalLabsData === void 0 ? void 0 : externalLabsData.serviceRequests)
        : [];
    // --- Addition questions ---
    var additionalQuestions = {};
    // Add ALL fields from config (if they have values)
    utils_1.patientScreeningQuestionsConfig.fields.forEach(function (field) {
        var _a;
        var observation = (_a = chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (obs) { return obs.field === field.fhirField; });
        if ((observation === null || observation === void 0 ? void 0 : observation.value) !== undefined) {
            additionalQuestions[field.fhirField] = observation;
        }
    });
    var currentASQObs = (_11 = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _11 === void 0 ? void 0 : _11.find(function (obs) { return obs.field === utils_1.ASQ_FIELD; });
    var currentASQ = currentASQObs && utils_1.asqLabels[currentASQObs.value];
    var screeningNotes = (_13 = (_12 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _12 === void 0 ? void 0 : _12.filter(function (note) { return note.type === utils_1.NOTE_TYPE.SCREENING; })) === null || _13 === void 0 ? void 0 : _13.map(function (note) { return note.text; });
    // --- Hospitalization ---
    var hospitalization = (additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.episodeOfCare) && mapResourceByNameField(additionalChartData.episodeOfCare);
    var hospitalizationNotes = (_15 = (_14 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _14 === void 0 ? void 0 : _14.filter(function (note) { return note.type === utils_1.NOTE_TYPE.HOSPITALIZATION; })) === null || _15 === void 0 ? void 0 : _15.map(function (note) { return note.text; });
    // --- Vitals ---
    var vitals = (additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.vitalsObservations)
        ? (0, utils_1.mapVitalsToDisplay)(additionalChartData.vitalsObservations, true, timezone)
        : undefined;
    var vitalsNotes = (_17 = (_16 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _16 === void 0 ? void 0 : _16.filter(function (note) { return note.type === utils_1.NOTE_TYPE.VITALS; })) === null || _17 === void 0 ? void 0 : _17.map(function (note) { return note.text; });
    // --- Intake notes ---
    var intakeNotes = (_19 = (_18 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _18 === void 0 ? void 0 : _18.filter(function (note) { return note.type === utils_1.NOTE_TYPE.INTAKE; })) === null || _19 === void 0 ? void 0 : _19.map(function (note) { return note.text; });
    // --- Examination ---
    var examination = parseExamFieldsFromExamObservations(chartData, isInPersonAppointment);
    // --- Assessment ---
    var diagnoses = (chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) || [];
    var primaryDiagnosis = (_20 = diagnoses.find(function (item) { return item.isPrimary; })) === null || _20 === void 0 ? void 0 : _20.display;
    var otherDiagnoses = diagnoses.filter(function (item) { return !item.isPrimary; }).map(function (item) { return item.display; });
    // --- MDM ---
    var medicalDecision = (_21 = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.medicalDecision) === null || _21 === void 0 ? void 0 : _21.text;
    // --- E&M ---
    var emCode = (_22 = chartData === null || chartData === void 0 ? void 0 : chartData.emCode) === null || _22 === void 0 ? void 0 : _22.display;
    // --- CPT ---
    var cptCodes = (_23 = chartData === null || chartData === void 0 ? void 0 : chartData.cptCodes) === null || _23 === void 0 ? void 0 : _23.map(function (cpt) { return "".concat(cpt.code, " ").concat(cpt.display); });
    // --- Prescriptions ---
    var prescriptions = (additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.prescribedMedications)
        ? mapResourceByNameField(additionalChartData.prescribedMedications)
        : [];
    // --- Patient instructions ---
    var patientInstructions = [];
    (_24 = chartData === null || chartData === void 0 ? void 0 : chartData.instructions) === null || _24 === void 0 ? void 0 : _24.forEach(function (item) {
        if (item.text)
            patientInstructions.push(item.text);
    });
    // --- General patient education documents ---
    // to be implemented
    // --- Ottehr patient education materials ---
    // to be implemented
    // --- Discharge instructions ---
    var disposition = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.disposition;
    var dispositionHeader = 'Disposition - ';
    var dispositionText = '';
    if (disposition === null || disposition === void 0 ? void 0 : disposition.type) {
        dispositionHeader += utils_1.mapDispositionTypeToLabel[disposition.type];
        dispositionText = disposition.note || (0, utils_1.getDefaultNote)(disposition.type);
    }
    var labService = (_25 = disposition === null || disposition === void 0 ? void 0 : disposition.labService) === null || _25 === void 0 ? void 0 : _25.join(', ');
    var virusTest = (_26 = disposition === null || disposition === void 0 ? void 0 : disposition.virusTest) === null || _26 === void 0 ? void 0 : _26.join(', ');
    var followUpIn = typeof (disposition === null || disposition === void 0 ? void 0 : disposition.followUpIn) === 'number' ? disposition.followUpIn : undefined;
    var reason = disposition === null || disposition === void 0 ? void 0 : disposition.reason;
    // --- Subspecialty follow-up ---
    var subSpecialtyFollowUp = (_28 = (_27 = disposition === null || disposition === void 0 ? void 0 : disposition.followUp) === null || _27 === void 0 ? void 0 : _27.map(function (followUp) {
        var display = utils_1.dispositionCheckboxOptions.find(function (option) { return option.name === followUp.type; }).label;
        var note = '';
        if (followUp.type === 'other')
            note = ": ".concat(followUp.note);
        return "".concat(display, " ").concat(note);
    })) !== null && _28 !== void 0 ? _28 : [];
    // --- Work-school excuse ---
    var workSchoolExcuse = [];
    (_29 = chartData.schoolWorkNotes) === null || _29 === void 0 ? void 0 : _29.forEach(function (ws) {
        if (ws.type === 'school')
            workSchoolExcuse.push("There was a school note generated");
        else
            workSchoolExcuse.push('There was a work note generated');
    });
    // --- Procedures ---
    var procedures = (_30 = chartData === null || chartData === void 0 ? void 0 : chartData.procedures) === null || _30 === void 0 ? void 0 : _30.map(function (procedure) {
        var _a, _b;
        return ({
            procedureType: procedure.procedureType,
            cptCodes: (_a = procedure === null || procedure === void 0 ? void 0 : procedure.cptCodes) === null || _a === void 0 ? void 0 : _a.map(function (cptCode) { return cptCode.code + ' ' + cptCode.display; }),
            diagnoses: (_b = procedure === null || procedure === void 0 ? void 0 : procedure.diagnoses) === null || _b === void 0 ? void 0 : _b.map(function (diagnosis) { return diagnosis.code + ' ' + diagnosis.display; }),
            procedureDateTime: procedure.procedureDateTime != null
                ? luxon_1.DateTime.fromISO(procedure.procedureDateTime).toFormat('MM/dd/yyyy, HH:mm a')
                : undefined,
            performerType: procedure.performerType,
            medicationUsed: procedure.medicationUsed,
            bodySite: procedure.bodySite,
            bodySide: procedure.bodySide,
            technique: procedure.technique,
            suppliesUsed: procedure.suppliesUsed,
            procedureDetails: procedure.procedureDetails,
            specimenSent: procedure.specimenSent != null ? (procedure.specimenSent ? 'Yes' : 'No') : undefined,
            complications: procedure.complications,
            patientResponse: procedure.patientResponse,
            postInstructions: procedure.postInstructions,
            timeSpent: procedure.timeSpent,
            documentedBy: procedure.documentedBy,
        });
    });
    var addendumNote = (_31 = chartData === null || chartData === void 0 ? void 0 : chartData.addendumNote) === null || _31 === void 0 ? void 0 : _31.text;
    return {
        patientName: patientName !== null && patientName !== void 0 ? patientName : '',
        patientDOB: patientDOB !== null && patientDOB !== void 0 ? patientDOB : '',
        personAccompanying: personAccompanying !== null && personAccompanying !== void 0 ? personAccompanying : '',
        patientPhone: patientPhone !== null && patientPhone !== void 0 ? patientPhone : '',
        dateOfService: dateOfService !== null && dateOfService !== void 0 ? dateOfService : '',
        reasonForVisit: reasonForVisit !== null && reasonForVisit !== void 0 ? reasonForVisit : '',
        provider: providerName !== null && providerName !== void 0 ? providerName : '',
        intakePerson: intakePersonName !== null && intakePersonName !== void 0 ? intakePersonName : '',
        signedOn: signedOnDate !== null && signedOnDate !== void 0 ? signedOnDate : '',
        visitID: visitID !== null && visitID !== void 0 ? visitID : '',
        visitState: visitState !== null && visitState !== void 0 ? visitState : '',
        insuranceCompany: insuranceCompany,
        insuranceSubscriberId: subscriberID,
        address: address !== null && address !== void 0 ? address : '',
        chiefComplaint: chiefComplaint,
        mechanismOfInjury: mechanismOfInjury,
        providerTimeSpan: spentTime,
        reviewOfSystems: reviewOfSystems,
        medications: medications,
        medicationsNotes: medicationsNotes,
        allergies: allergies,
        allergiesNotes: allergiesNotes,
        medicalConditions: medicalConditions,
        medicalConditionsNotes: medicalConditionsNotes,
        surgicalHistory: surgicalHistory,
        surgicalHistoryNotes: surgicalHistoryNotes,
        inHouseMedications: inHouseMedications,
        inHouseMedicationsNotes: inHouseMedicationsNotes,
        immunizationOrders: immunizationOrdersToRender,
        inHouseLabs: {
            orders: inHouseLabOrders,
            results: inHouseLabResults,
        },
        externalLabs: {
            orders: externalLabOrders,
            results: externalLabResults,
        },
        screening: {
            additionalQuestions: additionalQuestions,
            currentASQ: currentASQ,
            notes: screeningNotes,
        },
        hospitalization: hospitalization,
        hospitalizationNotes: hospitalizationNotes,
        vitals: __assign({ notes: vitalsNotes }, vitals),
        intakeNotes: intakeNotes,
        examination: examination.examination,
        assessment: {
            primary: primaryDiagnosis !== null && primaryDiagnosis !== void 0 ? primaryDiagnosis : '',
            secondary: otherDiagnoses,
        },
        medicalDecision: medicalDecision,
        cptCodes: cptCodes,
        emCode: emCode,
        prescriptions: prescriptions,
        patientInstructions: patientInstructions,
        disposition: (_a = {
                header: dispositionHeader,
                text: dispositionText !== null && dispositionText !== void 0 ? dispositionText : ''
            },
            _a[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD] = disposition === null || disposition === void 0 ? void 0 : disposition[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD],
            _a.labService = labService !== null && labService !== void 0 ? labService : '',
            _a.virusTest = virusTest !== null && virusTest !== void 0 ? virusTest : '',
            _a.followUpIn = followUpIn,
            _a.reason = reason,
            _a),
        subSpecialtyFollowUp: subSpecialtyFollowUp,
        workSchoolExcuse: workSchoolExcuse,
        procedures: procedures,
        addendumNote: addendumNote,
    };
}
function getPatientLastFirstName(patient) {
    var _a, _b, _c;
    var name = patient.name;
    var firstName = (_b = (_a = name === null || name === void 0 ? void 0 : name[0]) === null || _a === void 0 ? void 0 : _a.given) === null || _b === void 0 ? void 0 : _b[0];
    var lastName = (_c = name === null || name === void 0 ? void 0 : name[0]) === null || _c === void 0 ? void 0 : _c.family;
    // const suffix = name?.[0]?.suffix?.[0];
    var isFullName = !!firstName && !!lastName;
    return isFullName ? "".concat(lastName, ", ").concat(firstName) : undefined;
    // const isFullName = !!firstName && !!lastName && !!suffix;
    // return isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
}
function getPatientDob(patient) {
    return (patient === null || patient === void 0 ? void 0 : patient.birthDate) && luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}
function getPersonAccompanying(questionnaireResponse) {
    var _a, _b, _c, _d, _e, _f;
    if (!questionnaireResponse)
        return;
    var personAccompanying = {
        firstName: (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('person-accompanying-minor-first-name', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString,
        lastName: (_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('person-accompanying-minor-last-name', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString,
    };
    if (!personAccompanying.lastName && !personAccompanying.lastName)
        return;
    return "".concat(personAccompanying.lastName, ", ").concat(personAccompanying.lastName);
}
function getStatusRelatedDates(encounter, appointment, timezone) {
    var _a;
    var statuses = encounter.statusHistory && (appointment === null || appointment === void 0 ? void 0 : appointment.status)
        ? (0, utils_1.getTelemedEncounterStatusHistory)(encounter.statusHistory, appointment.status)
        : undefined;
    var dateOfService = (0, utils_1.formatDateTimeToZone)((_a = statuses === null || statuses === void 0 ? void 0 : statuses.find(function (item) { return item.status === 'on-video'; })) === null || _a === void 0 ? void 0 : _a.start, timezone);
    var currentTimeISO = luxon_1.DateTime.now().toISO();
    var signedOnDate = (0, utils_1.formatDateTimeToZone)(currentTimeISO, timezone);
    return { dateOfService: dateOfService, signedOnDate: signedOnDate };
}
function mapResourceByNameField(data) {
    var result = [];
    data.forEach(function (element) {
        if ('name' in element && element.name) {
            result.push(element.name);
        }
        else if ('display' in element && element.display) {
            result.push(element.display);
        }
    });
    return result;
}
function mapMedicalConditions(chartData) {
    var _a;
    var medicalConditions = [];
    var conditions = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.conditions) === null || _a === void 0 ? void 0 : _a.filter(function (condition) { return condition.current === true; });
    conditions === null || conditions === void 0 ? void 0 : conditions.forEach(function (mc) {
        if (mc.display && mc.code)
            medicalConditions.push("".concat(mc.display, " ").concat(mc.code));
    });
    return medicalConditions;
}
function parseExamFieldsFromExamObservations(chartData, isInPersonAppointment) {
    var _a;
    var examObservations = {};
    (_a = chartData.examObservations) === null || _a === void 0 ? void 0 : _a.forEach(function (exam) {
        examObservations[exam.field] = exam;
    });
    // Get exam configuration based on whether it's in-person or telemed
    var examConfigComponents = utils_1.examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;
    // If no exam config or observations, return empty examination
    if (!examConfigComponents || !chartData.examObservations || chartData.examObservations.length === 0) {
        return {
            examination: {},
        };
    }
    var formatElementName = function (elementName) {
        return elementName
            .split('-')
            .map(function (word) {
            return word
                .replace(/([A-Z])/g, ' $1')
                .toLowerCase()
                .replace(/^./, function (str) { return str.toUpperCase(); })
                .trim();
        })
            .join(' | ');
    };
    var extractObservationsFromComponents = function (components, section) {
        var items = [];
        Object.entries(components).forEach(function (_a) {
            var fieldName = _a[0], component = _a[1];
            if (component.type === 'text')
                return;
            switch (component.type) {
                case 'checkbox': {
                    var observation = examObservations[fieldName];
                    if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                        items.push({
                            field: fieldName,
                            label: component.label,
                            abnormal: section === 'abnormal',
                        });
                    }
                    break;
                }
                case 'dropdown': {
                    if ((0, utils_1.isDropdownComponent)(component)) {
                        Object.entries(component.components).forEach(function (_a) {
                            var optionName = _a[0], option = _a[1];
                            var observation = examObservations[optionName];
                            if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                                items.push({
                                    field: optionName,
                                    label: "".concat(component.label, ": ").concat(option.label),
                                    abnormal: section === 'abnormal',
                                });
                            }
                        });
                    }
                    break;
                }
                case 'form': {
                    Object.entries(component.components).forEach(function (_a) {
                        var elementName = _a[0];
                        var observation = examObservations[elementName];
                        if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                            var formattedElementName = formatElementName(elementName);
                            var note = observation.note ? " | ".concat(observation.note) : '';
                            items.push({
                                field: elementName,
                                label: "".concat(component.label, ": ").concat(formattedElementName).concat(note),
                                abnormal: section === 'abnormal',
                            });
                        }
                    });
                    break;
                }
                case 'multi-select': {
                    if ((0, utils_1.isMultiSelectComponent)(component)) {
                        var selectedOptions_1 = [];
                        Object.entries(component.options).forEach(function (_a) {
                            var optionName = _a[0], option = _a[1];
                            var observation = examObservations[optionName];
                            if (observation && typeof observation.value === 'boolean' && observation.value === true) {
                                var description = option.description ? " (".concat(option.description, ")") : '';
                                selectedOptions_1.push({
                                    field: optionName,
                                    label: "".concat(component.label, ": ").concat(option.label).concat(description),
                                    abnormal: section === 'abnormal',
                                });
                            }
                        });
                        var observation = examObservations[fieldName];
                        if (observation && observation.value === true && selectedOptions_1.length === 0) {
                            items.push({
                                field: fieldName,
                                label: component.label,
                                abnormal: section === 'abnormal',
                            });
                        }
                        items.push.apply(items, selectedOptions_1);
                    }
                    break;
                }
                case 'column': {
                    var nestedItems = extractObservationsFromComponents(component.components, section);
                    var itemsWithColumnLabel = nestedItems.map(function (item) { return (__assign(__assign({}, item), { label: "".concat(component.label, ": ").concat(item.label) })); });
                    items.push.apply(items, itemsWithColumnLabel);
                    break;
                }
                default:
                    break;
            }
        });
        return items;
    };
    var examinationData = {};
    Object.entries(examConfigComponents).forEach(function (_a) {
        var sectionKey = _a[0], section = _a[1];
        var normalItems = extractObservationsFromComponents(section.components.normal, 'normal');
        var abnormalItems = extractObservationsFromComponents(section.components.abnormal, 'abnormal');
        var allItems = __spreadArray(__spreadArray([], normalItems, true), abnormalItems, true);
        var comment;
        Object.keys(section.components.comment).forEach(function (commentKey) {
            var observation = examObservations[commentKey];
            if (observation === null || observation === void 0 ? void 0 : observation.note) {
                comment = observation.note;
            }
        });
        examinationData[sectionKey] = {
            items: allItems,
            comment: comment,
        };
    });
    return {
        examination: examinationData,
    };
}
function immunizationOrderToString(order) {
    var _a, _b, _c, _d, _e, _f, _g;
    var route = (_b = (_a = (0, utils_1.searchRouteByCode)(order.details.route)) === null || _a === void 0 ? void 0 : _a.display) !== null && _b !== void 0 ? _b : '';
    var location = (_d = (_c = order.details.location) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '';
    var administratedDateTime = ((_e = order.administrationDetails) === null || _e === void 0 ? void 0 : _e.administeredDateTime)
        ? (_g = luxon_1.DateTime.fromISO((_f = order.administrationDetails) === null || _f === void 0 ? void 0 : _f.administeredDateTime)) === null || _g === void 0 ? void 0 : _g.toFormat('MM/dd/yyyy HH:mm a')
        : '';
    return "".concat(order.details.medication.name, " - ").concat(order.details.dose, " ").concat(order.details.units, " / ").concat(route, " - ").concat(location, "\n").concat(administratedDateTime);
}

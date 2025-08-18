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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBundle = exports.getVisitMappedData = void 0;
var utils_1 = require("utils");
var utils_2 = require("../../../telemed/utils");
var business_logic_1 = require("./business-logic");
var constants_1 = require("./constants");
var extractors_1 = require("./extractors");
var getVisitMappedData = function (resourceBundle) {
    var _a, _b, _c, _d, _e;
    var _f = (0, extractors_1.getResources)(resourceBundle), patient = _f.patient, questionnaireResponse = _f.questionnaireResponse;
    var patientName = (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name);
    return {
        patientName: (patientName === null || patientName === void 0 ? void 0 : patientName.lastFirstMiddleName) || (patientName === null || patientName === void 0 ? void 0 : patientName.lastFirstName) || (patientName === null || patientName === void 0 ? void 0 : patientName.lastName) || (patientName === null || patientName === void 0 ? void 0 : patientName.firstName),
        patientAvatarPhotoUrl: (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.photo) === null || _a === void 0 ? void 0 : _a.at(0)) === null || _b === void 0 ? void 0 : _b.url,
        patientConditionalPhotosUrls: (0, extractors_1.extractUrlsFromAppointmentData)(resourceBundle, utils_1.PATIENT_PHOTO_CODE),
        schoolWorkNoteUrls: (0, extractors_1.extractUrlsFromAppointmentData)(resourceBundle, utils_1.SCHOOL_WORK_NOTE_TEMPLATE_CODE),
        pronouns: (0, business_logic_1.getPronouns)((0, extractors_1.getQuestionnaireResponseValues)(questionnaireResponse)),
        gender: (patient === null || patient === void 0 ? void 0 : patient.gender) ? constants_1.Gender[patient.gender] : undefined,
        preferredLanguage: (_e = (_d = (_c = (0, utils_1.getQuestionnaireResponseByLinkId)('preferred-language', questionnaireResponse)) === null || _c === void 0 ? void 0 : _c.answer) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.valueString,
        DOB: (0, utils_1.formatDOB)(patient === null || patient === void 0 ? void 0 : patient.birthDate),
        allergies: (0, extractors_1.getAllergies)(questionnaireResponse),
        hospitalizations: (0, extractors_1.getHospitalizations)(questionnaireResponse),
        weight: (0, business_logic_1.getWeight)((0, extractors_1.getPatientValues)(patient)),
    };
};
exports.getVisitMappedData = getVisitMappedData;
var parseBundle = function (resourceBundle) {
    var _a = (0, extractors_1.getResources)(resourceBundle), appointmentResource = _a.appointment, patientResource = _a.patient, locationResource = _a.location, locationVirtualResource = _a.locationVirtual, encounterResource = _a.encounter, questionnaireResponseResource = _a.questionnaireResponse;
    var appointment = (0, extractors_1.getAppointmentValues)(appointmentResource);
    var patient = (0, extractors_1.getPatientValues)(patientResource);
    var location = (0, extractors_1.getLocationValues)(locationResource);
    var locationVirtual = (0, extractors_1.getLocationValues)(locationVirtualResource);
    var encounter = (0, extractors_1.getEncounterValues)(encounterResource);
    var questionnaire = (0, extractors_1.getQuestionnaireResponseValues)(questionnaireResponseResource);
    var patientInfoWithFallback = (0, business_logic_1.getPatientInfoWithFallback)(patient, questionnaire);
    var parsedAppointmentData = (0, exports.getVisitMappedData)(resourceBundle);
    return {
        resources: {
            appointment: appointment,
            location: location,
            locationVirtual: locationVirtual,
            encounter: encounter,
            questionnaire: questionnaire,
            patient: patient,
        },
        mappedData: __assign(__assign({}, patientInfoWithFallback), parsedAppointmentData),
    };
};
exports.parseBundle = parseBundle;
//# sourceMappingURL=parser.js.map
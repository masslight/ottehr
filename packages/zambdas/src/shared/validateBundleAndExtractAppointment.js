"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBundleAndExtractAppointment = void 0;
var utils_1 = require("utils");
var validateBundleAndExtractAppointment = function (bundle) {
    var _a, _b, _c, _d, _e, _f;
    var entries = (_a = bundle.entry) !== null && _a !== void 0 ? _a : [];
    // console.log('bundle', JSON.stringify(bundle));
    var searchBundle = (_b = entries.find(function (item) {
        return item.resource && item.resource.resourceType === 'Bundle' && item.resource.type === 'searchset';
    })) === null || _b === void 0 ? void 0 : _b.resource;
    if (!searchBundle) {
        throw new Error('Transaction could not be completed');
    }
    var entry = (_c = searchBundle.entry) !== null && _c !== void 0 ? _c : [];
    var appointment = (_d = entry.find(function (appt) {
        return appt.resource && appt.resource.resourceType === 'Appointment';
    })) === null || _d === void 0 ? void 0 : _d.resource;
    if (!appointment) {
        throw new Error('Appointment could not be found');
    }
    // get schedule resource
    var fhirLocation = entry.find(function (e) { var _a; return ((_a = e.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Location'; });
    var fhirHS = entry.find(function (e) { var _a; return ((_a = e.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'HealthcareService'; });
    var fhirPractitioner = entry.find(function (e) { var _a; return ((_a = e.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Practitioner'; }); // todo is this right ?
    var scheduleResource;
    if (fhirLocation) {
        scheduleResource = fhirLocation.resource;
    }
    else if (fhirHS) {
        scheduleResource = fhirHS.resource;
    }
    else if (fhirPractitioner) {
        scheduleResource = fhirPractitioner.resource;
    }
    if (!scheduleResource) {
        throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
    }
    var patient = (_e = entry.find(function (appt) {
        return appt.resource && appt.resource.resourceType === 'Patient';
    })) === null || _e === void 0 ? void 0 : _e.resource;
    if (!patient) {
        throw new Error('Patient could not be found');
    }
    var questionnaireResponse = (_f = entry.find(function (appt) {
        return appt.resource && appt.resource.resourceType === 'QuestionnaireResponse';
    })) === null || _f === void 0 ? void 0 : _f.resource;
    // no validation for questionnaireResponse because a patient can check-in
    // to a prebook appointment without filling out paperwork so there is no
    // questionnaireResponse associated with the encounter, but it is still
    // valid for them to check-in.
    return { appointment: appointment, scheduleResource: scheduleResource, questionnaireResponse: questionnaireResponse, patient: patient };
};
exports.validateBundleAndExtractAppointment = validateBundleAndExtractAppointment;

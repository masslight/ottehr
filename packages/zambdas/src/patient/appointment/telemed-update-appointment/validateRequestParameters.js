"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateAppointmentParams = validateUpdateAppointmentParams;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
function validateUpdateAppointmentParams(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), patient = _a.patient, appointmentId = _a.appointmentId, unconfirmedDateOfBirth = _a.unconfirmedDateOfBirth, locationState = _a.locationState;
    if (appointmentId === undefined) {
        throw new Error('"appointmentId" is required');
    }
    // Check existence of necessary fields
    if (patient === undefined) {
        throw new Error('These fields are required: "patient"');
    }
    // Patient details
    if (patient.firstName === undefined ||
        patient.lastName === undefined ||
        patient.dateOfBirth === undefined ||
        patient.email === undefined ||
        patient.emailUser === undefined ||
        patient.firstName === '' ||
        patient.lastName === '' ||
        patient.email === '' ||
        patient.emailUser === '') {
        throw new Error('These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.email", "patient.emailUser"');
    }
    var isInvalidPatientDate = !luxon_1.DateTime.fromISO(patient.dateOfBirth).isValid;
    if (isInvalidPatientDate) {
        throw new Error('"patient.dateOfBirth" was not read as a valid date');
    }
    if (patient.sex && !Object.values(utils_1.PersonSex).includes(patient.sex)) {
        throw new Error("\"patient.sex\" must be one of the following values: ".concat(JSON.stringify(Object.values(utils_1.PersonSex))));
    }
    var patientUser = ['Patient', 'Parent/Guardian'];
    if (!patientUser.includes(patient.emailUser)) {
        throw new Error("\"patient.emailUser\" must be one of the following values: ".concat(JSON.stringify(Object.values(patientUser))));
    }
    if (!patient.email) {
        throw new Error('patient email is not defined');
    }
    if ((patient === null || patient === void 0 ? void 0 : patient.phoneNumber) && !shared_1.phoneRegex.test(patient.phoneNumber)) {
        throw new Error('patient phone number is not valid');
    }
    if (unconfirmedDateOfBirth) {
        var isInvalidUnconfirmedDateOfBirth = !luxon_1.DateTime.fromISO(unconfirmedDateOfBirth).isValid;
        if (isInvalidUnconfirmedDateOfBirth) {
            throw new Error('"unconfirmedDateOfBirth" was not read as a valid date');
        }
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        appointmentId: appointmentId,
        patient: patient,
        unconfirmedDateOfBirth: unconfirmedDateOfBirth,
        secrets: input.secrets,
        locationState: locationState,
    };
}

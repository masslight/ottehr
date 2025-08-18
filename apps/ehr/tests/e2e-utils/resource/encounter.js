"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEncounter = createEncounter;
exports.createTelemedEncounter = createTelemedEncounter;
var constants_1 = require("./constants");
function createEncounter(_a) {
    var startTime = _a.startTime, patientId = _a.patientId, _b = _a.locationId, locationId = _b === void 0 ? constants_1.ENV_LOCATION_ID : _b, appointmentId = _a.appointmentId, _c = _a.status, status = _c === void 0 ? 'planned' : _c, _d = _a.encounterClass, encounterClass = _d === void 0 ? {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
    } : _d;
    return {
        resourceType: 'Encounter',
        status: status,
        statusHistory: [
            {
                status: status,
                period: {
                    start: startTime,
                },
            },
        ],
        class: encounterClass,
        subject: {
            reference: "Patient/".concat(patientId),
        },
        appointment: [
            {
                reference: "Appointment/".concat(appointmentId),
            },
        ],
        location: [
            {
                location: {
                    reference: "Location/".concat(locationId),
                },
            },
        ],
    };
}
function createTelemedEncounter(_a) {
    var startTime = _a.startTime, patientId = _a.patientId, _b = _a.locationId, locationId = _b === void 0 ? constants_1.ENV_LOCATION_ID : _b, appointmentId = _a.appointmentId, _c = _a.status, status = _c === void 0 ? 'planned' : _c;
    return {
        resourceType: 'Encounter',
        status: status,
        statusHistory: [
            {
                status: status,
                period: {
                    start: startTime,
                },
            },
        ],
        class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'VR',
            display: 'virtual',
        },
        subject: {
            reference: "Patient/".concat(patientId),
        },
        appointment: [
            {
                reference: "Appointment/".concat(appointmentId),
            },
        ],
        location: [
            {
                location: {
                    reference: "Location/".concat(locationId),
                },
            },
        ],
        extension: [
            {
                url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
                extension: [
                    {
                        url: 'channelType',
                        valueCoding: {
                            system: 'https://fhir.zapehr.com/virtual-service-type',
                            code: 'chime-video-meetings',
                            display: 'Twilio Video Group Rooms',
                        },
                    },
                ],
            },
            {
                url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
                extension: [
                    {
                        url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
                        extension: [
                            {
                                url: 'period',
                                valuePeriod: {
                                    start: startTime,
                                },
                            },
                            {
                                url: 'reference',
                                valueReference: {
                                    reference: "Patient/".concat(patientId),
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    };
}
//# sourceMappingURL=encounter.js.map
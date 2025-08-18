"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("utils");
var vitest_1 = require("vitest");
var finishedEncounter = {
    resourceType: 'Encounter',
    status: 'finished',
    statusHistory: [
        {
            status: 'planned',
            period: {
                start: '2024-12-10T15:54:46.675Z',
                end: '2024-12-10T17:38:15.605Z',
            },
        },
        {
            status: 'arrived',
            period: {
                start: '2024-12-10T17:38:15.605Z',
                end: '2024-12-10T21:10:01.448Z',
            },
        },
        {
            status: 'in-progress',
            period: {
                start: '2024-12-10T21:10:01.448Z',
                end: '2024-12-10T22:00:01.448Z',
            },
        },
        {
            status: 'finished',
            period: {
                start: '2024-12-10T22:00:01.448Z',
            },
        },
    ],
    class: {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
    },
    subject: {
        reference: 'Patient/432964e3-f114-40d8-bd49-5dd8ba511f50',
    },
    appointment: [
        {
            reference: 'Appointment/8fae0218-3bde-403f-9338-4f8438413f32',
        },
    ],
    location: [
        {
            location: {
                reference: 'Location/9b7f5d54-eaf6-4b3e-b13c-3ee4be417d10',
            },
        },
    ],
    meta: {
        versionId: 'b4542438-6df4-4fa7-a536-68a32fc68417',
        lastUpdated: '2024-12-10T22:08:21.191Z',
    },
    participant: [
        {
            period: {
                start: '2024-12-10T21:10:01.448Z',
                end: '2024-12-10T21:17:52.393Z',
            },
            individual: {
                type: 'Practitioner',
                reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
            },
            type: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                            code: 'ADM',
                            display: 'admitter',
                        },
                    ],
                },
            ],
        },
        {
            period: {
                start: '2024-12-10T21:26:01.448Z',
                end: '2024-12-10T21:36:01.448Z',
            },
            individual: {
                type: 'Practitioner',
                reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
            },
            type: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                            code: 'ATND',
                            display: 'attender',
                        },
                    ],
                },
            ],
        },
    ],
};
var unexpectedPractitioner = {
    resourceType: 'Encounter',
    status: 'finished',
    statusHistory: [
        {
            status: 'planned',
            period: {
                start: '2024-12-10T15:54:46.675Z',
                end: '2024-12-10T17:38:15.605Z',
            },
        },
        {
            status: 'arrived',
            period: {
                start: '2024-12-10T17:38:15.605Z',
                end: '2024-12-10T21:10:01.448Z',
            },
        },
        {
            status: 'in-progress',
            period: {
                start: '2024-12-10T21:10:01.448Z',
                end: '2024-12-10T22:00:01.448Z',
            },
        },
        {
            status: 'finished',
            period: {
                start: '2024-12-10T22:00:01.448Z',
            },
        },
    ],
    class: {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
    },
    subject: {
        reference: 'Patient/432964e3-f114-40d8-bd49-5dd8ba511f50',
    },
    appointment: [
        {
            reference: 'Appointment/8fae0218-3bde-403f-9338-4f8438413f32',
        },
    ],
    location: [
        {
            location: {
                reference: 'Location/9b7f5d54-eaf6-4b3e-b13c-3ee4be417d10',
            },
        },
    ],
    meta: {
        versionId: 'b4542438-6df4-4fa7-a536-68a32fc68417',
        lastUpdated: '2024-12-10T22:08:21.191Z',
    },
    participant: [
        {
            period: {
                start: '2024-12-10T21:10:01.448Z',
                end: '2024-12-10T21:17:52.393Z',
            },
            individual: {
                type: 'Practitioner',
                reference: 'Practitioner/502a540d-c5f1-4af1-81bc-215b104bc04c',
            },
            type: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                            code: 'nurse',
                            display: 'Nurse',
                        },
                    ],
                },
            ],
        },
    ],
};
// todo add more tests for updated duration utils
(0, vitest_1.describe)('visit duration tests', function () {
    (0, vitest_1.test)('test visitStatusHistory for finished encounter ', function () {
        var visitStatusHistory = (0, utils_1.getVisitStatusHistory)(finishedEncounter);
        (0, vitest_1.expect)(visitStatusHistory.length).toEqual(7);
    });
    (0, vitest_1.test)('test visitStatusHistory for encounter with an unexpected Practitioner', function () {
        var visitStatusHistory = (0, utils_1.getVisitStatusHistory)(unexpectedPractitioner);
        (0, vitest_1.expect)(visitStatusHistory.length).toEqual(3);
    });
});
//# sourceMappingURL=visit-duration.test.js.map
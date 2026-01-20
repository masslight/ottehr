"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createABNDocRef = exports.createResultAttachmentDocRef = void 0;
var luxon_1 = require("luxon");
var createResultAttachmentDocRef = function (input) {
    var ENV = input.ENV, projectId = input.projectId, relatedDiagnosticReportReferences = input.relatedDiagnosticReportReferences, encounterRef = input.encounterRef, patientRef = input.patientRef;
    // the test file is uploaded to a specific patient's z3 folder hence this hard coding
    var patientId = getPatientIdForEnv(ENV);
    var docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        docStatus: 'final',
        type: {
            coding: [
                {
                    system: 'http://loinc.org',
                    code: '11502-2',
                    display: 'Laboratory report',
                },
            ],
            text: 'Lab result document',
        },
        category: [
            {
                coding: [
                    {
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/lab-documents',
                        code: 'lab-generated-result-document',
                        display: 'Lab Generated Result Document',
                    },
                ],
            },
        ],
        date: luxon_1.DateTime.now().toISO(),
        content: [
            {
                attachment: {
                    url: "https://project-api.zapehr.com/v1/z3/".concat(projectId, "-labs/").concat(patientId, "/2025-10-11-1760211958816-onion_lab_result.pdf"),
                    contentType: 'application/pdf',
                    title: 'onion_lab_result.pdf',
                },
            },
        ],
        subject: patientRef ? patientRef : undefined,
        context: {
            related: relatedDiagnosticReportReferences,
            encounter: encounterRef ? [encounterRef] : undefined,
        },
    };
    return docRef;
};
exports.createResultAttachmentDocRef = createResultAttachmentDocRef;
var createABNDocRef = function (input) {
    var ENV = input.ENV, projectId = input.projectId, relatedServiceRequestReferences = input.relatedServiceRequestReferences, encounterRef = input.encounterRef, patientRef = input.patientRef;
    // the test file is uploaded to a specific patient's z3 folder hence this hard coding
    var patientId = getPatientIdForEnv(ENV);
    var docRef = {
        resourceType: 'DocumentReference',
        status: 'current',
        docStatus: 'final',
        type: {
            coding: [
                {
                    system: 'http://loinc.org',
                    code: '59284-0',
                    display: 'Consent Document',
                },
            ],
            text: 'Lab result document',
        },
        category: [
            {
                coding: [
                    {
                        system: 'https://terminology.fhir.oystehr.com/CodeSystem/lab-documents',
                        code: 'abn-document',
                        display: 'Lab ABN Document',
                    },
                ],
            },
        ],
        date: luxon_1.DateTime.now().toISO(),
        content: [
            {
                attachment: {
                    url: "https://project-api.zapehr.com/v1/z3/".concat(projectId, "-labs/").concat(patientId, "/testing_ABN.pdf"),
                    contentType: 'application/pdf',
                    title: 'testing_ABN.pdf',
                },
            },
        ],
        subject: patientRef ? patientRef : undefined,
        context: {
            related: relatedServiceRequestReferences,
            encounter: encounterRef ? [encounterRef] : undefined,
        },
    };
    return docRef;
};
exports.createABNDocRef = createABNDocRef;
var getPatientIdForEnv = function (ENV) {
    var patientId;
    switch (ENV) {
        case 'local':
            patientId = 'ec2712c1-a080-4aa8-981c-de2b5128cf69';
            break;
        case 'development':
            patientId = '2489f7c6-0877-40a7-89dd-80009b9de0aa';
            break;
        case 'testing':
            patientId = 'b016011c-39ac-4363-bbb3-da36f8d96c1e';
            break;
        case 'staging':
            patientId = '39a5abb5-6c56-40e0-a905-44ed6fef27cb';
            break;
        default:
            patientId = undefined;
    }
    if (!patientId)
        throw new Error("no patientId mapped for this environment");
    return patientId;
};

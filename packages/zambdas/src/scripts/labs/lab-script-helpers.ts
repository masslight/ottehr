import { DocumentReference, Reference } from 'fhir/r4b';
import { DateTime } from 'luxon';

interface CreateAttachmentDocRefInput {
  ENV: string;
  projectId: string;
  relatedDiagnosticReportReferences: Reference[];
  encounterRef: Reference | undefined;
  patientRef: Reference | undefined;
}

type CreateABNDocRefInput = Omit<CreateAttachmentDocRefInput, 'relatedDiagnosticReportReferences'> & {
  relatedServiceRequestReferences: Reference[];
};

export const createResultAttachmentDocRef = (input: CreateAttachmentDocRefInput): DocumentReference => {
  const { ENV, projectId, relatedDiagnosticReportReferences, encounterRef, patientRef } = input;

  // the test file is uploaded to a specific patient's z3 folder hence this hard coding
  const patientId = getPatientIdForEnv(ENV);

  const docRef: DocumentReference = {
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
    date: DateTime.now().toISO(),
    content: [
      {
        attachment: {
          url: `https://project-api.zapehr.com/v1/z3/${projectId}-labs/${patientId}/2025-10-11-1760211958816-onion_lab_result.pdf`,
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

export const createABNDocRef = (input: CreateABNDocRefInput): DocumentReference => {
  const { ENV, projectId, relatedServiceRequestReferences, encounterRef, patientRef } = input;

  // the test file is uploaded to a specific patient's z3 folder hence this hard coding
  const patientId = getPatientIdForEnv(ENV);

  const docRef: DocumentReference = {
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
    date: DateTime.now().toISO(),
    content: [
      {
        attachment: {
          url: `https://project-api.zapehr.com/v1/z3/${projectId}-labs/${patientId}/testing_ABN.pdf`,
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

const getPatientIdForEnv = (ENV: string): string => {
  let patientId;
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
  if (!patientId) throw new Error(`no patientId mapped for this environment`);
  return patientId;
};

import { BatchInputPostRequest } from '@oystehr/sdk';
import { getRandomValues, randomUUID } from 'crypto';
import { DiagnosticReport, Identifier, Observation, Organization } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import {
  DR_CONTAINED_PRACTITIONER_REF,
  OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY,
  OYSTEHR_LABS_RESULT_ORDERING_PROVIDER_EXT_URL,
  OYSTEHR_SAME_TRANSMISSION_DR_REF_URL,
} from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';
import { DR_UNSOLICITED_RESULT_TAG, LAB_PDF_ATTACHMENT_DR_TAG, PDF_ATTACHMENT_CODE } from './lab-script-consts';
import { createPdfAttachmentObs } from './lab-script-helpers';

type PatientDetails = {
  first: string;
  last: string;
  dob: string;
};
type PractitionerDetails = {
  first: string;
  last: string;
};
type TestDetails = {
  code: string;
  display: string;
};

const EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging'];

const PATIENT: PatientDetails = { first: 'PatientFirstName', last: 'PatientLastName', dob: '2001-01-01' };
const PRACTITIONER: PractitionerDetails = { first: 'PractitionerFirstName', last: 'PractitionerLastName' };
const TEST: TestDetails = { code: '57021-8', display: 'CBC W Auto Differential panel in Blood' };

const AUTO_LAB_GUID = '790b282d-77e9-4697-9f59-0cef8238033a';

const main = async (): Promise<void> => {
  if (process.argv.length !== 3) {
    console.log(`exiting, incorrect number of arguments passed\n`);
    console.log(`Usage: npm run mock-unsolicited-result [${EXAMPLE_ENVS.join(' | ')}]\n`);
    process.exit(1);
  }

  const ENV = process.argv[2];

  let envConfig;
  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  } catch (error) {
    console.error(`Error parsing secrets for ENV '${ENV}'. Error: ${JSON.stringify(error)}`);
  }

  const token = await getAuth0Token(envConfig);
  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehr = createOystehrClient(token, envConfig);

  const autoLabOrgSearch = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'identifier',
          value: AUTO_LAB_GUID,
        },
      ],
    })
  ).unbundle();

  const autoLabOrg = autoLabOrgSearch[0];
  const autoLabOrgId = autoLabOrg?.id;

  if (!autoLabOrgId) {
    console.log('could not find lab org for auto lab, searching with lab guid', AUTO_LAB_GUID);
    process.exit(1);
  }

  const fillerId: Identifier = {
    value: createFillerNumber(),
    use: 'usual',
    type: {
      coding: [
        {
          code: 'FILL',
        },
      ],
      text: 'Filler entity id',
    },
  };
  const labTransmissionAccountId: Identifier = {
    system: 'https://identifiers.fhir.oystehr.com/lab-transmission-account-number',
    value: 'teset',
    assigner: {
      reference: `Organization/${autoLabOrgId}`,
    },
  };
  const drIdentifier: Identifier[] = [fillerId, labTransmissionAccountId];

  const obs = createObs();
  const obsFullUrl = `urn:uuid:${randomUUID()}`;
  const dr = createUnsolicitedResultDr({
    drIdentifier,
    obsFullUrl,
    patient: PATIENT,
    practitioner: PRACTITIONER,
    test: TEST,
    labOrgId: autoLabOrgId,
  });
  const drFullUrl = `urn:uuid:${randomUUID()}`;

  const pdfAttachmentObs = createPdfAttachmentObs();
  const pdfAttachmentObsFullUrl = `urn:uuid:${randomUUID()}`;
  const pdfAttachmentDr = createUnsolicitedPdfAttachmentDr(
    drIdentifier,
    pdfAttachmentObsFullUrl,
    autoLabOrgId,
    drFullUrl
  );

  const requests: BatchInputPostRequest<Observation | DiagnosticReport>[] = [
    { method: 'POST', fullUrl: obsFullUrl, url: '/Observation', resource: obs },
    { method: 'POST', fullUrl: drFullUrl, url: '/DiagnosticReport', resource: dr },
    { method: 'POST', fullUrl: pdfAttachmentObsFullUrl, url: '/Observation', resource: pdfAttachmentObs },
    { method: 'POST', url: '/DiagnosticReport', resource: pdfAttachmentDr },
  ];

  try {
    const results = await oystehr.fhir.transaction({ requests });
    console.log('success!');
    const resultsToLog = results.entry?.map((entryItem) => entryItem.resource);
    resultsToLog?.forEach((result) => console.log(`${result?.resourceType}/${result?.id}`));
  } catch (e) {
    console.log('error creating resources: ', e);
    throw e;
  }
};

const createObs = (): Observation => {
  const obs: Observation = {
    resourceType: 'Observation',
    code: {
      coding: [
        {
          code: '718-7',
          system: 'http://loinc.org',
          display: 'Hemoglobin [Mass/volume] in Blood',
        },
      ],
    },
    status: 'final',
    interpretation: [
      {
        coding: [
          {
            code: 'H',
            display: 'High',
            system: 'https://hl7.org/fhir/R4B/valueset-observation-interpretation.html',
          },
        ],
      },
    ],
    referenceRange: [
      {
        text: '2.5-5.3',
      },
    ],
    valueQuantity: {
      value: 5.5,
      system: '(HL7_V2)',
      code: 'mEq/L',
    },
  };
  return obs;
};

const createUnsolicitedResultDr = ({
  drIdentifier,
  obsFullUrl,
  patient,
  practitioner,
  test,
  labOrgId,
}: {
  drIdentifier: Identifier[];
  obsFullUrl: string;
  patient: PatientDetails;
  practitioner: PractitionerDetails;
  test: TestDetails;
  labOrgId: string;
}): DiagnosticReport => {
  const dr: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    extension: [
      {
        url: OYSTEHR_LABS_RESULT_ORDERING_PROVIDER_EXT_URL,
        valueReference: {
          reference: '#resultOrderingProviderPractitionerId',
        },
      },
    ],
    identifier: drIdentifier,
    result: [{ reference: obsFullUrl }],
    status: 'final',
    code: {
      coding: [
        {
          code: test.code,
          system: 'http://loinc.org',
          display: test.display,
        },
      ],
    },
    effectiveDateTime: DateTime.now().toISO(),
    meta: {
      tag: [DR_UNSOLICITED_RESULT_TAG],
    },
    subject: {
      reference: '#unsolicitedResultPatientId',
    },
    performer: [
      {
        reference: `Organization/${labOrgId}`,
      },
    ],
    contained: [
      {
        resourceType: 'Patient',
        id: 'unsolicitedResultPatientId',
        name: [
          {
            family: patient.last,
            given: [patient.first],
          },
        ],
        birthDate: patient.dob,
        gender: 'female',
      },
      {
        resourceType: 'Practitioner',
        id: DR_CONTAINED_PRACTITIONER_REF,
        name: [
          {
            given: [practitioner.first],
            family: practitioner.last,
          },
        ],
        identifier: [
          {
            system: 'http://hl7.org/fhir/sid/us-npi',
            value: '1932929191',
          },
        ],
      },
    ],
    category: [{ coding: [OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY] }],
  };

  return dr;
};

const createUnsolicitedPdfAttachmentDr = (
  drIdentifier: Identifier[],
  obsFullUrl: string,
  labOrgId: string,
  parentDrFullUrl: string
): DiagnosticReport => {
  const dr: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    identifier: drIdentifier,
    result: [{ reference: obsFullUrl }],
    status: 'final',
    code: PDF_ATTACHMENT_CODE,
    effectiveDateTime: DateTime.now().toISO(),
    category: [{ coding: [OYSTEHR_LAB_DIAGNOSTIC_REPORT_CATEGORY] }],
    performer: [
      {
        reference: `Organization/${labOrgId}`,
      },
    ],
    extension: [
      {
        url: OYSTEHR_SAME_TRANSMISSION_DR_REF_URL,
        valueReference: {
          reference: parentDrFullUrl,
        },
      },
    ],
    meta: {
      tag: [LAB_PDF_ATTACHMENT_DR_TAG, DR_UNSOLICITED_RESULT_TAG],
    },
  };
  return dr;
};

const createFillerNumber = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(20);
  getRandomValues(randomArray);
  randomArray.forEach((number) => {
    result += chars[number % chars.length];
  });
  return result;
};

main().catch((error) => {
  console.log(error, JSON.stringify(error, null, 2));
  throw error;
});

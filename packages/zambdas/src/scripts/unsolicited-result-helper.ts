import { BatchInputPostRequest } from '@oystehr/sdk';
import { getRandomValues, randomUUID } from 'crypto';
import { DiagnosticReport, Observation, Organization } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { OYSTEHR_UNSOLICITED_RESULT_ORDERING_PROVIDER_SYSTEM } from 'utils';
import { createOystehrClient, getAuth0Token } from '../shared';

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

  const obs = createObs();
  const obsFullUrl = `urn:uuid:${randomUUID()}`;
  const dr = createUnsolicitedResultDr({
    fillerId: createFillerNumber(),
    obsFullUrl,
    patient: PATIENT,
    practitioner: PRACTITIONER,
    test: TEST,
    labOrgId: autoLabOrgId,
  });

  const requests: BatchInputPostRequest<Observation | DiagnosticReport>[] = [
    { method: 'POST', fullUrl: obsFullUrl, url: '/Observation', resource: obs },
    { method: 'POST', url: '/DiagnosticReport', resource: dr },
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
  fillerId,
  obsFullUrl,
  patient,
  practitioner,
  test,
  labOrgId,
}: {
  fillerId: string;
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
        url: 'https://extensions.fhir.oystehr.com/diagnostic-report-original-transmission',
        extension: [
          {
            url: 'content',
            valueAttachment: {
              data: 'TVNIfF5+XCZ8TEFCfEFMMXx8dGVzdC1zYXJhaC0wNy0wN3wyMDI1MDgxNTE0MjA1MC0wMDAwfHxPUlVeUjAxXk9SVV9SMDF8ZTZlN2QyMDYtMWMyNy00YWJlLTkzMzMtMjk4MGI0OTVkZDMyfFR8Mi41LjF8fHxBTHxBTHx8fHx8TFJJX05HX1JOX1Byb2ZpbGVeXjIuMTYuODQwLjEuMTEzODgzLjkuMjBeSVNPfHwKUElEfDF8fDAzNDA2ZWExLTcyY2YtNGRlMy1iOWFjLWMwYmQyMGM0YWNhMl5eXl5QVHx8dGVzdF50ZXN0fHwyMDAxMDEwMXxGfHx8fHx8fHx8fHx8fHx8fHx8fHx8fApQVjF8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fApPUkN8UkV8MnprMm4xbjZ0bnVjNHN1MHp1Nnh8MnprMm4xbjZ0bnVjNHN1MHp1Nnh8fHx8fHx8fHwxOTMyOTI5MTkxXnRlc3RedGVzdF5eXl5eXl5eXl5OUEl8fHx8fHx8fHx8fHwKT0JSfDF8MnprMm4xbjZ0bnVjNHN1MHp1Nnh8MnprMm4xbjZ0bnVjNHN1MHp1Nnh8NTcwMjEtOF5DQkMgVyBBdXRvIERpZmZlcmVudGlhbCBwYW5lbCBpbiBCbG9vZF5MTl5eXl5eXkNCQyBXIEF1dG8gRGlmZmVyZW50aWFsIHBhbmVsIGluIEJsb29kfHx8MjAyNTA4MTUxNDIwNTAtMDAwMHx8fHx8fHx8fDE5MzI5MjkxOTFedGVzdF50ZXN0Xl5eXl5eXl5eXk5QSXx8fHx8fDIwMjUwODE1MTQyMDUwLTAwMDB8fHxGfE5PVF9QUk9WSURFRHx8fE5PVF9QUk9WSURFRHx8fHx8fHx8fHx8fHx8fHx8fHx8fE5PVF9QUk9WSURFRApPQlh8MXxOTXw3MTgtN15IZW1vZ2xvYmluIFtNYXNzL3ZvbHVtZV0gaW4gQmxvb2ReTE5eXl5eXl5IZW1vZ2xvYmluIFtNYXNzL3ZvbHVtZV0gaW4gQmxvb2R8MXw1LjV8bUVxL0x8Mi41LTUuM3xIfHx8Rnx8fDIwMjUwODE1MTQyMDUwLTAwMDB8MUFeU3dpZnQgTGFib3JhdG9yaWVzXjczMSBNYXJrZXQgU3ReU2FuIEZyYW5jaXNjb15DQV45NDEwM3x8fHx8fHx8U3dpZnQgTGFib3JhdG9yaWVzXl5eXl5eXl5eMUF8NzMxIE1hcmtldCBTdF5eU2FuIEZyYW5jaXNjb15DQV45NDEwM15eXl5eXl5OT1RfUFJPVklERUReTk9UX1BST1ZJREVEfE5PVF9QUk9WSURFRHx8fHx8fHw=',
              contentType: 'base64',
              creation: '2025-08-15T10:36:00.393-04:00',
            },
          },
          {
            url: 'standard',
            valueCoding: {
              code: 'hl7',
              version: '2.5.1',
            },
          },
        ],
      },
      {
        url: OYSTEHR_UNSOLICITED_RESULT_ORDERING_PROVIDER_SYSTEM,
        valueReference: {
          reference: '#unsolicitedResultPractitionerId',
        },
      },
    ],
    identifier: [
      {
        value: fillerId,
        use: 'usual',
        type: {
          coding: [
            {
              code: 'FILL',
            },
          ],
          text: 'Filler entity id',
        },
      },
    ],
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
      tag: [
        {
          system: 'result-type',
          code: 'unsolicited',
          display: 'unsolicited',
        },
      ],
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
        id: 'unsolicitedResultPractitionerId',
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
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'OSL',
            display: 'Outside Lab',
          },
        ],
      },
    ],
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

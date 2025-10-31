import { BatchInputPostRequest } from '@oystehr/sdk';
import { DiagnosticReport, DocumentReference, ServiceRequest } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { createOystehrClient, getAuth0Token } from '../../shared';
import { EXAMPLE_ENVS } from './lab-script-consts';

// Creates a DiagnosticReport and an Observation to mock a pdf attachment
// npm run mock-pdf-result ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]

const main = async (): Promise<void> => {
  if (process.argv.length !== 4) {
    console.log(`exiting, incorrect number of arguments passed\n`);
    console.log(`Usage: npm run mock-pdf-result [${EXAMPLE_ENVS.join(' | ')}] [serviceRequest Id]\n`);
    process.exit(1);
  }

  const ENV = process.argv[2];
  const serviceRequestId = process.argv[3];

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

  let serviceRequest: ServiceRequest | undefined;
  try {
    serviceRequest = await oystehr.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
  } catch {
    console.log(`exiting, no service request found with that ID in this env\n`);
    process.exit(1);
  }
  if (!serviceRequest) {
    console.log(`exiting, no service request found with that ID in this env\n`);
    process.exit(1);
  }

  const encounterRef = serviceRequest.encounter;
  const patientRef = serviceRequest.subject.reference?.startsWith('Patient/') ? serviceRequest.subject : undefined;

  const resultResources = (
    await oystehr.fhir.search<DiagnosticReport>({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: 'based-on',
          value: `ServiceRequest/${serviceRequestId}`,
        },
      ],
    })
  ).unbundle();
  if (!resultResources.length || !resultResources) {
    console.log(`exiting, no diagnostic reports found for that service request in this env\n`);
    process.exit(1);
  }

  const requests: BatchInputPostRequest<DocumentReference>[] = [];

  const diagnosticReports = resultResources.filter((resource) => resource.resourceType === 'DiagnosticReport');

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
          url: 'https://project-api.zapehr.com/v1/z3/0ba6d7a5-a5a6-4c16-a6d9-ce91f300acb4-labs/ec2712c1-a080-4aa8-981c-de2b5128cf69/2025-10-11-1760211958816-onion_lab_result.pdf',
          contentType: 'application/pdf',
          title: 'onion_lab_result.pdf',
        },
      },
    ],
    subject: patientRef ? patientRef : undefined,
    context: {
      related: diagnosticReports.map((dr) => ({ reference: `DiagnosticReport/${dr.id}` })),
      encounter: encounterRef ? [encounterRef] : undefined,
    },
  };

  requests.push({
    method: 'POST',
    url: '/DocumentReference',
    resource: docRef,
  });

  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction({ requests });

  console.log('Successfully created all resources:');
  bundle.entry?.forEach((entry) => {
    console.log(`${entry.resource?.resourceType}/${entry.resource?.id}`);
  });
};

main().catch((error) => {
  console.log(error, JSON.stringify(error, null, 2));
  throw error;
});

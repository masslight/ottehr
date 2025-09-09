import { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { CodeableConcept, DiagnosticReport, Observation, Organization, ServiceRequest } from 'fhir/r4b';
import fs from 'fs';
import { LAB_DR_TYPE_TAG } from 'utils';
import { getOrderNumber, OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM } from 'utils';
import { createOystehrClient, getAuth0Token } from '../shared';

// Creates a DiagnosticReport and Observation(s) to mock a reflex test
// npm run mock-reflex-test ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]

const AUTO_LAB_GUID = '790b282d-77e9-4697-9f59-0cef8238033a';

const EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
const REFLEX_TEST_CODE: CodeableConcept = {
  coding: [
    {
      code: '3051-0',
      system: 'http://loinc.org',
      display: 'Free T3, Blood',
    },
  ],
};

const main = async (): Promise<void> => {
  if (process.argv.length !== 4) {
    console.log(`exiting, incorrect number of arguments passed\n`);
    console.log(`Usage: npm run mock-reflex-test [${EXAMPLE_ENVS.join(' | ')}] [serviceRequest Id]\n`);
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

  const resultResources = (
    await oystehr.fhir.search({
      resourceType: 'DiagnosticReport',
      params: [
        {
          name: 'based-on',
          value: `ServiceRequest/${serviceRequestId}`,
        },
        {
          name: '_include:iterate',
          value: 'DiagnosticReport:result',
        },
      ],
    })
  ).unbundle();
  if (!resultResources.length || !resultResources) {
    console.log(`exiting, no diagnostic reports found for that service request in this env\n`);
    process.exit(1);
  }

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

  const requests: BatchInputPostRequest<DiagnosticReport | Observation>[] = [];

  // grab first related diagnostic report thats not a reflex test
  const drToDuplicate = resultResources.find(
    (resource) =>
      resource.resourceType === 'DiagnosticReport' &&
      !resource.meta?.tag?.some(
        (tag) => tag.system === LAB_DR_TYPE_TAG.system && tag.display === LAB_DR_TYPE_TAG.display.reflex
      )
  ) as DiagnosticReport;
  console.log('DiagnosticReport that will be used to make the reflex test DR - ', drToDuplicate.id);

  const relatedObservations: Observation[] = [];
  drToDuplicate.result?.forEach((result) => {
    const obsID = result.reference?.replace('Observation/', '');
    const observationReturned = resultResources.find(
      (resource) => resource.resourceType === 'Observation' && resource.id === obsID
    ) as Observation;
    relatedObservations.push(observationReturned);
  });
  const resultRefsForReflexTest: DiagnosticReport['result'] = [];
  relatedObservations.forEach((obs) => {
    const obsFullUrl = `urn:uuid:${randomUUID()}`;
    resultRefsForReflexTest.push({ reference: obsFullUrl });
    const newObsResource = { ...obs };
    delete newObsResource.id;
    delete newObsResource.meta;
    requests.push({
      method: 'POST',
      url: '/Observation',
      resource: newObsResource,
      fullUrl: obsFullUrl,
    });
  });

  const reflexDR: DiagnosticReport = { ...drToDuplicate, code: REFLEX_TEST_CODE };
  reflexDR.meta = {};
  reflexDR.meta.tag = [
    { system: LAB_DR_TYPE_TAG.system, code: LAB_DR_TYPE_TAG.code.reflex, display: LAB_DR_TYPE_TAG.display.reflex },
  ];
  reflexDR.result = resultRefsForReflexTest;

  // override existing filler id value
  const randomString = Math.random().toString(36).substring(2, 14).toUpperCase();
  const fillerIdIdx = reflexDR.identifier?.findIndex((item) => item.type?.coding?.[0].code === 'FILL');
  if (fillerIdIdx !== undefined && fillerIdIdx >= 0 && reflexDR.identifier?.[fillerIdIdx]) {
    reflexDR.identifier[fillerIdIdx].value = randomString;
  }
  const orderNumber = getOrderNumber(serviceRequest);
  const orderNumberIdentifier = { system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, value: orderNumber };
  if (reflexDR.identifier) {
    reflexDR.identifier.push(orderNumberIdentifier);
  } else {
    reflexDR.identifier = [orderNumberIdentifier];
  }

  if (autoLabOrgId) {
    reflexDR.performer = [
      {
        reference: `Organization/${autoLabOrgId}`,
      },
    ];
  }

  // remove existing id and hl7 extension and basedOn
  // in bundled orders world we wont know which test in the bundle triggered the reflex test, so no basedOn
  delete reflexDR.extension;
  delete reflexDR.id;
  delete reflexDR.basedOn;

  requests.push({
    method: 'POST',
    url: '/DiagnosticReport',
    resource: reflexDR,
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

import { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  CodeableConcept,
  DiagnosticReport,
  DocumentReference,
  Observation,
  Reference,
  ServiceRequest,
  Specimen,
} from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { LAB_DR_TYPE_TAG } from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';
import { DR_REFLEX_TAG, LAB_PDF_ATTACHMENT_DR_TAG, PDF_ATTACHMENT_CODE } from './lab-script-consts';
import { createAttachmentDocRef, createPdfAttachmentObs } from './lab-script-helpers';

// Creates a DiagnosticReport and Observation(s) to mock a reflex test
// npm run mock-reflex-test ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]

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

  const requests: BatchInputPostRequest<DiagnosticReport | Observation | DocumentReference>[] = [];

  // grab first related diagnostic report thats not a reflex test
  const drToDuplicate = resultResources.find(
    (resource) =>
      resource.resourceType === 'DiagnosticReport' &&
      !resource.meta?.tag?.some(
        (tag) => tag.system === LAB_DR_TYPE_TAG.system && tag.display === LAB_DR_TYPE_TAG.display.reflex
      )
  ) as DiagnosticReport;
  console.log('DiagnosticReport that will be used to make the reflex test DR - ', drToDuplicate.id);

  const drContainedSpecimen: Specimen = {
    resourceType: 'Specimen',
    id: 'resultSpecimenId',
    collection: {
      quantity: {
        system: 'https://terminology.fhir.oystehr.com/CodeSystem/lab-result-collection-volume',
        code: '2100',
        unit: 'mL',
      },
      collectedDateTime: DateTime.now().toISO(),
    },
  };

  const drContainedSpecimenRef: Reference = {
    reference: '#resultSpecimenId',
  };

  // add specimen info if there isn't any
  if (!drToDuplicate.specimen) {
    drToDuplicate.specimen = [drContainedSpecimenRef];
    if (drToDuplicate.contained?.length) drToDuplicate.contained.push(drContainedSpecimen);
    else drToDuplicate.contained = [drContainedSpecimen];
  }

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
  reflexDR.meta.tag = [DR_REFLEX_TAG];
  reflexDR.result = resultRefsForReflexTest;

  // override existing filler id value
  const randomString = Math.random().toString(36).substring(2, 14).toUpperCase();
  const fillerIdIdx = reflexDR.identifier?.findIndex((item) => item.type?.coding?.[0].code === 'FILL');
  if (fillerIdIdx !== undefined && fillerIdIdx >= 0 && reflexDR.identifier?.[fillerIdIdx]) {
    reflexDR.identifier[fillerIdIdx].value = randomString;
  }

  // remove existing id and hl7 extension and basedOn
  // in bundled orders world we wont know which test in the bundle triggered the reflex test, so no basedOn
  delete reflexDR.id;
  delete reflexDR.basedOn;

  const drFullUrl = `urn:uuid:${randomUUID()}`;
  requests.push({
    method: 'POST',
    fullUrl: drFullUrl,
    url: '/DiagnosticReport',
    resource: reflexDR,
  });

  // old logic
  // mock pdf attachment for reflex
  const pdfAttachmentDR: DiagnosticReport = {
    ...reflexDR,
    code: PDF_ATTACHMENT_CODE,
    meta: { tag: [DR_REFLEX_TAG, LAB_PDF_ATTACHMENT_DR_TAG] },
  };
  const pdfAttachmentObsFullUrl = `urn:uuid:${randomUUID()}`;
  const pdfAttachmentResultRefs = [{ reference: pdfAttachmentObsFullUrl }];
  const newObsResource: Observation = createPdfAttachmentObs();
  requests.push({
    method: 'POST',
    url: '/Observation',
    resource: newObsResource,
    fullUrl: pdfAttachmentObsFullUrl,
  });
  pdfAttachmentDR.result = pdfAttachmentResultRefs;
  requests.push({
    method: 'POST',
    url: '/DiagnosticReport',
    resource: pdfAttachmentDR,
  });

  // new attachment logic
  const projectId = envConfig.PROJECT_ID;
  if (!projectId) throw new Error(`Could not get projectId`);
  const patientRef = serviceRequest.subject.reference?.startsWith('Patient/') ? serviceRequest.subject : undefined;
  const attachmentDocRef = createAttachmentDocRef({
    ENV,
    projectId,
    relatedDiagnosticReportReferences: [{ reference: drFullUrl }],
    encounterRef: serviceRequest?.encounter,
    patientRef,
  });
  requests.push({
    method: 'POST',
    url: '/DocumentReference',
    resource: attachmentDocRef,
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

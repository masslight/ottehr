import { BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { DiagnosticReport, Observation, ServiceRequest } from 'fhir/r4b';
import fs from 'fs';
import { LAB_DR_TYPE_TAG } from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';
import { EXAMPLE_ENVS, LAB_PDF_ATTACHMENT_DR_TAG, PDF_ATTACHMENT_CODE } from './lab-script-consts';
import { createPdfAttachmentObs } from './lab-script-helpers';

// we are updating the logic for handling attachments in on the oystehr side
// they are no longer going to get their own DR
// once that is live we can kill this script

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

  const resultResources = (
    await oystehr.fhir.search({
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

  const requests: BatchInputPostRequest<DiagnosticReport | Observation>[] = [];

  // grab first related diagnostic report thats not a reflex nor pdf attachment
  const drToDuplicate = resultResources.find(
    (resource) =>
      resource.resourceType === 'DiagnosticReport' &&
      !resource.meta?.tag?.some(
        (tag) =>
          tag.system === LAB_DR_TYPE_TAG.system &&
          (tag.display === LAB_DR_TYPE_TAG.display.reflex || tag.display === LAB_DR_TYPE_TAG.display.attachment)
      )
  ) as DiagnosticReport;
  console.log('DiagnosticReport that will be used to make the pdf attachment result DR - ', drToDuplicate.id);

  const obsFullUrl = `urn:uuid:${randomUUID()}`;
  const resultRefs = [{ reference: obsFullUrl }];
  const newObsResource: Observation = createPdfAttachmentObs();
  requests.push({
    method: 'POST',
    url: '/Observation',
    resource: newObsResource,
    fullUrl: obsFullUrl,
  });

  const pdfAttachmentDR: DiagnosticReport = { ...drToDuplicate, code: PDF_ATTACHMENT_CODE };
  pdfAttachmentDR.meta = {
    tag: [LAB_PDF_ATTACHMENT_DR_TAG],
  };
  pdfAttachmentDR.result = resultRefs;

  // remove existing id and basedOn
  delete pdfAttachmentDR.id;
  delete pdfAttachmentDR.basedOn;

  requests.push({
    method: 'POST',
    url: '/DiagnosticReport',
    resource: pdfAttachmentDR,
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

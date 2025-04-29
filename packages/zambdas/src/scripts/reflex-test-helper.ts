import fs from 'fs';
import { getAuth0Token, createOystehrClient } from '../shared';
import { BatchInputPostRequest } from '@oystehr/sdk';
import { LAB_DR_TYPE_TAG } from 'utils';
import { DiagnosticReport, CodeableConcept, Observation } from 'fhir/r4b';
import { randomUUID } from 'crypto';

const VALID_ENVS = ['local', 'testing', 'development', 'dev', 'staging'];
const REFLEX_TEST_CODE: CodeableConcept = {
  "coding": [
    {
      "code": "3051-0",
      "system": "http://loinc.org",
      "display": "Free T3, Blood"
    }
  ]
};

const checkEnvPassedIsValid = (env: string | undefined): boolean => {
  if (!env) return false;
  return VALID_ENVS.includes(env);
};

const main = async (): Promise<void> => {
  const ENV = process.argv[2];
  const serviceRequestId = process.argv[3];

  if (!checkEnvPassedIsValid(ENV)) {
    console.log(`exiting, ENV variable passed is not valid\nUsage: npm run create-sr-resources [${VALID_ENVS.join(' | ')}]\n`);
    process.exit(1);
  }
  const envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  const token = await getAuth0Token(envConfig);
  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehr = createOystehrClient(token, envConfig);

  const serviceRequest = await oystehr.fhir.get({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  })
  if (!serviceRequest) {
    console.log(`exiting, no service request found with that ID in this env\n`);
    process.exit(1);
  }

  const resultResources = (await oystehr.fhir.search({
    resourceType: 'DiagnosticReport',
    params: [
      { 
        name: 'based-on',
        value: `ServiceRequest/${serviceRequestId}`
      },
      {
        name: '_include:iterate',
        value: 'DiagnosticReport:result'
      }
    ]
  })).unbundle();
  if (!resultResources.length || !resultResources) {
    console.log(`exiting, no diagnostic reports found for that service request in this env\n`);
    process.exit(1);
  }

  const requests: BatchInputPostRequest<DiagnosticReport | Observation>[] = [];

  // grab first related diagnostic report thats not a relfex test
  const drToDuplicate = resultResources.find((resource) => resource.resourceType === 'DiagnosticReport' && !resource.meta?.tag?.some((tag) => tag.system === LAB_DR_TYPE_TAG.system && tag.display === LAB_DR_TYPE_TAG.display.reflex)) as DiagnosticReport;
  console.log('DiagnosticReport that will be used to make the reflex test DR - ', drToDuplicate.id);

  const relatedObservations: Observation[] = [];
  drToDuplicate.result?.forEach((result) => {
    const obsID = result.reference?.replace('Observation/', '');
    const observationReturned = resultResources.find((resource) => resource.resourceType === 'Observation' && resource.id === obsID) as Observation;
    relatedObservations.push(observationReturned);
  })
  const resultRefsForReflexTest: DiagnosticReport['result'] = [];
  relatedObservations.forEach((obs) => {
    const obsFullUrl = `urn:uuid:${randomUUID()}`;
    resultRefsForReflexTest.push({ reference: obsFullUrl })
    const newObsResource = {...obs}
    delete newObsResource.id;
    delete newObsResource.meta;
    requests.push({
      method: 'POST',
      url: '/Observation',
      resource: newObsResource,
      fullUrl: obsFullUrl,
    })
  })

  const reflexDR: DiagnosticReport = {...drToDuplicate, code: REFLEX_TEST_CODE }
  reflexDR.meta = {}
  reflexDR.meta.tag = [{ system: LAB_DR_TYPE_TAG.system, display: LAB_DR_TYPE_TAG.display.reflex }]
  reflexDR.result = resultRefsForReflexTest;
  delete reflexDR.extension
  delete reflexDR.id

  requests.push({
    method: 'POST',
    url: '/DiagnosticReport',
    resource: reflexDR
  })

  console.log('making transaction request\n');
  const bundle = await oystehr.fhir.transaction({ requests });

  console.log('Successfully created all resources:');
  bundle.entry?.forEach((entry) => {
    console.log(`${entry.resource?.resourceType}/${entry.resource?.id}`);
  });
}

main().catch((error) => {
  console.log(error, JSON.stringify(error, null, 2));
  throw error;
});

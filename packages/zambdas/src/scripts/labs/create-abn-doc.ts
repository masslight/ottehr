import { DocumentReference, ServiceRequest } from 'fhir/r4b';
import fs from 'fs';
import { createOystehrClient, getAuth0Token } from '../../shared';
import { createABNDocRef } from './lab-script-helpers';

// Creates an ABN Document Reference linked to the service request passed as a param
// npm run mock-abn-doc ['local' | 'dev' | 'development' | 'testing' | 'staging'] [serviceRequest Id]

const EXAMPLE_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];

const main = async (): Promise<void> => {
  if (process.argv.length !== 4) {
    console.log(`exiting, incorrect number of arguments passed\n`);
    console.log(`Usage: npm run mock-abn-doc [${EXAMPLE_ENVS.join(' | ')}] [serviceRequest Id]\n`);
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

  const projectId = envConfig.PROJECT_ID;
  if (!projectId) throw new Error(`Could not get projectId`);
  const patientRef = serviceRequest.subject.reference?.startsWith('Patient/') ? serviceRequest.subject : undefined;
  const attachmentDocRef = createABNDocRef({
    ENV,
    projectId,
    relatedServiceRequestReferences: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
    encounterRef: serviceRequest?.encounter,
    patientRef,
  });

  console.log('making transaction request');
  const result = await oystehr.fhir.create<DocumentReference>(attachmentDocRef);

  console.log('Successfully created the ABN doc ref:', `${result.resourceType}/${result.id}`);
};

main().catch((error) => {
  console.log(error, JSON.stringify(error, null, 2));
  throw error;
});

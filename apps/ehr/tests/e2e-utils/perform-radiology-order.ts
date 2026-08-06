/**
 * Drives a local in-house radiology order from `pending` to `performed` by replaying the AdvaPACS
 * ServiceRequest callback against the local zambda server — the same thing AdvaPACS does once the
 * image is acquired. Useful for exercising the performed-status UI (e.g. "Performed by") without a
 * real study in the AdvaPACS integration environment.
 *
 * Usage (zambdas local server must be running on port 3000):
 *   npx tsx apps/ehr/tests/e2e-utils/perform-radiology-order.ts <serviceRequestId>
 *
 * The serviceRequestId is in the order-details URL:
 *   /in-person/<appointmentId>/radiology/<serviceRequestId>/order-details
 *
 * Credentials come from packages/zambdas/.env/zambda-secrets-local.json (the same M2M client the
 * local zambdas use), so this needs no e2e test config.
 */

import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { ACCESSION_NUMBER_CODE_SYSTEM } from 'utils';

const LOCAL_WEBHOOK_URL = 'http://localhost:3000/local/zambda/radiology-pacs-webhook/execute-public';
const SECRETS_PATH = './packages/zambdas/.env/zambda-secrets-local.json';

const serviceRequestId = process.argv[2];
if (!serviceRequestId) {
  console.error('❌ Usage: npx tsx apps/ehr/tests/e2e-utils/perform-radiology-order.ts <serviceRequestId>');
  process.exit(1);
}

const secrets = JSON.parse(readFileSync(SECRETS_PATH, 'utf-8'));
const required = [
  'AUTH0_ENDPOINT',
  'AUTH0_CLIENT',
  'AUTH0_SECRET',
  'AUTH0_AUDIENCE',
  'FHIR_API',
  'PROJECT_API',
  'ADVAPACS_WEBHOOK_SECRET',
];
const missing = required.filter((key) => !secrets[key]);
if (missing.length) {
  console.error(`❌ ${SECRETS_PATH} is missing: ${missing.join(', ')}`);
  process.exit(1);
}

const getM2MToken = async (): Promise<string> => {
  const response = await fetch(secrets.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: secrets.AUTH0_CLIENT,
      client_secret: secrets.AUTH0_SECRET,
      audience: secrets.AUTH0_AUDIENCE,
    }),
  });
  if (!response.ok) {
    throw new Error(`Auth0 token request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()).access_token;
};

async function performOrder(): Promise<void> {
  const oystehr = new Oystehr({
    accessToken: await getM2MToken(),
    services: { fhirApiUrl: secrets.FHIR_API, projectApiUrl: secrets.PROJECT_API },
  });

  const serviceRequest = await oystehr.fhir.get<ServiceRequest>({
    resourceType: 'ServiceRequest',
    id: serviceRequestId,
  });
  console.log(`Found ServiceRequest/${serviceRequestId} with status "${serviceRequest.status}"`);

  if (serviceRequest.status === 'completed') {
    console.log('✅ Already completed — the order is at "performed" (or later, if reports exist).');
    return;
  }

  const accessionNumber = serviceRequest.identifier?.find((i) => i.system === ACCESSION_NUMBER_CODE_SYSTEM)?.value;
  if (!accessionNumber) {
    throw new Error('ServiceRequest has no accession number identifier — is this an in-house radiology order?');
  }

  // Only `identifier` (for the accession-number match) and `status` matter to the handler; the rest is
  // shaped like a real AdvaPACS ServiceRequest callback.
  const response = await fetch(LOCAL_WEBHOOK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secrets.ADVAPACS_WEBHOOK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'ServiceRequest',
      id: 'local-mock-advapacs-service-request',
      status: 'completed',
      intent: 'order',
      subject: serviceRequest.subject,
      identifier: serviceRequest.identifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
  }

  const updated = await oystehr.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: serviceRequestId });
  console.log(`\n✅ ServiceRequest status is now "${updated.status}" — the order shows as "performed" in the EHR.`);
  console.log('Reload the order-details page to see the "Performed by" select.');
}

await performOrder().catch((error) => {
  console.error('❌ Failed to mark the radiology order as performed:', error);
  process.exit(1);
});

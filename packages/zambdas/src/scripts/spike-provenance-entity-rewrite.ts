import { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { FhirResource, Organization, Provenance } from 'fhir/r4b';
import fs from 'fs';
import { CLAIM_PROVENANCE_CHANGE_REF_URL, Secrets } from 'utils';
import { createBillingClient } from '../billing/shared';
import { getAuth0Token } from '../shared';

// Spike: verify that Oystehr's FHIR transaction processing rewrites urn:uuid references in
// Provenance.entity[].what.reference — not just Provenance.target — when the transaction creates
// the referenced resource under that fullUrl. The claim-history design stores each change's raw
// references as entity entries (see src/billing/provenance.ts) and relies on this rewriting to
// turn the rules engine's temporary urns into real ids inside its single persistence transaction.
//
// Run against a dev environment: npm run spike-provenance-entity-rewrite <env>
// Creates one Organization and one Provenance, checks the stored references, then deletes both.
// Exits non-zero (FAIL) if entity.what still holds the urn — in that case the single-transaction
// persistence must not ship; fall back to the two-phase design.

const main = async (): Promise<void> => {
  const env = process.argv[2];
  if (!env) throw new Error('Usage: npm run spike-provenance-entity-rewrite <env>');
  const secrets = JSON.parse(fs.readFileSync(`../../config/.env/${env}.json`, 'utf8')) as Secrets;
  const token = await getAuth0Token(secrets);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createBillingClient(token, secrets);

  const urn = `urn:uuid:${randomUUID()}`;
  const organization: Organization = {
    resourceType: 'Organization',
    name: 'ZZZ spike-provenance-entity-rewrite (safe to delete)',
    active: false,
  };
  const provenance: Provenance = {
    resourceType: 'Provenance',
    target: [{ reference: urn }],
    recorded: new Date().toISOString(),
    agent: [{ who: { display: 'spike-provenance-entity-rewrite' } }],
    // Mirror the exact shape claim-history change-ref entities use.
    entity: [
      {
        role: 'derivation',
        what: { reference: urn },
        extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'billingProvider|new|0' }],
      },
    ],
  };
  const requests: BatchInputRequest<FhirResource>[] = [
    { method: 'POST', url: '/Organization', resource: organization, fullUrl: urn },
    { method: 'POST', url: '/Provenance', resource: provenance },
  ];

  console.log(`POSTing Organization (fullUrl ${urn}) + Provenance referencing it in one transaction...`);
  const tx = await oystehr.fhir.transaction<FhirResource>({ requests });
  const entries = (tx.entry ?? []).map((e) => e.resource);
  const createdOrganization = entries.find((r): r is Organization => r?.resourceType === 'Organization');
  const createdProvenance = entries.find((r): r is Provenance => r?.resourceType === 'Provenance');
  if (!createdOrganization?.id || !createdProvenance?.id) {
    throw new Error(`Transaction did not return both created resources: ${JSON.stringify(tx)}`);
  }
  const expectedReference = `Organization/${createdOrganization.id}`;

  try {
    // Judge the stored state, not the transaction echo.
    const stored = await oystehr.fhir.get<Provenance>({ resourceType: 'Provenance', id: createdProvenance.id });
    const targetReference = stored.target?.[0]?.reference;
    const entityReference = stored.entity?.[0]?.what?.reference;
    console.log(`expected reference:       ${expectedReference}`);
    console.log(`stored target[0]:         ${targetReference}`);
    console.log(`stored entity[0].what:    ${entityReference}`);

    const targetRewritten = targetReference === expectedReference;
    const entityRewritten = entityReference === expectedReference;
    if (targetRewritten && entityRewritten) {
      console.log('PASS: both target and entity.what were rewritten to the created id.');
    } else {
      console.error(
        `FAIL: ${targetRewritten ? '' : 'target NOT rewritten. '}${entityRewritten ? '' : 'entity.what NOT rewritten.'}`
      );
      process.exitCode = 1;
    }
  } finally {
    console.log('cleaning up spike resources...');
    await oystehr.fhir.delete({ resourceType: 'Provenance', id: createdProvenance.id });
    await oystehr.fhir.delete({ resourceType: 'Organization', id: createdOrganization.id });
  }
};

main().catch((error) => {
  console.error('error', error);
  process.exit(1);
});

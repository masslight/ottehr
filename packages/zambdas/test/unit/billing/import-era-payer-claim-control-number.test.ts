import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { applyPatch, Operation } from 'fast-json-patch';
import { Binary, Claim, ClaimResponse, Coverage, FhirResource, Identifier, PaymentReconciliation } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_INSURANCE_ORD_SYSTEM,
  ERA_CLAIM_RESPONSE_TYPE_TAG,
  ERA_ICN_EXTENSION,
  getPayerClaimControlNumber,
} from '../../../src/billing/shared';
import * as updateClaimFromEra from '../../../src/subscriptions/claim-response/sub-claim-response-update-claim-from-era';
import * as tagEraResources from '../../../src/subscriptions/payment-reconciliation/sub-tag-era-resources';
import { claimHistoryEntries, provenanceChanges } from './claim-history-fixtures';

// The "Import ERA" dialog sends the 835 to import-era, and Oystehr writes the remit: a PaymentReconciliation,
// its era-processing Provenance, and a ClaimResponse per claim carrying the payer's ICN (CLP07), matched to
// the claim it paid. sub-tag-era-resources then gives them the billing tag, and that new version of the
// ClaimResponse fires sub-claim-response-update-claim-from-era, which records the ICN on the claim as the
// payer claim control number of the insurance whose payer sent the remit.

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/billing/provenance')>()),
  resolveClaimActor: vi.fn(async () => ({ who: { reference: 'Device/system' } })),
}));

// the ERA converter names the payer by its RCM payer URL, as a billing Coverage's payor does
const PRIMARY_PAYER = 'https://rcm-api.zapehr.com/v1/payer/payer-uhc';
const SECONDARY_PAYER = 'https://rcm-api.zapehr.com/v1/payer/payer-aetna';
const ICN = '2226189001234';

const transaction = vi.fn();
const get = vi.fn();
const history = vi.fn();
const search = vi.fn();
const oystehr = { fhir: { transaction, get, history, search } } as unknown as Oystehr;

const coverage = (index: number, payer: string): Coverage => ({
  resourceType: 'Coverage',
  id: `coverage-${index + 1}`,
  status: 'active',
  beneficiary: { reference: 'Patient/patient-1' },
  payor: [{ reference: payer }],
});

const billingClaim = (payers: string[], identifier: Identifier[] = []): Claim => ({
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  type: { coding: [{ code: 'professional' }] },
  use: 'claim',
  patient: { reference: 'Patient/patient-1' },
  created: '2026-08-15',
  provider: { reference: 'Organization/org-1' },
  priority: { coding: [{ code: 'normal' }] },
  insurance: payers.map((_, i) => ({
    sequence: i + 1,
    focal: i === 0,
    coverage: { reference: `Coverage/coverage-${i + 1}` },
  })),
  identifier,
  meta: {
    versionId: '1',
    tag: [BILLING_RESOURCE_TAG, { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer }],
  },
});

const paymentReconciliation: PaymentReconciliation = {
  resourceType: 'PaymentReconciliation',
  id: 'era-1',
  status: 'active',
  created: '2026-09-13',
  paymentDate: '2026-09-12',
  paymentAmount: { value: 50, currency: 'USD' },
  meta: { versionId: '1' },
};

// The ClaimResponse Oystehr writes for a claim on the imported 835, before sub-tag-era-resources tags it.
const importedClaimResponse = (payer: string, icn: string | null = ICN): ClaimResponse => ({
  resourceType: 'ClaimResponse',
  id: 'response-1',
  meta: {
    versionId: '1',
    lastUpdated: '2026-09-13T10:00:00.000Z',
    tag: [ERA_CLAIM_RESPONSE_TYPE_TAG],
  },
  extension: [
    { url: 'https://extensions.fhir.oystehr.com/era-status-code', valueString: '1' },
    ...(icn ? [{ url: ERA_ICN_EXTENSION, valueString: icn }] : []),
  ],
  status: 'active',
  type: { coding: [{ code: 'professional' }] },
  use: 'claim',
  patient: { reference: 'Patient/patient-1' },
  created: '2026-09-13',
  insurer: { reference: payer, display: 'Some Payer' },
  outcome: 'complete',
  request: { reference: 'Claim/claim-1' },
});

const patchOperations = (request: BatchInputRequest<FhirResource>): Operation[] =>
  JSON.parse(atob(((request as { resource: Binary }).resource.data ?? '') as string));

// sub-tag-era-resources tags the imported remit; returns the ClaimResponse version its patch leaves.
const tagImportedEra = async (imported: ClaimResponse): Promise<ClaimResponse> => {
  search.mockResolvedValue({ unbundle: () => [paymentReconciliation] });
  await tagEraResources.performEffect(oystehr, {
    paymentReconciliationId: 'era-1',
    provenances: [],
    claimResponses: [imported],
  });
  const requests: BatchInputRequest<FhirResource>[] = transaction.mock.calls.at(-1)?.[0].requests ?? [];
  const tagPatch = requests.find((request) => request.url === '/ClaimResponse/response-1');
  if (!tagPatch) throw new Error('sub-tag-era-resources did not tag the ClaimResponse');
  const tagged: ClaimResponse = applyPatch(structuredClone(imported), patchOperations(tagPatch)).newDocument;
  return { ...tagged, meta: { ...tagged.meta, versionId: '2', lastUpdated: '2026-09-13T10:00:05.000Z' } };
};

// Imports the remit and runs sub-claim-response-update-claim-from-era as the tagged version fires it.
const importEra = async (claim: Claim, payers: string[], imported: ClaimResponse): Promise<void> => {
  const tagged = await tagImportedEra(imported);
  transaction.mockClear();

  get.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
    resourceType === 'ClaimResponse' ? tagged : claim
  );
  history.mockResolvedValue({ entry: [{ resource: tagged }, { resource: imported }] });
  search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
    unbundle: () => (resourceType === 'Coverage' ? payers.map((payer, i) => coverage(i, payer)) : []),
  }));
  const validated = await updateClaimFromEra.complexValidation(oystehr, 'response-1', '2', {} as Secrets);
  // the untagged version Oystehr wrote didn't qualify, so tagging it is what matches it to the claim
  expect(validated.newlyMatched).toBe(true);
  await updateClaimFromEra.performEffect(oystehr, validated);
};

const lastRequests = (): BatchInputRequest<FhirResource>[] => transaction.mock.calls.at(-1)?.[0].requests ?? [];

// The identifiers the subscription writes to the Claim, or undefined when it leaves them alone.
const writtenIdentifiers = (): Identifier[] | undefined => {
  const patch = lastRequests().find((request) => request.method === 'PATCH' && request.url === '/Claim/claim-1');
  const operations = patch ? patchOperations(patch) : [];
  return (operations.find((op) => op.path === '/identifier') as { value: Identifier[] } | undefined)?.value;
};

const claimUpdateChanges = (): ReturnType<typeof provenanceChanges> =>
  claimHistoryEntries(lastRequests())
    .filter(
      (entry) =>
        entry.target?.[0]?.reference === 'Claim/claim-1' &&
        entry.activity?.coding?.[0]?.code === CLAIM_PROVENANCE_ACTIVITY.update.code
    )
    .flatMap(provenanceChanges);

const pccn = (value: string, insurance?: string): Identifier => ({
  system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  value,
  ...(insurance
    ? { type: { coding: [{ system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_INSURANCE_ORD_SYSTEM, code: insurance }] } }
    : {}),
});

describe('ERA imported with the Import ERA dialog sets the payer claim control number', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockResolvedValue({ entry: [] });
  });

  it("records the ICN as the primary payer's PCCN when the primary payer remitted", async () => {
    const payers = [PRIMARY_PAYER, SECONDARY_PAYER];
    const claim = billingClaim(payers);

    await importEra(claim, payers, importedClaimResponse(PRIMARY_PAYER));

    const identifier = writtenIdentifiers();
    expect(identifier).toEqual([pccn(ICN, 'primary')]);
    expect(getPayerClaimControlNumber({ ...claim, identifier }, 'primary')).toBe(ICN);
    expect(getPayerClaimControlNumber({ ...claim, identifier }, 'secondary')).toBeUndefined();
    expect(claimUpdateChanges()).toEqual([
      { field: 'payerClaimControlNumber', label: 'Payer Claim Control Number', previousValue: null, newValue: ICN },
    ]);
  });

  it("records the ICN as the secondary payer's PCCN when the secondary payer remitted, keeping the primary's", async () => {
    const payers = [PRIMARY_PAYER, SECONDARY_PAYER];
    const claim = billingClaim(payers, [{ system: 'other', value: 'keep' }, pccn('PRIMARY-ICN')]);

    await importEra(claim, payers, importedClaimResponse(SECONDARY_PAYER));

    expect(writtenIdentifiers()).toEqual([
      { system: 'other', value: 'keep' },
      pccn('PRIMARY-ICN'),
      pccn(ICN, 'secondary'),
    ]);
    expect(claimUpdateChanges()).toEqual([
      {
        field: 'secondaryPayerClaimControlNumber',
        label: 'Secondary Payer Claim Control Number',
        previousValue: null,
        newValue: ICN,
      },
    ]);
  });

  it("replaces the remitting payer's earlier PCCN, a legacy type-less one included", async () => {
    const payers = [PRIMARY_PAYER, SECONDARY_PAYER];
    const claim = billingClaim(payers, [pccn('OLD-ICN'), pccn('SECONDARY-ICN', 'secondary')]);

    await importEra(claim, payers, importedClaimResponse(PRIMARY_PAYER));

    expect(writtenIdentifiers()).toEqual([pccn('SECONDARY-ICN', 'secondary'), pccn(ICN, 'primary')]);
    expect(claimUpdateChanges()).toEqual([
      {
        field: 'payerClaimControlNumber',
        label: 'Payer Claim Control Number',
        previousValue: 'OLD-ICN',
        newValue: ICN,
      },
    ]);
  });

  it('leaves the claim identifiers alone when the remit carries no ICN', async () => {
    const payers = [PRIMARY_PAYER];
    const claim = billingClaim(payers, [pccn('PRIMARY-ICN', 'primary')]);

    await importEra(claim, payers, importedClaimResponse(PRIMARY_PAYER, null));

    expect(transaction).toHaveBeenCalled();
    expect(writtenIdentifiers()).toBeUndefined();
  });
});

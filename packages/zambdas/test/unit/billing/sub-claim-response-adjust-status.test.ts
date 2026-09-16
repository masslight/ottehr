import Oystehr, { BatchInputBinaryPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Binary, Claim, ClaimResponse, Coding, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import {
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComplexValidationOutput,
  performEffect,
} from '../../../src/subscriptions/claim-response/sub-claim-response-adjust-status';

const transaction = vi.fn();
const get = vi.fn();
const oystehr = {
  fhir: {
    transaction,
    get,
  },
} as unknown as Oystehr;

const agent: ProvenanceAgent = {
  who: { reference: 'Device/system' },
};

const claimTag = (code: string): Coding => ({
  system: CLAIM_TAG_SYSTEM,
  code,
});

const claimWith = (tags: Coding[], insuranceCount = 2): Claim => ({
  resourceType: 'Claim',
  id: 'claim-1',
  status: 'active',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  patient: {
    reference: 'Patient/patient-1',
  },
  created: '2026-09-01',
  provider: {
    reference: 'Organization/org-1',
  },
  priority: {
    coding: [
      {
        code: 'normal',
      },
    ],
  },
  insurance: Array.from({ length: insuranceCount }, (_, i) => ({
    sequence: i + 1,
    focal: i === 0,
    coverage: { reference: `Coverage/coverage-${i}` },
  })),
  meta: {
    versionId: '1',
    tag: [
      {
        system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
        code: AR_STAGE.insurancePayer,
      },
      ...tags,
    ],
  },
});

// A ClaimResponse the payer forwarded to the secondary insurer (Medicare remark MA18).
const forwardedResponse: ClaimResponse = {
  resourceType: 'ClaimResponse',
  id: 'response-1',
  status: 'active',
  type: {
    coding: [
      {
        code: 'professional',
      },
    ],
  },
  use: 'claim',
  patient: {
    reference: 'Patient/patient-1',
  },
  created: '2026-09-02',
  insurer: {
    reference: 'Organization/insurer-1',
  },
  outcome: 'complete',
  extension: [
    {
      url: 'https://extensions.fhir.oystehr.com/era-outpatient-remark-code-1',
      valueString: 'MA18',
    },
  ],
};

const notForwardedResponse: ClaimResponse = {
  ...forwardedResponse,
  extension: [],
};

const validated = (claim: Claim, claimResponse: ClaimResponse): ComplexValidationOutput =>
  ({
    claim,
    claimResponse,
    claimResponseId: 'response-1',
    agent,
  }) as unknown as ComplexValidationOutput;

// The meta.tag array the committed transaction actually writes, read back out of the PATCH Binary.
const writtenTags = (): Coding[] => {
  const requests = transaction.mock.calls.at(-1)?.[0].requests as BatchInputRequest<FhirResource>[];
  const patch = requests.find((r) => r.method === 'PATCH') as BatchInputBinaryPatchRequest<FhirResource>;
  const operations = JSON.parse(atob((patch.resource as Binary).data!)) as Operation[];
  const tagOp = operations.find((op) => op.path === '/meta/tag');
  return (tagOp as { value: Coding[] }).value;
};

const codesInSystem = (tags: Coding[], system: string): string[] =>
  tags.filter((t) => t.system === system).map((t) => t.code ?? '');

describe('sub-claim-response-adjust-status performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockResolvedValue({ entry: [] });
  });

  // Regression: these were written as one index-keyed patch op per tag, computed against the same
  // snapshot. Both resolved to the same meta.tag slot, so the second silently replaced the first.
  it('applies both secondary-submission tags without dropping either', async () => {
    await performEffect(oystehr, validated(claimWith([]), forwardedResponse));

    expect(codesInSystem(writtenTags(), CLAIM_TAG_SYSTEM)).toEqual([
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
    ]);
    expect(codesInSystem(writtenTags(), CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus)).toEqual(['submitted']);
  });

  it('holds the claim when the payer did not forward it', async () => {
    await performEffect(oystehr, validated(claimWith([]), notForwardedResponse));

    expect(codesInSystem(writtenTags(), CLAIM_TAG_SYSTEM)).toEqual([SECONDARY_SUBMISSION_TAG_NAME, HOLD_TAG_NAME]);
    expect(codesInSystem(writtenTags(), CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus)).toEqual(['adjudicated']);
  });

  // Regression: the index-keyed ops overwrote whichever tag already occupied the slot.
  it("preserves a biller's own tag that the claim already carries", async () => {
    await performEffect(oystehr, validated(claimWith([claimTag('customTag')]), forwardedResponse));

    expect(codesInSystem(writtenTags(), CLAIM_TAG_SYSTEM)).toEqual([
      'customTag',
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
    ]);
  });

  // FHIR subscriptions are at-least-once, so the same ClaimResponse can arrive twice.
  it('does not duplicate tags the claim already carries when redelivered', async () => {
    const alreadyTagged = claimWith([claimTag(SECONDARY_SUBMISSION_TAG_NAME), claimTag(HOLD_TAG_NAME)]);

    await performEffect(oystehr, validated(alreadyTagged, notForwardedResponse));

    expect(codesInSystem(writtenTags(), CLAIM_TAG_SYSTEM)).toEqual([SECONDARY_SUBMISSION_TAG_NAME, HOLD_TAG_NAME]);
  });

  it('writes no secondary-submission tags for a single-insurer claim', async () => {
    await performEffect(oystehr, validated(claimWith([], 1), forwardedResponse));

    expect(codesInSystem(writtenTags(), CLAIM_TAG_SYSTEM)).toEqual([]);
    expect(codesInSystem(writtenTags(), CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus)).toEqual(['adjudicated']);
  });

  it('does nothing when the claim is not at the insurance-payer AR stage', async () => {
    const patientArClaim = claimWith([]);
    patientArClaim.meta!.tag = [
      {
        system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
        code: AR_STAGE.patient,
      },
    ];

    await performEffect(oystehr, validated(patientArClaim, forwardedResponse));

    expect(transaction).not.toHaveBeenCalled();
  });

  it('does nothing when the claim is already adjudicated', async () => {
    const adjudicated = claimWith([]);
    adjudicated.meta!.tag!.push({
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: 'adjudicated',
    });

    await performEffect(oystehr, validated(adjudicated, forwardedResponse));

    expect(transaction).not.toHaveBeenCalled();
  });

  it('re-reads the claim and retries once the commit hits a version conflict', async () => {
    const conflict = Object.assign(new Error('Precondition Failed'), { code: 412 });
    transaction.mockRejectedValueOnce(conflict).mockResolvedValue({ entry: [] });
    // The concurrent writer added a tag between our read and our write.
    get.mockResolvedValue(claimWith([claimTag('customTag')]));

    await performEffect(oystehr, validated(claimWith([]), forwardedResponse));

    expect(get).toHaveBeenCalledWith({
      resourceType: 'Claim',
      id: 'claim-1',
    });
    expect(codesInSystem(writtenTags(), CLAIM_TAG_SYSTEM)).toEqual([
      'customTag',
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
    ]);
  });
});

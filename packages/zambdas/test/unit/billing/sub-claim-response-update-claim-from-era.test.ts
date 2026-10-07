import Oystehr, { BatchInputBinaryPatchRequest, BatchInputJSONPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Binary, Claim, ClaimResponse, Coding, FhirResource, Identifier, ProvenanceAgent } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { Secrets } from 'utils/lib/secrets';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import {
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
} from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  ERA_CLAIM_RESPONSE_TYPE_TAG,
  ERA_ICN_EXTENSION,
} from '../../../src/billing/shared';
import {
  complexValidation,
  ComplexValidationOutput,
  performEffect,
} from '../../../src/subscriptions/claim-response/sub-claim-response-update-claim-from-era';
import { validateRequestParameters } from '../../../src/subscriptions/claim-response/sub-claim-response-update-claim-from-era/validateRequestParameters';

vi.mock('../../../src/billing/provenance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/billing/provenance')>()),
  resolveClaimActor: vi.fn(async () => ({ who: { reference: 'Device/system' } })),
}));

const transaction = vi.fn();
const get = vi.fn();
const history = vi.fn();
const oystehr = {
  fhir: {
    transaction,
    get,
    history,
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
    newlyMatched: true,
  }) as unknown as ComplexValidationOutput;

// The meta.tag array the committed transaction actually writes, read back out of the PATCH Binary.
const writtenTags = (): Coding[] => {
  const requests = transaction.mock.calls.at(-1)?.[0].requests as BatchInputRequest<FhirResource>[];
  const patch = requests.find((r) => r.method === 'PATCH') as BatchInputBinaryPatchRequest<FhirResource>;
  const operations = JSON.parse(atob((patch.resource as Binary).data!)) as Operation[];
  const tagOp = operations.find((op) => op.path === '/meta/tag');
  return (tagOp as { value: Coding[] }).value;
};

const writtenIdentifiers = (): Identifier[] => {
  const requests = transaction.mock.calls.at(-1)?.[0].requests as BatchInputRequest<FhirResource>[];
  const patch = requests.find((r) => r.method === 'PATCH' && 'operations' in r && r.operations) as
    | BatchInputJSONPatchRequest
    | undefined;
  const identifiers = patch?.operations.find((op) => op.path === '/identifier');
  return (identifiers as { value: Identifier[] } | undefined)?.value ?? [];
};

const codesInSystem = (tags: Coding[], system: string): string[] =>
  tags.filter((t) => t.system === system).map((t) => t.code ?? '');

const versionConflict = (): Error =>
  Object.assign(new Error('Precondition Failed'), {
    code: 412,
  });

describe('sub-claim-response-update-claim-from-era performEffect', () => {
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

  it('leaves the claim alone when the response was edited rather than newly matched', async () => {
    await performEffect(oystehr, { ...validated(claimWith([]), forwardedResponse), newlyMatched: false });

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
    transaction.mockRejectedValueOnce(versionConflict()).mockResolvedValue({ entry: [] });
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

  // Regression: the conflicting writer can be another ClaimResponse landing 'adjudicated'. The retry
  // re-read the claim but kept the plan built before the conflict, walking the status back to
  // 'submitted' for a forwarded response.
  it('skips the retry when a concurrent writer adjudicated the claim', async () => {
    transaction.mockRejectedValueOnce(versionConflict()).mockResolvedValue({ entry: [] });
    const adjudicated = claimWith([]);
    adjudicated.meta!.tag!.push({
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: 'adjudicated',
    });
    get.mockResolvedValue(adjudicated);

    await performEffect(oystehr, validated(claimWith([]), forwardedResponse));

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  // Regression: same stale plan re-applied the Hold tag to a claim the biller had just moved on.
  it('skips the retry when a concurrent writer moved the claim off the insurance-payer stage', async () => {
    transaction.mockRejectedValueOnce(versionConflict()).mockResolvedValue({ entry: [] });
    const patientArClaim = claimWith([]);
    patientArClaim.meta!.tag = [
      {
        system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
        code: AR_STAGE.patient,
      },
    ];
    get.mockResolvedValue(patientArClaim);

    await performEffect(oystehr, validated(claimWith([]), notForwardedResponse));

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('does not add a payer claim control number if claim response does not have one', async () => {
    await performEffect(oystehr, validated(claimWith([]), notForwardedResponse));
    const identifiers = writtenIdentifiers();
    expect(identifiers).toEqual([]);
  });

  it('adds a payer claim control number if claim response has one', async () => {
    await performEffect(
      oystehr,
      validated(claimWith([]), {
        ...notForwardedResponse,
        extension: [...(notForwardedResponse.extension ?? []), { url: ERA_ICN_EXTENSION, valueString: 'PCCN-12345' }],
      })
    );
    const identifiers = writtenIdentifiers();
    expect(identifiers).toEqual([{ system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM, value: 'PCCN-12345' }]);
  });
});

describe('sub-claim-response-update-claim-from-era complexValidation', () => {
  const ERA_TAGS = [
    { system: BILLING_RESOURCE_TAG.system, code: BILLING_RESOURCE_TAG.code },
    ERA_CLAIM_RESPONSE_TYPE_TAG,
  ];
  // one stored version of the response; by default tagged as a billing ERA claim and matched to claim-1
  const version = (versionId: string, minute: number, overrides: Partial<ClaimResponse> = {}): ClaimResponse => ({
    ...notForwardedResponse,
    request: { reference: 'Claim/claim-1' },
    ...overrides,
    meta: { versionId, lastUpdated: `2026-10-05T12:${String(minute).padStart(2, '0')}:00.000Z`, tag: ERA_TAGS },
  });
  const storedAs = (...versions: ClaimResponse[]): void => {
    const latest = [...versions].sort((a, b) =>
      (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? '')
    )[0];
    get.mockImplementation(async ({ resourceType }: { resourceType: string }) =>
      resourceType === 'Claim' ? claimWith([]) : latest
    );
    history.mockResolvedValue({ entry: versions.map((resource) => ({ resource })) });
  };
  const newlyMatched = async (firedVersionId?: string): Promise<boolean> =>
    (await complexValidation(oystehr, 'response-1', firedVersionId, {} as Secrets)).newlyMatched;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adjusts the claim for a response created matched to it', async () => {
    storedAs(version('1', 0));
    expect(await newlyMatched('1')).toBe(true);
  });

  it('adjusts it when an imported response gets its billing tag', async () => {
    const untagged = {
      ...version('1', 0),
      meta: { versionId: '1', lastUpdated: '2026-10-05T12:00:00.000Z', tag: [ERA_CLAIM_RESPONSE_TYPE_TAG] },
    };
    storedAs(version('2', 1), untagged);
    expect(await newlyMatched('2')).toBe(true);
  });

  it('adjusts it when a response gets its ERA type tag', async () => {
    const untyped = {
      ...version('1', 0),
      meta: { versionId: '1', lastUpdated: '2026-10-05T12:00:00.000Z', tag: [ERA_TAGS[0]] },
    };
    storedAs(version('2', 1), untyped);
    expect(await newlyMatched('2')).toBe(true);
  });

  it('adjusts it when an unmatched response is matched to the claim', async () => {
    storedAs(version('2', 1), version('1', 0, { request: { reference: '#request' } }));
    expect(await newlyMatched('2')).toBe(true);
  });

  it('leaves the claim alone when a response already matched to it is edited', async () => {
    storedAs(version('2', 1, { extension: [{ url: ERA_ICN_EXTENSION, valueString: 'FIXED-ICN' }] }), version('1', 0));
    expect(await newlyMatched('2')).toBe(false);
  });

  it('judges the version that fired, not an edit saved after it', async () => {
    // history in oldest-first order: matched in version 2, then edited in version 3
    storedAs(version('1', 0, { request: { reference: '#request' } }), version('2', 1), version('3', 2));
    expect(await newlyMatched('2')).toBe(true);
    expect(await newlyMatched('3')).toBe(false);
    // a notification without its version is judged by the latest one
    expect(await newlyMatched(undefined)).toBe(false);
  });

  it('adjusts the claim as before when the fired version is not in the history', async () => {
    storedAs(version('2', 1), version('1', 0));
    expect(await newlyMatched('9')).toBe(true);
  });

  it('reads the fired version from the notification', () => {
    const body = { resourceType: 'ClaimResponse', id: 'response-1', meta: { versionId: '7' } };
    expect(
      validateRequestParameters({ headers: null, body: JSON.stringify(body), secrets: {} as Secrets })
    ).toMatchObject({
      claimResponseId: 'response-1',
      firedVersionId: '7',
    });
  });
});

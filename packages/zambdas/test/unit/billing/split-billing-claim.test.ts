import { Claim, ClaimItem } from 'fhir/r4b';
import { CODE_SYSTEM_HL7_HCPCS } from 'utils/lib/helpers/rcm/constants';
import { CLAIM_STATUS_DATE_EXTENSION_URLS, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it } from 'vitest';
import {
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  CURRENT_STATUS_TAG_SYSTEM,
  EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER,
} from '../../../src/billing/shared';
import { buildSplitClaim, partitionItems, removeSplitLines } from '../../../src/billing/split-billing-claim/index';

const item = (sequence: number, code: string, charges: number, diagnosisSequence?: number[]): ClaimItem => ({
  sequence,
  careTeamSequence: [1],
  diagnosisSequence,
  productOrService: { coding: [{ system: CODE_SYSTEM_HL7_HCPCS, code }] },
  servicedPeriod: { start: `2026-11-0${sequence}` },
  net: { value: charges, currency: 'USD' },
  quantity: { value: 1, unit: 'UN' },
});

const dx = (sequence: number, code: string): NonNullable<Claim['diagnosis']>[number] => ({
  sequence,
  diagnosisCodeableConcept: { coding: [{ code }] },
});

const claim = (): Claim => ({
  resourceType: 'Claim',
  id: 'orig',
  meta: {
    versionId: '4',
    tag: [
      { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
      { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: 'insurance-payer-ar' },
      { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'submitted' },
      { system: 'https://fhir.ottehr.com/billing/claim-tag', code: 'tag-1' },
    ],
  },
  status: 'active',
  type: { coding: [{ code: 'professional' }] },
  use: 'claim',
  created: '2026-11-01',
  patient: { reference: 'Patient/p1' },
  provider: { reference: 'Organization/bp1' },
  priority: { coding: [{ code: 'normal' }] },
  identifier: [
    { system: CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM, value: 'PCN-1' },
    { system: 'https://fhir.ottehr.com/Identifier/claim-encounter-id', value: 'enc-1' },
  ],
  extension: [
    { url: CLAIM_STATUS_DATE_EXTENSION_URLS.insuranceFinalized, valueDate: '2026-11-10' },
    { url: 'https://extensions.fhir.oystehr.com/rcm-claim-release-of-information-code', valueString: 'Y' },
  ],
  insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/c1' } }],
  diagnosis: [dx(1, 'I10'), dx(2, 'E11.9'), dx(3, 'M17.11')],
  supportingInfo: [
    { sequence: 1, category: { coding: [{ code: 'info' }] }, timingDate: '2026-10-30' },
    {
      sequence: 2,
      category: { coding: [{ code: 'attachment' }] },
      valueReference: { reference: 'DocumentReference/d1' },
    },
  ],
  contained: [{ resourceType: 'Practitioner', id: 'ordering-provider-1', name: [{ family: 'Bones' }] }],
  item: [
    item(1, '99213', 150, [1, 2]),
    { ...item(2, 'E0143', 165, [3]), informationSequence: [1, 2] },
    {
      ...item(3, 'L1830', 140, [3, 1]),
      extension: [
        { url: EXTENSION_CLAIM_ITEM_ORDERING_PROVIDER, valueReference: { reference: '#ordering-provider-1' } },
      ],
    },
  ],
  total: { value: 455, currency: 'USD' },
});

describe('split-billing-claim', () => {
  it('rejects unknown lines and moving every line', () => {
    const items = claim().item!;
    expect(() => partitionItems(items, [4])).toThrow();
    expect(() => partitionItems(items, [1, 2, 3])).toThrow();
    const { moved, kept } = partitionItems(items, [2, 3]);
    expect(moved.map((i) => i.sequence)).toEqual([2, 3]);
    expect(kept.map((i) => i.sequence)).toEqual([1]);
  });

  it('builds the new claim with only the moved lines and the diagnoses they point at', () => {
    const original = claim();
    const { moved } = partitionItems(original.item!, [2, 3]);
    const split = buildSplitClaim(original, moved);

    expect(split.id).toBeUndefined();
    expect(split.meta?.versionId).toBeUndefined();
    expect(split.item?.map((i) => [i.sequence, i.productOrService?.coding?.[0]?.code])).toEqual([
      [1, 'E0143'],
      [2, 'L1830'],
    ]);
    expect(split.diagnosis?.map((d) => [d.sequence, d.diagnosisCodeableConcept?.coding?.[0]?.code])).toEqual([
      [1, 'I10'],
      [2, 'M17.11'],
    ]);
    expect(split.item?.map((i) => i.diagnosisSequence)).toEqual([[2], [2, 1]]);
    expect(split.total?.value).toBe(305);
    // the moved ordering provider stays contained on the new claim
    expect(split.contained?.map((r) => r.id)).toEqual(['ordering-provider-1']);
    expect(split.patient).toEqual(original.patient);
    expect(split.insurance).toEqual(original.insurance);
  });

  it('starts the new claim unsubmitted and leaves attachments and the payer control number behind', () => {
    const original = claim();
    const split = buildSplitClaim(original, partitionItems(original.item!, [2]).moved);

    expect(split.status).toBe('draft');
    expect(split.meta?.tag).toEqual(
      expect.arrayContaining([
        { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
        { system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: 'insurance-payer-ar' },
        { system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' },
        { system: 'https://fhir.ottehr.com/billing/claim-tag', code: 'tag-1' },
      ])
    );
    expect(split.meta?.tag).not.toContainEqual({
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: 'submitted',
    });
    expect(split.identifier?.map((i) => i.value)).toEqual(['enc-1']);
    expect(split.extension?.map((e) => e.url)).toEqual([
      'https://extensions.fhir.oystehr.com/rcm-claim-release-of-information-code',
    ]);
    expect(split.supportingInfo?.map((s) => s.sequence)).toEqual([1]);
    expect(split.item?.[0].informationSequence).toEqual([1]);
  });

  it('removes the moved lines from the original and renumbers what is left', () => {
    const original = claim();
    const { kept } = partitionItems(original.item!, [1, 3]);
    removeSplitLines(original, kept);

    expect(original.item?.map((i) => [i.sequence, i.productOrService?.coding?.[0]?.code])).toEqual([[1, 'E0143']]);
    expect(original.total?.value).toBe(165);
    expect(original.contained).toBeUndefined();
    expect(original.diagnosis).toHaveLength(3);
  });
});

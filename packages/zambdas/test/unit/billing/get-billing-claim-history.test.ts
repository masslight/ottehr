import Oystehr from '@oystehr/sdk';
import { Claim, Coverage, Practitioner, Provenance } from 'fhir/r4b';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/get-billing-claim-history';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

const claim: Claim = {
  resourceType: 'Claim',
  id: 'c1',
  status: 'draft',
  type: { coding: [] },
  use: 'claim',
  patient: { reference: 'Patient/p1' },
  insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/cov1' } }],
} as unknown as Claim;

const coverage: Coverage = {
  resourceType: 'Coverage',
  id: 'cov1',
  status: 'active',
  beneficiary: { reference: 'Patient/p1' },
  payor: [],
  subscriber: { reference: 'RelatedPerson/rp1' },
} as Coverage;

const diff = (resourceType: string, changes: unknown): string => JSON.stringify({ resourceType, changes });

const makeOystehr = (provenanceBundle: unknown[]): Oystehr => {
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
    if (resourceType === 'Claim') return Promise.resolve({ unbundle: () => [claim] });
    if (resourceType === 'Coverage') return Promise.resolve({ unbundle: () => [coverage] });
    if (resourceType === 'Provenance') return Promise.resolve({ unbundle: () => provenanceBundle });
    return Promise.resolve({ unbundle: () => [] });
  });
  return { fhir: { search } } as unknown as Oystehr;
};

describe('get-billing-claim-history performEffect', () => {
  it('maps a user-attributed coverage update into a history entry', async () => {
    const practitioner: Practitioner = {
      resourceType: 'Practitioner',
      id: 'u1',
      name: [{ given: ['Jane'], family: 'Doe' }],
    } as Practitioner;
    const provenance: Provenance = {
      resourceType: 'Provenance',
      id: 'prov1',
      recorded: '2026-06-01T10:00:00Z',
      activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.update] },
      target: [{ reference: 'Coverage/cov1' }],
      agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: 'Practitioner/u1' } }],
      extension: [
        {
          url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
          valueString: diff('Coverage', [{ field: 'memberId', label: 'Member ID', previousValue: 'A', newValue: 'B' }]),
        },
      ],
    } as Provenance;

    const { entries } = await performEffect(makeOystehr([provenance, practitioner]), { claimId: 'c1', secrets: null });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      activity: 'Update Coverage',
      resourceType: 'Coverage',
      resourceId: 'cov1',
      actor: { type: 'user' },
      changes: [{ field: 'memberId', label: 'Member ID', previousValue: 'A', newValue: 'B' }],
    });
    expect(entries[0].actor.display).toContain('Doe');
  });

  it('attributes a Device agent as a system actor and sorts newest first', async () => {
    const older: Provenance = {
      resourceType: 'Provenance',
      id: 'old',
      recorded: '2026-05-01T10:00:00Z',
      activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.create] },
      target: [{ reference: 'Claim/c1' }],
      agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: 'Practitioner/u1' } }],
      extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: diff('Claim', []) }],
    } as Provenance;
    const newer: Provenance = {
      resourceType: 'Provenance',
      id: 'new',
      recorded: '2026-06-15T10:00:00Z',
      activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.statusChange] },
      target: [{ reference: 'Claim/c1' }],
      agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.system] }, who: { reference: 'Device/d1' } }],
      extension: [
        {
          url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
          valueString: diff('Claim', [
            { field: 'status.arStage', label: 'AR Stage', previousValue: null, newValue: 'Patient AR' },
          ]),
        },
      ],
    } as Provenance;

    const { entries } = await performEffect(makeOystehr([older, newer]), { claimId: 'c1', secrets: null });

    expect(entries.map((e) => e.id)).toEqual(['new', 'old']);
    expect(entries[0].activity).toBe('Status change');
    expect(entries[0].actor).toMatchObject({ type: 'system', display: CLAIM_RULES_ENGINE_DEVICE_NAME });
    expect(entries[1].activity).toBe('Create Claim');
  });

  it('resolves a provider reference to a friendly name and a screen link', async () => {
    const providerWorkingCopy: Practitioner = {
      resourceType: 'Practitioner',
      id: 'wc1',
      name: [{ given: ['John'], family: 'Smith' }],
      extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Practitioner/master1' } }],
    } as Practitioner;
    const provenance: Provenance = {
      resourceType: 'Provenance',
      id: 'prov1',
      recorded: '2026-06-01T10:00:00Z',
      activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.update] },
      target: [{ reference: 'Claim/c1' }],
      agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: 'Practitioner/u1' } }],
      extension: [
        {
          url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
          valueString: diff('Claim', [
            { field: 'billingProvider', label: 'Billing Provider', previousValue: null, newValue: 'Practitioner/wc1' },
          ]),
        },
      ],
    } as Provenance;

    const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Claim') return Promise.resolve({ unbundle: () => [claim] });
      if (resourceType === 'Coverage') return Promise.resolve({ unbundle: () => [coverage] });
      if (resourceType === 'Provenance') return Promise.resolve({ unbundle: () => [provenance] });
      if (resourceType === 'Practitioner') return Promise.resolve({ unbundle: () => [providerWorkingCopy] });
      return Promise.resolve({ unbundle: () => [] });
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    const change = entries[0].changes[0];
    expect(change.previousValue).toBeNull();
    expect(change.newValue).toContain('Smith');
    expect(change.newValue).not.toContain('Practitioner/');
    // Links to the master resource behind the working copy, on the billing-providers screen.
    expect(change.newLink).toEqual({ screen: 'billing-providers', id: 'master1' });
  });
});

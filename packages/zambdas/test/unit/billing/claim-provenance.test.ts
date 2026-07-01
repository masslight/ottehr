import { Coverage, Patient, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils';
import { describe, expect, it } from 'vitest';
import { claimProvenanceRequest, diffResources } from '../../../src/billing/provenance';

const agent: ProvenanceAgent = { who: { reference: 'Practitioner/u1' } };
const CLAIM_REF = 'Claim/c1';

const coverage = (overrides: Partial<Coverage> = {}): Coverage =>
  ({ resourceType: 'Coverage', status: 'active', subscriberId: 'M1', payor: [], ...overrides }) as Coverage;

const parseChanges = (provenance: Provenance): ClaimFieldChange[] =>
  JSON.parse(provenance.extension!.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)!.valueString!);

describe('diffResources', () => {
  it('records all set fields as new values on create (no before)', () => {
    const changes = diffResources(undefined, coverage());
    expect(changes).toContainEqual({ field: 'memberId', label: 'Member ID', previousValue: null, newValue: 'M1' });
    expect(changes).toContainEqual({ field: 'status', label: 'Status', previousValue: null, newValue: 'active' });
  });

  it('records only the fields that changed on update', () => {
    const changes = diffResources(coverage(), coverage({ subscriberId: 'M2' }));
    expect(changes).toEqual([{ field: 'memberId', label: 'Member ID', previousValue: 'M1', newValue: 'M2' }]);
  });

  it('returns no changes when nothing changed', () => {
    expect(diffResources(coverage(), coverage())).toEqual([]);
  });

  it('normalizes a cleared field to a null new value', () => {
    const changes = diffResources(coverage({ subscriberId: 'M1' }), coverage({ subscriberId: '' }));
    expect(changes).toEqual([{ field: 'memberId', label: 'Member ID', previousValue: 'M1', newValue: null }]);
  });

  it('records a deletion (no after) with null new values', () => {
    const before: Patient = { resourceType: 'Patient', birthDate: '2000-01-01', gender: 'male' } as Patient;
    const changes = diffResources(before, undefined);
    expect(changes).toContainEqual({
      field: 'dob',
      label: 'Date of Birth',
      previousValue: '2000-01-01',
      newValue: null,
    });
  });

  it('prefers reference displays and compares reference fields by ref, not display', () => {
    const withPayer = (display: string | undefined): Coverage =>
      coverage({ payor: [{ reference: 'https://rcm.example/payer/1', display }] });
    // Same ref, display added later → not a change.
    expect(diffResources(withPayer(undefined), withPayer('Acme (1)'))).toEqual([]);
    // Different ref → change recorded with display values and refs.
    const changes = diffResources(
      withPayer('Acme (1)'),
      coverage({ payor: [{ reference: 'https://rcm.example/payer/2', display: 'Zenith (2)' }] })
    );
    expect(changes).toEqual([
      {
        field: 'payer',
        label: 'Payer',
        previousValue: 'Acme (1)',
        newValue: 'Zenith (2)',
        previousRef: 'https://rcm.example/payer/1',
        newRef: 'https://rcm.example/payer/2',
      },
    ]);
  });
});

describe('claimProvenanceRequest', () => {
  it('returns null for a no-op update', () => {
    expect(
      claimProvenanceRequest({
        targetReference: 'Coverage/1',
        claimReference: CLAIM_REF,
        before: coverage(),
        after: coverage(),
        agent,
        activity: 'update',
        recorded: 't',
      })
    ).toBeNull();
  });

  it('still records a no-op projection when extraChanges are supplied', () => {
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/1',
      claimReference: CLAIM_REF,
      before: coverage(),
      after: coverage(),
      agent,
      activity: 'update',
      recorded: 't',
      extraChanges: [{ field: 'policyHolder.name', label: 'Policy Holder Name', previousValue: 'A', newValue: 'B' }],
    });
    expect(req).not.toBeNull();
    expect(parseChanges(req!.resource as Provenance)).toEqual([
      { field: 'policyHolder.name', label: 'Policy Holder Name', previousValue: 'A', newValue: 'B' },
    ]);
  });

  it('targets both the changed resource and the claim, carrying agent and diff extension', () => {
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/1',
      claimReference: CLAIM_REF,
      before: coverage(),
      after: coverage({ subscriberId: 'M2' }),
      agent,
      activity: 'update',
      recorded: 't',
    });
    expect(req?.method).toBe('POST');
    expect(req?.url).toBe('/Provenance');
    const prov = req!.resource as Provenance;
    expect(prov.target).toEqual([{ reference: 'Coverage/1' }, { reference: CLAIM_REF }]);
    expect(prov.agent?.[0]).toEqual(agent);
    expect(parseChanges(prov).find((c) => c.field === 'memberId')?.newValue).toBe('M2');
  });

  it('collapses to a single target when the changed resource is the claim itself', () => {
    const req = claimProvenanceRequest({
      targetReference: CLAIM_REF,
      claimReference: CLAIM_REF,
      after: coverage(),
      agent,
      activity: 'create',
      recorded: 't',
    });
    expect((req!.resource as Provenance).target).toEqual([{ reference: CLAIM_REF }]);
  });

  it('always records a create even when the diff is empty', () => {
    const req = claimProvenanceRequest({
      targetReference: 'urn:uuid:x',
      claimReference: 'urn:uuid:x',
      after: { resourceType: 'Coverage', payor: [] } as unknown as Coverage,
      agent,
      activity: 'create',
      recorded: 't',
    });
    expect(req).not.toBeNull();
  });

  it('attaches the prior-version reference when provided', () => {
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/1',
      claimReference: CLAIM_REF,
      before: coverage(),
      after: coverage({ subscriberId: 'M2' }),
      agent,
      activity: 'update',
      recorded: 't',
      priorVersionReference: 'Coverage/1/_history/3',
    });
    expect((req!.resource as Provenance).entity?.[0]).toEqual({
      role: 'revision',
      what: { reference: 'Coverage/1/_history/3' },
    });
  });
});

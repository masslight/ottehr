import { Coverage, Patient, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL } from 'utils';
import { describe, expect, it } from 'vitest';
import { claimProvenanceRequest, diffResources } from '../../../src/billing/provenance';

const agent: ProvenanceAgent = { who: { reference: 'Practitioner/u1' } };

const coverage = (overrides: Partial<Coverage> = {}): Coverage =>
  ({ resourceType: 'Coverage', status: 'active', subscriberId: 'M1', payor: [], ...overrides }) as Coverage;

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
});

describe('claimProvenanceRequest', () => {
  it('returns null for a no-op update', () => {
    expect(
      claimProvenanceRequest({
        resourceType: 'Coverage',
        targetReference: 'Coverage/1',
        before: coverage(),
        after: coverage(),
        agent,
        activity: 'update',
        recorded: 't',
      })
    ).toBeNull();
  });

  it('builds a Provenance POST carrying the agent, target, and diff extension', () => {
    const req = claimProvenanceRequest({
      resourceType: 'Coverage',
      targetReference: 'urn:uuid:x',
      after: coverage(),
      agent,
      activity: 'create',
      recorded: 't',
    });
    expect(req?.method).toBe('POST');
    expect(req?.url).toBe('/Provenance');
    const prov = req!.resource as Provenance;
    expect(prov.target?.[0]?.reference).toBe('urn:uuid:x');
    expect(prov.agent?.[0]).toEqual(agent);
    const ext = prov.extension?.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL);
    const diff = JSON.parse(ext!.valueString!);
    expect(diff.resourceType).toBe('Coverage');
    expect(diff.changes.find((c: { field: string }) => c.field === 'memberId').newValue).toBe('M1');
  });

  it('always records a create even when the diff is empty', () => {
    const req = claimProvenanceRequest({
      resourceType: 'Coverage',
      targetReference: 'urn:uuid:x',
      after: { resourceType: 'Coverage', payor: [] } as unknown as Coverage,
      agent,
      activity: 'create',
      recorded: 't',
    });
    expect(req).not.toBeNull();
  });

  it('attaches the prior-version reference when provided', () => {
    const req = claimProvenanceRequest({
      resourceType: 'Coverage',
      targetReference: 'Coverage/1',
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

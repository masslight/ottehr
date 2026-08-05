import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Claim, Coverage, Patient, Provenance, ProvenanceAgent } from 'fhir/r4b';
import {
  AR_STAGE,
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_CHANGE_REF_URL,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
  CLAIM_STATUS_DATE_EXTENSION_URLS,
  ClaimFieldChange,
  ClaimStatusValues,
  claimStatusValuesToTags,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import {
  claimProvenanceRequest,
  claimResourceChangeRequests,
  commitClaimMetaTagsWithProvenance,
  commitClaimResourceChange,
  diffResources,
} from '../../../src/billing/provenance';

const agent: ProvenanceAgent = { who: { reference: 'Practitioner/u1' } };
const CLAIM_REF = 'Claim/c1';

const coverage = (overrides: Partial<Coverage> = {}): Coverage =>
  ({ resourceType: 'Coverage', id: 'cov1', status: 'active', subscriberId: 'M1', payor: [], ...overrides }) as Coverage;

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

  it('always records a note carrying the text in its own extension even with an empty diff', () => {
    const req = claimProvenanceRequest({
      targetReference: CLAIM_REF,
      claimReference: CLAIM_REF,
      note: 'Called payer, on hold',
      agent,
      activity: 'note',
      recorded: 't',
    });

    const provenance = req!.resource as Provenance;
    expect(provenance.activity?.coding?.[0]).toEqual(CLAIM_PROVENANCE_ACTIVITY.note);
    expect(provenance.extension).toContainEqual({
      url: CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
      valueString: 'Called payer, on hold',
    });
    expect(parseChanges(provenance)).toEqual([]);
  });

  it('omits the note extension when no note is supplied', () => {
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/1',
      claimReference: CLAIM_REF,
      before: coverage(),
      after: coverage({ subscriberId: 'M2' }),
      agent,
      activity: 'update',
      recorded: 't',
    });

    const urls = (req!.resource as Provenance).extension?.map((e) => e.url);
    expect(urls).not.toContain(CLAIM_PROVENANCE_NOTE_EXTENSION_URL);
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

// References are stored as Provenance.entity entries (rewritten by the server when a transaction
// creates the referenced resource under a urn:uuid fullUrl), never inside the diff JSON.
describe('claimProvenanceRequest reference storage', () => {
  const withPayer = (reference: string, display?: string): Coverage => coverage({ payor: [{ reference, display }] });

  it('moves refs out of the diff JSON into linked entities: previous=source, new=derivation', () => {
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/cov1',
      claimReference: CLAIM_REF,
      before: withPayer('https://rcm.example/payer/1', 'Acme (1)'),
      after: withPayer('https://rcm.example/payer/2', 'Zenith (2)'),
      agent,
      activity: 'update',
      recorded: 't',
      priorVersionReference: 'Coverage/cov1/_history/3',
    });
    const prov = req!.resource as Provenance;
    expect(parseChanges(prov)).toEqual([
      { field: 'payer', label: 'Payer', previousValue: 'Acme (1)', newValue: 'Zenith (2)' },
    ]);
    // 'revision' stays reserved for the prior-version entry, first in the list.
    expect(prov.entity?.[0]).toEqual({ role: 'revision', what: { reference: 'Coverage/cov1/_history/3' } });
    expect(prov.entity).toContainEqual({
      role: 'source',
      what: { reference: 'https://rcm.example/payer/1' },
      extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'payer|previous|0' }],
    });
    expect(prov.entity).toContainEqual({
      role: 'derivation',
      what: { reference: 'https://rcm.example/payer/2' },
      extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'payer|new|0' }],
    });
    expect(prov.entity).toHaveLength(3);
  });

  it('splits a multi-reference field (claim coverage) into one entity per reference, indexed', () => {
    const claimWith = (insurance: Claim['insurance']): Claim =>
      ({ resourceType: 'Claim', id: 'c1', type: { coding: [] }, insurance }) as unknown as Claim;
    const req = claimProvenanceRequest({
      targetReference: CLAIM_REF,
      claimReference: CLAIM_REF,
      before: claimWith([{ sequence: 1, focal: true, coverage: { reference: 'Coverage/a', display: 'Cov A' } }]),
      after: claimWith([
        { sequence: 1, focal: true, coverage: { reference: 'Coverage/a', display: 'Cov A' } },
        { sequence: 2, focal: false, coverage: { reference: 'Coverage/b', display: 'Cov B' } },
      ]),
      agent,
      activity: 'update',
      recorded: 't',
    });
    const prov = req!.resource as Provenance;
    expect(parseChanges(prov)).toEqual([
      { field: 'coverage', label: 'Coverage', previousValue: 'Cov A', newValue: 'Cov A, Cov B' },
    ]);
    expect(prov.entity).toEqual([
      {
        role: 'source',
        what: { reference: 'Coverage/a' },
        extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'coverage|previous|0' }],
      },
      {
        role: 'derivation',
        what: { reference: 'Coverage/a' },
        extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'coverage|new|0' }],
      },
      {
        role: 'derivation',
        what: { reference: 'Coverage/b' },
        extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'coverage|new|1' }],
      },
    ]);
  });

  it('stores null instead of a value that merely repeats a display-less reference', () => {
    // No display on the payor reference, so the projected value falls back to the raw reference —
    // which may be a urn about to be rewritten. It must not be baked into the JSON.
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/cov1',
      claimReference: CLAIM_REF,
      before: coverage(),
      after: withPayer('urn:uuid:payer-copy'),
      agent,
      activity: 'update',
      recorded: 't',
    });
    const prov = req!.resource as Provenance;
    expect(parseChanges(prov)).toEqual([{ field: 'payer', label: 'Payer', previousValue: null, newValue: null }]);
    expect(prov.entity).toEqual([
      {
        role: 'derivation',
        what: { reference: 'urn:uuid:payer-copy' },
        extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'payer|new|0' }],
      },
    ]);
  });

  it('emits no entities for changes without references', () => {
    const req = claimProvenanceRequest({
      targetReference: 'Coverage/1',
      claimReference: CLAIM_REF,
      before: coverage(),
      after: coverage({ subscriberId: 'M2' }),
      agent,
      activity: 'update',
      recorded: 't',
    });
    expect((req!.resource as Provenance).entity).toBeUndefined();
  });
});

describe('claim resource change guts (shared by all mutation endpoints)', () => {
  it('builds the PUT and its Provenance as a pair', () => {
    const before = coverage({ meta: { versionId: '3' } });
    const requests = claimResourceChangeRequests({
      resource: coverage({ subscriberId: 'M2' }),
      before,
      agent,
      claimReference: CLAIM_REF,
    });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ method: 'PUT', url: 'Coverage/cov1' });
    const provenance = (requests[1] as { resource: Provenance }).resource;
    expect(provenance.target).toEqual([{ reference: 'Coverage/cov1' }, { reference: CLAIM_REF }]);
    expect(provenance.entity?.[0]?.what?.reference).toBe('Coverage/cov1/_history/3');
    expect(parseChanges(provenance)).toEqual([
      { field: 'memberId', label: 'Member ID', previousValue: 'M1', newValue: 'M2' },
    ]);
  });

  it('still writes the resource, without a Provenance, on a no-op change', () => {
    const requests = claimResourceChangeRequests({
      resource: coverage(),
      before: coverage(),
      agent,
      claimReference: CLAIM_REF,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: 'PUT', url: 'Coverage/cov1' });
  });

  it('commits pre-requests, the change pair, and post-requests in one transaction', async () => {
    const transaction = vi.fn().mockResolvedValue({ entry: [] });
    const oystehr = { fhir: { transaction } } as unknown as Oystehr;

    const result = await commitClaimResourceChange(oystehr, {
      resource: coverage({ subscriberId: 'M2' }),
      before: coverage(),
      agent,
      claimReference: CLAIM_REF,
      preRequests: [
        {
          method: 'POST',
          url: '/RelatedPerson',
          resource: { resourceType: 'RelatedPerson', patient: { reference: 'Patient/p1' } },
        },
      ],
      postRequests: [{ method: 'DELETE', url: 'RelatedPerson/rp1' }],
    });

    expect(result).toEqual({ id: 'cov1' });
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.map((r: { method: string }) => r.method)).toEqual(['POST', 'PUT', 'POST', 'DELETE']);
  });
});

describe('commitClaimMetaTagsWithProvenance patient-AR date extensions', () => {
  const claim = (values: Partial<ClaimStatusValues>): Claim =>
    ({
      resourceType: 'Claim',
      id: 'c1',
      meta: {
        versionId: '2',
        tag: claimStatusValuesToTags(values),
      },
    }) as Claim;

  const commitAndReadPatchOps = async (
    before: Claim,
    afterValues: Partial<ClaimStatusValues>
  ): Promise<Operation[]> => {
    const transaction = vi.fn().mockResolvedValue({ entry: [] });
    const oystehr = {
      fhir: {
        transaction,
      },
    } as unknown as Oystehr;
    await commitClaimMetaTagsWithProvenance(
      oystehr,
      before,
      claimStatusValuesToTags(afterValues),
      'statusChange',
      agent
    );
    const requests = transaction.mock.calls[0][0].requests;
    const patch = requests.find((r: { method: string }) => r.method === 'PATCH');
    return JSON.parse(Buffer.from(patch.resource.data, 'base64').toString());
  };

  it('adds an /extension patch recording the entered-patient-AR date on entering patient AR', async () => {
    const ops = await commitAndReadPatchOps(
      claim({
        arStage: AR_STAGE.insurancePayer,
      }),
      {
        arStage: AR_STAGE.patient,
      }
    );
    const extensionOp = ops.find((op) => op.path === '/extension') as
      | {
          value: {
            url: string;
          }[];
        }
      | undefined;
    expect(extensionOp?.value).toContainEqual({
      url: CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr,
      valueDateTime: expect.any(String),
    });
  });

  it('does not add an /extension patch for a status change that is not a tracked transition', async () => {
    const ops = await commitAndReadPatchOps(
      claim({
        arStage: AR_STAGE.patient,
        patientArStatus: 'not-invoiced',
      }),
      {
        arStage: AR_STAGE.patient,
        patientArStatus: 'ready-to-invoice',
      }
    );
    expect(ops.some((op) => op.path === '/extension')).toBe(false);
  });
});

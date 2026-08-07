import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Organization, Practitioner, Provenance, Resource } from 'fhir/r4b';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_CHANGE_REF_URL,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
  ClaimFieldChange,
} from 'utils/lib/types/data/billing/claim-history';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/get-billing-claim-history';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';

vi.mock('@sentry/aws-serverless', async (importActual) => ({
  ...(await importActual<typeof import('@sentry/aws-serverless')>()),
  captureException: vi.fn(),
}));
const captureExceptionMock = vi.mocked(captureException);

beforeEach(() => captureExceptionMock.mockClear());

const PAYER_URL = 'https://rcm-api.zapehr.com/v1/payer/123';

const diffExtension = (changes: Partial<ClaimFieldChange>[]): { url: string; valueString: string } => ({
  url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  valueString: JSON.stringify(changes),
});

const provenanceBase = (id: string, recorded: string): Provenance =>
  ({
    resourceType: 'Provenance',
    id,
    recorded,
    activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.update] },
    target: [{ reference: 'Claim/c1' }],
    agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: 'Practitioner/u1' } }],
  }) as Provenance;

const practitionerU1: Practitioner = {
  resourceType: 'Practitioner',
  id: 'u1',
  name: [{ given: ['Jane'], family: 'Doe' }],
} as Practitioner;

// getAllFhirSearchPages reads entry (search.mode), total, and unbundle() off each page.
const pagedBundle = (matches: Resource[], includes: Resource[] = []): unknown => ({
  entry: [
    ...matches.map((resource) => ({ resource, search: { mode: 'match' } })),
    ...includes.map((resource) => ({ resource, search: { mode: 'include' } })),
  ],
  total: matches.length,
  unbundle: () => [...matches, ...includes],
});

const makeOystehr = (handlers: Record<string, (params?: unknown) => unknown>): Oystehr => {
  const search = vi.fn().mockImplementation(({ resourceType }: { resourceType: string }) => {
    const handler = handlers[resourceType];
    if (!handler) return Promise.resolve({ entry: [], total: 0, unbundle: () => [] });
    return Promise.resolve(handler());
  });
  const getPayerByUrl = vi
    .fn()
    .mockResolvedValue({ resourceType: 'Organization', id: 'pay1', name: 'Acme Health' } as Organization);
  return { fhir: { search }, rcm: { getPayerByUrl } } as unknown as Oystehr;
};

describe('get-billing-claim-history performEffect', () => {
  it('maps a coverage update into a history entry with the actor resolved from the include', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      target: [{ reference: 'Coverage/cov1' }, { reference: 'Claim/c1' }],
      extension: [diffExtension([{ field: 'memberId', label: 'Member ID', previousValue: 'A', newValue: 'B' }])],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([provenance], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      activity: 'Update Coverage',
      actor: { type: 'user' },
      changes: [{ field: 'memberId', label: 'Member ID', previousValue: 'A', newValue: 'B' }],
    });
    expect(entries[0].actor.display).toContain('Doe');
  });

  it('maps a note provenance into an entry carrying the message and no changes', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      activity: {
        coding: [CLAIM_PROVENANCE_ACTIVITY.note],
      },
      extension: [
        diffExtension([]),
        {
          url: CLAIM_PROVENANCE_NOTE_EXTENSION_URL,
          valueString: 'Called payer, claim is on hold pending medical records',
        },
      ],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([provenance], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      activity: 'Note',
      message: 'Called payer, claim is on hold pending medical records',
      changes: [],
      actor: {
        type: 'user',
      },
    });
    expect(entries[0].actor.display).toContain('Doe');
    // An empty change set on a note is expected, not a data anomaly.
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('leaves message unset on a non-note entry', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      extension: [
        diffExtension([
          {
            field: 'memberId',
            label: 'Member ID',
            previousValue: 'A',
            newValue: 'B',
          },
        ]),
      ],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([provenance], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries[0].message).toBeUndefined();
  });

  it('attributes a Device agent as a system actor and sorts newest first', async () => {
    const older: Provenance = {
      ...provenanceBase('old', '2026-05-01T10:00:00Z'),
      activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.create] },
      extension: [diffExtension([])],
    };
    const newer: Provenance = {
      ...provenanceBase('new', '2026-06-15T10:00:00Z'),
      activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.statusChange] },
      agent: [{ type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.system] }, who: { reference: 'Device/d1' } }],
      extension: [
        diffExtension([{ field: 'status.arStage', label: 'AR Stage', previousValue: null, newValue: 'Patient AR' }]),
      ],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([older, newer], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries.map((e) => e.id)).toEqual(['new', 'old']);
    expect(entries[0].activity).toBe('Status change');
    expect(entries[0].actor).toMatchObject({ type: 'system', display: CLAIM_RULES_ENGINE_DEVICE_NAME });
    expect(entries[1].activity).toBe('Create Claim');
  });

  it('links provider references to their master screens and keeps write-time display values', async () => {
    const providerWorkingCopy: Practitioner = {
      resourceType: 'Practitioner',
      id: 'wc1',
      name: [{ given: ['John'], family: 'Smith' }],
      extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Practitioner/master1' } }],
    } as Practitioner;
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      extension: [
        diffExtension([
          {
            field: 'billingProvider',
            label: 'Billing Provider',
            previousValue: null,
            newValue: 'John Smith',
            newRef: 'Practitioner/wc1',
          },
        ]),
      ],
    };
    const oystehr = makeOystehr({
      Provenance: () => pagedBundle([provenance], [practitionerU1]),
      Practitioner: () => ({ unbundle: () => [providerWorkingCopy] }),
    });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    const change = entries[0].changes[0];
    expect(change.newValue).toBe('John Smith');
    // Links to the master resource behind the working copy, on the billing-providers screen.
    expect(change.newLink).toEqual({ screen: 'billing-providers', id: 'master1' });
  });

  it('resolves a payer name as a fallback when the stored value is a raw payer URL', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      extension: [
        diffExtension([
          { field: 'payer', label: 'Payer', previousValue: null, newValue: PAYER_URL, newRef: PAYER_URL },
        ]),
      ],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([provenance], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries[0].changes[0].newValue).toBe('Acme Health');
    expect(entries[0].changes[0].newLink).toBeNull();
  });

  it('skips a malformed change set instead of failing the whole request', async () => {
    const bad: Provenance = {
      ...provenanceBase('bad', '2026-06-02T10:00:00Z'),
      extension: [{ url: CLAIM_PROVENANCE_DIFF_EXTENSION_URL, valueString: 'not json {' }],
    };
    const good: Provenance = {
      ...provenanceBase('good', '2026-06-01T10:00:00Z'),
      extension: [diffExtension([{ field: 'memberId', label: 'Member ID', previousValue: 'A', newValue: 'B' }])],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([bad, good], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.id === 'bad')?.changes).toEqual([]);
    expect(entries.find((e) => e.id === 'good')?.changes).toHaveLength(1);
    // A malformed change set is skipped gracefully but reported to Sentry for observability.
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it('reports to Sentry when a Provenance is missing expected fields but still returns an entry', async () => {
    const malformed = {
      resourceType: 'Provenance',
      id: 'prov1',
      // recorded, activity, target, and agent are all absent — a real defect in a claim-history record.
      extension: [diffExtension([{ field: 'memberId', label: 'Member ID', previousValue: 'A', newValue: 'B' }])],
    } as Provenance;
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([malformed]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    // Graceful: the entry is still returned (with its changes) rather than crashing the view.
    expect(entries).toHaveLength(1);
    expect(entries[0].changes).toHaveLength(1);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const reported = captureExceptionMock.mock.calls[0][0] as Error;
    expect(reported.message).toContain('missing');
  });
});

// Records written since the refs moved out of the diff JSON carry them as Provenance.entity entries
// tagged with the linking extension; the reader reattaches them onto the parsed changes.
describe('get-billing-claim-history entity-linked references', () => {
  const changeRefEntity = (
    reference: string,
    marker: string,
    role: 'source' | 'derivation'
  ): NonNullable<Provenance['entity']>[number] => ({
    role,
    what: { reference },
    extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: marker }],
  });

  const providerWorkingCopy: Practitioner = {
    resourceType: 'Practitioner',
    id: 'wc1',
    name: [{ given: ['John'], family: 'Smith' }],
    extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Practitioner/master1' } }],
  } as Practitioner;

  it('reconstructs previousRef/newRef from linked entities, keeping write-time values and building links', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      // The prior-version entry carries no linking extension and is ignored by reconstruction.
      entity: [
        { role: 'revision', what: { reference: 'Claim/c1/_history/2' } },
        changeRefEntity('Practitioner/old1', 'billingProvider|previous|0', 'source'),
        changeRefEntity('Practitioner/wc1', 'billingProvider|new|0', 'derivation'),
      ],
      extension: [
        diffExtension([
          {
            field: 'billingProvider',
            label: 'Billing Provider',
            previousValue: 'Old Provider',
            newValue: 'John Smith',
          },
        ]),
      ],
    };
    const oystehr = makeOystehr({
      Provenance: () => pagedBundle([provenance], [practitionerU1]),
      Practitioner: () => ({ unbundle: () => [providerWorkingCopy] }),
    });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    const change = entries[0].changes[0];
    expect(change.previousRef).toBe('Practitioner/old1');
    expect(change.newRef).toBe('Practitioner/wc1');
    // Display values captured at write time are kept — reconstruction only restores the refs.
    expect(change.previousValue).toBe('Old Provider');
    expect(change.newValue).toBe('John Smith');
    expect(change.newLink).toEqual({ screen: 'billing-providers', id: 'master1' });
  });

  it('re-joins a multi-reference field in index order regardless of entity order', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      entity: [
        changeRefEntity('Coverage/b', 'coverage|new|1', 'derivation'),
        changeRefEntity('Coverage/a', 'coverage|new|0', 'derivation'),
      ],
      extension: [
        diffExtension([{ field: 'coverage', label: 'Coverage', previousValue: null, newValue: 'Cov A, Cov B' }]),
      ],
    };
    const oystehr = makeOystehr({ Provenance: () => pagedBundle([provenance], [practitionerU1]) });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries[0].changes[0].newRef).toBe('Coverage/a, Coverage/b');
    expect(entries[0].changes[0].previousRef).toBeUndefined();
  });

  it('resolves display names for null values whose refs came from entities', async () => {
    // A display-less reference is stored as a null value (never the raw ref, which could have been
    // a urn); the reader resolves the friendly name from the — by then rewritten — entity ref.
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      entity: [
        changeRefEntity('Practitioner/wc1', 'billingProvider|new|0', 'derivation'),
        changeRefEntity(PAYER_URL, 'payer|new|0', 'derivation'),
      ],
      extension: [
        diffExtension([
          { field: 'billingProvider', label: 'Billing Provider', previousValue: null, newValue: null },
          { field: 'payer', label: 'Payer', previousValue: null, newValue: null },
        ]),
      ],
    };
    const oystehr = makeOystehr({
      Provenance: () => pagedBundle([provenance], [practitionerU1]),
      Practitioner: () => ({ unbundle: () => [providerWorkingCopy] }),
    });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    const providerChange = entries[0].changes.find((c) => c.field === 'billingProvider');
    expect(providerChange?.newValue).toBe('Smith, John');
    expect(providerChange?.newLink).toEqual({ screen: 'billing-providers', id: 'master1' });
    const payerChange = entries[0].changes.find((c) => c.field === 'payer');
    expect(payerChange?.newValue).toBe('Acme Health');
    expect(payerChange?.newLink).toBeNull();
  });

  it('leaves inline refs from records written before entity linking untouched', async () => {
    const provenance: Provenance = {
      ...provenanceBase('prov1', '2026-06-01T10:00:00Z'),
      entity: [changeRefEntity('Practitioner/other', 'billingProvider|new|0', 'derivation')],
      extension: [
        diffExtension([
          {
            field: 'billingProvider',
            label: 'Billing Provider',
            previousValue: null,
            newValue: 'John Smith',
            newRef: 'Practitioner/wc1',
          },
        ]),
      ],
    };
    const oystehr = makeOystehr({
      Provenance: () => pagedBundle([provenance], [practitionerU1]),
      Practitioner: () => ({ unbundle: () => [providerWorkingCopy] }),
    });

    const { entries } = await performEffect(oystehr, { claimId: 'c1', secrets: null });

    expect(entries[0].changes[0].newRef).toBe('Practitioner/wc1');
    expect(entries[0].changes[0].newValue).toBe('John Smith');
  });
});

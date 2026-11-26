import Oystehr from '@oystehr/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BILLING_ALL_LAYERS, BillingBaseRowSchema } from 'utils/lib/types/adhoc/datasets/billing';
import { datasetRowSchema } from 'utils/lib/types/adhoc/datasets/dataset';
import { ENCOUNTER_ALL_LAYERS, EncounterBaseRowSchema } from 'utils/lib/types/adhoc/datasets/encounters';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyDatasetLinks, LINK_SOURCES, LinkSource, requestedLinks } from '../src/shared/adhoc-datasets/links';

type Row = Record<string, unknown>;

const ctx = {
  oystehr: {} as Oystehr,
  billingOystehr: {} as Oystehr,
  eraReadClient: () => ({}) as Oystehr,
  dateRange: { start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T23:59:59.999Z' },
};

const visit = (encounterId: string, extra: Row = {}): Row => ({
  encounterId,
  appointmentId: `a-${encounterId}`,
  ...extra,
});

const claimRow = (claimId: string, encounterId: string | null, extra: Row = {}): Row => ({
  claimId,
  encounterId,
  claimType: 'professional',
  patientId: 'billing-patient-copy',
  patientName: 'Doe, Jane',
  billed: 150,
  allowed: 90,
  arStage: 'insurance-payer-ar',
  cptCodes: ['99214'],
  ...extra,
});

const fakeSource = (real: LinkSource, rows: Row[]): LinkSource & { fetch: ReturnType<typeof vi.fn> } => ({
  ...real,
  fetch: vi.fn(async () => rows),
});

describe('requestedLinks', () => {
  it('picks the links with a requested layer, and only layers the host offers', () => {
    expect(requestedLinks('encounters-comprehensive', ENCOUNTER_ALL_LAYERS, { codes: true })).toEqual([]);
    const links = requestedLinks('encounters-comprehensive', ENCOUNTER_ALL_LAYERS, {
      'billing-claims.base': true,
      'billing-claims.codes': true,
      'billing-claims.remits': false,
      'billing.charges': true,
      'billing-claims.unknown': true,
    });
    expect(links.map(({ link, layerIds }) => [link.source, layerIds])).toEqual([
      ['billing-claims', ['billing-claims.base', 'billing-claims.codes']],
      ['billing', ['billing.charges']],
    ]);
  });
});

describe('applyDatasetLinks', () => {
  afterEach(() => vi.restoreAllMocks());

  it('makes no request and returns the rows as they are when no link layer is requested', async () => {
    const claims = fakeSource(LINK_SOURCES['billing-claims'], []);
    const rows = [visit('e1')];
    const out = await applyDatasetLinks({
      hostId: 'encounters-comprehensive',
      hostLayers: ENCOUNTER_ALL_LAYERS,
      rows,
      options: { codes: true, 'patients.allergies': true },
      ctx,
      sources: { 'billing-claims': claims },
    });
    expect(out).toBe(rows);
    expect(claims.fetch).not.toHaveBeenCalled();
  });

  it("joins the visit's claim: asks for the host's encounter ids and the requested claim layers only", async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const claims = fakeSource(LINK_SOURCES['billing-claims'], [claimRow('c1', 'e1'), claimRow('c9', null)]);
    const out = await applyDatasetLinks({
      hostId: 'encounters-comprehensive',
      hostLayers: ENCOUNTER_ALL_LAYERS,
      rows: [visit('e1', { cptCodes: ['99213'] }), visit('e2'), visit('e1-dup-key-check'), visit('')],
      options: { 'billing-claims.base': true, 'billing-claims.codes': true },
      ctx,
      sources: { 'billing-claims': claims },
    });

    const [, args] = claims.fetch.mock.calls[0];
    expect(args.keys).toEqual(['e1', 'e2', 'e1-dup-key-check']);
    expect(args.flags.includeCodes).toBe(true);
    expect(args.flags.includeRemits).toBe(false);

    expect(out[0]).toMatchObject({
      claimMatched: true,
      claimId: 'c1',
      claimType: 'professional',
      claimBilled: 150,
      claimArStage: 'insurance-payer-ar',
      claimCptCodes: ['99214'],
      cptCodes: ['99213'],
    });
    expect(out[0]).not.toHaveProperty('claimPatientId');
    expect(out[0]).not.toHaveProperty('claimEncounterId');
    expect(out[0].patientId).toBeUndefined();
    expect(out[1]).toMatchObject({ claimMatched: false, claimBilled: null, claimCptCodes: null });
    expect(out).toHaveLength(4);
  });

  it('produces columns the encounters row schema accepts, matched or not', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const claims = fakeSource(LINK_SOURCES['billing-claims'], [claimRow('c1', 'e1')]);
    const out = await applyDatasetLinks({
      hostId: 'encounters-comprehensive',
      hostLayers: ENCOUNTER_ALL_LAYERS,
      rows: [visit('e1'), visit('e2')],
      options: { 'billing-claims.base': true, 'billing-claims.codes': true },
      ctx,
      sources: { 'billing-claims': claims },
    });
    const schema = datasetRowSchema(EncounterBaseRowSchema.partial(), ENCOUNTER_ALL_LAYERS);
    for (const row of out) expect(schema.safeParse(row).error?.issues ?? []).toEqual([]);
  });

  it('keeps the smallest claim id when two claims share a visit, and warns', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const claims = fakeSource(LINK_SOURCES['billing-claims'], [
      claimRow('c2', 'e1', { billed: 300 }),
      claimRow('c1', 'e1', { billed: 100 }),
    ]);
    const [row] = await applyDatasetLinks({
      hostId: 'encounters-comprehensive',
      hostLayers: ENCOUNTER_ALL_LAYERS,
      rows: [visit('e1')],
      options: { 'billing-claims.base': true },
      ctx,
      sources: { 'billing-claims': claims },
    });
    expect(row).toMatchObject({ claimId: 'c1', claimBilled: 100 });
    expect(warn.mock.calls.join(' ')).toContain('1 duplicate encounterId');
  });

  it('joins Visit payments and the claim on one encounter row at once', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const claims = fakeSource(LINK_SOURCES['billing-claims'], [claimRow('c1', 'e1')]);
    const billing = fakeSource(LINK_SOURCES.billing, [
      { encounterId: 'e1', expectedCharge: 220, chargeCpts: ['99214'], primaryPayer: 'Aetna' },
    ]);
    const [row] = await applyDatasetLinks({
      hostId: 'encounters-comprehensive',
      hostLayers: ENCOUNTER_ALL_LAYERS,
      rows: [visit('e1')],
      options: { 'billing-claims.base': true, 'billing.charges': true, 'billing.coverage': true },
      ctx,
      sources: { 'billing-claims': claims, billing },
    });
    expect(billing.fetch.mock.calls[0][1].flags).toMatchObject({ includeCharges: true, includeCoverage: true });
    expect(billing.fetch.mock.calls[0][1].flags.includePayments).toBe(false);
    expect(row).toMatchObject({
      claimMatched: true,
      claimBilled: 150,
      billingMatched: true,
      billingExpectedCharge: 220,
      billingChargeCpts: ['99214'],
      billingPrimaryPayer: 'Aetna',
    });
  });

  it('joins the claim onto Visit payments rows', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const claims = fakeSource(LINK_SOURCES['billing-claims'], [claimRow('c1', 'e1')]);
    const out = await applyDatasetLinks({
      hostId: 'billing',
      hostLayers: BILLING_ALL_LAYERS,
      rows: [visit('e1', { memberId: 'M-on-coverage' }), visit('e2')],
      options: { 'billing-claims.base': true },
      ctx,
      sources: { 'billing-claims': claims },
    });
    expect(out[0]).toMatchObject({ claimMatched: true, claimBilled: 150, memberId: 'M-on-coverage' });
    expect(out[1]).toMatchObject({ claimMatched: false, claimBilled: null });
    const schema = datasetRowSchema(BillingBaseRowSchema.partial(), BILLING_ALL_LAYERS);
    for (const row of out) expect(schema.safeParse(row).error?.issues ?? []).toEqual([]);
  });

  it('fails the report when a source fails, rather than returning rows without its columns', async () => {
    const claims: LinkSource = {
      ...LINK_SOURCES['billing-claims'],
      fetch: vi.fn(async () => {
        throw new Error('Too many claims for one run — narrow the date range');
      }),
    };
    await expect(
      applyDatasetLinks({
        hostId: 'encounters-comprehensive',
        hostLayers: ENCOUNTER_ALL_LAYERS,
        rows: [visit('e1')],
        options: { 'billing-claims.base': true },
        ctx,
        sources: { 'billing-claims': claims },
      })
    ).rejects.toThrow('narrow the date range');
  });
});

describe('access to linked claims', () => {
  // The link step does not check the Claims dataset's roles; if these ever differ, it must.
  it('adhoc-report and adhoc-billing-dataset require the same roles', () => {
    const gate = 'requireUserWithRole(getUserToken(input), secrets, AD_HOC_REPORT_VIEW_ROLES)';
    for (const file of ['src/ehr/adhoc-report/index.ts', 'src/billing/adhoc-billing-dataset/index.ts']) {
      expect(readFileSync(join(__dirname, '..', file), 'utf8'), file).toContain(gate);
    }
  });
});

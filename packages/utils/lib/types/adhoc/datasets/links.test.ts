import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BILLING_ALL_LAYERS,
  BILLING_CLAIM_LINK_LAYERS,
  BILLING_DOMAIN_FIELDS,
  BILLING_FOREIGN_LAYERS,
  BILLING_INTERNAL_FIELDS,
  BILLING_LAYERS,
  BillingBaseRowSchema,
} from './billing';
import { BILLING_CLAIMS_INTERNAL_FIELDS, BILLING_CLAIMS_LAYERS, BillingClaimsBaseRowSchema } from './billing-claims';
import { AdHocLayerMap, layerFields } from './dataset';
import {
  ENCOUNTER_ALL_LAYERS,
  ENCOUNTER_BILLING_LINK_LAYERS,
  ENCOUNTER_CLAIM_LINK_LAYERS,
  ENCOUNTER_DOMAIN_FIELDS,
  ENCOUNTER_FOREIGN_LAYERS,
  ENCOUNTER_INTERNAL_FIELDS,
  ENCOUNTER_LAYERS,
  EncounterBaseRowSchema,
} from './encounters';
import { joinRows } from './join';
import {
  DATASET_LINKS,
  findLink,
  linkColumnMap,
  linkColumnName,
  linkMatchedColumn,
  requestedLinkColumns,
} from './links';
import { DATASET_META } from './meta';

const fieldsOf = (layers: AdHocLayerMap): string[] => Object.values(layers).flatMap(layerFields);
const unique = (names: string[]): Set<string> => new Set(names);

describe('dataset links: the list', () => {
  it('links datasets that exist, by fields their rows have', () => {
    for (const link of DATASET_LINKS) {
      const host = DATASET_META[link.host];
      const source = DATASET_META[link.source];
      expect(host, link.host).toBeDefined();
      expect(source, link.source).toBeDefined();
      expect(link.key in host.baseSchema.shape, `${link.host}.${link.key}`).toBe(true);
      expect(link.sourceKey in source.baseSchema.shape, `${link.source}.${link.sourceKey}`).toBe(true);
    }
  });

  it('is exactly the three planned links', () => {
    expect(DATASET_LINKS.map((l) => `${l.host} <- ${l.source}`).sort()).toEqual([
      'billing <- billing-claims',
      'encounters-comprehensive <- billing',
      'encounters-comprehensive <- billing-claims',
    ]);
  });
});

describe('linkColumnName', () => {
  it('prefixes a field, and keeps one that already starts with the prefix as a word', () => {
    expect(linkColumnName('claim', 'billed')).toBe('claimBilled');
    expect(linkColumnName('claim', 'cptCodes')).toBe('claimCptCodes');
    expect(linkColumnName('claim', 'claimType')).toBe('claimType');
    expect(linkColumnName('claim', 'claimBalance')).toBe('claimBalance');
    expect(linkColumnName('claim', 'claimedAt')).toBe('claimClaimedAt');
    expect(linkColumnName('billing', 'expectedCharge')).toBe('billingExpectedCharge');
  });
});

describe('dataset links: layers on the hosts', () => {
  it('offers every own layer of the source and the base columns, not the source foreign layers', () => {
    const claimIds = Object.keys(ENCOUNTER_CLAIM_LINK_LAYERS).sort();
    expect(claimIds).toEqual(
      ['billing-claims.base', ...Object.keys(BILLING_CLAIMS_LAYERS).map((id) => `billing-claims.${id}`)].sort()
    );
    expect(Object.keys(BILLING_CLAIM_LINK_LAYERS).sort()).toEqual(claimIds);
    expect(Object.keys(ENCOUNTER_BILLING_LINK_LAYERS).sort()).toEqual(
      Object.keys(BILLING_LAYERS)
        .map((id) => `billing.${id}`)
        .sort()
    );
    expect(Object.keys(ENCOUNTER_ALL_LAYERS).some((id) => id.startsWith('billing.patients'))).toBe(false);
  });

  it('keeps the link layers in the hosts ALL maps, so schemas, inputs and the catalog pick them up', () => {
    for (const id of Object.keys(ENCOUNTER_CLAIM_LINK_LAYERS)) expect(ENCOUNTER_ALL_LAYERS[id]).toBeDefined();
    for (const id of Object.keys(ENCOUNTER_BILLING_LINK_LAYERS)) expect(ENCOUNTER_ALL_LAYERS[id]).toBeDefined();
    for (const id of Object.keys(BILLING_CLAIM_LINK_LAYERS)) expect(BILLING_ALL_LAYERS[id]).toBeDefined();
    expect(DATASET_META['encounters-comprehensive'].layers).toBe(ENCOUNTER_ALL_LAYERS);
    expect(DATASET_META.billing.layers).toBe(BILLING_ALL_LAYERS);
  });

  it("leaves out of <source>.base the host's same-name base fields and the source internal fields", () => {
    const base = Object.keys(ENCOUNTER_CLAIM_LINK_LAYERS['billing-claims.base'].schema.shape);
    expect(base).not.toContain('claimPatientId');
    expect(base).not.toContain('claimEncounterId');
    expect(base).not.toContain('claimPatientName');
    expect(base).toEqual(
      expect.arrayContaining(['claimId', 'claimType', 'claimBilled', 'claimArStage', 'claimMatched'])
    );
  });

  it('makes every link column nullable and declares <prefix>Matched in every layer of the link', () => {
    for (const [layers, matched] of [
      [ENCOUNTER_CLAIM_LINK_LAYERS, 'claimMatched'],
      [ENCOUNTER_BILLING_LINK_LAYERS, 'billingMatched'],
      [BILLING_CLAIM_LINK_LAYERS, 'claimMatched'],
    ] as const) {
      for (const [id, def] of Object.entries(layers)) {
        expect(def.schema.shape[matched], `${id}.${matched}`).toBeInstanceOf(z.ZodBoolean);
        for (const [name, schema] of Object.entries(def.schema.shape)) {
          if (name === matched) continue;
          expect((schema as z.ZodTypeAny).safeParse(null).success, `${id}.${name} accepts null`).toBe(true);
          expect((schema as z.ZodTypeAny).description, `${id}.${name} is described`).toBeTruthy();
        }
      }
    }
  });

  it('never gives a link column the name of a host column, an own or patient layer column, or another link column', () => {
    const check = (groups: Record<string, string[]>): void => {
      const owner = new Map<string, string>();
      for (const [group, names] of Object.entries(groups)) {
        for (const name of unique(names)) {
          const taken = owner.get(name);
          expect(taken, `"${name}" is in ${taken} and ${group}`).toBeUndefined();
          owner.set(name, group);
        }
      }
    };
    check({
      base: Object.keys(EncounterBaseRowSchema.shape),
      own: fieldsOf(ENCOUNTER_LAYERS),
      patients: fieldsOf(ENCOUNTER_FOREIGN_LAYERS),
      billing: fieldsOf(ENCOUNTER_BILLING_LINK_LAYERS),
      claims: fieldsOf(ENCOUNTER_CLAIM_LINK_LAYERS),
    });
    check({
      base: Object.keys(BillingBaseRowSchema.shape),
      own: fieldsOf(BILLING_LAYERS),
      patients: fieldsOf(BILLING_FOREIGN_LAYERS),
      claims: fieldsOf(BILLING_CLAIM_LINK_LAYERS),
    });
  });

  it('maps every link column back to one source field', () => {
    for (const link of DATASET_LINKS) {
      const source = DATASET_META[link.source];
      const own = link.source === 'billing' ? BILLING_LAYERS : BILLING_CLAIMS_LAYERS;
      const map = linkColumnMap({ link, sourceBase: source.baseSchema, sourceLayers: own });
      const hostLayers = DATASET_META[link.host].layers;
      const ids = Object.keys(hostLayers).filter((id) => id.startsWith(`${link.source}.`));
      const columns = requestedLinkColumns({ link, hostLayers, requestedLayerIds: ids, columnMap: map });
      expect(columns.length).toBeGreaterThan(0);
      for (const { field, column } of columns) expect(linkColumnName(link.prefix, field)).toBe(column);
    }
  });
});

describe('dataset links: domain and internal fields', () => {
  it("never carries a source's internal fields, so the hosts' internal lists need no link columns", () => {
    for (const [layers, prefix, internal] of [
      [ENCOUNTER_CLAIM_LINK_LAYERS, 'claim', BILLING_CLAIMS_INTERNAL_FIELDS],
      [BILLING_CLAIM_LINK_LAYERS, 'claim', BILLING_CLAIMS_INTERNAL_FIELDS],
      [ENCOUNTER_BILLING_LINK_LAYERS, 'billing', BILLING_INTERNAL_FIELDS],
    ] as const) {
      const columns = new Set(fieldsOf(layers));
      for (const field of internal) expect(columns.has(linkColumnName(prefix, field)), field).toBe(false);
    }
  });

  it('shows the claim status and code values to the LLM, under their link names', () => {
    expect(ENCOUNTER_DOMAIN_FIELDS).toEqual(
      expect.arrayContaining(['claimArStage', 'claimAdjudicationStatus', 'claimPayerName', 'claimCptCodes'])
    );
    expect(ENCOUNTER_DOMAIN_FIELDS).toEqual(expect.arrayContaining(['billingPrimaryPayer', 'billingChargeCpts']));
    expect(BILLING_DOMAIN_FIELDS).toEqual(expect.arrayContaining(['claimArStage', 'claimCptCodes']));
  });

  it('lists only columns the host can carry', () => {
    const encounterColumns = new Set([...Object.keys(EncounterBaseRowSchema.shape), ...fieldsOf(ENCOUNTER_ALL_LAYERS)]);
    for (const field of [...ENCOUNTER_DOMAIN_FIELDS, ...ENCOUNTER_INTERNAL_FIELDS]) {
      expect(encounterColumns.has(field), field).toBe(true);
    }
    const billingColumns = new Set([...Object.keys(BillingBaseRowSchema.shape), ...fieldsOf(BILLING_ALL_LAYERS)]);
    for (const field of BILLING_DOMAIN_FIELDS) expect(billingColumns.has(field), field).toBe(true);
  });

  it('keeps the source base claim schema the same (link columns are copies, not new fields)', () => {
    expect(BillingClaimsBaseRowSchema.shape.billed).toBeDefined();
  });
});

describe('joinRows', () => {
  const link = findLink('encounters-comprehensive', 'billing-claims')!;
  const columns = [
    { field: 'billed', column: 'claimBilled' },
    { field: 'arStage', column: 'claimArStage' },
  ];
  const visit = (encounterId: string | null, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    encounterId,
    visitStatus: 'completed',
    ...extra,
  });
  const claim = (claimId: string, encounterId: string | null, billed: number): Record<string, unknown> => ({
    claimId,
    encounterId,
    billed,
    arStage: 'insurance-payer-ar',
  });

  it('adds the source columns to the matching host row and keeps every host row', () => {
    const { rows, duplicateKeys } = joinRows({
      host: [visit('e1'), visit('e2'), visit(null)],
      source: [claim('c1', 'e1', 100)],
      link,
      columns,
      sourceRowKey: 'claimId',
    });
    expect(duplicateKeys).toBe(0);
    expect(rows).toEqual([
      {
        encounterId: 'e1',
        visitStatus: 'completed',
        claimBilled: 100,
        claimArStage: 'insurance-payer-ar',
        claimMatched: true,
      },
      { encounterId: 'e2', visitStatus: 'completed', claimBilled: null, claimArStage: null, claimMatched: false },
      { encounterId: null, visitStatus: 'completed', claimBilled: null, claimArStage: null, claimMatched: false },
    ]);
  });

  it('skips a source row without a key (a claim created by hand)', () => {
    const { rows } = joinRows({
      host: [visit('e1')],
      source: [claim('c0', null, 50), claim('c1', '', 60)],
      link,
      columns,
      sourceRowKey: 'claimId',
    });
    expect(rows[0].claimMatched).toBe(false);
  });

  it('keeps the smallest row key on a duplicate key, whatever the fetch order, and counts it', () => {
    for (const source of [
      [claim('c2', 'e1', 200), claim('c1', 'e1', 100)],
      [claim('c1', 'e1', 100), claim('c2', 'e1', 200)],
    ]) {
      const { rows, duplicateKeys } = joinRows({ host: [visit('e1')], source, link, columns, sourceRowKey: 'claimId' });
      expect(duplicateKeys).toBe(1);
      expect(rows[0].claimBilled).toBe(100);
    }
  });

  it('keeps a source field that is missing from the row as null, and does not touch host columns', () => {
    const { rows } = joinRows({
      host: [visit('e1', { cptCodes: ['99213'] })],
      source: [{ claimId: 'c1', encounterId: 'e1' }],
      link,
      columns: [...columns, { field: 'cptCodes', column: 'claimCptCodes' }],
      sourceRowKey: 'claimId',
    });
    expect(rows[0]).toMatchObject({ cptCodes: ['99213'], claimCptCodes: null, claimBilled: null, claimMatched: true });
  });

  it('names the matched column after the prefix', () => {
    expect(linkMatchedColumn(findLink('encounters-comprehensive', 'billing')!)).toBe('billingMatched');
  });
});

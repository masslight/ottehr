// Order resolution, tested against the REAL imaging catalogue. Every value an order needs beyond the
// dictated name is derived here, so these are the tests that prove nothing is invented.

import { describe, expect, it } from 'vitest';
import { radiologyStudiesConfig } from '../ottehr-config/radiology';
import { LabPaymentMethod } from '../types/data/labs/labs.types';
import {
  labOrgIdsFor,
  matchNamedCatalogue,
  matchRadiologyStudy,
  NON_XRAY_MODALITY,
  resolveLabPaymentMethod,
  resolveOrderingOffice,
} from './order-matching';

const named = (...names: string[]): { name: string }[] => names.map((name) => ({ name }));
const match = (display: string, items: { name: string }[], searchTerms?: string[]): string[] =>
  matchNamedCatalogue(display, searchTerms, items, (item) => item.name).map((scored) => scored.item.name);

describe('matchNamedCatalogue', () => {
  const catalogue = named('Rapid Strep A', 'Influenza A/B', 'Rapid Influenza', 'Urinalysis', 'Urine hCG', 'CBC');

  it('finds a test by name', () => {
    expect(match('rapid strep', catalogue)[0]).toBe('Rapid Strep A');
    expect(match('urinalysis', catalogue)[0]).toBe('Urinalysis');
  });

  it('lets an exact name win outright', () => {
    expect(match('CBC', catalogue)[0]).toBe('CBC');
  });

  it('strips the words that describe ordering rather than the thing ordered', () => {
    // "order a rapid strep test in the office" must not be pulled around by order/test/office.
    expect(match('order a rapid strep test in the office', catalogue)[0]).toBe('Rapid Strep A');
  });

  it('returns nothing when the catalogue holds no such test', () => {
    expect(match('lyme serology', catalogue)).toEqual([]);
  });

  // "flu test" legitimately matches two entries — the executor's ambiguity rule then asks (interactive)
  // or auto-picks and marks low-confidence (bulk). That only works if both score near-equally.
  it('clusters near-equal names so the executor can ask', () => {
    const scored = matchNamedCatalogue('flu', undefined, catalogue, (item) => item.name);
    const influenza = scored.filter((s) => /influenza/i.test(s.item.name));
    expect(influenza.length).toBe(0); // "flu" is not a token of "Influenza"

    const scoredByTerm = matchNamedCatalogue('flu test', ['influenza'], catalogue, (item) => item.name);
    const names = scoredByTerm.map((s) => s.item.name);
    expect(names).toContain('Influenza A/B');
    expect(names).toContain('Rapid Influenza');
    expect(scoredByTerm[1].score / scoredByTerm[0].score).toBeGreaterThan(0.75);
  });

  it('does not let a long catalogue name beat a precise short one on one shared word', () => {
    const withPanel = named('Influenza A/B', 'Respiratory Pathogen Panel by PCR 22 targets influenza');
    expect(match('influenza', withPanel)[0]).toBe('Influenza A/B');
  });

  it('uses the model searchTerms as alternates', () => {
    expect(match('pregnancy test', named('Urine hCG'), ['urine hcg'])[0]).toBe('Urine hCG');
  });
});

describe('matchRadiologyStudy', () => {
  it('resolves a dictated X-ray to a CPT from the catalogue', () => {
    const ankle = matchRadiologyStudy('3-view right ankle X-ray', ['ankle x-ray'], radiologyStudiesConfig);
    expect(ankle.status).toBe('matched');
    if (ankle.status !== 'matched') throw new Error('unreachable');
    // View count and laterality are not in the catalogue's wording, so any ankle code is correct here.
    expect(['73600', '73610']).toContain(ankle.code);

    const chest = matchRadiologyStudy('chest x-ray, 2 views', [], radiologyStudiesConfig);
    expect(chest.status === 'matched' && ['71045', '71046'].includes(chest.code)).toBe(true);

    const wrist = matchRadiologyStudy('x-rays of the right wrist', [], radiologyStudiesConfig);
    expect(wrist.status === 'matched' && wrist.code === '73100').toBe(true);
  });

  // THE regression. This exact string once resolved to CPT 73590, "X-ray of lower leg" — a wrong
  // study charted with full confidence, because partial-word matching found the body part.
  it('refuses "venous duplex ultrasound" instead of charting an X-ray of the lower leg', () => {
    expect(matchRadiologyStudy('venous duplex ultrasound', [], radiologyStudiesConfig)).toEqual({
      status: 'wrong-modality',
    });
  });

  it('refuses every modality the in-clinic catalogue does not carry', () => {
    for (const study of [
      'abdominal ultrasound',
      'CT head without contrast',
      'cat scan of the abdomen',
      'MRI of the knee',
      'magnetic resonance of the brain',
      'echocardiogram',
      'renal sonogram',
      'nuclear stress test',
      'V/Q scan',
      'doppler of the leg',
    ]) {
      expect(matchRadiologyStudy(study, [], radiologyStudiesConfig).status, study).toBe('wrong-modality');
    }
  });

  it('does not mistake an ordinary word for a modality abbreviation', () => {
    expect(NON_XRAY_MODALITY.test('x-ray of the chest')).toBe(false);
    expect(NON_XRAY_MODALITY.test('acute abdominal series')).toBe(false);
  });

  it('reports no match when the body part is not in the catalogue', () => {
    expect(matchRadiologyStudy('x-ray of the mandible', [], radiologyStudiesConfig).status).toBe('no-match');
  });
});

describe('resolveLabPaymentMethod', () => {
  // Derived, never asked and never invented — the same defaulting the regular Labs tab applies.
  it("prefers workers' comp", () => {
    expect(resolveLabPaymentMethod({ appointmentIsWorkersComp: true, coverageCount: 2 })).toBe(
      LabPaymentMethod.WorkersComp
    );
  });

  it('uses insurance when the patient has coverage', () => {
    expect(resolveLabPaymentMethod({ appointmentIsWorkersComp: false, coverageCount: 1 })).toBe(
      LabPaymentMethod.Insurance
    );
  });

  it('falls back to self-pay', () => {
    expect(resolveLabPaymentMethod({ appointmentIsWorkersComp: false, coverageCount: 0 })).toBe(
      LabPaymentMethod.SelfPay
    );
  });
});

describe('resolveOrderingOffice', () => {
  const enabled = [{ labOrgRef: 'Organization/org-1' }];
  const offices = [
    { id: 'loc-1', enabledLabs: enabled },
    { id: 'loc-2', enabledLabs: enabled },
    { id: 'loc-3', enabledLabs: [] },
  ];

  it("prefers the encounter's own location when it is lab-enabled", () => {
    expect(resolveOrderingOffice(offices, 'loc-2')?.id).toBe('loc-2');
  });

  it('falls back to the only lab-enabled office', () => {
    expect(resolveOrderingOffice([offices[0], offices[2]], 'somewhere-else')?.id).toBe('loc-1');
  });

  // With several and no match on the encounter there is no defensible choice, so the caller skips
  // with a reason rather than picking one.
  it('gives no answer when several are enabled and none is the encounter location', () => {
    expect(resolveOrderingOffice(offices, 'loc-3')).toBeUndefined();
    expect(resolveOrderingOffice(offices, undefined)).toBeUndefined();
  });

  it('ignores offices with no enabled labs', () => {
    expect(resolveOrderingOffice([offices[2]], 'loc-3')).toBeUndefined();
    expect(resolveOrderingOffice(undefined, 'loc-1')).toBeUndefined();
  });
});

describe('labOrgIdsFor', () => {
  it('strips the resource-type prefix and joins', () => {
    expect(
      labOrgIdsFor({ enabledLabs: [{ labOrgRef: 'Organization/a' }, { labOrgRef: 'Organization/b' }] })
    ).toBe('a,b');
  });
});

import { DateTime } from 'luxon';
import { ImmunizationCptCode } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import {
  applyCptSuggestions,
  cvxComponentCount,
  isThrough18,
  suggestCptCodes,
} from '../../src/features/immunization/components/immunizationCodes';
import {
  applyImmunizationQuickPick,
  emptyImmunizationLine,
  ImmunizationFormValues,
  ImmunizationLine,
} from '../../src/features/immunization/components/immunizationLines';

const NASAL = '46713006';
const ORAL = '26643006';
const INTRAMUSCULAR = '78421000';

const line = (
  name: string,
  cvx: string,
  route = INTRAMUSCULAR,
  extra: Partial<ImmunizationFormValues> = {}
): ImmunizationLine => {
  const base = emptyImmunizationLine();
  return {
    ...base,
    details: { ...base.details, medication: { id: name, name }, route },
    administrationDetails: { ...base.administrationDetails, cvx },
    ...extra,
  };
};

const text = (codes: ImmunizationCptCode[] | undefined): string =>
  (codes ?? []).map((cpt) => (cpt.billableUnits ? `${cpt.code}×${cpt.billableUnits}` : cpt.code)).join(' ');

const all = (answer: boolean) => () => answer;

describe('cvxComponentCount', () => {
  it('counts the distinct CDSi antigens of each combination vaccine', () => {
    expect(cvxComponentCount('120')).toBe(5); // Pentacel
    expect(cvxComponentCount('110')).toBe(5); // Pediarix
    expect(cvxComponentCount('146')).toBe(6); // Vaxelis
    expect(cvxComponentCount('130')).toBe(4); // Kinrix / Quadracel
    expect(cvxComponentCount('94')).toBe(4); // ProQuad
    expect(cvxComponentCount('03')).toBe(3); // MMR
    expect(cvxComponentCount('115')).toBe(3); // Tdap
    expect(cvxComponentCount('113')).toBe(2); // Td
    expect(cvxComponentCount('216')).toBe(1); // Prevnar 20
    expect(cvxComponentCount('08')).toBe(1); // Hep B
  });

  it('is 1 for an unknown or missing CVX', () => {
    expect(cvxComponentCount('99999')).toBe(1);
    expect(cvxComponentCount(undefined)).toBe(1);
  });
});

describe('isThrough18', () => {
  const today = DateTime.fromISO('2026-11-11');
  it('is true until the 19th birthday', () => {
    expect(isThrough18('2007-11-12', today)).toBe(true);
    expect(isThrough18('2007-11-11', today)).toBe(false);
    expect(isThrough18('2026-09-11', today)).toBe(true);
    expect(isThrough18(undefined, today)).toBe(false);
  });
});

describe('suggestCptCodes', () => {
  // Maya, 2 months: Pediarix, ActHIB and Prevnar 20.
  const maya = [line('Pediarix', '110'), line('ActHIB', '48'), line('Prevnar 20', '216')];

  it("counseled 2-month set: 90460 ×3 and 90461 ×4 (Pediarix's four extra components)", () => {
    const codes = suggestCptCodes(maya, { pediatric: true, counseledFor: all(true) });
    expect(codes.map(text)).toEqual(['90460 90461×4', '90460', '90460']);
  });

  it('none counseled: 90471 then 90472 for each other injection', () => {
    const codes = suggestCptCodes(maya, { pediatric: true, counseledFor: all(false) });
    expect(codes.map(text)).toEqual(['90471', '90472', '90472']);
  });

  it('per vaccine: only the not-counseled ones take 9047x', () => {
    const codes = suggestCptCodes(maya, { pediatric: true, counseledFor: (index) => index !== 1 });
    expect(codes.map(text)).toEqual(['90460 90461×4', '90471', '90460']);
  });

  it("a quick pick's 90471 is the visit's first: the suggested lines take 90472", () => {
    const quickPicked = applyImmunizationQuickPick(
      line('Fluzone', '140'),
      { name: 'Flu', cptCodes: [{ code: '90471', display: 'admin' }] },
      false
    );
    const codes = suggestCptCodes([line('Boostrix', '115'), quickPicked, line('Prevnar 20', '216')], {
      pediatric: false,
      counseledFor: all(true),
    });
    expect(codes.map(text)).toEqual(['90472', '', '90472']);
    expect(codes[1]).toBeUndefined();
  });

  it('nasal or oral flu takes 90473, then 90474', () => {
    expect(
      text(suggestCptCodes([line('FluMist', '111', NASAL)], { pediatric: false, counseledFor: all(true) })[0])
    ).toBe('90473');
    const codes = suggestCptCodes([line('FluMist', '111', NASAL), line('RotaTeq', '116', ORAL), line('Td', '113')], {
      pediatric: true,
      counseledFor: all(false),
    });
    expect(codes.map(text)).toEqual(['90473', '90474', '90472']);
  });

  it('an adult gets 9047x even when counseled', () => {
    const codes = suggestCptCodes([line('Boostrix', '115'), line('Fluzone', '140')], {
      pediatric: false,
      counseledFor: all(true),
    });
    expect(codes.map(text)).toEqual(['90471', '90472']);
  });

  it("never changes a person's codes, an external dose or a line without a vaccine", () => {
    const manual = line('Pediarix', '110', INTRAMUSCULAR, {
      cptOrigin: 'manual',
      administrationDetails: { ...emptyImmunizationLine().administrationDetails, cvx: '110', cptCodes: [] },
    });
    const outside = line('MMR', '03', INTRAMUSCULAR, { outside: {} });
    const empty = emptyImmunizationLine();
    const codes = suggestCptCodes([manual, outside, empty, line('Prevnar 20', '216')], {
      pediatric: true,
      counseledFor: all(true),
    });
    expect(codes).toEqual([undefined, undefined, undefined, expect.anything()]);
  });
});

describe('applyCptSuggestions', () => {
  it('marks the codes suggested, reports the changed lines, and keeps the lines when nothing changes', () => {
    const lines = [line('Pediarix', '110'), line('Prevnar 20', '216')];
    const first = applyCptSuggestions(lines, { pediatric: true, counseledFor: all(true) });
    expect(first.changed).toEqual([0, 1]);
    expect(first.lines.every((next) => next.cptOrigin === 'suggested')).toBe(true);
    const again = applyCptSuggestions(first.lines, { pediatric: true, counseledFor: all(true) });
    expect(again.lines).toBe(first.lines);
    expect(again.changed).toEqual([]);
    const no = applyCptSuggestions(first.lines, { pediatric: true, counseledFor: all(false) });
    expect(no.changed).toEqual([0, 1]);
    expect(no.lines.map((next) => text(next.administrationDetails.cptCodes))).toEqual(['90471', '90472']);
  });

  it('drops its codes from a line made external', () => {
    const [suggested] = applyCptSuggestions([line('MMR', '03')], { pediatric: false, counseledFor: all(true) }).lines;
    const result = applyCptSuggestions([{ ...suggested, outside: {} }], { pediatric: false, counseledFor: all(true) });
    expect(result.lines[0].administrationDetails.cptCodes).toEqual([]);
    expect(result.lines[0].cptOrigin).toBeUndefined();
  });
});

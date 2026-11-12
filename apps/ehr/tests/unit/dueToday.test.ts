import {
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
} from 'utils/lib/immunization-forecast/types';
import { InventoryDrugRow, InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { Vaccine } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import {
  buildDueToday,
  CvxGroups,
  duplicateGroupsByLine,
  duplicateWarningText,
  fillFromDueToday,
  isVaccineAdded,
  lotToPrePick,
  StockedVaccine,
  stockedVaccines,
  vaccinesToAddAll,
} from '../../src/features/immunization/components/dueToday';
import {
  emptyImmunizationLine,
  ImmunizationFormValues,
} from '../../src/features/immunization/components/immunizationLines';

// Maya, 4 months: DTaP, Hib, polio, PCV and rotavirus due; Hep B 3 and flu coming up (the Due today mockup).
const group = (
  id: ImmunizationGroupId,
  label: string,
  status: ImmunizationGroupForecast['status'],
  next?: { n: number; recommended: string; cvx: string[] },
  mark?: ImmunizationGroupForecast['mark']
): ImmunizationGroupForecast => ({
  group: id,
  label,
  status,
  seriesStatus: 'Not Complete',
  seriesNames: [],
  targetDoses: 3,
  targetText: '3',
  doses: [],
  next: next ? { ...next, earliest: next.recommended, pastDue: null, latest: null } : null,
  notNeeded: [],
  notes: [],
  mark,
});

const forecast: ImmunizationForecast = {
  asOf: '2026-11-10',
  dataVersion: '2026-11',
  unmappedDoses: [],
  groups: [
    group('hepb', 'Hep B', 'uptodate', { n: 3, recommended: '2026-12-23', cvx: ['08', '110', '146'] }),
    group('rota', 'Rotavirus', 'due', { n: 2, recommended: '2026-11-08', cvx: ['116', '119'] }),
    group('dtap', 'DTaP/Tdap/Td', 'pastdue', {
      n: 2,
      recommended: '2026-11-08',
      cvx: ['20', '110', '120', '146', '50'],
    }),
    // The CDC data names forecast vaccine types only for product-specific recommendations, so most groups come with
    // an empty list and coverage falls back to the CVX → group map.
    group('hib', 'Hib', 'due', { n: 2, recommended: '2026-11-08', cvx: [] }),
    group('pcv', 'PCV', 'due', { n: 2, recommended: '2026-11-08', cvx: ['133', '216'] }),
    group('ipv', 'Polio', 'due', { n: 2, recommended: '2026-11-08', cvx: ['10', '110', '120', '146'] }),
    group('flu', 'Influenza', 'notyet', { n: 1, recommended: '2027-01-08', cvx: ['140'] }),
    group('mmr', 'MMR', 'notyet', { n: 1, recommended: '2027-07-08', cvx: ['03'] }),
    group('menb', 'MenB', 'due', { n: 1, recommended: '2026-11-08', cvx: ['162'] }),
  ],
};

const cvxGroups: CvxGroups = {
  '08': ['hepb'],
  '10': ['ipv'],
  '20': ['dtap'],
  '48': ['hib'],
  '110': ['dtap', 'ipv', 'hepb'],
  '116': ['rota'],
  '120': ['dtap', 'hib', 'ipv'],
  '146': ['dtap', 'hib', 'ipv', 'hepb'],
  '216': ['pcv', 'pneumo-adult'],
  '162': ['menb'],
};

const vaccine = (id: string, name: string, cvx?: string): Vaccine => ({ id, name, cvx });
const quickPick = (
  name: string,
  vaccineId: string,
  cvx: string | undefined,
  extra: Partial<ImmunizationQuickPickData> = {}
): ImmunizationQuickPickData => ({
  id: `qp-${name}`,
  name,
  vaccine: { id: vaccineId, name: vaccineId },
  cvx,
  dose: '0.5',
  units: 'mL',
  route: '78421000',
  ...extra,
});

// The CVX is the catalog entry's; a vaccine from the config list that predates the catalog has none.
const VACCINES = [
  vaccine('pentacel', 'Pentacel', '120'),
  vaccine('daptacel', 'Daptacel', '20'),
  vaccine('acthib', 'ActHIB', '48'),
  vaccine('ipol', 'IPOL', '10'),
  vaccine('vaxelis', 'Vaxelis', '146'),
  vaccine('prevnar', 'Prevnar 20', '216'),
  vaccine('rotateq', 'RotaTeq', '116'),
  vaccine('engerix', 'Engerix-B'),
];
const QUICK_PICKS = [
  quickPick('Pentacel 2/4/6 mo', 'pentacel', '120', { location: { name: 'Left Thigh', code: 'LT' } }),
  quickPick('Pentacel 15–18 mo', 'pentacel', '120', { location: { name: 'Left Deltoid', code: 'LD' } }),
  quickPick('Daptacel', 'daptacel', '20'),
  quickPick('ActHIB', 'acthib', '48'),
  quickPick('IPOL', 'ipol', '10'),
  quickPick('Vaxelis', 'vaxelis', '146'),
  quickPick('Prevnar 20 infant', 'prevnar', '216'),
  quickPick('RotaTeq', 'rotateq', '116', { dose: '2', route: '26643006' }),
  quickPick('Engerix-B peds', 'engerix', undefined),
];

const lot = (id: string, overrides: Partial<InventoryLot> = {}): InventoryLot => ({
  id,
  catalogMedicationId: 'pentacel',
  locationId: 'loc-1',
  lotNumber: id.toUpperCase(),
  expirationDate: '2027-06-30',
  ndc: '49281-0511-05',
  manufacturer: 'Sanofi Pasteur',
  mvx: 'PMC',
  fundingSource: 'private',
  onHand: 5,
  unit: 'dose',
  status: 'active',
  ...overrides,
});
const stockRow = (medicationId: string, lots: InventoryLot[]): InventoryDrugRow =>
  ({
    medicationId,
    name: medicationId,
    type: 'vaccine',
    lots: lots.map((l) => ({ ...l, markers: [] })),
  }) as unknown as InventoryDrugRow;

const stocked = stockedVaccines(VACCINES, QUICK_PICKS);
const byId = (id: string): StockedVaccine => stocked.find((vaccine) => vaccine.id === id)!;
const names = (candidates: { vaccine: { name: string } }[]): string[] => candidates.map((c) => c.vaccine.name);

describe('stockedVaccines', () => {
  it('without inventory, takes the practice vaccine list as the stock, with each one’s catalog CVX and quick picks', () => {
    expect(byId('pentacel')).toMatchObject({ name: 'Pentacel', cvxCodes: ['120'], lots: [] });
    expect(byId('pentacel').quickPicks.map((qp) => qp.name)).toEqual(['Pentacel 2/4/6 mo', 'Pentacel 15–18 mo']);
    expect(byId('engerix').cvxCodes).toEqual([]);
    expect(stockedVaccines(undefined, QUICK_PICKS)).toEqual([]);
    expect(stockedVaccines(VACCINES, QUICK_PICKS, []).map((v) => v.id)).toEqual(VACCINES.map((v) => v.id));
  });

  it('pads a CVX to the engine’s two digits', () => {
    expect(stockedVaccines([vaccine('e', 'Engerix', '8')], [])[0].cvxCodes).toEqual(['08']);
  });

  it('offers every vaccine: tracked with none on hand is out of stock, never tracked counts as available', () => {
    const inventory = [
      stockRow('pentacel', [lot('p1'), lot('p0', { onHand: 0 })]),
      stockRow('daptacel', [lot('d0', { catalogMedicationId: 'daptacel', onHand: 0 })]),
    ];
    const stockedHere = stockedVaccines(VACCINES, QUICK_PICKS, inventory);
    expect(stockedHere.map((v) => v.id)).toEqual(VACCINES.map((v) => v.id));
    const here = (id: string): StockedVaccine => stockedHere.find((v) => v.id === id)!;
    expect(here('pentacel')).toMatchObject({ outOfStock: false });
    expect(here('pentacel').lots.map((l) => l.id)).toEqual(['p1']);
    expect(here('daptacel')).toMatchObject({ outOfStock: true, lots: [] });
    // no lots ever entered for it: not tracked in Ottehr, so available
    expect(here('ipol')).toMatchObject({ outOfStock: false, lots: [] });
  });

  it('an expired lot is not stock: a vaccine whose only lots are expired is out of stock', () => {
    const inventory = [
      stockRow('pentacel', [lot('p1'), lot('px', { expirationDate: '2026-10-31' })]),
      stockRow('daptacel', [lot('dx', { catalogMedicationId: 'daptacel', expirationDate: '2026-10-31' })]),
    ];
    const stockedHere = stockedVaccines(VACCINES, QUICK_PICKS, inventory, '2026-11-12');
    const here = (id: string): StockedVaccine => stockedHere.find((v) => v.id === id)!;
    expect(here('pentacel')).toMatchObject({ outOfStock: false });
    expect(here('pentacel').lots.map((l) => l.id)).toEqual(['p1']);
    expect(here('daptacel')).toMatchObject({ outOfStock: true, lots: [] });
  });
});

describe('buildDueToday — out of stock', () => {
  it('leads with an in-stock vaccine and keeps the out-of-stock combination under "Other ways"', () => {
    const inventory = [stockRow('pentacel', [lot('p0', { onHand: 0 })])];
    const withPentacelOut = buildDueToday(
      forecast,
      stockedVaccines(
        VACCINES.filter((v) => ['pentacel', 'daptacel', 'acthib', 'ipol'].includes(v.id)),
        [],
        inventory
      ),
      cvxGroups
    );
    expect(withPentacelOut.rows.map((row) => row.lead.vaccine.name)).toEqual(['ActHIB', 'Daptacel', 'IPOL']);
    expect(withPentacelOut.rows[0].alternatives.map((c) => [c.vaccine.name, c.vaccine.outOfStock])).toEqual([
      ['Pentacel', true],
    ]);
  });

  it('still leads with an out-of-stock vaccine when nothing else covers the group', () => {
    const inventory = [stockRow('prevnar', [lot('v0', { catalogMedicationId: 'prevnar', onHand: 0 })])];
    const row = buildDueToday(
      forecast,
      stockedVaccines(
        VACCINES.filter((v) => v.id === 'prevnar'),
        [],
        inventory
      ),
      cvxGroups
    ).rows[0];
    expect([row.lead.vaccine.name, row.lead.vaccine.outOfStock]).toEqual(['Prevnar 20', true]);
  });
});

describe('buildDueToday — option A, fewest shots first', () => {
  const dueToday = buildDueToday(forecast, stocked, cvxGroups);

  it('makes one row per group of due diseases, led by the vaccine covering the most', () => {
    expect(dueToday.rows.map((row) => [row.lead.vaccine.name, row.covers])).toEqual([
      ['Pentacel', ['dtap', 'hib', 'ipv']],
      ['Prevnar 20', ['pcv']],
      ['RotaTeq', ['rota']],
    ]);
    expect(dueToday.due.map((group) => group.id)).toEqual(['rota', 'dtap', 'hib', 'pcv', 'ipv', 'menb']);
  });

  it('puts the single vaccines and the combination with an extra under "Other ways", best first', () => {
    const [pentacel, prevnar, rotateq] = dueToday.rows;
    expect(names(pentacel.alternatives)).toEqual(['Vaxelis', 'ActHIB', 'Daptacel', 'IPOL']);
    expect(pentacel.alternatives[0].extras).toEqual(['hepb']);
    expect(prevnar.alternatives).toEqual([]);
    expect(rotateq.alternatives).toEqual([]);
  });

  it('prefers the product that covers nothing not yet due (Pentacel over Vaxelis) when shots tie', () => {
    const twoCombos = buildDueToday(
      forecast,
      stocked.filter((vaccine) => ['pentacel', 'vaxelis'].includes(vaccine.id)),
      cvxGroups
    );
    expect(names([twoCombos.rows[0].lead])).toEqual(['Pentacel']);
    expect(names(twoCombos.rows[0].alternatives)).toEqual(['Vaxelis']);
  });

  it('when shots and extras tie, leads with the vaccine whose lot expires soonest (tie rule 3)', () => {
    const inventory = [
      stockRow('daptacel', [lot('d1', { catalogMedicationId: 'daptacel', expirationDate: '2027-09-30' })]),
      stockRow('infanrix', [
        lot('i2', { catalogMedicationId: 'infanrix', expirationDate: '2027-12-31' }),
        lot('i1', { catalogMedicationId: 'infanrix', expirationDate: '2027-03-31' }),
      ]),
    ];
    const twoDtaps = buildDueToday(
      forecast,
      stockedVaccines([vaccine('daptacel', 'Daptacel', '20'), vaccine('infanrix', 'Infanrix', '20')], [], inventory),
      cvxGroups
    );
    expect(names([twoDtaps.rows[0].lead])).toEqual(['Infanrix']);
    expect(names(twoDtaps.rows[0].alternatives)).toEqual(['Daptacel']);
  });

  it('falls back to single vaccines, one row each, when no combination is stocked', () => {
    const singles = buildDueToday(
      forecast,
      stocked.filter((vaccine) => ['daptacel', 'acthib', 'ipol'].includes(vaccine.id)),
      cvxGroups
    );
    expect(singles.rows.map((row) => [row.lead.vaccine.name, row.covers])).toEqual([
      ['ActHIB', ['hib']],
      ['Daptacel', ['dtap']],
      ['IPOL', ['ipv']],
    ]);
    expect(singles.unstocked.map((group) => group.id)).toEqual(['rota', 'pcv', 'menb']);
  });

  it('names the due groups no stocked vaccine with a CVX covers, and what is coming up', () => {
    expect(dueToday.unstocked.map((group) => group.label)).toEqual(['MenB']);
    expect(dueToday.upcoming).toEqual([
      'Hep B 3 not due until 12/23/2026',
      'Influenza 1 not due until 01/08/2027',
      'MMR 1 not due until 07/08/2027',
    ]);
  });

  it('takes a marked vaccine out of the box and says so', () => {
    const marked: ImmunizationForecast = {
      ...forecast,
      groups: forecast.groups.map((g) =>
        g.group === 'rota'
          ? { ...g, status: 'declined', next: null, mark: { type: 'declined', date: '2026-11-10', by: 'J. Nurse' } }
          : g
      ),
    };
    const result = buildDueToday(marked, stocked, cvxGroups);
    expect(result.rows.map((row) => row.lead.vaccine.name)).toEqual(['Pentacel', 'Prevnar 20']);
    expect(result.notSuggested).toEqual(['Rotavirus (declined)']);
  });
});

describe('what ⊕ fills — option B', () => {
  const line = emptyImmunizationLine({ id: 'prov', name: 'Dr. Test' });

  it('fills the whole line from the only quick pick', () => {
    const filled = fillFromDueToday(line, byId('rotateq'));
    expect(filled.details).toMatchObject({ medication: { id: 'rotateq' }, dose: '2', units: 'mL', route: '26643006' });
    expect(filled.administrationDetails.cvx).toBe('116');
    expect(filled.details.orderedProvider).toEqual({ id: 'prov', name: 'Dr. Test' });
  });

  it('fills from the quick pick picked in the box when the vaccine has several', () => {
    const filled = fillFromDueToday(line, byId('pentacel'), byId('pentacel').quickPicks[1]);
    expect(filled.details.location).toEqual({ name: 'Left Deltoid', code: 'LD' });
    expect(filled.administrationDetails.cvx).toBe('120');
  });

  it('adds only the vaccine (and its one CVX) without a quick pick, leaving the line to ask', () => {
    const filled = fillFromDueToday(line, byId('pentacel'));
    expect(filled.details).toEqual({
      orderedProvider: { id: 'prov', name: 'Dr. Test' },
      medication: { id: 'pentacel', name: 'Pentacel' },
    });
    expect(filled.details.dose).toBeUndefined();
    expect(filled.administrationDetails.cvx).toBe('120');
  });

  it('pre-picks the lot the Lot blank would list first: the patient’s stock, soonest expiry, never expired or borrowed', () => {
    const pentacel: StockedVaccine = {
      ...byId('pentacel'),
      lots: [
        lot('private-late', { expirationDate: '2027-06-30', fundingSource: 'private' }),
        lot('vfc-soon', { expirationDate: '2027-03-31', fundingSource: 'vfc', ndc: '49281-0510-05' }),
        lot('vfc-expired', { expirationDate: '2026-01-31', fundingSource: 'vfc' }),
      ],
    };
    const today = '2026-11-10';
    expect(lotToPrePick(pentacel, { vfcEligibility: 'V02', today })?.id).toBe('vfc-soon');
    expect(lotToPrePick(pentacel, { vfcEligibility: 'V01', today })?.id).toBe('private-late');
    // eligibility not confirmed yet: no VFC lot is pre-picked, even when it expires first
    expect(lotToPrePick(pentacel, { today })?.id).toBe('private-late');
    expect(lotToPrePick({ ...pentacel, lots: [pentacel.lots[1]] }, { today })).toBeUndefined();
    // only the other stock on hand: nothing is pre-picked; borrowing is the provider's call in the Lot blank
    expect(lotToPrePick({ ...pentacel, lots: [pentacel.lots[0]] }, { vfcEligibility: 'V02', today })).toBeUndefined();

    const filled = fillFromDueToday(line, pentacel, undefined, { vfcEligibility: 'V02', today });
    expect(filled.administrationDetails).toMatchObject({
      cvx: '120',
      lot: 'VFC-SOON',
      expDate: '2027-03-31',
      ndc: '49281-0510-05',
      mvx: 'PMC',
      fundingSource: 'vfc',
      vfcEligibility: 'V02',
    });
    expect(filled.details.manufacturer).toBe('Sanofi Pasteur');
    // without lots the line keeps its blanks for the Lot blank to fill
    expect(fillFromDueToday(line, byId('pentacel'), undefined, { today }).administrationDetails.lot).toBe('');
  });

  it('"Add all due" adds each row’s lead that is not on the page yet', () => {
    const dueToday = buildDueToday(forecast, stocked, cvxGroups);
    const lines: ImmunizationFormValues[] = [fillFromDueToday(line, byId('prevnar'))];
    expect(vaccinesToAddAll(dueToday, lines).map((vaccine) => vaccine.name)).toEqual(['Pentacel', 'RotaTeq']);
    expect(isVaccineAdded(byId('prevnar'), lines)).toBe(true);
    expect(isVaccineAdded(byId('prevnar'), [{ ...lines[0], outside: {} }])).toBe(false);
  });
});

describe('duplicateGroupsByLine — the duplicate warning on a later line', () => {
  const base = emptyImmunizationLine();
  const typed = (id: string, name: string, cvx: string): ImmunizationFormValues => ({
    ...base,
    details: { medication: { id, name } },
    administrationDetails: { cvx },
  });

  it('warns on the later line about each disease an earlier line already gives, due or not', () => {
    const lines = [typed('pediarix', 'Pediarix', '110'), typed('engerix', 'Engerix-B', '08')];
    const duplicates = duplicateGroupsByLine(lines, stocked, cvxGroups);
    expect(duplicates).toEqual([[], [{ vaccine: 'Pediarix', groups: ['Hep B'] }]]);
    expect(duplicateWarningText(duplicates[1])).toBe('Hep B is also in Pediarix above.');
    const twice = duplicateGroupsByLine(
      [typed('pediarix', 'Pediarix', '110'), typed('vaxelis', 'Vaxelis', '146')],
      stocked,
      cvxGroups
    );
    expect(duplicateWarningText(twice[1])).toBe('DTaP/Tdap/Td, Polio, Hep B are also in Pediarix above.');
  });

  it('says nothing for different diseases, outside lines or lines without a vaccine', () => {
    expect(
      duplicateGroupsByLine([typed('engerix', 'Engerix-B', '08'), typed('ipol', 'IPOL', '10')], stocked, cvxGroups)
    ).toEqual([[], []]);
    expect(
      duplicateGroupsByLine(
        [{ ...typed('engerix', 'Engerix-B', '08'), outside: {} }, typed('engerix2', 'Engerix-B', '08'), base],
        stocked,
        cvxGroups
      )
    ).toEqual([[], [], []]);
  });

  it('finds the CVX from the stocked vaccine when none is typed', () => {
    const lines = [fillFromDueToday(base, byId('pentacel')), typed('ipol', 'IPOL', '10')];
    expect(duplicateWarningText(duplicateGroupsByLine(lines, stocked, cvxGroups)[1])).toBe(
      'Polio is also in Pentacel above.'
    );
  });
});

import {
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
} from 'utils/lib/immunization-forecast/types';
import { ImmunizationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { Vaccine } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import {
  buildDueToday,
  coverageOf,
  CvxGroups,
  fillFromDueToday,
  isVaccineAdded,
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

const vaccine = (id: string, name: string): Vaccine => ({ id, name });
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

const VACCINES = [
  vaccine('pentacel', 'Pentacel'),
  vaccine('daptacel', 'Daptacel'),
  vaccine('acthib', 'ActHIB'),
  vaccine('ipol', 'IPOL'),
  vaccine('vaxelis', 'Vaxelis'),
  vaccine('prevnar', 'Prevnar 20'),
  vaccine('rotateq', 'RotaTeq'),
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
  quickPick('Engerix-B peds', 'engerix', undefined), // no CVX: cannot be suggested
];

const stocked = stockedVaccines(VACCINES, QUICK_PICKS);
const byId = (id: string): StockedVaccine => stocked.find((vaccine) => vaccine.id === id)!;
const names = (candidates: { vaccine: { name: string } }[]): string[] => candidates.map((c) => c.vaccine.name);

describe('stockedVaccines', () => {
  it('takes the practice vaccine list as the stock and reads each one’s CVX codes and quick picks from its quick picks', () => {
    expect(byId('pentacel')).toMatchObject({ name: 'Pentacel', cvxCodes: ['120'] });
    expect(byId('pentacel').quickPicks.map((qp) => qp.name)).toEqual(['Pentacel 2/4/6 mo', 'Pentacel 15–18 mo']);
    expect(byId('engerix').cvxCodes).toEqual([]);
    expect(stockedVaccines(undefined, QUICK_PICKS)).toEqual([]);
  });

  it('pads a typed CVX to the engine’s two digits', () => {
    expect(stockedVaccines([vaccine('e', 'Engerix')], [quickPick('E', 'e', '8')])[0].cvxCodes).toEqual(['08']);
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

  it('"Add all due" adds each row’s lead that is not on the page yet', () => {
    const dueToday = buildDueToday(forecast, stocked, cvxGroups);
    const lines: ImmunizationFormValues[] = [fillFromDueToday(line, byId('prevnar'))];
    expect(vaccinesToAddAll(dueToday, lines).map((vaccine) => vaccine.name)).toEqual(['Pentacel', 'RotaTeq']);
    expect(isVaccineAdded(byId('prevnar'), lines)).toBe(true);
    expect(isVaccineAdded(byId('prevnar'), [{ ...lines[0], outside: {} }])).toBe(false);
  });
});

describe('coverageOf — the coverage strip', () => {
  it('counts how many lines give each due disease, by the typed CVX or the vaccine’s', () => {
    const dueToday = buildDueToday(forecast, stocked, cvxGroups);
    const base = emptyImmunizationLine();
    const lines: ImmunizationFormValues[] = [
      fillFromDueToday(base, byId('pentacel')),
      { ...base, details: { medication: { id: 'daptacel', name: 'Daptacel' } }, administrationDetails: { cvx: '20' } },
      { ...base, details: { medication: { id: 'typed', name: 'Some IPV' } }, administrationDetails: { cvx: '10' } },
      { ...base, details: { medication: { id: 'rotateq', name: 'RotaTeq' } }, administrationDetails: {}, outside: {} },
    ];
    const coverage = coverageOf(dueToday.due, lines, stocked, cvxGroups);
    expect(coverage.map(({ group, count }) => [group.id, count])).toEqual([
      ['rota', 0],
      ['dtap', 2],
      ['hib', 1],
      ['pcv', 0],
      ['ipv', 2],
      ['menb', 0],
    ]);
  });
});

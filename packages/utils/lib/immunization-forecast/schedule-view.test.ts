import { describe, expect, it } from 'vitest';
import { buildVaccineScheduleView, VaccineScheduleLane } from './schedule-view';

const view = buildVaccineScheduleView();
const lane = (lanes: VaccineScheduleLane[], group: string): VaccineScheduleLane => {
  const found = lanes.find((candidate) => candidate.group === group);
  if (!found) throw new Error(`no lane ${group} in ${lanes.map((l) => l.group).join(', ')}`);
  return found;
};

describe('buildVaccineScheduleView', () => {
  it('cites the shipped data: CDC CDSi 4.64 and AIRA 26.1 for the seasonal antigens', () => {
    expect(view.dataVersion).toBe('2026-11');
    expect(view.sources.map((source) => [source.version, source.antigens.length])).toEqual([
      ['4.64', 17],
      ['26.1', 3],
    ]);
  });

  it('children: the default series of each childhood lane, with ages and intervals as the data words them', () => {
    expect(view.children.map((l) => l.group)).toEqual([
      'hepb',
      'rota',
      'dtap',
      'hib',
      'pcv',
      'ipv',
      'mmr',
      'var',
      'hepa',
      'hpv',
      'menacwy',
      'menb',
    ]);
    const hepb = lane(view.children, 'hepb');
    expect(hepb.seriesName).toBe('HepB 3-dose series');
    expect(hepb.level).toBe('Routine');
    expect(hepb.target).toBe('3');
    expect(hepb.doses[1]).toEqual({
      label: 'Dose 2',
      recurring: false,
      minAge: '4 weeks',
      recommendedAge: '1 month',
      pastDueAge: '3 months + 4 weeks',
      minInterval: '4 weeks',
      recommendedInterval: '4 weeks',
    });
    expect(lane(view.children, 'dtap').target).toBe('5, then Tdap at 11–12 y');
    expect(lane(view.children, 'menb').level).toBe('Shared decision');
    expect(lane(view.children, 'hpv').doses[0].recommendedAge).toBe('11 years');
  });

  it('adults: the series the data applies from adolescence on, plus the Td booster of the childhood series', () => {
    expect(view.adults.map((l) => [l.group, l.seriesName])).toEqual([
      ['hepb', 'HepB 19+ 3-dose series'],
      ['dtap', 'Diphtheria standard series'],
      ['ipv', 'Polio adult catch-up series'],
      ['var', 'Varicella 13+ 2-dose series'],
      ['hpv', 'HPV 3-dose series'],
      ['menb', 'Meningococcal B 2-dose series MenB-4C Shared Clinical Decision Making'],
      ['zoster', 'Zoster 2-dose series'],
      ['pneumo-adult', 'Pneumococcal 50+ 1-dose PCV series'],
      ['rsv-adult', 'RSV Adult 1-dose series'],
    ]);
    expect(lane(view.adults, 'dtap').doses).toEqual([
      { label: 'Booster', recurring: true, minInterval: '5 years', recommendedInterval: '10 years' },
    ]);
    expect(lane(view.adults, 'zoster').doses[0].recommendedAge).toBe('50 years');
  });

  it('seasonal: flu, COVID and infant RSV with the season dates from the data', () => {
    expect(view.seasonal.map((row) => [row.group, row.seasonStart, row.seasonEnd ?? null, row.minAge])).toEqual([
      ['rsv', '2026-10-01', '2027-03-31', '0 days'],
      ['flu', '2026-07-01', '2027-06-30', '6 months'],
      ['covid', '2026-09-02', null, '6 months'],
    ]);
    expect(view.seasonal[1].source).toBe('AIRA medical societies (AAP/AAFP/ACOG/IDSA) Supporting Data 26.1');
  });
});

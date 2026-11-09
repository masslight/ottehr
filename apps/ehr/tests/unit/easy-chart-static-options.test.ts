import { describe, expect, it } from 'vitest';
import { matchStaticOptions } from '../../src/features/easy-chart/executor/static-options';
import { HospitalizationOptions } from '../../src/features/visits/in-person/components/hospitalization/hospitalizationOptions';
import { SURGICAL_HISTORY_OPTIONS } from '../../src/features/visits/shared/components/medical-history-tab/SurgicalHistory/surgicalHistoryOptions';

const top = (display: string, options: { display: string; code: string }[], searchTerms?: string[]): string =>
  matchStaticOptions({ display, searchTerms }, options)[0]?.display ?? '';

describe('matchStaticOptions', () => {
  it('finds a surgery by name and carries its code as the id', () => {
    const [match] = matchStaticOptions({ display: 'appendectomy' }, SURGICAL_HISTORY_OPTIONS);
    expect(match).toMatchObject({ id: '44950', display: 'Appendectomy' });
  });

  it('lets an exact name win outright', () => {
    expect(top('Anaphylaxis', HospitalizationOptions)).toBe('Anaphylaxis');
  });

  it('ignores words that describe the request rather than the item', () => {
    expect(top('please get the appendectomy in', SURGICAL_HISTORY_OPTIONS)).toBe('Appendectomy');
  });

  it('uses the search terms as alternates', () => {
    expect(top('had her appendix out', SURGICAL_HISTORY_OPTIONS, ['appendectomy'])).toBe('Appendectomy');
  });

  it('does not let a long name beat a precise short one on one shared word', () => {
    const options = [
      { display: 'Asthma', code: '1' },
      { display: 'Exacerbation of asthma with status', code: '2' },
    ];
    expect(top('asthma', options)).toBe('Asthma');
  });

  it('returns nothing when no option shares a word', () => {
    expect(matchStaticOptions({ display: 'lyme disease' }, SURGICAL_HISTORY_OPTIONS)).toEqual([]);
  });
});

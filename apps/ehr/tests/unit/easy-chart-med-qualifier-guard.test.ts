import { EasyChartAgentIntent } from 'utils';
import { describe, expect, it } from 'vitest';
import { SearchResult } from '../../src/features/easy-charting/chart-types';
import { rankMedicationResults, unsupportedMedQualifiers } from '../../src/features/easy-charting/intent-logic';

// The medication auto-pick charts rankMedicationResults()[0] (dose-gate permitting), so ranking IS
// product selection. An indication/site/population qualifier in a product NAME ("Athletes Foot",
// "Vaginal", "Children's") makes it a different product from the plain molecule — lock in the rule
// that an unsupported-qualifier product never outranks a supported/neutral one, and that the guard
// never turns a previously-successful match into a failure.
describe('medication qualifier guard', () => {
  type MedIntent = Extract<EasyChartAgentIntent, { kind: 'add-medication' }> & { sourceText?: string };
  const intent = (over: Partial<MedIntent> = {}): MedIntent => ({
    kind: 'add-medication',
    display: 'Clotrimazole cream',
    searchTerms: ['clotrimazole cream'],
    ...over,
  });

  const athletesFoot: SearchResult = { name: 'CLOTRIMAZOLE ATHLETES FOOT TOPICAL CREAM', strength: '1 %' };
  const plain: SearchResult = { name: 'CLOTRIMAZOLE TOPICAL CREAM', strength: '1 %' };
  const jockItch: SearchResult = { name: 'CLOTRIMAZOLE JOCK ITCH TOPICAL CREAM', strength: '1 %' };

  it('pins the live failure: vaginal-context clotrimazole must not chart an Athletes Foot product', () => {
    const i = intent({
      strength: '1%',
      sourceText: 'vaginal candidiasis — clotrimazole 1% cream applied to the affected vulvovaginal area twice daily',
    });
    // eRx order had the Athletes Foot line first; both candidates match the dictated strength.
    const ranked = rankMedicationResults([athletesFoot, plain], i);
    expect(ranked[0]).toBe(plain);
    expect(ranked).toHaveLength(2); // nothing dropped — the picker still shows the alternative
  });

  it('unsupported qualifier loses to a neutral candidate even with no strength/form dictated', () => {
    const ranked = rankMedicationResults([athletesFoot, plain], intent());
    expect(ranked[0]).toBe(plain);
  });

  it('a supported qualifier ranks normally (context mentions athlete’s foot)', () => {
    const i = intent({ sourceText: "athlete's foot on the left foot, start clotrimazole cream" });
    const ranked = rankMedicationResults([athletesFoot, plain], i);
    expect(ranked[0]).toBe(athletesFoot); // original eRx order preserved — guard does not fire
  });

  it('falls back to current behavior when ALL candidates carry unsupported qualifiers', () => {
    const i = intent({ sourceText: 'vaginal candidiasis' });
    const ranked = rankMedicationResults([athletesFoot, jockItch], i);
    expect(ranked).toEqual([athletesFoot, jockItch]); // uniform tier → original order, still a match
  });

  it('qualifier tokens that are part of the searched drug term never penalize', () => {
    const i = intent({
      display: 'Clotrimazole athletes foot cream',
      searchTerms: ['clotrimazole athletes foot cream'],
    });
    const ranked = rankMedicationResults([athletesFoot, plain], i);
    expect(ranked[0]).toBe(athletesFoot);
  });

  it('strength/form ranking still decides WITHIN the supported tier', () => {
    const plainHalf: SearchResult = { name: 'CLOTRIMAZOLE TOPICAL CREAM', strength: '0.5 %' };
    const i = intent({ strength: '1%', sourceText: 'vaginal candidiasis' });
    const ranked = rankMedicationResults([athletesFoot, plainHalf, plain], i);
    // Both plain products beat the unsupported Athletes Foot line; the dictated strength wins the tier.
    expect(ranked.map((r) => r.strength)).toEqual(['1 %', '0.5 %', '1 %']);
    expect(ranked[0]).toBe(plain);
    expect(ranked[2]).toBe(athletesFoot);
  });

  it('population qualifiers: plain product beats an unsupported "Children\'s" line', () => {
    const childrens: SearchResult = { name: "CHILDREN'S IBUPROFEN ORAL SUSPENSION", strength: '100 MG/5ML' };
    const adultPlain: SearchResult = { name: 'IBUPROFEN ORAL SUSPENSION', strength: '100 MG/5ML' };
    const i = intent({ display: 'Ibuprofen', searchTerms: ['ibuprofen'], sourceText: 'ibuprofen for pain' });
    expect(rankMedicationResults([childrens, adultPlain], i)[0]).toBe(adultPlain);
    // …but pediatric context supports it, so the eRx order stands.
    const ped = intent({ display: 'Ibuprofen', searchTerms: ['ibuprofen'], sourceText: "children's ibuprofen" });
    expect(rankMedicationResults([childrens, adultPlain], ped)[0]).toBe(childrens);
  });

  it('abbreviated "AF" (athlete\'s foot) qualifier loses to the plain product under vaginal context', () => {
    const afVariant: SearchResult = { name: 'CLOTRIMAZOLE AF TOPICAL CREAM', strength: '1 %' };
    const i = intent({
      strength: '1%',
      // "AFfected" must not count as evidence for the standalone token "af".
      sourceText: 'vaginal candidiasis — clotrimazole 1% cream applied to the affected vulvovaginal area twice daily',
    });
    const ranked = rankMedicationResults([afVariant, plain], i);
    expect(ranked[0]).toBe(plain);
    expect(ranked).toHaveLength(2);
  });

  it('"AF" ranks normally when the context supports athlete\'s foot — spelled out or abbreviated', () => {
    const afVariant: SearchResult = { name: 'CLOTRIMAZOLE AF TOPICAL CREAM', strength: '1 %' };
    const spelled = intent({ sourceText: "athlete's foot on the left foot, start clotrimazole cream" });
    expect(rankMedicationResults([afVariant, plain], spelled)[0]).toBe(afVariant);
    // The provider searched the abbreviated product name itself.
    const abbreviated = intent({ display: 'Clotrimazole AF cream', searchTerms: ['clotrimazole af cream'] });
    expect(rankMedicationResults([afVariant, plain], abbreviated)[0]).toBe(afVariant);
  });

  it('unsupportedMedQualifiers flags only vocabulary words absent from the evidence', () => {
    expect(unsupportedMedQualifiers('CLOTRIMAZOLE ATHLETES FOOT TOPICAL CREAM', 'clotrimazole cream vaginal')).toEqual([
      'athletes',
      'foot',
    ]);
    // Synonym stems support a qualifier the narrative phrases differently (tinea pedis ⇒ athlete's foot).
    expect(unsupportedMedQualifiers('CLOTRIMAZOLE ATHLETES FOOT CREAM', 'clotrimazole for tinea pedis')).toEqual([]);
    // Non-vocabulary tokens (brand/salt/form words) are never flagged.
    expect(unsupportedMedQualifiers('AMOXICILLIN TRIHYDRATE ORAL SUSPENSION', 'amoxicillin')).toEqual([]);
    // Short stems match only as standalone evidence tokens, never inside other words.
    expect(
      unsupportedMedQualifiers('CLOTRIMAZOLE AF TOPICAL CREAM', 'applied to the affected area after meals')
    ).toEqual(['af']);
    expect(unsupportedMedQualifiers('CLOTRIMAZOLE AF TOPICAL CREAM', 'clotrimazole af cream')).toEqual([]);
  });
});

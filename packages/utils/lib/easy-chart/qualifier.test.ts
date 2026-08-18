// Right drug, right form (requirements section 9). The dangerous case is not a low score — it is a wrong
// product winning because it was the only candidate.
import { describe, expect, it } from 'vitest';
import { filterUnsupportedQualifiers, medicationQualifierSupported } from './matchers';

describe('medication qualifier evidence', () => {
  it('refuses an athlete’s-foot product for a vaginal infection', () => {
    const request = 'vaginal candidiasis, start an antifungal cream';
    expect(medicationQualifierSupported("Clotrimazole AF Athlete's Foot Cream", request)).toBe(false);
    expect(medicationQualifierSupported('Miconazole Vaginal Cream', request)).toBe(true);
  });

  it('allows the same product when the visit supports it', () => {
    const request = 'tinea pedis, athlete’s foot, start clotrimazole';
    expect(medicationQualifierSupported("Clotrimazole AF Athlete's Foot Cream", request)).toBe(true);
  });

  it('never filters a product with no qualifier in its name', () => {
    expect(medicationQualifierSupported('Amoxicillin 500 mg capsule', 'sore throat, strep positive')).toBe(true);
  });

  it('judges route qualifiers the same way', () => {
    expect(medicationQualifierSupported('Neomycin Otic Solution', 'conjunctivitis, wants drops')).toBe(false);
    expect(medicationQualifierSupported('Neomycin Otic Solution', 'otitis externa, ear pain')).toBe(true);
    expect(medicationQualifierSupported('Erythromycin Ophthalmic Ointment', 'conjunctivitis, red eye')).toBe(true);
  });

  it('drops the unsupported candidates and reports an empty list rather than inventing one', () => {
    const candidates = [{ display: "Tolnaftate Athlete's Foot Cream" }, { display: 'Miconazole Vaginal Cream' }];
    expect(filterUnsupportedQualifiers(candidates, 'vaginal yeast infection')).toEqual([
      { display: 'Miconazole Vaginal Cream' },
    ]);
    expect(filterUnsupportedQualifiers([{ display: "Athlete's Foot Cream" }], 'vaginal yeast infection')).toEqual([]);
  });
});

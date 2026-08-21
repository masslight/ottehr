import { describe, expect, it } from 'vitest';
import { PracticeManagedQuestionnaireItem } from '../../types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { HARVEST_LOCK_MANIFEST, resolveLocksForQuestionnaire } from './index';

const item = (overrides: Partial<PracticeManagedQuestionnaireItem>): PracticeManagedQuestionnaireItem =>
  ({ _key: 'k'.repeat(8), linkId: 'x', type: 'string', ...overrides }) as PracticeManagedQuestionnaireItem;

describe('HARVEST_LOCK_MANIFEST', () => {
  it('locks the known harvested pages, fields, and protected option codes', () => {
    expect(HARVEST_LOCK_MANIFEST.lockedPageLinkIds).toContain('contact-information-page');
    expect(HARVEST_LOCK_MANIFEST.lockedPageLinkIds).toContain('payment-option-page');
    expect(HARVEST_LOCK_MANIFEST.lockedItemLinkIds).toContain('patient-first-name');
    expect(HARVEST_LOCK_MANIFEST.lockedItemLinkIds).toContain('insurance-carrier');
    expect(HARVEST_LOCK_MANIFEST.lockedItemLinkIds).toContain('insurance-carrier-2');
    expect(HARVEST_LOCK_MANIFEST.protectedOptionCodes['payment-option']).toContain('I have insurance');
    expect(HARVEST_LOCK_MANIFEST.protectedOptionCodes['insurance-priority']).toEqual(['Primary', 'Secondary']);
    expect(HARVEST_LOCK_MANIFEST.protectedOptionCodes['patient-birth-sex']).toEqual(['Male', 'Female', 'Intersex']);
  });
});

describe('resolveLocksForQuestionnaire', () => {
  it('resolves page, item, and protected-option locks from the manifest', () => {
    const q = {
      item: [
        item({
          linkId: 'contact-information-page',
          type: 'group',
          item: [
            item({ linkId: 'patient-first-name', type: 'string' }),
            item({ linkId: 'patient-birth-sex', type: 'choice' }),
            item({ linkId: 'favorite-color', type: 'string' }),
          ],
        }),
      ],
    };

    const locks = resolveLocksForQuestionnaire(q);

    expect(locks.lockedPageLinkIds.has('contact-information-page')).toBe(true);
    expect(locks.lockedItemLinkIds.has('patient-first-name')).toBe(true);
    expect(locks.lockedItemLinkIds.has('patient-birth-sex')).toBe(true);
    // a field harvest never reads is freely editable
    expect(locks.lockedItemLinkIds.has('favorite-color')).toBe(false);
    expect(locks.protectedOptionCodesByLinkId.get('patient-birth-sex')?.has('Male')).toBe(true);
  });

  it('locks a non-harvested item that another item points at (trigger target)', () => {
    const q = {
      item: [
        item({
          linkId: 'custom-page',
          type: 'group',
          item: [
            item({ linkId: 'has-condition', type: 'boolean' }),
            item({
              linkId: 'condition-details',
              type: 'string',
              triggers: [
                { targetQuestionLinkId: 'has-condition', effect: ['enable'], operator: '=', answerBoolean: true },
              ],
            }),
          ],
        }),
      ],
    };

    const locks = resolveLocksForQuestionnaire(q);

    // 'has-condition' is referenced by another item's trigger, so it can't be removed even though harvest
    // doesn't read it
    expect(locks.lockedItemLinkIds.has('has-condition')).toBe(true);
    // the referencing item itself stays freely editable
    expect(locks.lockedItemLinkIds.has('condition-details')).toBe(false);
  });

  it('does not lock a referenced linkId that is not present in the questionnaire', () => {
    const q = {
      item: [
        item({
          linkId: 'custom-page',
          type: 'group',
          item: [
            item({
              linkId: 'condition-details',
              type: 'string',
              triggers: [
                { targetQuestionLinkId: 'missing-target', effect: ['enable'], operator: '=', answerBoolean: true },
              ],
            }),
          ],
        }),
      ],
    };

    const locks = resolveLocksForQuestionnaire(q);
    expect(locks.lockedItemLinkIds.has('missing-target')).toBe(false);
  });
});

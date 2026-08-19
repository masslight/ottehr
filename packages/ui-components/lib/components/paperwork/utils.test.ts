import { IntakeQuestionnaireItem } from 'utils/lib/types/data/paperwork/paperwork.types';
import { describe, expect, it } from 'vitest';
import {
  CERTIFIED_DISPATCH_CASES,
  LEGACY_ONLY_FORM_ITEM_TYPES,
  PAPERWORK_FORM_ITEM_TYPES,
} from './certifiedItemCatalog';
import { getInputTypeForItem, getUCInputType } from './utils';

describe('getInputTypeForItem', () => {
  it.each(CERTIFIED_DISPATCH_CASES.map((c) => [c.label, c] as const))('dispatches %s', (_label, dispatchCase) => {
    expect(getInputTypeForItem(dispatchCase.item)).toBe(dispatchCase.rendersAs);
  });

  it('covers every paperwork FormItemType with at least one certified case', () => {
    const covered = new Set(CERTIFIED_DISPATCH_CASES.map((c) => c.rendersAs));
    const uncovered = PAPERWORK_FORM_ITEM_TYPES.filter((formItemType) => !covered.has(formItemType));
    expect(uncovered).toEqual([]);
  });

  it('never produces a legacy-only FormItemType', () => {
    const produced = new Set(CERTIFIED_DISPATCH_CASES.map((c) => getInputTypeForItem(c.item)));
    for (const legacyType of LEGACY_ONLY_FORM_ITEM_TYPES) {
      expect(produced.has(legacyType)).toBe(false);
    }
  });

  // Pins current behavior: item types the paperwork dispatcher does not handle resolve to
  // undefined rather than throwing. 'reference' items only occur inside group widgets
  // (e.g. pharmacy collection) that render their children themselves.
  it.each([['integer'], ['dateTime'], ['time'], ['reference'], ['quantity'], ['url']])(
    'resolves unhandled item type %s to undefined',
    (unhandledType) => {
      const item = {
        linkId: 'unhandled-item',
        type: unhandledType,
        acceptsMultipleAnswers: false,
        alwaysFilter: false,
      } as unknown as IntakeQuestionnaireItem;
      expect(getInputTypeForItem(item)).toBeUndefined();
    }
  );
});

describe('getUCInputType', () => {
  it('maps Email to the email input type', () => {
    expect(getUCInputType('Email')).toBe('email');
  });

  it('maps Phone Number to the tel input type', () => {
    expect(getUCInputType('Phone Number')).toBe('tel');
  });

  it('defaults other data types to text', () => {
    expect(getUCInputType('DOB')).toBe('text');
    expect(getUCInputType(undefined)).toBe('text');
  });
});

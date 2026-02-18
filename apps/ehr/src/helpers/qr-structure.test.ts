import type { QuestionnaireItem } from 'fhir/r4';
import { describe, expect, it } from 'vitest';
import { containedItemWithLinkId } from './qr-structure';

describe('containedItemWithLinkId', () => {
  const questionnaireItem: QuestionnaireItem = {
    linkId: 'root',
    type: 'group',
    item: [
      {
        linkId: 'section-1',
        type: 'group',
        item: [
          { linkId: 'q1', type: 'string' },
          {
            linkId: 'sub-section-1',
            type: 'group',
            item: [
              { linkId: 'q2', type: 'string' },
              {
                linkId: 'sub-sub-section-1',
                type: 'group',
                item: [{ linkId: 'q3', type: 'string' }],
              },
            ],
          },
        ],
      },
      {
        linkId: 'section-2',
        type: 'group',
        item: [{ linkId: 'q4', type: 'string' }],
      },
    ],
  };

  it('returns the item if the root matches', () => {
    const result = containedItemWithLinkId(questionnaireItem, 'root');
    expect(result).toBe(questionnaireItem);
  });

  it('finds a nested item', () => {
    const result = containedItemWithLinkId(questionnaireItem, 'section-2');
    expect(result?.linkId).toBe('section-2');
  });

  it('finds a deeply nested item', () => {
    const result = containedItemWithLinkId(questionnaireItem, 'q3');
    expect(result?.linkId).toBe('q3');
  });

  it('returns undefined if not found', () => {
    const result = containedItemWithLinkId(questionnaireItem, 'does-not-exist');
    expect(result).toBeUndefined();
  });

  it('returns undefined if not found v2', () => {
    const leaf: QuestionnaireItem = {
      linkId: 'mismatch',
      type: 'string',
    };

    const result = containedItemWithLinkId(leaf, 'other');
    expect(result).toBeUndefined();
  });
});

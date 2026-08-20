import { PracticeManagedQuestionnaireItem } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { describe, expect, it } from 'vitest';
import { GROUPED_FIELD_TEMPLATES, RESERVED_GROUPED_FIELD_LINK_IDS } from './groupedFieldTemplates';
import { itemsReducer } from './questionnaire.reducer';

const page = (key: string, children: PracticeManagedQuestionnaireItem[] = []): PracticeManagedQuestionnaireItem =>
  ({ _key: key, linkId: 'page-1', type: 'group', text: 'Page 1', item: children }) as PracticeManagedQuestionnaireItem;

describe('itemsReducer UPDATE_ITEM', () => {
  it('clears dataType and preferredElement when the item type changes', () => {
    const child = {
      _key: 'child001',
      linkId: 'q',
      type: 'choice',
      dataType: 'Email',
      preferredElement: 'Radio',
    } as PracticeManagedQuestionnaireItem;
    const state = [page('page0001', [child])];

    const next = itemsReducer(state, { type: 'UPDATE_ITEM', key: 'child001', field: 'type', value: 'string' });
    const updated = next[0].item![0];

    expect(updated.type).toBe('string');
    expect(updated.dataType).toBeUndefined();
    expect(updated.preferredElement).toBeUndefined();
  });

  it('seeds an answerOption stub when switching to a choice type', () => {
    const child = { _key: 'child001', linkId: 'q', type: 'string' } as PracticeManagedQuestionnaireItem;
    const next = itemsReducer([page('page0001', [child])], {
      type: 'UPDATE_ITEM',
      key: 'child001',
      field: 'type',
      value: 'choice',
    });
    expect(next[0].item![0].answerOption).toEqual([{ valueString: '' }]);
  });
});

describe('itemsReducer ADD_GROUPED_FIELD', () => {
  const pharmacy = GROUPED_FIELD_TEMPLATES.find((t) => t.id === 'pharmacy-search')!;
  const photoId = GROUPED_FIELD_TEMPLATES.find((t) => t.id === 'photo-id-upload')!;
  const patientAddress = GROUPED_FIELD_TEMPLATES.find((t) => t.id === 'patient-address')!;

  it('inserts the patient-address block with its six fields and typed extensions', () => {
    const next = itemsReducer([page('page0001')], {
      type: 'ADD_GROUPED_FIELD',
      key: 'page0001',
      items: patientAddress.items,
    });
    const inserted = next[0].item!;

    expect(inserted.map((i) => i.linkId)).toEqual([
      'contact-page-address-text',
      'patient-street-address',
      'patient-street-address-2',
      'patient-city',
      'patient-state',
      'patient-zip',
    ]);
    // the state field keeps its full choice list and small width, ZIP keeps its typed data-type
    const state = inserted.find((i) => i.linkId === 'patient-state')!;
    expect(state.type).toBe('choice');
    expect(state.answerOption?.length ?? 0).toBeGreaterThan(1);
    expect(state.inputWidth).toBe('s');
    const zip = inserted.find((i) => i.linkId === 'patient-zip')!;
    expect(zip.dataType).toBe('ZIP');
    // autocomplete rides along as a preserved raw extension
    expect(inserted.find((i) => i.linkId === 'patient-street-address')!.extension).toEqual(
      expect.arrayContaining([expect.objectContaining({ valueString: expect.stringContaining('address-line1') })])
    );
  });

  it('inserts the pharmacy search subtree with its group-type extension and fresh keys', () => {
    const next = itemsReducer([page('page0001')], {
      type: 'ADD_GROUPED_FIELD',
      key: 'page0001',
      items: pharmacy.items,
    });
    const inserted = next[0].item!;

    expect(inserted).toHaveLength(1);
    const group = inserted[0];
    expect(group.linkId).toBe('pharmacy-collection');
    expect(group.type).toBe('group');
    expect(group._key).toHaveLength(8);
    expect(group.extension).toEqual(
      expect.arrayContaining([expect.objectContaining({ valueString: 'pharmacy-collection' })])
    );
    expect(group.item).toHaveLength(6);
    // every inserted node gets its own fresh react key
    expect(new Set(group.item!.map((c) => c._key)).size).toBe(6);
  });

  it('inserts photo-id attachments with a typed Image dataType and attachment instructions', () => {
    const next = itemsReducer([page('page0001')], {
      type: 'ADD_GROUPED_FIELD',
      key: 'page0001',
      items: photoId.items,
    });
    const inserted = next[0].item!;

    expect(inserted.map((i) => i.linkId)).toEqual(['photo-id-front', 'photo-id-back']);
    expect(inserted[0].type).toBe('attachment');
    expect(inserted[0].dataType).toBe('Image');
    expect(inserted[0].attachmentText).toContain('front');
  });

  it('does not mutate the shared template constant', () => {
    const before = JSON.stringify(pharmacy.items);
    itemsReducer([page('page0001')], { type: 'ADD_GROUPED_FIELD', key: 'page0001', items: pharmacy.items });
    expect(JSON.stringify(pharmacy.items)).toBe(before);
  });
});

describe('RESERVED_GROUPED_FIELD_LINK_IDS', () => {
  it('includes the load-bearing grouped-field linkIds', () => {
    expect(RESERVED_GROUPED_FIELD_LINK_IDS.has('pharmacy-collection')).toBe(true);
    expect(RESERVED_GROUPED_FIELD_LINK_IDS.has('photo-id-front')).toBe(true);
    expect(RESERVED_GROUPED_FIELD_LINK_IDS.has('insurance-card-back')).toBe(true);
    expect(RESERVED_GROUPED_FIELD_LINK_IDS.has('patient-state')).toBe(true);
  });
});

import { CatalogDataset } from 'utils/lib/types/adhoc/generation/infer.types';
import { describe, expect, it } from 'vitest';
import { parseDatasets } from '../src/ehr/infer-adhoc-report-layers/index';

// todo: rejection is not a business rule, maybe we can add support for mixed datasets later
describe('parseDatasets', () => {
  const layer = (id: string): CatalogDataset['layers'][number] => ({ id, label: id, fields: [] });
  const catalog: CatalogDataset[] = [
    { id: 'patients', label: 'Patients', fields: [], layers: [layer('allergies'), layer('medications')] },
    { id: 'encounters-comprehensive', label: 'Encounters', fields: [], layers: [layer('medications'), layer('codes')] },
    { id: 'billing', label: 'Billing', fields: [], layers: [layer('payments')] },
  ];

  it('keeps one dataset with its own layers', () => {
    expect(parseDatasets([{ id: 'patients', layerIds: ['allergies'] }], catalog)).toEqual([
      { id: 'patients', layerIds: ['allergies'] },
    ]);
  });

  it('drops layers that belong to another dataset', () => {
    expect(parseDatasets([{ id: 'billing', layerIds: ['payments', 'codes'] }], catalog)).toEqual([
      { id: 'billing', layerIds: ['payments'] },
    ]);
  });

  it('keeps several datasets, merging repeated entries in order', () => {
    expect(
      parseDatasets(
        [
          { id: 'patients', layerIds: ['allergies'] },
          { id: 'encounters-comprehensive', layerIds: ['medications'] },
          { id: 'patients', layerIds: ['medications', 'allergies'] },
        ],
        catalog
      )
    ).toEqual([
      { id: 'patients', layerIds: ['allergies', 'medications'] },
      { id: 'encounters-comprehensive', layerIds: ['medications'] },
    ]);
  });

  it('drops unknown datasets and malformed values', () => {
    expect(parseDatasets([{ id: 'claims', layerIds: [] }, null, { id: 'billing' }], catalog)).toEqual([
      { id: 'billing', layerIds: [] },
    ]);
    expect(parseDatasets('patients', catalog)).toEqual([]);
    expect(parseDatasets(undefined, catalog)).toEqual([]);
  });
});

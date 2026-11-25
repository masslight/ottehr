import { CatalogDataset } from 'utils/lib/types/adhoc/generation/infer.types';
import { describe, expect, it } from 'vitest';
import { foldIntoForeignLayers, parseDatasets } from '../src/ehr/infer-adhoc-report-layers/index';

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

  it('drops a layer whose fields another picked layer already has', () => {
    const withFields = (id: string, names: string[]): CatalogDataset['layers'][number] => ({
      id,
      label: id,
      fields: names.map((name) => ({ name })),
    });
    const vitalsCatalog: CatalogDataset[] = [
      {
        id: 'encounters-comprehensive',
        label: 'Encounters',
        fields: [],
        layers: [
          withFields('vitals', ['temperatureF', 'heartRate']),
          withFields('vitalsTemperature', ['temperatureF']),
          withFields('codes', ['icdCodes']),
        ],
      },
    ];
    expect(
      parseDatasets(
        [{ id: 'encounters-comprehensive', layerIds: ['vitalsTemperature', 'vitals', 'codes'] }],
        vitalsCatalog
      )
    ).toEqual([{ id: 'encounters-comprehensive', layerIds: ['vitals', 'codes'] }]);
    expect(
      parseDatasets([{ id: 'encounters-comprehensive', layerIds: ['vitalsTemperature', 'codes'] }], vitalsCatalog)
    ).toEqual([{ id: 'encounters-comprehensive', layerIds: ['vitalsTemperature', 'codes'] }]);
  });
});

describe('foldIntoForeignLayers', () => {
  const layer = (id: string): CatalogDataset['layers'][number] => ({ id, label: id, fields: [] });
  const catalog: CatalogDataset[] = [
    { id: 'patients', label: 'Patients', fields: [], layers: [layer('demographics'), layer('allergies')] },
    {
      id: 'billing',
      label: 'Billing',
      fields: [],
      layers: [layer('payments'), layer('patients.demographics'), layer('patients.allergies')],
    },
    { id: 'billing-claims', label: 'Claims', fields: [], layers: [layer('codes')] },
  ];

  it('folds the patients dataset into the visit rows when they offer its layers as foreign layers', () => {
    expect(
      foldIntoForeignLayers(
        [
          { id: 'billing', layerIds: [] },
          { id: 'patients', layerIds: ['demographics'] },
        ],
        catalog
      )
    ).toEqual([{ id: 'billing', layerIds: ['patients.demographics'] }]);
  });

  it('keeps several datasets when a layer is not offered, or when one is picked for its base fields only', () => {
    const notOffered = [
      { id: 'billing', layerIds: [] },
      { id: 'billing-claims', layerIds: ['codes'] },
    ];
    expect(foldIntoForeignLayers(notOffered, catalog)).toEqual(notOffered);
    const baseOnly = [
      { id: 'billing', layerIds: ['payments'] },
      { id: 'patients', layerIds: [] },
    ];
    expect(foldIntoForeignLayers(baseOnly, catalog)).toEqual(baseOnly);
  });

  const linked: CatalogDataset[] = [
    { id: 'patients', label: 'Patients', fields: [], layers: [layer('allergies')] },
    {
      id: 'encounters-comprehensive',
      label: 'Encounters',
      fields: [],
      layers: [
        layer('ai'),
        layer('patients.allergies'),
        layer('billing.charges'),
        layer('billing-claims.base'),
        layer('billing-claims.remits'),
      ],
    },
    { id: 'billing', label: 'Billing', fields: [], layers: [layer('charges'), layer('billing-claims.base')] },
    { id: 'billing-claims', label: 'Claims', fields: [], layers: [layer('remits')] },
  ];

  it('folds a dataset picked for its base columns into the host <dataset>.base link layer', () => {
    expect(
      foldIntoForeignLayers(
        [
          { id: 'encounters-comprehensive', layerIds: ['ai'] },
          { id: 'billing-claims', layerIds: [] },
        ],
        linked
      )
    ).toEqual([{ id: 'encounters-comprehensive', layerIds: ['ai', 'billing-claims.base'] }]);
  });

  it('drops a linked dataset whose base the host already has (Visit payments on Encounters)', () => {
    expect(
      foldIntoForeignLayers(
        [
          { id: 'encounters-comprehensive', layerIds: ['ai'] },
          { id: 'billing', layerIds: [] },
        ],
        linked
      )
    ).toEqual([{ id: 'encounters-comprehensive', layerIds: ['ai'] }]);
  });

  it('folds into a host the model did not pick when none of the picked ones can carry the others', () => {
    expect(
      foldIntoForeignLayers(
        [
          { id: 'patients', layerIds: ['allergies'] },
          { id: 'billing-claims', layerIds: ['remits'] },
        ],
        linked
      )
    ).toEqual([{ id: 'encounters-comprehensive', layerIds: ['patients.allergies', 'billing-claims.remits'] }]);
  });

  it('prefers a picked host over one the model did not pick', () => {
    expect(
      foldIntoForeignLayers(
        [
          { id: 'billing', layerIds: ['charges'] },
          { id: 'billing-claims', layerIds: [] },
        ],
        linked
      )
    ).toEqual([{ id: 'billing', layerIds: ['charges', 'billing-claims.base'] }]);
  });
});

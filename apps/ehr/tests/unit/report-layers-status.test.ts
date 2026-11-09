import { describe, expect, it } from 'vitest';
import { getDataset } from '../../src/features/report-builder/datasets/registry';
import { loadedLayerIdsFromSchema } from '../../src/features/report-builder/page/DatasetLayersInfo';

describe('loadedLayerIdsFromSchema', () => {
  const datasetId = 'encounters-comprehensive';
  const layerIds = (getDataset(datasetId)?.options ?? []).map((layer) => layer.id);

  it('marks a layer loaded exactly when the schema no longer offers it as available', () => {
    const availableLayers = layerIds.filter((id) => id !== 'imaging').map((id) => ({ id, label: id, description: '' }));
    const loaded = loadedLayerIdsFromSchema({ datasetId, availableLayers });

    expect(loaded.imaging).toBe(true);
    expect(Object.entries(loaded).filter(([, isLoaded]) => isLoaded)).toEqual([['imaging', true]]);
  });

  it('treats every layer as loaded when the schema lists none as available', () => {
    const loaded = loadedLayerIdsFromSchema({ datasetId });
    expect(Object.keys(loaded)).toEqual(layerIds);
    expect(Object.values(loaded).every(Boolean)).toBe(true);
  });
});

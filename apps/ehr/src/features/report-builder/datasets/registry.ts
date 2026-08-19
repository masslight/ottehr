import { layerSchemas } from 'utils/lib/types/adhoc/datasets/dataset';
import { llmFieldsFromZodObject } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { CatalogDataset } from 'utils/lib/types/adhoc/generation/infer.types';
import { billingDataset } from './billing';
import { adhocEncountersDataset } from './encounters';
import { patientsDataset } from './patients';
import { AdHocDataset } from './types';

export const AD_HOC_DATASETS: AdHocDataset[] = [adhocEncountersDataset, patientsDataset, billingDataset];

export function getDataset(id: string): AdHocDataset | undefined {
  return AD_HOC_DATASETS.find((d) => d.id === id);
}

export function otherDatasetsFor(id: string): { label: string; description: string }[] {
  return AD_HOC_DATASETS.filter((d) => d.id !== id).map((d) => ({ label: d.label, description: d.description }));
}

export function datasetCatalog(): CatalogDataset[] {
  return AD_HOC_DATASETS.map((dataset) => {
    const schemas = dataset.layers ? layerSchemas(dataset.layers) : {};
    return {
      id: dataset.id,
      label: dataset.label,
      description: dataset.description,
      fields: dataset.baseSchema
        ? llmFieldsFromZodObject(dataset.baseSchema, dataset.internalFields ?? []).map((f) => ({
            name: f.name,
            description: f.description,
          }))
        : [],
      layers: (dataset.options ?? []).map((layer) => ({
        id: layer.id,
        label: layer.label,
        description: layer.description,
        fields: schemas[layer.id]
          ? llmFieldsFromZodObject(schemas[layer.id]).map((f) => ({ name: f.name, description: f.description }))
          : [],
      })),
    };
  });
}

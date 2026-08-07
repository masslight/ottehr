// Builds the LLM-facing dataset schema from a dataset's Zod layer map (utils). Mostly static metadata
// (names, types, descriptions, enum members). The one place real values touch the LLM: for the
// whitelisted `domainFields` only, the distinct values present in the fetched rows are sampled
// (capped) so the model can match codes that truly occur. Everything else comes from the layer map.
import {
  AdHocLayerMap,
  AdHocRow,
  layerSchemas,
  LlmDatasetSchema,
  llmFieldsForLayers,
  sampleDomains,
  unloadedLayers,
} from 'utils';
import { z } from 'zod';

export function buildLlmDatasetSchema(params: {
  datasetId: string;
  label: string;
  description: string;
  rows: AdHocRow[];
  base: z.ZodObject<z.ZodRawShape>;
  layers: AdHocLayerMap;
  selected: Record<string, boolean>;
  internalFields: readonly string[];
  // Whitelisted code/label fields whose distinct present values may be disclosed to the LLM.
  domainFields: readonly string[];
  otherDatasets?: { label: string; description: string }[];
}): LlmDatasetSchema {
  const { datasetId, label, description, rows, base, layers, selected, internalFields, domainFields } = params;
  const availableLayers = unloadedLayers(layers, selected);
  const domains = sampleDomains(rows as Array<Record<string, unknown>>, domainFields);

  return {
    datasetId,
    label,
    description,
    rowCount: rows.length,
    fields: llmFieldsForLayers(base, layerSchemas(layers), selected, internalFields, domains),
    ...(availableLayers.length ? { availableLayers } : {}),
    ...(params.otherDatasets?.length ? { otherDatasets: params.otherDatasets } : {}),
  };
}

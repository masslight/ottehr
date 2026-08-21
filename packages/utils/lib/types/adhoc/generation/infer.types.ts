// Pre-fetch classifier, one model call: pick the layers a request needs, and reject a request asking
// for data no dataset carries. Rejection lives here, not at generation time, because there the task
// is "produce a report" and the model substitutes a near-miss field instead of refusing.
import { z } from 'zod';

const CatalogNestedFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

const CatalogFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** Members of a record column: without them the classifier cannot see e.g. vaccines.lotNumber. */
  fields: z.array(CatalogNestedFieldSchema).optional(),
});

const CatalogLayerSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  fields: z.array(CatalogFieldSchema),
});

export const CatalogDatasetSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  fields: z.array(CatalogFieldSchema),
  layers: z.array(CatalogLayerSchema),
});
export type CatalogDataset = z.infer<typeof CatalogDatasetSchema>;

export const InferAdHocLayersInputSchema = z.object({
  datasetId: z.string().min(1),
  // Every dataset: judging "this exists nowhere" needs the full catalogue.
  datasets: z.array(CatalogDatasetSchema),
  request: z.string().min(1),
});
export type InferAdHocLayersInput = z.infer<typeof InferAdHocLayersInputSchema>;

export const InferAdHocLayersOutputSchema = z.object({
  layerIds: z.array(z.string()),
  /** Non-empty means the request is rejected. */
  unavailable: z.array(z.string()).optional(),
  hint: z.string().optional(),
});
export type InferAdHocLayersOutput = z.infer<typeof InferAdHocLayersOutputSchema>;

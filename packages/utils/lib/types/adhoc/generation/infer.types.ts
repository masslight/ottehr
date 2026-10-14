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

export const InferDatasetFeedbackSchema = z.object({
  datasetId: z.string().min(1),
  concepts: z.array(z.string()),
  suggestedDatasetId: z.string().min(1),
});
export type InferDatasetFeedback = z.infer<typeof InferDatasetFeedbackSchema>;

export const InferAdHocLayersInputSchema = z.object({
  datasets: z.array(CatalogDatasetSchema),
  request: z.string().min(1),
  feedback: InferDatasetFeedbackSchema.optional(),
});
export type InferAdHocLayersInput = z.infer<typeof InferAdHocLayersInputSchema>;

export const InferAdHocLayersOutputSchema = z
  .object({
    datasets: z.array(z.object({ id: z.string(), layerIds: z.array(z.string()) })),
    unavailable: z.array(z.string()).optional(),
    hint: z.string().optional(),
  })
  .refine((o) => o.datasets.length > 0 || !!o.unavailable?.length, {
    message: 'datasets may be empty only when unavailable is set',
  });
export type InferAdHocLayersOutput = z.infer<typeof InferAdHocLayersOutputSchema>;
